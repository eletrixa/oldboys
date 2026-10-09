/**
 * Register form: two steps, account then company, POST /api/auth/register.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/register/register-form.tsx
 * Deps:    react, next/navigation, ./company-fields, ../start-form (FIELD)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Collect name, email and password, then the company; on 201 route to /onboarding; map 409, 429, 400
 *
 * Design constraints:
 * - Client component; step 1 values live in state so step 2 can go back without losing them
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrganizationInput } from "@/domain/organization";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, KEY, LINK } from "../ui";
import { CompanyFields } from "./company-fields";

type Step = "account" | "company";
type Account = { name: string; email: string; password: string };
type Failure = { message: string; login?: boolean; step?: Step };

const FIELD_ERRORS: Record<string, { message: string; step: Step }> = {
  email: { message: "Please check your email address.", step: "account" },
  name: { message: "Please enter your name.", step: "account" },
  password: { message: "Password needs at least 8 characters.", step: "account" },
  organization: { message: "Please check the company details.", step: "company" },
};
const DEFAULT_ERROR: Failure = { message: "Please check the form.", step: "account" };

async function badRequest(res: Response): Promise<Failure> {
  try {
    const body = await res.json<{ issues?: { path?: unknown }[] }>();
    const path = body.issues?.[0]?.path;
    const head = Array.isArray(path) ? (path as unknown[])[0] : undefined;
    return (typeof head === "string" ? FIELD_ERRORS[head] : undefined) ?? DEFAULT_ERROR;
  } catch {
    return DEFAULT_ERROR;
  }
}

const EMPTY_COMPANY: OrganizationInput = { name: "", ico: null, dic: null, legal_form: null, address: null, country: "CZ", source: "manual" };

function failureFor(status: number): Failure {
  if (status === 409) return { message: "This email already has an account. Log in instead.", login: true };
  if (status === 429) return { message: "Too many sign-ups from this network. Try again in an hour." };
  return { message: "We could not create the account. Please try again." };
}

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [account, setAccount] = useState<Account>({ name: "", email: "", password: "" });
  const [company, setCompany] = useState<OrganizationInput>(EMPTY_COMPANY);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Account) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccount({ ...account, [k]: e.target.value });
  };

  function fail(f: Failure): void {
    setFailure(f);
    setStep(f.step ?? "company");
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email.trim(), password: account.password, name: account.name.trim(), organization: company }),
      });
      if (res.status === 201) {
        // Stay busy while the router navigates, so the button cannot be pressed twice
        router.push("/onboarding");
        router.refresh();
        return;
      }
      fail(res.status === 400 ? await badRequest(res) : failureFor(res.status));
    } catch {
      fail({ message: "We could not reach the service. Please try again." });
    }
    setBusy(false);
  }

  const error = failure !== null && (
    <p role="alert" className="text-sm text-conflict">
      {failure.message}{" "}
      {failure.login === true && (
        <Link href="/login" className={LINK}>Log in</Link>
      )}
    </p>
  );

  if (step === "account") {
    return (
      <form
        className={`${CARD} flex flex-col gap-5`}
        aria-label="Your details"
        onSubmit={(e) => {
          e.preventDefault();
          setStep("company");
        }}
      >
        <div className="flex flex-col gap-1.5">
          <p className={KEY}>Step 1 of 2 · About you</p>
          <h2 className="text-lg font-semibold">Who is signing up?</h2>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Your name
          <input value={account.name} onChange={set("name")} autoFocus required maxLength={120} autoComplete="name" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Work email
          <input type="email" value={account.email} onChange={set("email")} required maxLength={254} autoComplete="email" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Password
          <input type="password" value={account.password} onChange={set("password")} required minLength={8} maxLength={200} autoComplete="new-password" aria-describedby="password-hint" className={FIELD} />
          <span id="password-hint" className="text-xs font-normal text-muted">At least 8 characters.</span>
        </label>
        {error}
        <button type="submit" className={`${BTN_PRIMARY} self-start`}>
          Continue to company
        </button>
        <p className="text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className={LINK}>Log in</Link>
        </p>
      </form>
    );
  }

  return (
    <form
      className={`${CARD} flex flex-col gap-5`}
      aria-label="Your company"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <p className={KEY}>Step 2 of 2 · Your company</p>
        <h2 className="text-lg font-semibold">Which company do you hire for?</h2>
        <p className="text-sm text-muted">Briefs are shared with everyone at the company, so the company is your team.</p>
      </div>
      <CompanyFields value={company} onChange={setCompany} />
      {error}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className={BTN_PRIMARY}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <button type="button" onClick={() => { setStep("account"); }} className={BTN_QUIET}>
          Back
        </button>
      </div>
    </form>
  );
}
