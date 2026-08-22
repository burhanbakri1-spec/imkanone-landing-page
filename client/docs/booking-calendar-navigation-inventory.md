# Booking Calendar navigation inventory

**OpenCode sessions:** `BC-smoke`, `BC-nav-discovery-v2`, `BC-nav-complete`  
**Evidence:** `C:\Users\eng -code\opencode-bridge\output\last-events.jsonl`  
**Viewport:** 1440×900  
**Rule:** Scope = Booking Calendar product UI (sidebar group), NOT every `/bookings/` URL.

## Product root

Sidebar group **"Booking Calendar"** (4 items). Identified by expanding the sidebar cluster `aria-label="giza-sidebar-item-sub-menu-cluster-calendar"`:

| # | Item | URL |
|---|------|-----|
| 1 | Calendar | `/wix-calendar` |
| 2 | Booking List | `/bookings/bookings/bookings-list` |
| 3 | Work Schedule | `/bookings/availability` |
| 4 | Bookings Analytics | `/bookings/overviews/bookings` |

## Nodes

### CAL* — Calendar

| ID | Node | Type | Classification | Description |
|----|------|------|----------------|-------------|
| CAL1 | Calendar page | Page `/wix-calendar` | IN_SCOPE | Weekly FullCalendar; toolbar + activity + filters |
| CAL.1 | View switcher | view | IN_SCOPE | Weekly / Daily / Staff / Schedule |
| CAL.2 | Today | inline | IN_SCOPE | Resets to current week |
| CAL.3 | Prev / Next | inline | IN_SCOPE | Shifts week |
| CAL.4 | Search | inline | IN_SCOPE | Search icon + input |
| CAL.5 | Filters panel | drawer/menu | IN_SCOPE | Catalog items, Staff, Location, Session availability, Other events |
| CAL.6 | Display Settings | drawer | IN_SCOPE | Spacing, event title, color by, palette |
| CAL.7 | Add menu | menu | IN_SCOPE | Quick Sale, Appointment, Blocked staff time, Class session, Create New Service |
| CAL.8 | Manage menu | menu | IN_SCOPE | See edges |
| CAL.9 | Sync Calendars CTA | modal | IN_SCOPE | Sync your personal calendar (Google) |
| CAL.10 | Activity panel | inline | IN_SCOPE | Upcoming, waitlists, requests, recent |
| CAL.11 | Empty slot click | inline | IN_SCOPE | No popup when no events |
| CAL-M1 | Edit services | page | IN_SCOPE | → `/bookings/services` existingModule |
| CAL-M2 | Go to staff members | page | IN_SCOPE | → `/bookings/staff` existingModule |
| CAL-M3 | Resources | page | IN_SCOPE | → resource-management existingModule |
| CAL-M4 | Default business hours | page/modal | IN_SCOPE | Default Hours existingModule |
| CAL-M5 | Add booking integrations | page | IN_SCOPE | → `/bookings/integrations` existingModule |
| CAL-M6 | Sync personal calendar | modal | IN_SCOPE | modal |
| CAL-M7 | Invite booking collaborators | modal | IN_SCOPE | modal |
| CAL-M8 | Export booking data | modal | IN_SCOPE | modal |
| CAL-M9 | Manage on the go | external | OUT_OF_SCOPE | www.wix.com |
| CAL-M10 | Update booking settings | page | IN_SCOPE | → `/bookings/settings` existingModule |
| CAL-M11 | Calendar apps | submenu | INERT | No submenu appears; closes menu |
| CAL-M12 | Time Blocker | menu item | INERT | No page/modal/tab after retry — determined inert |

### BL* — Booking List

| ID | Node | Type | Classification | Notes |
|----|------|------|----------------|-------|
| BL1 | Booking List page | page | IN_SCOPE | |
| BL2 | Breadcrumb Calendar \| Booking List | in-page nav | IN_SCOPE | |
| BL3 | Summary cards | inline | IN_SCOPE | Total / Unpaid / Paid |
| BL4 | Period | dropdown | IN_SCOPE | Last 7 days |
| BL5 | Tabs | tab | IN_SCOPE | Appointments & Classes / Courses |
| BL6–BL7 | View + Manage View | menu | IN_SCOPE | 5 view actions |
| BL8–BL9 | Filter + side panel | drawer | IN_SCOPE | 11 filters, 420px panel |
| BL10 | Export | modal | IN_SCOPE | All/Filtered/Selected CSV |
| BL11–BL13 | Columns / Manage fields | drawer | IN_SCOPE | 17 fields |
| BL14–BL15 | Chips + empty state | inline | IN_SCOPE | No results found |

### WS* — Work Schedule

