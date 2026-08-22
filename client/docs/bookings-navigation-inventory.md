Inspection complete. Here is the navigation inventory.

## Bookings Navigation Graph — Inspection Report

**URL:** `https://manage.wix.com/dashboard/6071ac65-7a5e-4727-bcf9-75829bfe4dc2/bookings/availability?referralInfo=sidebar` (start) → explored full `/bookings/` section
**Viewport:** 1440×900 (CSS pixels) · Platform win32 · Font stack: Wix `Madefor` (`Madefor, "Helvetica Neue", Helvetica, Arial, …`)

---

## Nodes

| id | title | url | parent | howReached | h1 |
|---|---|---|---|---|---|
| work-schedule | Work Schedule | `/bookings/availability` | sidebar (Booking Calendar) | sidebar "Work Schedule" | Work Schedule |
| calendar | Calendar | `/wix-calendar` | sidebar (Booking Calendar) | sidebar "Calendar" | (none — month grid) |
| booking-list | Booking List | `/bookings/bookings/bookings-list` | sidebar (Booking Calendar) | sidebar "Booking List" | Booking List |
| analytics | Bookings Analytics | `/bookings/overviews/bookings` | sidebar (Booking Calendar) | sidebar "Bookings Analytics" | Bookings Analytics |
| services | Booking Services | `/bookings/services` | sidebar (Catalog) | sidebar "Booking Services" | Booking Services 5 |
| service-templates | Add a New Service | `/bookings/services/templates-catalog` | services | services "Add a New Service" / calendar "Add > Create New Service" | Add a New Service |
| service-form | Service Form (new) | `/bookings/services/form?type=APPOINTMENT` | service-templates | "Start from Scratch" | Service 6 (+Appointment badge) |
| service-form-edit | Service Form (edit) | `/bookings/services/form/{serviceId}` | services | row "Edit" | Service 6 |
| integrations | Booking Integrations | `/bookings/integrations` | sidebar (Catalog › Booking Channels) / settings tile | sidebar link or settings tile | Booking Integrations |
| shareable-links | Shareable Links | `/bookings/dashboard` | sidebar (Catalog › Booking Channels) | sidebar "Shareable Links" | Shareable Links |
| staff | Staff | `/bookings/staff` | work-schedule / services | work-sched "More Actions > Manage staff"; services "More Actions > Manage staff" | Staff 3 |
| staff-edit | Staff Member Form | `/bookings/staff/edit` (new) or `/bookings/staff/edit/{staffId}` (edit) | staff | "Add Staff" / row "Edit" | Add Staff Member |
| settings | Booking Settings hub | `/bookings/settings` | staff / services | breadcrumb "Booking Settings" / services menu "Update booking settings" | Booking Settings |
| default-hours | Default Hours | `/bookings/availability/default-hours` | settings | settings tile "Default hours" | Default Hours |
| addons | Add-ons | `/bookings/addons/addons` | settings | settings tile "Add-ons" | Add-ons 0 |
| resources | Resources & Rooms | `/wix-calendar/resource-management/index` | settings / services | settings tile "Resources & rooms"; services menu "Manage resources" | Resources |
| reminders-you-send | Notifications you send | `/bookings/settings/reminders/you-send/whatsapp` | settings | settings tile "Notifications you send" | Notifications you send |
| reminders-you-get | Notifications you get | `/bookings/settings/reminders/you-get` | settings | settings tile "Notifications you get" | Notifications you get |
| bookflow | Client Booking Flow | `/bookings/settings/bookflow-settings` | settings / services | settings tile / services menu "Customize booking experience" | Client booking flow |
| forms-manager | Booking Form | `/bookings/settings/forms-manager` | settings | settings tile "Booking form" | Booking Form 1 |
| policies | Booking Policies | `/bookings/settings/policies` | settings | settings tile "Booking policies" | Booking Policies 1 |

**Root test:** bare `/bookings/` **redirects to `/bookings/services`** (Booking Services list).

---

## Edges

