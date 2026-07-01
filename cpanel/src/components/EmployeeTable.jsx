import React from "react";

function formatMinutes(minutes = 0) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function getTodayMinutes(employeeId, sessions) {
  const today = new Date().toISOString().slice(0, 10);
  return sessions
    .filter((session) => session.employeeId === employeeId && session.date === today)
    .reduce((total, session) => {
      if (session.totalMinutes != null) {
        return total + session.totalMinutes;
      }

      return total + Math.max(
        0,
        Math.round((Date.now() - new Date(session.loginTime).getTime()) / 60000)
      );
    }, 0);
}

function EmployeeTable({
  employees,
  onDelete,
  onEdit,
  onToggleStatus,
  sessions,
  t,
}) {
  if (employees.length === 0) {
    return <div className="empty-panel compact-empty">{t("admin.noEmployees")}</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.employee")}</th>
            <th>{t("admin.position")}</th>
            <th>{t("admin.employeeStatus")}</th>
            <th>{t("admin.todayWorkTime")}</th>
            <th>{t("admin.permissions")}</th>
            <th>{t("admin.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <strong>{employee.name}</strong>
                <span className="table-muted">{employee.email}</span>
                {employee.phone && <span className="table-muted">{employee.phone}</span>}
              </td>
              <td>
                {employee.position || "-"}
                {employee.department && (
                  <span className="table-muted">{employee.department}</span>
                )}
              </td>
              <td>{employee.isActive ? t("admin.active") : t("admin.inactive")}</td>
              <td>{formatMinutes(getTodayMinutes(employee.id, sessions))}</td>
              <td>{employee.permissions?.length || 0}</td>
              <td>
                <div className="row-actions">
                  <button className="text-action" onClick={() => onEdit(employee)}>
                    {t("admin.editEmployee")}
                  </button>
                  <button
                    className="text-action"
                    onClick={() => onToggleStatus(employee)}
                  >
                    {employee.isActive ? t("admin.deactivate") : t("admin.activate")}
                  </button>
                  <button
                    className="text-action danger"
                    onClick={() => onDelete(employee.id)}
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EmployeeTable;
