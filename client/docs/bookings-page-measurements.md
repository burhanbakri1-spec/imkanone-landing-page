All 17 URLs inspected and screenshots saved to the working directory. Final report:

# Wix Bookings UI Measurements Report

**Account:** burhan bakri (BB) · **Site:** Imkan · **Site ID:** `6071ac65-7a5e-4727-bcf9-75829bfe4dc2` · **Viewport:** 1440x900 (all pages)

**Shared design tokens (consistent across all pages):**
- h1: 28px / 700 / rgb(0,6,36) / font `Madefor, "Helvetica Neue", Helvetica, Arial, …` at (303,108) w≈880-1090 h36
- Subtitle: 16px / 400; text color rgb(0,6,36) with "Learn more" link in rgb(17,109,255); wrapper div reports inherited rgb(0,0,0)/Times New Roman
- Primary button: bg rgb(17,109,255), white text, 16px / 530, radius 18px, padding 6px 24px, h36
- Secondary button: white bg, text rgb(17,109,255), same radius/padding
- Body bg: rgb(255,255,255); content column x303–1392 (main content area)
- Aria AI assistant overlay present on every page (floating right panel) — did not block main measurements

---

## URL 1 — `/bookings/services` (Booking Services) · Screenshot: `01-services.png`
- **h1:** "Booking Services 5" (count badge "5") · **Subtitle:** "Create and edit courses, classes or appointments."
- **Header buttons:** "Share Services" (secondary), "Add a New Service" (primary)
- **Toolbar:** "Manage Categories" (link) · "Filter" (button) · search "Search..." input
- **Table columns:** checkbox / Service / Price / Schedule / actions; 5 rows (contracting, 1, 2, Copy of contracting, Copy of Copy of contracting) — all "Free", "No upcoming sessions"
- **Status line:** "5 results found" · bottom: "Add New Service" primary button
- **Blockers:** none

## URL 2 — `/bookings/staff` (Staff) · Screenshot: `02-staff.png`
- **h1:** "Staff 3" · **Subtitle:** "Manage your staff and set their work hours here."
- **Header buttons:** "Manage" (secondary), "Add Staff" (primary)
- **Table columns:** Name / Permission / Email / Phone / actions; rows: ruba, shren, burhan ("No permissions/No email/No phone")
- **Embedded:** deprecated "Time Blocker" iframe app · status "3 results found"
- **Blockers:** none

## URL 3 — `/bookings/settings` (Booking Settings) · Screenshot: `03-booking-settings.png`
- **h1:** "Booking Settings" · **Subtitle:** "Set up your business to take bookings exactly how and when you'd like."
- **h4 groups (rows = title + desc + chevron):** "Bookings Setup" (Default hours, Add-ons, Staff, Resources & rooms, Notifications you send, Notifications you get, Tips) · "Online Bookings" (Client booking flow, Booking form, Booking policies) · "Integrations" (Video conferencing account, Booking integrations)
- **Blockers:** none

## URL 4 — `/bookings/bookings/bookings-list` (Booking List) · Screenshot: `04-booking-list.png`
- **Breadcrumb tabs:** "Calendar" / "Booking List"
- **h1:** "Booking List"
- **Summary cards:** "Total bookings TRY 0.00", "Unpaid bookings TRY 0.00", "Paid bookings TRY 0.00" · period "Last 7 days"
- **Tabs:** "Appointments & Classes" (selected) / "Courses"; view "Default view (0)" + "Manage View"; "Filter" button; active chips "Booking status: Confirmed", "Session date & time: 07/20/2026 - 08/20/2026", "Clear all"
- **Empty state:** h3 "No results found" (21px/700) + "Try changing your filters." + "Clear Filters"
- **URL query exposed columns:** visible = startDate, service-details, client-name, addons, createdDate, attendance, payment-status, charge; hidden = phone, staff-name, creator-details, event-note, resources, location, status, order-number, payment-details
- **Blockers:** none

