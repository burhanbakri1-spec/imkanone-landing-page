import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { replaceTenantProductFieldValuesWithClient, validateTenantFieldValue } from "../src/productSchema/fieldValues.js";

const migration = fs.readFileSync(new URL("../supabase/migrations/011_tenant_product_content.sql", import.meta.url), "utf8");
const defaultSchema = fs.readFileSync(new URL("../src/productSchema/schema.js", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../src/routes/productFieldDefinitions.js", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/productSchema/fieldValues.js", import.meta.url), "utf8");
const cpanel = fs.readFileSync(new URL("../../cpanel/src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const employeeCpanel = fs.readFileSync(new URL("../../cpanel/src/pages/EmployeeDashboardPage.jsx", import.meta.url), "utf8");
const structuredEditor = fs.readFileSync(new URL("../../cpanel/src/components/TenantProductFields.jsx", import.meta.url), "utf8");

test("iCare definitions contain beauty fields but no EB-only detail slots", () => {
  assert.match(migration, /'icare','benefits'/);
  assert.match(migration, /'icare','complete_ingredients'/);
  for (const key of ["dsiHowItWorks1", "dsiImpact1", "dsiSafeToUse", "dsiPracticalBanner", "dsiFaq"]) assert.doesNotMatch(migration, new RegExp(`'icare','${key}'`, "i"));
});

test("EB default schema retains its existing fields", () => {
  for (const key of ["dsiHowItWorks1", "dsiImpact1", "dsiSafeToUse", "dsiPracticalBanner", "dsiFaq"]) assert.match(defaultSchema, new RegExp(`"${key}"`));
});

test("field values are tenant and product scoped with locale uniqueness", () => {
  assert.match(migration, /unique index[\s\S]*company_id, product_id, field_definition_id, locale/i);
  assert.match(service, /where v\.company_id=\$1 and v\.product_id=\$2/);
  assert.match(service, /where company_id=\$1 and id=\$2 for update/);
});

test("unknown and inactive field keys are rejected", () => {
  assert.match(service, /Unknown or inactive field key/);
  assert.match(service, /is_active=true/);
});

test("field validation enforces server types", () => {
  assert.throws(() => validateTenantFieldValue({ field_type: "number", field_key: "volume", validation: {} }, "x"), /numeric/);
  assert.throws(() => validateTenantFieldValue({ field_type: "multiple_images", field_key: "gallery", validation: {} }, "x"), /list/);
  assert.equal(validateTenantFieldValue({ field_type: "boolean", field_key: "active", validation: {} }, true), true);
});

test("FAQ values require localized question and answer data", () => {
  const definition = { field_type: "key_value", field_key: "product_faqs", validation: {} };
  assert.throws(() => validateTenantFieldValue(definition, [{ question: { en: "Question" } }]), /localized question and answer/);
  const value = [{ question: { en: "Question", ar: "سؤال" }, answer: { en: "Answer", ar: "جواب" }, sort_order: 0, is_active: true }];
  assert.deepEqual(validateTenantFieldValue(definition, value), value);
});

test("admin field routes derive tenant from authenticated request", () => {
  assert.match(routes, /router\.use\(requireAuth\)/);
  assert.match(routes, /req\.companyId/);
  assert.doesNotMatch(routes, /req\.body\.company|req\.query\.company|x-company-id/i);
});

test("CPanel uses server definitions and keeps EB fields on the legacy branch", () => {
  assert.match(cpanel, /productFieldApi\.definitions\(\)/);
  assert.match(cpanel, /usesTenantDefinitions/);
  assert.match(cpanel, /!usesTenantDefinitions/);
});

test("company admin and employee use the same tenant-aware product wizard", () => {
  assert.match(cpanel, /export function ProductWizard/);
  assert.match(employeeCpanel, /import \{ ProductWizard \} from "\.\/AdminDashboardPage\.jsx"/);
  assert.doesNotMatch(employeeCpanel, /AdminProductForm/);
  assert.match(employeeCpanel, /canCreateProducts \|\| \(canUpdateProducts && editingProduct\)/);
});

test("visual editors never require raw JSON and support ordered bilingual rows", () => {
  assert.doesNotMatch(structuredEditor, /JSON\.parse|JSON\.stringify/);
  assert.match(structuredEditor, /moveStructuredItem/);
  assert.match(structuredEditor, /Question.*English/s);
  assert.match(structuredEditor, /العربية/);
});

test("migration seed is repeatable and uses neutral structured FAQ values", () => {
  assert.match(migration, /on conflict\(company_id,field_key\) do update/i);
  assert.match(migration, /'product_faqs'[\s\S]*'faqs'\)/);
  assert.match(migration, /'showcase_units'[\s\S]*false,'showcaseUnits'/);
});

function fieldValueClient(definitions) {
  const values = new Map();
  let inserts = 0;
  return {
    get inserts() { return inserts; },
    values,
    async query(sql, params) {
      if (sql.includes("from public.products")) return { rows: [{ id: params[1] }] };
      if (sql.includes("from public.product_field_definitions")) return { rows: definitions };
      if (sql.startsWith("update public.product_field_values")) {
        const identity = params.slice(0, 4).join(":");
        if (!values.has(identity)) return { rows: [] };
        const row = { ...values.get(identity), value: JSON.parse(params[4]) };
        values.set(identity, row);
        return { rows: [row] };
      }
      if (sql.includes("insert into public.product_field_values")) {
        inserts += 1;
        const identity = params.slice(1, 5).join(":");
        const row = { id: params[0], locale: params[4], value: JSON.parse(params[5]) };
        values.set(identity, row);
        return { rows: [row] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test("structured bilingual, FAQ, and showcase values persist idempotently", async () => {
  const definitions = [
    { id: "benefits", field_key: "benefits", field_type: "repeatable_list", translatable: true, is_required: false, validation: {} },
    { id: "faqs", field_key: "product_faqs", field_type: "key_value", translatable: false, is_required: false, validation: {} },
    { id: "showcase", field_key: "showcase_units", field_type: "repeatable_list", translatable: false, is_required: false, validation: {} },
  ];
  const entries = [
    { key: "benefits", locale: "en", value: ["Hydrates"] },
    { key: "benefits", locale: "ar", value: ["يرطب"] },
    { key: "product_faqs", locale: "neutral", value: [{ question: { en: "Q", ar: "س" }, answer: { en: "A", ar: "ج" }, sort_order: 0, is_active: true }] },
    { key: "showcase_units", locale: "neutral", value: [{ title: { en: "Title", ar: "عنوان" }, body: { en: "Body", ar: "نص" }, sort_order: 0, is_active: true }] },
  ];
  const client = fieldValueClient(definitions);

  const first = await replaceTenantProductFieldValuesWithClient(client, "icare", "product-1", entries);
  const second = await replaceTenantProductFieldValuesWithClient(client, "icare", "product-1", entries);

  assert.equal(first.length, 4);
  assert.equal(second.length, 4);
  assert.equal(client.inserts, 4, "the repeated save updates the same four rows");
  assert.equal(client.values.size, 4);
});