| ID | Node | Type | Classification | Notes |
|----|------|------|----------------|-------|
| WS1 | Work Schedule page | page | IN_SCOPE | existingModule — preserve |
| WS2–WS5 | More Actions / Add Staff Hours | menu/modal | IN_SCOPE | |
| WS6 | Edit default hours | page | IN_SCOPE | Default Hours existingModule |
| WS7 | Manage staff | page | IN_SCOPE | `/bookings/staff` existingModule |
| WS8 | Invite collaborators | modal | IN_SCOPE | Roles & Permissions link OUT |
| WS9–WS13 | Week nav, filters, grid, slot menu | inline/menu | IN_SCOPE | Slot → Add hours for this day |

### BA* — Bookings Analytics

| ID | Node | Type | Classification | Notes |
|----|------|------|----------------|-------|
| BA1 | Analytics page | page | IN_SCOPE | |
| BA2–BA4 | Period, Classes/Appointments, Ask AI | inline | IN_SCOPE | Learn more → support OUT |
| BA5–BA11 | Cards + View Report | inline | IN_SCOPE | View Report disabled when empty |

## Edges

| Source | Action | Destination | Type | Class |
|--------|--------|-------------|------|-------|
| Sidebar BC | Calendar | `/wix-calendar` | page | IN_SCOPE |
| Sidebar BC | Booking List | `/bookings/bookings/bookings-list` | page | IN_SCOPE |
| Sidebar BC | Work Schedule | `/bookings/availability` | page | IN_SCOPE |
| Sidebar BC | Bookings Analytics | `/bookings/overviews/bookings` | page | IN_SCOPE |
| CAL Add · Create New Service | click | templates-catalog | page | OUT_OF_SCOPE |
| CAL Manage · Edit services | click | `/bookings/services` | page | IN_SCOPE |
| CAL Manage · Staff | click | `/bookings/staff` | page | IN_SCOPE |
| CAL Manage · Resources | click | resources | page | IN_SCOPE |
| CAL Manage · Default hours | click | Default Hours | page | IN_SCOPE |
| CAL Manage · Integrations | click | `/bookings/integrations` | page | IN_SCOPE |
| CAL Manage · Sync / Invite / Export | click | modal | modal | IN_SCOPE |
| CAL Manage · Settings | click | `/bookings/settings` | page | IN_SCOPE |
| CAL Manage · Manage on the go | click | www.wix.com | external | OUT_OF_SCOPE |
| CAL Manage · Time Blocker | click | none | inert | INERT |
| BL breadcrumb · Calendar | click | `/wix-calendar` | page | IN_SCOPE |
| BL Filter | click | side panel | drawer | IN_SCOPE |
| BL Export | click | modal | modal | IN_SCOPE |
| WS Add Staff Hours | click | modal | modal | IN_SCOPE |
| WS Manage staff | click | `/bookings/staff` | page | IN_SCOPE |
| BA Learn more | click | support.wix.com | external | OUT_OF_SCOPE |

## OUT_OF_SCOPE

- Create New Service → `templates-catalog`
- Manage on the go → `www.wix.com`
- Session availability filter → templates
- Roles & Permissions (invite modal footer)
- Analytics Learn more → support.wix.com
- Global Wix sidebar/navbar/Aria AI chrome
- Catalog-only pages not opened from Booking Calendar UI (Shareable Links, Add-ons, etc.) — **kept in repo, not expanded**

## UNCERTAIN

**(none open)** — Time Blocker re-inspected once; determined **inert** (no destination).

## Coverage checklist

- [x] All 4 Booking Calendar sidebar destinations visited
- [x] Calendar Add/Manage/filters/activity/display settings explored
- [x] Booking List tabs/filters/views/export/columns explored
- [x] Work Schedule actions explored
- [x] Analytics controls explored
- [x] Cross-product hops classified; existing modules kept

## Inventory verification checklist

- [x] Product root identified via live UI (not URL alone)
- [x] Zero open UNCERTAIN
- [x] Existing OUT_OF_SCOPE implementations remain intact
- [x] OpenCode evidence linked

## Phase 4 completeness

- [x] Booking Calendar root identified (sidebar group)
- [x] Graph discovered + classified (IN/OUT/INERT)
- [x] Calendar experience module implemented
- [x] Booking List / Analytics upgraded to inventory
- [x] Work Schedule preserved
- [x] Existing Catalog/settings pages kept (not deleted)
- [x] No global sidebar/navbar added
- [x] OpenCode evidence: BC-smoke, BC-nav-discovery-v2, BC-nav-complete, BC-validate
- [x] Validation: Calendar/Booking List/Work Schedule/Analytics PASS (Display Settings fields expanded after GAP)
- [x] `npx tsc -b` passes
