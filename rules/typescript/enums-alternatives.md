---
rule: typescript/enums-alternatives
title: Enums Alternatives
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [enums, const-objects, union-types, as-const, type-safety]
---

# TypeScript Enums Alternatives

Prefer const objects and union types over TypeScript enums.

---

## Description

TypeScript enums have quirks that make them problematic: numeric enums allow invalid values, string enums don't reverse-map well, and all enums generate runtime code. This rule mandates using const objects with `as const` and derived union types instead.

---

## Specific Guidelines

### DO:
- Use `as const` objects for enum-like constants
- Derive union types from const objects with `typeof`
- Use string literal unions for simple cases
- Export both the const object and the derived type
- Use the object for runtime lookups, type for compile-time checks

### DON'T:
- Use numeric enums (allow invalid values like `Status = 999`)
- Use string enums (limited benefits over const objects)
- Use `enum` keyword in new code
- Rely on enum reverse mapping
- Use const enums (removed at compile time, can break)

---

## Implementation Details

### Const Object Pattern:

```typescript
// Define the const object
export const OrderStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

// Derive the union type
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
// 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

// Usage
function handleOrder(status: OrderStatus): void {
  // Can use object for runtime checks
  if (status === OrderStatus.PENDING) {
    // ...
  }
}
```

### Simple Union Type:

```typescript
// For simple cases, just use a union
type Direction = 'north' | 'south' | 'east' | 'west';

function move(direction: Direction): void {
  // ...
}
```

---

## Benefits

1. **Type safety**: No invalid values can be assigned
2. **Tree-shakeable**: Unused values are removed by bundlers
3. **Predictable**: No reverse mapping confusion
4. **Flexible**: Works with all TypeScript features
5. **Runtime access**: Object available for iteration/lookup

---

## Examples

### Correct: Const object with derived type

```typescript
// Define status values
export const ProcessStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const;

// Derive the type
export type ProcessStatus = typeof ProcessStatus[keyof typeof ProcessStatus];

// Helper to check if value is valid status
export function isValidStatus(value: string): value is ProcessStatus {
  return Object.values(ProcessStatus).includes(value as ProcessStatus);
}

// Usage in function
function updateRecord(
  recordId: string, 
  status: ProcessStatus
): Promise<void> {
  return db
    .from('records')
    .update({ status })
    .eq('id', recordId);
}

// Runtime iteration
function getStatusOptions(): Array<{ value: ProcessStatus; label: string }> {
  return Object.entries(ProcessStatus).map(([key, value]) => ({
    value,
    label: key.replace(/_/g, ' ').toLowerCase(),
  }));
}
```

### Correct: Const object with metadata

```typescript
export const SubscriptionTier = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier];

// Metadata object keyed by the const values
export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  [SubscriptionTier.FREE]: {
    maxUsers: 1,
    features: ['basic'],
    price: 0,
  },
  [SubscriptionTier.BASIC]: {
    maxUsers: 2,
    features: ['basic', 'standard'],
    price: 9.99,
  },
  [SubscriptionTier.PREMIUM]: {
    maxUsers: 5,
    features: ['basic', 'standard', 'ai_insights'],
    price: 19.99,
  },
  [SubscriptionTier.ENTERPRISE]: {
    maxUsers: -1, // unlimited
    features: ['all'],
    price: 99.99,
  },
};

// Usage
function getTierFeatures(tier: SubscriptionTier): string[] {
  return TIER_CONFIG[tier].features;
}
```

### Correct: Simple union for small sets

```typescript
// For small, simple cases - just use unions
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

type Theme = 'light' | 'dark' | 'system';

// Use directly
function request(method: HttpMethod, url: string): Promise<Response> {
  return fetch(url, { method });
}
```

### Correct: Array of values for validation

```typescript
export const VALID_ROLES = ['admin', 'user', 'guest'] as const;
export type Role = typeof VALID_ROLES[number];

// Runtime validation
function isValidRole(value: unknown): value is Role {
  return VALID_ROLES.includes(value as Role);
}

// Parse from external source
function parseRole(input: string): Role {
  if (!isValidRole(input)) {
    throw new Error(`Invalid role: ${input}`);
  }
  return input;
}
```

### Incorrect: Using numeric enum

```typescript
// BAD: Numeric enums allow invalid values
enum Status {
  Pending = 0,
  Active = 1,
  Done = 2,
}

function setStatus(status: Status): void {
  console.log(status);
}

setStatus(999); // No compile error!

// Also confusing reverse mapping
console.log(Status[0]); // 'Pending'
console.log(Status['Pending']); // 0

// GOOD: Use const object
const Status = {
  PENDING: 0,
  ACTIVE: 1,
  DONE: 2,
} as const;

type Status = typeof Status[keyof typeof Status]; // 0 | 1 | 2

function setStatus(status: Status): void {
  console.log(status);
}

setStatus(999); // Error: Argument of type '999' is not assignable
```

### Incorrect: Using string enum

```typescript
// BAD: String enums have limited benefits
enum Color {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE',
}

// Generates runtime code:
// var Color;
// (function (Color) {
//   Color["Red"] = "RED";
//   ...
// })(Color || (Color = {}));

// GOOD: Const object is simpler
const Color = {
  RED: 'RED',
  GREEN: 'GREEN',
  BLUE: 'BLUE',
} as const;

type Color = typeof Color[keyof typeof Color];

// No runtime overhead, same type safety
```

### Incorrect: Using const enum

```typescript
// BAD: Const enums are inlined, break in certain configs
const enum Direction {
  Up = 'UP',
  Down = 'DOWN',
}

// With isolatedModules (required for Vite/esbuild), this errors
// Also breaks when imported across module boundaries

// GOOD: Regular const object works everywhere
const Direction = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

type Direction = typeof Direction[keyof typeof Direction];
```

### Incorrect: Enum for database values

```typescript
// BAD: Enum doesn't match database strings
enum UserRole {
  Admin,      // 0 in DB? No, it's 'admin'
  Moderator,  // Mismatch!
  User,
}

// GOOD: Const object matches database exactly
const UserRole = {
  ADMIN: 'admin',
  MODERATOR: 'moderator', 
  USER: 'user',
} as const;

type UserRole = typeof UserRole[keyof typeof UserRole];
// 'admin' | 'moderator' | 'user' - matches DB!
```
