import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  canBuildCustomModules,
  canManageCustomModuleEntries,
  canViewCustomModule,
  validateModuleDraft,
} from "../src/utils/customModulesUi.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("unit creator replaces generic feature page route", () => {
  const page = read("src/pages/AdminUnitCreatorPage.jsx");
  const app = read("src/CPanelApp.jsx");
  const feature = read("src/pages/AdminFeaturePage.jsx");
  assert.match(page, /fetchCustomModules\(/);
  assert.match(page, /createCustomModuleEntry\(/);
  assert.match(page, /updateCustomModuleEntry\(/);
  assert.match(page, /deleteCustomModuleEntry\(/);
  assert.match(app, /activePage === "admin-unit-creator"/);
  assert.match(app, /AdminUnitCreatorPage/);
  assert.doesNotMatch(feature, /admin-unit-creator/);
  assert.doesNotMatch(page, /localStorage/);
});

test("unit creator covers module builder, entries, and permission states", () => {
  const page = read("src/pages/AdminUnitCreatorPage.jsx");
  assert.match(page, /ModuleFormDialog/);
  assert.match(page, /EntryFormDialog/);
  assert.match(page, /copy\.loading/);
  assert.match(page, /copy\.forbidden/);
  assert.match(page, /copy\.readOnly/);
  assert.match(page, /copy\.builderReadOnly/);
  assert.match(page, /copy\.emptyModules/);
  assert.match(page, /copy\.emptyEntries/);
  assert.match(page, /copy\.confirmDeleteEntry/);
  assert.match(page, /canBuildCustomModules/);
  assert.match(page, /canManageCustomModuleEntries/);
});

test("unit creator page permission uses product_settings.manage", () => {
  const roles = read("src/utils/roles.js");
  assert.match(roles, /"admin-unit-creator": \["product_settings\.manage"\]/);
});

test("custom module helpers validate modules and permissions", () => {
  const module = {
    key: "units",
    label: "Units",
    enabled: true,
    permissions: { view: ["custom_modules.units.view"], manage: ["custom_modules.units.manage"] },
    fieldsSchema: [{ key: "unit_name", label: "Unit name", type: "text", required: true, options: [] }],
  };
  assert.equal(canBuildCustomModules({ role: "company_admin" }), true);
  assert.equal(canBuildCustomModules({ role: "employee", permissions: ["custom_modules.units.manage"] }), false);
  assert.equal(canViewCustomModule({ role: "employee", permissions: ["custom_modules.units.view"] }, module), true);
  assert.equal(canManageCustomModuleEntries({ role: "employee", permissions: ["custom_modules.units.view"] }, module), false);
  assert.equal(canManageCustomModuleEntries({ role: "employee", permissions: ["custom_modules.units.manage"] }, module), true);
  assert.equal(validateModuleDraft(module).valid, true);
  assert.equal(validateModuleDraft({ key: "bad", label: "", fieldsSchema: [] }).valid, false);
});
