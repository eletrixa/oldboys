---
rule: react/state-management
title: React State Management
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [state, useState, useReducer, derived-state, colocation, single-source-of-truth]
---

# React State Management

Keep state minimal, colocate it with usage, and compute derived values.

---

## Description

React state should be the single source of truth. Store only what changes from user interaction; derive everything else. This rule covers when to use state, where to place it, and how to avoid common state management anti-patterns.

---

## Specific Guidelines

### DO:
- Store only "source" data that can't be computed
- Compute derived values inline or with `useMemo`
- Lift state only when sibling components need it
- Use `useReducer` for complex state with multiple transitions
- Initialize state from props only once (with initializer function)
- Colocate state with the components that use it

### DON'T:
- Store derived data in state (filtered lists, formatted values)
- Sync state with effects (`useEffect` to update derived state)
- Lift state "just in case" - keep it local until needed higher
- Use refs for values that should trigger re-renders
- Mutate state objects directly

---

## Implementation Details

### Derived Values Pattern:
```typescript
function UserList({ users }: Props) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  
  // Derived - computed from state
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(filter.toLowerCase())
  );
  
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => 
      sortBy === 'name' 
        ? a.name.localeCompare(b.name)
        : a.createdAt.getTime() - b.createdAt.getTime()
    );
  }, [filteredUsers, sortBy]);
  
  // State stores: filter, sortBy
  // Derived computes: filteredUsers, sortedUsers
}
```

### State Initialization from Props:
```typescript
// Initializer function - runs once
const [value, setValue] = useState(() => computeExpensiveInitial(props.data));

// Expression - recomputes every render (but only first value used)
const [value, setValue] = useState(computeExpensiveInitial(props.data));
```

### Reducer for Complex State:
```typescript
type State = {
  items: Item[];
  selectedId: string | null;
  filter: string;
  sortOrder: 'asc' | 'desc';
};

type Action =
  | { type: 'SELECT'; id: string }
  | { type: 'FILTER'; value: string }
  | { type: 'TOGGLE_SORT' }
  | { type: 'SET_ITEMS'; items: Item[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selectedId: action.id };
    case 'FILTER':
      return { ...state, filter: action.value };
    case 'TOGGLE_SORT':
      return { 
        ...state, 
        sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' 
      };
    case 'SET_ITEMS':
      return { ...state, items: action.items };
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}
```

---

## Benefits

1. **Single source of truth**: One place to update, one place to debug
2. **Fewer re-renders**: Derived values don't cause state updates
3. **No sync bugs**: Can't have stale derived state
4. **Simpler logic**: Less effect chains, less useEffect
5. **Better performance**: useMemo only for expensive computations

---

## Examples

### Correct: Minimal state with derived values

```typescript
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ShoppingCartProps {
  initialItems: CartItem[];
}

export function ShoppingCart({ initialItems }: ShoppingCartProps) {
  // Source state - only what changes from user actions
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [promoCode, setPromoCode] = useState('');
  
  // Derived values - computed, not stored
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 
    0
  );
  const discount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0;
  const total = subtotal - discount;
  
  // Expensive derived - memoized
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  
  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  }, []);
  
  return (
    <div>
      <p>{itemCount} items in cart</p>
      <CartItemList items={sortedItems} onUpdateQuantity={handleUpdateQuantity} />
      <PromoInput value={promoCode} onChange={setPromoCode} />
      <CartSummary subtotal={subtotal} discount={discount} total={total} />
    </div>
  );
}
```

### Correct: useReducer for complex state

```typescript
interface AssessmentAttemptState {
  status: 'idle' | 'answering' | 'submitting' | 'completed';
  currentQuestionIndex: number;
  answers: Record<string, number>;
  startedAt: Date | null;
  completedAt: Date | null;
}

type AssessmentAction =
  | { type: 'START' }
  | { type: 'ANSWER'; questionId: string; value: number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'SUBMIT' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

function assessmentReducer(
  state: AssessmentAttemptState, 
  action: AssessmentAction
): AssessmentAttemptState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        status: 'answering',
        startedAt: new Date(),
      };
    case 'ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.value },
      };
    case 'NEXT_QUESTION':
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
      };
    case 'PREV_QUESTION':
      return {
        ...state,
        currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
      };
    case 'SUBMIT':
      return { ...state, status: 'submitting' };
    case 'COMPLETE':
      return {
        ...state,
        status: 'completed',
        completedAt: new Date(),
      };
    case 'RESET':
      return initialState;
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

export function AssessmentQuestionnaire({ questions }: Props) {
  const [state, dispatch] = useReducer(assessmentReducer, initialState);
  
  // Derived from state + props
  const currentQuestion = questions[state.currentQuestionIndex];
  const progress = (state.currentQuestionIndex / questions.length) * 100;
  const canGoBack = state.currentQuestionIndex > 0;
  const canSubmit = Object.keys(state.answers).length === questions.length;
  
  // ... render
}
```

### Incorrect: Storing derived state

```typescript
// BAD: Derived data stored as state
function UserList({ users }: Props) {
  const [filter, setFilter] = useState('');
  const [filteredUsers, setFilteredUsers] = useState(users); // DERIVED!
  const [userCount, setUserCount] = useState(users.length);  // DERIVED!
  
  // Effect to "sync" derived state - ANTI-PATTERN!
  useEffect(() => {
    const filtered = users.filter(u => 
      u.name.toLowerCase().includes(filter.toLowerCase())
    );
    setFilteredUsers(filtered);
    setUserCount(filtered.length);
  }, [users, filter]);
  
  // Problems:
  // 1. Extra renders (state update triggers re-render)
  // 2. Can be stale during render (before effect runs)
  // 3. More code to maintain
}

// GOOD: Compute derived values directly
function UserList({ users }: Props) {
  const [filter, setFilter] = useState('');
  
  // Derived - always in sync, no extra render
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(filter.toLowerCase())
  );
  const userCount = filteredUsers.length;
}
```

### Incorrect: Syncing props to state

```typescript
// BAD: Copying props to state
function ProfileEditor({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  
  // "Sync" when props change - ANTI-PATTERN!
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user]);
  
  // Problems:
  // 1. Stale state during render
  // 2. Overwritten unsaved changes
  // 3. Complex sync logic
}

// GOOD: Use key to reset, or derive from props
function ProfileEditor({ user }: { user: User }) {
  // Option 1: Uncontrolled with key reset
  // <ProfileEditor key={user.id} user={user} />
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  
  // Option 2: Track "edits" as delta from props
  const [edits, setEdits] = useState<Partial<User>>({});
  const displayName = edits.name ?? user.name;
  const displayEmail = edits.email ?? user.email;
}
```

### Incorrect: Premature state lifting

```typescript
// BAD: All state in parent "for flexibility"
function App() {
  // State for SearchBox
  const [searchQuery, setSearchQuery] = useState('');
  // State for FilterPanel
  const [activeFilters, setActiveFilters] = useState([]);
  // State for ItemList
  const [selectedId, setSelectedId] = useState(null);
  // State for Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  return (
    <div>
      <SearchBox query={searchQuery} onQueryChange={setSearchQuery} />
      <FilterPanel filters={activeFilters} onFiltersChange={setActiveFilters} />
      <ItemList selectedId={selectedId} onSelect={setSelectedId} />
      <Pagination page={currentPage} onPageChange={setCurrentPage} />
    </div>
  );
}

// GOOD: Colocate state with components that need it
function SearchBox() {
  const [query, setQuery] = useState(''); // Local!
  // ...
}

function Pagination() {
  const [page, setPage] = useState(1); // Local!
  // ...
}

// Only lift when actually needed by siblings
```
