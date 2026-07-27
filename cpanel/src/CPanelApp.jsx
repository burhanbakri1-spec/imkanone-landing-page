import React from "react";
import AdminCompaniesPage from "./pages/AdminCompaniesPage.jsx";
import AdminDomainsPage from "./pages/AdminDomainsPage.jsx";
import AdminPlatformOverview from "./pages/AdminPlatformOverview.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminEmployeesPage from "./pages/AdminEmployeesPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminDropshippingPage from "./pages/AdminDropshippingPage.jsx";
import AdminFeaturePage, { featurePageKeys } from "./pages/AdminFeaturePage.jsx";
import AdminPlaceholderPage from "./pages/AdminPlaceholderPage.jsx";
import {
  isNavigationPlaceholderPage,
  placeholderPageKeys,
  placeholderPagePaths,
} from "./data/adminNavigation.js";
import { hasPermission } from "./data/permissions.js";
import { createTranslator } from "./data/translations.js";
import {
  fetchCurrentUser,
  getCurrentUser,
  enterCompanyScope,
  exitCompanyScope,
  loginUser,
  logoutUser,
  setCurrentUser as persistCurrentUser,
} from "./utils/auth.js";
import { moduleAllowsPage } from "./utils/moduleRegistry.js";
import { performSecureCompanySwitch } from "./utils/companySwitcher.js";
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
  createBrand,
  createCategory,
  deleteBrand,
  deleteCategory,
  fetchBrands,
  fetchCategories,
  updateBrand,
  updateCategory,
} from "./utils/catalogApi.js";
import {
  applyCompanyDocumentBranding,
  clearTenantCaches,
  getStoredCompanyContext,
} from "./utils/companyContext.js";
import { updateCompanySettings } from "./utils/companyApi.js";
import {
  clearWebsiteMediaCache,
  deleteWebsiteMedia as deleteWebsiteMediaApi,
  fetchAllWebsiteMedia,
  saveWebsiteMedia as saveWebsiteMediaApi,
} from "./utils/websiteMediaApi.js";
import { isValidCpanelUser, landingPage, resolvePage } from "./utils/cpanelAccess.js";
import {
  canAccessAdminPage,
  adminDashboardPath,
  isAdminPortalRole,
  isCompanyAdmin,
  isPlatformAdmin,
  landingPageForRole,
  resolveAdminPage,
  canReadCatalogFormOptions,
} from "./utils/roles.js";

import "./styles/global.css";

const pagePaths = {
  "admin-login": "/admin/login",
  admin: adminDashboardPath,
  "admin-platform-overview": "/admin/platform/overview",
  "admin-platform-companies": "/admin/platform/companies",
  "admin-platform-domains": "/admin/platform/domains",
  "admin-products": "/admin/products",
  "admin-products-new": "/admin/products/new",
  "admin-products-edit": "/admin/products/new",
  "admin-categories": "/admin/categories",
  "admin-categories-new": "/admin/categories/new",
  "admin-brands": "/admin/brands",
  "admin-brands-new": "/admin/brands/new",
  "admin-vlogs": "/admin/vlogs",
  "admin-vlogs-new": "/admin/vlogs/new",
  "admin-store-locator": "/admin/store-locator",
  "admin-store-locator-new": "/admin/store-locator/new",
  "admin-website-media": "/admin/website-media",
  "admin-website-texts": "/admin/website-texts",
  "admin-orders": "/admin/orders",
  "admin-reviews": "/admin/reviews",
  "admin-inventory": "/admin/inventory",
  "admin-customers": "/admin/customers",
  "admin-staff": "/admin/staff",
  "admin-staff-new": "/admin/staff/new",
  "admin-employees": "/admin/staff",
  "admin-settings": "/admin/settings",
  "admin-product-settings": "/admin/product-settings",
  "admin-invoices": "/admin/invoices",
  "admin-delivery": "/admin/delivery",
  "admin-reports": "/admin/reports",
  "admin-activity-log": "/admin/activity-log",
  "admin-unit-creator": "/admin/unit-creator",
  "admin-dropshipping": "/admin/dropshipping",
  "admin-dropshipping-marketers": "/admin/dropshipping/marketers",
  "admin-dropshipping-products": "/admin/dropshipping/products",
  "admin-dropshipping-orders": "/admin/dropshipping/orders",
  "admin-dropshipping-earnings": "/admin/dropshipping/earnings",
  "admin-dropshipping-withdrawals": "/admin/dropshipping/withdrawals",
  "admin-dropshipping-reports": "/admin/dropshipping/reports",
  "admin-dropshipping-settings": "/admin/dropshipping/settings",
  "admin-no-access": "/admin/no-access",
  ...placeholderPagePaths,
};