## URL 5 — `/bookings/overviews/bookings` (Bookings Analytics) · Screenshot: `05-bookings-analytics.png`
- **h1:** "Bookings Analytics" · **Subtitle:** "Analyze bookings performance and gain insights on clients and staff. Learn more"
- **Controls:** date input "Last 30 days (Jul 22 - Today)"; radios Classes (checked) / Appointments; AI panel with "Ask AI" + input "Ask a question about your stats"
- **Cards:** Spots filled 0, Predicted occupancy 0, Top class sessions (empty), Bookings 0 / Booking sales ₺0.00, Top clients (0 first-time / 0 returning), Staff performance (empty)
- **Blockers:** none

## URL 6 — `/bookings/integrations` (Booking Integrations) · Screenshot: `06-bookings-integrations.png`
- **h1:** "Booking Integrations" · **Subtitle:** "Explore ways to increase your bookings, engage with clients, manage your business and more."
- **Tabs:** Booking channels (selected) / Communications / Business management / Payroll & invoice / Marketing / Website widgets / Mobile apps
- **Cards:** Facebook, Instagram, Google, Hopp — each "Connect" button + "Learn more"
- **Blockers:** none

## URL 7 — `/bookings/dashboard` (Shareable Links) · Screenshot: `07-shareable-links.png`
- **h1:** "Shareable Links" · **Subtitle:** "Create custom links for your clients to book services and buy plans. Learn more"
- **Payment banner:** "Connect a payment method to start selling your services" + "Connect Payment Method"
- **h4 cards:** Service list, Service calendar, Service page (each "Create Link"); "Memberships and packages" ("Add a membership or package plan")
- **Blockers:** none

## URL 8 — `/wix-calendar` (Calendar) · Screenshot: `08-wix-calendar.png`
- **Left rail:** "Calendar" header; month-nav dialog (August 2026); carousel "Sync your personal calendar" / "Avoid double bookings"; Activity panel "Upcoming session" empty ("No sessions added...")
- **Toolbar:** "Today" · "August 2026" + prev/next · view combobox (role=combobox, label empty, innerText empty — value "Weekly" not extractable) · "Manage" · "Add" (primary)
- **Grid:** weekly Aug 16-22, 12 AM–11 PM slots; **right panel "Filter by":** Catalog items (Select all + 5 services checked), Staff, Location, Session availability, Other events; footer "0 events viewed" at y≈864
- **Blockers:** combobox value not readable via innerText (a11y bug)

## URL 9 — `/bookings/availability/default-hours` (Default Hours) · Screenshot: `09-default-hours.png`
- **Breadcrumb:** Settings > Booking Settings > Default Hours
- **h1:** "Default Hours" · **Subtitle:** "Set the default hours you and your staff are available for bookings."
- **Header buttons:** Cancel (secondary) / Save (primary)
- **h3 "Set default hours"** + "Get help with availability"; day rows: Sunday 9:00 AM–12:00 AM, Mon–Fri 10:00 AM–12:00 AM, Saturday 9:00 AM–12:00 AM with "Ends on the next day"
- **h3 "More scheduling tools":** Work Schedule -> "Go to Work Schedule", Staff working hours -> "Go to Staff"
- **Blockers:** none

## URL 10 — `/bookings/addons/addons` (Add-ons) · Screenshot: `10-addons.png`
- **h1:** "Add-ons 0" · **Subtitle:** "Create and manage the add-ons you offer for your services. Learn more"
- **Header:** "Create Add-on" (primary)
- **Empty state:** h3 "Start offering add-ons with your services" + "Let your clients customize their booking with add-ons…" + buttons "Go to Services" / "Create New Add-On"
- **Live region bug:** status = `cairo.a11y.liveRegion.resultsFound` (untranslated i18n key)
- **Blockers:** none

## URL 11 — `/wix-calendar/resource-management/index` (Resources) · Screenshot: `11-resources.png`
- **h1:** "Resources" · **Subtitle:** "Organize your items and spaces into categories and link them to offerings in your catalog. Learn more"
- **Header:** "Create Resource Category" (primary); search "Search..."
- **Empty state:** h3 "Add your first item" (21px/700 rgb(0,6,36)) + "Once you have items, they'll appear here." (14px/400 rgb(134,138,165)); status "No results found"; bottom "Create Resource Category"
- **Blockers:** none

