---
rule: crossroads
title: Rules Crossroads
type: navigation
version: 1.0
---

# Rules Crossroads — Find Your Guide

**Before you start coding, find the right rule file for your task.**

---

## Working with State / UI Logic?

> Adding useState, managing loading/error states, deciding what to show...

| Situation | Go to |
|-----------|-------|
| Adding multiple booleans for one flow | [boolean-hell.md](clean-code/boolean-hell.md) |
| `isLoading`, `hasError`, `isSubmitted` flags | [boolean-hell.md](clean-code/boolean-hell.md) |
| Complex if/else for what button to show | [boolean-hell.md](clean-code/boolean-hell.md) |
| Derived state (computed from other data) | [boolean-hell.md](clean-code/boolean-hell.md) |
| Status enums vs booleans | [boolean-hell.md](clean-code/boolean-hell.md) |

---

## Creating React Components?

> Building UI, managing effects, designing props...

| Situation | Go to |
|-----------|-------|
| New component | [component-size.md](clean-code/component-size.md) |
| Component over 100 LOC | [component-size.md](clean-code/component-size.md) |
| `useEffect` or `useState` usage | [react-patterns.md](clean-code/react-patterns.md) |
| Props: variants vs boolean explosion | [react-patterns.md](clean-code/react-patterns.md) |
| Component structure and organization | [component-structure.md](react/component-structure.md) |
| Props interface design | [props-design.md](react/props-design.md) |
| Error boundaries | [error-boundaries.md](react/error-boundaries.md) |
| Suspense patterns | [suspense-patterns.md](react/suspense-patterns.md) |

---

## Writing Functions / Logic?

> Conditions, branching, helper functions...

| Situation | Go to |
|-----------|-------|
| Nested if/else blocks | [readability-patterns.md](clean-code/readability-patterns.md) |
| Guard clauses / early returns | [readability-patterns.md](clean-code/readability-patterns.md) |
| Ternary vs if/else | [readability-patterns.md](clean-code/readability-patterns.md) |
| Switch on status/type | [typescript-patterns.md](clean-code/typescript-patterns.md) |
| Exhaustive switch with `never` | [typescript-patterns.md](clean-code/typescript-patterns.md) |

---

## TypeScript Types & Safety?

> Types, unions, guards, strict mode...

| Situation | Go to |
|-----------|-------|
| Discriminated unions | [discriminated-unions.md](typescript/discriminated-unions.md) |
| Exhaustive switch statements | [exhaustive-switch.md](typescript/exhaustive-switch.md) |
| Branded types (UserId vs ProductId) | [branded-types.md](typescript/branded-types.md) |
| Strict typing, no `any` | [strict-typing.md](typescript/strict-typing.md) |
| Generics and constraints | [generics.md](typescript/generics.md) |
| Nullability handling | [nullability.md](typescript/nullability.md) |
| Readonly / immutability | [readonly-immutability.md](typescript/readonly-immutability.md) |
| Utility types (Pick, Omit, etc.) | [utility-types.md](typescript/utility-types.md) |
| Enum alternatives | [enums-alternatives.md](typescript/enums-alternatives.md) |

---

## React Hooks & State Management?

> Hooks, context, data fetching...

| Situation | Go to |
|-----------|-------|
| Hook organization and patterns | [hooks-patterns.md](react/hooks-patterns.md) |
| Hook ordering and organization | [hooks-organization.md](react/hooks-organization.md) |
| Context API patterns | [context-patterns.md](react/context-patterns.md) |
| State management decisions | [state-management.md](react/state-management.md) |
| Data fetching (React Query) | [data-fetching.md](react/data-fetching.md) |
| React Query performance | [query-performance.md](react/query-performance.md) |
| Forms and validation | [forms-validation.md](react/forms-validation.md) |
| Auth context | [auth-context.md](react/auth-context.md) |

---

## Styling / Design Tokens?

> Colors, gradients, Tailwind classes, themes...

| Situation | Go to |
|-----------|-------|
| Using brand colors in Tailwind | [design-tokens.md](react/design-tokens.md) |
| Gradient text invisible/white | [design-tokens.md](react/design-tokens.md) |
| Adding new color to theme | [design-tokens.md](react/design-tokens.md) |
| Tailwind v4 @theme configuration | [design-tokens.md](react/design-tokens.md) |
| Page looks like a generic template | [design-quality.md](web/design-quality.md) |

