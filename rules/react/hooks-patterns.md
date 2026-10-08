---
rule: react/hooks-patterns
title: React Hooks Patterns
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [hooks, useEffect, useCallback, useMemo, custom-hooks, performance, rules-of-hooks]
---

# React Hooks Patterns

Use hooks correctly to avoid bugs, infinite loops, and performance issues.

---

## Description

React hooks have rules that must be followed for correct behavior. This rule covers the Rules of Hooks, proper dependency arrays, effect cleanup, and custom hook patterns. Violating these rules causes subtle bugs that are hard to debug.

---

## Specific Guidelines

### DO:
- Call hooks at the top level of components/hooks only
- Include all dependencies in dependency arrays (let ESLint guide you)
- Use `useCallback` for callbacks passed to memoized children
- Use `useMemo` only for expensive computations
- Return cleanup functions from effects with subscriptions
- Extract reusable logic into custom hooks (`useXxx`)

### DON'T:
- Call hooks inside conditions, loops, or nested functions
- Omit dependencies from dependency arrays to "prevent re-runs"
- Use `useMemo`/`useCallback` for everything (premature optimization)
- Create effects that update state they depend on (infinite loops)
- Use effects for derived state (compute inline instead)

---

## Implementation Details

### useEffect Cleanup Pattern:
```typescript
useEffect(() => {
  const controller = new AbortController();
  
  async function fetchData() {
    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      setData(data);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error);
      }
    }
  }
  
  fetchData();
  
  // Cleanup: abort fetch on unmount or deps change
  return () => controller.abort();
}, [url]);
```

### Custom Hook Pattern:
```typescript
// Extract reusable stateful logic
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue] as const;
}
```

### Stable Callback References:
```typescript
// Child with React.memo won't re-render unless handleClick changes
const handleClick = useCallback((id: string) => {
  onSelect(id);
}, [onSelect]);

return <MemoizedList items={items} onItemClick={handleClick} />;
```

---

## Benefits

1. **Correct behavior**: Following hook rules ensures React works properly
2. **No stale closures**: Proper deps prevent reading outdated values
3. **No memory leaks**: Cleanup prevents orphaned subscriptions
4. **Reusable logic**: Custom hooks share stateful logic across components
5. **Optimized rendering**: Strategic memoization prevents unnecessary work

---

## Examples

### Correct: useEffect with proper cleanup

```typescript
function useStatusPolling(attemptId: string) {
  const [status, setStatus] = useState<AttemptStatus>('processing');
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    async function poll() {
      while (isMounted && status === 'processing') {
        try {
          const response = await fetch(
            `/api/assessments/status/${attemptId}`,
            { signal: controller.signal }
          );
          const data = await response.json();
          
          if (isMounted) {
            setStatus(data.status);
          }
          
          if (data.status !== 'processing') break;
          
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            if (isMounted) setError(err);
          }
          break;
        }
      }
    }
    
    poll();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [attemptId, status]);
  
  return { status, error };
}
```

### Correct: useCallback with correct dependencies

```typescript
function ItemList({ items, onSelect, onDelete }: Props) {
  // Stable reference when onSelect doesn't change
  const handleSelect = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]);
  
  // All used values in dependencies
  const handleDelete = useCallback((id: string) => {
    if (window.confirm(`Delete item ${id}?`)) {
      onDelete(id);
    }
  }, [onDelete]);
  
  return (
    <ul>
      {items.map(item => (
        <MemoizedItem
          key={item.id}
          item={item}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}

const MemoizedItem = React.memo(function Item({
  item,
  onSelect,
  onDelete,
}: ItemProps) {
  return (
    <li>
      <span onClick={() => onSelect(item.id)}>{item.name}</span>
      <button onClick={() => onDelete(item.id)}>Delete</button>
    </li>
  );
});
```

### Correct: Custom hook encapsulating logic

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage
function SearchResults({ query }: Props) {
  const debouncedQuery = useDebounce(query, 300);
  
  const results = useQuery(['search', debouncedQuery], () =>
    searchApi(debouncedQuery)
  );
  
  return <ResultList results={results.data} />;
}
```

### Correct: useMemo for expensive computations only

```typescript
function DataGrid({ rows, filters, sortConfig }: Props) {
  // Expensive filtering + sorting - worth memoizing
  const processedRows = useMemo(() => {
    let result = [...rows];
    
    // Filtering (O(n))
    if (filters.length > 0) {
      result = result.filter(row =>
        filters.every(f => matchesFilter(row, f))
      );
    }
    
    // Sorting (O(n log n))
    if (sortConfig) {
      result.sort((a, b) => compareRows(a, b, sortConfig));
    }
    
    return result;
  }, [rows, filters, sortConfig]);
  
  // NOT worth memoizing - cheap computation
  // const rowCount = useMemo(() => rows.length, [rows]);
  const rowCount = rows.length; // Just compute inline
  
  return (
    <table>
      <tbody>
        {processedRows.map(row => (
          <tr key={row.id}>{/* ... */}</tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Incorrect: Hook called conditionally

```typescript
// BAD: Violates Rules of Hooks
function UserProfile({ userId }: Props) {
  if (!userId) {
    return <LoginPrompt />;
  }
  
  // Hook after early return!
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  return <Profile user={user} />;
}

// GOOD: Hooks before any returns
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    if (userId) {
      fetchUser(userId).then(setUser);
    }
  }, [userId]);
  
  if (!userId) {
    return <LoginPrompt />;
  }
  
  return <Profile user={user} />;
}
```

### Incorrect: Missing dependencies causing stale closure

```typescript
// BAD: Missing 'count' in dependencies
function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(count); // Always logs 0! Stale closure
      setCount(count + 1); // Always sets to 1!
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // Missing count dependency
  
  return <span>{count}</span>;
}

// GOOD: Use functional update to avoid dependency
function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => prev + 1); // Uses previous value
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // No dependency on count needed
  
  return <span>{count}</span>;
}
```

### Incorrect: Effect that creates infinite loop

```typescript
// BAD: Effect updates its own dependency
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  // INFINITE LOOP: updates fullName, triggers effect, repeat
  useEffect(() => {
    if (user) {
      setFullName(`${user.firstName} ${user.lastName}`);
    }
  }, [user, fullName]); // fullName in deps but also set!
  
  return <span>{fullName}</span>;
}

// GOOD: Derive fullName, don't store it
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  // Computed value, not state
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  
  return <span>{fullName}</span>;
}
```

### Incorrect: Premature memoization

```typescript
// BAD: Memoizing everything "just in case"
function UserCard({ user }: Props) {
  // Simple string concat - not expensive
  const displayName = useMemo(
    () => `${user.firstName} ${user.lastName}`,
    [user.firstName, user.lastName]
  );
  
  // Simple boolean - not expensive
  const isActive = useMemo(
    () => user.status === 'active',
    [user.status]
  );
  
  // Not passed to memoized child
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  return (
    <div onClick={handleClick}>
      <span>{displayName}</span>
      {isActive && <Badge>Active</Badge>}
    </div>
  );
}

// GOOD: Compute inline, memoize only when needed
function UserCard({ user }: Props) {
  const displayName = `${user.firstName} ${user.lastName}`;
  const isActive = user.status === 'active';
  
  return (
    <div onClick={() => console.log('clicked')}>
      <span>{displayName}</span>
      {isActive && <Badge>Active</Badge>}
    </div>
  );
}
```
