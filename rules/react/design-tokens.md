---
rule: react/design-tokens
title: Design Tokens and Styling Consistency
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript, css]
tags: [design-tokens, tailwind, css-variables, theming, dark-mode, styling]
---

# Design Tokens and Styling Consistency

Use design tokens and Tailwind theme variables instead of hardcoded colors/spacing.

---

## Clear description

UI styling should be driven by design tokens (CSS custom properties) and Tailwind configuration. UI code should consume tokens via Tailwind classes rather than hardcoding hex values, ad-hoc spacing, or inconsistent fonts.

---

## Specific guidelines

- **DO** use Tailwind theme classes mapped to CSS variables.
- **DO** use the approved font utility classes.
- **DO** respect `prefers-reduced-motion` for animations.
- **DO** use the documented spacing scale (`gap-*`, `p-*`, etc.) consistently.
- **DON'T** hardcode colors like `#755049` in components.
- **DON'T** introduce new arbitrary spacing values without a token.
- **DON'T** create custom dark mode logic; use class-based `.dark` strategy.

---

## Implementation details

- Tokens live in generated CSS (e.g., `src/styles/generated/design-system.css`).
- Tailwind v4 uses CSS-first configuration in a theme CSS file.
- Dark mode uses class strategy: `.dark` on root.

---

## Tailwind CSS v4 - CSS-First Configuration

**CRITICAL**: In Tailwind v4, colors must be registered in the `@theme` block for gradient utilities (`from-*`, `via-*`, `to-*`) to work.

### Architecture

```
src/styles/generated/design-system.css  -> Source CSS variables (--brand-primary: H S% L%)
src/styles/tailwind-theme.css           -> @theme block (--color-brand-primary: hsl(var(--brand-primary)))
```

### Why @theme Registration Matters

```css
/* Without @theme registration: */
<span className="from-brand-primary">  /* INVISIBLE - gradient doesn't resolve */

/* With @theme registration: */
@theme {
  --color-brand-primary: hsl(var(--brand-primary));
}
<span className="from-brand-primary">  /* Works - gradient renders correctly */
```

### Adding New Colors

1. **Define CSS variable** in `design-system.css`:
   ```css
   --new-color: 20 50% 40%; /* HSL components */
   ```

2. **Register in @theme block** in `tailwind-theme.css`:
   ```css
   @theme {
     --color-new-color: hsl(var(--new-color));
   }
   ```

3. **Use in components**:
   ```tsx
   <div className="bg-new-color from-new-color to-other-color" />
   ```

### Gradient Text Best Practice

Always include a fallback color before gradient text properties:

```css
.gradient-text {
  color: hsl(var(--brand-primary)); /* Fallback */
  background: linear-gradient(...);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Benefits

- **Visual consistency** across the app
- **Fast theme iteration** (change tokens once)
- **Better accessibility** (consistent contrast decisions)
- **Lower CSS entropy** (fewer one-off styles)

---

## Examples

### Correct: token-based colors + fonts

```tsx
export function ProductHero() {
  return (
    <section className="bg-background text-foreground">
      <h1 className="font-heading text-4xl md:text-5xl">Welcome</h1>
      <p className="font-body text-muted-foreground text-base md:text-lg">
        Your guide to getting started.
      </p>

      <button className="font-mono bg-brand-primary text-white hover:bg-brand-primary-dark px-6 py-3 rounded-md">
        Get Started
      </button>
    </section>
  );
}
```

### Correct: opacity modifiers on token colors

```tsx
<div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-6" />
```

### Correct: reduced motion support

```tsx
<div className="motion-safe:animate-fadeIn motion-reduce:animate-none" />
```

### Incorrect: hardcoded colors and ad-hoc spacing

```tsx
export function Bad() {
  return (
    <div style={{ backgroundColor: '#755049', padding: 37 }}>
      <h1 style={{ fontFamily: 'SomeRandomFont' }}>Title</h1>
    </div>
  );
}
```
