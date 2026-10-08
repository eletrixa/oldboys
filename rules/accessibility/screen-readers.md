---
category: accessibility
scope: [frontend]
priority: recommended
applies-to: [react, html, typescript]
tags: [a11y, wcag, keyboard, screen-reader]
---

# Screen Reader Support

Application content must be meaningful when consumed through assistive technology. Use semantic HTML, descriptive labels, and proper ARIA attributes for dynamic content.

## Guidelines

### Core requirements

- **Semantic HTML first**: Use `<nav>`, `<main>`, `<section>`, `<article>`, `<h1>`-`<h6>` before reaching for ARIA roles.
- **Descriptive labels**: Interactive elements and data displays include enough context for a screen reader user to understand without visual cues.
- **Loading states**: Announce loading and completion with `aria-busy` and `sr-only` status text.
- **Tables**: Data tables use proper `<th>` with `scope` attributes.
- **Live regions**: Use `aria-live="polite"` for dynamic content updates and status notifications.

### DO

- Provide `aria-label` on elements where visible text is insufficient (e.g., icon-only buttons)
- Use `sr-only` class for text that adds context for screen readers but is visually hidden
- Mark decorative images with `aria-hidden="true"` or empty `alt=""`
- Use `role="status"` or `aria-live="polite"` for dynamic content updates
- Structure headings hierarchically (`h1` > `h2` > `h3`, no skipping)

### DON'T

- Do NOT use `aria-label` on elements that already have descriptive visible text
- Do NOT hide content from screen readers that sighted users can see (unless purely decorative)
- Do NOT use `role="presentation"` on elements with meaningful content
- Do NOT rely on color alone to convey information (e.g., status colors need text labels too)

## Implementation

### Value badge with full context

```tsx
function ValueBadge({ value, label }: { value: number; label: string }) {
  return (
    <div
      aria-label={`${label} ${value}`}
      className="text-2xl font-bold text-amber-400"
    >
      <span className="sr-only">{label} </span>
      {value}
    </div>
  );
}
```

### Data row with role and state announcements

```tsx
function DataRow({
  slot,
  current,
  target,
  isUpgrade,
}: Props) {
  return (
    <tr>
      <th scope="row">{slot}</th>
      <td>
        <span aria-label={`Current: ${current.name}, level ${current.level}`}>
          {current.name}
        </span>
        <span className="sr-only">, {current.quality} quality</span>
      </td>
      <td>{current.level}</td>
      <td>
        <span aria-label={`Target: ${target.name}, level ${target.level}`}>
          {target.name}
        </span>
      </td>
      <td>
        {isUpgrade && (
          <span role="status" className="text-green-400">
            Upgrade available
            <span className="sr-only">
              : {target.level - current.level} levels higher
            </span>
          </span>
        )}
      </td>
    </tr>
  );
}
```

### Data table with proper structure

```tsx
function DataTable({ items }: { items: Item[] }) {
  return (
    <table aria-label="Data table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          <th scope="col">Description</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.name}>
            <th scope="row">{item.name}</th>
            <td>{item.type}</td>
            <td>{item.description}</td>
            <td>{item.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Loading states

```tsx
function ContentSection({ isLoading, data }: Props) {
  return (
    <section aria-label="Content section" aria-busy={isLoading}>
      {isLoading ? (
        <>
          <span className="sr-only" role="status">Loading content</span>
          <SkeletonCard />
        </>
      ) : (
        <ContentView data={data} />
      )}
    </section>
  );
}
```

### Stale data banner with live region

```tsx
function StaleDataBanner({ isStale, fetchedAt }: Props) {
  if (!isStale) return null;

  const timeAgo = formatDistanceToNow(new Date(fetchedAt));

  return (
    <div role="status" aria-live="polite" className="bg-yellow-900/30 p-3 rounded">
      <p>
        Data may be outdated. Last updated {timeAgo} ago.
        <span className="sr-only">. Refresh is in progress.</span>
      </p>
    </div>
  );
}
```

### Decorative vs meaningful images

```tsx
// Decorative image -- screen readers skip it
<img
  src={profile.imageUrl}
  alt=""
  aria-hidden="true"
  className="pointer-events-none select-none"
/>

// Meaningful image -- needs descriptive alt
<img
  src={item.imageUrl}
  alt={`${item.name} in ${item.context}`}
/>
```

## Examples

### Correct

```tsx
// Numeric score with color -- text provides context, color is supplementary
<span style={{ color: scoreColor }} aria-label={`Score: ${score}`}>
  {score}
</span>

// Status communicated via text, not just color
<span className="text-purple-400">
  {item.name}
  <span className="sr-only">, Premium quality</span>
</span>
```

### Incorrect

```tsx
// WRONG: Color is the only indicator of status
<span className="text-purple-400">{item.name}</span>
// Screen reader user has no idea this has a special status

// WRONG: Missing aria-label on icon button
<button onClick={onRefresh}>
  <RefreshIcon />
</button>
// Should be: <button aria-label="Refresh data"><RefreshIcon aria-hidden="true" /></button>

// WRONG: Heading levels skipped
<h1>App Dashboard</h1>
<h4>Section Title</h4>
// Should use h2, not h4
```
