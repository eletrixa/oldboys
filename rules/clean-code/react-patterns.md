---
rule: clean-code/react-patterns
title: React Patterns - Simple Components, Clear Data Flow
category: clean-code
scope: [general]
priority: recommended
applies-to: [typescript, javascript, react]
tags: [react, components, hooks, state-management, composition, JSX]
---

# React Patterns - Simple Components, Clear Data Flow

**Goal**: Maintainable React code with clear responsibilities.

---

## Core Principles

1. **Single Responsibility**: ~100-150 LOC per component
2. **Composition over Config**: Slots and variants over boolean props
3. **Minimal State**: Store only what changes
4. **Effects for Side-Effects Only**: Not for derived data

---

## Composition over Boolean Props

**What**: Use variants/slots instead of boolean prop explosion.
**Why**: Cleaner API, more extensible.

```typescript
// BAD: Boolean prop explosion
<Card
  showHeader={true}
  showFooter={false}
  showAvatar={true}
  isCompact={false}
  isHighlighted={true}
  hasBorder={true}
  hasActions={true}
/>

// GOOD: Variants + slots
<Card variant="highlighted" size="standard">
  <Card.Header>
    <Avatar src={user.avatar} />
    <Title>{user.name}</Title>
  </Card.Header>
  <Card.Body>{content}</Card.Body>
  <Card.Actions>
    <Button>Edit</Button>
  </Card.Actions>
</Card>
```

---

## Minimal State

**What**: Store only what changes; compute derived values.
**Why**: Less state = fewer bugs, simpler logic.

```typescript
// BAD: Storing derived state
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]); // DERIVED!
const [itemCount, setItemCount] = useState(0); // DERIVED!

useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
  setItemCount(items.length);
}, [items]);

// GOOD: Compute derived values
const [items, setItems] = useState<Item[]>([]);

// Derived (no state needed)
const filteredItems = items.filter(i => i.active);
const itemCount = items.length;

// Only useMemo if expensive
const expensiveResult = useMemo(() => 
  items.reduce((acc, i) => complexCalculation(acc, i), 0),
  [items]
);
```

---

## useEffect Only for Side-Effects

**What**: Effects are for subscriptions, timers, network; NOT derived data.
**Why**: Sync issues, extra renders, complexity.

```typescript
// BAD: Effect for derived data
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// GOOD: Compute inline
const fullName = `${firstName} ${lastName}`;

// GOOD: Effect for actual side-effect
useEffect(() => {
  const subscription = api.subscribe(userId, setData);
  return () => subscription.unsubscribe(); // Cleanup!
}, [userId]);
```

**Effect Rules**:
- Network requests
- Subscriptions (WebSocket, EventSource)
- Timers (setTimeout, setInterval)
- DOM manipulation (refs)
- NOT derived state
- NOT formatting/transforming data

---

## Early Returns in Render

**What**: Handle empty/error/loading first.
**Why**: Clear flow, no nested conditionals.

```typescript
// BAD: Nested conditionals in render
function UserProfile({ userId }: Props) {
  const { data, loading, error } = useUser(userId);

  return (
    <div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <Error message={error} />
      ) : data ? (
        <Profile user={data} />
      ) : (
        <Empty />
      )}
    </div>
  );
}

// GOOD: Early returns
function UserProfile({ userId }: Props) {
  const { data, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!data) return <Empty />;

  return <Profile user={data} />;
}
```

---

## Stable Keys

**What**: Use domain IDs for list keys, never array index.
**Why**: React reconciliation, animation, state preservation.

```typescript
// BAD: Array index as key
{items.map((item, index) => (
  <Item key={index} {...item} /> // Bugs when list changes!
))}

// GOOD: Domain ID as key
{items.map(item => (
  <Item key={item.id} {...item} />
))}

// GOOD: Composite key when needed
{items.map(item => (
  <Item key={`${item.userId}-${item.productId}`} {...item} />
))}
```

---

## Consistent Styling with clsx()

**What**: Use `clsx()` for conditional classes.
**Why**: Readable, type-safe, handles edge cases.

```typescript
import { clsx } from 'clsx';

// GOOD: clsx for conditional classes
<button
  className={clsx(
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'secondary' && 'btn-secondary',
    disabled && 'btn-disabled',
    className // Allow parent override
  )}
/>

// BAD: String concatenation
<button
  className={`btn ${variant === 'primary' ? 'btn-primary' : ''} ${disabled ? 'btn-disabled' : ''}`}
/>
```

---

## Error Boundaries + Suspense

**What**: Use boundaries for crashes, Suspense for loading.
**Why**: Graceful degradation, better UX.

```typescript
// GOOD: Wrap risky components
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Spinner />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>

// For larger bundles
const HeavyChart = lazy(() => import('./HeavyChart'));
```

---

## Component Structure Template

```typescript
// imports (external, then internal)
import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

import { Button } from '@app/components/ui/Button';
import type { UserCardProps } from './types';

// component
export function UserCard({ user, className }: UserCardProps) {
  // 1. Hooks first
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, loading } = useUserDetails(user.id);

  // 2. Derived values
  const displayName = user.nickname ?? user.name;
  const canMessage = user.isActive && !user.isBlocked;

  // 3. Handlers
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 4. Early returns
  if (loading) return <Spinner />;

  // 5. Main render
  return (
    <Card className={clsx('user-card', className)}>
      <Avatar src={user.avatarUrl} />
      <h3>{displayName}</h3>
      {canMessage && <MessageButton to={user.id} />}
    </Card>
  );
}
```

---

## Checklist

Before merging React code:

- [ ] Component under 150 LOC?
- [ ] Using composition (slots/variants) vs boolean props?
- [ ] State minimal (no derived state stored)?
- [ ] Effects only for true side-effects?
- [ ] Early returns for loading/error/empty?
- [ ] Stable keys (domain IDs, not index)?
- [ ] clsx() for conditional classes?
- [ ] Error Boundaries around risky code?

---

**Related**: `component-size.md`
