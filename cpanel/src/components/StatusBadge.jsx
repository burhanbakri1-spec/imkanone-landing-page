import React from "react";

function StatusBadge({ status, t }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {t(`status.${status}`)}
    </span>
  );
}

export default StatusBadge;
