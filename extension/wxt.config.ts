/**
 * WXT configuration: one codebase, Chrome/Edge (chrome-mv3) and Firefox (firefox-mv3) builds.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/wxt.config.ts
 * Deps:    wxt
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Declare the minimal permission set: storage, alarms, notifications, contextMenus
 * - Host permissions only for the oldboys API (prod + local dev); LinkedIn access is via the content script match
 * - Firefox-only keys (gecko id, data collection declaration) added only on the firefox target
 *
 * Design constraints:
 * - Auto-imports disabled: every symbol is imported explicitly so the code is greppable
 * - manifestVersion pinned to 3 for every browser (WXT would default Firefox to MV2)
 * - "@domain" resolves to the app's src/domain so the RunStatus wire schema has one source
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  manifestVersion: 3,
  alias: {
    "@domain": fileURLToPath(new URL("../src/domain", import.meta.url)),
  },
  manifest: ({ browser }) => ({
    name: "oldboys research",
    description: "Mark a person on LinkedIn or any page; get told when the sourced report is ready.",
    permissions: ["storage", "alarms", "notifications", "contextMenus"],
    host_permissions: ["https://oldboys.asajj.cz/*", "http://localhost:3141/*"],
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "oldboys@soulfire.cz",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["personallyIdentifyingInfo"] },
            },
          },
        }
      : {}),
  }),
});
