# AGENTS.md

Bookings content module (React + Vite). Nest/Prisma/Postgres come later as `server/`.

## Run

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173/bookings/availability` (default redirects from `/`).

## Layout

- `client/` — Vite React TypeScript app
- Content-only Bookings router: `src/bookings/BookingsRoutes.tsx` (no global Wix sidebar/navbar)
- Booking Calendar scope inventory: `client/docs/booking-calendar-navigation-inventory.md`
- Broader Bookings inventory (includes Catalog): `client/docs/bookings-navigation-inventory.md`
- Calendar experience: `src/bookings/calendar-experience/`
- Mountable Work Schedule: `import { WorkSchedulePage } from './components/work-schedule'`
- Data: `src/api/scheduleApi.ts`, `src/api/bookingsApi.ts` → localStorage; set `VITE_API_URL` when Nest is ready

## Notes

- **Booking Calendar IN_SCOPE:** Calendar, Booking List, Work Schedule, Analytics (+ their in-product modals/drawers). Scope = UI product context, not every `/bookings/` URL.
- Existing Catalog/settings pages are kept but outside current Calendar task expansion
- No Nest/Prisma in this phase
