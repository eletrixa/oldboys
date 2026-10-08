---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Pass-Through Methods Red Flag

**Rule**: Avoid methods that only forward arguments to another method without adding value.

**Core Idea**: Pass-through methods indicate unclear responsibility boundaries between classes.

---

## The Problem

A **pass-through method** is one that does nothing except pass its arguments to another method, usually with the same signature.

```typescript
// RED FLAG: Pass-through method
class UserController {
  constructor(private userService: UserService) {}

  async getUser(id: string): Promise<User> {
    return this.userService.getUser(id); // Just forwarding!
  }

  async updateUser(id: string, data: UserData): Promise<User> {
    return this.userService.updateUser(id, data); // Just forwarding!
  }

  async deleteUser(id: string): Promise<void> {
    return this.userService.deleteUser(id); // Just forwarding!
  }
}
```

**Why it's bad**:
1. **No value added**: Controller provides no additional functionality
2. **Interface duplication**: Two classes expose the same interface
3. **Maintenance burden**: Changes require updates in multiple places
4. **Unclear responsibility**: Why does the controller exist?

---

## Root Cause: Overlapping Responsibility

Pass-through methods usually indicate that two classes have overlapping responsibilities.

```typescript
// PROBLEM: Unclear boundaries
class AssessmentController {
  startAttempt(userId: string) {
    return this.assessmentService.startAttempt(userId);
  }
  
  saveResponse(attemptId: string, value: number) {
    return this.assessmentService.saveResponse(attemptId, value);
  }
  
  submitAttempt(attemptId: string) {
    return this.assessmentService.submitAttempt(attemptId);
  }
}

class AssessmentService {
  startAttempt(userId: string) { /* ... */ }
  saveResponse(attemptId: string, value: number) { /* ... */ }
  submitAttempt(attemptId: string) { /* ... */ }
}

// What's the difference between Controller and Service?
// Why do we need both?
```

---

## Solution: Refactor Responsibilities

### Option 1: Eliminate the Pass-Through Layer

If the layer adds no value, remove it.

```typescript
// SOLUTION: Remove unnecessary layer
// Before: Handler -> Controller -> Service
// After:  Handler -> Service

// API handler
serveJson(async ({ req }) => {
  const { userId } = await getAuth(req);
  const assessmentService = new AssessmentService(/* deps */);
  
  // Call service directly - no controller needed
  return assessmentService.startAttempt(userId);
});
```

### Option 2: Add Distinct Responsibility

If the layer should exist, give it a clear, distinct responsibility.

```typescript
// SOLUTION: Controller handles HTTP concerns, Service handles business logic
class AssessmentController {
  constructor(private assessmentService: AssessmentService) {}

  async handleStartAttempt(req: Request): Promise<Response> {
    // HTTP-specific concerns (Controller's responsibility)
    const { userId } = await this.authenticateRequest(req);
    const body = await req.json();
    this.validateRequestBody(body);
    
    // Delegate business logic to service
    const result = await this.assessmentService.startAttempt(userId);
    
    // HTTP-specific response formatting (Controller's responsibility)
    return this.formatResponse(result);
  }
}

class AssessmentService {
  async startAttempt(userId: string): Promise<Result<Attempt>> {
    // Pure business logic (Service's responsibility)
    // No HTTP concerns
    // No request/response formatting
  }
}
```

### Option 3: Combine Related Classes

If responsibilities overlap, merge them.

```typescript
// BEFORE: Two classes with overlapping responsibility
class AttemptValidator {
  validateAttempt(attempt: Attempt): boolean { /* ... */ }
}

class AttemptChecker {
  checkAttempt(attempt: Attempt): boolean {
    return this.validator.validateAttempt(attempt); // Pass-through!
  }
}

// AFTER: Single class with clear responsibility
class AttemptValidator {
  validate(attempt: Attempt): ValidationResult {
    // All validation logic in one place
  }
}
```

---

## Exceptions: When Pass-Through is Acceptable

### 1. Dispatchers

A dispatcher selects which method to call based on input.

```typescript
// ACCEPTABLE: Dispatcher adds value (routing logic)
class ActionHandler {
  constructor(
    private initHandler: InitHandler,
    private saveHandler: SaveHandler,
    private submitHandler: SubmitHandler
  ) {}

  async handle(action: string, data: unknown): Promise<Result> {
    // Adds value: routing based on action type
    switch (action) {
      case 'init':
        return this.initHandler.handle(data);
      case 'save':
        return this.saveHandler.handle(data);
      case 'submit':
        return this.submitHandler.handle(data);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }
}
```

**Why acceptable**: The dispatcher adds value by implementing routing logic.

### 2. Adapters

Adapters transform interfaces to make them compatible.

