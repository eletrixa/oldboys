---
rule: react/hooks-organization
title: React Hooks Organization
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [hooks, organization, file-structure, scalability, separation-of-concerns]
---

# React Hooks Organization

Conventions for organizing and placing React hooks in the codebase.

---

## Description

To maintain a scalable and navigable codebase, hooks must be organized based on their scope (feature-specific vs. shared) and responsibility (business logic vs. utility). This rule establishes the decision tree for where to place new hooks.

---

## Specific Guidelines

### DO:
- Place feature-specific hooks in `src/features/{feature}/hooks/`
- Move hooks used by 2+ features to `src/hooks/` (shared)
- Distinguish between "core" (infra/utils) and "domain" (business logic) shared hooks
- Use `src/hooks/queries/` for pure React Query data fetching wrappers
- Use `src/hooks/core/ui/` for UI primitives (scroll, toast, etc.)

### DON'T:
- Create a shared hook for logic used by only one feature
- Mix business logic into `hooks/core/`
- Put generic utilities in `hooks/domain/`
- Duplicate hook logic across features instead of promoting to shared

---

## Implementation Details

### Decision Flowchart

1. **New Hook Needed?**
   - Is it used by 2+ unrelated features?
     - **No**: Place in `src/features/{feature}/hooks/`
     - **Yes**: Proceed to shared hook categorization.

2. **Shared Hook Categorization**:
   - Is it pure infrastructure (no business logic)?
     - **Yes**: Place in `src/hooks/core/`
       - Async/Polling -> `src/hooks/core/async/`
       - Performance -> `src/hooks/core/performance/`
       - UI Primitives -> `src/hooks/core/ui/`
       - Utils -> `src/hooks/core/utils/`
     - **No**: It involves business logic or data.
       - Is it a React Query wrapper?
         - **Yes**: Place in `src/hooks/queries/`
         - **No**: Place in `src/hooks/domain/`

### Directory Responsibilities

| Directory | Purpose | Examples |
|-----------|---------|----------|
| `src/hooks/core/async/` | Async operations, polling, mutations | `useAsyncOperation`, `useJobPolling` |
| `src/hooks/core/performance/` | Performance monitoring | `usePerformanceMetrics` |
| `src/hooks/core/ui/` | UI primitives (no business logic) | `useCarouselScroll`, `useSmoothScroll`, `useToast` |
| `src/hooks/core/utils/` | Infrastructure utilities | `useRetryLogic`, `useLifecycleCleanup` |
| `src/hooks/domain/` | Shared business logic | `useAchievements`, `useSEO`, `usePaymentFlowController` |
| `src/hooks/queries/` | React Query data fetching | `useFeatureFlag`, `useUserData`, `usePayments` |
| `src/hooks/admin/` | Admin-specific shared hooks | `useAdminAuth`, `useAdminChecklist` |
| `src/hooks/storage/` | Storage utilities (R2, S3, etc.) | `useStorageUpload`, `useImageUrl` |

---

## Benefits

1. **Discoverability**: predictable locations for hooks based on what they do.
2. **Scalability**: keeps the `src/hooks` root clean as the project grows.
3. **Separation of Concerns**: distinguishes between generic infra and business domain logic.
4. **Refactoring**: makes it clear when logic is shared vs. feature-isolated.

---

## Examples

### Correct: Feature Hook
```typescript
// src/features/assessment/hooks/useAssessmentState.ts
// Specific to 'assessment' feature, not used elsewhere.
export function useAssessmentState() { ... }
```

### Correct: Promoting to Domain Hook
```typescript
// src/hooks/domain/useAchievements.ts
// Used by 'assessment', 'dashboard', and 'profile' features.
// Contains business logic about badges/unlocks.
export function useAchievements() { ... }
```

### Correct: Core UI Hook
```typescript
// src/hooks/core/ui/useCarouselScroll.ts
// Generic UI behavior, no business logic.
export function useCarouselScroll() { ... }
```

### Incorrect: Generic Hook in Feature
```typescript
// src/features/assessment/hooks/useWindowSize.ts
// BAD: This is a generic utility used by many features.
// Move to src/hooks/core/ui/useWindowSize.ts
```

### Incorrect: Business Logic in Core
```typescript
// src/hooks/core/utils/useUserTiers.ts
// BAD: 'Tiers' is a business concept.
// Move to src/hooks/domain/useUserTiers.ts
```
