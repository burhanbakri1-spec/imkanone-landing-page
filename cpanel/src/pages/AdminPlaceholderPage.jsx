import React from "react";
import { Construction } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { getNavigationItem } from "../data/adminNavigation.js";

export default function AdminPlaceholderPage({ activePage, language = "en", t, ...layout }) {
  const item = getNavigationItem(activePage);
  const ar = language === "ar";
  const title = item?.label?.[language] || item?.label?.en || (ar ? "قريباً" : "Coming soon");

  return <AdminLayout
    activePage={activePage}
    language={language}
    title={title}
    subtitle={t("adminShell.preparingFeature")}
    t={t}
    {...layout}
  >
    <section className="admin-under-development" role="status">
      <span className="admin-under-development-icon"><Construction size={30} /></span>
      <div>
        <h2>{t("adminShell.underDevelopment")}</h2>
        <p>{t("adminShell.futureUpdate")}</p>
      </div>
    </section>
  </AdminLayout>;
}
