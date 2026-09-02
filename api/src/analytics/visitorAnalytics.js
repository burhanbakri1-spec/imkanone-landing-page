/**
 * Visitor session analytics (tenant/site scoped).
 *
 * Retention: raw visitor events are capped at MAX_VISITOR_EVENTS_PER_COMPANY per tenant.
 * Sessions persist for live counting and aggregation; stale sessions fall outside the live window.
 * Stored fields exclude PII — sessionKey/visitorKey are opaque client-generated identifiers only.
 */

import crypto from "node:crypto";
import { LIVE_VISITOR_WINDOW_MS } from "./dashboardInsights.js";

export const MAX_VISITOR_EVENTS_PER_COMPANY = 10000;

export function createVisitorSessionKey() {
  return crypto.randomUUID();
}

export function createVisitorEvent({
  companyId,
  siteId = "",
  sessionKey = "",
  eventType = "pageview",
  path = "",
  productId = "",
}) {
  const allowed = new Set(["pageview", "product_view", "heartbeat"]);
  const type = allowed.has(eventType) ? eventType : "pageview";
  return {
    id: crypto.randomUUID(),
    company_id: companyId,
    siteId: String(siteId || ""),
    sessionKey: String(sessionKey || ""),
    eventType: type,
    path: String(path || ""),
    productId: String(productId || ""),
    createdAt: new Date().toISOString(),
  };
}

export function trimVisitorEvents(events = [], companyId, max = MAX_VISITOR_EVENTS_PER_COMPANY) {
  const companyEvents = events.filter((event) => event.company_id === companyId);
  if (companyEvents.length <= max) return events;
  const removeIds = new Set(
    companyEvents
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, companyEvents.length - max)
      .map((event) => event.id),
  );
  return events.filter((event) => !removeIds.has(event.id));
}

export function upsertVisitorSession(sessions = [], {
  companyId,
  siteId = "",
  sessionKey = "",
  visitorKey = "",
  path = "",
  eventType = "pageview",
  now = new Date(),
}) {
  const timestamp = now.toISOString();
  const existingIndex = sessions.findIndex(
    (session) => session.company_id === companyId
      && session.siteId === siteId
      && session.sessionKey === sessionKey,
  );
  const isReturning = Boolean(visitorKey) && sessions.some(
    (session) => session.company_id === companyId
      && session.visitorKey === visitorKey
      && session.sessionKey !== sessionKey,
  );

  if (existingIndex >= 0) {
    const current = { ...sessions[existingIndex] };
    current.lastSeenAt = timestamp;
    current.pageViews += eventType === "pageview" ? 1 : 0;
    current.productViews += eventType === "product_view" ? 1 : 0;
    current.lastPath = path || current.lastPath;
    if (visitorKey && !current.visitorKey) current.visitorKey = visitorKey;
    const next = [...sessions];
    next[existingIndex] = current;
    return next;
  }

  return [
    ...sessions,
    {
      id: crypto.randomUUID(),
      company_id: companyId,
      siteId,
      sessionKey,
      visitorKey: String(visitorKey || ""),
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      pageViews: eventType === "pageview" ? 1 : 0,
      productViews: eventType === "product_view" ? 1 : 0,
      isReturning,
      lastPath: String(path || ""),
    },
  ];
}

export function countLiveVisitors(sessions = [], {
  companyId,
  siteId = "",
  windowMs = LIVE_VISITOR_WINDOW_MS,
  now = new Date(),
} = {}) {
  const cutoff = now.getTime() - windowMs;
  return sessions.filter((session) => {
    if (session.company_id !== companyId) return false;
    if (siteId && session.siteId !== siteId) return false;
    const lastSeen = new Date(session.lastSeenAt || 0).getTime();
    return Number.isFinite(lastSeen) && lastSeen >= cutoff;
  }).length;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

export function aggregateVisitorAnalytics(sessions = [], events = [], {
  companyId,
  siteId = "",
  now = new Date(),
} = {}) {
  const scopedSessions = sessions.filter(
    (session) => session.company_id === companyId && (!siteId || session.siteId === siteId),
  );
  const scopedEvents = events.filter(
    (event) => event.company_id === companyId && (!siteId || event.siteId === siteId),
  );

  const dayStart = startOfDay(now).getTime();
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();

  const sessionsInRange = (startMs) => scopedSessions.filter(
    (session) => new Date(session.firstSeenAt).getTime() >= startMs,
  );

  const eventsInRange = (startMs) => scopedEvents.filter(
    (event) => new Date(event.createdAt).getTime() >= startMs,
  );

  const dailySessions = sessionsInRange(dayStart);
  const monthlySessions = sessionsInRange(monthStart);
  const yearlySessions = sessionsInRange(yearStart);

  const dailyEvents = eventsInRange(dayStart);
  const monthlyEvents = eventsInRange(monthStart);
  const yearlyEvents = eventsInRange(yearStart);

  const returningSupported = scopedSessions.some((session) => session.visitorKey);
  const firstTimeDaily = returningSupported
    ? dailySessions.filter((session) => !session.isReturning).length
    : null;
  const returningDaily = returningSupported
    ? dailySessions.filter((session) => session.isReturning).length
    : null;

  const seriesByDay = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const start = startOfDay(day).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const count = scopedSessions.filter((session) => {
      const seen = new Date(session.firstSeenAt).getTime();
      return seen >= start && seen < end;
    }).length;
    seriesByDay.push({
      date: startOfDay(day).toISOString().slice(0, 10),
      visitors: count,
      pageViews: scopedEvents.filter((event) => {
        const created = new Date(event.createdAt).getTime();
        return created >= start && created < end && event.eventType === "pageview";
      }).length,
    });
  }

  return {
    daily: {
      totalVisitors: dailySessions.length,
      pageViews: dailyEvents.filter((event) => event.eventType === "pageview").length,
      productViews: dailyEvents.filter((event) => event.eventType === "product_view").length,
      firstTimeVisitors: firstTimeDaily,
      returningVisitors: returningDaily,
    },
    monthly: {
      totalVisitors: monthlySessions.length,
      pageViews: monthlyEvents.filter((event) => event.eventType === "pageview").length,
      productViews: monthlyEvents.filter((event) => event.eventType === "product_view").length,
    },
    yearly: {
      totalVisitors: yearlySessions.length,
      pageViews: yearlyEvents.filter((event) => event.eventType === "pageview").length,
      productViews: yearlyEvents.filter((event) => event.eventType === "product_view").length,
    },
    seriesByDay,
    returningVisitorIdentitySupported: returningSupported,
    liveVisitors: countLiveVisitors(scopedSessions, { companyId, siteId, now }),
    liveVisitorWindowMs: LIVE_VISITOR_WINDOW_MS,
  };
}
