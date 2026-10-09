/**
 * Role picker: a searchable combobox over the preselected role catalog; free text stays allowed.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/role-picker.tsx
 * Deps:    react, ./ui (FIELD), src/domain/role-catalog (filterRoleOptions, RoleOption)
 * Tested:  e2e/roles.spec.ts (browser); ranking in src/domain/__tests__/role-catalog.test.ts
 *
 * Key responsibilities:
 * - One text input `name="role"` (the form reads it as before) with a listbox of matching roles under it
 * - Type to filter by title, alias (EN/CZ) or family; click, or arrow keys + Enter, puts the title in the input
 * - Escape or blur closes the list; a value that matches nothing is kept as a custom role
 *
 * Design constraints:
 * - Client component; the server page passes `options` (title, family, aliases only)
 * - WAI-ARIA combobox pattern (role, aria-expanded, aria-activedescendant); no library
 */
"use client";

import { useId, useState } from "react";
import { filterRoleOptions, type RoleOption } from "@/domain/role-catalog";
import { FIELD } from "./ui";

type Props = { options: readonly RoleOption[]; defaultValue?: string; autoFocus?: boolean };

export function RolePicker({ options, defaultValue = "", autoFocus = false }: Props): React.JSX.Element {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = open ? filterRoleOptions(value, options) : [];
  const pick = (o: RoleOption): void => {
    setValue(o.title);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="role" className="text-sm font-semibold">Role you are hiring for</label>
      <div className="relative">
        <input
          id="role"
          name="role"
          type="text"
          required
          maxLength={300}
          autoComplete="off"
          value={value}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${String(active)}` : undefined}
          aria-describedby="role-help"
          placeholder={options.length > 0 ? `Search ${String(options.length)} roles or type your own` : "Type the role you are hiring for"}
          className={FIELD}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) setOpen(true);
              const n = matches.length;
              if (n > 0) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
            } else if (e.key === "Enter" && open && active >= 0 && matches[active] !== undefined) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && matches.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Preselected roles"
            className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            {matches.map((o, i) => (
              <li
                key={o.title}
                id={`${listId}-${String(i)}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm ${i === active ? "bg-sage/60" : "hover:bg-sage/40"}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus so blur does not close the list before the click lands
                  pick(o);
                }}
                onMouseEnter={() => {
                  setActive(i);
                }}
              >
                <span className="text-ink">{o.title}</span>
                <span className="shrink-0 text-xs text-muted">{o.family}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span id="role-help" className="text-xs text-muted">
        Pick a preselected role (it brings its criteria and evidence sites) or type your own.
      </span>
    </div>
  );
}
