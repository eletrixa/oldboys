---
rule: react/error-boundaries
title: React Error Boundaries
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [error-handling, error-boundaries, resilience, fallback-ui, sentry, monitoring]
---

# React Error Boundaries

Gracefully handle component errors to prevent full app crashes.

---

## Description

Error boundaries catch JavaScript errors in child component trees, log them, and display fallback UI instead of crashing the entire application. This rule defines when and how to use error boundaries.

---

## Specific Guidelines

### DO:
- Wrap route-level components with error boundaries
- Wrap third-party components with error boundaries
- Wrap async data-loading sections with error boundaries
- Provide meaningful fallback UI with recovery options
- Log errors to monitoring service (e.g., Sentry)
- Use Suspense with error boundaries for data fetching

### DON'T:
- Wrap every single component (too granular)
- Show raw error messages to users in production
- Forget to include recovery actions in fallback UI
- Use error boundaries for event handler errors
- Silently swallow errors without logging

---

## Implementation Details

### Error Boundary Component:
```typescript
import { Component, type ReactNode, type ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Strategic Placement:
```
App
├── ErrorBoundary (app-level - catches route errors)
│   ├── Header
│   └── Routes
│       ├── ErrorBoundary (route-level)
│       │   └── AssessmentPage
│       │       ├── ErrorBoundary (widget-level for risky sections)
│       │       │   └── AssessmentResults
│       │       └── AssessmentProgress
```

---

## Benefits

1. **Resilient UX**: Users see fallback instead of blank screen
2. **Error isolation**: One broken widget doesn't crash the page
3. **Debugging**: Component stack trace shows error source
4. **Recovery options**: Users can retry or navigate away
5. **Monitoring**: Errors are captured and reported

---

## Examples

### Correct: Route-level error boundary

```typescript
// App.tsx
import { ErrorBoundary } from '@app/components/error/ErrorBoundary';
import { RouteErrorFallback } from '@app/components/error/RouteErrorFallback';

function App() {
  return (
    <ErrorBoundary 
      fallback={<AppCrashFallback />}
      onError={(error) => console.error('App crashed:', error)}
    >
      <Header />
      <main>
        <Routes>
          <Route 
            path="/assessment/*" 
            element={
              <ErrorBoundary fallback={<RouteErrorFallback />}>
                <AssessmentRoutes />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/subscription/*" 
            element={
              <ErrorBoundary fallback={<RouteErrorFallback />}>
                <SubscriptionRoutes />
              </ErrorBoundary>
            } 
          />
        </Routes>
      </main>
    </ErrorBoundary>
  );
}
```

### Correct: Error boundary with Suspense

```typescript
import { Suspense } from 'react';
import { ErrorBoundary } from '@app/components/error/ErrorBoundary';

const AssessmentResults = lazy(() => import('./AssessmentResults'));

function AssessmentPage({ attemptId }: Props) {
  return (
    <div className="assessment-page">
      <AssessmentHeader attemptId={attemptId} />
      
      {/* Wrap async component with both error boundary and suspense */}
      <ErrorBoundary 
        fallback={
          <ResultsErrorFallback 
            message="Failed to load results"
            onRetry={() => window.location.reload()}
          />
        }
      >
        <Suspense fallback={<ResultsSkeleton />}>
          <AssessmentResults attemptId={attemptId} />
        </Suspense>
      </ErrorBoundary>
      
      <AssessmentFooter />
    </div>
  );
}
```

### Correct: Fallback UI with recovery options

```typescript
interface ErrorFallbackProps {
  error: Error | null;
  resetError?: () => void;
}

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-red-600" />
        <h3 className="text-lg font-semibold text-red-800">
          Something went wrong
        </h3>
      </div>
      
      <p className="mt-2 text-red-700">
        We couldn't load results. This might be a temporary issue.
      </p>
      
      {/* Development-only error details */}
      {import.meta.env.DEV && error && (
        <pre className="mt-4 overflow-auto rounded bg-red-100 p-2 text-xs">
          {error.message}
        </pre>
      )}
      
      <div className="mt-4 flex gap-3">
        <Button onClick={resetError} variant="primary">
          Try Again
        </Button>
        <Button onClick={() => window.location.href = '/'} variant="secondary">
          Go to Dashboard
        </Button>
        <Button 
          onClick={() => window.open('/support', '_blank')} 
          variant="ghost"
        >
          Contact Support
        </Button>
      </div>
    </div>
  );
}
```

### Correct: Widget-level boundary for risky components

```typescript
function Dashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Critical widgets - individual boundaries */}
      <ErrorBoundary fallback={<WidgetErrorCard title="Stats" />}>
        <StatsWidget />
      </ErrorBoundary>
      
      <ErrorBoundary fallback={<WidgetErrorCard title="Chart" />}>
        <ChartWidget /> {/* Third-party charting library */}
      </ErrorBoundary>
      
      <ErrorBoundary fallback={<WidgetErrorCard title="Activity" />}>
        <ActivityWidget />
      </ErrorBoundary>
      
      {/* Non-critical widgets can share boundary */}
      <ErrorBoundary fallback={<WidgetErrorCard title="Extras" />}>
        <RecommendationsWidget />
        <TipsWidget />
      </ErrorBoundary>
    </div>
  );
}

