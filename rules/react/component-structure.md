---
rule: react/component-structure
title: React Component Structure
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [components, organization, file-structure, imports, best-practices]
---

# React Component Structure

Organize components with consistent structure, clear prop interfaces, and proper file organization.

---

## Description

Consistent component structure makes code predictable and maintainable. This rule defines the standard template for React components, including import ordering, prop interfaces, hook placement, and rendering patterns.

---

## Specific Guidelines

### DO:
- Use function declarations for components, not arrow function expressions at top level
- Keep components under ~150 lines of code
- Define props interface above the component with `ComponentNameProps` naming
- Order imports: external libraries -> internal modules -> relative imports -> types
- Order component internals: hooks -> derived values -> handlers -> early returns -> render
- Co-locate component-specific types with the component

### DON'T:
- Mix business logic with presentation in the same component
- Inline complex prop types in the function signature
- Define callbacks inside JSX (use `useCallback` or define before render)
- Create monolithic components (>200 LOC is a red flag)
- Use index files as component files

---

## Implementation Details

### Component Template:
```typescript
// 1. External imports
import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

// 2. Internal imports (using path aliases)
import { Button } from '@app/components/ui/Button';
import { useAuth } from '@app/hooks/useAuth';

// 3. Relative imports (same feature)
import { FeatureCard } from './FeatureCard';

// 4. Types (last)
import type { User } from '@app/types/user';

// 5. Props interface (named ComponentNameProps)
interface UserProfileProps {
  user: User;
  className?: string;
  onUpdate?: (user: User) => void;
}

// 6. Component (function declaration)
export function UserProfile({ user, className, onUpdate }: UserProfileProps) {
  // 6a. Hooks first (in order: React hooks, custom hooks)
  const [isEditing, setIsEditing] = useState(false);
  const { currentUser } = useAuth();
  
  // 6b. Derived values
  const isOwnProfile = currentUser?.id === user.id;
  const displayName = user.nickname ?? user.name;
  
  // 6c. Handlers
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  const handleSave = useCallback((updated: User) => {
    setIsEditing(false);
    onUpdate?.(updated);
  }, [onUpdate]);
  
  // 6d. Early returns
  if (!user) return null;
  
  // 6e. Main render
  return (
    <div className={clsx('user-profile', className)}>
      <Avatar src={user.avatarUrl} />
      <h2>{displayName}</h2>
      {isOwnProfile && (
        <Button onClick={handleEdit}>Edit Profile</Button>
      )}
    </div>
  );
}
```

---

## Benefits

1. **Predictable structure**: Know where to find things in any component
2. **Easier reviews**: Consistent pattern speeds up code review
3. **Better separation**: Clear distinction between logic and presentation
4. **Maintainability**: Small components are easier to modify
5. **Testability**: Isolated components are easier to test

---

## Examples

### Correct: Well-structured component

```typescript
import { useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';

import { Card } from '@app/components/ui/Card';
import { Button } from '@app/components/ui/Button';
import { useSubscription } from '@app/features/subscription';
import { formatCurrency } from '@app/lib/format';

import type { Plan } from './types';

interface PlanSelectorProps {
  plans: readonly Plan[];
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
  className?: string;
}

export function PlanSelector({
  plans,
  selectedPlanId,
  onSelect,
  className,
}: PlanSelectorProps) {
  // Hooks
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { currentPlan } = useSubscription();
  
  // Derived values
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.price - b.price),
    [plans]
  );
  
  const isUpgrade = useMemo(() => {
    if (!currentPlan || !selectedPlanId) return false;
    const selected = plans.find(p => p.id === selectedPlanId);
    return selected && selected.price > currentPlan.price;
  }, [currentPlan, selectedPlanId, plans]);
  
  // Handlers
  const handleSelect = useCallback((planId: string) => {
    onSelect(planId);
  }, [onSelect]);
  
  const handleMouseEnter = useCallback((planId: string) => {
    setHoveredId(planId);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
  }, []);
  
  // Early returns
  if (plans.length === 0) {
    return <div className="text-muted">No plans available</div>;
  }
  
  // Render
  return (
    <div className={clsx('grid gap-4 md:grid-cols-3', className)}>
      {sortedPlans.map(plan => (
        <Card
          key={plan.id}
          className={clsx(
            'cursor-pointer transition-shadow',
            plan.id === selectedPlanId && 'ring-2 ring-primary',
            plan.id === hoveredId && 'shadow-lg'
          )}
          onClick={() => handleSelect(plan.id)}
          onMouseEnter={() => handleMouseEnter(plan.id)}
          onMouseLeave={handleMouseLeave}
        >
          <Card.Header>
            <h3>{plan.name}</h3>
            <p className="text-2xl font-bold">
              {formatCurrency(plan.price)}
            </p>
          </Card.Header>
          <Card.Body>
            <ul>
              {plan.features.map(feature => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}
```

