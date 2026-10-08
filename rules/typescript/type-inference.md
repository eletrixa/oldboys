---
rule: typescript/type-inference
title: Type Inference
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [type-inference, annotations, as-const, public-api, return-types]
---

# TypeScript Type Inference

Let TypeScript infer types when obvious; annotate when it adds clarity or safety.

---

## Description

TypeScript's type inference is powerful and reduces boilerplate. This rule defines when to rely on inference versus when explicit annotations improve code quality, maintainability, and catch errors earlier.

---

## Specific Guidelines

### DO:
- Let TypeScript infer variable types from initialization
- Let TypeScript infer return types for simple private functions
- Annotate return types for public API functions and exports
- Annotate function parameters (they cannot be inferred)
- Use `as const` for literal type inference
- Annotate when inference would be too wide (e.g., `string` vs union)

### DON'T:
- Annotate obvious variable types (`const x: number = 5`)
- Rely on inference for complex return types in public APIs
- Use type assertions when proper inference/narrowing works
- Over-annotate internal implementation details
- Let inference produce `any` implicitly

---

## Implementation Details

### When to Annotate:

```typescript
// ANNOTATE: Public function return types
export function calculateScore(answers: Answer[]): Score {
  // Implementation...
}

// ANNOTATE: Complex object literals
const config: ServerConfig = {
  port: 3000,
  host: 'localhost',
  // Annotation catches typos and missing fields
};

// ANNOTATE: When inference is too wide
const status: 'pending' | 'active' | 'done' = 'pending';
// Without annotation, status would be inferred as string
```

### When to Infer:

```typescript
// INFER: Obvious initializations
const count = 0;                    // number
const name = 'Alice';               // string
const items = ['a', 'b', 'c'];      // string[]

// INFER: Simple internal functions
const double = (n: number) => n * 2;  // Return type obvious

// INFER: Array methods
const numbers = [1, 2, 3];
const doubled = numbers.map(n => n * 2);  // number[]
```

---

## Benefits

1. **Less noise**: Fewer redundant annotations
2. **Type safety**: Annotations on APIs catch breaking changes
3. **Maintainability**: Inferred types update automatically
4. **Documentation**: Explicit types on exports document intent
5. **Error prevention**: Strategic annotations catch mistakes

---

## Examples

### Correct: Annotate public API, infer internals

```typescript
// Public types - always annotate
export interface OperationResult {
  recordId: string;
  scores: Record<string, number>;
  completedAt: Date;
}

// Public function - annotate return type
export function processResults(
  responses: Response[]
): OperationResult {
  // Internal variable - let inference work
  const scoreMap = new Map<string, number>();
  
  // Internal helper - inference is fine
  const calculateAverage = (values: number[]) => {
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  };
  
  // Process responses
  for (const response of responses) {
    const current = scoreMap.get(response.dimension) ?? 0;
    scoreMap.set(response.dimension, current + response.value);
  }
  
  // Convert to object
  const scores = Object.fromEntries(scoreMap);
  
  return {
    recordId: responses[0].recordId,
    scores,
    completedAt: new Date(),
  };
}
```

### Correct: Using as const for literals

```typescript
// Without as const: inferred as { role: string }
const adminUser = { role: 'admin' };

// With as const: inferred as { readonly role: 'admin' }
const adminUser = { role: 'admin' } as const;

// Useful for action types
const ACTIONS = {
  FETCH_START: 'FETCH_START',
  FETCH_SUCCESS: 'FETCH_SUCCESS',
  FETCH_ERROR: 'FETCH_ERROR',
} as const;

type ActionType = typeof ACTIONS[keyof typeof ACTIONS];
// 'FETCH_START' | 'FETCH_SUCCESS' | 'FETCH_ERROR'

// Array literals
const statuses = ['pending', 'active', 'done'] as const;
type Status = typeof statuses[number]; // 'pending' | 'active' | 'done'
```

### Correct: Annotate when inference is wrong

```typescript
// BAD: Inference too wide
const handleStatus = (status: string) => {
  // TypeScript doesn't know valid values
};

// GOOD: Explicit union type
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

const handleStatus = (status: OrderStatus) => {
  // TypeScript knows exactly what's valid
  switch (status) {
    case 'pending': return startProcessing();
    case 'processing': return checkProgress();
    case 'shipped': return trackShipment();
    case 'delivered': return confirmDelivery();
    // TypeScript ensures all cases covered
  }
};
```

### Correct: Annotate empty collections

```typescript
// BAD: Inferred as never[]
const items = [];
items.push('hello'); // Error!

// GOOD: Annotate empty arrays
const items: string[] = [];
items.push('hello'); // OK

// GOOD: Annotate empty objects  
const cache: Record<string, User> = {};
cache['user-1'] = user; // OK

// GOOD: Annotate Maps and Sets
const userMap = new Map<string, User>();
const userIds = new Set<string>();
```

### Incorrect: Redundant annotations

```typescript
// BAD: Obvious types annotated
const count: number = 0;
const name: string = 'Alice';
const isActive: boolean = true;
const items: string[] = ['a', 'b', 'c'];

// GOOD: Let inference work
const count = 0;
const name = 'Alice';
const isActive = true;
const items = ['a', 'b', 'c'];

// BAD: Annotating what's already typed
function processUser(user: User): User {
  const processed: User = { ...user, updatedAt: new Date() };
  return processed;
}

// GOOD: Inference from context
function processUser(user: User): User {
  const processed = { ...user, updatedAt: new Date() };
  return processed;
}
```

### Incorrect: Missing annotation on public API

```typescript
// BAD: Return type not annotated - breaking changes silent
export function fetchUserData(id: string) {
  return fetch(`/api/users/${id}`)
    .then(r => r.json())
    .then(data => ({
      id: data.id,
      name: data.name,
      email: data.email,
    }));
}
// If you remove 'email', callers won't get type errors

// GOOD: Explicit return type catches breaking changes
export interface UserData {
  id: string;
  name: string;
  email: string;
}

export async function fetchUserData(id: string): Promise<UserData> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    email: data.email,
  };
}
// Removing 'email' now causes a type error
```

### Incorrect: Implicit any from inference

```typescript
// BAD: json() returns any, inference produces any
async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json(); // any!
  return data; // Return type is any!
}

// GOOD: Validate and type the data
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;

async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();
  return UserSchema.parse(data);
}
```
