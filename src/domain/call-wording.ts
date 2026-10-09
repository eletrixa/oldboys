/**
 * Spoken wording for proposed call questions: research text about the candidate turned into short second-person English.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-wording.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/call-wording.test.ts
 *
 * Key responsibilities:
 * - mustHaveQuestion: a must-have without (or with partial) evidence as a question to the candidate; a third-person
 *   question ("Does the candidate have …?") becomes "Do you have …?", anything else uses the title template
 * - toVerifyQuestion: a "to verify" claim as "We read that <first clause>. Is that right?", the subject's name as "you"
 * - subjectRefs: the names that mean the candidate ("the candidate", full name, first name, without diacritics too)
 *
 * Design constraints:
 * - Pure and deterministic: small tested rule sets, no LLM
 * - A rewrite happens only when it is clean; otherwise the text is kept and only the template wraps it
 */

const VERBS: Record<string, string> = {
  does: "Do",
  has: "Have",
  is: "Are",
  was: "Were",
  can: "Can",
  did: "Did",
  will: "Will",
  would: "Would",
  could: "Could",
};

const THIRD_PERSON = /\b(he|she|they|him|her|them|hers|theirs|himself|herself|themselves)\b/i;
const MAX_CLAUSE = 120;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function plain(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Names that refer to the candidate, longest first: "the candidate", the full name and the first name (and their ASCII forms). */
export function subjectRefs(subject: string): string[] {
  const full = subject.replace(/\s+/g, " ").trim();
  const words = full.split(" ");
  const first = words.length >= 2 && (words[0]?.length ?? 0) >= 2 ? (words[0] ?? "") : "";
  const names = full === "" || full.toLowerCase() === "the candidate" ? [] : [full, first];
  const all = ["the candidate", ...names, ...names.map(plain)].filter((n) => n !== "");
  return [...new Set(all)].sort((a, b) => b.length - a.length);
}

/** One regex source for the refs: names are case-sensitive ("Mark" the name, never "mark" the verb), whole words only. */
function refPattern(refs: readonly string[]): string {
  if (refs.length === 0) return "(?!)";
  const alts = refs.map((r) => (r === "the candidate" ? "[Tt]he candidate" : escape(r)));
  return `(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{N}])`;
}

/**
 * Lower-case the first letter of a sentence-case label ("Prior cleaning experience"); a single word, an acronym or a
 * two-letter lead ("Kubernetes", "UX case studies", "Go backend") is more likely a name and keeps its case.
 */
function lowerFirst(label: string): string {
  return /^\p{Lu}\p{Ll}{2,}\s/u.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** Question text without the evidence list the must-have mapper appends (" (repo, talk)"); null when it was cut ("…"). */
function bareText(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.endsWith("…")) return null;
  return t.replace(/\s*\([^()]*\)$/, "").trim();
}

/** "Does the candidate have X?" → "Do you have X?"; null when the text is not such a question or a third person is left. */
export function secondPerson(question: string, refs: readonly string[]): string | null {
  const ref = refPattern(refs);
  const m = new RegExp(`^(\\p{L}+) ${ref}`, "u").exec(question);
  const verb = m === null ? undefined : VERBS[(m[1] ?? "").toLowerCase()];
  if (m === null || verb === undefined || !question.endsWith("?")) return null;
  const rest = question
    .slice(m[0].length)
    .replace(new RegExp(`${ref}'s(?![\\p{L}\\p{N}])`, "gu"), "your")
    .replace(/\b(their|his)\b/gi, "your");
  if (new RegExp(ref, "u").test(rest) || THIRD_PERSON.test(rest)) return null;
  return `${verb} you${rest}`;
}

/** The must-have question for the candidate; `title` is the short label (may be absent), `text` the question as stored. */
export function mustHaveQuestion(input: { title?: string | undefined; text: string; coverage: "none" | "partial"; refs: readonly string[] }): string {
  const bare = bareText(input.text);
  const converted = bare === null ? null : secondPerson(bare, input.refs);
  if (converted !== null) return converted;
  const title = input.title?.trim() ?? "";
  if (title === "") return statementQuestion(bare ?? input.text);
  const label = lowerFirst(title.replace(/[.?!…]+$/, "").trim());
  return input.coverage === "none" ? `Can you tell me about your ${label}?` : `Can you tell me a bit more about your ${label}?`;
}

/** An untitled must-have statement: "Has held a X position" → "Have you held a X position?", else asked as a point. */
function statementQuestion(text: string): string {
  const t = text.replace(/[.?!…]+$/, "").trim();
  const m = /^(has|is|was)\s+(.+)$/i.exec(t);
  if (m !== null && !THIRD_PERSON.test(m[2] ?? "")) return `${VERBS[(m[1] ?? "").toLowerCase()] ?? ""} you ${m[2] ?? ""}?`;
  return `Can you tell me about this point: ${lowerFirst(t)}?`;
}

/** Cut at the first clause boundary: ";", a dash, or a comma before a hedge ("…, consistent with …"). */
function firstClause(text: string): string {
  const m = /\s*(?:;|\s[—–-]\s|,\s+(?:consistent with|suggesting|indicating|implying|which|meaning|likely|possibly|probably|though|although|but|so)\b)/i.exec(text);
  return m !== null && m.index > 0 ? text.slice(0, m.index).trim() : text;
}

const BE: Record<string, string> = { is: "are", was: "were", has: "have", does: "do" };
/** Words ending in "s" that are not a present-tense verb after a name ("lists Jane as a co-founder"). */
const NOT_VERB = new Set(["as", "its", "his", "this", "thus", "plus", "across", "us", "versus", "whereas", "towards", "besides"]);

/** Every mention of the candidate as "you" / "your"; null when one is a present-tense subject ("Jane works …"). */
function asYou(text: string, refs: readonly string[]): string | null {
  const mention = new RegExp(`${refPattern(refs)}('s)?(\\s+(\\p{L}+))?`, "gu");
  const unclean: string[] = [];
  const out = text.replace(mention, (_all, poss: string | undefined, gap: string | undefined, next: string | undefined) => {
    if (poss !== undefined) return `your${gap ?? ""}`;
    const word = (next ?? "").toLowerCase();
    const be = BE[word];
    if (be !== undefined) return `you ${be}`;
    if (/[^s]s$/.test(word) && !NOT_VERB.has(word)) unclean.push(word);
    return `you${gap ?? ""}`;
  });
  return unclean.length === 0 ? out : null;
}

const LOWER_LEAD = /^(a|an|the|this|that|these|those|in|on|at|from|since|during|for|according|one|two|three|several|some|many|his|her|their)\b/i;
const PAST_LEAD = /^(\p{L}+ed|led|held|built|ran|wrote|spoke|gave|taught|won|made|took|became|began|left|sold|grew|founded|co-founded|has|had|is|was)\b/iu;

/** "We read that <first clause>. Is that right?"; a text that cannot be cut cleanly is kept whole. */
export function toVerifyQuestion(text: string, refs: readonly string[]): string {
  const whole = text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  const clause = firstClause(whole);
  const short = clause.length <= MAX_CLAUSE && !/[.?!]\s+\p{Lu}/u.test(clause);
  if (!short) {
    const kept = asYou(whole, refs) ?? whole;
    return `${kept.charAt(0).toUpperCase()}${kept.slice(1)}. Is that right?`;
  }
  const spoken = asYou(clause, refs) ?? clause;
  if (/^you\b/i.test(spoken)) return `We read that you${spoken.slice(3)}. Is that right?`;
  const lead = /^(\p{L}[\p{L}-]*)/u.exec(spoken)?.[1] ?? "";
  if (PAST_LEAD.test(lead)) {
    const verb = BE[lead.toLowerCase()] ?? lead.toLowerCase();
    return `We read that you ${verb}${spoken.slice(lead.length)}. Is that right?`;
  }
  const body = LOWER_LEAD.test(lead) ? spoken.charAt(0).toLowerCase() + spoken.slice(1) : spoken;
  return `We read that ${body}. Is that right?`;
}
