/**
 * Profile picker (plans/011): one field that takes a LinkedIn URL or a name; a name offers public profiles to pick from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/profile-picker.tsx
 * Deps:    react, GET /api/profiles/suggest, src/domain/profile-suggest (types), ./ui (Radar tokens)
 * Tested:  n/a (parser and handler are tested; this is the view)
 *
 * Key responsibilities:
 * - A pasted linkedin.com/in/ URL is used as is; otherwise "Find profiles" (button or Enter) calls the suggest route once
 * - Listbox of up to 8 rows (name, headline, handle), arrow keys and Enter, click to pick; the pick collapses into a card with "Change"
 * - The hidden `profileUrl` input is what the form submits, so start-form.tsx stays unchanged; `onUrl` reports it to the New brief rows
 * - 503, 429 and failures degrade to calm copy; the typed URL path keeps working without the provider
 *
 * Design constraints:
 * - Explicit trigger, never on keystroke (each lookup is paid and capped); one in-flight request, the latest wins
 * - Copy says "via web search, pick the one you mean": suggestions are candidates, never identity
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Suggestion } from "@/domain/profile-suggest";
import { BTN_SECONDARY, CARD_SAGE, FIELD, LINK } from "./ui";

type Lookup =
  | { kind: "idle" }
  | { kind: "short" }
  | { kind: "looking" }
  | { kind: "list"; items: Suggestion[] }
  | { kind: "empty" }
  | { kind: "unavailable" }
  | { kind: "limited" }
  | { kind: "expired" };

const MESSAGE: Readonly<Partial<Record<Lookup["kind"], string>>> = {
  short: "Type at least three letters of their name, or paste the profile link.",
  empty: "No public profiles found for that name. Add a company or city, or paste the link.",
  unavailable: "Profile search is not available right now. Please paste the link.",
  limited: "Too many searches just now. Please paste the link or try again later.",
  expired: "Your session has ended. Please log in again, or paste the link.",
};

const STATUS_KIND: Record<number, Exclude<Lookup["kind"], "list" | "looking" | "idle">> = { 400: "short", 401: "expired", 429: "limited" };

const isProfileUrl = (text: string): boolean => /linkedin\.com\/in\//i.test(text);
const handleOf = (url: string): string => url.replace(/^https:\/\/www\./, "");

/** `onUrl` reports the chosen or pasted profile URL ("" when none) for pages that are not a plain form submit. */
type Props = { invalid?: boolean; onUrl?: (url: string) => void };

export function ProfilePicker({ invalid = false, onUrl }: Props): React.JSX.Element {
  const id = useId();
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [chosen, setChosen] = useState<Suggestion | null>(null);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  const url = isProfileUrl(text) ? text.trim() : (chosen?.url ?? "");
  const items = lookup.kind === "list" ? lookup.items : [];

  useEffect(() => {
    onUrl?.(url);
  }, [url, onUrl]);

  async function find(): Promise<void> {
    const q = text.trim();
    if (q.length < 3) {
      setLookup({ kind: "short" });
      return;
    }
    const mine = ++seq.current;
    setLookup({ kind: "looking" });
    setActive(0);
    try {
      const params = new URLSearchParams({ q, hint: hint.trim() });
      const res = await fetch(`/api/profiles/suggest?${params.toString()}`, { cache: "no-store" });
      if (mine !== seq.current) return;
      if (res.status === 200) {
        const { suggestions } = await res.json<{ suggestions: Suggestion[] }>();
        setLookup(suggestions.length === 0 ? { kind: "empty" } : { kind: "list", items: suggestions });
        return;
      }
      setLookup({ kind: STATUS_KIND[res.status] ?? "unavailable" });
    } catch {
      if (mine === seq.current) setLookup({ kind: "unavailable" });
    }
  }

  function pick(s: Suggestion): void {
    setChosen(s);
    setLookup({ kind: "idle" });
  }

  function change(): void {
    setChosen(null);
    setLookup({ kind: "idle" });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      const current = items[active] ?? items[0];
      if (current !== undefined) pick(current);
      else if (!isProfileUrl(text)) void find();
      return;
    }
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Escape") {
      setLookup({ kind: "idle" });
    }
  }

  const message = MESSAGE[lookup.kind];
  const listId = `${id}-list`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-q`} className="text-sm font-semibold">Candidate&apos;s LinkedIn profile or name</label>
      <input type="hidden" name="profileUrl" value={url} />
      {chosen !== null && !isProfileUrl(text) ? (
        <div className={`${CARD_SAGE} flex flex-col gap-1 text-sm`} aria-live="polite">
          <span className="font-semibold">{chosen.name}</span>
          {chosen.headline !== "" && <span className="text-muted">{chosen.headline}</span>}
          <span className="text-xs text-muted">{handleOf(chosen.url)}</span>
          <button type="button" onClick={change} className={`${LINK} self-start text-sm`}>Change</button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${id}-q`}
              name="profileQuery"
              type="text"
              inputMode="url"
              maxLength={500}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (lookup.kind !== "idle") setLookup({ kind: "idle" });
              }}
              onKeyDown={onKey}
              placeholder="Jan Novák, or https://www.linkedin.com/in/..."
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items.length > 0 ? `${listId}-${String(active)}` : undefined}
              aria-describedby={`${id}-help`}
              aria-invalid={invalid || undefined}
              autoComplete="off"
              className={FIELD}
            />
            {!isProfileUrl(text) && (
              <button type="button" onClick={() => void find()} disabled={lookup.kind === "looking"} className={BTN_SECONDARY}>
                {lookup.kind === "looking" ? "Looking..." : "Find profiles"}
              </button>
            )}
          </div>
          {!isProfileUrl(text) && (
            <input
              type="text"
              name="profileHint"
              value={hint}
              onChange={(e) => { setHint(e.target.value); }}
              maxLength={100}
              placeholder="Company or city (optional, narrows the search)"
              aria-label="Company or city to narrow the search"
              autoComplete="off"
              className={`${FIELD} text-sm`}
            />
          )}
          {items.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Public profiles found via web search" className="flex flex-col divide-y divide-divider rounded-lg border border-line bg-surface">
              {items.map((s, i) => (
                <li
                  key={s.url}
                  id={`${listId}-${String(i)}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => { setActive(i); }}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  className={`flex min-h-11 cursor-pointer flex-col gap-0.5 px-4 py-2 ${i === active ? "bg-sage/60" : ""}`}
                >
                  <span className="font-semibold">{s.name}</span>
                  {s.headline !== "" && <span className="text-sm text-muted">{s.headline}</span>}
                  <span className="text-xs text-muted">{handleOf(s.url)}</span>
                </li>
              ))}
              <li className="px-4 py-2 text-xs text-muted">Found via web search. Pick the one you mean; the brief still checks namesakes.</li>
            </ul>
          )}
        </>
      )}
      {message !== undefined && <span role="status" className="text-sm text-muted">{message}</span>}
      <span id={`${id}-help`} className="text-xs text-muted">
        We read their name, location and employer from the profile and treat it as the confirmed identity.
      </span>
    </div>
  );
}
