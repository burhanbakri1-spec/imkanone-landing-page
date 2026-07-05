import { Router } from "express";
import { activityLogRepository } from "../data/store.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

router.get("/", (req, res) => {
  try {
    let logs = activityLogRepository
      .getByCompany(req.companyId)
      .filter((log) => !log.deleted_at)
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    const { action, entity_type, actor_email, date_from, date_to } = req.query;

    if (action) {
      logs = logs.filter((log) => log.action === action);
    }
    if (entity_type) {
      logs = logs.filter((log) => log.entity_type === entity_type);
    }
    if (actor_email) {
      logs = logs.filter((log) => log.actor_email?.toLowerCase().includes(actor_email.toLowerCase()));
    }
    if (date_from) {
      const from = parseDate(date_from);
      if (from) {
        logs = logs.filter((log) => String(log.created_at || "") >= from);
      }
    }
    if (date_to) {
      const to = parseDate(date_to);
      if (to) {
        logs = logs.filter((log) => String(log.created_at || "") <= to);
      }
    }

    const limit = safeNumber(req.query.limit, 50);
    const page = safeNumber(req.query.page, 1);
    const start = (page - 1) * limit;
    const paginated = logs.slice(start, start + limit);

    return res.json({
      logs: paginated,
      total: logs.length,
      page,
      limit,
      totalPages: Math.ceil(logs.length / limit) || 1,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch activity logs." });
  }
});

router.get("/:logId", (req, res) => {
  try {
    const log = activityLogRepository.findByCompany(req.companyId, req.params.logId);
    if (!log || log.deleted_at) {
      return res.status(404).json({ message: "Activity log not found." });
    }
    return res.json(log);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch activity log." });
  }
});

export default router;
