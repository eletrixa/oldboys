---
rule: clean-code/typescript-patterns
title: TypeScript Patterns - Safety Without Friction
category: clean-code
scope: [general]
priority: recommended
applies-to: [typescript, javascript]
tags: [typescript, type-safety, discriminated-unions, type-guards, strict-mode]
---

# TypeScript Patterns - Safety Without Friction

**Goal**: Type safety that catches bugs early without slowing development.

---

## Exhaustive Switch (REQUIRED Pattern)

**Rule**: All discriminated unions MUST use exhaustive switches with `never` checks.

### CORRECT Pattern

```typescript
type AttemptStatus =
  | 'initialized'
  | 'not_started'
  | 'started'
  | 'finished'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'saved'
  | 'failed';

function getStatusLabel(status: AttemptStatus): string {
  switch (status) {
    case 'initialized': return 'Initialized';
    case 'not_started': return 'Not Started';
    case 'started':     return 'Started';
    case 'finished':    return 'Questions Finished';
    case 'submitted':   return 'Submitted';
    case 'processing':  return 'Processing';
    case 'completed':   return 'Completed';
    case 'saved':       return 'Saved';
    case 'failed':      return 'Failed';
    default: {
      const _exhaustive: never = status; // TS ERROR if case missing!
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

**Why**: TypeScript forces you to handle ALL cases. Add a new status? TypeScript error until you handle it!

---

### INCORRECT Pattern

```typescript
// BAD: No exhaustive check
function getStatusLabel(status: AttemptStatus): string {
  switch (status) {
    case 'initialized': return 'Initialized';
    case 'not_started': return 'Not Started';
    // ... missing cases - NO ERROR!
  }
  return 'Unknown'; // Silent bugs!
}

// BAD: if/else chains
function getStatusLabel(status: AttemptStatus): string {
  if (status === 'initialized') return 'Initialized';
  if (status === 'not_started') return 'Not Started';
  // ... missing cases - NO ERROR!
  return 'Unknown';
}
```

---

## Discriminated Unions

**Rule**: Use discriminated unions for UI states and polymorphic data.

```typescript
// GOOD: Discriminated union
type LoadingState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: User[] }
  | { kind: 'error'; error: string };

function renderUsers(state: LoadingState) {
  switch (state.kind) {
    case 'idle':    return <div>Start loading</div>;
    case 'loading': return <Spinner />;
    case 'success': return <UserList users={state.data} />;
    case 'error':   return <Error message={state.error} />;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// BAD: Separate booleans (invalid states possible!)
interface LoadingState {
  loading: boolean;
  error: string | null;
  data: User[] | null;
}
// Problem: Can have loading=true AND error set!
```

---

## Type Guards

**Rule**: Use type guards to narrow `unknown` types safely.

```typescript
// GOOD: Type guard
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data &&
    typeof data.email === 'string'
  );
}

async function fetchUser(id: string): Promise<Result<User>> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json(); // unknown by default

  if (!isUser(data)) {
    return err(new Error('Invalid user data'));
  }

  return ok(data); // TypeScript knows it's User!
}

// BAD: Type assertion without validation
const data = await response.json() as User; // DANGEROUS!
```

---

## Prefer `unknown` over `any`

**Rule**: Use `unknown` for external data, NEVER `any`.

```typescript
// GOOD
async function handleRequest(req: Request): Promise<Response> {
  const body: unknown = await req.json(); // Force validation

  if (!isValidBody(body)) {
    return json(400, { error: 'Invalid body' });
  }

  // Now TypeScript knows body is valid
  return processBody(body);
}

// BAD
async function handleRequest(req: Request): Promise<Response> {
  const body: any = await req.json(); // NO TYPE SAFETY!
  return processBody(body); // Could crash at runtime
}
```

---

## Readonly by Default

**Rule**: Use `readonly` for data that shouldn't mutate.

```typescript
// GOOD
interface User {
  readonly id: string;
  readonly email: string;
  name: string; // Only this can change
}

const user: User = { id: '123', email: 'test@example.com', name: 'John' };
user.name = 'Jane'; // OK
user.id = '456';    // TS ERROR - can't mutate!

// GOOD: Readonly arrays
const VALID_STATUSES: readonly AttemptStatus[] = [
  'initialized',
  'not_started',
  'started',
] as const;

VALID_STATUSES.push('completed'); // TS ERROR - can't mutate!
```

---

## Type Branding (Critical Primitives)

**Rule**: Brand IDs and critical primitives to prevent mix-ups.

```typescript
// GOOD: Branded types
type UserId = string & { readonly __brand: 'UserId' };
type ProductId = string & { readonly __brand: 'ProductId' };

function getUser(userId: UserId): Promise<User> { ... }
function getProduct(productId: ProductId): Promise<Product> { ... }

const userId = '123' as UserId;
const productId = '456' as ProductId;

getUser(userId);       // OK
getUser(productId);    // TS ERROR - can't mix IDs!

// BAD: Plain strings
function getUser(userId: string): Promise<User> { ... }
function getProduct(productId: string): Promise<Product> { ... }

getUser('456');        // Compiles but WRONG USER!
```

---

## Strict Mode Settings

**Required**: These settings MUST be enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
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

---

## Quick Checklist

Before merging code, verify:

- [ ] All discriminated unions use exhaustive switches?
- [ ] All switches have `default: never` check?
- [ ] External data typed as `unknown`, then validated?
- [ ] No `any` types in production code?
- [ ] Critical IDs use type branding?
- [ ] Readonly applied where appropriate?
- [ ] Strict mode enabled in tsconfig?
