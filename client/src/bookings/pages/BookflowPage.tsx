import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookflowStep } from "../../types/bookings";
import { paths } from "../paths";
import { PageHeader } from "../ui";

type ServiceFilter = "all" | "classes";

type BookflowState = {
  servicesPerAppointment: "one" | "multiple";
  staffChoice: "clients" | "auto";
  defaultAnyStaff: boolean;
  staffWhen: "separate" | "calendar";
  locationWhen: "separate" | "calendar";
  slotMode: "duration" | "interval";
  intervalMinutes: string;
  waitlist: boolean;
  timeZone: "business" | "client";
  letChooseTz: boolean;
  allowCart: boolean;
  tips: boolean;
};

const DEFAULT_STATE: BookflowState = {
  servicesPerAppointment: "one",
  staffChoice: "clients",
  defaultAnyStaff: true,
  staffWhen: "calendar",
  locationWhen: "calendar",
  slotMode: "interval",
  intervalMinutes: "30",
  waitlist: false,
  timeZone: "client",
  letChooseTz: true,
  allowCart: false,
  tips: false,
};

function parseState(steps: BookflowStep[]): BookflowState {
  const get = (id: string) => steps.find((s) => s.id === id)?.description ?? "";
  const service = get("bf_service");
  const staff = get("bf_staff").split("|");
  const location = get("bf_location");
  const slots = get("bf_slots").split("|");
  const tz = get("bf_tz").split("|");
  const checkout = get("bf_checkout");
  return {
    ...DEFAULT_STATE,
    servicesPerAppointment: service === "multiple" ? "multiple" : "one",
    staffChoice: staff[0] === "auto" ? "auto" : "clients",
    defaultAnyStaff: staff[1] !== "noany",
    staffWhen: staff[2] === "separate" ? "separate" : "calendar",
    locationWhen: location === "separate" ? "separate" : "calendar",
    slotMode: slots[0] === "duration" ? "duration" : "interval",
    intervalMinutes: slots[1] || "30",
    waitlist: slots[2] === "waitlist",
    timeZone: tz[0] === "business" ? "business" : "client",
    letChooseTz: tz[1] !== "nochoose",
    allowCart: checkout.includes("cart"),
    tips: checkout.includes("tips"),
  };
}

function toSteps(state: BookflowState, prev: BookflowStep[]): BookflowStep[] {
  const base = prev.length
    ? prev
    : [
        { id: "bf_service", title: "Service selection", description: "", enabled: true },
        { id: "bf_staff", title: "Staff selection", description: "", enabled: true },
        { id: "bf_location", title: "Location selection", description: "", enabled: true },
        { id: "bf_slots", title: "Available time slots", description: "", enabled: true },
        { id: "bf_tz", title: "Time zone", description: "", enabled: true },
        { id: "bf_form", title: "Booking Form", description: "manage", enabled: true },
        { id: "bf_checkout", title: "Checkout settings", description: "", enabled: true },
      ];
  return base.map((step) => {
    switch (step.id) {
      case "bf_service":
        return { ...step, description: state.servicesPerAppointment };
      case "bf_staff":
        return {
          ...step,
          description: `${state.staffChoice}|${state.defaultAnyStaff ? "any" : "noany"}|${state.staffWhen}`,
        };
      case "bf_location":
        return { ...step, description: state.locationWhen };
      case "bf_slots":
        return {
          ...step,
          description: `${state.slotMode}|${state.intervalMinutes}|${state.waitlist ? "waitlist" : ""}`,
        };
      case "bf_tz":
        return {
          ...step,
          description: `${state.timeZone}|${state.letChooseTz ? "choose" : "nochoose"}`,
        };
      case "bf_checkout":
        return {
          ...step,
          description: [
            state.allowCart ? "cart" : "",
            state.tips ? "tips" : "",
          ]
            .filter(Boolean)
            .join("|"),
        };
      default:
        return step;
    }
  });
}

