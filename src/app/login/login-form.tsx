/**
 * Login form: email and password, POST /api/auth/login.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/login/login-form.tsx
 * Deps:    react, next/navigation, ../start-form (FIELD)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Submit credentials; on 200 route to `next` (default /) and refresh; map 401 and 429 to calm messages
 *
 * Design constraints:
 * - Client component; the same message for unknown email and wrong password comes from the server
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_PRIMARY, CARD, FIELD } from "../ui";

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string };

const MESSAGE: Record<number, string> = {
  401: "Email or password is wrong.",
  429: "Too many attempts. Please wait 15 minutes.",
};

export function LoginForm({ next = "/" }: { next?: string }): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const email = data.get("email");
    const password = data.get("password");
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: typeof email === "string" ? email.trim() : "", password: typeof password === "string" ? password : "" }),
      });
      if (res.status === 200) {
        router.push(next);
        router.refresh();
        return;
      }
      setStatus({ kind: "error", message: MESSAGE[res.status] ?? "We could not log you in. Please try again." });
    } catch {
      setStatus({ kind: "error", message: "We could not reach the service. Please try again." });
    }
  }

  return (
    <form
      className={`${CARD} flex flex-col gap-5`}
      aria-label="Log in"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Work email
        <input name="email" type="email" autoComplete="email" required maxLength={254} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} className={FIELD} />
      </label>
      {status.kind === "error" && (
        <p role="alert" className="text-sm text-conflict">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className={`${BTN_PRIMARY} self-start`}
      >
        {status.kind === "submitting" ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
