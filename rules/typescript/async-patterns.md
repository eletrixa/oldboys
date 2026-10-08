---
rule: typescript/async-patterns
title: Async Patterns
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [async, await, promises, error-handling, cancellation, concurrency]
---

# TypeScript Async Patterns

Handle asynchronous operations safely with proper error handling and cancellation.

---

## Description

Async/await is the standard for asynchronous code in TypeScript. This rule covers proper patterns for handling promises, error propagation, concurrent operations, and cancellation to prevent memory leaks and race conditions.

---

## Specific Guidelines

### DO:
- Always handle promise rejections (try/catch or .catch())
- Use `Promise.all()` for independent concurrent operations
- Use `Promise.allSettled()` when you need all results regardless of failures
- Implement cancellation for long-running operations (AbortController)
- Return typed promises with explicit error types
- Use async/await over .then() chains for readability

### DON'T:
- Ignore promise rejections (unhandled rejection crashes Node)
- Use `Promise.all()` when one failure shouldn't cancel others
- Create floating promises (unassigned, unawaited)
- Mix async/await with .then() in the same function
- Use `async` on functions that don't await anything
- Forget cleanup in async effects (React useEffect)

---

## Implementation Details

### Error Handling Pattern:
```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay * attempt));
      }
    }
  }
  throw lastError;
}
```

### Cancellation Pattern:
```typescript
async function fetchWithCancellation<T>(
  url: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## Benefits

1. **Predictable error handling**: All errors are caught and handled
2. **No memory leaks**: Proper cleanup and cancellation
3. **Optimal performance**: Concurrent operations where possible
4. **Resilience**: Retry logic for transient failures
5. **Type safety**: Errors are typed and handled appropriately

---

## Examples

### Correct: React useEffect with cleanup

```typescript
function useAsyncData<T>(fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    
    async function load() {
      setLoading(true);
      try {
        const result = await fetchFn();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchFn]);
  
  return { data, error, loading };
}
```

### Correct: Sequential vs parallel execution

```typescript
// PARALLEL: Independent operations
async function loadDashboard(userId: string): Promise<Dashboard> {
  const [user, stats, notifications] = await Promise.all([
    fetchUser(userId),
    fetchStats(userId),
    fetchNotifications(userId),
  ]);
  return { user, stats, notifications };
}

// PARTIAL SUCCESS: Some failures acceptable
async function sendBulkEmails(users: User[]): Promise<BulkResult> {
  const results = await Promise.allSettled(
    users.map(user => sendEmail(user))
  );
  
  return {
    successful: results.filter(r => r.status === 'fulfilled'),
    failed: results.filter(r => r.status === 'rejected'),
  };
}
```

### Correct: Timeout wrapper

```typescript
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
```

### Incorrect: Floating promise

```typescript
// BAD: Promise not awaited - errors swallowed
function saveData(data: Data): void {
  fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
}

// GOOD: Await the promise
async function saveData(data: Data): Promise<void> {
  await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
}
```

### Incorrect: Missing cleanup in useEffect

```typescript
// BAD: No cleanup - memory leak
useEffect(() => {
  async function load() {
    const user = await fetchUser(userId);
    setUser(user); // May run after unmount!
  }
  load();
}, [userId]);

// GOOD: With cleanup
useEffect(() => {
  let cancelled = false;
  async function load() {
    const user = await fetchUser(userId);
    if (!cancelled) setUser(user);
  }
  load();
  return () => { cancelled = true; };
}, [userId]);
```

### Incorrect: Mixing async/await with .then()

```typescript
// BAD: Mixed styles
async function process(id: string): Promise<Result> {
  const user = await fetchUser(id);
  return validateUser(user).then(valid => saveUser(user));
}

// GOOD: Consistent async/await
async function process(id: string): Promise<Result> {
  const user = await fetchUser(id);
  const valid = await validateUser(user);
  return saveUser(user);
}
```