| fromId | controlLabel | resultType | toIdOrNote |
|---|---|---|---|
| work-schedule | Add Staff Hours | modal | "Add working hours" form (Staff members, Start date, Set end date, Repeats, Days, Time, Location, Cancel/Save) |
| work-schedule | More Actions | menu | Edit default hours · Manage staff · Invite booking collaborators |
| work-schedule | More Actions → Edit default hours | modal | "Default Hours" (per-day time editor) |
| work-schedule | More Actions → Manage staff | page | → staff |
| work-schedule | More Actions → Invite booking collaborators | modal | invite modal + link "Roles & Permissions" → global `/collaboration/collaborators` (out of scope) |
| work-schedule | Get help with availability | — | no visible dialog/popover (inert / help tooltip only) |
| work-schedule | Today / prev / next / date textbox | in-page | calendar week paging / date picker |
| work-schedule | All locations / All staff members | dropdown (in-page) | filter selectors |
| staff | Add Staff | page | → staff-edit (new) |
| staff | row Edit | page | → staff-edit (`/bookings/staff/edit/{id}`) |
| staff | Manage | menu | View work schedule · Edit default hours · Invite booking collaborators · Manage default video account · Staff personal data |
| staff | Manage → View work schedule | page | → work-schedule |
| staff | breadcrumb "Booking Settings" | page | → settings |
| staff-edit | View Working hours | modal (validation) | "We're Missing Some Information" (unsaved form) |
| staff-edit | Give Permissions / Sync Calendar / Add Individual Account / Add Staff Assignment | modal (each) | permission/calendar/account/assignment pickers |
| settings | tile "Default hours" | page | → default-hours |
| settings | tile "Add-ons" | page | → addons |
| settings | tile "Staff" | page | → staff |
| settings | tile "Resources & rooms" | page | → resources |
| settings | tile "Notifications you send" | page | → reminders-you-send |
| settings | tile "Notifications you get" | page | → reminders-you-get |
| settings | tile "Tips" | modal | Wix Tips (New) app-install modal (See full description / Cancel / Add to Site) |
| settings | tile "Client booking flow" | page | → bookflow |
| settings | tile "Booking form" | page | → forms-manager |
| settings | tile "Booking policies" | page | → policies |
| settings | tile "Video conferencing account" | modal | account picker (Google Meet / Zoom, Cancel/Continue) |
| settings | tile "Booking integrations" | page | → integrations |
| services | Add a New Service | page | → service-templates |
| services | row Edit | page | → service-form-edit |
| services | row Add Sessions | page | → service-form-edit (session scheduling) |
| services | Manage Categories | modal | category editor (Edit Name / Add New Category) |
| services | Share Services | modal | "Customize your shareable link" (Staff member/Our services, Cancel/Continue) |
| services | More Actions | menu | Manage Categories · Customize booking experience · Update booking settings · Accept payments · Manage staff · Manage resources · Create discount · Create coupon · Manage Booking Integrations · Give feedback |
| services | More Actions → Customize booking experience | page | → bookflow |
| service-templates | Start from Scratch | page | → service-form (`?type=APPOINTMENT`) |
| service-templates | template Edit | page | → service-form (per template) |
| service-templates | Back | page | → services |
| service-templates | tabs Appointment/Class/Course | in-page | type switcher (URL `type` param) |
| service-form | 8 section tabs | in-page | Service details · Pricing & payment · Add-ons · Staff & availability · Resources & rooms · Locations · Images · Booking preferences (URL state) |
| integrations | 7 tabs | in-page | Booking channels · Communications · Business management · Payroll & invoice · Marketing · Website widgets · Mobile apps (no URL change) |
| shareable-links | Create Link (service list / calendar / page) | modal | "Customize the link for your …" (Cancel/Continue) |
| shareable-links | Connect Payment Method | page (global) | payment setup (out of scope) |
| calendar | Add | menu | Quick Sale · Appointment · Blocked staff time · Class session · Create New Service |
| calendar | Add → Create New Service | page | → service-templates |
| calendar | Sync Calendars / Learn More | link | calendar-sync modal / help |
| calendar | Activity toggles (5) | in-page | Upcoming session · Appointment waitlist · Booking requests · Class waitlists · Recent activity |
| booking-list | tabs Appointments & Classes / Courses | URL state | `tab` query param `booking-list` ↔ `course-list` |
| booking-list | Manage View | menu | Save changes · Save as new view · Rename · Set as default view · Delete |
| booking-list | Filter | dropdown (expected) | no visible panel rendered on click (see CoverageNotes) |
| booking-list | Last 7 days / export / columns | dropdown/in-page | period picker / export / column picker |
| analytics | Classes / Appointments | in-page | segmented control (no URL change) |
| analytics | View Report (×3) | in-page | report expands inline; no navigation |

---

## Modals / Drawers / Menus

| hostPageId | control | type | title/summary |
|---|---|---|---|
| work-schedule | Add Staff Hours | Modal | Add working hours — staff/date/repeats/days/time/location form |
| work-schedule | More Actions | Menu | 3 actions (Edit default hours, Manage staff, Invite collaborators) |
| work-schedule | More Actions → Edit default hours | Modal | Default Hours — per-day availability editor |
| work-schedule | More Actions → Invite collaborators | Modal | Invite booking collaborators — 0/5 seats, role+email, Send Invite |
| staff | Manage | Menu | 5 actions (View work schedule, Edit default hours, Invite collaborators, Manage default video account, Staff personal data) |
| staff-edit | View Working hours | Modal (validation) | We're Missing Some Information → Complete Missing Info |
| services | Manage Categories | Modal | Manage Categories — Edit Name / Add New Category |
| services | Share Services | Modal | Customize your shareable link — Staff member / Our services |
| services | More Actions | Menu | 10 actions (Manage Categories, Customize booking experience, Update booking settings, Accept payments, Manage staff, Manage resources, Create discount, Create coupon, Manage Booking Integrations, Give feedback) |
| settings | Tips | Modal | Wix Tips (New) — app install prompt |
| settings | Video conferencing account | Modal | Add a video conferencing account — Google Meet / Zoom |
| shareable-links | Create Link | Modal | Customize the link for your service list/calendar/page |
| calendar | Add | Menu | Quick Sale, Appointment, Blocked staff time, Class session, Create New Service |
| booking-list | Manage View | Menu | Save changes / Save as new view / Rename / Set as default view / Delete |

