import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { StaffRecord } from "../../types/bookings";
import { paths } from "../paths";
import { Modal, PageHeader } from "../ui";

const emptyStaff = (): Omit<StaffRecord, "id"> => ({
  name: "",
  email: "",
  phone: "",
  role: "Staff",
  locationName: "Main Studio",
  color: "#116dff",
  active: true,
});

export function StaffEditPage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<StaffRecord | (Omit<StaffRecord, "id"> & { id?: string })>(
    emptyStaff(),
  );
  const [missingOpen, setMissingOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!staffId) return;
      const snap = await bookingsApi.load();
      const found = snap.staff.find((s) => s.id === staffId);
      if (found) setForm(found);
    })();
  }, [staffId]);

  const incomplete = !form.name.trim() || !form.email.trim();

  const save = async () => {
    if (incomplete) {
      setMissingOpen(true);
      return;
    }
    setSaving(true);
    try {
      if (staffId && "id" in form && form.id) {
        await bookingsApi.saveStaff(form as StaffRecord);
      } else {
        const created = await bookingsApi.createStaff({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          locationName: form.locationName,
          color: form.color,
          active: form.active,
        });
        navigate(paths.staffEdit(created.id), { replace: true });
        setForm(created);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-page">
      <PageHeader
        title={staffId ? "Edit Staff Member" : "Add Staff Member"}
        breadcrumb={[
          { label: "Booking Settings", to: paths.settings },
          { label: "Staff", to: paths.staff },
          { label: staffId ? "Edit" : "Add" },
        ]}
        actions={
          <>
            <Link className="bk-btn bk-btn-ghost" to={paths.staff}>
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
        <div className="bk-form-panel">
          <label className="bk-field">
            <span className="bk-label">Name</span>
            <input
              className="bk-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Email</span>
            <input
              className="bk-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Phone</span>
            <input
              className="bk-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Role</span>
            <select
              className="bk-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option>Owner</option>
              <option>Staff</option>
              <option>Bookings Manager</option>
            </select>
          </label>
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
          <div className="bk-header-actions" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() => {
                if (incomplete) setMissingOpen(true);
                else navigate(paths.availability);
              }}
            >
              View Working hours
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => setPermOpen(true)}
            >
              Give Permissions
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => setSyncOpen(true)}
            >
              Sync Calendar
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => setAccountOpen(true)}
            >
              Add Individual Account
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => setAssignOpen(true)}
            >
              Add Staff Assignment
            </button>
          </div>
        </div>
      </div>

      {missingOpen && (
        <Modal
          title="We're Missing Some Information"
          subtitle="Complete the required fields before viewing working hours."
          onClose={() => setMissingOpen(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setMissingOpen(false)}
            >
              Complete Missing Info
            </button>
          }
        />
      )}

      {permOpen && (
        <Modal
          title="Give Permissions"
          subtitle="Choose what this staff member can manage."
          onClose={() => setPermOpen(false)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setPermOpen(false)}>
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => setPermOpen(false)}>
                Save
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Permission set</span>
            <select className="bk-select" defaultValue="Manage own bookings">
              <option>Manage own bookings</option>
              <option>Manage all bookings</option>
              <option>View only</option>
            </select>
          </label>
        </Modal>
      )}

      {syncOpen && (
        <Modal
          title="Sync Calendar"
          subtitle="Connect a personal calendar for this staff member."
          onClose={() => setSyncOpen(false)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setSyncOpen(false)}>
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => setSyncOpen(false)}>
                Continue
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Calendar</span>
            <select className="bk-select" defaultValue="Google Calendar">
              <option>Google Calendar</option>
              <option>Outlook</option>
            </select>
          </label>
        </Modal>
      )}

      {accountOpen && (
        <Modal
          title="Add Individual Account"
          subtitle="Attach a video or messaging account for this staff member."
          onClose={() => setAccountOpen(false)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setAccountOpen(false)}>
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => setAccountOpen(false)}>
                Continue
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Account type</span>
            <select className="bk-select" defaultValue="Google Meet">
              <option>Google Meet</option>
              <option>Zoom</option>
            </select>
          </label>
        </Modal>
      )}

      {assignOpen && (
        <Modal
          title="Add Staff Assignment"
          subtitle="Assign services or locations to this staff member."
          onClose={() => setAssignOpen(false)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setAssignOpen(false)}>
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => setAssignOpen(false)}>
                Save
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Assignment</span>
            <select className="bk-select" defaultValue="All services at Main Studio">
              <option>All services at Main Studio</option>
              <option>Selected services only</option>
            </select>
          </label>
        </Modal>
      )}
    </div>
  );
}

