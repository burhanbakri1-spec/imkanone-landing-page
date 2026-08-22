import { BrowserRouter } from "react-router-dom";
import { BookingsRoutes } from "./bookings/BookingsRoutes";

/**
 * Standalone demo shell with content-only Bookings routing.
 * Host apps can import WorkSchedulePage or individual page modules directly.
 */
export default function App() {
  return (
    <BrowserRouter>
      <BookingsRoutes />
    </BrowserRouter>
  );
}