---

## Key Measurements (Work Schedule header, WDS design system `wds_1_307_0`)

- H1 `page-header-title`: x=303, y=78, 720×36px, font-size 28px, color #000624
- "Add Staff Hours" (primary, `add-working-hours-button`): x=1205, y=78, 187×36px, font 16px, white on #116DFF
- "More Actions" (`more-actions-button`): x=1027, y=78, 166×36px, font 16px, #116DFF on white
- Sidebar nav region: 255px wide, begins y=194. Header chrome spans full 1440px width above.

## CoverageNotes

- **Explored:** All 7 sidebar Bookings destinations (Calendar, Booking List, Work Schedule, Analytics, Services, Integrations, Shareable Links), the bare `/bookings/` root, and the Settings hub with all 12 tiles + all discovered nested pages (default-hours, addons, resources, reminders×2, bookflow, forms-manager, policies, staff/staff-edit, service-templates, service-form). 13 screenshots saved (`01`–`13*.png`) in the working dir.
- **What could not be opened / limits:** Booking List "Filter" button produced no visible panel on click (repeatedly); recorded as dropdown-type but unconfirmed. "Get help with availability" is inert (no dialog). Several create/connect controls (payment method, tips install, video account) were opened and cancelled without saving, per policy. Service-form save and staff save were not submitted (avoided destructive changes). Analytics "View Report" expands inline; deeper report URLs not discovered (no visible link target).
- **Out-of-scope global chrome ignored:** Top header (Help, Upgrade, Search, account, AI), sidebar groups outside Bookings (Sales, Video Library, Apps, Marketing, Customers, Settings, Developer Tools, etc.), the global "Roles & Permissions" (`/collaboration/collaborators`), and Quick Actions popover (empty). Resource Management lives at `/wix-calendar/...` but is reached from Bookings settings and treated as part of the Bookings graph.
- **Blocks:** None blocking; all target pages loaded (occasional 2–8 console warnings; ~6 errors on service/staff pages — non-fatal).
---

## Evidence
- OpenCode session title: `Bookings-nav-discovery`
- Events: `C:\Users\eng -code\opencode-bridge\output\last-events.jsonl` (705 events)
- Result JSON: `C:\Users\eng -code\opencode-bridge\output\last-output.json`
- CDP link dump: `C:\Users\eng -code\opencode-bridge\output\cdp-bookings-links-out.txt`
- Smoke gate: `Bookings-smoke` (ok:true)

## Inventory verification checklist
- [x] All sidebar Bookings destinations visited
- [x] Bare /bookings/ redirect recorded (-> services)
- [x] Settings hub tiles + nested pages recorded
- [x] Service create/edit paths recorded
- [x] Staff list/edit paths recorded
- [x] Modals/menus catalogued
- [x] Filter on Booking List noted as unconfirmed (re-tried; no panel) — do not invent UI
- [x] Out-of-scope global chrome excluded

## Implementation order (Phase 2+)
1. content router + Bookings content secondary nav (content-only)
2. work-schedule (existing)
3. staff, staff-edit, settings, default-hours
4. services, service-templates, service-form
5. booking-list, calendar, analytics
6. integrations, shareable-links
7. addons, resources, reminders-*, bookflow, forms-manager, policies

## Phase 3 measure evidence
- OpenCode session: `Bookings-page-measure`
- Report: `client/docs/bookings-page-measurements.md`
- Events: `C:\Users\eng -code\opencode-bridge\output\last-events.jsonl`
- Completed: 2026-08-20 (17 URLs measured)

## Phase 4 completeness gate
- [x] Every inventory node has a local route in `BookingsRoutes.tsx`
- [x] No routes invented outside inventory
- [x] `/bookings` redirects to services; `/` redirects to availability
- [x] Existing `WorkSchedulePage` mounted at `/bookings/availability` (export preserved)
- [x] No global sidebar/navbar added (content-only shell)
- [x] No placeholder/TODO page stubs under `src/bookings`
- [x] OpenCode measure evidence for implemented pages: `bookings-page-measurements.md`
- [x] `npm run build` (tsc + vite) succeeds