function WidgetErrorCard({ title }: { title: string }) {
  return (
    <Card className="flex items-center justify-center p-6 text-muted">
      <span>Unable to load {title}</span>
    </Card>
  );
}
```

### Incorrect: Too granular error boundaries

```typescript
// BAD: Boundary around every small component
function UserCard({ user }: Props) {
  return (
    <ErrorBoundary fallback={<span>Error</span>}>
      <Card>
        <ErrorBoundary fallback={<span>Error</span>}>
          <Avatar src={user.avatar} />
        </ErrorBoundary>
        <ErrorBoundary fallback={<span>Error</span>}>
          <h3>{user.name}</h3>
        </ErrorBoundary>
        <ErrorBoundary fallback={<span>Error</span>}>
          <span>{user.email}</span>
        </ErrorBoundary>
      </Card>
    </ErrorBoundary>
  );
}

// GOOD: Single boundary at appropriate level
function UserCard({ user }: Props) {
  return (
    <Card>
      <Avatar src={user.avatar} />
      <h3>{user.name}</h3>
      <span>{user.email}</span>
    </Card>
  );
}

// Boundary at list level where error might propagate
function UserList({ users }: Props) {
  return (
    <ErrorBoundary fallback={<UserListError />}>
      <ul>
        {users.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </ul>
    </ErrorBoundary>
  );
}
```

### Incorrect: No recovery options

```typescript
// BAD: Unhelpful fallback with no way forward
function BadFallback() {
  return <div>An error occurred</div>;
}

// Users are stuck - no way to recover!
```

### Incorrect: Using error boundary for event handlers

```typescript
// BAD: Error boundaries DON'T catch event handler errors
function BrokenButton() {
  const handleClick = () => {
    throw new Error('Click failed'); // NOT caught by boundary!
  };
  
  return (
    <ErrorBoundary fallback={<span>Error</span>}>
      <button onClick={handleClick}>Click me</button>
    </ErrorBoundary>
  );
}

// GOOD: Handle event errors with try/catch
function SafeButton() {
  const [error, setError] = useState<Error | null>(null);
  
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      Sentry.captureException(err);
    }
  };
  
  if (error) {
    return <ButtonErrorState error={error} onRetry={() => setError(null)} />;
  }
  
  return <button onClick={handleClick}>Click me</button>;
}
```

### Incorrect: Exposing raw errors in production

```typescript
// BAD: Shows technical error message to users
function BadFallback({ error }: { error: Error }) {
  return (
    <div>
      <h2>Error</h2>
      <pre>{error.stack}</pre> {/* Exposes internals! */}
    </div>
  );
}

// GOOD: User-friendly message, dev-only details
function GoodFallback({ error }: { error: Error }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>Please try again or contact support if the issue persists.</p>
      
      {/* Only in development */}
      {import.meta.env.DEV && (
        <details>
          <summary>Technical Details</summary>
          <pre>{error.stack}</pre>
        </details>
      )}
    </div>
  );
}
```
