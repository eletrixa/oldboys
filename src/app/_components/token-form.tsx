/**
 * Token form: asks once for the team access token (RUN_TOKEN).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/token-form.tsx
 * Deps:    react, src/app/ui
 * Tested:  n/a (covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - Password field plus submit; calls onSubmit with the trimmed token
 *
 * Design constraints:
 * - Client component; never stores the token itself, callers use token.ts
 */
"use client";

import { BTN_PRIMARY, FIELD } from "@/app/ui";

type TokenFormProps = {
  error: string | null;
  onSubmit: (token: string) => void;
  hint?: string;
  submitLabel?: string;
};

export function TokenForm({
  error,
  onSubmit,
  hint = "The list shows every brief, so it needs the team token. Kept only in this tab.",
  submitLabel = "Show roles",
}: TokenFormProps): React.JSX.Element {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const raw = new FormData(e.currentTarget).get("token");
        if (typeof raw === "string" && raw.trim() !== "") onSubmit(raw.trim());
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Team access token
        <input
          name="token"
          type="password"
          required
          autoComplete="off"
          className={`${FIELD} font-normal`}
        />
        <span className="text-xs font-normal text-muted">{hint}</span>
      </label>
      {error !== null && <p role="alert" className="text-sm text-conflict">{error}</p>}
      <button type="submit" className={`${BTN_PRIMARY} self-start`}>
        {submitLabel}
      </button>
    </form>
  );
}
