/**
 * Log out button: ends the session and returns to the login page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/logout-button.tsx
 * Deps:    react, next/navigation, ./_components/run-tray-store (clearTray), ./_components/token (writeToken, clearOperator)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - POST /api/auth/logout, clear the account data this tab keeps (tray list, operator token, operator name), then
 *   route to /login and refresh server data
 *
 * Design constraints:
 * - Client component; the server always clears the cookie, so a network failure still routes to /login;
 *   the tab's account data is cleared either way, so nothing of the account stays visible once logged out
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearTray } from "./_components/run-tray-store";
import { clearOperator, writeToken } from "./_components/token";
import { BTN_QUIET } from "./ui";

export function LogoutButton(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout(): Promise<void> {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Offline: the cookie stays until the next attempt; still leave this page.
    }
    clearTray();
    writeToken(null);
    clearOperator();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void logout()}
      className={`${BTN_QUIET} disabled:opacity-60`}
    >
      Log out
    </button>
  );
}
