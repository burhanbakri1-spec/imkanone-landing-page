import { useEffect, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { ShareableLink } from "../../types/bookings";
import { Modal, PageHeader } from "../ui";

const CREATE_CARDS: {
  kind: ShareableLink["kind"];
  title: string;
  description: string;
}[] = [
  {
    kind: "service-list",
    title: "Service list",
    description: "Share a link to your full list of bookable services.",
  },
  {
    kind: "calendar",
    title: "Service calendar",
    description: "Share a calendar view of upcoming sessions.",
  },
  {
    kind: "page",
    title: "Service page",
    description: "Share a link to a specific service page.",
  },
];

export function ShareableLinksPage() {
  const [links, setLinks] = useState<ShareableLink[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [kind, setKind] = useState<ShareableLink["kind"]>("service-list");
  const [label, setLabel] = useState("");
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [paymentNote, setPaymentNote] = useState(false);

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setLinks(snap.links);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const kindLabel =
    kind === "service-list"
      ? "service list"
      : kind === "calendar"
        ? "service calendar"
        : "service page";

  const openCreate = (k: ShareableLink["kind"]) => {
    setKind(k);
    setLabel("");
    setCreateOpen(true);
  };

  return (
    <div className="bk-page">
      <PageHeader
        title="Shareable Links"
        subtitle={
          <>
            Create custom links for your clients to book services and buy plans.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-sharing-a-link-to-your-booking-calendar"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
      />

      <div className="bk-banner bk-banner-info" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span>Connect a payment method to start selling your services</span>
        <button
          type="button"
          className="bk-btn bk-btn-secondary"
          onClick={() => setPaymentNote(true)}
        >
          Connect Payment Method
        </button>
      </div>

      <div className="bk-grid-tiles" style={{ marginBottom: 24 }}>
        {CREATE_CARDS.map((card) => (
          <div key={card.kind} className="bk-tile" style={{ cursor: "default" }}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => openCreate(card.kind)}
            >
              Create Link
            </button>
          </div>
        ))}
        <div className="bk-tile" style={{ cursor: "default" }}>
          <h3>Memberships and packages</h3>
          <p>Offer plans clients can buy and use toward bookings.</p>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => setMembershipOpen(true)}
          >
            Add a membership or package plan
          </button>
        </div>
      </div>

      {links.length > 0 && (
        <div className="bk-card">
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>URL</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}</td>
                    <td>
                      <span className="bk-chip">{l.kind}</span>
                    </td>
                    <td>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.url}
                      </a>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="bk-btn bk-btn-link"
                        onClick={async () => {
                          await navigator.clipboard.writeText(l.url);
                        }}
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <Modal
          title={`Customize the link for your ${kindLabel}`}
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={async () => {
                  await bookingsApi.saveLink({
                    id: `link_${Date.now()}`,
                    label: label.trim() || `New ${kindLabel}`,
                    kind,
                    url: `https://example.com/book/${kind}/${Date.now()}`,
                  });
                  setCreateOpen(false);
                  setLabel("");
                  await refresh();
                }}
              >
                Continue
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Name</span>
            <input
              className="bk-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Link name"
            />
          </label>
        </Modal>
      )}

      {membershipOpen && (
        <Modal
          title="Memberships and packages"
          subtitle="Create a plan clients can purchase and redeem for bookings."
          onClose={() => setMembershipOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setMembershipOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setMembershipOpen(false)}
              >
                Continue
              </button>
            </>
          }
        >
          <p className="bk-help" style={{ margin: 0 }}>
            Pricing plans live in the global Paid Plans area (out of scope for this content module).
          </p>
        </Modal>
      )}

      {paymentNote && (
        <Modal
          title="Connect Payment Method"
          subtitle="Payment setup opens in global site settings (out of scope)."
          onClose={() => setPaymentNote(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setPaymentNote(false)}
            >
              OK
            </button>
          }
        />
      )}
    </div>
  );
}
