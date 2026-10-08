# Oldboys Rules

Project rules for oldboys, the hackathon Social Media Deep Research agent. Next.js 16, React 19, TypeScript 5, Tailwind 4, Cloudflare Workers + Workflows + D1 + R2, OpenNext (@opennextjs/cloudflare), AI SDK + Anthropic, apify-client, Vitest.

> **Not sure where to start?** See [crossroads.md](crossroads.md) for task-based navigation. Every source file carries the header from [file-headers.md](file-headers.md).

## Project-specific rules

Oldboys invariants (from plans/001-deep-research-arch). They override the generic rules below.

- No interfaces with one implementation.
- Ports are plain function parameters, no DI.
- Branches in recipes only via `onEmpty` and `resolve`.
- A step file over 150 lines is a bug.
- `Claim.kind` FACT requires quote ⊂ source excerpt and verify passed.
- Budget is enforced in the runner, never in the LLM.
- Never export `runtime = "edge"`.
- Workflow code imports only `src/domain` and `src/recipe`, never `next`.

## Categories


### [clean-code/](clean-code/)
- [DRY.md](clean-code/DRY.md) — DRY Principles - Don't Repeat Yourself: Golden Rule: One source of truth for all logic, constants, and configurations.
- [SOLID.md](clean-code/SOLID.md) — SOLID Principles for React + TypeScript: Purpose: Maintainable, extensible code that survives refactoring.
- [boolean-hell.md](clean-code/boolean-hell.md) — Boolean Hell - Identification & Prevention: Goal: Replace scattered booleans with clear status enums and derived state.
- [component-size.md](clean-code/component-size.md) — Component Size Guidelines: Target: ~100-150 LOC (Lines of Code) per component
- [deep-modules.md](clean-code/deep-modules.md) — Deep Modules Principle: Rule: Modules should have simple interfaces and rich functionality.
- [design-twice.md](clean-code/design-twice.md) — Design It Twice: Rule: Before implementing a major feature, consider at least 2-3 radically different appro
- [general-purpose.md](clean-code/general-purpose.md) — General-Purpose Over Special-Purpose: Rule: Design mechanisms for broad use cases, not just today's immediate needs.
- [mobile-optimization.md](clean-code/mobile-optimization.md) — Mobile Optimization Patterns: Goal: Excellent UX on mobile with DRY, maintainable code.
- [obvious-design.md](clean-code/obvious-design.md) — Obvious Design Principle: Rule: Code should be obvious.
- [react-patterns.md](clean-code/react-patterns.md) — React Patterns - Simple Components, Clear Data Flow: Goal: Maintainable React code with clear responsibilities.
- [readability-patterns.md](clean-code/readability-patterns.md) — Readability Patterns - Clear, Scannable Code: Goal: Code that reads like prose, with minimal cognitive load.
- [research-and-reuse.md](clean-code/research-and-reuse.md) — Research & Reuse Before Building: The macro form of [[DRY]]: before writing any non-trivial new implementation, spend the ch
- [typescript-patterns.md](clean-code/typescript-patterns.md) — TypeScript Patterns - Safety Without Friction: Goal: Type safety that catches bugs early without slowing development.

### [typescript/](typescript/)
- [async-patterns.md](typescript/async-patterns.md) — Async Patterns: Handle asynchronous operations safely with proper error handling and cancellation.
- [branded-types.md](typescript/branded-types.md) — Branded Types: Use type branding to prevent mixing incompatible values that share the same primitive type
- [discriminated-unions.md](typescript/discriminated-unions.md) — Discriminated Unions: Model state machines and polymorphic data with discriminated unions for compile-time safet
- [enums-alternatives.md](typescript/enums-alternatives.md) — Enums Alternatives: Prefer const objects and union types over TypeScript enums.
- [exhaustive-switch.md](typescript/exhaustive-switch.md) — Exhaustive Switch: Use exhaustive switch statements with never checks for type-safe discriminated unions.
- [generics.md](typescript/generics.md) — Generics: Write flexible, reusable code with properly constrained generic types.
- [module-structure.md](typescript/module-structure.md) — Module Structure: Organize code with clear module boundaries, barrel exports, and alias paths.
- [nullability.md](typescript/nullability.md) — Nullability Handling: Handle null and undefined explicitly to prevent runtime errors.
- [readonly-immutability.md](typescript/readonly-immutability.md) — Readonly and Immutability: Enforce immutability by default to prevent accidental mutations and make data flow predict
- [strict-typing.md](typescript/strict-typing.md) — Strict Typing: Enforce strict type safety to catch bugs at compile time rather than runtime.
- [type-inference.md](typescript/type-inference.md) — Type Inference: Let TypeScript infer types when obvious; annotate when it adds clarity or safety.
- [utility-types.md](typescript/utility-types.md) — Utility Types: Use built-in utility types to transform types without redundant definitions.

