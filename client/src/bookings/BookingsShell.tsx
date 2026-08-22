import { Outlet } from "react-router-dom";
import "./bookings.css";

/**
 * Content-only Bookings shell — no global Wix sidebar/navbar.
 * Host apps provide chrome; this module only renders content routes.
 */
export function BookingsShell() {
  return (
    <div className="bk-shell" data-bookings-shell>
      <Outlet />
    </div>
  );
}
