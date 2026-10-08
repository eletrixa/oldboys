---
rule: react/rendering-optimization
title: React Rendering Optimization
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [performance, rendering, memoization, React.memo, useMemo, useCallback, keys]
---

# React Rendering Optimization

Prevent unnecessary re-renders through proper component design and memoization.

---

## Description

React re-renders components when state or props change. Unnecessary re-renders waste CPU cycles and can cause janky UIs. This rule covers how to identify and prevent unnecessary renders through component design, memoization, and proper prop passing.

---

## Specific Guidelines

### DO:
- Use stable references for objects/arrays passed as props
- Use `React.memo` for components that render often with same props
- Use stable keys for list items (domain IDs, not array index)
- Split large components to isolate state changes
- Move state down to components that actually use it
- Use early returns for loading/error states

### DON'T:
- Create new objects/arrays inline in JSX props
- Use array index as `key` prop
- Pass unstable callbacks to memoized components
- Wrap every component in `React.memo` (profile first)
- Store derived data that causes cascading renders

---

## Implementation Details

### Stable Prop References:
```typescript
// New object every render
<UserCard style={{ margin: 10 }} />

// Stable reference
const cardStyle = { margin: 10 }; // Outside component
<UserCard style={cardStyle} />

// Or with useMemo if dynamic
const cardStyle = useMemo(() => ({
  margin: isCompact ? 5 : 10
}), [isCompact]);
```

### React.memo with Custom Comparison:
```typescript
const ExpensiveList = React.memo(
  function ExpensiveList({ items, onSelect }: Props) {
    return (
      <ul>
        {items.map(item => (
          <li key={item.id} onClick={() => onSelect(item.id)}>
            {item.name}
          </li>
        ))}
      </ul>
    );
  },
  // Optional: custom comparison for deep equality
  (prevProps, nextProps) => {
    return (
      prevProps.items === nextProps.items &&
      prevProps.onSelect === nextProps.onSelect
    );
  }
);
```

### State Colocation:
```typescript
// Parent doesn't need hover state - keep it in child
function ProductCard({ product }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Only ProductCard re-renders on hover, not parent */}
    </div>
  );
}
```

---

## Benefits

1. **Smoother UI**: Fewer re-renders means smoother interactions
2. **Lower CPU usage**: Less work for the browser
3. **Better battery life**: Important for mobile users
4. **Faster paint times**: Smaller re-render scope
5. **Scalability**: App stays fast as it grows

---

## Examples

### Correct: Stable prop references

```typescript
// Constants outside component
const DEFAULT_CONFIG = { retries: 3, timeout: 5000 };
const EMPTY_ARRAY: readonly string[] = [];

function DataFetcher({ endpoint }: Props) {
  const [filters, setFilters] = useState<string[]>([]);
  
  // Memoized when dynamic
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    endpoint,
  }), [endpoint]);
  
  // Use constant for empty case
  const activeFilters = filters.length > 0 ? filters : EMPTY_ARRAY;
  
  return (
    <FetchComponent 
      config={config}
      filters={activeFilters}
    />
  );
}
```

### Correct: Proper list keys

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {users.map(user => (
        // Domain ID as key - stable across re-orders
        <UserRow key={user.id} user={user} />
      ))}
    </ul>
  );
}

// For items without IDs, create composite key
interface ScoreEntry {
  dimensionId: string;
  userId: string;
  score: number;
}

function ScoreList({ scores }: { scores: ScoreEntry[] }) {
  return (
    <ul>
      {scores.map(score => (
        // Composite key from unique combination
        <ScoreRow 
          key={`${score.dimensionId}-${score.userId}`} 
          score={score} 
        />
      ))}
    </ul>
  );
}
```

### Correct: Component splitting to isolate state

```typescript
// Before: Entire page re-renders on search input
function ProductPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products] = useState(PRODUCTS);
  
  return (
    <div>
      <Header /> {/* Re-renders on every keystroke! */}
      <input 
        value={searchQuery} 
        onChange={e => setSearchQuery(e.target.value)} 
      />
      <ProductGrid products={products} /> {/* Re-renders too! */}
    </div>
  );
}