```typescript
// ACCEPTABLE: Adapter adds value (interface transformation)
class DatabaseUserAdapter implements IUserRepository {
  constructor(private dbClient: DatabaseClient) {}

  async getUser(id: string): Promise<User> {
    // Transforms database API to our domain interface
    const { data, error } = await this.dbClient
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    
    // Transforms database row to domain model
    return this.toDomainModel(data);
  }

  private toDomainModel(row: any): User {
    // Adds value: data transformation
    return {
      id: row.id,
      name: row.full_name, // Different field name
      email: row.email,
      createdAt: new Date(row.created_at), // Type conversion
    };
  }
}
```

**Why acceptable**: The adapter adds value by transforming data structures.

### 3. Facades

Facades simplify complex subsystems.

```typescript
// ACCEPTABLE: Facade adds value (simplification)
class AssessmentFacade {
  constructor(
    private attemptService: AttemptService,
    private responseService: ResponseService,
    private scoringService: ScoringService,
    private eventBus: EventBus
  ) {}

  async completeAssessmentFlow(userId: string, responses: Response[]): Promise<Result> {
    // Adds value: orchestrates multiple services
    const attempt = await this.attemptService.create(userId);
    await this.responseService.saveAll(attempt.id, responses);
    const scores = await this.scoringService.calculate(responses);
    await this.attemptService.complete(attempt.id, scores);
    await this.eventBus.emit('assessment.completed', { userId, scores });
    
    return { success: true, data: scores };
  }
}
```

**Why acceptable**: The facade adds value by orchestrating multiple operations.

### 4. Decorators

Decorators add cross-cutting concerns.

```typescript
// ACCEPTABLE: Decorator adds value (logging, caching, etc.)
class CachedUserService implements IUserService {
  constructor(
    private userService: IUserService,
    private cache: Cache
  ) {}

  async getUser(id: string): Promise<User> {
    // Adds value: caching logic
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.userService.getUser(id);
    await this.cache.set(`user:${id}`, user);
    return user;
  }
}
```

**Why acceptable**: The decorator adds value by implementing caching.

---

## Real-World Examples

### Bad: Pure Pass-Through

```typescript
// src/services/UserService.ts
class UserService {
  constructor(private repo: UserRepository) {}

  getUser(id: string) {
    return this.repo.getUser(id); // No value added
  }

  updateUser(id: string, data: UserData) {
    return this.repo.updateUser(id, data); // No value added
  }

  deleteUser(id: string) {
    return this.repo.deleteUser(id); // No value added
  }
}

// Why does this service exist?
// Just use the repository directly!
```

### Good: Service Adds Business Logic

```typescript
// src/services/AssessmentService.ts
class AssessmentService {
  constructor(
    private attemptRepo: IAttemptRepository,
    private responseRepo: IResponseRepository
  ) {}

  async submitAttempt(attemptId: string): Promise<Result<Score>> {
    // Adds value: business logic
    
    // 1. Validate attempt exists and is in correct state
    const attempt = await this.attemptRepo.findById(attemptId);
    if (!attempt || attempt.status !== 'started') {
      return { success: false, error: 'Invalid attempt' };
    }

    // 2. Validate all responses are present
    const responses = await this.responseRepo.findByAttemptId(attemptId);
    if (responses.length < REQUIRED_RESPONSES) {
      return { success: false, error: 'Incomplete responses' };
    }

    // 3. Calculate scores (business logic)
    const scores = this.calculateScores(responses);

    // 4. Update attempt status
    await this.attemptRepo.update(attemptId, {
      status: 'completed',
      scores,
      completedAt: new Date()
    });

    return { success: true, data: scores };
  }
}
```

### Good: Action Handler Registry (Dispatcher)

```typescript
// src/strategies/action-handler-strategy.ts
class ActionHandlerRegistry {
  private handlers = new Map<string, ActionHandler>();

  register(action: string, handler: ActionHandler) {
    this.handlers.set(action, handler);
  }

  async handle(action: string, context: Context): Promise<Result> {
    // Adds value: routing + error handling
    const handler = this.handlers.get(action);
    if (!handler) {
      return { success: false, error: `Unknown action: ${action}` };
    }
    return handler.handle(context);
  }
}

// This is acceptable because it adds routing logic
```

---

## Detection Checklist

A method is likely a problematic pass-through if:

- [ ] It has the same signature as the method it calls
- [ ] It does nothing except forward arguments
- [ ] It adds no validation, transformation, or logic
- [ ] Removing it wouldn't change system behavior
- [ ] It exists in a layer that has no other purpose

---

## Refactoring Checklist

When you find a pass-through method:

1. [ ] Ask: "What value does this layer add?"
2. [ ] If none: Remove the layer
3. [ ] If some: Make the value explicit (validation, transformation, etc.)
4. [ ] If it's a dispatcher/adapter/facade: Document why it exists
5. [ ] Ensure each layer has a distinct, clear responsibility

---

## Related Rules

- `service-layer.md` - Services should contain business logic
- `repository-pattern.md` - Repositories handle data access

---

**Source**: "A Philosophy of Software Design" by John Ousterhout, Chapter 7