### [react/](react/)
- [auth-context.md](react/auth-context.md) — Auth Context Pattern: Use a singleton AuthProvider context for authentication state when your auth provider crea
- [component-structure.md](react/component-structure.md) — React Component Structure: Organize components with consistent structure, clear prop interfaces, and proper file orga
- [context-patterns.md](react/context-patterns.md) — React Context Patterns: Use Context for cross-cutting concerns, not general state management.
- [data-fetching.md](react/data-fetching.md) — React Data Fetching: Fetch data with React Query for caching, deduplication, and optimistic updates.
- [design-tokens.md](react/design-tokens.md) — Design Tokens and Styling Consistency: Use design tokens and Tailwind theme variables instead of hardcoded colors/spacing.
- [error-boundaries.md](react/error-boundaries.md) — React Error Boundaries: Gracefully handle component errors to prevent full app crashes.
- [forms-validation.md](react/forms-validation.md) — React Forms and Validation: Handle form state and validation with type-safe patterns and clear error feedback.
- [guard-clauses.md](react/guard-clauses.md) — React Guard Clauses and Early Returns: Use early returns for invalid states before the main render logic.
- [hooks-organization.md](react/hooks-organization.md) — React Hooks Organization: Conventions for organizing and placing React hooks in the codebase.
- [hooks-patterns.md](react/hooks-patterns.md) — React Hooks Patterns: Use hooks correctly to avoid bugs, infinite loops, and performance issues.
- [props-design.md](react/props-design.md) — React Props Design: Design component APIs with clear, composable, and type-safe props.
- [query-performance.md](react/query-performance.md) — React Query Performance Rules: Never include rendering context (buttonContext, displayMode) in query keys.
- [rendering-optimization.md](react/rendering-optimization.md) — React Rendering Optimization: Prevent unnecessary re-renders through proper component design and memoization.
- [state-management.md](react/state-management.md) — React State Management: Keep state minimal, colocate it with usage, and compute derived values.
- [suspense-patterns.md](react/suspense-patterns.md) — React Suspense Patterns: Use Suspense and lazy loading for better loading UX and code splitting.
- [toasts-notifications.md](react/toasts-notifications.md) — Toasts and User Notifications: Use the standardized toast systems consistently and only for user-action feedback.
- [video-media.md](react/video-media.md) — React Video Media Components: Best practices for implementing video components with autoplay, lazy loading, and fallback

### [nextjs/](nextjs/)
- [api-routes.md](nextjs/api-routes.md) — api-routes.md: Route handler conventions for Next.js App Router.
- [app-router.md](nextjs/app-router.md) — app-router.md: Next.js App Router file-based routing conventions.
- [data-fetching.md](nextjs/data-fetching.md) — data-fetching.md: Patterns for fetching data in Next.js App Router: server components, caching, static gener
- [layouts-and-metadata.md](nextjs/layouts-and-metadata.md) — layouts-and-metadata.md: Root layout configuration, provider nesting, and metadata patterns for Next.js App Router.
- [opennext-cloudflare.md](nextjs/opennext-cloudflare.md) — opennext-cloudflare.md: Known issues and required configuration for deploying Next.js to Cloudflare Workers via Op
- [server-client-components.md](nextjs/server-client-components.md) — server-client-components.md: Server components are the default in Next.js App Router.

### [cloudflare/](cloudflare/)
- [bindings.md](cloudflare/bindings.md) — bindings.md: Use KV, R2, Queues, Durable Objects, and other bindings correctly.
- [configuration.md](cloudflare/configuration.md) — configuration.md: Configure Workers with proper wrangler.toml settings, environments, and secrets.
- [worker-patterns.md](cloudflare/worker-patterns.md) — worker-patterns.md: Write Cloudflare Workers that are fast, reliable, and operate within runtime constraints.