// After: Search state isolated
function ProductPage() {
  const [products] = useState(PRODUCTS);
  
  return (
    <div>
      <Header /> {/* Doesn't re-render */}
      <SearchableProductList products={products} />
    </div>
  );
}

function SearchableProductList({ products }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredProducts = useMemo(
    () => products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [products, searchQuery]
  );
  
  return (
    <>
      <input 
        value={searchQuery} 
        onChange={e => setSearchQuery(e.target.value)} 
      />
      <ProductGrid products={filteredProducts} />
    </>
  );
}
```

### Correct: Early returns for conditional rendering

```typescript
function AssessmentResults({ attemptId }: Props) {
  const { data, isLoading, error } = useAssessmentResult(attemptId);
  
  // Early returns - no unnecessary JSX evaluation
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return <ErrorDisplay error={error} />;
  }
  
  if (!data) {
    return <EmptyState message="No results found" />;
  }
  
  // Only evaluate complex render when we have data
  return (
    <div className="space-y-6">
      <ResultsHeader result={data} />
      <ScoreCard scores={data.scores} />
      <Recommendations items={data.recommendations} />
    </div>
  );
}
```

### Incorrect: Inline object props

```typescript
// BAD: New object on every render
function ProductCard({ product }: Props) {
  return (
    <Card
      // New object every render
      style={{ padding: 20, margin: 10 }}
      // New object every render
      config={{ showImage: true, imageSize: 'large' }}
      // New array every render
      tags={['featured', 'new']}
    >
      {product.name}
    </Card>
  );
}

// GOOD: Stable references
const cardStyle = { padding: 20, margin: 10 };
const defaultConfig = { showImage: true, imageSize: 'large' as const };
const defaultTags = ['featured', 'new'] as const;

function ProductCard({ product }: Props) {
  return (
    <Card
      style={cardStyle}
      config={defaultConfig}
      tags={defaultTags}
    >
      {product.name}
    </Card>
  );
}
```

### Incorrect: Index as key

```typescript
// BAD: Index as key breaks React's reconciliation
function TodoList({ todos, onDelete }: Props) {
  return (
    <ul>
      {todos.map((todo, index) => (
        // Index changes when items are reordered/deleted
        <li key={index}>
          <span>{todo.text}</span>
          <button onClick={() => onDelete(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}

// When first item is deleted:
// - React thinks item 0 changed to what was item 1
// - State from item 0 stays with what's now showing item 1's content
// - Animation/transition bugs, input focus lost

// GOOD: Use stable ID
function TodoList({ todos, onDelete }: Props) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}> {/* Stable domain ID */}
          <span>{todo.text}</span>
          <button onClick={() => onDelete(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

### Incorrect: Unstable callback to memoized component

```typescript
// BAD: New callback breaks memoization
const MemoizedList = React.memo(({ items, onItemClick }: Props) => {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

function Container() {
  const [items] = useState(ITEMS);
  const [selected, setSelected] = useState<string | null>(null);
  
  return (
    <MemoizedList
      items={items}
      // New function every render - memo useless!
      onItemClick={(id) => setSelected(id)}
    />
  );
}

// GOOD: Stable callback reference
function Container() {
  const [items] = useState(ITEMS);
  const [selected, setSelected] = useState<string | null>(null);
  
  const handleItemClick = useCallback((id: string) => {
    setSelected(id);
  }, []); // Stable reference
  
  return (
    <MemoizedList
      items={items}
      onItemClick={handleItemClick}
    />
  );
}
```

### Incorrect: Nested ternaries instead of early returns

```typescript
// BAD: Evaluates all branches, hard to read
function UserProfile({ userId }: Props) {
  const { data, isLoading, error } = useUser(userId);
  
  return (
    <div className="profile">
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data ? (
        <div className="profile-content">
          <Avatar src={data.avatar} />
          <h2>{data.name}</h2>
          {/* More JSX... */}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// GOOD: Early returns, clear flow
function UserProfile({ userId }: Props) {
  const { data, isLoading, error } = useUser(userId);
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;
  
  return (
    <div className="profile">
      <div className="profile-content">
        <Avatar src={data.avatar} />
        <h2>{data.name}</h2>
      </div>
    </div>
  );
}
```
