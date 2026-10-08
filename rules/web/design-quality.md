---
rule: web/design-quality
title: Design Quality — Anti-Template Policy
category: web
scope: [frontend, ui, design]
priority: recommended
applies-to: [web, frontend, react, nextjs]
tags: [design, ui, frontend, anti-slop, quality, hierarchy]
---

# Design Quality — Anti-Template Policy

Frontend output should look intentional, opinionated, and specific to the product — not like an unmodified template or library default.

> Brain enforces the same intent at runtime through its `impeccable` skill + `.impeccable.md` checklist. This rule is the portable, always-discoverable version for any web repo; when the `impeccable` skill is available, defer to it for the live gate.

## Banned patterns

- Default card grids with uniform spacing and no hierarchy.
- Stock hero: centred headline + gradient blob + generic CTA.
- Unmodified library defaults passed off as finished design.
- Flat layouts with no layering, depth, or motion.
- Uniform radius, spacing, and shadows across every component.
- Safe gray-on-white with a single decorative accent colour.
- Dashboard-by-numbers (sidebar + cards + charts) with no point of view.
- Default font stacks used without a deliberate reason.

## Required qualities

Every meaningful surface should demonstrate at least **four**:

1. Clear hierarchy through scale contrast.
2. Intentional rhythm in spacing, not uniform padding everywhere.
3. Depth or layering via overlap, shadows, surfaces, or motion.
4. Typography with character and a real pairing strategy.
5. Colour used semantically, not just decoratively.
6. Hover, focus, and active states that feel designed.
7. Grid-breaking editorial or bento composition where appropriate.
8. Texture, grain, or atmosphere when it fits the direction.
9. Motion that clarifies flow instead of distracting.
10. Data visualisation treated as part of the design system.

## Before writing frontend code

1. Pick a specific style direction (avoid vague "clean minimal").
2. Define a palette intentionally.
3. Choose typography deliberately.
4. Gather a small set of real references.
5. Don't default to dark mode automatically — choose what the product wants.

## Component checklist

- [ ] Avoids looking like a default Tailwind / shadcn template?
- [ ] Intentional hover / focus / active states?
- [ ] Hierarchy rather than uniform emphasis?
- [ ] Would look believable in a real product screenshot?
- [ ] If both themes exist, do light and dark each feel intentional?
