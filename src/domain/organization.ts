/**
 * Organization shapes: ARES subject payload, the draft built from it and the validated registration input.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/organization.ts
 * Deps:    zod, src/domain/ico
 * Tested:  src/domain/__tests__/organization.test.ts
 *
 * Key responsibilities:
 * - AresSubjekt: the subset of the ARES v3 economic-subject record we read
 * - organizationFromAres: map it to a CompanyDraft the registration form pre-fills
 * - OrganizationInput: normalises and validates the organization a recruiter registers
 *
 * Design constraints:
 * - Pure, no I/O; an "ares" organization must carry a checksum-valid IČO
 */
import { z } from "zod";
import { normalizeIco } from "@/domain/ico";

export const ARES_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

export const AresSubjekt = z.object({
  ico: z.string(),
  obchodniJmeno: z.string().optional(),
  dic: z.string().optional(),
  pravniForma: z.string().optional(),
  datumVzniku: z.string().optional(),
  sidlo: z
    .object({
      textovaAdresa: z.string().optional(),
      nazevObce: z.string().optional(),
      nazevUlice: z.string().optional(),
      cisloDomovni: z.union([z.string(), z.number()]).optional(),
      cisloOrientacni: z.union([z.string(), z.number()]).optional(),
      psc: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});
export type AresSubjekt = z.infer<typeof AresSubjekt>;

export const LEGAL_FORM_LABEL: Readonly<Record<string, string>> = {
  "101": "fyzická osoba podnikající",
  "112": "s.r.o.",
  "113": "v.o.s.",
  "114": "k.s.",
  "121": "a.s.",
  "141": "o.p.s.",
  "301": "státní podnik",
  "421": "odštěpný závod zahraniční PO",
  "701": "spolek",
};

export function legalFormLabel(code: string | null): string | null {
  if (code === null) return null;
  return LEGAL_FORM_LABEL[code] ?? code;
}

export type CompanyDraft = {
  name: string;
  ico: string;
  dic: string | null;
  legal_form: string | null;
  legal_form_label: string | null;
  address: string | null;
  country: "CZ";
};

function assembleAddress(sidlo: NonNullable<AresSubjekt["sidlo"]>): string | null {
  const text = sidlo.textovaAdresa?.trim() ?? "";
  if (text !== "") return text;
  const number = [sidlo.cisloDomovni, sidlo.cisloOrientacni]
    .filter((n) => n !== undefined && String(n) !== "")
    .map(String)
    .join("/");
  const street = [sidlo.nazevUlice, number].filter((p) => p !== undefined && p !== "").join(" ");
  const town = [sidlo.psc === undefined ? "" : String(sidlo.psc), sidlo.nazevObce ?? ""].filter((p) => p !== "").join(" ");
  const full = [street, town].filter((p) => p !== "").join(", ");
  return full === "" ? null : full;
}

export function organizationFromAres(s: AresSubjekt): CompanyDraft {
  const name = s.obchodniJmeno?.trim() ?? "";
  const legalForm = s.pravniForma ?? null;
  return {
    name: name === "" ? `IČO ${s.ico}` : name,
    ico: s.ico,
    dic: s.dic ?? null,
    legal_form: legalForm,
    legal_form_label: legalFormLabel(legalForm),
    address: s.sidlo === undefined ? null : assembleAddress(s.sidlo),
    country: "CZ",
  };
}

const Ico = z.string().transform((raw, ctx) => {
  const ico = normalizeIco(raw);
  if (ico === null) {
    ctx.addIssue({ code: "custom", message: "ico must be 8 digits with a valid checksum" });
    return z.NEVER;
  }
  return ico;
});

export const OrganizationInput = z
  .object({
    name: z.string().trim().min(2).max(200),
    ico: Ico.nullable().default(null),
    dic: z.string().trim().max(20).nullable().default(null),
    legal_form: z.string().trim().max(10).nullable().default(null),
    address: z.string().trim().max(300).nullable().default(null),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((c) => c.toUpperCase())
      .default("CZ"),
    source: z.enum(["ares", "manual"]),
  })
  .superRefine((o, ctx) => {
    if (o.source === "ares" && o.ico === null) ctx.addIssue({ code: "custom", message: "an ARES company needs an ico" });
  });
export type OrganizationInput = z.infer<typeof OrganizationInput>;
