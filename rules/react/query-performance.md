---
rule: react/query-performance
title: React Query Performance Rules
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [react-query, performance, caching, query-keys, deduplication, optimization]
---

# React Query Performance Rules

## 1. Cache keys = data parameters only

Never include rendering context (buttonContext, displayMode) in query keys. Use `select` for rendering-specific transforms.

```typescript
// WRONG - creates duplicate cache entries
queryKey: ["product-access", slug, userId, buttonContext]

// CORRECT - one cache entry, select applies rendering transform
queryKey: ["product-access", slug, userId],
select: (raw) => computeAccess(raw, options)
```

## 2. One hook instance per data

Never call `useSubscriptionState()` alongside `useAccess()` in the same hook chain. The subscription-active status is already available via `access.state === "subscription"`.

```typescript
// WRONG - redundant query
const { hasActiveSubscription } = useSubscriptionState();
const { access } = useAccess(slug);

// CORRECT - derive from existing data
const { access } = useAccess(slug);
const hasActiveSubscription = access?.state === "subscription";
```

## 3. One component, CSS responsive

Never render the same data-fetching component twice for mobile/desktop. Use CSS (`hidden lg:block` / `lg:hidden`) on wrapper divs around a shared component instead.

When multiple instances are unavoidable (e.g., different DOM positions), use a state provider + shared component pattern.

## 4. Respect query presets

Never override `refetchOnWindowFocus: true` unless the data is payment-critical and requires immediate consistency. Standard presets (e.g., 30s stale, no window focus refetch) are sufficient for subscriptions and access checks.

## 5. Provider for shared state

When multiple components on the same page need the same computed state from hooks, use a context provider pattern:

```typescript
// Provider calls the hook once
<OrderBoxStateProvider product={product}>
  <SharedOrderBox />  {/* mobile */}
  <SharedOrderBox />  {/* desktop */}
</OrderBoxStateProvider>
```

## 6. Checklist for new hooks

Before merging a new data-fetching hook:

- [ ] Profile with React Query DevTools -- verify no duplicate queries
- [ ] Check cache key uniqueness -- no rendering context in keys
- [ ] Check for overlapping data -- does another hook already fetch this?
- [ ] Verify refetch settings -- no unnecessary `refetchOnWindowFocus: true`