---

## Mobile / Responsive?

> Mobile layouts, spacing, carousels...

| Situation | Go to |
|-----------|-------|
| Responsive padding/margins | [mobile-optimization.md](clean-code/mobile-optimization.md) |
| Mobile vs desktop layout | [mobile-optimization.md](clean-code/mobile-optimization.md) |
| Scroll carousels | [mobile-optimization.md](clean-code/mobile-optimization.md) |

---

## Video / Media?

> Video autoplay, lazy loading, fallbacks...

| Situation | Go to |
|-----------|-------|
| Adding video to component | [video-media.md](react/video-media.md) |
| Video autoplay on viewport entry | [video-media.md](react/video-media.md) |
| Video lazy loading / fallbacks | [video-media.md](react/video-media.md) |

---

## Edge Functions (Supabase/Deno)?

> Serverless functions, CORS, validation...

| Situation | Go to |
|-----------|-------|
| Error handling | [edge-function-error-handling.md](cross-cutting/edge-function-error-handling.md) |
| Security patterns | [edge-function-security.md](cross-cutting/edge-function-security.md) |

---

## Writing Tests?

> Unit tests, integration tests, mocks...

| Situation | Go to |
|-----------|-------|
| What kind of test? (unit/integration/e2e) | [trophy-model.md](testing/trophy-model.md) |
| Writing good tests (AAA, SOLID) | [test-quality.md](testing/test-quality.md) |
| Mocking strategy | [mocking-strategy.md](testing/mocking-strategy.md) |
| Mock boundaries (what to mock) | [mock-boundaries.md](testing/mock-boundaries.md) |
| Test file structure/naming | [test-organization.md](testing/test-organization.md) |
| Test data factories | [factories.md](testing/factories.md) |
| Flaky or slow tests | [first-principles.md](testing/first-principles.md) |

---

## Designing New Features?

> Architecting new modules, services, or major components...

| Situation | Go to |
|-----------|-------|
| First design attempt | [design-twice.md](clean-code/design-twice.md) |
| Interface feels too complex | [deep-modules.md](clean-code/deep-modules.md) |
| Too many special cases | [general-purpose.md](clean-code/general-purpose.md) |
| Code is confusing to readers | [obvious-design.md](clean-code/obvious-design.md) |
| Method just forwards to another | [pass-through-methods.md](architecture/pass-through-methods.md) |
| Repository pattern | [repository-pattern.md](architecture/repository-pattern.md) |
| Service layer design | [service-layer.md](architecture/service-layer.md) |
| Data access abstraction | [data-abstraction.md](architecture/data-abstraction.md) |
| File/folder organization | [project-file-organization.md](architecture/project-file-organization.md) |

---

## Code Quality / Refactoring?

> DRY, SOLID, architecture...

| Situation | Go to |
|-----------|-------|
| Creating new file — does it exist? | [DRY.md](clean-code/DRY.md) |
| Duplicating code | [DRY.md](clean-code/DRY.md) |
| Class/service design | [SOLID.md](clean-code/SOLID.md) |
| Strategy/registry pattern | [SOLID.md](clean-code/SOLID.md) |
| Rendering performance | [rendering-optimization.md](react/rendering-optimization.md) |

---

## Linting & Tools?

> ESLint, Biome, type checking, git...

| Situation | Go to |
|-----------|-------|
| When to run lint (fast vs full) | [when-to-lint.md](tools/when-to-lint.md) |
| Linting workflow | [linting-workflow.md](tools/linting-workflow.md) |
| Git commit workflow | [git-commit-workflow.md](tools/git-commit-workflow.md) |
| Changelog updates | [changelog-workflow.md](tools/changelog-workflow.md) |
| Code changed: which docs to update in the same commit | [docs-sync.md](tools/docs-sync.md) |
| Environment configuration | [environment-config.md](tools/environment-config.md) |
| PowerShell jumper / cheatsheet for a repo | [project-cli-scripts.md](tools/project-cli-scripts.md) |
| Adding a `Go<Name>` or `cheat<name>` shortcut | [project-cli-scripts.md](tools/project-cli-scripts.md) |
| Refreshing a cheat after script changes | [project-cli-scripts.md](tools/project-cli-scripts.md) |

