import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingService, ServiceType } from "../../types/bookings";
import { paths } from "../paths";
import { PageHeader } from "../ui";

const SECTIONS = [
  "Service details",
  "Pricing & payment",
  "Add-ons",
  "Staff & availability",
  "Resources & rooms",
  "Locations",
  "Images",
  "Booking preferences",
] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_PARAM: Record<string, Section> = {
  details: "Service details",
  pricing: "Pricing & payment",
  addons: "Add-ons",
  availability: "Staff & availability",
  resources: "Resources & rooms",
  locations: "Locations",
  images: "Images",
  preferences: "Booking preferences",
};

export function ServiceFormPage() {
  const { serviceId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = (params.get("type") as ServiceType | null) ?? "APPOINTMENT";
  const sectionKey = params.get("section");
  const initialSection =
    (sectionKey && SECTION_PARAM[sectionKey]) || "Service details";

  const [section, setSection] = useState<Section>(initialSection);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BookingService>({
    id: serviceId ?? "",
    name: "",
    type,
    category: "Hair",
    durationMinutes: 60,
    price: 0,
    currency: "USD",
    staffIds: [],
    locationName: "Main Studio",
  });

  useEffect(() => {
    void (async () => {
      if (!serviceId) return;
      const snap = await bookingsApi.load();
      const found = snap.services.find((s) => s.id === serviceId);
      if (found) setForm(found);
    })();
  }, [serviceId]);

  useEffect(() => {
    if (sectionKey && SECTION_PARAM[sectionKey]) {
      setSection(SECTION_PARAM[sectionKey]);
    }
  }, [sectionKey]);

  const badge = useMemo(() => {
    const t = form.type.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [form.type]);

  const save = async () => {
    setSaving(true);
    try {
      if (serviceId) {
        await bookingsApi.saveService(form);
      } else {
        const created = await bookingsApi.createService({
          name: form.name || "Untitled service",
          type: form.type,
          category: form.category,
          durationMinutes: form.durationMinutes,
          price: form.price,
          currency: form.currency,
          staffIds: form.staffIds,
          locationName: form.locationName,
        });
        navigate(paths.serviceFormEdit(created.id), { replace: true });
        setForm(created);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-page">
      <PageHeader
        title={form.name || "Service"}
        subtitle={`${badge} service`}
        breadcrumb={[
          { label: "Booking Services", to: paths.services },
          { label: form.name || "New service" },
        ]}
        actions={
          <>
            <Link className="bk-btn bk-btn-ghost" to={paths.services}>
              Cancel
            </Link>
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

      <div className="bk-form-layout">
        <nav className="bk-form-nav" aria-label="Service sections">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-selected={section === s}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="bk-form-panel">
          {section === "Service details" && (
            <>
              <label className="bk-field">
                <span className="bk-label">Service name</span>
                <input
                  className="bk-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="bk-field">
                <span className="bk-label">Category</span>
                <input
                  className="bk-input"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </label>
              <label className="bk-field">
                <span className="bk-label">Duration (minutes)</span>
                <input
                  className="bk-input"
                  type="number"
                  min={5}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="bk-field">
                <span className="bk-label">Type</span>
                <select
                  className="bk-select"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as ServiceType,
                    })
                  }
                >
                  <option value="APPOINTMENT">Appointment</option>
                  <option value="CLASS">Class</option>
                  <option value="COURSE">Course</option>
                </select>
              </label>
            </>
          )}

          {section === "Pricing & payment" && (
            <>
              <label className="bk-field">
                <span className="bk-label">Price</span>
                <input
                  className="bk-input"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="bk-field">
                <span className="bk-label">Currency</span>
                <input
                  className="bk-input"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
              </label>
            </>
          )}

          {section === "Add-ons" && (
            <p className="bk-help">
              Attach add-ons from{" "}
              <Link to={paths.addons}>Add-ons</Link>. Clients can select them
              during booking.
            </p>
          )}

          {section === "Staff & availability" && (
            <p className="bk-help">
              Assign staff who offer this service. Manage hours on{" "}
              <Link to={paths.availability}>Work Schedule</Link>.
            </p>
          )}

          {section === "Resources & rooms" && (
            <p className="bk-help">
              Link rooms or equipment from{" "}
              <Link to={paths.resources}>Resources & rooms</Link>.
            </p>
          )}

          {section === "Locations" && (
            <label className="bk-field">
              <span className="bk-label">Location</span>
              <input
                className="bk-input"
                value={form.locationName}
                onChange={(e) =>
                  setForm({ ...form, locationName: e.target.value })
                }
              />
            </label>
          )}

          {section === "Images" && (
            <p className="bk-help">
              Upload service images when media storage is connected. Local preview
              uses the service name as the placeholder.
            </p>
          )}

          {section === "Booking preferences" && (
            <p className="bk-help">
              Control booking window, buffer times, and policies from{" "}
              <Link to={paths.policies}>Booking policies</Link> and{" "}
              <Link to={paths.bookflow}>Client booking flow</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