## URL 12 — `/bookings/settings/reminders/you-send/whatsapp` (Notifications you send) · Screenshot: `12-whatsapp-notifications.png`
- **Breadcrumb:** Settings > Booking Settings > Notifications you send
- **h1:** "Notifications you send" · **Subtitle:** "Manage notifications that are automatically sent to clients." Learn more
- **Header:** "More Actions" (secondary)
- **SMS banner:** h3 "Keep your clients updated with SMS notifications" + "To start sending SMS notifications, upgrade your site with a plan." + "Upgrade" button (disabled style)
- **Tabs:** WhatsApp (selected, y390 h60.4) / SMS / Emails (Free badge)
- **Section:** h3 "WhatsApp Notifications" + "Choose which booking updates you send via WhatsApp."
- **Rows (checkbox "Inactive", title, category chip, "Send a WhatsApp message", overflow + Edit):** ① when they book (Session booked, +1 action) ② booking canceled (Booking canceled) ③ change to appointment or class (Appointment or class updated) ④ change to a course (Course updated) ⑤ pending confirmation (Appointment requested) ⑥ approved (Appointment request approved) ⑦ declined (Appointment request declined) ⑧ a day before session (Session starts)
- **Footer:** "By using WhatsApp you will be subject to [WhatsApp terms and conditions] and acknowledge their [privacy policy]."
- **Right column:** h2 "Recommended automations for your business" + "Request payment when a session is booked" / "Thank clients that attend a session" / "Get feedback after a session" (each "Set Up Automation") + "Explore More Automations"
- **Blockers:** none

## URL 13 — `/bookings/settings/reminders/you-get` (Notifications you get) · Screenshot: `13-you-get-notifications.png`
- **Breadcrumb:** Settings > Booking Settings > Notifications you get
- **h1:** "Notifications you get" · **Subtitle:** "Manage notifications you get about your bookings."
- **Header:** "Go to Automations" (secondary, 190x36)
- **SMS banner:** identical to URL 12 ("Upgrade")
- **Tabs:** Emails (Free badge, selected) / SMS
- **Section:** h3 "Email Notifications"
- **Rows (checkbox "Active" checked, title, category chip, "Send an email", overflow + Edit):** ① Notify me when someone books one of my services (Session booked) ② cancels their request to book (Booking canceled) ③ cancels their booking (Booking canceled) ④ reschedules their booking (Appointment or class updated) ⑤ I need to review a booking request (Appointment requested)
- **Blockers:** none

## URL 14 — `/bookings/settings/bookflow-settings` (Client booking flow) · Screenshot: `14-client-booking-flow.png`
- **Breadcrumb:** Settings > Booking Settings > Client booking flow
- **h1:** "Client booking flow" · **Subtitle:** "Customize the default booking experience clients have on your live site."
- **Header:** Cancel (secondary) / Save (primary, bg rgb(17,109,255))
- **Filter bar:** "Filter settings by:" + "All service types" (active, blue) / "Classes & Courses"
- **Collapsible sections (h3 18px/700, each with mockup graphic):**
  1. **Service selection** (Appointment): "How many services can be added to a single appointment?" — radios "One service per appointment" (checked, desc "Clients can book one service per visit to keep scheduling simple.") / "Multiple services per appointment (up to 5)"
  2. **Staff selection** (Appointment): "How are staff members chosen for services?" — "Clients choose a staff member" (checked) + checkbox "Set default to Any staff member" / "Assign staff automatically"; note "Staff will be assigned based on your [booking policy]." Then "When do clients choose a staff member?" — "On a separate step before viewing the calendar" / "On the calendar page" (checked); hint "This step appears only if the service is assigned to multiple staff members."
  3. **Location selection** (Appointment): "When do clients choose a location?" — same two options; "On the calendar page" (checked); hint "…offered at multiple locations."
  4. **Available time slots** (Appointment): "Choose how appointment start times are set." — "Based on service duration" / "Every" (checked) + combobox "30 minutes"; then "Appointment Waitlist" — "Add a waitlist to your live site so clients can join when they can't find a time that works." + "Activate"
  5. **Time zone** (Appointment/Class/Course): "What time zone do clients see when scheduling a session?" — "Your business time zone" / "Client's local time zone" (checked); checkbox "Let clients choose between your time zone and theirs"
  6. **Booking Form** (Appointment/Class/Course): "Customize and manage the form that clients fill out when booking online." + "Manage Forms"
  7. **Checkout settings** (Appointment/Class/Course): "All Checkout Settings"; sub-rows: Cart — "Allow clients to pay for multiple services and products at once." (Learn more + checkbox); Tips — "Let clients add a tip when they book." (Activate); Discounts — "Offer discounts that apply automatically without a coupon code." (Learn more + Manage); "Set up a payment method to accept online payments at checkout." (Connect Payment method)