---

## Planning & Plans Folder?

> Creating a new plan, naming a plan folder, archiving, lifecycle...

| Situation | Go to |
|-----------|-------|
| Starting a new plan / creating `plans/NNN-<topic>/` | [plans.md](tools/plans.md) |
| Picking the next `NNN-` number | [plans.md](tools/plans.md) |
| Writing the README frontmatter (5 required fields) | [plans.md](tools/plans.md) |
| Adding a doc to an existing plan folder | [plans.md](tools/plans.md) |
| Archiving / superseding a plan | [plans.md](tools/plans.md) |
| Plan vs spec vs doc vs handoff — where does this go? | [plans.md](tools/plans.md) |
| Migrating an existing `plans/` folder to the convention | [plans.md](tools/plans.md) |
| What never lives in `plans/` (runtime artifacts, secrets) | [plans.md](tools/plans.md) |

---

## Cloudflare Workers?

> Workers, KV, R2, D1, bindings...

| Situation | Go to |
|-----------|-------|
| Worker handler patterns | [worker-patterns.md](cloudflare/worker-patterns.md) |
| Bindings (KV, R2, D1, secrets) | [bindings.md](cloudflare/bindings.md) |
| Worker configuration | [configuration.md](cloudflare/configuration.md) |

---

## Security (OWASP)?

> Authentication, authorization, CORS, cryptography...

| Situation | Go to |
|-----------|-------|
| CORS configuration | [owasp-compliance.md](security/owasp-compliance.md) |
| Password/token generation | [owasp-compliance.md](security/owasp-compliance.md) |
| Security headers (HSTS, CSP) | [owasp-compliance.md](security/owasp-compliance.md) |
| JWT validation | [owasp-compliance.md](security/owasp-compliance.md) |
| Input validation security | [owasp-compliance.md](security/owasp-compliance.md) |
| Writing security tests | [security-testing.md](security/security-testing.md) |

---

## Observability?

> Tracing, correlation IDs...

| Situation | Go to |
|-----------|-------|
| Request tracing across services | [correlation-ids.md](cross-cutting/correlation-ids.md) |
| Correlation ID patterns | [correlation-ids.md](cross-cutting/correlation-ids.md) |

---

## Next.js?

> App Router, Server Components, middleware...

| Situation | Go to |
|-----------|-------|
| Next.js conventions | See [nextjs/](nextjs/) folder |

---

## Accessibility?

> Keyboard navigation, screen readers, WCAG...

| Situation | Go to |
|-----------|-------|
| Keyboard navigation | [keyboard-nav.md](accessibility/keyboard-nav.md) |
| Screen reader support | [screen-readers.md](accessibility/screen-readers.md) |

---

## Quick: Common Mistakes

| If you're about to... | STOP and read... |
|----------------------|------------------|
| Add `isLoading`, `hasError`, `isSubmitted` as separate useState | [boolean-hell.md](clean-code/boolean-hell.md) |
| Mock your own service/helper | [mocking-strategy.md](testing/mocking-strategy.md) |
| Write a component over 150 LOC | [component-size.md](clean-code/component-size.md) |
| Store computed values in useState | [react-patterns.md](clean-code/react-patterns.md) |
| Copy-paste similar code | [DRY.md](clean-code/DRY.md) |
| Use `any` type | [strict-typing.md](typescript/strict-typing.md) |
| Write long if/else chains | [readability-patterns.md](clean-code/readability-patterns.md) |
| Implement first idea without alternatives | [design-twice.md](clean-code/design-twice.md) |
| Add special case handling | [general-purpose.md](clean-code/general-purpose.md) |
| Create method that just forwards to another | [pass-through-methods.md](architecture/pass-through-methods.md) |
| Use `Math.random()` for passwords/tokens | [owasp-compliance.md](security/owasp-compliance.md) |
| Use wildcard `*` for CORS | [owasp-compliance.md](security/owasp-compliance.md) |
| Return "User not found" error message | [owasp-compliance.md](security/owasp-compliance.md) |
| Use `preload="auto"` on video | [video-media.md](react/video-media.md) |
| Autoplay video without `muted` | [video-media.md](react/video-media.md) |
| Use `enum` keyword in TypeScript | [enums-alternatives.md](typescript/enums-alternatives.md) |
| Skip file header on new source file | [file-headers.md](file-headers.md) |