const adminPageKeys = Object.keys(pagePaths).filter((page) => page !== "admin-login");
const staffPageKeys = ["admin-staff", "admin-staff-new", "admin-employees"];
const dropshippingPageKeys = Object.keys(pagePaths).filter((key) =>
  key.startsWith("admin-dropshipping"),
);

function CPanelApp() {
  const storedUser = React.useMemo(() => getCurrentUser(), []);
  const [company, setCompany] = React.useState(
    () => storedUser?.activeCompany || getStoredCompanyContext(),
  );
  const [activePage, setActivePage] = React.useState(() =>
    resolvePage(window.location.pathname, storedUser),
  );
  const [currentUser, setUser] = React.useState(storedUser);
  const modules = company?.modules || [];
  const [products, setProducts] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [brands, setBrands] = React.useState([]);
  const [orders, setOrders] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [employeeSessions, setEmployeeSessions] = React.useState([]);
  const [homepageOffers, setHomepageOffers] = React.useState([]);
  const [homepageCategoryCards, setHomepageCategoryCards] = React.useState([]);
  const [reviews, setReviews] = React.useState([]);
  const [websiteMedia, setWebsiteMedia] = React.useState([]);
  const [websiteMediaError, setWebsiteMediaError] = React.useState("");
  const [adminLoginMessage, setAdminLoginMessage] = React.useState("");
  const [adminMessage, setAdminMessage] = React.useState("");
  const [adminMessageType, setAdminMessageType] = React.useState("success");
  const [language, setLanguage] = React.useState(
    () => localStorage.getItem("epChemicalLanguage") || "en",
  );
  const [isDarkMode, setIsDarkMode] = React.useState(
    () => localStorage.getItem("epChemicalAdminDarkMode") === "true",
  );
  const previousCompanyId = React.useRef(company?.id || null);
  const t = React.useMemo(() => createTranslator(language), [language]);

  function navigate(page, options = {}) {
    const authorizationUser =
      options.user ||
      (Object.prototype.hasOwnProperty.call(options, "role")
        ? options.role
          ? { role: options.role }
          : null
        : currentUser);
    const navigationCompany = Object.prototype.hasOwnProperty.call(options, "company")
      ? options.company
      : company;
    const navigationModules = options.modules || modules;
    const roleAllowed = pagePaths[page] && canAccessAdminPage(authorizationUser, page);
    const moduleAllowed =
      !navigationCompany ||
      page === "admin-platform-companies" ||
      page === "admin-platform-domains" ||
      page === "admin-login" ||
      isNavigationPlaceholderPage(page) ||
      moduleAllowsPage(navigationModules, page);
    const safePage =
      roleAllowed && moduleAllowed ? page : landingPage(authorizationUser || {}, navigationModules);
    if (!options.preserveStatusMessage) setAdminMessage("");
    if (!options.preserveLoginMessage) setAdminLoginMessage("");
    setActivePage(safePage);
    const destinationPath = options.path || pagePaths[safePage];
    if (window.location.pathname !== destinationPath) {
      window.history[options.replace ? "replaceState" : "pushState"]({}, "", destinationPath);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleApiError(error) {
    if (error?.status === 401) {
      persistCurrentUser(null);
      setUser(null);
      setCompany(null);
      setProducts([]);
      setCategories([]);
      setBrands([]);
      setOrders([]);
      setEmployees([]);
      setReviews([]);
      setHomepageOffers([]);
      setHomepageCategoryCards([]);
      setWebsiteMedia([]);
      setWebsiteMediaError("");
      setAdminLoginMessage("Your session expired. Please sign in again.");
      navigate("admin-login", { preserveLoginMessage: true, replace: true, role: null });
      return;
    }
    setAdminMessageType("error");
    setAdminMessage(error?.status === 403 ? "Access denied." : error?.message || "Request failed.");
  }

  React.useEffect(() => {
    const canonicalPath = pagePaths[activePage];
    const isProductEditPath =
      ["admin-products-new", "admin-products-edit"].includes(activePage) &&
      /^\/admin\/products\/[^/]+\/edit$/.test(window.location.pathname);
    if (canonicalPath && canonicalPath !== window.location.pathname && !isProductEditPath) {
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
    const nextCompanyId = company?.id || null;
    if (previousCompanyId.current !== nextCompanyId) {
      clearTenantCaches();
      setProducts([]);
      setCategories([]);
      setBrands([]);
      setOrders([]);
      setEmployees([]);
      setEmployeeSessions([]);
      setReviews([]);
      setHomepageOffers([]);
      setHomepageCategoryCards([]);
      setWebsiteMedia([]);
      setWebsiteMediaError("");
      previousCompanyId.current = nextCompanyId;
    }
    applyCompanyDocumentBranding(company);
  }, [company]);

  React.useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (user && !isValidCpanelUser(user)) {
          persistCurrentUser(null);
          setUser(null);
          setAdminLoginMessage("Access denied. An administrator account is required.");
        } else {
          setUser(user);
          setCompany(user?.activeCompany || null);
        }
      })
      .catch(() => {
        persistCurrentUser(null);
        setUser(null);
        setCompany(null);
      });
  }, []);

  React.useEffect(() => {
    if (currentUser && !isValidCpanelUser(currentUser)) {
      persistCurrentUser(null);
      setUser(null);
      navigate("admin-login", { preserveLoginMessage: true, replace: true });
      return;
    }
    if (!currentUser && activePage !== "admin-login") {
      setAdminLoginMessage(t("adminLogin.loginRequired"));
      navigate("admin-login", { preserveLoginMessage: true, replace: true });
    } else if (currentUser && activePage === "admin-login") {
      navigate(landingPage(currentUser, modules), { replace: true });
    }
  }, [activePage, currentUser, modules, t]);

  React.useEffect(() => {
    if (!company || !currentUser || activePage === "admin-login") return;
    if (currentUser.role === "manager") return;
    if (["company_admin", "admin"].includes(currentUser.role)) return;
    const allowedByModule =
      !modules.length ||
      isNavigationPlaceholderPage(activePage) ||
      moduleAllowsPage(modules, activePage);
    const allowedByPermission = canAccessAdminPage(currentUser, activePage);
    if (!allowedByModule || !allowedByPermission) {
      const target = landingPage(currentUser, modules);
      if (target !== activePage) navigate(target, { replace: true });
    }
  }, [activePage, company?.id, currentUser, modules, modules.length]);

  React.useEffect(() => {
    localStorage.setItem("epChemicalLanguage", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  React.useEffect(() => {
    localStorage.setItem("epChemicalAdminDarkMode", String(isDarkMode));
  }, [isDarkMode]);

  React.useEffect(() => {
    if (!isAdminPortalRole(currentUser?.role) || isPlatformAdmin(currentUser.role) || !company)
      return;
    if (
      moduleAllowsPage(modules, "admin-products") &&
      canAccessAdminPage(currentUser, "admin-products")
    )
      void refreshProducts();
    if (
      moduleAllowsPage(modules, "admin-categories") &&
      canAccessAdminPage(currentUser, "admin-categories")
    )
      void refreshCategories();
    if (
      moduleAllowsPage(modules, "admin-brands") &&
      canAccessAdminPage(currentUser, "admin-brands")
    )
      void refreshBrands();
    if (canReadCatalogFormOptions(currentUser) && moduleAllowsPage(modules, "admin-products")) {
      void refreshCategories();
      void refreshBrands();
    }
    if (
      moduleAllowsPage(modules, "admin-orders") &&
      canAccessAdminPage(currentUser, "admin-orders")
    )
      void refreshOrders(currentUser);
    if (moduleAllowsPage(modules, "admin-staff") && canAccessAdminPage(currentUser, "admin-staff"))
      void refreshEmployees(currentUser);
    if (
      moduleAllowsPage(modules, "admin-reviews") &&
      canAccessAdminPage(currentUser, "admin-reviews")
    )
      void refreshAdminContent(currentUser);
    if (
      moduleAllowsPage(modules, "admin-website-media") &&
      canAccessAdminPage(currentUser, "admin-website-media")
    )
      void refreshWebsiteMedia(currentUser);
  }, [currentUser, company?.id]);

  async function refreshProducts() {
    try {
      const next = await fetchProducts();
      setProducts(next);
      return next;
    } catch (error) {
      setProducts([]);
      handleApiError(error);
      return [];
    }
  }

  async function refreshCategories() {
    try {
      const next = await fetchCategories();
      setCategories(next);
      return next;
    } catch (error) {
      setCategories([]);
      handleApiError(error);
      return [];
    }
  }

  async function refreshBrands() {
    try {
      const next = await fetchBrands();
      setBrands(next);
      return next;
    } catch (error) {
      setBrands([]);
      handleApiError(error);
      return [];
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
    if (!isCompanyAdmin(user?.role)) {
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
      setEmployees([]);
      setEmployeeSessions([]);
      handleApiError(error);
      return [];
    }
  }

  async function refreshAdminContent(user = currentUser) {
    if (!isCompanyAdmin(user?.role)) return;
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
      setReviews([]);
      setHomepageOffers([]);
      setHomepageCategoryCards([]);
      handleApiError(error);
    }
  }

  async function refreshWebsiteMedia(user = currentUser) {
    if (!hasPermission(user, "website_media.manage")) return;
    try {
      clearWebsiteMediaCache();
      const nextMedia = await fetchAllWebsiteMedia();
      setWebsiteMedia(nextMedia);
      setWebsiteMediaError("");
    } catch (error) {
      setWebsiteMedia([]);
      setWebsiteMediaError(error?.message || "Unable to load website media.");
      handleApiError(error);
    }
  }

  async function handleAdminLogin(credentials) {
    try {
      const session = await loginUser(credentials.email, credentials.password);
      if (!isValidCpanelUser(session.user)) {
        await logoutUser().catch(() => null);
        persistCurrentUser(null);
        setUser(null);
        setAdminLoginMessage("Access denied. An administrator account is required.");
        return;
      }
      setUser(session.user);
      setCompany(session.activeCompany || null);
      navigate(landingPage(session.user, session.activeCompany?.modules), {
        user: session.user,
        modules: session.activeCompany?.modules || [],
      });
    } catch (error) {
      setAdminLoginMessage(error.message || t("auth.loginFailed"));
    }
  }

  async function handleLogout() {
    await logoutUser().catch(() => persistCurrentUser(null));
    setUser(null);
    setCompany(null);
    clearTenantCaches();
    setProducts([]);
    setCategories([]);
    setBrands([]);
    setOrders([]);
    setEmployees([]);
    setEmployeeSessions([]);
    setReviews([]);
    setHomepageOffers([]);
    setHomepageCategoryCards([]);
    setWebsiteMedia([]);
    setWebsiteMediaError("");
    navigate("admin-login", { role: null });
  }

  async function handleSwitchCompany(companyId) {
    try {
      return await performSecureCompanySwitch(companyId, {
        enterScope: enterCompanyScope,
        onSession: (user, activeCompany) => {
          setUser(user);
          setCompany(activeCompany);
        },
        navigate,
      });
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleReturnToPlatform() {
    try {
      const user = await exitCompanyScope();
      setUser(user);
      setCompany(null);
      navigate("admin-platform-companies", { role: "super_admin", replace: true });
    } catch (error) {
      setAdminMessage(error.message || "Unable to return to the platform.");
    }
  }

  async function handleSaveCategory(category) {
    const isCatUpdate = Boolean(category.id);
    if (
      isCatUpdate &&
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "categories.update") &&
      !hasPermission(currentUser, "categories.manage") &&
      !hasPermission(currentUser, "products.update") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to update categories.");
      return;
    }
    if (
      !isCatUpdate &&
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "categories.create") &&
      !hasPermission(currentUser, "categories.manage") &&
      !hasPermission(currentUser, "products.create") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to create categories.");
      return;
    }
    try {
      const saved = isCatUpdate ? await updateCategory(category) : await createCategory(category);
      await refreshCategories();
      setAdminMessageType("success");
      setAdminMessage(isCatUpdate ? "Category changes saved." : "Category created.");
      return saved;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleDeleteCategory(id) {
    if (
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "categories.delete") &&
      !hasPermission(currentUser, "categories.manage") &&
      !hasPermission(currentUser, "products.delete") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to delete categories.");
      return;
    }
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    try {
      await deleteCategory(id);
      await refreshCategories();
      setAdminMessageType("success");
      setAdminMessage("Category deleted.");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleSaveBrand(brand) {
    const isBrandUpdate = Boolean(brand.id);
    if (
      isBrandUpdate &&
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "brands.update") &&
      !hasPermission(currentUser, "brands.manage") &&
      !hasPermission(currentUser, "products.update") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to update brands.");
      return;
    }
    if (
      !isBrandUpdate &&
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "brands.create") &&
      !hasPermission(currentUser, "brands.manage") &&
      !hasPermission(currentUser, "products.create") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to create brands.");
      return;
    }
    try {
      const saved = isBrandUpdate ? await updateBrand(brand) : await createBrand(brand);
      await refreshBrands();
      setAdminMessageType("success");
      setAdminMessage(isBrandUpdate ? "Brand changes saved." : "Brand created.");
      return saved;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleDeleteBrand(id) {
    if (
      !isCompanyAdmin(currentUser?.role) &&
      !hasPermission(currentUser, "brands.delete") &&
      !hasPermission(currentUser, "brands.manage") &&
      !hasPermission(currentUser, "products.delete") &&
      !hasPermission(currentUser, "products.manage")
    ) {
      setAdminMessageType("error");
      setAdminMessage("You do not have permission to delete brands.");
      return;
    }
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    try {
      await deleteBrand(id);
      await refreshBrands();
      setAdminMessageType("success");
      setAdminMessage("Brand deleted.");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleSaveCompanySettings(settings) {
    try {
      const updated = await updateCompanySettings(settings);
      setCompany(updated);
      setUser((current) => (current ? { ...current, activeCompany: updated } : current));
      return updated;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async function handleSaveProduct(product) {
    try {
      const saved = products.some((item) => item.id === product.id)
        ? await updateProductApi(product)
        : await createProductApi(product);
      await refreshProducts();
      setAdminMessageType("success");
      setAdminMessage(t("admin.productSaved"));
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
      setAdminMessageType("success");
      setAdminMessage(t("admin.productDeleted"));
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
      setAdminMessageType("success");
      setAdminMessage(item.id ? "Website media changes saved." : "Website media created.");
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
      setAdminMessageType("success");
      setAdminMessage("Website media deleted.");
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  const sharedLayoutProps = {
    company,
    currentUser,
    isDarkMode,
    language,
    modules,
    t,
    onLanguageChange: () => setLanguage((value) => (value === "en" ? "ar" : "en")),
    onLogout: handleLogout,
    onNavigate: navigate,
    onReturnToPlatform: handleReturnToPlatform,
    onSwitchCompany: handleSwitchCompany,
    onToggleDarkMode: () => setIsDarkMode((value) => !value),
  };

  return (
    <div className={activePage === "admin-login" ? "app-shell admin-login-shell" : "app-shell"}>
      <main className={activePage === "admin-login" ? "admin-login-main" : "admin-panel-main"}>
        {activePage === "admin-login" && (
          <AdminLoginPage
            company={company}
            message={adminLoginMessage}
            onLogin={handleAdminLogin}
            t={t}
          />
        )}

        {activePage === "admin-no-access" && (
          <AdminLayout
            activePage={activePage}
            company={company}
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            language={language}
            modules={modules}
            onLanguageChange={() => setLanguage((value) => (value === "en" ? "ar" : "en"))}
            onLogout={handleLogout}
            onNavigate={navigate}
            onReturnToPlatform={handleReturnToPlatform}
            onSwitchCompany={handleSwitchCompany}
            onToggleDarkMode={() => setIsDarkMode((value) => !value)}
            title="No Access"
            subtitle="You do not have permission to access any admin section."
          >
            <div className="admin-empty-state">
              <strong>No Access</strong>
              <span>
                Your account does not have permission to access any admin section. Contact your
                administrator to request the appropriate permissions.
              </span>
            </div>
          </AdminLayout>
        )}

        {adminPageKeys.includes(activePage) &&
          activePage !== "admin-no-access" &&
          activePage !== "admin-platform-overview" &&
          activePage !== "admin-platform-companies" &&
          activePage !== "admin-platform-domains" &&
          !dropshippingPageKeys.includes(activePage) &&
          !featurePageKeys.includes(activePage) &&
          !placeholderPageKeys.includes(activePage) &&
          !staffPageKeys.includes(activePage) && (
            <AdminDashboardPage
              activePage={activePage}
              brands={brands}
              categories={categories}
              company={company}
              employees={employees}
              homepageCategoryCards={homepageCategoryCards}
              homepageOffers={homepageOffers}
              onAssignEmployee={handleAssignEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onDeleteBrand={handleDeleteBrand}
              onDeleteCategory={handleDeleteCategory}
              onDeleteOffer={handleDeleteOffer}
              onDeleteOrder={handleDeleteOrder}
              onDeleteProduct={handleDeleteProduct}
              onDeleteReview={handleDeleteReview}
              onDeleteWebsiteMedia={handleDeleteWebsiteMedia}
              onModerateReview={handleModerateReview}
              onSaveCategoryCard={handleSaveCategoryCard}
              onSaveBrand={handleSaveBrand}
              onSaveCategory={handleSaveCategory}
              onSaveCompanySettings={handleSaveCompanySettings}
              onSaveEmployee={handleSaveEmployee}
              onSaveOffer={handleSaveOffer}
              onSaveProduct={handleSaveProduct}
              onSaveWebsiteMedia={handleSaveWebsiteMedia}
              onStatusChange={handleOrderStatusChange}
              orders={orders}
              products={products}
              reviews={reviews}
              statusMessage={adminMessage}
              statusMessageType={adminMessageType}
              t={t}
              websiteMedia={websiteMedia}
              websiteMediaError={websiteMediaError}
              {...sharedLayoutProps}
            />
          )}

        {activePage === "admin-platform-overview" && <AdminPlatformOverview {...sharedLayoutProps} />}
        {activePage === "admin-platform-companies" && <AdminCompaniesPage {...sharedLayoutProps} />}
        {activePage === "admin-platform-domains" && <AdminDomainsPage {...sharedLayoutProps} />}
        {dropshippingPageKeys.includes(activePage) && (
          <AdminDropshippingPage activePage={activePage} {...sharedLayoutProps} />
        )}
        {featurePageKeys.includes(activePage) && (
          <AdminFeaturePage activePage={activePage} {...sharedLayoutProps} />
        )}
        {placeholderPageKeys.includes(activePage) && (
          <AdminPlaceholderPage activePage={activePage} {...sharedLayoutProps} />
        )}

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
