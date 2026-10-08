---
rule: react/auth-context
title: Auth Context Pattern
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [authentication, context, supabase, performance, singleton]
---

# React Auth Context Pattern

## Summary

Use a singleton `AuthProvider` context for authentication state when your auth provider creates per-component subscriptions (e.g., Supabase). If using JWT tokens, Auth0 SDK, or Firebase Auth, per-component subscriptions are not an issue and this optimization may be unnecessary.

## Rule

### DO: Use `useAuthContext()` for auth state

```typescript
import { useAuthContext } from '@/features/auth/context';

function MyComponent() {
  const { user, session, loading } = useAuthContext();
  
  if (loading) return <Spinner />;
  if (!user) return <LoginPrompt />;
  
  return <AuthenticatedContent user={user} />;
}
```

### DON'T: Create direct auth subscriptions

```typescript
// BAD: Creates new subscription per component
function MyComponent() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => setUser(session?.user)
    );
    return () => subscription.unsubscribe();
  }, []);
}
```

### DON'T: Use deprecated hooks

```typescript
// DEPRECATED - shows console.warn in development
import { useAuthState } from '@/features/auth/hooks/useAuthState';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
```

## Why This Matters

### The Problem: O(N) Subscriptions

Each `supabase.auth.onAuthStateChange()` creates a WebSocket connection:

| Components | Subscriptions | Connections at 1000 Users |
|------------|---------------|---------------------------|
| 8 per tree | 8 per user | 8,000 connections |
| 12 per tree | 12 per user | 12,000 connections |

**Supabase limit: 200 connections per project** -- Connection failures, random logouts

### The Solution: O(1) Subscription

`AuthProvider` creates ONE subscription for the entire app:

| Architecture | Subscriptions | Connections at 1000 Users |
|--------------|---------------|---------------------------|
| AuthProvider | 1 per app | 1,000 connections |

**87.5% reduction in auth overhead**

## Architecture

```
App.tsx
  └── QueryClientProvider
        └── AuthProvider          <-- ONE subscription here
              └── AppContent
                    ├── Header    <-- uses useAuthContext()
                    ├── Sidebar   <-- uses useAuthContext()
                    └── Content   <-- uses useAuthContext()
```

## API Reference

### `useAuthContext()`

Returns the current auth state from the singleton provider.

```typescript
interface AuthContextValue {
  user: User | null;      // Current authenticated user
  session: Session | null; // Current Supabase session
  loading: boolean;       // True during initial auth check
}
```

**Throws** if used outside `<AuthProvider>`.

### `AuthProvider`

Wraps your app to provide auth context. Must be near the root.

```tsx
// App.tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <AppContent />
  </AuthProvider>
</QueryClientProvider>
```

## Migration Guide

### From `useAuthState()`

```typescript
// Before (deprecated)
import { useAuthState } from '@/features/auth/hooks/useAuthState';
const { user, loading } = useAuthState();

// After (recommended)
import { useAuthContext } from '@/features/auth/context';
const { user, loading } = useAuthContext();
```

### From `useAuthSession()`

```typescript
// Before (deprecated)
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
const { user, session, loading } = useAuthSession();

// After (recommended)
import { useAuthContext } from '@/features/auth/context';
const { user, session, loading } = useAuthContext();
```

### From `useAuth()`

`useAuth()` is still valid for auth **actions** (signIn, signOut, etc.). For **state only**, prefer `useAuthContext()`:

```typescript
// For state only
const { user, loading } = useAuthContext();

// For actions
const { signIn, signOut, signUp } = useAuth();
```

## File Locations

| File | Purpose |
|------|---------|
| `src/features/auth/context/AuthContext.ts` | Context definition |
| `src/features/auth/context/AuthProvider.tsx` | Singleton provider |
| `src/features/auth/context/index.ts` | Public exports |

## Related Rules

- [React Context Patterns](./context-patterns.md) - General context guidelines
- [React State Management](./state-management.md) - State colocation principles
