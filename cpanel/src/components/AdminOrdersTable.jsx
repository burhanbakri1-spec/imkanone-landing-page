import React from "react";
import StatusBadge from "./StatusBadge.jsx";

const statuses = ["Pending", "Processing", "Completed", "Cancelled"];

function AdminOrdersTable({
  canAssign = true,
  canDelete = false,
  canUpdateStatus = true,
  employees = [],
  language,
  onAssignEmployee,
  onDeleteOrder,
  onStatusChange,
  orders,
  products,
  t,
}) {
  if (orders.length === 0) {
    return <div className="empty-panel compact-empty">{t("admin.noOrders")}</div>;
  }

  function getItemSummary(order) {
    return order.items
      .map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return `${product?.name[language] || item.slug} ${item.size} x${item.quantity}`;
      })
      .join(", ");
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.orderId")}</th>
            <th>{t("checkout.name")}</th>
            <th>{t("checkout.phone")}</th>
            <th>{t("checkout.city")}</th>
            <th>{t("common.total")}</th>
            <th>{language === "ar" ? "نقاط EB" : "EB Points"}</th>
            <th>{t("admin.orderStatus")}</th>
            <th>{t("admin.createdBy")}</th>
            {canAssign && <th>{t("admin.assignedEmployee")}</th>}
            <th>{t("admin.lastUpdatedBy")}</th>
            <th>{t("admin.date")}</th>
            <th>{t("admin.items")}</th>
            {canDelete && <th>{t("admin.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer.name}</td>
              <td>{order.customer.phone}</td>
              <td>{order.customer.city}</td>
              <td>{order.total} {t("common.ils")}</td>
              <td>{Math.max(0, Number(order.pointsEarned || 0))}</td>
              <td>
                <StatusBadge status={order.status} t={t} />
                {canUpdateStatus && (
                  <select
                    className="status-inline-select"
                    onChange={(event) => onStatusChange(order.id, event.target.value)}
                    value={order.status}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {t(`status.${status}`)}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                {order.createdByEmployeeName || order.createdBy?.name || order.createdBy?.role || "-"}
                {order.createdBy?.role && (
                  <span className="table-muted">{order.createdBy.role}</span>
                )}
              </td>
              {canAssign && (
                <td>
                  <select
                    className="status-inline-select"
                    onChange={(event) => onAssignEmployee(order.id, event.target.value)}
                    value={order.handledByEmployeeId || ""}
                  >
                    <option value="">{t("admin.unassigned")}</option>
                    {employees
                      .filter((employee) => employee.isActive)
                      .map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                  </select>
                </td>
              )}
              <td>{order.lastUpdatedBy?.name || "-"}</td>
              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              <td>{getItemSummary(order)}</td>
              {canDelete && (
                <td>
                  <button
                    className="text-action danger"
                    onClick={() => onDeleteOrder(order.id)}
                  >
                    {t("admin.delete")}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminOrdersTable;
