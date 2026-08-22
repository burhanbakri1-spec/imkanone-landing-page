import { useEffect, useMemo, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { IntegrationCard, IntegrationTab } from "../../types/bookings";
import { PageHeader } from "../ui";

const TABS: IntegrationTab[] = [
  "Booking channels",
  "Communications",
  "Business management",
  "Payroll & invoice",
  "Marketing",
  "Website widgets",
  "Mobile apps",
];

export function IntegrationsPage() {
  const [tab, setTab] = useState<IntegrationTab>("Booking channels");
  const [items, setItems] = useState<IntegrationCard[]>([]);

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setItems(snap.integrations);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(
    () => items.filter((i) => i.tab === tab),
    [items, tab],
  );

  return (
    <div className="bk-page">
      <PageHeader
        title="Booking Integrations"
        subtitle="Explore ways to increase your bookings, engage with clients, manage your business and more."
      />

      <div className="bk-card">
        <div className="bk-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="bk-tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="bk-grid-tiles" style={{ padding: 20 }}>
          {visible.map((item) => (
            <div key={item.id} className="bk-tile" style={{ cursor: "default" }}>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  type="button"
                  className={`bk-btn ${item.connected ? "bk-btn-ghost" : "bk-btn-primary"}`}
                  onClick={async () => {
                    await bookingsApi.setIntegrationConnected(
                      item.id,
                      !item.connected,
                    );
                    await refresh();
                  }}
                >
                  {item.connected ? "Disconnect" : "Connect"}
                </button>
                <a
                  className="bk-btn bk-btn-link"
                  href={`https://support.wix.com/en/article/wix-bookings-${encodeURIComponent(item.name.toLowerCase())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more
                </a>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="bk-empty" style={{ gridColumn: "1 / -1" }}>
              <h2>No integrations in this tab</h2>
              <p>Try another category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
