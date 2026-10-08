---
rule: typescript/strict-typing
title: Strict Typing
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [strict-mode, type-safety, unknown, type-guards, zod, validation]
---

# TypeScript Strict Typing

Enforce strict type safety to catch bugs at compile time rather than runtime.

---

## Description

TypeScript's power lies in its type system. This rule enforces strict typing practices that eliminate entire categories of runtime errors. Never use `any`; prefer `unknown` for external data; always validate before narrowing.

---

## Specific Guidelines

### DO:
- Use `unknown` for all external data (API responses, user input, parsed JSON)
- Create type guards to narrow `unknown` types safely
- Enable all strict mode flags in `tsconfig.json`
- Use explicit return types for public functions
- Validate data at boundaries before type assertions
- Use `satisfies` operator to validate object literals match types while preserving inference

### DON'T:
- Use `any` type anywhere in production code
- Use type assertions (`as Type`) without validation
- Disable strict mode flags with `@ts-ignore` or `@ts-expect-error`
- Use `as unknown as Type` double-cast pattern
- Trust external data without runtime validation

---

## Implementation Details

### Required tsconfig.json settings:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Type Guard Pattern:
```typescript
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as Record<string, unknown>).id === 'string' &&
    'email' in data &&
    typeof (data as Record<string, unknown>).email === 'string'
  );
}
```

### Zod Validation at Boundaries:
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();
  return UserSchema.parse(data); // Throws if invalid
}
```

---

## Benefits

1. **Compile-time error detection**: Catch type mismatches before runtime
2. **Self-documenting code**: Types serve as documentation
3. **Refactoring confidence**: TypeScript catches breaking changes
4. **IDE support**: Better autocomplete and inline error detection
5. **Reduced testing burden**: Type system catches entire error categories

---

## Examples

### Correct: Proper external data handling

```typescript
import { z } from 'zod';

const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    userId: z.string().uuid(),
    scores: z.array(z.number()),
  }),
});

type ApiResponse = z.infer<typeof ApiResponseSchema>;

async function fetchScores(userId: string): Promise<ApiResponse> {
  const response = await fetch(`/api/scores/${userId}`);
  const json: unknown = await response.json();
  
  const parsed = ApiResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid API response: ${parsed.error.message}`);
  }
  
  return parsed.data;
}
```

### Correct: Type guard for runtime narrowing

```typescript
interface OperationResult {
  recordId: string;
  scores: Record<string, number>;
  completedAt: Date;
}

function isOperationResult(data: unknown): data is OperationResult {
  if (typeof data !== 'object' || data === null) return false;
  
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.recordId === 'string' &&
    typeof obj.scores === 'object' &&
    obj.scores !== null &&
    obj.completedAt instanceof Date
  );
}

function processResult(data: unknown): void {
  if (!isOperationResult(data)) {
    throw new Error('Invalid result data');
  }
  
  // TypeScript knows data is OperationResult here
  console.log(data.recordId, data.scores);
}
```

### Correct: Using satisfies for object literals

```typescript
const config = {
  timeout: 5000,
  retries: 3,
  endpoint: '/api/v1',
} satisfies Record<string, string | number>;

// TypeScript infers literal types while ensuring structure matches
// config.timeout is inferred as 5000, not number
```

### Incorrect: Using any type

```typescript
// BAD: any allows anything, defeats TypeScript's purpose
async function fetchData(): Promise<any> {
  const response = await fetch('/api/data');
  return response.json(); // Returns any, no type safety!
}

const data = await fetchData();
console.log(data.nonExistentProperty); // No error! Runtime crash
```

### Incorrect: Unsafe type assertion

```typescript
// BAD: Asserting without validation
interface User {
  id: string;
  email: string;
  name: string;
}

async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json() as User; // DANGEROUS!
  
  // If API returns { id: 123 } (number not string), this crashes later
  return data;
}
```

### Incorrect: Double-cast pattern

```typescript
// BAD: Double-cast bypasses all type checking
const userId = someValue as unknown as string; // No safety!

// Also bad: @ts-ignore to silence errors
// @ts-ignore
const broken: string = 42; // This is a number, not a string!
```
