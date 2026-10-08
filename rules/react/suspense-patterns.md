---
rule: react/suspense-patterns
title: React Suspense Patterns
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [suspense, lazy-loading, code-splitting, performance, loading-states, preloading]
---

# React Suspense Patterns

Use Suspense and lazy loading for better loading UX and code splitting.

---

## Description

React Suspense provides declarative loading states for async operations. This rule covers code splitting with `React.lazy`, Suspense boundaries, and streaming patterns for optimal user experience.

---

## Specific Guidelines

### DO:
- Use `React.lazy` for route-level code splitting
- Wrap lazy components in Suspense with meaningful fallbacks
- Place Suspense boundaries strategically (not too high, not too low)
- Use multiple Suspense boundaries for independent loading
- Preload components on user intent (hover, focus)
- Combine with Error Boundaries for complete error handling

### DON'T:
- Lazy load tiny components (overhead > benefit)
- Put Suspense at app root only (blocks entire UI)
- Use generic "Loading..." for all fallbacks
- Forget Error Boundaries (Suspense doesn't catch errors)
- Lazy load above-the-fold content

---

## Implementation Details

### Route-Level Code Splitting:

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </Suspense>
  );
}
```

### Preloading Pattern:

```typescript
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));

// Preload on hover
function NavLink({ to, children }: NavLinkProps) {
  const preload = () => {
    if (to === '/assessment') {
      import('./pages/AssessmentPage');
    }
  };

  return (
    <Link to={to} onMouseEnter={preload} onFocus={preload}>
      {children}
    </Link>
  );
}
```

---

## Benefits

1. **Faster initial load**: Only load code that's needed
2. **Better UX**: Meaningful loading states per section
3. **Smaller bundles**: Code split by route/feature
4. **Progressive loading**: Critical content first
5. **Graceful degradation**: Fallbacks during load

---

## Examples

### Correct: Strategic Suspense boundaries

```typescript
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@app/components/ErrorBoundary';

// Lazy load heavy components
const AssessmentResults = lazy(() => import('./AssessmentResults'));
const RecommendationsList = lazy(() => import('./RecommendationsList'));
const HistoryChart = lazy(() => import('./HistoryChart'));

function AssessmentDashboard() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Main content - critical path */}
      <div className="col-span-2">
        <ErrorBoundary fallback={<ResultsError />}>
          <Suspense fallback={<ResultsSkeleton />}>
            <AssessmentResults />
          </Suspense>
        </ErrorBoundary>
      </div>
      
      {/* Sidebar content - can load independently */}
      <div>
        <ErrorBoundary fallback={<RecommendationsError />}>
          <Suspense fallback={<RecommendationsSkeleton />}>
            <RecommendationsList />
          </Suspense>
        </ErrorBoundary>
      </div>
      
      <div>
        <ErrorBoundary fallback={<ChartError />}>
          <Suspense fallback={<ChartSkeleton />}>
            <HistoryChart />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
```

### Correct: Named exports with lazy

```typescript
// components/HeavyEditor.tsx
export function HeavyEditor() { /* ... */ }
export function EditorToolbar() { /* ... */ }

// Lazy load named export
const HeavyEditor = lazy(() =>
  import('./components/HeavyEditor').then(module => ({
    default: module.HeavyEditor,
  }))
);

// Or with a helper
function lazyNamed<T extends React.ComponentType<any>>(
  factory: () => Promise<{ [key: string]: T }>,
  name: string
) {
  return lazy(() =>
    factory().then(module => ({ default: module[name] as T }))
  );
}

const EditorToolbar = lazyNamed(
  () => import('./components/HeavyEditor'),
  'EditorToolbar'
);
```

### Correct: Skeleton matching content structure

```typescript
function ResultsSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Match the structure of the actual results */}
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded" />
        ))}
      </div>
      
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 bg-gray-200 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

// Usage
<Suspense fallback={<ResultsSkeleton />}>
  <AssessmentResults attemptId={attemptId} />
</Suspense>
```

### Correct: Preload on route change intent

```typescript
import { lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Create a map of preload functions
const pagePreloaders = {
  assessment: () => import('./pages/AssessmentPage'),
  results: () => import('./pages/ResultsPage'),
  settings: () => import('./pages/SettingsPage'),
};

function usePreloadPage() {
  return useCallback((page: keyof typeof pagePreloaders) => {
    pagePreloaders[page]();
  }, []);
}

function DashboardCard({ title, href, page }: CardProps) {
  const navigate = useNavigate();
  const preload = usePreloadPage();

  return (
    <div
      className="cursor-pointer p-4 rounded-lg border"
      onClick={() => navigate(href)}
      onMouseEnter={() => preload(page)}
      onFocus={() => preload(page)}
      role="link"
      tabIndex={0}
    >
      <h3>{title}</h3>
    </div>
  );
}
```

### Correct: SuspenseList for coordinated loading

```typescript
import { Suspense, SuspenseList } from 'react';

function ProfilePage() {
  return (
    <SuspenseList revealOrder="forwards" tail="collapsed">
      {/* Components reveal in order, hiding later skeletons */}
      <Suspense fallback={<HeaderSkeleton />}>
        <ProfileHeader />
      </Suspense>
      
      <Suspense fallback={<StatsSkeleton />}>
        <ProfileStats />
      </Suspense>
      
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
    </SuspenseList>
  );
}
```

### Incorrect: Single Suspense at root

```typescript
// BAD: Everything blocked during any lazy load
function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Header /> {/* Blocked! */}
      <Sidebar /> {/* Blocked! */}
      <Routes>
        <Route path="/heavy" element={<HeavyPage />} />
      </Routes>
      <Footer /> {/* Blocked! */}
    </Suspense>
  );
}

// GOOD: Granular Suspense boundaries
function App() {
  return (
    <>
      <Header />
      <Sidebar />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/heavy" element={<HeavyPage />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}
```

### Incorrect: Lazy loading tiny components

```typescript
// BAD: Overhead exceeds benefit
const SmallIcon = lazy(() => import('./SmallIcon')); // 500 bytes
const Tooltip = lazy(() => import('./Tooltip')); // 1KB

function Button() {
  return (
    <Suspense fallback={null}>
      <SmallIcon />
      <Suspense fallback={null}>
        <Tooltip />
      </Suspense>
    </Suspense>
  );
}

// GOOD: Only lazy load substantial components
import { SmallIcon } from './SmallIcon';
import { Tooltip } from './Tooltip';

const HeavyDataGrid = lazy(() => import('./HeavyDataGrid')); // 50KB
```

### Incorrect: Generic loading fallback

```typescript
// BAD: Same fallback for everything
<Suspense fallback={<div>Loading...</div>}>
  <AssessmentResults />
</Suspense>

<Suspense fallback={<div>Loading...</div>}>
  <UserProfile />
</Suspense>

// GOOD: Context-aware skeletons
<Suspense fallback={<ResultsSkeleton />}>
  <AssessmentResults />
</Suspense>

<Suspense fallback={<UserProfileSkeleton />}>
  <UserProfile />
</Suspense>
```

### Incorrect: Missing Error Boundary

```typescript
// BAD: Suspense doesn't catch errors
<Suspense fallback={<Loading />}>
  <FailingComponent /> {/* Error crashes the app! */}
</Suspense>

// GOOD: Combine with Error Boundary
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Loading />}>
    <FailingComponent /> {/* Error caught and handled */}
  </Suspense>
</ErrorBoundary>
```
