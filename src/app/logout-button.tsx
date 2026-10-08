/**
 * Log out button: ends the session and returns to the login page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/logout-button.tsx
 * Deps:    react, next/navigation
 * Tested:  n/a
 *
 * Key responsibilities:
 * - POST /api/auth/logout, then route to /login and refresh server data
 *
 * Design constraints:
 * - Client component; the server always clears the cookie, so a network failure still routes to /login
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void logout()}
      className="text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-60"
    >
      Log out
    </button>
  );
}
