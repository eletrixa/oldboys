---
rule: react/context-patterns
title: React Context Patterns
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [context, state-management, providers, performance, memoization]
---

# React Context Patterns

Use Context for cross-cutting concerns, not general state management.

---

## Description

React Context is designed for data that needs to be accessible throughout a component tree without prop drilling. This rule covers when to use Context, how to structure providers, and performance considerations.

---

## Specific Guidelines

### DO:
- Use Context for theme, locale, auth, and feature flags
- Split contexts by domain (AuthContext, ThemeContext)
- Provide a custom hook for consuming context (`useAuth`)
- Memoize context values to prevent unnecessary re-renders
- Place providers as low as possible in the tree
- Use Context for dependency injection in testing

### DON'T:
- Use Context as a global state manager
- Put frequently changing state in Context
- Create a single "AppContext" with everything
- Forget to memoize context values
- Access context without the custom hook
- Nest too many providers (provider hell)

---

## Implementation Details

### Context with Custom Hook:

```typescript
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Memoized Provider Value:

```typescript
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (credentials: Credentials) => {
    const user = await authService.login(credentials);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  // Memoize to prevent re-renders
  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Benefits

1. **No prop drilling**: Access data anywhere in tree
2. **Clean component APIs**: No pass-through props
3. **Testing**: Easy to mock via provider
4. **Separation of concerns**: Domain-specific contexts
5. **Type safety**: Custom hooks enforce proper usage

---

## Examples

### Correct: Domain-specific context with custom hook

```typescript
// contexts/SubscriptionContext.tsx
import { createContext, useContext, useMemo, useState, useCallback } from 'react';

interface Subscription {
  tier: 'free' | 'basic' | 'premium';
  expiresAt: Date | null;
  features: string[];
}

interface SubscriptionContextValue {
  subscription: Subscription | null;
  isLoading: boolean;
  hasFeature: (feature: string) => boolean;
  upgrade: (tier: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    subscriptionService.get()
      .then(setSubscription)
      .finally(() => setIsLoading(false));
  }, []);

  const hasFeature = useCallback((feature: string): boolean => {
    return subscription?.features.includes(feature) ?? false;
  }, [subscription?.features]);

  const upgrade = useCallback(async (tier: string) => {
    const updated = await subscriptionService.upgrade(tier);
    setSubscription(updated);
  }, []);

  const value = useMemo(
    () => ({ subscription, isLoading, hasFeature, upgrade }),
    [subscription, isLoading, hasFeature, upgrade]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Usage in component
function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isLoading } = useSubscription();

  if (isLoading) return <Skeleton />;
  if (!hasFeature(feature)) return fallback ?? null;
  
  return <>{children}</>;
}
```

### Correct: Compose providers cleanly

```typescript
// providers/AppProviders.tsx
interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Or use a compose utility
function composeProviders(...providers: React.FC<{ children: ReactNode }>[]) {
  return ({ children }: { children: ReactNode }) =>
    providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
}

const AppProviders = composeProviders(
  QueryClientProvider,
  AuthProvider,
  SubscriptionProvider,
  ThemeProvider,
  ToastProvider
);
```

### Correct: Split read and write contexts

```typescript
// Separate contexts for state and dispatch
// Prevents re-renders when only reading state

interface CounterState {
  count: number;
}

type CounterAction = 
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set'; value: number };

const CounterStateContext = createContext<CounterState | null>(null);
const CounterDispatchContext = createContext<Dispatch<CounterAction> | null>(null);

export function useCounterState(): CounterState {
  const context = useContext(CounterStateContext);
  if (!context) throw new Error('Missing CounterProvider');
  return context;
}

export function useCounterDispatch(): Dispatch<CounterAction> {
  const context = useContext(CounterDispatchContext);
  if (!context) throw new Error('Missing CounterProvider');
  return context;
}

function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    case 'decrement': return { count: state.count - 1 };
    case 'set': return { count: action.value };
  }
}

export function CounterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <CounterStateContext.Provider value={state}>
      <CounterDispatchContext.Provider value={dispatch}>
        {children}
      </CounterDispatchContext.Provider>
    </CounterStateContext.Provider>
  );
}

// Components that only dispatch don't re-render on state change
function IncrementButton() {
  const dispatch = useCounterDispatch();
  return <button onClick={() => dispatch({ type: 'increment' })}>+</button>;
}

// Components that read state re-render when it changes
function CountDisplay() {
  const { count } = useCounterState();
  return <span>{count}</span>;
}
```

### Correct: Context for testing/mocking

```typescript
// Easy to mock in tests
function TestAuthProvider({ 
  children,
  user = null,
  isLoading = false,
}: {
  children: ReactNode;
  user?: User | null;
  isLoading?: boolean;
}) {
  const value = useMemo(() => ({
    user,
    isLoading,
    login: vi.fn(),
    logout: vi.fn(),
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// In tests
render(
  <TestAuthProvider user={mockUser}>
    <ComponentUnderTest />
  </TestAuthProvider>
);
```

### Incorrect: Everything in one context

```typescript
// BAD: One context with everything
interface AppContextValue {
  user: User | null;
  theme: Theme;
  locale: string;
  notifications: Notification[];
  cart: CartItem[];
  products: Product[];
  // Everything changes = everything re-renders
}

const AppContext = createContext<AppContextValue>(/* ... */);

// GOOD: Split by domain
const AuthContext = createContext<AuthContextValue>(/* ... */);
const ThemeContext = createContext<ThemeContextValue>(/* ... */);
const CartContext = createContext<CartContextValue>(/* ... */);
```

### Incorrect: Frequently changing values

```typescript
// BAD: Mouse position in context = constant re-renders
function MouseProvider({ children }: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY }); // 60fps updates!
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Every mouse move re-renders all consumers!
  return (
    <MouseContext.Provider value={position}>
      {children}
    </MouseContext.Provider>
  );
}

// GOOD: Use refs or subscription pattern for high-frequency updates
```

### Incorrect: Missing memoization

```typescript
// BAD: New object every render
function BadProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);

  // Creates new object every render!
  const value = {
    user,
    login: async (creds: Credentials) => { /* ... */ },
    logout: async () => { /* ... */ },
  };

  return (
    <AuthContext.Provider value={value}>
      {children} {/* All consumers re-render on any parent re-render! */}
    </AuthContext.Provider>
  );
}

// GOOD: Memoize everything
function GoodProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (creds: Credentials) => { /* ... */ }, []);
  const logout = useCallback(async () => { /* ... */ }, []);

  const value = useMemo(
    () => ({ user, login, logout }),
    [user, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```
