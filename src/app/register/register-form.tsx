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
import { FIELD } from "../start-form";
import { CompanyFields } from "./company-fields";

type Step = "account" | "company" | "submitting";
type Account = { name: string; email: string; password: string };
type Failure = { message: string; login: boolean };

const EMPTY_COMPANY: OrganizationInput = { name: "", ico: null, dic: null, legal_form: null, address: null, country: "CZ", source: "manual" };

function failureFor(status: number): Failure {
  if (status === 409) return { message: "This email already has an account. Log in instead.", login: true };
  if (status === 429) return { message: "Too many sign-ups from this network. Try again in an hour.", login: false };
  if (status === 400) return { message: "Please check the company details.", login: false };
  return { message: "We could not create the account. Please try again.", login: false };
}

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [account, setAccount] = useState<Account>({ name: "", email: "", password: "" });
  const [company, setCompany] = useState<OrganizationInput>(EMPTY_COMPANY);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submit(): Promise<void> {
    setStep("submitting");
    setFailure(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email.trim(), password: account.password, name: account.name.trim(), organization: company }),
      });
      if (res.status === 201) {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      setFailure(failureFor(res.status));
    } catch {
      setFailure({ message: "We could not reach the service. Please try again.", login: false });
    }
    setStep("company");
  }

  const error = failure !== null && (
    <p role="alert" className="text-sm text-red-300">
      {failure.message}{" "}
      {failure.login && (
        <Link href="/login" className="text-teal-300 underline-offset-2 hover:underline">Log in</Link>
      )}
    </p>
  );

  if (step === "account") {
    return (
      <form
        className="flex flex-col gap-5"
        aria-label="Your details"
        onSubmit={(e) => {
          e.preventDefault();
          setStep("company");
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Your name
          <input value={account.name} onChange={(e) => { setAccount({ ...account, name: e.target.value }); }} required maxLength={120} autoComplete="name" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Work email
          <input type="email" value={account.email} onChange={(e) => { setAccount({ ...account, email: e.target.value }); }} required maxLength={254} autoComplete="email" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input type="password" value={account.password} onChange={(e) => { setAccount({ ...account, password: e.target.value }); }} required minLength={8} maxLength={200} autoComplete="new-password" className={FIELD} />
          <span className="text-xs font-normal text-zinc-400">At least 8 characters.</span>
        </label>
        {error}
        <button type="submit" className="self-start rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-teal-400">
          Next
        </button>
        <p className="text-sm text-zinc-400">
          Already registered?{" "}
          <Link href="/login" className="text-teal-300 underline-offset-2 hover:underline">Log in</Link>
        </p>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      aria-label="Your company"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <CompanyFields value={company} onChange={setCompany} />
      {error}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={step === "submitting"}
          className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-60"
        >
          {step === "submitting" ? "Creating..." : "Create account"}
        </button>
        <button type="button" onClick={() => { setStep("account"); }} className="text-sm text-zinc-400 hover:text-zinc-200">
          Back
        </button>
      </div>
    </form>
  );
}
