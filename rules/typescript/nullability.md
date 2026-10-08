---
rule: typescript/nullability
title: Nullability Handling
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [nullability, null, undefined, optional-chaining, type-guards, strict-null-checks]
---

# TypeScript Nullability Handling

Handle null and undefined explicitly to prevent runtime errors.

---

## Description

With `strictNullChecks` enabled, TypeScript requires explicit handling of `null` and `undefined`. This rule enforces patterns that make nullability obvious and handled safely, preventing the infamous "undefined is not a function" errors.

---

## Specific Guidelines

### DO:
- Use explicit union types: `T | null` or `T | undefined`
- Use optional chaining (`?.`) for safe property access
- Use nullish coalescing (`??`) for default values
- Narrow nullable types before use with type guards
- Prefer `undefined` for optional values, `null` for explicit absence
- Return early for null/undefined cases

### DON'T:
- Use non-null assertion (`!`) without runtime validation
- Use `|| defaultValue` when you mean `?? defaultValue`
- Ignore TypeScript's null check warnings
- Use `as T` to cast away nullability
- Mix `null` and `undefined` semantics inconsistently

---

## Implementation Details

### Optional Chaining:
```typescript
// Safe property access
const userName = user?.profile?.name;
const firstItem = items?.[0];
const result = callback?.();
```

### Nullish Coalescing:
```typescript
// Only falls back if null/undefined (not falsy)
const value = input ?? defaultValue;
const count = config.retries ?? 3;
const name = user.name ?? 'Anonymous';
```

### Type Guards:
```typescript
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
```

### noUncheckedIndexedAccess:
```typescript
// With noUncheckedIndexedAccess: true
const items: string[] = ['a', 'b', 'c'];
const first = items[0]; // Type: string | undefined
if (first !== undefined) {
  console.log(first.toUpperCase()); // Safe!
}
```

---

## Benefits

1. **Prevent runtime crashes**: Handle null before use
2. **Self-documenting**: Type shows if value can be absent
3. **Compiler assistance**: TypeScript reminds you to handle null
4. **Cleaner code**: Early returns instead of nested conditionals
5. **Predictable behavior**: Explicit null handling, no surprises

---

## Examples

### Correct: Safe optional access

```typescript
interface UserProfile {
  name: string;
  address?: {
    city: string;
    zipCode?: string;
  };
  metadata: Record<string, unknown>;
}

function getDisplayLocation(profile: UserProfile | null): string {
  // Early return for null profile
  if (!profile) {
    return 'Location unknown';
  }
  
  // Optional chaining for nested optional properties
  const city = profile.address?.city;
  const zip = profile.address?.zipCode;
  
  if (city && zip) {
    return `${city}, ${zip}`;
  }
  
  return city ?? 'Location not set';
}
```

### Correct: Nullish coalescing vs logical OR

```typescript
interface Settings {
  volume: number;
  brightness: number;
  notifications: boolean;
}

function applySettings(userSettings: Partial<Settings>): Settings {
  return {
    // ?? preserves falsy values (0, false, '')
    volume: userSettings.volume ?? 50,      // 0 is valid, don't default
    brightness: userSettings.brightness ?? 100,
    notifications: userSettings.notifications ?? true,
  };
}

// Example showing difference:
const settings: Partial<Settings> = { volume: 0, notifications: false };

// ?? (correct)
const volume = settings.volume ?? 50;           // 0
const notifications = settings.notifications ?? true; // false

// || (wrong for falsy values)
const volumeWrong = settings.volume || 50;      // 50 (0 is falsy)
const notifyWrong = settings.notifications || true; // true (false is falsy)
```

### Correct: Array access with noUncheckedIndexedAccess

```typescript
function getFirstAndLast<T>(items: readonly T[]): { first: T; last: T } | null {
  const first = items[0];
  const last = items[items.length - 1];
  
  // TypeScript knows these could be undefined
  if (first === undefined || last === undefined) {
    return null;
  }
  
  return { first, last };
}

function processScores(scores: number[]): { average: number; max: number } | null {
  if (scores.length === 0) {
    return null;
  }
  
  // After length check, we know there's at least one element
  const max = Math.max(...scores);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  return { average, max };
}
```

### Correct: Type narrowing with early returns

```typescript
async function fetchUserData(userId: string | null): Promise<UserData> {
  // Early return for null
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  // TypeScript knows userId is string here
  const response = await fetch(`/api/users/${userId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }
  
  const data: unknown = await response.json();
  
  // Validate before returning
  if (!isUserData(data)) {
    throw new Error('Invalid user data format');
  }
  
  return data;
}
```

### Incorrect: Non-null assertion without validation

```typescript
interface Config {
  apiUrl?: string;
  timeout?: number;
}

function initializeApi(config: Config): void {
  // BAD: Non-null assertion assumes value exists
  const url = config.apiUrl!; // Could be undefined at runtime!
  const timeout = config.timeout!; // Could be undefined at runtime!
  
  fetch(url, { signal: AbortSignal.timeout(timeout) });
}

// GOOD: Validate or provide defaults
function initializeApi(config: Config): void {
  const url = config.apiUrl ?? 'https://api.default.com';
  const timeout = config.timeout ?? 5000;
  
  fetch(url, { signal: AbortSignal.timeout(timeout) });
}
```

### Incorrect: Using || instead of ??

```typescript
function getDisplayCount(count: number | undefined): string {
  // BAD: || treats 0 as falsy
  const displayCount = count || 10; // If count is 0, shows 10!
  
  return `Showing ${displayCount} items`;
}

// GOOD: ?? only checks null/undefined
function getDisplayCount(count: number | undefined): string {
  const displayCount = count ?? 10; // If count is 0, shows 0
  
  return `Showing ${displayCount} items`;
}
```

### Incorrect: Casting away nullability

```typescript
async function getUser(id: string): Promise<User | null> {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

// BAD: Casting away null without validation
async function displayUser(id: string): Promise<void> {
  const user = await getUser(id) as User; // Could be null!
  console.log(user.name); // Runtime crash if user is null
}

// GOOD: Handle null explicitly
async function displayUser(id: string): Promise<void> {
  const user = await getUser(id);
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log(user.name); // Safe - TypeScript knows user is User
}
```

### Incorrect: Ignoring undefined array access

```typescript
function getFirstItemName(items: Item[]): string {
  // BAD: Assumes array is non-empty
  return items[0].name; // Runtime crash if empty array!
}

// GOOD: Handle potentially undefined access
function getFirstItemName(items: Item[]): string {
  const first = items[0];
  
  if (!first) {
    return 'No items';
  }
  
  return first.name;
}
```
