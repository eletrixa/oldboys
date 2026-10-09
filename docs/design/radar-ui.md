# Radar UI: how every page is built

Binding visual spec for `src/app`. Tokens and fonts live in `src/app/globals.css`; shared class vocabulary in `src/app/ui.tsx`. The design kit itself (Radar Brand System V2, Visual Guideline) was applied to the shell and home page in commit b3c519c; this document extends it to every surface.

## Direction

An editorial dossier on warm paper. The product prepares evidence for a person to read, so the pages read like a well-set brief, not a dashboard: serif display headings, generous measure, hairline dividers for lists, white cards only for the few primary objects, one rust action per view.

## Tokens (semantic names only)

| Use | Class |
|---|---|
| Page background | `bg-canvas` (#faf7f2) |
| Card / input surface | `bg-surface` (#fff) |
| UI fragment surface (a piece of real UI shown as illustration or a channel list) | `bg-paper` (#fffefb) |
| Body text | `text-ink` (#282d2b) |
| Secondary text | `text-muted` (#59635d, AA on canvas) |
| Primary action | `bg-action text-white hover:bg-action-hover` |
| Links | `text-action underline underline-offset-4` |
| Tint surfaces | `bg-peach/40 border-peach` (asks, warmth), `bg-sage/50 border-sage` (notes, privacy) |
| Hairlines | `border-divider`; stronger: `border-line/60` |
| Focus | `:focus-visible` ring is global; never remove it |
| Supported / confirmed | `bg-ok-bg text-ok` |
| Unverified / partial / not sure | `bg-unsure-bg text-unsure` |
| Conflict / failed | `bg-conflict-bg text-conflict` |
| Inference | `bg-inference-bg text-inference` |

Never write `zinc-*`, `teal-*`, `amber-*`, `red-*`, `emerald-*`, `violet-*` in a component. Those scales are a temporary remap and are removed when the migration ends. Never write a hex value in TSX.

## Type

- Display `h1`: `font-serif text-4xl md:text-5xl leading-[1.05]` (the base layer sets serif on h1/h2; h1 is weight 500 with `-0.02em` tracking, h2 weight 600, since landing v9).
- Section `h2`: `font-serif text-2xl`.
- Card title `h3`: `font-sans text-base font-semibold`.
- Eyebrow above a display heading: `<Eyebrow>` (xs, uppercase, tracked, rust).
- Body `text-base` or `text-sm`, muted for secondary lines. Numbers `tabular-nums`.
- Measure: prose blocks `max-w-[62ch]`.

## Layout rhythm

- Page width: run page while running and audit page `max-w-3xl`, finished brief `max-w-6xl`, roles `max-w-5xl`, home as is. Gutter `px-4`, vertical `py-10 md:py-14`.
- Page header block: eyebrow, h1, one muted sentence, then a meta line (`text-sm text-muted`). Gap `gap-3`. A `border-b border-divider pb-8` closes the header.
- Between major blocks `gap-8`; inside a card `gap-3`.
- Lists of homogeneous rows (profiles, evidence, roles, sources) use hairline dividers (`divide-y divide-divider`), not nested cards.
- Cards (`CARD` from ui.tsx) only for: the question card, the 30-second summary, brief sections, the start form, audit sections. Everything else sits on the canvas.
- Sets of equal items (steps, trust tiles, the validation lists, the wizard steps) are `TILE`s: an ink rule on top, no box, no shadow, in a grid at `md`. A fragment of real UI inside a tile or beside a photo is `FRAG` with a `KEY` label above it (landing v9 idiom).
- Depth: one soft shadow on cards, no borders on buttons inside cards except secondary buttons.

## Components (ui.tsx)

`CARD`, `CARD_PEACH`, `CARD_SAGE`, `TILE`, `FRAG`, `KEY`, `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_QUIET`, `FIELD`, `LINK`, `<Eyebrow>`, `<Pill tone>`, `<SourceLink url>`. Use them; extend ui.tsx rather than inventing a parallel class string.

## Per-surface composition

### Run page (`/runs/[id]`)
While running, paused or failed (one column, `max-w-3xl`):
1. Header: eyebrow "Research in progress", serif h1 with the existing `headerText`, headline muted, meta line = cost line, CACHED pill when cached.
2. Progress: a vertical timeline. Left rail of 20px marks joined by a 1px line; done = ok-green filled check, active = rust ring with a slow pulse (respect reduced motion), todo = divider ring, failed = conflict, skipped = muted dash. A slim `h-1.5` bar above it keeps the percent. Labels `text-sm`, muted for todo.
3. Question card: `CARD_PEACH`, serif h2, the profile row, buttons: primary "Yes, it's them", secondary "No", quiet "I'm not sure".
4. Identity map card on the canvas (no card chrome) with a sans h3; SVG colours via `fill-ok`, `stroke-unsure`, `fill-divider` etc.
5. Profiles list: h3 + hairline rows, platform mark = 36px circle `bg-sage` with ink initials, decision `<Pill>`.
6. Failure = `CARD` with `border-conflict bg-conflict-bg`.

Finished brief (`brief-page.tsx`, `max-w-6xl`, root `id="brief"` with the report `lang`):
1. Header: `<Eyebrow>` "Candidate brief · <role>" (role links the position), h1 = full name, headline muted, pills (identity ok, phone screen done ok, CACHED), the EN | CZ switch top right; below, five equal steps in the `TILE` idiom (2px rule: ok = done, ink = next, divider = later): Research, Identity, Phone screen, Interview, Decision ("Made by a person"). Only state the run proves is marked done.
2. Grid at `lg`: main column + 300px sidebar (`lg:sticky lg:top-6`). Below `lg` the sidebar follows the content and a fixed bottom bar (`lg:hidden`) holds "Copy interview kit" (primary) and "Calendar"; the main element has `pb-28 lg:pb-14` so the bar never covers content.
3. "In 30 seconds": `CARD` with the 4px rust left border, three columns divided by hairlines at `md` (`KEY` label, serif `text-4xl` number, a short dot list, a `LINK` that opens a tab); the sentences sit under an "In sentences" disclosure and are what Read aloud reads.
4. "Before the interview (n)": serif h2 + `CARD_FLUSH` with hairline rows, only items that need action; public source vs phone answer as two `FRAG`s with a neutral "Compare" pill (never an automatic conflict); `conflict` tone only for research-vs-research contradictions; each row links to its plan question (scroll + one flash inside `prefers-reduced-motion: no-preference`).
5. Tabs: WAI-ARIA tablist, sticky on top of the main column, rust underline on the selected tab, count badge per tab (`unsure` on Phone screen when answers are open), hash `#plan|#evidence|#call|#sources`. Inactive panels are `tab-inactive hidden`; the print rule shows every panel and hides the bar.
   - Interview plan: one numbered list (serif rust numbers, hairline rows) in groups Role criteria / To verify / Interview questions; topic `<Pill>`, muted "Why:" line, the question, a canvas "Phone" row (answer badge, summary, quote + "at m:ss" + "Said by the candidate. Not public evidence."), a "Covered" checkbox (React state only); the filled-kit review closes the panel.
   - Evidence: TopLine, scorecard, role criteria table in `CARD_FLUSH` (third column from `md`), career timeline `CARD` (label column + bar on a year axis; ink bar, ok for an open end), ProfileSections, findings as compact disclosure rows in one `CARD_FLUSH` (title, one-line summary, confidence pill, claim count; short quotes inline), code profile, registries.
   - Phone screen: the call panel, results first, setup folded under "Call again · N of M calls left" after a finished call.
   - Sources and gaps: confirmed profiles (hairline rows), "How we confirmed it is X" disclosure (progress, identity map, lineup), gaps grouped by reason in plain words as neutral pills (raw reason in `title`), Also found, removed line, profile signals.
6. Sidebar: `CARD` "Interview kit" (`BTN_PRIMARY` copy = the page's one rust action, `BTN_SECONDARY` calendar disclosure, "More exports"), `CARD` "About this research" (`dl`, Audit record link), the delete disclosure in a conflict hairline box ("Do this when the candidate is rejected."), `CARD_SAGE` "Radar prepares evidence and never scores people. A person makes every decision.", "All briefs" link.

### Start form (home card)
Fields with `FIELD`; labels `text-sm font-semibold`; helper `text-xs text-muted`; CV in a `details` with a hairline; privacy note in `CARD_SAGE`; submit `BTN_PRIMARY` with the "6 to 12 minutes" note beside it; error in `text-conflict`.

### Roles (`/roles`, `/roles/[key]`)
Header per the rhythm. Token form as the start form. Role list = hairline rows with serif role name and muted count. Role table: `CARD` wrapper, th uppercase xs tracked muted, coverage cells = a 8px dot + label (ok / unsure / muted / muted italic), person link `LINK`.

### Audit (`/runs/[id]/audit`)
Header per the rhythm with the download as `BTN_SECONDARY`. Sections = `CARD`; `dl` rows with a muted 8rem label column; source status `<Pill>`; MOCK `<Pill tone="unsure">`.

### Not found / loading
A short serif h1, a sentence, a `LINK` back. Loading = the page header skeleton (two muted bars with `animate-pulse`).

## Copy
Plain words, second person, no jargon, no scores. Coverage describes the research, not the person.

## Review rubric (4 of 5 to ship)

Score each page 1–5 on: hierarchy, rhythm, depth, typography, semantic colour, interaction states, honesty (no score, evidence states clear), accessibility (contrast, focus, 390px no overflow). A page ships at an average of 4.0 or higher with no criterion under 3.
