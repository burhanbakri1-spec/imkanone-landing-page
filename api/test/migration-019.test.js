import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../supabase/migrations/019_media_ownership_entity_fields.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

test("migration 019 reads website media video and fallback values from persisted JSONB data", () => {
  assert.match(migration, /data\s*->>\s*'videoUrl'/);
  assert.match(migration, /data\s*->>\s*'video_url'/);
  assert.match(migration, /data\s*->>\s*'fallbackImageUrl'/);
  assert.match(migration, /data\s*->>\s*'fallback_image_url'/);
  assert.doesNotMatch(
    migration,
    /select\s+section_key,\s*image_url,\s*video_url/i,
    "website_media has no dedicated video_url column",
  );
});

test("migration 019 keeps its Kids Velvet-only backfill and legacy media rows", () => {
  assert.match(migration, /where\s+company_id\s*=\s*'kids-velvet'/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.website_media/i);
});
