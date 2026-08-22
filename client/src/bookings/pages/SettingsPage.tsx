import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { paths } from "../paths";
import { Modal, PageHeader } from "../ui";

type Tile = {
  title: string;
  description: string;
  to?: string;
  action?: "tips" | "video";
};

const GROUPS: { heading: string; tiles: Tile[] }[] = [
  {
    heading: "Bookings Setup",
    tiles: [
      {
        title: "Default hours",
        description: "Set the default hours you and your staff are available for bookings.",
        to: paths.defaultHours,
      },
      {
        title: "Add-ons",
        description: "Create and manage the add-ons you offer for your services.",
        to: paths.addons,
      },
      {
        title: "Staff",
        description: "Manage your staff and set their work hours.",
        to: paths.staff,
      },
      {
        title: "Resources & rooms",
        description: "Organize items and spaces and link them to offerings.",
        to: paths.resources,
      },
      {
        title: "Notifications you send",
        description: "Manage notifications that are automatically sent to clients.",
        to: paths.remindersYouSend,
      },
      {
        title: "Notifications you get",
        description: "Manage notifications you get about your bookings.",
        to: paths.remindersYouGet,
      },
      {
        title: "Tips",
        description: "Let clients add a tip when they book.",
        action: "tips",
      },
    ],
  },
  {
    heading: "Online Bookings",
    tiles: [
      {
        title: "Client booking flow",
        description: "Customize the default booking experience clients have on your live site.",
        to: paths.bookflow,
      },
      {
        title: "Booking form",
        description: "Customize and manage the form clients fill out when booking online.",
        to: paths.formsManager,
      },
      {
        title: "Booking policies",
        description: "Manage your policies and connect them to different services.",
        to: paths.policies,
      },
    ],
  },
  {
    heading: "Integrations",
    tiles: [
      {
        title: "Video conferencing account",
        description: "Connect Google Meet or Zoom for online sessions.",
        action: "video",
      },
      {
        title: "Booking integrations",
        description: "Explore ways to increase bookings and manage your business.",
        to: paths.integrations,
      },
    ],
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [tipsOpen, setTipsOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="bk-page">
      <PageHeader
        title="Booking Settings"
        subtitle="Set up your business to take bookings exactly how and when you'd like."
      />

      {GROUPS.map((group) => (
        <section key={group.heading} style={{ marginBottom: 28 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>
            {group.heading}
          </h2>
          <div className="bk-card">
            {group.tiles.map((tile) => {
              const body = (
                <>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{tile.title}</h3>
                    <p className="bk-help" style={{ margin: "4px 0 0" }}>
                      {tile.description}
                    </p>
                  </div>
                  <span aria-hidden="true" style={{ color: "var(--bk-muted)" }}>
                    ›
                  </span>
                </>
              );
              if (tile.to) {
                return (
                  <Link
                    key={tile.title}
                    to={tile.to}
                    className="bk-toggle-row"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: "16px 20px",
                      margin: 0,
                    }}
                  >
                    {body}
                  </Link>
                );
              }
              return (
                <button
                  key={tile.title}
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
                  onClick={() => {
                    if (tile.action === "tips") setTipsOpen(true);
                    if (tile.action === "video") setVideoOpen(true);
                  }}
                >
                  {body}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {tipsOpen && (
        <Modal
          title="Wix Tips (New)"
          subtitle="Add the Tips app to collect gratuities with bookings."
          onClose={() => setTipsOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setTipsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={() => setTipsOpen(false)}
              >
                See full description
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setTipsOpen(false)}
              >
                Add to Site
              </button>
            </>
          }
        />
      )}

      {videoOpen && (
        <Modal
          title="Add a video conferencing account"
          subtitle="Choose Google Meet or Zoom, then continue."
          onClose={() => setVideoOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setVideoOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  setVideoOpen(false);
                  navigate(paths.settings);
                }}
              >
                Continue
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Provider</span>
            <select className="bk-select" defaultValue="Google Meet">
              <option>Google Meet</option>
              <option>Zoom</option>
            </select>
          </label>
        </Modal>
      )}
    </div>
  );
}
