import React from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import EmployeeForm from "../components/EmployeeForm.jsx";
import EmployeeTable from "../components/EmployeeTable.jsx";

function AdminEmployeesPage({
  activePage = "admin-staff",
  currentUser,
  employees,
  isDarkMode,
  language = "en",
  onLanguageChange,
  onDeleteEmployee,
  onLogout,
  onNavigate,
  onSaveEmployee,
  onToggleDarkMode,
  onToggleEmployeeStatus,
  sessions,
  statusMessage,
  t,
}) {
  const [editingEmployee, setEditingEmployee] = React.useState(null);
  const [localMessage, setLocalMessage] = React.useState(null);
  const [formKey, setFormKey] = React.useState(0);
  const isArabic = language === "ar";
  const title = activePage === "admin-staff-new"
    ? isArabic ? "موظف جديد" : "New Staff Member"
    : isArabic ? "الموظفون" : "Staff";
  const subtitle = activePage === "admin-staff-new"
    ? isArabic ? "إنشاء حساب موظف جديد" : "Create a staff account"
    : isArabic ? "إدارة حسابات الموظفين والأدوار والصلاحيات" : "Manage staff accounts, roles, and permissions";

  const layoutProps = {
    activePage,
    currentUser,
    isDarkMode,
    language,
    onLanguageChange,
    onLogout,
    onNavigate,
    onToggleDarkMode,
  };

  if (currentUser?.role !== "admin") {
    return (
      <AdminLayout {...layoutProps} subtitle={t("admin.adminOnly")} title={t("admin.accessDenied")}>
        <div className="admin-empty-state">
          <strong>{t("admin.accessDenied")}</strong>
          <span>{t("admin.adminOnly")}</span>
        </div>
      </AdminLayout>
    );
  }

  async function handleSave(employee) {
    const result = await onSaveEmployee(employee);

    if (result?.ok) {
      setEditingEmployee(null);
      setFormKey((currentKey) => currentKey + 1);
      setLocalMessage({ type: "success", text: result.message });
      onNavigate("admin-staff");
    } else if (result?.message) {
      setLocalMessage({ type: "error", text: result.message });
    }
  }

  function handleEdit(employee) {
    setEditingEmployee(employee);
    onNavigate("admin-staff-new");
  }

  return (
    <AdminLayout {...layoutProps} subtitle={subtitle} title={title}>
      {(localMessage || statusMessage) && (
        <div className={localMessage?.type === "error" ? "message-panel error" : "message-panel success"}>
          {localMessage?.text || statusMessage}
        </div>
      )}

      {activePage === "admin-staff-new" ? (
        <section className="admin-panel-card">
          <div className="admin-role-info">
            <strong>Admin</strong>
            <span>Full access: manage staff, settings, all content, and all operations.</span>
            <strong>Manager</strong>
            <span>Manage products, orders, customers, reviews, and content. Cannot manage staff or settings.</span>
            <strong>Employee</strong>
            <span>View-only access for admin sections and regular employee workspace access.</span>
          </div>
          <EmployeeForm
            editingEmployee={editingEmployee}
            key={formKey}
            onCancel={() => {
              setEditingEmployee(null);
              onNavigate("admin-staff");
            }}
            onSave={handleSave}
            t={t}
          />
        </section>
      ) : (
        <section className="admin-panel-card">
          <div className="admin-section-head">
            <div>
              <h2>{isArabic ? "الموظفون" : "Staff"}</h2>
              <p>{subtitle}</p>
            </div>
            <button className="admin-primary-button" onClick={() => onNavigate("admin-staff-new")} type="button">
              {isArabic ? "إضافة موظف" : "Add Staff"}
            </button>
          </div>
          <EmployeeTable
            employees={employees}
            onDelete={onDeleteEmployee}
            onEdit={handleEdit}
            onToggleStatus={onToggleEmployeeStatus}
            sessions={sessions}
            t={t}
          />
        </section>
      )}
    </AdminLayout>
  );
}

export default AdminEmployeesPage;
