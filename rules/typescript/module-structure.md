---
rule: typescript/module-structure
title: Module Structure
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [modules, barrel-exports, path-aliases, organization, imports]
---

# TypeScript Module Structure

Organize code with clear module boundaries, barrel exports, and alias paths.

---

## Description

Well-structured modules improve code discoverability, reduce import complexity, and enable better tree-shaking. This rule defines how to organize TypeScript modules using path aliases, barrel exports, and feature-based organization.

---

## Specific Guidelines

### DO:
- Use path aliases (`@/*`) instead of relative paths
- Create barrel exports (`index.ts`) for public module APIs
- Co-locate related code in feature folders
- Separate types into dedicated files or folders
- Keep internal implementation details private (not exported from barrel)
- Use explicit named exports, not default exports

### DON'T:
- Use deep relative paths (`../../../components/ui/Button`)
- Export everything from barrel files (export only public API)
- Create circular dependencies between modules
- Mix feature code across unrelated directories
- Use default exports (makes refactoring harder)

---

## Implementation Details

### Path Aliases (from tsconfig.json):
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@test/*": ["./tests/*"],
      "@db/*": ["./src/db/*"],
      "@features/*": ["./src/features/*"],
      "@services/*": ["./src/core/services/*"],
      "@infrastructure/*": ["./src/core/infrastructure/*"]
    }
  }
}
```

### Feature Folder Structure:
```
src/features/dashboard/
├── components/           # React components
│   ├── DashboardCard.tsx
│   └── DashboardProgress.tsx
├── hooks/               # Feature-specific hooks
│   ├── useDashboardState.ts
│   └── useDashboardPolling.ts
├── services/            # Business logic
│   ├── DashboardService.ts
│   └── ScoringService.ts
├── repositories/        # Data access
│   └── DashboardRepository.ts
├── types/              # Type definitions
│   ├── index.ts
│   └── dashboard.types.ts
└── index.ts            # Barrel export (public API)
```

### Barrel Export Pattern:
```typescript
// src/features/dashboard/index.ts
// Export only the public API

// Components
export { DashboardCard } from './components/DashboardCard';
export { DashboardProgress } from './components/DashboardProgress';

// Hooks
export { useDashboardState } from './hooks/useDashboardState';

// Types
export type { DashboardResult, DashboardStatus } from './types';

// Don't export internal implementation details
// Services and repositories are internal
```

---

## Benefits

1. **Shorter imports**: `@/features/dashboard` vs `../../../features/dashboard`
2. **Clear boundaries**: Barrel defines what's public vs private
3. **Better refactoring**: Move files without changing imports
4. **Improved discoverability**: Organized structure is self-documenting
5. **Tree-shaking**: Explicit exports enable dead code elimination

---

## Examples

### Correct: Using path aliases

```typescript
// Component file
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { DashboardService } from '@/features/dashboard/services/DashboardService';
import type { User } from '@/types/user';
import { calculateScore } from '@/lib/scoring-domain';

// Test file
import { createMockUser } from '@test/factories/userFactory';
import { renderWithProviders } from '@test/testUtils';

// Database access
import { UserRepository } from '@db/drizzle/repositories/UserRepository';
import type { DB } from '@db/drizzle/schema';
```

### Correct: Feature module organization

```typescript
// src/features/subscription/index.ts
// Public API only

// Components (for use in pages/routes)
export { SubscriptionCard } from './components/SubscriptionCard';
export { SubscriptionBadge } from './components/SubscriptionBadge';
export { PaymentMethodManager } from './components/PaymentMethodManager';

// Hooks (for use in consuming components)
export { useSubscription } from './hooks/useSubscription';
export { usePaymentMethods } from './hooks/usePaymentMethods';

// Types (for type annotations in other modules)
export type {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentMethod,
} from './types';

// Constants (if needed externally)
export { SUBSCRIPTION_PLANS } from './constants';

// DO NOT export:
// - Internal services (SubscriptionService)
// - Internal utilities (formatPrice, validateCard)
// - Implementation components (SubscriptionCardSkeleton)
```

### Correct: Type organization

```typescript
// src/features/dashboard/types/index.ts
// Re-export all public types

export type { DashboardResult, DashboardScores } from './dashboard-result.types';
export type { RecordStatus, RecordRole } from './record.types';
export type { DashboardConfig } from './config.types';

// src/features/dashboard/types/dashboard-result.types.ts
export interface DashboardResult {
  readonly id: string;
  readonly recordId: string;
  scores: DashboardScores;
  completedAt: Date;
}

export interface DashboardScores {
  compatibility: number;
  communication: number;
  engagement: number;
  quality: number;
}
```

### Correct: Named exports

```typescript
// Named export - easier to refactor and search
export function useDashboardState(): DashboardState {
  // ...
}

export const DashboardCard: React.FC<DashboardCardProps> = (props) => {
  // ...
};

// Import is explicit and searchable
import { useDashboardState, DashboardCard } from '@/features/dashboard';
```

### Incorrect: Deep relative paths

```typescript
// BAD: Fragile, hard to read
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../../hooks/useAuth';
import type { User } from '../../../../../types/user';

// Moving this file breaks all these imports
```

### Incorrect: Default exports

```typescript
// BAD: Default export
// src/components/Button.tsx
export default function Button() { ... }

// Problems:
// 1. Import name can vary: import Btn from ..., import Button from ...
// 2. Harder to search codebase
// 3. No autocomplete without explicit import

// GOOD: Named export
export function Button() { ... }

// Or for components:
export const Button: React.FC<ButtonProps> = () => { ... };
```

### Incorrect: Exporting everything

```typescript
// BAD: Leaking internal implementation
// src/features/dashboard/index.ts
export * from './components/DashboardCard';
export * from './components/DashboardCardSkeleton'; // Internal!
export * from './services/DashboardService'; // Internal!
export * from './utils/formatScore'; // Internal!
export * from './utils/validateResponse'; // Internal!

// Now external code depends on internals
// Refactoring internals breaks external code

// GOOD: Explicit public API only
export { DashboardCard } from './components/DashboardCard';
export { useDashboardState } from './hooks/useDashboardState';
export type { DashboardResult } from './types';
```

### Incorrect: Circular dependencies

```typescript
// BAD: Circular dependency
// src/features/auth/AuthService.ts
import { UserService } from '@/features/user/UserService';

// src/features/user/UserService.ts
import { AuthService } from '@/features/auth/AuthService'; // Circular!

// GOOD: Extract shared dependency or use dependency injection
// src/core/services/AuthContext.ts
export interface AuthContext {
  userId: string;
  permissions: string[];
}

// Both services depend on AuthContext, not each other
```

---

## Troubleshooting Circular Dependencies

Circular dependencies often occur when using barrel files (`index.ts`). If Module A imports from Module B's barrel, and Module B imports from Module A's barrel, you have a circular loop. This is especially common with core features like Authentication.

### Rules for Circularity Prevention:
- **Avoid**: Importing from a barrel file (`index.ts`) within the same feature subfolder.
- **Prefer**: Direct file imports for internal feature dependencies (e.g., `../hooks/useInternalHook` instead of `../hooks`).
- **Prefer**: Direct module imports for external dependencies prone to circularity (e.g., `@/features/auth/hooks/useAuth` instead of `@/features/auth/hooks`).
- **Infrastructure Hierarchy**: Core infrastructure (storage, logging) must NEVER depend on feature code.
- **Unit Testing**: Mocks in test files should target the direct module path to avoid triggering whole barrel loads.
