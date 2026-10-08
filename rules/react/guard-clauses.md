---
rule: react/guard-clauses
title: React Guard Clauses and Early Returns
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [guard-clauses, early-returns, readability, control-flow, conditional-rendering]
---

# React Guard Clauses and Early Returns

Use early returns for invalid states before the main render logic.

---

## Description

Guard clauses (early returns) handle edge cases at the beginning of a function or component, keeping the main logic clean and reducing nesting. In React components, guards handle loading, error, and empty states before the happy path.

---

## Specific Guidelines

### DO:
- Return early for loading states
- Return early for error states
- Return early for null/undefined data
- Return early for empty arrays/collections
- Order guards from most common to least common
- Keep main render logic at zero nesting level

### DON'T:
- Nest render logic inside if/else blocks
- Use ternaries for complex conditional rendering
- Mix loading/error checks with main logic
- Repeat null checks throughout the component
- Return null without handling the case properly

---

## Implementation Details

### Component Guard Order:

```typescript
function Component({ data, isLoading, error }: Props) {
  // 1. Loading state (most common early state)
  if (isLoading) return <Skeleton />;

  // 2. Error state
  if (error) return <ErrorDisplay error={error} />;

  // 3. Empty/null data
  if (!data) return <EmptyState />;

  // 4. Empty collection
  if (data.items.length === 0) return <NoItems />;

  // 5. Main render (happy path, no nesting)
  return <MainContent data={data} />;
}
```

### Benefits of Guards:

- Reduced cognitive load (handle edge cases first)
- Flat code structure (no deep nesting)
- Clear error handling (each case explicit)
- Easier testing (each branch isolated)

---

## Benefits

1. **Readability**: Edge cases handled upfront
2. **Maintainability**: Main logic not buried in conditionals
3. **Testing**: Each return path easily tested
4. **Debugging**: Clear control flow
5. **Code review**: Easy to verify all cases handled

---

## Examples

### Correct: Component with guard clauses

```typescript
interface AssessmentResultsProps {
  attemptId: string;
}

function AssessmentResults({ attemptId }: AssessmentResultsProps) {
  const { data: attempt, isLoading, error } = useAssessmentAttempt(attemptId);
  const { data: scores } = useAssessmentScores(attemptId);

  // Guard 1: Loading
  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Guard 2: Error
  if (error) {
    return (
      <ErrorCard
        title="Failed to load results"
        message={error.message}
        retry={() => window.location.reload()}
      />
    );
  }

  // Guard 3: Not found
  if (!attempt) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="Attempt not found"
        description="This assessment attempt doesn't exist or you don't have access."
      />
    );
  }

  // Guard 4: Not completed
  if (attempt.status !== 'completed') {
    return (
      <InProgressCard
        status={attempt.status}
        startedAt={attempt.startedAt}
      />
    );
  }

  // Guard 5: No scores yet
  if (!scores || scores.length === 0) {
    return (
      <ProcessingCard
        message="Your results are being calculated..."
      />
    );
  }

  // Main render - happy path, no nesting
  return (
    <div className="space-y-8">
      <ResultsHeader attempt={attempt} />
      <ScoreGrid scores={scores} />
      <DimensionBreakdown scores={scores} />
      <RecommendationsSection attemptId={attemptId} />
    </div>
  );
}
```

### Correct: Guards in helper functions

```typescript
function processUserData(user: User | null | undefined): ProcessedUser {
  // Guard: null check
  if (!user) {
    return { displayName: 'Guest', isComplete: false };
  }

  // Guard: incomplete profile
  if (!user.profile) {
    return { displayName: user.email, isComplete: false };
  }

  // Guard: missing required fields
  if (!user.profile.firstName || !user.profile.lastName) {
    return { displayName: user.email, isComplete: false };
  }

  // Main logic
  return {
    displayName: `${user.profile.firstName} ${user.profile.lastName}`,
    isComplete: true,
    avatarUrl: user.profile.avatarUrl,
    tier: user.subscription?.tier ?? 'free',
  };
}
```

### Correct: Guards with custom hooks

