---
rule: typescript/readonly-immutability
title: Readonly and Immutability
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [readonly, immutability, as-const, deep-readonly, state-management]
---

# TypeScript Readonly and Immutability

Enforce immutability by default to prevent accidental mutations and make data flow predictable.

---

## Description

Immutable data structures are easier to reason about and debug. TypeScript's `readonly` modifier and utility types enforce immutability at compile time. Default to readonly; mutability should be an explicit, intentional choice.

---

## Specific Guidelines

### DO:
- Use `readonly` modifier for interface properties that shouldn't change
- Use `Readonly<T>` for deeply readonly objects
- Use `readonly T[]` or `ReadonlyArray<T>` for arrays that shouldn't be modified
- Use `as const` for literal objects and arrays that are configuration/constants
- Create new objects/arrays instead of mutating existing ones
- Mark function parameters as `readonly` when they shouldn't be modified

### DON'T:
- Mutate arrays with `.push()`, `.pop()`, `.splice()` on readonly arrays
- Reassign object properties when they're readonly
- Use `Object.assign()` or spread to mutate objects in place
- Trust that "I won't mutate it" without compiler enforcement

---

## Implementation Details

### Readonly Interface Properties:
```typescript
interface User {
  readonly id: string;          // Never changes after creation
  readonly email: string;       // Never changes
  readonly createdAt: Date;     // Never changes
  name: string;                 // Can be updated
  preferences: UserPreferences; // Can be updated
}
```

### Readonly Arrays:
```typescript
// For constants
const VALID_STATUSES: readonly string[] = [
  'initialized',
  'not_started',
  'started',
] as const;

// For function parameters
function processItems(items: readonly Item[]): Item[] {
  // Can't modify 'items', must create new array
  return items.filter(i => i.active).map(i => ({ ...i, processed: true }));
}
```

### Deep Readonly:
```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

const config: DeepReadonly<Config> = {
  api: { baseUrl: '/api', timeout: 5000 },
  features: { darkMode: true },
};
// config.api.timeout = 3000; // Compile error!
```

---

## Benefits

1. **Predictable data flow**: Data doesn't change unexpectedly
2. **Easier debugging**: No tracking down where mutation happened
3. **Thread safety**: Immutable data can be safely shared
4. **React optimization**: Immutability enables efficient re-render detection
5. **Time-travel debugging**: State history is preserved

---

## Examples

### Correct: Readonly interface design

```typescript
interface Record {
  readonly id: RecordId;
  readonly userId: UserId;
  readonly groupId: GroupId;
  readonly createdAt: Date;
  readonly role: 'individual' | 'member_a' | 'member_b';
  
  // Mutable fields - explicit choice
  status: RecordStatus;
  responses: Record<string, number>;
  completedAt: Date | null;
}

// Can modify status and responses, but not id, userId, etc.
function updateRecordStatus(
  record: Record, 
  newStatus: RecordStatus
): Record {
  return {
    ...record,
    status: newStatus,
    completedAt: newStatus === 'completed' ? new Date() : record.completedAt,
  };
}
```

### Correct: Readonly configuration with as const

```typescript
const APP_CONFIG = {
  minQuestions: 40,
  maxRetries: 3,
  timeoutMs: 30000,
  stages: ['individual', 'group', 'results'],
  scoring: {
    minScore: 0,
    maxScore: 100,
    passingThreshold: 60,
  },
} as const;

// TypeScript infers exact literal types:
// typeof APP_CONFIG.stages = readonly ["individual", "group", "results"]
// typeof APP_CONFIG.scoring.minScore = 0 (not number)

// APP_CONFIG.minQuestions = 50; // Compile error!
// APP_CONFIG.stages.push('new'); // Compile error!
```

### Correct: Readonly function parameters

```typescript
function calculateTotal(items: readonly CartItem[]): number {
  // Can read items, but can't modify the array
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function filterActiveUsers(users: readonly User[]): User[] {
  // Must return NEW array, can't modify input
  return users.filter(u => u.isActive);
}

function enrichUserData(
  user: Readonly<User>,
  extra: Readonly<ExtraData>
): EnrichedUser {
  // Can't modify inputs, must create new object
  return {
    ...user,
    ...extra,
    enrichedAt: new Date(),
  };
}
```

### Correct: Immutable state updates in React

```typescript
interface State {
  users: readonly User[];
  selectedId: string | null;
  filters: Readonly<FilterOptions>;
}

function reducer(state: Readonly<State>, action: Action): State {
  switch (action.type) {
    case 'ADD_USER':
      return {
        ...state,
        users: [...state.users, action.user], // New array
      };
    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.filters }, // New object
      };
    case 'REMOVE_USER':
      return {
        ...state,
        users: state.users.filter(u => u.id !== action.userId), // New array
      };
    default:
      return state;
  }
}
```

### Incorrect: Mutating readonly arrays

```typescript
const ALLOWED_ROLES: readonly string[] = ['admin', 'user', 'guest'];

// BAD: Trying to mutate readonly array
ALLOWED_ROLES.push('moderator'); // Compile error!
ALLOWED_ROLES[0] = 'superadmin'; // Compile error!

function processRoles(roles: readonly string[]): void {
  roles.sort(); // Compile error! sort() mutates
  roles.reverse(); // Compile error! reverse() mutates
  
  // GOOD: Create new arrays
  const sorted = [...roles].sort(); // New array
  const reversed = [...roles].reverse(); // New array
}
```

### Incorrect: Mutating state directly

```typescript
interface State {
  items: Item[];
  count: number;
}

// BAD: Direct mutation
function addItem(state: State, newItem: Item): State {
  state.items.push(newItem); // Mutates original array!
  state.count++; // Mutates original state!
  return state;
}

// GOOD: Immutable update
function addItem(state: Readonly<State>, newItem: Item): State {
  return {
    items: [...state.items, newItem], // New array
    count: state.count + 1, // Primitive, so naturally immutable
  };
}
```

### Incorrect: Missing readonly on entity IDs

```typescript
// BAD: ID can be reassigned
interface User {
  id: string; // Should be readonly!
  name: string;
}

const user: User = { id: '123', name: 'John' };
user.id = '456'; // No compile error, but this is almost always a bug!

// GOOD: ID is protected
interface User {
  readonly id: string;
  name: string;
}
```