export function BookflowPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    service: true,
    staff: false,
    location: false,
    slots: false,
    tz: false,
    form: false,
    checkout: false,
  });
  const [state, setState] = useState<BookflowState>(DEFAULT_STATE);
  const [steps, setSteps] = useState<BookflowStep[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void bookingsApi.load().then((s) => {
      setSteps(s.bookflow);
      setState(parseState(s.bookflow));
    });
  }, []);

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const patch = (p: Partial<BookflowState>) => setState((s) => ({ ...s, ...p }));

  const save = async () => {
    setSaving(true);
    try {
      const next = toSteps(state, steps);
      await bookingsApi.setBookflow(next);
      setSteps(next);
    } finally {
      setSaving(false);
    }
  };

  const showAppointment = filter === "all";

  return (
    <div className="bk-page">
      <PageHeader
        title="Client booking flow"
        subtitle="Customize the default booking experience clients have on your live site."
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Booking Settings", to: paths.settings },
          { label: "Client booking flow" },
        ]}
        actions={
          <>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() => navigate(paths.settings)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              disabled={saving}
              onClick={() => void save()}
            >
              Save
            </button>
          </>
        }
      />

      <div className="bk-toolbar" style={{ marginBottom: 16 }}>
        <div className="bk-toolbar-left" style={{ gap: 8, alignItems: "center" }}>
          <span className="bk-help">Filter settings by:</span>
          <button
            type="button"
            className={`bk-btn ${filter === "all" ? "bk-btn-primary" : "bk-btn-ghost"}`}
            onClick={() => setFilter("all")}
          >
            All service types
          </button>
          <button
            type="button"
            className={`bk-btn ${filter === "classes" ? "bk-btn-primary" : "bk-btn-ghost"}`}
            onClick={() => setFilter("classes")}
          >
            Classes & Courses
          </button>
        </div>
      </div>

      {showAppointment && (
        <>
          <Collapsible
            title="Service selection"
            open={openSections.service}
            onToggle={() => toggle("service")}
          >
            <p className="bk-help">How many services can be added to a single appointment?</p>
            <Radio
              checked={state.servicesPerAppointment === "one"}
              onChange={() => patch({ servicesPerAppointment: "one" })}
              label="One service per appointment"
              hint="Clients can book one service per visit to keep scheduling simple."
            />
            <Radio
              checked={state.servicesPerAppointment === "multiple"}
              onChange={() => patch({ servicesPerAppointment: "multiple" })}
              label="Multiple services per appointment (up to 5)"
            />
          </Collapsible>

          <Collapsible
            title="Staff selection"
            open={openSections.staff}
            onToggle={() => toggle("staff")}
          >
            <p className="bk-help">How are staff members chosen for services?</p>
            <Radio
              checked={state.staffChoice === "clients"}
              onChange={() => patch({ staffChoice: "clients" })}
              label="Clients choose a staff member"
            />
            {state.staffChoice === "clients" && (
              <label style={{ display: "flex", gap: 8, margin: "8px 0 8px 24px", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={state.defaultAnyStaff}
                  onChange={(e) => patch({ defaultAnyStaff: e.target.checked })}
                />
                Set default to Any staff member
              </label>
            )}
            <Radio
              checked={state.staffChoice === "auto"}
              onChange={() => patch({ staffChoice: "auto" })}
              label="Assign staff automatically"
            />
            <p className="bk-help">
              Staff will be assigned based on your{" "}
              <Link to={paths.policies}>booking policy</Link>.
            </p>
            <p className="bk-help" style={{ marginTop: 16 }}>
              When do clients choose a staff member?
            </p>
            <Radio
              checked={state.staffWhen === "separate"}
              onChange={() => patch({ staffWhen: "separate" })}
              label="On a separate step before viewing the calendar"
            />
            <Radio
              checked={state.staffWhen === "calendar"}
              onChange={() => patch({ staffWhen: "calendar" })}
              label="On the calendar page"
            />
          </Collapsible>

          <Collapsible
            title="Location selection"
            open={openSections.location}
            onToggle={() => toggle("location")}
          >
            <p className="bk-help">When do clients choose a location?</p>
            <Radio
              checked={state.locationWhen === "separate"}
              onChange={() => patch({ locationWhen: "separate" })}
              label="On a separate step before viewing the calendar"
            />
            <Radio
              checked={state.locationWhen === "calendar"}
              onChange={() => patch({ locationWhen: "calendar" })}
              label="On the calendar page"
            />
          </Collapsible>

          <Collapsible
            title="Available time slots"
            open={openSections.slots}
            onToggle={() => toggle("slots")}
          >
            <p className="bk-help">Choose how appointment start times are set.</p>
            <Radio
              checked={state.slotMode === "duration"}
              onChange={() => patch({ slotMode: "duration" })}
              label="Based on service duration"
            />
            <Radio
              checked={state.slotMode === "interval"}
              onChange={() => patch({ slotMode: "interval" })}
              label="Every"
            />
            {state.slotMode === "interval" && (
              <select
                className="bk-select"
                style={{ marginLeft: 24, maxWidth: 160 }}
                value={state.intervalMinutes}
                onChange={(e) => patch({ intervalMinutes: e.target.value })}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            )}
            <div style={{ marginTop: 16 }}>
              <strong>Appointment Waitlist</strong>
              <p className="bk-help">
                Add a waitlist to your live site so clients can join when they can&apos;t find a
                time that works.
              </p>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={() => patch({ waitlist: !state.waitlist })}
              >
                {state.waitlist ? "Deactivate" : "Activate"}
              </button>
            </div>
          </Collapsible>
        </>
      )}

      <Collapsible
        title="Time zone"
        open={openSections.tz}
        onToggle={() => toggle("tz")}
      >
        <p className="bk-help">What time zone do clients see when scheduling a session?</p>
        <Radio
          checked={state.timeZone === "business"}
          onChange={() => patch({ timeZone: "business" })}
          label="Your business time zone"
        />
        <Radio
          checked={state.timeZone === "client"}
          onChange={() => patch({ timeZone: "client" })}
          label="Client's local time zone"
        />
        <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={state.letChooseTz}
            onChange={(e) => patch({ letChooseTz: e.target.checked })}
          />
          Let clients choose between your time zone and theirs
        </label>
      </Collapsible>

      <Collapsible
        title="Booking Form"
        open={openSections.form}
        onToggle={() => toggle("form")}
      >
        <p className="bk-help">
          Customize and manage the form that clients fill out when booking online.
        </p>
        <Link className="bk-btn bk-btn-secondary" to={paths.formsManager}>
          Manage Forms
        </Link>
      </Collapsible>

      <Collapsible
        title="Checkout settings"
        open={openSections.checkout}
        onToggle={() => toggle("checkout")}
      >
        <p style={{ marginTop: 0 }}>
          <strong>All Checkout Settings</strong>
        </p>
        <label className="bk-toggle-row" style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <strong>Cart</strong>
            <div className="bk-help">
              Allow clients to pay for multiple services and products at once.
            </div>
          </div>
          <input
            type="checkbox"
            checked={state.allowCart}
            onChange={(e) => patch({ allowCart: e.target.checked })}
          />
        </label>
        <div className="bk-toggle-row">
          <div>
            <strong>Tips</strong>
            <div className="bk-help">Let clients add a tip when they book.</div>
          </div>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            onClick={() => patch({ tips: !state.tips })}
          >
            {state.tips ? "Deactivate" : "Activate"}
          </button>
        </div>
        <div className="bk-toggle-row">
          <div>
            <strong>Discounts</strong>
            <div className="bk-help">
              Offer discounts that apply automatically without a coupon code.
            </div>
          </div>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            onClick={() =>
              window.alert("Discount management opens in Marketing (out of scope).")
            }
          >
            Manage
          </button>
        </div>
        <div className="bk-toggle-row">
          <div>
            <strong>Payments</strong>
            <div className="bk-help">
              Set up a payment method to accept online payments at checkout.
            </div>
          </div>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            onClick={() =>
              window.alert("Connect Payment method opens global payments (out of scope).")
            }
          >
            Connect Payment method
          </button>
        </div>
      </Collapsible>

      <section className="bk-card bk-card-pad" style={{ marginTop: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Booking Widgets</h2>
        <p className="bk-help" style={{ marginBottom: 16 }}>
          Give your clients more ways to book on your site with Booking Widgets.{" "}
          <a
            href="https://support.wix.com/en/article/wix-bookings-adding-and-setting-up-the-bookings-widgets"
            target="_blank"
            rel="noreferrer"
          >
            Explore more
          </a>
        </p>
        {(
          [
            ["Daily Agenda", "Classes Only", "Display your upcoming classes by date and time"],
            [
              "Weekly Timetable",
              "Classes Only",
              "Clients see all classes that you have for the week in one place",
            ],
            ["Next Availability", "", "Show up to 3 upcoming slots clients can book"],
          ] as const
        ).map(([title, badge, desc]) => (
          <div key={title} className="bk-toggle-row">
            <div>
              <strong>
                {title}
                {badge ? ` (${badge})` : ""}
              </strong>
              <div className="bk-help">{desc}</div>
            </div>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() =>
                window.alert(`Add ${title} to Site — editor install is out of scope.`)
              }
            >
              Add to Site
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="bk-card" style={{ marginBottom: 12 }}>
      <button
        type="button"
        className="bk-toggle-row"
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          font: "inherit",
          cursor: "pointer",
          textAlign: "left",
          padding: "16px 20px",
          margin: 0,
        }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="bk-card-pad" style={{ paddingTop: 0 }}>{children}</div>}
    </section>
  );
}

function Radio({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10, fontSize: 14 }}>
      <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="radio" checked={checked} onChange={onChange} />
        <span>
          <strong>{label}</strong>
          {hint && <div className="bk-help">{hint}</div>}
        </span>
      </span>
    </label>
  );
}
