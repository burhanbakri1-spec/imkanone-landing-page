import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { canUseReviewAction } from "../src/utils/roles.js";
import {
  filterReviews,
  reviewComment,
  reviewStatusOf,
} from "../src/utils/reviewsUi.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("reviews workspace replaces the legacy dashboard table route", () => {
  const page = read("src/pages/AdminReviewsPage.jsx");
  const app = read("src/CPanelApp.jsx");
  assert.match(page, /fetchAllReviews\(/);
  assert.match(page, /updateReviewStatus\(/);
  assert.match(page, /deleteReview\(/);
  assert.match(page, /saveReview\(/);
  assert.match(app, /activePage === "admin-reviews"/);
  assert.match(app, /AdminReviewsPage/);
  assert.match(app, /activePage !== "admin-reviews"/);
  assert.doesNotMatch(page, /localStorage/);
});

test("reviews filters, moderation actions, and unsupported reply are wired", () => {
  const page = read("src/pages/AdminReviewsPage.jsx");
  assert.match(page, /filterReviews/);
  assert.match(page, /filters\.status/);
  assert.match(page, /filters\.type/);
  assert.match(page, /filters\.rating/);
  assert.match(page, /copy\.approve/);
  assert.match(page, /copy\.reject/);
  assert.match(page, /copy\.hide/);
  assert.match(page, /copy\.replyUnsupported/);
  assert.match(page, /copy\.forbidden/);
  assert.match(page, /copy\.readOnly/);
  assert.match(page, /copy\.retry/);
  assert.match(page, /copy\.noMatches/);
});

test("reviews permissions use reviews.view and reviews.manage", () => {
  const roles = read("src/utils/roles.js");
  const permissions = read("src/data/permissions.js");
  const page = read("src/pages/AdminReviewsPage.jsx");
  assert.match(roles, /"admin-reviews": \["reviews\.view"\]/);
  assert.match(roles, /canUseReviewAction/);
  assert.match(permissions, /reviews\.view/);
  assert.match(permissions, /reviews\.manage/);
  assert.match(page, /canUseReviewAction\(currentUser, "reviews\.manage"\)/);
  assert.equal(canUseReviewAction({ role: "company_admin" }, "reviews.manage"), true);
  assert.equal(canUseReviewAction({ role: "employee", permissions: ["reviews.view"] }, "reviews.manage"), false);
  assert.equal(canUseReviewAction({ role: "employee", permissions: ["reviews.manage"] }, "reviews.manage"), true);
});

test("review helpers map comments and filters without inventing data", () => {
  const rows = [
    { id: "1", customerName: "Jane", status: "pending", type: "website", rating: 5, comment: { en: "Great", ar: "رائع" } },
    { id: "2", customerName: "Omar", status: "approved", type: "employee", rating: 3, comment: "Okay" },
  ];
  assert.equal(reviewComment(rows[0], "ar"), "رائع");
  assert.equal(reviewStatusOf(rows[0]), "pending");
  assert.equal(filterReviews(rows, { query: "jane" }).length, 1);
  assert.equal(filterReviews(rows, { status: "approved" }).length, 1);
  assert.equal(filterReviews(rows, { rating: "3" }).length, 1);
  assert.equal(filterReviews(rows, { type: "employee" }).length, 1);
});
