---
category: accessibility
scope: [frontend]
priority: recommended
applies-to: [react, html, typescript]
tags: [a11y, wcag, keyboard, screen-reader]
---

# Keyboard Navigation

All interactive elements must be operable via keyboard. Tab order follows visual layout, and custom interactive patterns include proper keyboard handlers.

## Guidelines

### Core requirements

- **Tab order**: Matches visual reading order (left-to-right, top-to-bottom). No rearranging tab order with positive `tabIndex` values.
- **Focus indicators**: Every focusable element has a visible focus ring. Use Tailwind's `focus-visible:ring-2` pattern, not `focus:` (which fires on click too).
- **Skip navigation**: A skip link at the top of the page allows jumping past the nav bar to main content.
- **Custom widgets**: Custom widgets such as grids, checklists, and tab panels must implement standard keyboard patterns.

### Interactive patterns

| Widget | Keys | Behavior |
|--------|------|----------|
| Nav links | Tab / Enter | Navigate between sections |
| Grid widget | Arrow keys | Move between cells |
| Checklist items | Space / Enter | Toggle item completion |
| Tab panels | Arrow Left/Right | Switch tabs |
| Modal / dropdown | Escape | Close and return focus |

### DO

- Use `focus-visible:` instead of `focus:` for focus ring styles
- Use native `<button>` and `<a>` elements -- they get keyboard behavior for free
- Trap focus inside modals when open
- Return focus to the trigger element when closing a modal or dropdown
- Test keyboard navigation manually as part of feature development

### DON'T

- Do NOT use `tabIndex` values greater than 0
- Do NOT use `<div onClick>` without `role="button"`, `tabIndex={0}`, and `onKeyDown`
- Do NOT remove focus outlines without providing an alternative indicator
- Do NOT rely on hover-only interactions -- always provide a keyboard equivalent

## Implementation

### Skip navigation link

```tsx
// In layout.tsx, first element in body
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-zinc-900 focus:text-white focus:rounded"
>
  Skip to main content
</a>

// On the main content area
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

### Focus-visible ring pattern

```tsx
// Standard focus ring for interactive elements
<button
  className="rounded px-4 py-2 bg-zinc-800 text-white
             focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-amber-500 focus-visible:ring-offset-2
             focus-visible:ring-offset-zinc-900"
>
  View Details
</button>
```

### Keyboard-accessible checklist

```tsx
// Checklist item
function ChecklistItem({ label, checked, onToggle }: Props) {
  return (
    <label
      className="flex items-center gap-3 cursor-pointer
                 focus-within:ring-2 focus-within:ring-amber-500 rounded p-2"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        className={`w-5 h-5 rounded border-2 flex items-center justify-center
          ${checked ? "bg-amber-500 border-amber-500" : "border-zinc-500"}`}
        aria-hidden="true"
      >
        {checked && <CheckIcon className="w-3 h-3 text-black" />}
      </span>
      <span>{label}</span>
    </label>
  );
}
```

### Grid with arrow key navigation

```tsx
function GridWidget({ slots }: { slots: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = Math.min(index + 1, slots.length - 1);
    if (e.key === "ArrowLeft") next = Math.max(index - 1, 0);
    if (e.key === "ArrowDown") next = Math.min(index + 4, slots.length - 1); // 4 columns
    if (e.key === "ArrowUp") next = Math.max(index - 4, 0);

    if (next !== index) {
      e.preventDefault();
      setActiveIndex(next);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="grid" aria-label="Item slots">
      {slots.map((slot, i) => (
        <button
          key={slot}
          ref={(el) => { refs.current[i] = el; }}
          role="gridcell"
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          {slot}
        </button>
      ))}
    </div>
  );
}
```

## Examples

### Correct

```tsx
// Native button -- keyboard accessible by default
<button onClick={handleView}>View Details</button>

// Custom interactive div with full keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleSelect}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  }}
>
  Select Item
</div>
```

### Incorrect

```tsx
// WRONG: Clickable div with no keyboard support
<div onClick={handleSelect}>Select Item</div>

// WRONG: Positive tabIndex breaks natural order
<button tabIndex={5}>View Item</button>

// WRONG: focus: instead of focus-visible: (fires on mouse click)
<button className="focus:ring-2 focus:ring-amber-500">View</button>

// WRONG: Outline removed with no replacement
<button className="outline-none">View</button>
```
