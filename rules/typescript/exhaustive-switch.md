---
rule: typescript/exhaustive-switch
title: Exhaustive Switch
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [exhaustive-switch, never-check, discriminated-unions, type-safety]
---

# TypeScript Exhaustive Switch

Use exhaustive switch statements with never checks for type-safe discriminated unions.

---

## Description

Exhaustive switch statements ensure all cases of a union type are handled. By adding a `never` check in the default case, TypeScript will error at compile time if a new variant is added but not handled, preventing runtime bugs.

---

## Specific Guidelines

### DO:
- Add `never` exhaustive check in default case
- Use switch for discriminated unions
- Handle every case explicitly
- Return from each case (avoid fallthrough)
- Use type narrowing from switch cases

### DON'T:
- Use empty default without never check
- Use if/else chains for union types
- Ignore new union variants
- Use fallthrough between cases
- Cast away the never type to silence errors

---

## Implementation Details

### Exhaustive Check Pattern:

```typescript
type Status = 'pending' | 'active' | 'completed';

function handleStatus(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Waiting...';
    case 'active':
      return 'In progress';
    case 'completed':
      return 'Done!';
    default: {
      // If a case is missing, TypeScript errors here
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

### How It Works:

When all cases are handled, `status` in the default branch is `never`.
If a new case is added to the union but not handled, `status` becomes that type, and assigning to `never` fails.

---

## Benefits

1. **Compile-time safety**: Errors when new cases added
2. **No silent failures**: Every case explicitly handled
3. **Self-documenting**: Switch shows all possibilities
4. **Refactor-proof**: Adding variants forces updates
5. **Type narrowing**: Each case knows its exact type

---

## Examples

### Correct: Exhaustive switch for status

```typescript
type ProcessStatus =
  | 'initialized'
  | 'started'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed';

function getStatusLabel(status: ProcessStatus): string {
  switch (status) {
    case 'initialized':
      return 'Ready to start';
    case 'started':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'processing':
      return 'Processing...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

// If we add 'cancelled' to ProcessStatus but forget to handle it:
// TypeScript error: Type '"cancelled"' is not assignable to type 'never'
```

### Correct: Exhaustive switch with discriminated union

```typescript
type OperationResult =
  | { type: 'success'; scores: DimensionScores }
  | { type: 'error'; message: string; code: string }
  | { type: 'partial'; completedDimensions: string[]; remaining: number };

function renderResult(result: OperationResult): React.ReactNode {
  switch (result.type) {
    case 'success':
      // TypeScript knows: result.scores is available
      return <ScoreDisplay scores={result.scores} />;
    
    case 'error':
      // TypeScript knows: result.message and result.code available
      return <ErrorMessage message={result.message} code={result.code} />;
    
    case 'partial':
      // TypeScript knows: result.completedDimensions and remaining available
      return (
        <ProgressDisplay
          completed={result.completedDimensions}
          remaining={result.remaining}
        />
      );
    
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled result type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

### Correct: Exhaustive switch for action handlers

```typescript
type FormAction =
  | { type: 'START'; pairId?: string }
  | { type: 'SAVE_RESPONSE'; questionId: string; value: number }
  | { type: 'SUBMIT' }
  | { type: 'CANCEL' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        status: 'started',
        pairId: action.pairId,
      };

    case 'SAVE_RESPONSE':
      return {
        ...state,
        responses: {
          ...state.responses,
          [action.questionId]: action.value,
        },
      };

    case 'SUBMIT':
      return {
        ...state,
        status: 'submitted',
      };

    case 'CANCEL':
      return {
        ...state,
        status: 'cancelled',
      };

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

### Correct: Helper function for never check

```typescript
// utils/assertNever.ts
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}

// Usage
function getColor(tier: Tier): string {
  switch (tier) {
    case 'S': return '#22c55e';
    case 'A': return '#38bdf8';
    case 'B': return '#fbbf24';
    case 'C': return '#fb923c';
    case 'D': return '#ef4444';
    default:
      return assertNever(tier, `Unknown tier: ${tier}`);
  }
}
```

### Incorrect: Empty default without exhaustive check

```typescript
// BAD: No exhaustive check
function getStatusLabel(status: ProcessStatus): string {
  switch (status) {
    case 'initialized':
      return 'Ready';
    case 'started':
      return 'In progress';
    case 'completed':
      return 'Done';
    default:
      return 'Unknown'; // Silently handles new statuses!
  }
}

// If 'processing' is added to ProcessStatus, no error!
// It just returns 'Unknown' - silent bug
```

### Incorrect: If/else chain for union types

```typescript
// BAD: If/else loses exhaustiveness checking
function handleResult(result: OperationResult): void {
  if (result.type === 'success') {
    showScores(result.scores);
  } else if (result.type === 'error') {
    showError(result.message);
  }
  // 'partial' case silently ignored!
  // No TypeScript error
}

// GOOD: Switch with exhaustive check
function handleResult(result: OperationResult): void {
  switch (result.type) {
    case 'success':
      showScores(result.scores);
      break;
    case 'error':
      showError(result.message);
      break;
    case 'partial':
      showProgress(result.remaining);
      break;
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled: ${_exhaustive}`);
    }
  }
}
```

### Incorrect: Casting away never to silence error

```typescript
// BAD: Casting defeats the purpose
switch (status) {
  case 'active':
    return 'Active';
  default:
    // Casting to any silences the error!
    return (status as any) ?? 'Unknown';
}

// BAD: Ignoring the never variable
switch (status) {
  case 'active':
    return 'Active';
  default: {
    const _exhaustive: never = status;
    // Not using _exhaustive, just returning default
    return 'Unknown';
  }
}
```

### Incorrect: Fallthrough cases

```typescript
// BAD: Fallthrough is error-prone
switch (status) {
  case 'initialized':
  case 'started':
    // Both cases fall through - intentional?
    return 'In progress';
  case 'completed':
    return 'Done';
  // Missing default!
}

// GOOD: Explicit handling or grouping
switch (status) {
  case 'initialized':
    return 'Ready to start';
  case 'started':
    return 'In progress';
  case 'completed':
    return 'Done';
  default: {
    const _exhaustive: never = status;
    throw new Error(`Unhandled: ${_exhaustive}`);
  }
}
```
