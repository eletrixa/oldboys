/**
 * Company fields: IČO lookup in ARES with every field editable, or a manual foreign company.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/register/company-fields.tsx
 * Deps:    react, GET /api/ares/:ico, src/domain/organization (types)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Look up an IČO, fill name, DIČ, legal form and address, mark source ares; fall back to manual entry
 *
 * Design constraints:
 * - Client component, controlled by its parent; ARES failures never block sign-up; typing over a looked-up field keeps source ares only while the IČO is kept
 */
"use client";

import { useState } from "react";
import { normalizeIco } from "@/domain/ico";
import type { CompanyDraft, OrganizationInput } from "@/domain/organization";
import { FIELD } from "../start-form";

type Lookup =
  | { kind: "idle" }
  | { kind: "invalid" }
  | { kind: "looking" }
  | { kind: "found"; legalFormLabel: string | null }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "limited" };

const LOOKUP_MESSAGE: Readonly<Partial<Record<Lookup["kind"], string>>> = {
  invalid: "An IČO has 8 digits.",
  not_found: "No company with this IČO. Check it or type the details.",
  unavailable: "The company register is not answering, please type the details.",
  limited: "Too many lookups just now. Please type the details or try again later.",
};

const STATUS_KIND: Record<number, Exclude<Lookup["kind"], "found">> = { 400: "invalid", 404: "not_found", 429: "limited" };

const orNull = (s: string): string | null => (s === "" ? null : s);

type Props = { value: OrganizationInput; onChange: (next: OrganizationInput) => void };

export function CompanyFields({ value, onChange }: Props): React.JSX.Element {
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [foreign, setForeign] = useState(false);
  const [icoText, setIcoText] = useState(value.ico ?? "");

  function patch(next: Partial<OrganizationInput>): void {
    onChange({ ...value, ...next });
  }

  async function look(): Promise<void> {
    const digits = icoText.replace(/\D/g, "");
    if (digits === "" || digits.length > 8) {
      setLookup({ kind: "invalid" });
      return;
    }
    setLookup({ kind: "looking" });
    try {
      const res = await fetch(`/api/ares/${digits}`, { cache: "no-store" });
      if (res.status === 200) {
        const { company } = await res.json<{ company: CompanyDraft }>();
        onChange({
          name: company.name,
          ico: company.ico,
          dic: company.dic,
          legal_form: company.legal_form,
          address: company.address,
          country: company.country,
          source: "ares",
        });
        setIcoText(company.ico);
        setLookup({ kind: "found", legalFormLabel: company.legal_form_label });
        return;
      }
      setLookup({ kind: STATUS_KIND[res.status] ?? "unavailable" });
    } catch {
      setLookup({ kind: "unavailable" });
    }
  }

  function toggleForeign(on: boolean): void {
    setForeign(on);
    setLookup({ kind: "idle" });
    setIcoText("");
    onChange({ ...value, ico: null, source: "manual", country: on ? "" : "CZ" });
  }

  function typeIco(text: string): void {
    setIcoText(text);
    patch({ ico: normalizeIco(text), source: "manual" });
  }

  const message = LOOKUP_MESSAGE[lookup.kind];
  const icoInvalid = icoText.trim() !== "" && normalizeIco(icoText) === null;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={foreign} onChange={(e) => { toggleForeign(e.target.checked); }} />
        Company outside the Czech Republic (no IČO)
      </label>
      {foreign ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Country (2 letters)
          <input
            value={value.country}
            onChange={(e) => { patch({ country: e.target.value.toUpperCase() }); }}
            required
            minLength={2}
            maxLength={2}
            autoComplete="country"
            className={`${FIELD} w-24`}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ico" className="text-sm font-medium">IČO</label>
          <div className="flex gap-2">
            <input
              id="ico"
              value={icoText}
              onChange={(e) => { typeIco(e.target.value); }}
              inputMode="numeric"
              maxLength={8}
              placeholder="27074358"
              className={FIELD}
            />
            <button
              type="button"
              disabled={lookup.kind === "looking"}
              onClick={() => void look()}
              className="shrink-0 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium hover:bg-zinc-900 disabled:opacity-60"
            >
              {lookup.kind === "looking" ? "Looking..." : "Look up in ARES"}
            </button>
          </div>
          <a
            href="https://ares.gov.cz/ekonomicke-subjekty"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 underline-offset-2 hover:underline"
          >
            Find your IČO
          </a>
          {icoInvalid && lookup.kind === "idle" && (
            <p className="text-sm text-amber-300">An IČO has 8 digits with a valid check digit; leave it empty if you do not know it.</p>
          )}
          {message !== undefined && (
            <p role="alert" className="text-sm text-amber-300">{message}</p>
          )}
          {lookup.kind === "found" && <p role="status" className="text-sm text-teal-300">Found in the company register. Check the details below.</p>}
        </div>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Company name
        <input value={value.name} onChange={(e) => { patch({ name: e.target.value }); }} required minLength={2} maxLength={200} autoComplete="organization" className={FIELD} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          DIČ (optional)
          <input value={value.dic ?? ""} onChange={(e) => { patch({ dic: orNull(e.target.value) }); }} maxLength={20} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Legal form (optional)
          <input value={value.legal_form ?? ""} onChange={(e) => { patch({ legal_form: orNull(e.target.value) }); }} maxLength={10} className={FIELD} />
          {lookup.kind === "found" && lookup.legalFormLabel !== null && (
            <span className="text-xs font-normal text-zinc-400">{lookup.legalFormLabel}</span>
          )}
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Address (optional)
        <input value={value.address ?? ""} onChange={(e) => { patch({ address: orNull(e.target.value) }); }} maxLength={300} autoComplete="street-address" className={FIELD} />
      </label>
    </div>
  );
}
