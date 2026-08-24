import React from "react";
import AdminCompaniesPage from "./pages/AdminCompaniesPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminEmployeesPage from "./pages/AdminEmployeesPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import { products as initialProducts } from "./data/products.js";
import { hasPermission } from "./data/permissions.js";
import { createTranslator } from "./data/translations.js";
import {
  fetchCurrentUser,
  getCurrentUser,
  loginUser,
  logoutUser,
  setCurrentUser as persistCurrentUser,
} from "./utils/auth.js";
import { protectedApiErrorEvent } from "./utils/api.js";
import { assignOrderEmployee, deleteOrder, getOrders, updateOrderStatus } from "./utils/orders.js";
import {
  createEmployee as createEmployeeApi,
  deleteEmployee as deleteEmployeeApi,
  fetchEmployees,
  updateEmployee as updateEmployeeApi,
  updateEmployeeStatus,
} from "./utils/employeesApi.js";
import { fetchEmployeeWorkSessions } from "./utils/workSessionsApi.js";
import {
  createProduct as createProductApi,
  deleteProduct as deleteProductApi,
  fetchProducts,
  updateProduct as updateProductApi,
} from "./utils/productsApi.js";
import {
  deleteHomepageOffer,
  deleteReview as deleteReviewApi,
  fetchAllHomepageCategoryCards,
  fetchAllHomepageOffers,
  fetchAllReviews,
  saveHomepageCategoryCard,
  saveHomepageOffer,
  updateReviewStatus,
} from "./utils/homeContentApi.js";
import {
  clearWebsiteMediaCache,
  deleteWebsiteMedia as deleteWebsiteMediaApi,
  fetchAllWebsiteMedia,
  saveWebsiteMedia as saveWebsiteMediaApi,
} from "./utils/websiteMediaApi.js";
import "./styles/global.css";

const pagePaths = {
  "admin-login": "/admin/login",
  admin: "/admin",
  "admin-platform-companies": "/admin/platform/companies",
  "admin-products": "/admin/products",
  "admin-products-new": "/admin/products/new",
  "admin-categories": "/admin/categories",
  "admin-categories-new": "/admin/categories/new",
  "admin-brands": "/admin/brands",
  "admin-brands-new": "/admin/brands/new",
  "admin-vlogs": "/admin/vlogs",
  "admin-vlogs-new": "/admin/vlogs/new",
  "admin-store-locator": "/admin/store-locator",
  "admin-store-locator-new": "/admin/store-locator/new",
  "admin-website-media": "/admin/website-media",
  "admin-orders": "/admin/orders",
  "admin-reviews": "/admin/reviews",
  "admin-inventory": "/admin/inventory",
  "admin-customers": "/admin/customers",
  "admin-staff": "/admin/staff",
  "admin-staff-new": "/admin/staff/new",
  "admin-employees": "/admin/staff",
  "admin-settings": "/admin/settings",
};

const adminPageKeys = Object.keys(pagePaths).filter((page) => page !== "admin-login");
const staffPageKeys = ["admin-staff", "admin-staff-new", "admin-employees"];

function isAdminRole(role) {
  return role === "super_admin" || role === "admin" || role === "manager";
}

function landingPage(user) {
  if (user?.role === "super_admin") return "admin-platform-companies";
  if (user?.role === "admin" || user?.role === "manager") return "admin";
  return "admin-login";
}

function resolvePage(pathname, user) {
  if (pathname === "/" || pathname === "/admin/dashboard") return landingPage(user);
  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  if (!match) return landingPage(user);
  if (match[0] === "admin-login") return isAdminRole(user?.role) ? landingPage(user) : match[0];
  return isAdminRole(user?.role) ? match[0] : "admin-login";
}

function mergeCatalogDetails(products) {
  return products.map((product) => {
    const local = initialProducts.find(
      (item) => item.id === product.id || item.slug === product.slug,
    );
    return local ? { ...local, ...product } : product;
  });
}

