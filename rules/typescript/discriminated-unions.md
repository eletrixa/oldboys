---
rule: typescript/discriminated-unions
title: Discriminated Unions
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [discriminated-unions, tagged-unions, state-machines, type-safety]
---

# TypeScript Discriminated Unions

Model state machines and polymorphic data with discriminated unions for compile-time safety.

---

## Description

Discriminated unions (also called tagged unions) use a literal type property to distinguish between variants. Combined with exhaustive switch statements, they guarantee all states are handled and prevent invalid state combinations.

---

## Specific Guidelines

### DO:
- Use discriminated unions for UI states (loading, error, success, idle)
- Use discriminated unions for polymorphic data (different action types, response variants)
- Always include an exhaustive `default: never` check in switch statements
- Use a consistent discriminant property name (`kind`, `type`, or `status`)
- Keep variant interfaces close to the union definition

### DON'T:
- Use separate boolean flags for mutually exclusive states
- Use optional properties when a discriminated union is more appropriate
- Forget the `default: never` exhaustive check
- Use if/else chains for discriminated union matching

---

## Implementation Details

### Standard Pattern:
```typescript
// Define variants with literal discriminant
type AsyncState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; error: Error };

// Exhaustive handling
function renderState<T>(state: AsyncState<T>): React.ReactNode {
  switch (state.kind) {
    case 'idle':
      return <IdleView />;
    case 'loading':
      return <LoadingSpinner />;
    case 'success':
      return <DataView data={state.data} />;
    case 'error':
      return <ErrorView error={state.error} />;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

### Recommended conventions:
- Use `kind` for UI state machines
- Use `status` for process statuses
- Use `type` for action/event variants

---

## Benefits

1. **Impossible states are unrepresentable**: Can't have loading=true AND error set
2. **Exhaustive checking**: TypeScript errors when cases are missing
3. **Self-documenting**: Union definition shows all possible states
4. **Refactoring safety**: Adding new variants causes compile errors everywhere they need handling
5. **Better IDE support**: Autocomplete knows which properties exist per variant

---

## Examples

### Correct: Loading state with discriminated union

```typescript
type LoadingState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: T; timestamp: Date }
  | { kind: 'error'; error: string; retryable: boolean };

function UserProfile({ userId }: { userId: string }) {
  const [state, setState] = useState<LoadingState<User>>({ kind: 'idle' });

  useEffect(() => {
    setState({ kind: 'loading' });
    
    fetchUser(userId)
      .then(data => setState({ 
        kind: 'success', 
        data, 
        timestamp: new Date() 
      }))
      .catch(error => setState({ 
        kind: 'error', 
        error: error.message,
        retryable: true 
      }));
  }, [userId]);

  switch (state.kind) {
    case 'idle':
      return null;
    case 'loading':
      return <Spinner />;
    case 'success':
      return <ProfileCard user={state.data} />;
    case 'error':
      return (
        <ErrorMessage 
          message={state.error}
          showRetry={state.retryable}
        />
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
```

### Correct: Process status

```typescript
type ProcessStatus =
  | 'initialized'
  | 'not_started'
  | 'started'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'saved'
  | 'failed';

function getStatusLabel(status: ProcessStatus): string {
  switch (status) {
    case 'initialized': return 'Initialized';
    case 'not_started': return 'Not Started';
    case 'started':     return 'Started';
    case 'submitted':   return 'Submitted';
    case 'processing':  return 'Processing';
    case 'completed':   return 'Completed';
    case 'saved':       return 'Saved';
    case 'failed':      return 'Failed';
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

### Correct: Action type union

```typescript
type FormAction =
  | { type: 'START'; userId: string }
  | { type: 'ANSWER_QUESTION'; questionId: string; answer: number }
  | { type: 'SUBMIT'; timestamp: Date }
  | { type: 'RESET' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'START':
      return { ...state, status: 'started', userId: action.userId };
    case 'ANSWER_QUESTION':
      return { 
        ...state, 
        answers: { ...state.answers, [action.questionId]: action.answer }
      };
    case 'SUBMIT':
      return { ...state, status: 'submitted', submittedAt: action.timestamp };
    case 'RESET':
      return initialState;
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

### Incorrect: Boolean flags for mutually exclusive states

```typescript
// BAD: Invalid states are possible!
interface LoadingState {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  data: User | null;
}

// Problem: Can have isLoading=true AND isError=true simultaneously
// Problem: Can have data=null AND isError=false AND isLoading=false
// Problem: No compile-time guarantee all states are handled

function renderUser(state: LoadingState) {
  // This if/else chain has no compile-time exhaustive check
  if (state.isLoading) return <Spinner />;
  if (state.isError) return <Error message={state.error!} />; // Force unwrap!
  if (state.data) return <UserCard user={state.data} />;
  return null; // What state is this? Unclear!
}
```

### Incorrect: Missing exhaustive check

```typescript
type Status = 'pending' | 'approved' | 'rejected' | 'expired';

function getStatusColor(status: Status): string {
  switch (status) {
    case 'pending': return 'yellow';
    case 'approved': return 'green';
    case 'rejected': return 'red';
    // Missing 'expired' case - NO COMPILE ERROR!
  }
  return 'gray'; // Silent fallback hides missing case
}

// Later when someone adds 'cancelled' status, this function silently returns 'gray'
```

### Incorrect: If/else chain instead of switch

```typescript
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// BAD: if/else has no exhaustive checking
function processPayment(status: PaymentStatus): void {
  if (status === 'pending') {
    sendReminder();
  } else if (status === 'completed') {
    sendConfirmation();
  } else if (status === 'failed') {
    sendFailureNotice();
  }
  // 'refunded' case silently ignored - no compile error!
}
```