- **Bottom:** h2 "Booking Widgets" + "Give your clients more ways to book to on your site with Booking Widgets." + "Explore more"; widgets: **Daily Agenda** (Classes Only) — "Display your upcoming classes by date and time"; **Weekly Timetable** (Classes Only) — "Clients see all classes that you have for the week in one place"; **Next Availability** — "Show up to 3 upcoming slots clients can book"; each "Add to Site"
- **Blockers:** none

## URL 15 — `/bookings/settings/forms-manager` (Booking Form) · Screenshot: `15-booking-form.png`
- **Breadcrumb:** Settings > Booking Settings > Booking Form
- **h1:** "Booking Form 1" (badge "1") · **Subtitle:** "Customize and manage the form that clients fill out when booking online. You can create new forms tailored to specific service needs." Learn more
- **Header:** "Create New Form" (primary, 196.9x36)
- **Search:** "Search..." input (208x28 at x1152.8)
- **Table columns:** "Form" (w350), "Connected services" (w655), actions (w84); th 14px/400 rgb(0,6,36)
- **Row:** "Default booking form" + badge "DEFAULT"; connected chips: Copy of Copy of contracting, Copy of contracting, contracting, 1, 2; overflow button
- **Status:** `cairo.a11y.liveRegion.resultsFound` (untranslated); bottom "Create New Form"
- **Blockers:** i18n key bug

## URL 16 — `/bookings/settings/policies` (Booking Policies) · Screenshot: `16-booking-policies.png`
- **Breadcrumb:** Settings > Bookings Settings > Booking Policies; back button before h1
- **h1:** "Booking Policies 1" (badge "1") · **Subtitle:** "Manage your policies and connect them to different services." Learn more
- **Header:** "Add a New Policy" (primary, 196.1x36)
- **Search:** "Search..."
- **Table columns:** "Policy name" (w398), "Connected services" (w607), actions (w84)
- **Row:** "Default policy" + badge "Default"; connected chips: Copy of Copy of contracting, Copy of contracting, contracting, 1, 2
- **Status:** "1 result found" (correct translation here); bottom "Add a New Policy"
- **Blockers:** none

## URL 17 — `/bookings/services/templates-catalog` (Add a New Service) · Screenshot: `17-templates-catalog.png`
- **h1:** "Add a New Service" · Back button (16px/400 rgb(17,109,255)) at (303,72)
- **AI section:** h3 "Describe the service you want to create" + "Tell us about your service and we'll generate it for you using AI."; textarea placeholder "Create one-o…" (900x84 at x333 y276); disclaimer "AI can make mistakes. Always double-check the results."; "Generate" button (white on blue gradient, bg reports transparent)
- **Template section:** h3 "Or, start from a template." + "Choose a ready-made service template and customize it."; "Services for:" + input "Enter the type of business" (value "Contracting Firm")
- **Tabs:** Appointment (selected) / Class / Course
- **Template cards (198px title 16px/700):** Kitchen Remodeling, Roof Replacement, Basement Finishing — each "Paid session", "Client's place", "Edit" button
- **CTA:** "Start from Scratch" (white bg card, blue text, radius 8px)
- **Blockers:** none

---

**Summary:** All 17 pages measured at 1440x900 with CSS, layout, copy, and interactive controls captured; 17 screenshots saved (`01-services.png` … `17-templates-catalog.png`). Consistent shared design system (Madefor, blue #116DFF primary, 18px pill buttons). Notable data-collection issues only: calendar view combobox text unreadable (URL 8) and two untranslated i18n status strings (`cairo.a11y.liveRegion.resultsFound` on URLs 10 & 15).