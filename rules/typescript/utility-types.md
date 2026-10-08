---
rule: typescript/utility-types
title: Utility Types
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [utility-types, partial, pick, omit, record, readonly, type-transformations]
---

# TypeScript Utility Types

Use built-in utility types to transform types without redundant definitions.

---

## Description

TypeScript provides powerful utility types that transform existing types. This rule covers when and how to use `Partial`, `Required`, `Pick`, `Omit`, `Record`, and others to avoid duplicating type definitions and keep types DRY.

---

## Specific Guidelines

### DO:
- Use `Partial<T>` for optional updates/patches
- Use `Pick<T, K>` to select specific properties
- Use `Omit<T, K>` to exclude properties
- Use `Record<K, V>` for typed dictionaries
- Use `Required<T>` to make all properties required
- Use `Readonly<T>` for immutable types
- Compose utility types for complex transformations

### DON'T:
- Manually redefine subsets of existing types
- Use `any` as a Record value type
- Forget that utility types create new types (not aliases)
- Over-nest utility types (hard to read)
- Use `Partial` when you need specific optional fields

---

## Implementation Details

### Common Utility Types:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  createdAt: Date;
}

// Partial - all properties optional
type UserUpdate = Partial<User>;

// Required - all properties required
type CompleteUser = Required<User>;

// Pick - select specific properties
type UserCredentials = Pick<User, 'id' | 'email'>;

// Omit - exclude properties
type UserWithoutId = Omit<User, 'id'>;

// Record - typed dictionary
type UserCache = Record<string, User>;

// Readonly - immutable
type ImmutableUser = Readonly<User>;

// Combinations
type CreateUserInput = Omit<User, 'id' | 'createdAt'>;
type PartialUserUpdate = Partial<Omit<User, 'id'>>;
```

---

## Benefits

1. **DRY types**: Derive types from source of truth
2. **Automatic updates**: Changes propagate automatically
3. **Less maintenance**: No duplicate definitions to sync
4. **Clarity**: Utility types express intent
5. **Type safety**: Compile-time validation of transformations

---

## Examples

### Correct: CRUD type patterns

```typescript
// Base entity
interface Record {
  id: string;
  userId: string;
  status: 'started' | 'completed' | 'expired';
  responses: Response[];
  score: number | null;
  startedAt: Date;
  completedAt: Date | null;
}

// Create input - omit auto-generated fields
type CreateRecordInput = Omit<Record, 'id' | 'startedAt' | 'completedAt' | 'score'>;

// Update input - partial, excluding immutable fields
type UpdateRecordInput = Partial<Omit<Record, 'id' | 'userId' | 'startedAt'>>;

// List view - only essential fields
type RecordListItem = Pick<Record, 'id' | 'status' | 'startedAt' | 'score'>;

// Usage
async function createRecord(input: CreateRecordInput): Promise<Record> {
  const record: Record = {
    ...input,
    id: crypto.randomUUID(),
    startedAt: new Date(),
    completedAt: null,
    score: null,
  };
  return record;
}

async function updateRecord(
  id: string, 
  updates: UpdateRecordInput
): Promise<Record> {
  // Only allowed fields can be updated
  return await db.update('records', id, updates);
}
```

### Correct: Record for typed maps

```typescript
// Score by dimension
type DimensionScores = Record<DimensionId, number>;

const scores: DimensionScores = {
  communication: 85,
  engagement: 72,
  trust: 90,
  shared_values: 88,
};

// Handler registry
type RouteHandler = (req: Request) => Promise<Response>;
type RouteHandlers = Record<string, RouteHandler>;

const handlers: RouteHandlers = {
  '/api/users': handleUsers,
  '/api/dashboard': handleDashboard,
};

// Feature flags
type FeatureFlags = Record<string, boolean>;

const features: FeatureFlags = {
  newDashboard: true,
  betaAI: false,
  experimentalUI: true,
};
```

### Correct: Composing utility types

```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  metadata: Record<string, unknown>;
}

// Form state: editable fields, all optional for partial saves
type ProductFormState = Partial<Omit<Product, 'id' | 'metadata'>>;

// API response: product with required computed fields
type ProductWithStats = Product & {
  salesCount: number;
  rating: number;
};

// Readonly for display
type DisplayProduct = Readonly<Pick<Product, 'name' | 'price' | 'images'>>;

// Create input with required fields, optional metadata
type CreateProductInput = 
  & Required<Pick<Product, 'name' | 'price' | 'category'>>
  & Partial<Pick<Product, 'description' | 'stock' | 'images' | 'metadata'>>;
```

### Correct: Extract and ReturnType

```typescript
// Extract matching types from union
type SuccessResponse = { success: true; data: unknown };
type ErrorResponse = { success: false; error: string };
type ApiResponse = SuccessResponse | ErrorResponse;

type OnlySuccess = Extract<ApiResponse, { success: true }>;
// { success: true; data: unknown }

type OnlyError = Exclude<ApiResponse, { success: true }>;
// { success: false; error: string }

// Get return type of function
async function fetchUser(id: string): Promise<User> {
  // ...
}

type FetchUserResult = Awaited<ReturnType<typeof fetchUser>>;
// User

// Parameters of function
type FetchUserParams = Parameters<typeof fetchUser>;
// [id: string]
```

### Incorrect: Manually duplicating types

```typescript
// BAD: Manual duplication
interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

// Duplicating User properties!
interface UserUpdate {
  email?: string;
  name?: string;
  avatar?: string;
}

// GOOD: Use Partial + Omit
type UserUpdate = Partial<Omit<User, 'id'>>;
```

### Incorrect: Using any in Record

```typescript
// BAD: any defeats type safety
const cache: Record<string, any> = {};
cache.user = { foo: 'bar' }; // No validation!

// GOOD: Use specific type or unknown
const userCache: Record<string, User> = {};
const genericCache: Record<string, unknown> = {};
```

### Incorrect: Over-nested utility types

```typescript
// BAD: Unreadable nesting
type ComplexType = Required<
  Partial<
    Omit<
      Pick<User, 'id' | 'email' | 'name' | 'avatar'>,
      'avatar'
    >
  >
>;

// GOOD: Break into named intermediate types
type UserCore = Pick<User, 'id' | 'email' | 'name'>;
type UserCoreOptional = Partial<UserCore>;
type UserCoreRequired = Required<UserCoreOptional>;

// Or just define what you need directly
interface UserCore {
  id: string;
  email: string;
  name: string;
}
```