function CPanelApp() {
  const storedUser = React.useMemo(() => getCurrentUser(), []);
  const [activePage, setActivePage] = React.useState(() =>
    resolvePage(window.location.pathname, storedUser),
  );
  const [currentUser, setUser] = React.useState(storedUser);
  const [products, setProducts] = React.useState(initialProducts);
  const [orders, setOrders] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [employeeSessions, setEmployeeSessions] = React.useState([]);
  const [homepageOffers, setHomepageOffers] = React.useState([]);
  const [homepageCategoryCards, setHomepageCategoryCards] = React.useState([]);
  const [reviews, setReviews] = React.useState([]);
  const [websiteMedia, setWebsiteMedia] = React.useState([]);
  const [adminLoginMessage, setAdminLoginMessage] = React.useState("");
  const [adminMessage, setAdminMessage] = React.useState("");
  const [language, setLanguage] = React.useState(
    () => localStorage.getItem("epChemicalLanguage") || "en",
  );
  const [isDarkMode, setIsDarkMode] = React.useState(
    () => localStorage.getItem("epChemicalAdminDarkMode") === "true",
  );
  const t = React.useMemo(() => createTranslator(language), [language]);

  function navigate(page, options = {}) {
    const safePage = pagePaths[page] ? page : landingPage(currentUser);
    setAdminMessage("");
    if (!options.preserveLoginMessage) setAdminLoginMessage("");
    setActivePage(safePage);
    if (window.location.pathname !== pagePaths[safePage]) {
      window.history[options.replace ? "replaceState" : "pushState"]({}, "", pagePaths[safePage]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleApiError(error) {
    if (error?.status === 401) {
      persistCurrentUser(null);
      setUser(null);
      setAdminLoginMessage("Your session expired. Please sign in again.");
      navigate("admin-login", { preserveLoginMessage: true, replace: true });
      return;
    }
    setAdminMessage(error?.status === 403 ? "Access denied." : error?.message || "Request failed.");
  }

  React.useEffect(() => {
    const canonicalPath = pagePaths[activePage];
    if (canonicalPath && canonicalPath !== window.location.pathname) {
      window.history.replaceState({}, "", canonicalPath);
    }
  }, []);

  React.useEffect(() => {
    function onPopState() {
      setActivePage(resolvePage(window.location.pathname, getCurrentUser()));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  React.useEffect(() => {
    function onProtectedApiError(event) {
      const status = event.detail?.status;
      if (status !== 401 && status !== 403) return;

      const error = new Error(status === 401 ? "Authentication required." : "Access denied.");
      error.status = status;
      handleApiError(error);
    }

    window.addEventListener(protectedApiErrorEvent, onProtectedApiError);
    return () => window.removeEventListener(protectedApiErrorEvent, onProtectedApiError);
  }, []);

  React.useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (user && !isAdminRole(user.role)) {
          persistCurrentUser(null);
          setUser(null);
          setAdminLoginMessage("Access denied. An administrator account is required.");
        } else {
          setUser(user);
        }
      })
      .catch(() => {
        persistCurrentUser(null);
        setUser(null);
      });
  }, []);

  React.useEffect(() => {
    if (currentUser && !isAdminRole(currentUser.role)) {
      persistCurrentUser(null);
      setUser(null);
      navigate("admin-login", { preserveLoginMessage: true, replace: true });
      return;
    }
    if (!currentUser && activePage !== "admin-login") {
      setAdminLoginMessage(t("adminLogin.loginRequired"));
      navigate("admin-login", { preserveLoginMessage: true, replace: true });
    } else if (currentUser && activePage === "admin-login") {
      navigate(landingPage(currentUser), { replace: true });
    }
  }, [activePage, currentUser, t]);

  React.useEffect(() => {
    localStorage.setItem("epChemicalLanguage", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  React.useEffect(() => {
    localStorage.setItem("epChemicalAdminDarkMode", String(isDarkMode));
  }, [isDarkMode]);

  React.useEffect(() => {
    if (!isAdminRole(currentUser?.role) || currentUser.role === "super_admin") return;
    void refreshProducts();
    void refreshOrders(currentUser);
    void refreshEmployees(currentUser);
    void refreshAdminContent(currentUser);
    void refreshWebsiteMedia(currentUser);
  }, [currentUser]);

  async function refreshProducts() {
    try {
      const next = mergeCatalogDetails(await fetchProducts());
      setProducts(next);
      return next;
    } catch (error) {
      handleApiError(error);
      return products;
    }
  }

  async function refreshOrders(user = currentUser) {
    if (!user) return [];
    try {
      const next = await getOrders(user);
      setOrders(next);
      return next;
    } catch (error) {
      setOrders([]);
      handleApiError(error);
      return [];
    }
  }

  async function refreshEmployees(user = currentUser) {
    if (user?.role !== "admin") {
      setEmployees([]);
      setEmployeeSessions([]);
      return [];
    }
    try {
      const [nextEmployees, sessions] = await Promise.all([
        fetchEmployees(),
        fetchEmployeeWorkSessions(),
      ]);
      setEmployees(nextEmployees);
      setEmployeeSessions(sessions);
      return nextEmployees;
    } catch (error) {
      handleApiError(error);
      return [];
    }
  }

  async function refreshAdminContent(user = currentUser) {
    if (user?.role !== "admin") return;
    try {
      const [nextReviews, offers, cards] = await Promise.all([
        fetchAllReviews(),
        fetchAllHomepageOffers(),
        fetchAllHomepageCategoryCards(),
      ]);
      setReviews(nextReviews);
      setHomepageOffers(offers);
      setHomepageCategoryCards(cards);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function refreshWebsiteMedia(user = currentUser) {
    if (!hasPermission(user, "website_media.manage")) return;
    try {
      clearWebsiteMediaCache();
      setWebsiteMedia(await fetchAllWebsiteMedia());
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleAdminLogin(credentials) {
    try {
      const session = await loginUser(credentials.email, credentials.password);
      if (!isAdminRole(session.user?.role)) {
        await logoutUser().catch(() => null);
        persistCurrentUser(null);
        setUser(null);
        setAdminLoginMessage("Access denied. An administrator account is required.");
        return;
      }
      setUser(session.user);
      navigate(landingPage(session.user));
    } catch (error) {
      setAdminLoginMessage(error.message || t("auth.loginFailed"));
    }
  }

  async function handleLogout() {
    await logoutUser().catch(() => persistCurrentUser(null));
    setUser(null);
    setOrders([]);
    setEmployees([]);
    navigate("admin-login");
  }

  async function handleSaveProduct(product) {
    try {
      const saved = products.some((item) => item.id === product.id)
        ? await updateProductApi(product)
        : await createProductApi(product);
      await refreshProducts();
      return { ok: true, message: t("admin.productSaved"), product: saved };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm(t("admin.deleteConfirm"))) return undefined;
    try {
      await deleteProductApi(id);
      await refreshProducts();
      return { ok: true, message: t("admin.productDeleted") };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleSaveEmployee(employee) {
    try {
      const exists = employees.some((item) => item.id === employee.id);
      const saved = exists ? await updateEmployeeApi(employee) : await createEmployeeApi(employee);
      await refreshEmployees();
      const message = exists ? t("admin.employeeSaved") : t("employee.employeeCreatedSuccessfully");
      return { ok: true, message, employee: saved };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleDeleteEmployee(id) {
    if (!window.confirm(t("admin.deleteEmployeeConfirm"))) return undefined;
    try {
      await deleteEmployeeApi(id);
      await refreshEmployees();
      return { ok: true, message: t("admin.employeeDeleted") };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleToggleEmployeeStatus(employee) {
    try {
      await updateEmployeeStatus(employee.id, !employee.isActive);
      await refreshEmployees();
      return { ok: true, message: t("admin.employeeUpdated") };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleOrderStatusChange(id, status) {
    try {
      const order = await updateOrderStatus(id, status);
      await refreshOrders();
      return { ok: true, message: t("employee.statusUpdatedSuccessfully"), order };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleAssignEmployee(id, employeeId) {
    if (!employeeId) return undefined;
    try {
      const order = await assignOrderEmployee(id, employeeId);
      await refreshOrders();
      return { ok: true, message: t("admin.orderUpdated"), order };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleDeleteOrder(id) {
    if (!window.confirm(t("admin.deleteConfirm"))) return { ok: false, message: "" };
    try {
      await deleteOrder(id);
      await refreshOrders();
      return { ok: true, message: t("employee.orderDeletedSuccessfully") };
    } catch (error) {
      handleApiError(error);
      return { ok: false, message: error.message };
    }
  }

  async function handleSaveOffer(offer) {
    try {
      const saved = await saveHomepageOffer(offer);
      setHomepageOffers(await fetchAllHomepageOffers());
      return saved;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleSaveCategoryCard(card) {
    try {
      const saved = await saveHomepageCategoryCard(card);
      setHomepageCategoryCards(await fetchAllHomepageCategoryCards());
      return saved;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleDeleteOffer(id) {
    try {
      await deleteHomepageOffer(id);
      setHomepageOffers(await fetchAllHomepageOffers());
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleModerateReview(id, status, isActive = true) {
    try {
      const review = await updateReviewStatus(id, status, isActive);
      setReviews(await fetchAllReviews());
      return review;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleDeleteReview(id) {
    try {
      await deleteReviewApi(id);
      setReviews(await fetchAllReviews());
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleSaveWebsiteMedia(item) {
    try {
      const saved = await saveWebsiteMediaApi(item);
      await refreshWebsiteMedia();
      return saved;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleDeleteWebsiteMedia(id) {
    try {
      await deleteWebsiteMediaApi(id);
      await refreshWebsiteMedia();
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  const sharedLayoutProps = {
    currentUser,
    isDarkMode,
    language,
    onLanguageChange: () => setLanguage((value) => (value === "en" ? "ar" : "en")),
    onLogout: handleLogout,
    onNavigate: navigate,
    onToggleDarkMode: () => setIsDarkMode((value) => !value),
  };

  return (
    <div className={activePage === "admin-login" ? "app-shell admin-login-shell" : "app-shell"}>
      <main className={activePage === "admin-login" ? "admin-login-main" : "admin-panel-main"}>
        {activePage === "admin-login" && (
          <AdminLoginPage message={adminLoginMessage} onLogin={handleAdminLogin} t={t} />
        )}

        {adminPageKeys.includes(activePage) &&
          activePage !== "admin-platform-companies" &&
          !staffPageKeys.includes(activePage) && (
            <AdminDashboardPage
              activePage={activePage}
              employees={employees}
              homepageCategoryCards={homepageCategoryCards}
              homepageOffers={homepageOffers}
              onAssignEmployee={handleAssignEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onDeleteOffer={handleDeleteOffer}
              onDeleteOrder={handleDeleteOrder}
              onDeleteProduct={handleDeleteProduct}
              onDeleteReview={handleDeleteReview}
              onDeleteWebsiteMedia={handleDeleteWebsiteMedia}
              onModerateReview={handleModerateReview}
              onSaveCategoryCard={handleSaveCategoryCard}
              onSaveEmployee={handleSaveEmployee}
              onSaveOffer={handleSaveOffer}
              onSaveProduct={handleSaveProduct}
              onSaveWebsiteMedia={handleSaveWebsiteMedia}
              onStatusChange={handleOrderStatusChange}
              orders={orders}
              products={products}
              reviews={reviews}
              statusMessage={adminMessage}
              t={t}
              websiteMedia={websiteMedia}
              {...sharedLayoutProps}
            />
          )}

        {activePage === "admin-platform-companies" && <AdminCompaniesPage {...sharedLayoutProps} />}

        {staffPageKeys.includes(activePage) && (
          <AdminEmployeesPage
            activePage={activePage}
            employees={employees}
            onDeleteEmployee={handleDeleteEmployee}
            onSaveEmployee={handleSaveEmployee}
            onToggleEmployeeStatus={handleToggleEmployeeStatus}
            sessions={employeeSessions}
            statusMessage={adminMessage}
            t={t}
            {...sharedLayoutProps}
          />
        )}
      </main>
    </div>
  );
}

export default CPanelApp;
