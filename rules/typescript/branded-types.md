---
rule: typescript/branded-types
title: Branded Types
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [branded-types, nominal-typing, type-safety, domain-modeling]
---

# TypeScript Branded Types

Use type branding to prevent mixing incompatible values that share the same primitive type.

---

## Description

Branded types (also called nominal typing or opaque types) add a compile-time "brand" to primitive types, preventing accidental mixing of semantically different values. This catches bugs like passing a `ProductId` where a `UserId` was expected--both are strings, but they're not interchangeable.

---

## Specific Guidelines

### DO:
- Brand all entity IDs (`UserId`, `ProductId`, `OrderId`)
- Brand critical domain primitives (monetary amounts, percentages, tokens)
- Create brand constructors/parsers with validation
- Use branded types at API boundaries
- Document the brand purpose in the type alias

### DON'T:
- Use plain `string` for IDs that identify different entities
- Over-brand trivial values (display names, descriptions)
- Create brands without validation functions
- Mix branded and unbranded versions of the same value

---

## Implementation Details

### Standard Brand Pattern:
```typescript
// Brand declaration
type Brand<T, B> = T & { readonly __brand: B };

// Specific branded types
type UserId = Brand<string, 'UserId'>;
type ProductId = Brand<string, 'ProductId'>;
type OrderId = Brand<string, 'OrderId'>;

// Constructor functions with validation
function createUserId(id: string): UserId {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid user ID');
  }
  return id as UserId;
}

function parseUserId(id: unknown): UserId | null {
  if (typeof id !== 'string' || !id.trim()) {
    return null;
  }
  return id as UserId;
}
```

### In your codebase:
- Define branded types in `src/types/` domain folders
- Use constructor functions that validate (e.g., UUID format)
- Export both type and constructor together

---

## Benefits

1. **Prevent ID mix-ups**: Can't pass OrderId where UserId expected
2. **Compile-time safety**: Errors caught during development
3. **Self-documenting**: Function signatures show exact ID type needed
4. **Refactoring safety**: Renaming/changing ID types causes compile errors
5. **API clarity**: Clear distinction between different string-typed values

---

## Examples

### Correct: Branded ID types

```typescript
// types/ids.ts
type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type ProductId = Brand<string, 'ProductId'>;

// Constructors with validation
export function createUserId(id: string): UserId {
  if (!id.match(/^[0-9a-f-]{36}$/i)) {
    throw new Error(`Invalid UUID format for UserId: ${id}`);
  }
  return id as UserId;
}

// Usage in service
async function getResult(
  userId: UserId,
  recordId: OrderId
): Promise<Result> {
  const { data, error } = await db
    .from('records')
    .select('*')
    .eq('user_id', userId)
    .eq('id', recordId)
    .single();
    
  if (error) throw error;
  return data;
}

// Caller MUST provide correctly typed IDs
const userId = createUserId(session.user.id);
const recordId = createOrderId(params.recordId);
const result = await getResult(userId, recordId); // Type safe!
```

### Correct: Branded monetary values

```typescript
type CentsAmount = Brand<number, 'CentsAmount'>;
type DollarsAmount = Brand<number, 'DollarsAmount'>;

function createCentsAmount(cents: number): CentsAmount {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('Amount must be non-negative integer cents');
  }
  return cents as CentsAmount;
}

function centsToDollars(cents: CentsAmount): DollarsAmount {
  return (cents / 100) as DollarsAmount;
}

function formatPrice(dollars: DollarsAmount): string {
  return `$${dollars.toFixed(2)}`;
}

// Usage - can't mix up cents and dollars!
const price = createCentsAmount(1999);
const dollars = centsToDollars(price);
console.log(formatPrice(dollars)); // "$19.99"

// formatPrice(price); // Compile error! Expected DollarsAmount
```

### Correct: Branded tokens and secrets

```typescript
type AccessToken = Brand<string, 'AccessToken'>;
type RefreshToken = Brand<string, 'RefreshToken'>;
type MagicLinkToken = Brand<string, 'MagicLinkToken'>;

interface AuthTokens {
  accessToken: AccessToken;
  refreshToken: RefreshToken;
}

async function refreshSession(refreshToken: RefreshToken): Promise<AuthTokens> {
  // Can't accidentally pass accessToken here
  const response = await fetch('/api/auth/refresh', {
    body: JSON.stringify({ token: refreshToken }),
  });
  return response.json();
}

async function validateMagicLink(token: MagicLinkToken): Promise<Session> {
  // Distinct from other token types
  return auth.verifyOtp({ token, type: 'magiclink' });
}
```

### Incorrect: Plain strings for different entities

```typescript
// BAD: All IDs are just strings - easy to mix up!
async function getResult(
  userId: string,
  recordId: string
): Promise<Result> {
  // ...
}

// No compile error, but WRONG - swapped arguments!
const result = await getResult(recordId, userId); // Runtime bug!
```

### Incorrect: Missing constructor validation

```typescript
// BAD: Brand without validation is just documentation
type UserId = string & { readonly __brand: 'UserId' };

// Direct cast - no validation!
const userId = someInput as UserId; // Could be empty string, number, null!

// Better: Always use constructor
const userId = createUserId(someInput); // Throws if invalid
```

### Incorrect: Mixing branded and unbranded

```typescript
type OrderId = Brand<string, 'OrderId'>;

function processOrder(orderId: OrderId): void {
  // Process...
}

// BAD: Mixing branded type with plain string
const rawId = "ord_123"; // Plain string
processOrder(rawId); // Compile error (good!)

// BAD: Bypassing with cast
processOrder(rawId as OrderId); // No validation!

// GOOD: Use constructor
processOrder(createOrderId(rawId)); // Validates and brands
```
