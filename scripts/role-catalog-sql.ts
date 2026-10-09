/**
 * Prints the INSERT statements that seed D1 `role_templates` from the TypeScript role catalog.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  scripts/role-catalog-sql.ts
 * Deps:    src/domain/role-catalog (bundled by esbuild through `pnpm roles:sql`)
 * Tested:  src/domain/__tests__/role-catalog.test.ts checks migrations/0013_role_templates.sql names every key
 *
 * Key responsibilities:
 * - One `INSERT OR REPLACE` per template, SQL-quoted, deterministic order (catalog order)
 *
 * Design constraints:
 * - Output goes to stdout; the caller pastes it under the CREATE TABLE in the migration (or a later re-seed migration)
 */
import { ROLE_CATALOG, templateToRow } from "../src/domain/role-catalog";

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;

for (const t of ROLE_CATALOG) {
  const r = templateToRow(t);
  process.stdout.write(
    `INSERT OR REPLACE INTO role_templates (key, title, family, aliases_json, profile, must_haves_json, sources_json, created_at) VALUES (${q(r.key)}, ${q(r.title)}, ${q(r.family)}, ${q(r.aliases_json)}, ${q(r.profile)}, ${q(r.must_haves_json)}, ${q(r.sources_json)}, '2026-10-09T00:00:00Z');\n`,
  );
}