```typescript
function useAssessmentFlow(attemptId: string | null) {
  const [state, setState] = useState<FlowState>('idle');

  // Guard in effect
  useEffect(() => {
    if (!attemptId) return; // Early return, no cleanup needed

    const subscription = subscribeToAttempt(attemptId, (update) => {
      setState(update.status);
    });

    return () => subscription.unsubscribe();
  }, [attemptId]);

  // Guard in callback
  const submit = useCallback(async () => {
    if (!attemptId) return; // Guard
    if (state !== 'ready') return; // Guard

    setState('submitting');
    await submitAttempt(attemptId);
    setState('completed');
  }, [attemptId, state]);

  return { state, submit };
}
```

### Correct: Guards for list rendering

```typescript
function AttemptsList({ attempts, isLoading }: AttemptsListProps) {
  // Guard: Loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <AttemptCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Guard: Empty list
  if (!attempts || attempts.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title="No attempts yet"
        description="Start your first assessment to see results here."
        action={<StartButton />}
      />
    );
  }

  // Main render
  return (
    <div className="space-y-4">
      {attempts.map((attempt) => (
        <AttemptCard key={attempt.id} attempt={attempt} />
      ))}
    </div>
  );
}
```

### Incorrect: Nested conditionals

```typescript
// BAD: Deep nesting makes logic hard to follow
function AssessmentResults({ attemptId }: Props) {
  const { data, isLoading, error } = useAssessmentAttempt(attemptId);

  return (
    <div>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <ErrorCard error={error} />
      ) : !data ? (
        <EmptyState />
      ) : data.status !== 'completed' ? (
        <InProgress />
      ) : (
        // Main logic buried 5 levels deep!
        <div>
          <Header />
          <Scores />
        </div>
      )}
    </div>
  );
}

// GOOD: Early returns
function AssessmentResults({ attemptId }: Props) {
  const { data, isLoading, error } = useAssessmentAttempt(attemptId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;
  if (!data) return <EmptyState />;
  if (data.status !== 'completed') return <InProgress />;

  // Main logic at top level
  return (
    <div>
      <Header />
      <Scores />
    </div>
  );
}
```

### Incorrect: Mixing guards with main logic

```typescript
// BAD: Checks scattered throughout
function UserProfile({ userId }: Props) {
  const { data: user } = useUser(userId);
  const { data: stats } = useUserStats(userId);

  return (
    <div>
      {/* Check scattered in render */}
      {user ? (
        <div>
          <h1>{user.name}</h1>
          {/* Another check mid-render */}
          {user.profile ? (
            <Avatar src={user.profile.avatar} />
          ) : null}
        </div>
      ) : null}

      {/* More scattered checks */}
      {stats && stats.length > 0 ? (
        <StatsGrid stats={stats} />
      ) : null}
    </div>
  );
}

// GOOD: Guards upfront
function UserProfile({ userId }: Props) {
  const { data: user, isLoading } = useUser(userId);
  const { data: stats } = useUserStats(userId);

  if (isLoading) return <ProfileSkeleton />;
  if (!user) return <UserNotFound />;

  // Main render, all data guaranteed
  return (
    <div>
      <h1>{user.name}</h1>
      {user.profile && <Avatar src={user.profile.avatar} />}
      {stats && stats.length > 0 && <StatsGrid stats={stats} />}
    </div>
  );
}
```

### Incorrect: Silent null returns

```typescript
// BAD: Silent null without handling
function AttemptCard({ attempt }: Props) {
  if (!attempt) return null; // Silent failure!

  return <Card>{attempt.title}</Card>;
}

// GOOD: Explicit empty state or error
function AttemptCard({ attempt }: Props) {
  if (!attempt) {
    return <EmptyCard message="No attempt data" />;
  }

  return <Card>{attempt.title}</Card>;
}

// BETTER: Make prop required and handle at parent
interface AttemptCardProps {
  attempt: Attempt; // Not optional!
}

function AttemptCard({ attempt }: AttemptCardProps) {
  // No null check needed - parent guarantees data
  return <Card>{attempt.title}</Card>;
}
```