### Correct: Extracting sub-components

```typescript
// ResultsView.tsx - Main component
import { ScoreCard } from './ScoreCard';
import { Recommendations } from './Recommendations';
import { ResultsHeader } from './ResultsHeader';

interface ResultsViewProps {
  result: AssessmentResult;
}

export function ResultsView({ result }: ResultsViewProps) {
  return (
    <div className="space-y-6">
      <ResultsHeader 
        names={result.names}
        completedAt={result.completedAt}
      />
      <ScoreCard scores={result.scores} />
      <Recommendations 
        recommendations={result.recommendations}
      />
    </div>
  );
}

// ScoreCard.tsx - Extracted sub-component (~50 LOC)
interface ScoreCardProps {
  scores: Scores;
}

export function ScoreCard({ scores }: ScoreCardProps) {
  const overallScore = useMemo(
    () => calculateOverall(scores),
    [scores]
  );
  
  return (
    <Card>
      <Card.Header>
        <h2>Your Score</h2>
      </Card.Header>
      <Card.Body>
        <ScoreGauge value={overallScore} />
        <ScoreBreakdown scores={scores} />
      </Card.Body>
    </Card>
  );
}
```

### Incorrect: Monolithic component

```typescript
// BAD: 300+ lines, does everything
export function ResultsPage({ attemptId }: Props) {
  // 50 lines of hooks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSharing, setIsSharing] = useState(false);
  // ... 20 more useState hooks
  
  // 100 lines of effects
  useEffect(() => { /* fetch logic */ }, [attemptId]);
  useEffect(() => { /* analytics */ }, [result]);
  // ... more effects
  
  // 50 lines of handlers
  const handleShare = async () => { /* 30 lines */ };
  const handlePrint = () => { /* 20 lines */ };
  
  // 100 lines of JSX with nested conditionals
  return (
    <div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <Error />
      ) : (
        <div>
          {/* 80 lines of nested JSX */}
        </div>
      )}
    </div>
  );
}

// GOOD: Split into focused components
// ResultsPage.tsx (~50 LOC)
// ResultsHeader.tsx (~40 LOC)
// ScoreOverview.tsx (~60 LOC)
// DimensionDetails.tsx (~50 LOC)
// ShareDialog.tsx (~40 LOC)
```

### Incorrect: Inline callbacks in JSX

```typescript
// BAD: Creates new function on every render
export function ItemList({ items, onDelete }: Props) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          {item.name}
          <button onClick={() => onDelete(item.id)}>Delete</button>
          {/* ^ New function created every render! */}
        </li>
      ))}
    </ul>
  );
}

// GOOD: Extract to component with stable callback
function ItemRow({ item, onDelete }: ItemRowProps) {
  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);
  
  return (
    <li>
      {item.name}
      <button onClick={handleDelete}>Delete</button>
    </li>
  );
}

export function ItemList({ items, onDelete }: Props) {
  return (
    <ul>
      {items.map(item => (
        <ItemRow key={item.id} item={item} onDelete={onDelete} />
      ))}
    </ul>
  );
}
```

### Incorrect: Wrong import order

```typescript
// BAD: Imports are disorganized
import { UserCard } from './UserCard';
import type { User } from '@app/types';
import { useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@app/components/ui';

// GOOD: Organized import groups
import { useState } from 'react';        // 1. External
import { clsx } from 'clsx';

import { Button } from '@app/components/ui'; // 2. Internal (@/ aliases)

import { UserCard } from './UserCard';    // 3. Relative

import type { User } from '@app/types';      // 4. Types
```