### [testing/](testing/)
- [factories.md](testing/factories.md) — factories.md: Use factories for test data and scenario builders for complex test setups.
- [first-principles.md](testing/first-principles.md) — first-principles.md: Acronym: Fast, Independent, Repeatable, Self-validating, Timely
- [mock-boundaries.md](testing/mock-boundaries.md) — mock-boundaries.md: Mock external systems at boundaries, never mock your own code.
- [mocking-strategy.md](testing/mocking-strategy.md) — mocking-strategy.md: Golden Rule: Mock external systems, NEVER your own code.
- [test-organization.md](testing/test-organization.md) — test-organization.md: Goal: Consistent, discoverable test organization.
- [test-quality.md](testing/test-quality.md) — test-quality.md: Goal: Tests that are readable, reliable, and maintainable.
- [trophy-model.md](testing/trophy-model.md) — trophy-model.md: Structure tests following Kent C.

### [security/](security/)
- [owasp-compliance.md](security/owasp-compliance.md) — owasp-compliance.md: This document defines mandatory security practices based on the OWASP Top 10 (2021).
- [security-testing.md](security/security-testing.md) — security-testing.md: This document defines how to write security tests following TDD principles.

### [tools/](tools/)
- [changelog-workflow.md](tools/changelog-workflow.md) — changelog-workflow.md: Best practices for maintaining the project changelog (versions.md).
- [environment-config.md](tools/environment-config.md) — environment-config.md: Purpose: Ensure consistent, safe environment variable management.
- [git-commit-workflow.md](tools/git-commit-workflow.md) — git-commit-workflow.md: After completing major development work (2 phases or more), automatically create a Git com
- [linting-workflow.md](tools/linting-workflow.md) — linting-workflow.md: Strategy: Fast checks during dev, thorough validation before PR.
- [plans.md](tools/plans.md) — Plans Folder Convention: Part of [[Global Code Settings]].
- [project-cli-scripts.md](tools/project-cli-scripts.md) — Project-Local CLI Scripts (Repo Jumper + Cheatsheet): Every project must contain:
- [when-to-lint.md](tools/when-to-lint.md) — when-to-lint.md: CRITICAL: Do NOT run full npm run lint or bun run typecheck during active development!

### [architecture/](architecture/)
- [data-abstraction.md](architecture/data-abstraction.md) — data-abstraction.md: All data access MUST go through abstraction layers to ensure audit logging, type safety, a
- [pass-through-methods.md](architecture/pass-through-methods.md) — pass-through-methods.md: Rule: Avoid methods that only forward arguments to another method without adding value.
- [project-file-organization.md](architecture/project-file-organization.md) — project-file-organization.md: Standard directory structure and file placement rules for the codebase.
- [repository-naming.md](architecture/repository-naming.md) — repository-naming.md: Use consistent method naming in repository interfaces and implementations.
- [repository-pattern.md](architecture/repository-pattern.md) — repository-pattern.md: Encapsulate all database access in repository classes with security-aware base classes.
- [service-layer.md](architecture/service-layer.md) — service-layer.md: Encapsulate business logic in service classes, separate from HTTP handlers and repositorie

### [web/](web/)
- [design-quality.md](web/design-quality.md) — Design Quality — Anti-Template Policy: Frontend output should look intentional, opinionated, and specific to the product — not li

### [accessibility/](accessibility/)
- [keyboard-nav.md](accessibility/keyboard-nav.md) — keyboard-nav.md: All interactive elements must be operable via keyboard.
- [screen-readers.md](accessibility/screen-readers.md) — screen-readers.md: Application content must be meaningful when consumed through assistive technology.

### [cross-cutting/](cross-cutting/)
- [correlation-ids.md](cross-cutting/correlation-ids.md) — correlation-ids.md: Use correlation IDs and structured logging to trace a single user action end-to-end across
- [edge-function-error-handling.md](cross-cutting/edge-function-error-handling.md) — edge-function-error-handling.md: Handle errors gracefully with consistent responses and proper logging.
- [edge-function-security.md](cross-cutting/edge-function-security.md) — edge-function-security.md: Protect edge functions with proper authentication, authorization, and data handling.

### Root
- [file-headers.md](file-headers.md) — Part of [[Global Code Settings]].
- [crossroads.md](crossroads.md) — Task-based navigation to the right rule
