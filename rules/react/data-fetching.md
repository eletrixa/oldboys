---
rule: react/data-fetching
title: React Data Fetching
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [data-fetching, react-query, tanstack-query, caching, mutations, optimistic-updates]
---

# React Data Fetching

Fetch data with React Query for caching, deduplication, and optimistic updates.

---

## Description

Data fetching in React should handle loading states, errors, caching, and revalidation. This rule covers using TanStack Query (React Query) for server state management, proper query key design, and mutation patterns.

---

## Specific Guidelines

### DO:
- Use a server-state library (React Query, SWR, or similar) for data fetching. In Next.js App Router with Server Components, client-side fetching libraries may not be needed
- Design query keys as arrays with dependencies
- Use `useMutation` with `onSuccess` invalidation
- Enable stale-while-revalidate for better UX
- Handle loading and error states explicitly
- Use `select` to transform data at query level

### DON'T:
- Fetch data in useEffect with useState
- Use string query keys (use arrays)
- Forget to invalidate queries after mutations
- Refetch on every render (use staleTime)
- Store server data in useState (let React Query manage)
- Make duplicate requests for same data

---

## Implementation Details

### Query Key Convention:

```typescript
// Hierarchical query keys for targeted invalidation
const queryKeys = {
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userPosts: (userId: string) => ['users', userId, 'posts'] as const,
  
  assessments: ['assessments'] as const,
  assessment: (id: string) => ['assessments', 'attempt', id] as const,
  assessmentResults: (attemptId: string) => ['assessments', 'results', attemptId] as const,
};
```

### Basic Query Pattern:

```typescript
function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

## Benefits

1. **Automatic caching**: No duplicate requests
2. **Background updates**: Fresh data without loading states
3. **Optimistic updates**: Instant UI feedback
4. **Request deduplication**: Multiple components share data
5. **Error retry**: Automatic retry with backoff

---

## Examples

### Correct: Query with loading/error states

```typescript
import { useQuery } from '@tanstack/react-query';

const assessmentKeys = {
  all: ['assessments'] as const,
  attempts: () => [...assessmentKeys.all, 'attempts'] as const,
  attempt: (id: string) => [...assessmentKeys.all, 'attempt', id] as const,
  results: (attemptId: string) => [...assessmentKeys.all, 'results', attemptId] as const,
};

function useAssessmentAttempt(attemptId: string) {
  return useQuery({
    queryKey: assessmentKeys.attempt(attemptId),
    queryFn: async () => {
      const response = await fetch(`/api/assessments/attempts/${attemptId}`);
      if (!response.ok) throw new Error('Failed to fetch attempt');
      return response.json() as Promise<AssessmentAttempt>;
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });
}

function AssessmentAttemptView({ attemptId }: { attemptId: string }) {
  const { data, isLoading, error, refetch } = useAssessmentAttempt(attemptId);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (error) {
    return (
      <ErrorCard 
        message="Failed to load attempt" 
        onRetry={refetch}
      />
    );
  }

  return <AttemptDetails attempt={data} />;
}
```

### Correct: Mutation with cache invalidation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProfileUpdateInput) => {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Update failed');
      return response.json() as Promise<Profile>;
    },
    onSuccess: (updatedProfile) => {
      // Update the cache directly
      queryClient.setQueryData(['profile'], updatedProfile);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

function ProfileEditor() {
  const { mutate, isPending } = useUpdateProfile();

  const handleSave = (data: ProfileUpdateInput) => {
    mutate(data, {
      onSuccess: () => toast.success('Profile updated!'),
    });
  };

  return (
    <ProfileForm 
      onSubmit={handleSave} 
      disabled={isPending}
    />
  );
}
```

### Correct: Optimistic update

```typescript
function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => toggleFavoriteApi(itemId),
    
    onMutate: async (itemId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['items'] });

      // Snapshot previous value
      const previousItems = queryClient.getQueryData<Item[]>(['items']);

      // Optimistically update
      queryClient.setQueryData<Item[]>(['items'], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? { ...item, isFavorite: !item.isFavorite }
            : item
        )
      );

      // Return context for rollback
      return { previousItems };
    },

    onError: (err, itemId, context) => {
      // Rollback on error
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems);
      }
      toast.error('Failed to update');
    },

    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

### Correct: Dependent queries

```typescript
function useUserWithPosts(userId: string) {
  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  const postsQuery = useQuery({
    queryKey: ['user', userId, 'posts'],
    queryFn: () => fetchUserPosts(userId),
    // Only fetch posts if user exists
    enabled: !!userQuery.data,
  });

  return {
    user: userQuery.data,
    posts: postsQuery.data,
    isLoading: userQuery.isLoading || postsQuery.isLoading,
    error: userQuery.error || postsQuery.error,
  };
}
```

### Correct: Infinite query for pagination

```typescript
function useInfiniteHistory() {
  return useInfiniteQuery({
    queryKey: ['assessments', 'history'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/assessments/history?offset=${pageParam}&limit=20`
      );
      return response.json() as Promise<{
        items: AssessmentAttempt[];
        nextOffset: number | null;
      }>;
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });
}

function AssessmentHistory() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteHistory();

  const allAttempts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      {allAttempts.map((attempt) => (
        <AttemptCard key={attempt.id} attempt={attempt} />
      ))}
      
      {hasNextPage && (
        <button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Incorrect: useEffect + useState for fetching

```typescript
// BAD: Manual fetch with useState
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  // No caching, no deduplication, no background refresh
  // Every mount = new request
}

// GOOD: React Query
function UserProfile({ userId }: Props) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
  // Automatic caching, deduplication, and refresh
}
```

### Incorrect: String query keys

```typescript
// BAD: String keys don't support invalidation patterns
useQuery({
  queryKey: 'user-123', // Can't invalidate all 'user-*'
  queryFn: () => fetchUser('123'),
});

// GOOD: Array keys support partial matching
useQuery({
  queryKey: ['users', '123'],
  queryFn: () => fetchUser('123'),
});

// Now you can invalidate:
queryClient.invalidateQueries({ queryKey: ['users'] }); // All users
queryClient.invalidateQueries({ queryKey: ['users', '123'] }); // Specific user
```

### Incorrect: Forgetting to invalidate

```typescript
// BAD: Mutation doesn't update cache
const mutation = useMutation({
  mutationFn: updateUser,
  // Missing onSuccess - stale data shown!
});

// GOOD: Invalidate related queries
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});
```
