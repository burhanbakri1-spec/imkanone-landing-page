import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../paths";
import { PageHeader } from "../ui";
import type { ServiceType } from "../../types/bookings";

const TEMPLATES: Record<
  ServiceType,
  { id: string; name: string; meta: string }[]
> = {
  APPOINTMENT: [
    {
      id: "tpl_kitchen",
      name: "Kitchen Remodeling",
      meta: "Paid session · Client's place",
    },
    {
      id: "tpl_roof",
      name: "Roof Replacement",
      meta: "Paid session · Client's place",
    },
    {
      id: "tpl_basement",
      name: "Basement Finishing",
      meta: "Paid session · Client's place",
    },
  ],
  CLASS: [
    {
      id: "tpl_yoga",
      name: "Yoga class",
      meta: "Paid session · Business place",
    },
    {
      id: "tpl_fitness",
      name: "Group fitness",
      meta: "Paid session · Business place",
    },
  ],
  COURSE: [
    {
      id: "tpl_boot",
      name: "Bootcamp",
      meta: "Paid course · Business place",
    },
    {
      id: "tpl_series",
      name: "Multi-week series",
      meta: "Paid course · Business place",
    },
  ],
};

export function ServiceTemplatesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") as ServiceType | null) ?? "APPOINTMENT";
  const [active, setActive] = useState<ServiceType>(
    ["APPOINTMENT", "CLASS", "COURSE"].includes(type) ? type : "APPOINTMENT",
  );
  const [prompt, setPrompt] = useState("");
  const [businessType, setBusinessType] = useState("Contracting Firm");

  const list = useMemo(() => TEMPLATES[active], [active]);

  const selectType = (t: ServiceType) => {
    setActive(t);
    setParams({ type: t });
  };

  return (
    <div className="bk-page">
      <div style={{ marginBottom: 8 }}>
        <Link className="bk-btn bk-btn-link" to={paths.services} style={{ paddingLeft: 0 }}>
          ← Back
        </Link>
      </div>

      <PageHeader title="Add a New Service" />

      <section className="bk-card bk-card-pad" style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
          Describe the service you want to create
        </h2>
        <p className="bk-help" style={{ marginBottom: 12 }}>
          Tell us about your service and we&apos;ll generate it for you using AI.
        </p>
        <textarea
          className="bk-input"
          rows={4}
          placeholder="Create one-on-one consultations for home remodeling clients…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: "100%", resize: "vertical", minHeight: 84 }}
        />
        <p className="bk-help" style={{ marginTop: 8 }}>
          AI can make mistakes. Always double-check the results.
        </p>
        <button
          type="button"
          className="bk-btn bk-btn-primary"
          style={{ marginTop: 12 }}
          onClick={() =>
            navigate(
              `${paths.serviceFormNew}?type=${active}&template=ai&prompt=${encodeURIComponent(prompt.trim() || "new service")}`,
            )
          }
        >
          Generate
        </button>
      </section>

      <section className="bk-card">
        <div className="bk-card-pad">
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
            Or, start from a template.
          </h2>
          <p className="bk-help" style={{ marginBottom: 12 }}>
            Choose a ready-made service template and customize it.
          </p>
          <label className="bk-field" style={{ maxWidth: 360 }}>
            <span className="bk-label">Services for:</span>
            <input
              className="bk-input"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Enter the type of business"
            />
          </label>
        </div>

        <div className="bk-tabs" role="tablist">
          {(
            [
              ["APPOINTMENT", "Appointment"],
              ["CLASS", "Class"],
              ["COURSE", "Course"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className="bk-tab"
              aria-selected={active === key}
              onClick={() => selectType(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bk-template-grid">
          {list.map((tpl) => (
            <div key={tpl.id} className="bk-template-card">
              <h3>{tpl.name}</h3>
              <p>{tpl.meta}</p>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={() =>
                  navigate(
                    `${paths.serviceFormNew}?type=${active}&template=${tpl.id}`,
                  )
                }
              >
                Edit
              </button>
            </div>
          ))}
          <div className="bk-template-card" style={{ borderStyle: "dashed" }}>
            <h3 style={{ color: "var(--bk-primary)" }}>Start from Scratch</h3>
            <p>Build a custom {active.toLowerCase()} service.</p>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() =>
                navigate(`${paths.serviceFormNew}?type=${active}`)
              }
            >
              Start from Scratch
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