---

### Clean Code (13 files)
| File | Summary |
|------|---------|
| [boolean-hell.md](clean-code/boolean-hell.md) | Replace booleans with status enums, use derived state |
| [component-size.md](clean-code/component-size.md) | Keep components 100-150 LOC, extract when larger |
| [deep-modules.md](clean-code/deep-modules.md) | Simple interfaces, rich implementation, hide complexity |
| [design-twice.md](clean-code/design-twice.md) | Consider 2-3 approaches before implementing |
| [DRY.md](clean-code/DRY.md) | Search -> Reuse -> Extend -> Extract -> Create |
| [general-purpose.md](clean-code/general-purpose.md) | Eliminate special cases, design for broad use |
| [mobile-optimization.md](clean-code/mobile-optimization.md) | DRY spacing, responsive carousels, dual strategy |
| [obvious-design.md](clean-code/obvious-design.md) | Reduce unknown unknowns, make code self-explanatory |
| [react-patterns.md](clean-code/react-patterns.md) | Composition, minimal state, effects, stable keys |
| [readability-patterns.md](clean-code/readability-patterns.md) | Guards, helpers, ternaries, simplified conditions |
| [research-and-reuse.md](clean-code/research-and-reuse.md) | Search libraries and repo code before building |
| [SOLID.md](clean-code/SOLID.md) | S.O.L.I.D. for React/TypeScript + cognitive load |
| [typescript-patterns.md](clean-code/typescript-patterns.md) | Exhaustive switch, unions, guards, strict mode |

### React (17 files)
| File | Summary |
|------|---------|
| [auth-context.md](react/auth-context.md) | Auth context and protected routes |
| [component-structure.md](react/component-structure.md) | Component organization and structure |
| [context-patterns.md](react/context-patterns.md) | Context API usage and optimization |
| [data-fetching.md](react/data-fetching.md) | Server state and data fetching patterns |
| [design-tokens.md](react/design-tokens.md) | Tailwind v4 theme, design system integration |
| [error-boundaries.md](react/error-boundaries.md) | Error boundary patterns |
| [forms-validation.md](react/forms-validation.md) | Form state and validation |
| [guard-clauses.md](react/guard-clauses.md) | Early returns in render |
| [hooks-organization.md](react/hooks-organization.md) | Hook ordering and organization |
| [hooks-patterns.md](react/hooks-patterns.md) | useEffect, dependencies, cleanup |
| [props-design.md](react/props-design.md) | Props interface design |
| [query-performance.md](react/query-performance.md) | React Query optimization |
| [rendering-optimization.md](react/rendering-optimization.md) | Memoization, lazy loading, code splitting |
| [state-management.md](react/state-management.md) | State architecture decisions |
| [suspense-patterns.md](react/suspense-patterns.md) | Suspense + error boundaries |
| [toasts-notifications.md](react/toasts-notifications.md) | Toast/notification patterns |
| [video-media.md](react/video-media.md) | Video autoplay, lazy loading, fallbacks |

### TypeScript (12 files)
| File | Summary |
|------|---------|
| [async-patterns.md](typescript/async-patterns.md) | Async/await and Promise patterns |
| [branded-types.md](typescript/branded-types.md) | Type branding for critical primitives |
| [discriminated-unions.md](typescript/discriminated-unions.md) | Type-safe polymorphism with unions |
| [enums-alternatives.md](typescript/enums-alternatives.md) | `as const` objects over enum keyword |
| [exhaustive-switch.md](typescript/exhaustive-switch.md) | Compile-time exhaustive checking |
| [generics.md](typescript/generics.md) | Generic type patterns and constraints |
| [module-structure.md](typescript/module-structure.md) | Module organization and exports |
| [nullability.md](typescript/nullability.md) | Null/undefined handling |
| [readonly-immutability.md](typescript/readonly-immutability.md) | Readonly and immutability patterns |
| [strict-typing.md](typescript/strict-typing.md) | Strict mode and type safety |
| [type-inference.md](typescript/type-inference.md) | When to annotate vs infer |
| [utility-types.md](typescript/utility-types.md) | Pick, Partial, Omit, Record patterns |

