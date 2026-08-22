import { useEffect, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { ReminderChannel } from "../../types/bookings";
import { paths } from "../paths";
import { ActionMenu, Modal, PageHeader } from "../ui";

type SendTab = "WhatsApp" | "SMS" | "Emails";
type GetTab = "Emails" | "SMS";

const AUTOMATIONS = [
  "Request payment when a session is booked",
  "Thank clients that attend a session",
  "Get feedback after a session",
];

function SmsBanner() {
  return (
    <div className="bk-banner bk-banner-info" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
        Keep your clients updated with SMS notifications
      </h3>
      <p style={{ margin: "0 0 12px" }}>
        To start sending SMS notifications, upgrade your site with a plan.
      </p>
      <button type="button" className="bk-btn bk-btn-ghost" disabled title="Requires site plan upgrade">
        Upgrade
      </button>
    </div>
  );
}

function NotificationRows({
  channels,
  actionLabel,
  onToggle,
  onEdit,
}: {
  channels: ReminderChannel[];
  actionLabel: string;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (row: ReminderChannel) => void;
}) {
  return (
    <div className="bk-toggle-list">
      {channels.map((c) => (
        <div key={c.id} className="bk-toggle-row">
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
            <input
              type="checkbox"
              checked={c.enabled}
              onChange={(e) => onToggle(c.id, e.target.checked)}
              aria-label={c.enabled ? "Active" : "Inactive"}
            />
            <div>
              <strong>{c.name}</strong>
              <div style={{ marginTop: 4 }}>
                <span className="bk-chip">{c.description}</span>
              </div>
            </div>
          </label>
          <div className="bk-row-actions">
            <span className="bk-help">{actionLabel}</span>
            <button
              type="button"
              className="bk-btn bk-btn-link"
              onClick={() => onEdit(c)}
            >
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RemindersYouSendPage() {
  const [channels, setChannels] = useState<ReminderChannel[]>([]);
  const [tab, setTab] = useState<SendTab>("WhatsApp");
  const [editRow, setEditRow] = useState<ReminderChannel | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  useEffect(() => {
    void bookingsApi.load().then((s) => setChannels(s.remindersSend));
  }, []);

  const persist = async (next: ReminderChannel[]) => {
    setChannels(next);
    await bookingsApi.setReminderSend(next);
  };

  const sectionTitle =
    tab === "WhatsApp"
      ? "WhatsApp Notifications"
      : tab === "SMS"
        ? "SMS Notifications"
        : "Email Notifications";

  const actionLabel =
    tab === "WhatsApp"
      ? "Send a WhatsApp message"
      : tab === "SMS"
        ? "Send an SMS"
        : "Send an email";

  return (
    <div className="bk-page">
      <PageHeader
        title="Notifications you send"
        subtitle={
          <>
            Manage notifications that are automatically sent to clients.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-sending-automated-emails-to-clients"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Booking Settings", to: paths.settings },
          { label: "Notifications you send" },
        ]}
        actions={
          <ActionMenu
            label="More Actions"
            items={[
              {
                label: "Explore More Automations",
                onClick: () => setAutomationsOpen(true),
              },
              {
                label: "Go to Automations",
                onClick: () => setAutomationsOpen(true),
              },
            ]}
          />
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(240px, 320px)", gap: 24 }}>
        <div className="bk-card bk-card-pad">
          <SmsBanner />
          <div className="bk-tabs" role="tablist" style={{ marginBottom: 16 }}>
            {(["WhatsApp", "SMS", "Emails"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                className="bk-tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "Emails" ? " (Free)" : ""}
              </button>
            ))}
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{sectionTitle}</h2>
          <p className="bk-help" style={{ marginBottom: 16 }}>
            Choose which booking updates you send via {tab === "Emails" ? "email" : tab}.
          </p>
          <NotificationRows
            channels={channels}
            actionLabel={actionLabel}
            onToggle={(id, enabled) => {
              void persist(
                channels.map((row) => (row.id === id ? { ...row, enabled } : row)),
              );
            }}
            onEdit={setEditRow}
          />
          {tab === "WhatsApp" && (
            <p className="bk-help" style={{ marginTop: 16 }}>
              By using WhatsApp you will be subject to WhatsApp terms and conditions and
              acknowledge their privacy policy.
            </p>
          )}
        </div>

        <aside className="bk-card bk-card-pad">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
            Recommended automations for your business
          </h2>
          {AUTOMATIONS.map((title) => (
            <div key={title} style={{ marginBottom: 16 }}>
              <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={() => setAutomationsOpen(true)}
              >
                Set Up Automation
              </button>
            </div>
          ))}
          <button
            type="button"
            className="bk-btn bk-btn-link"
            onClick={() => setAutomationsOpen(true)}
          >
            Explore More Automations
          </button>
        </aside>
      </div>

      {editRow && (
        <Modal
          title="Edit notification"
          subtitle={editRow.description}
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  void persist(
                    channels.map((row) =>
                      row.id === editRow.id ? { ...row, enabled: true } : row,
                    ),
                  );
                  setEditRow(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Channel: <strong>{tab}</strong> · Trigger: {editRow.name}
          </p>
        </Modal>
      )}

      {automationsOpen && (
        <Modal
          title="Automations"
          subtitle="Recommended booking automations for your business."
          onClose={() => setAutomationsOpen(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setAutomationsOpen(false)}
            >
              Done
            </button>
          }
        >
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {AUTOMATIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

export function RemindersYouGetPage() {
  const [channels, setChannels] = useState<ReminderChannel[]>([]);
  const [tab, setTab] = useState<GetTab>("Emails");
  const [editRow, setEditRow] = useState<ReminderChannel | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  useEffect(() => {
    void bookingsApi.load().then((s) => setChannels(s.remindersGet));
  }, []);

  const persist = async (next: ReminderChannel[]) => {
    setChannels(next);
    await bookingsApi.setReminderGet(next);
  };

  const actionLabel = tab === "Emails" ? "Send an email" : "Send an SMS";

  return (
    <div className="bk-page">
      <PageHeader
        title="Notifications you get"
        subtitle="Manage notifications you get about your bookings."
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Booking Settings", to: paths.settings },
          { label: "Notifications you get" },
        ]}
        actions={
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            onClick={() => setAutomationsOpen(true)}
          >
            Go to Automations
          </button>
        }
      />

      <div className="bk-card bk-card-pad">
        <SmsBanner />
        <div className="bk-tabs" role="tablist" style={{ marginBottom: 16 }}>
          {(["Emails", "SMS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="bk-tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Emails" ? " (Free)" : ""}
            </button>
          ))}
        </div>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
          {tab === "Emails" ? "Email Notifications" : "SMS Notifications"}
        </h2>
        <NotificationRows
          channels={channels}
          actionLabel={actionLabel}
          onToggle={(id, enabled) => {
            void persist(
              channels.map((row) => (row.id === id ? { ...row, enabled } : row)),
            );
          }}
          onEdit={setEditRow}
        />
      </div>

      {editRow && (
        <Modal
          title="Edit notification"
          subtitle={editRow.description}
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  void persist(
                    channels.map((row) =>
                      row.id === editRow.id ? { ...row, enabled: true } : row,
                    ),
                  );
                  setEditRow(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Channel: <strong>{tab}</strong> · Trigger: {editRow.name}
          </p>
        </Modal>
      )}

      {automationsOpen && (
        <Modal
          title="Automations"
          subtitle="Manage booking automations for your business."
          onClose={() => setAutomationsOpen(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setAutomationsOpen(false)}
            >
              Done
            </button>
          }
        >
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {AUTOMATIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
