/**
 * "After the interview": parse the filled interview kit back and list which points are still open (idea #23).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-review.ts
 * Deps:    none
 * Tested:  src/app/runs/[id]/__tests__/kit-review.test.ts
 *
 * Key responsibilities:
 * - parseFilledKit: the "Questions for the interview" and "To verify" checklists of a kit written by interviewKit,
 *   with each box's state and whether its Notes line (same line or the indented lines below) has text
 * - reviewSummary: answered / verified counts and the open points (unanswered questions, then unverified checks)
 * - openPointsText: plain-text list of the open points for copying (second round, reference check)
 *
 * Design constraints:
 * - Pure; tolerant of [x] / [X], "-" or "*" bullets, CRLF and blank lines; returned texts are Markdown-unescaped
 * - A question counts as answered when ticked OR its notes have text; the notes' content is never kept, read,
 *   scored or summarised (the tool rates the research, never the candidate)
 */

export type KitReview = {
  questions: { text: string; done: boolean; hasNotes: boolean }[];
  checks: { text: string; done: boolean }[];
};

export type KitSummary = { answered: number; questions: number; verified: number; checks: number; open: string[] };

/** Section headings exactly as interviewKit writes them. */
const QUESTIONS = "questions for the interview";
const CHECKS = "to verify";

const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
/** A checklist item at the top level (indent under 2), "- [ ] text" or "* [x] text". */
const ITEM = /^ ?[-*+]\s+\[([ xX])\]\s*(.*)$/;
/** Any top-level bullet, checked or not: it ends the notes of the previous question. */
const BULLET = /^ ?[-*+]\s/;
const NOTES = /^\s*Notes:\s*(.*)$/i;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Undoes escapeMd: a backslash before one of \`*_[]<>#| is dropped. */
function unescapeMd(text: string): string {
  return text.replace(/\\([\\`*_[\]<>#|])/g, "$1").trim();
}

export function parseFilledKit(markdown: string): KitReview {
  const review: KitReview = { questions: [], checks: [] };
  let section: "questions" | "checks" | null = null;
  // Index of the question whose notes we are in, or null outside notes.
  let notesOf: number | null = null;
  for (const line of markdown.split(/\r?\n|\r/)) {
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const title = (heading[1] ?? "").toLowerCase();
      section = title === QUESTIONS ? "questions" : title === CHECKS ? "checks" : null;
      notesOf = null;
      continue;
    }
    if (RULE.test(line)) {
      section = null;
      notesOf = null;
      continue;
    }
    if (section === null) continue;
    const item = ITEM.exec(line);
    if (item !== null) {
      const text = unescapeMd(item[2] ?? "");
      const done = item[1] !== " ";
      if (section === "questions") {
        review.questions.push({ text, done, hasNotes: false });
        notesOf = null;
      } else review.checks.push({ text, done });
      continue;
    }
    if (BULLET.test(line)) {
      notesOf = null;
      continue;
    }
    if (section !== "questions") continue;
    const current = review.questions.at(-1);
    if (current === undefined) continue;
    const notes = NOTES.exec(line);
    if (notes !== null) {
      notesOf = review.questions.length - 1;
      if ((notes[1] ?? "").trim() !== "") current.hasNotes = true;
      continue;
    }
    if (notesOf !== null && line.trim() !== "") current.hasNotes = true;
  }
  return review;
}

export function reviewSummary(review: KitReview): KitSummary {
  const openQuestions = review.questions.filter((q) => !q.done && !q.hasNotes).map((q) => q.text);
  const openChecks = review.checks.filter((c) => !c.done).map((c) => c.text);
  return {
    answered: review.questions.length - openQuestions.length,
    questions: review.questions.length,
    verified: review.checks.length - openChecks.length,
    checks: review.checks.length,
    open: [...openQuestions, ...openChecks],
  };
}

/** True when the text held at least one kit checklist item. */
export function isKit(review: KitReview): boolean {
  return review.questions.length + review.checks.length > 0;
}

export function openPointsText(review: KitReview): string {
  const { open } = reviewSummary(review);
  if (open.length === 0) return "Every point from the kit was covered in the interview.";
  return ["Still open after the interview:", ...open.map((t, i) => `${String(i + 1)}. ${t}`)].join("\n");
}