### Testing (7 files)
| File | Summary |
|------|---------|
| [factories.md](testing/factories.md) | Test data factories and builders |
| [first-principles.md](testing/first-principles.md) | FIRST: Fast, Independent, Repeatable, Self-validating, Timely |
| [mock-boundaries.md](testing/mock-boundaries.md) | What to mock and what not to |
| [mocking-strategy.md](testing/mocking-strategy.md) | MSW, vitest mocks, spies |
| [test-organization.md](testing/test-organization.md) | File structure, naming, co-location |
| [test-quality.md](testing/test-quality.md) | TEST-SOLID + AAA pattern |
| [trophy-model.md](testing/trophy-model.md) | Integration > Unit > E2E (testing trophy) |

### Security (2 files)
| File | Summary |
|------|---------|
| [owasp-compliance.md](security/owasp-compliance.md) | OWASP Top 10 requirements |
| [security-testing.md](security/security-testing.md) | TDD for security |

### Architecture (6 files)
| File | Summary |
|------|---------|
| [data-abstraction.md](architecture/data-abstraction.md) | Centralized audited data access |
| [pass-through-methods.md](architecture/pass-through-methods.md) | Avoid methods that just forward |
| [project-file-organization.md](architecture/project-file-organization.md) | Directory structure patterns |
| [repository-naming.md](architecture/repository-naming.md) | CRUD method naming conventions |
| [repository-pattern.md](architecture/repository-pattern.md) | Repository encapsulation |
| [service-layer.md](architecture/service-layer.md) | Service layer for business logic |

### Tools (9 files)
| File | Summary |
|------|---------|
| [changelog-workflow.md](tools/changelog-workflow.md) | Version changelog patterns |
| [docs-sync.md](tools/docs-sync.md) | Changed paths → docs to update in the same commit |
| [environment-config.md](tools/environment-config.md) | Environment variable setup |
| [git-commit-workflow.md](tools/git-commit-workflow.md) | Commit message conventions |
| [linting-workflow.md](tools/linting-workflow.md) | Multi-tier linting system |
| [plans.md](tools/plans.md) | `plans/` folder convention — `NNN-<kebab-topic>/` + README frontmatter (required) |
| [project-cli-scripts.md](tools/project-cli-scripts.md) | Per-repo PowerShell jumper + cheatsheet (required) |
| [specs.md](tools/specs.md) | `specs/` contracts: re-read per slice, fix spec drift in spec and code together |
| [when-to-lint.md](tools/when-to-lint.md) | Fast during dev, full before PR |

### Cloudflare (3 files)
| File | Summary |
|------|---------|
| [bindings.md](cloudflare/bindings.md) | KV, R2, D1, secrets bindings |
| [configuration.md](cloudflare/configuration.md) | Worker configuration |
| [worker-patterns.md](cloudflare/worker-patterns.md) | Handler structure, responses |

### Cross-Cutting (3 files)
| File | Summary |
|------|---------|
| [correlation-ids.md](cross-cutting/correlation-ids.md) | Request tracing across services |
| [edge-function-error-handling.md](cross-cutting/edge-function-error-handling.md) | Custom error types, mapping |
| [edge-function-security.md](cross-cutting/edge-function-security.md) | Secrets management |

### Next.js (6 files)
| File | Summary |
|------|---------|
| [api-routes.md](nextjs/api-routes.md) | Route handler conventions |
| [app-router.md](nextjs/app-router.md) | File-based routing conventions |
| [data-fetching.md](nextjs/data-fetching.md) | Server components, caching, static generation |
| [layouts-and-metadata.md](nextjs/layouts-and-metadata.md) | Root layout, providers, metadata |
| [opennext-cloudflare.md](nextjs/opennext-cloudflare.md) | OpenNext on Workers: known issues, required config |
| [server-client-components.md](nextjs/server-client-components.md) | Server by default, when to go client |

### Accessibility (2 files)
| File | Summary |
|------|---------|
| [keyboard-nav.md](accessibility/keyboard-nav.md) | Keyboard navigation, focus management |
| [screen-readers.md](accessibility/screen-readers.md) | Screen reader support |

### Web (1 file)
| File | Summary |
|------|---------|
| [design-quality.md](web/design-quality.md) | Anti-template policy: intentional, product-specific UI |

