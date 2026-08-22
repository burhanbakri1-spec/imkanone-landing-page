import { useEffect, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import { PageHeader } from "../ui";

type Mode = "Classes" | "Appointments";

const CLASS_CARDS = [
  "Spots filled",
  "Predicted occupancy",
  "Top class sessions",
  "Bookings + sales",
  "Top clients",
  "Staff performance",
] as const;

const APPT_CARDS = [
  "Spots filled",
  "Predicted occupancy",
  "Bookings + sales",
  "Top clients",
  "Staff performance",
] as const;

export function AnalyticsPage() {
  const [mode, setMode] = useState<Mode>("Classes");
  const [stats, setStats] = useState<{ label: string; value: number }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateLabel] = useState("Last 30 days");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiReply, setAiReply] = useState<string | null>(null);

  useEffect(() => {
    void bookingsApi.load().then((s) => {
      setStats(
        mode === "Appointments" ? s.analytics.appointments : s.analytics.classes,
      );
    });
  }, [mode]);

  const cards = mode === "Classes" ? CLASS_CARDS : APPT_CARDS;

  const valueFor = (
    label: string,
  ): { bookings: number; sales: number; value: number; empty: boolean } => {
    if (label === "Bookings + sales") {
      const bookings = stats.find((s) => s.label === "Bookings")?.value ?? 0;
      const sales = stats.find((s) => s.label === "Booking sales")?.value ?? 0;
      return {
        bookings,
        sales,
        value: 0,
        empty: bookings === 0 && sales === 0,
      };
    }
    const value = stats.find((s) => s.label === label)?.value ?? 0;
    return { bookings: 0, sales: 0, value, empty: value === 0 };
  };

  const formatCard = (label: string) => {
    const data = valueFor(label);
    if (label === "Bookings + sales") {
      return `${data.bookings} / ₺${data.sales.toFixed(2)}`;
    }
    if (label === "Top clients") {
      return `${data.value} first-time / ${data.value} returning`;
    }
    if (label === "Top class sessions" || label === "Staff performance") {
      return data.value === 0 ? "—" : String(data.value);
    }
    return data.value.toLocaleString();
  };

  const isEmpty = (label: string) => valueFor(label).empty;

  return (
    <div className="bk-page">
      <PageHeader
        title="Bookings Analytics"
        subtitle={
          <>
            Analyze bookings performance and gain insights on clients and staff.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-analyzing-your-bookings-data"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        actions={
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              className="bk-input"
              readOnly
              value={`${dateLabel} (Jul 22 - Today)`}
              aria-label="Date range"
              style={{ minWidth: 220 }}
            />
            <div className="bk-segment" role="tablist">
              <button
                type="button"
                aria-selected={mode === "Classes"}
                onClick={() => setMode("Classes")}
              >
                Classes
              </button>
              <button
                type="button"
                aria-selected={mode === "Appointments"}
                onClick={() => setMode("Appointments")}
              >
                Appointments
              </button>
            </div>
          </div>
        }
      />

      <div
        className="bk-card bk-card-pad"
        style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <strong style={{ fontSize: 14 }}>Ask AI</strong>
        <input
          className="bk-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Ask a question about your stats"
          value={aiQuestion}
          onChange={(e) => setAiQuestion(e.target.value)}
          aria-label="Ask AI"
        />
        <button
          type="button"
          className="bk-btn bk-btn-primary"
          onClick={() => {
            const q = aiQuestion.trim();
            setAiReply(
              q
                ? `Insight preview for “${q}” — connect Nest analytics for live answers.`
                : "Enter a question about your booking stats.",
            );
          }}
        >
          Ask AI
        </button>
        {aiReply && (
          <p className="bk-help" style={{ width: "100%", margin: "8px 0 0" }}>
            {aiReply}
          </p>
        )}
      </div>

      <div className="bk-stat-row">
        {cards.map((label) => {
          const empty = isEmpty(label);
          return (
            <div key={label} className="bk-stat" style={{ minWidth: 160 }}>
              <div className="label">{label}</div>
              <div
                className="value"
                style={{ fontSize: label === "Top clients" || label === "Bookings + sales" ? 16 : undefined }}
              >
                {formatCard(label)}
              </div>
              <button
                type="button"
                className="bk-btn bk-btn-link"
                style={{ marginTop: 8, padding: 0 }}
                disabled={empty}
                onClick={() =>
                  setExpanded((cur) => (cur === label ? null : label))
                }
              >
                View Report
              </button>
              {expanded === label && !empty && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "#f7f9fc",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  Inline {mode.toLowerCase()} report for <strong>{label}</strong>.
                  Values reflect local mock analytics until Nest is connected.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
