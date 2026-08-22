import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { StaffRecord } from "../../types/bookings";
import { paths } from "../paths";
import { ActionMenu, Modal, PageHeader, PlusIcon } from "../ui";

export function StaffPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [defaultHoursOpen, setDefaultHoursOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);

  useEffect(() => {
    void bookingsApi.load().then((s) => setStaff(s.staff));
  }, []);

  const permissionLabel = (s: StaffRecord) => {
    const role = s.role?.trim();
    if (!role || role.toLowerCase() === "none") return "No permissions";
    return role;
  };

  return (
    <div className="bk-page">
      <PageHeader
        title="Staff"
        count={staff.length}
        subtitle="Manage your staff and set their work hours here."
        breadcrumb={[
          { label: "Booking Settings", to: paths.settings },
          { label: "Staff" },
        ]}
        actions={
          <>
            <ActionMenu
              label="Manage"
              items={[
                { label: "View work schedule", to: paths.availability },
                {
                  label: "Edit default hours",
                  onClick: () => setDefaultHoursOpen(true),
                },
                {
                  label: "Invite booking collaborators",
                  onClick: () => setInviteOpen(true),
                },
                {
                  label: "Manage default video account",
                  onClick: () => setVideoOpen(true),
                },
                {
                  label: "Staff personal data",
                  onClick: () => setPersonalOpen(true),
                },
              ]}
            />
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => navigate(paths.staffEditNew)}
            >
              <PlusIcon />
              Add Staff
            </button>
          </>
        }
      />

      <div className="bk-card">
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Permission</th>
                <th>Email</th>
                <th>Phone</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="bk-person">
                      <span
                        className="bk-avatar"
                        style={{ background: s.color }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <strong>{s.name}</strong>
                    </div>
                  </td>
                  <td>{permissionLabel(s)}</td>
                  <td>{s.email?.trim() ? s.email : "No email"}</td>
                  <td>{s.phone?.trim() ? s.phone : "No phone"}</td>
                  <td>
                    <Link
                      className="bk-btn bk-btn-link"
                      to={paths.staffEdit(s.id)}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bk-card-pad">
            <span className="bk-help" role="status">
              {staff.length} result{staff.length === 1 ? "" : "s"} found
            </span>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <Modal
          title="Invite booking collaborators"
          subtitle="0/5 seats used. Invite teammates to help manage bookings."
          onClose={() => setInviteOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setInviteOpen(false)}
              >
                Send Invite
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Role</span>
            <select className="bk-select" defaultValue="Bookings Manager">
              <option>Bookings Manager</option>
              <option>Staff</option>
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">Email</span>
            <input className="bk-input" type="email" placeholder="name@email.com" />
          </label>
        </Modal>
      )}

      {defaultHoursOpen && (
        <Modal
          title="Edit default hours"
          subtitle="Open the full Default Hours editor to set site-wide availability."
          onClose={() => setDefaultHoursOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setDefaultHoursOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => navigate(paths.defaultHours)}
              >
                Open Default Hours
              </button>
            </>
          }
        />
      )}

      {videoOpen && (
        <Modal
          title="Manage default video account"
          subtitle="Choose Google Meet or Zoom as the default conferencing account."
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
                onClick={() => setVideoOpen(false)}
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

      {personalOpen && (
        <Modal
          title="Staff personal data"
          subtitle="Review how staff contact details are stored for bookings."
          onClose={() => setPersonalOpen(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setPersonalOpen(false)}
            >
              Close
            </button>
          }
        >
          <p className="bk-help">
            Staff names, emails, and phones are stored in the bookings store and
            can be synced to Nest later via VITE_API_URL.
          </p>
        </Modal>
      )}
    </div>
  );
}
