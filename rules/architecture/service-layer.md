---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Service Layer Pattern

Encapsulate business logic in service classes, separate from HTTP handlers and repositories.

---

## Description

The service layer contains all business logic and orchestrates operations across multiple repositories. Services are injected with dependencies and are the single place where business rules are enforced.

---

## Specific Guidelines

### DO:
- Create service classes for each business domain
- Inject repositories and other services via constructor
- Implement business rules and validations in services
- Orchestrate multi-step operations in services
- Return Result types for error handling
- Keep services stateless

### DON'T:
- Put business logic in handlers/controllers
- Put business logic in repositories
- Put business logic in React components
- Access the database directly in services (use repos)
- Create services with hidden dependencies
- Mix HTTP concerns with business logic

---

## Implementation Details

### Service Structure:

```
src/services/
├── assessment/
│   ├── AssessmentService.ts
│   ├── ScoringService.ts
│   └── PairMatchingService.ts
├── payment/
│   ├── PaymentService.ts
│   └── SubscriptionService.ts
└── user/
    ├── UserService.ts
    └── ProfileService.ts
```

### Service Class Pattern:

```typescript
export class DomainService {
  constructor(
    private readonly entityRepo: IEntityRepository,
    private readonly relatedRepo: IRelatedRepository,
    private readonly externalService: IExternalService
  ) {}

  async performBusinessOperation(input: Input): Promise<Result<Output>> {
    // 1. Validate input
    // 2. Apply business rules
    // 3. Coordinate repository calls
    // 4. Handle errors
    // 5. Return result
  }
}
```

---

## Benefits

1. **Separation of concerns**: Logic isolated from I/O
2. **Testability**: Mock dependencies, test logic
3. **Reusability**: Same logic for web, API, CLI
4. **Maintainability**: Changes in one place
5. **Clarity**: Business rules explicit and documented

---

## Examples

### Correct: Service with business logic

```typescript
// src/services/assessment/AssessmentService.ts
export class AssessmentService {
  constructor(
    private readonly attemptRepo: IAssessmentAttemptRepository,
    private readonly responseRepo: IAssessmentResponseRepository,
    private readonly scoreService: IScoringService,
    private readonly eventBus: IEventBus
  ) {}

  async startAttempt(input: StartAttemptInput): Promise<Result<AssessmentAttempt>> {
    // Business rule: Check for existing active attempt
    const existingResult = await this.attemptRepo.findActiveByUserId(input.userId);
    if (existingResult.success && existingResult.data) {
      return {
        success: false,
        error: 'You already have an active attempt. Complete or cancel it first.',
        code: 'ACTIVE_ATTEMPT_EXISTS',
      };
    }

    // Business rule: Validate pair if pair attempt
    if (input.pairId) {
      const pairValidation = await this.validatePairAttempt(input.userId, input.pairId);
      if (!pairValidation.success) {
        return pairValidation;
      }
    }

    // Create attempt via repository
    const attemptResult = await this.attemptRepo.create({
      userId: input.userId,
      pairId: input.pairId,
      role: input.pairId ? 'self' : 'individual',
    });

    if (attemptResult.success) {
      // Emit domain event
      await this.eventBus.emit('assessment.attempt.started', {
        attemptId: attemptResult.data.id,
        userId: input.userId,
      });
    }

    return attemptResult;
  }

  async saveResponse(input: SaveResponseInput): Promise<Result<void>> {
    // Get attempt
    const attemptResult = await this.attemptRepo.findById(input.attemptId);
    if (!attemptResult.success || !attemptResult.data) {
      return { success: false, error: 'Attempt not found' };
    }

    const attempt = attemptResult.data;

    // Business rule: Can only save to active attempts
    if (attempt.status !== 'started') {
      return { 
        success: false, 
        error: 'Cannot modify a completed attempt',
        code: 'ATTEMPT_NOT_ACTIVE',
      };
    }

    // Business rule: Validate response value
    if (input.value < 1 || input.value > 5) {
      return {
        success: false,
        error: 'Response value must be between 1 and 5',
        code: 'INVALID_VALUE',
      };
    }

    // Save via repository
    return this.responseRepo.upsert({
      attemptId: input.attemptId,
      questionId: input.questionId,
      value: input.value,
    });
  }

  async submitAttempt(attemptId: string): Promise<Result<AssessmentResult>> {
    // Get attempt with responses
    const attemptResult = await this.attemptRepo.findById(attemptId);
    if (!attemptResult.success || !attemptResult.data) {
      return { success: false, error: 'Attempt not found' };
    }

    const attempt = attemptResult.data;

    // Business rule: Must be in started status
    if (attempt.status !== 'started') {
      return { success: false, error: 'Attempt already submitted' };
    }

    // Get responses
    const responsesResult = await this.responseRepo.findByAttemptId(attemptId);
    if (!responsesResult.success) {
      return responsesResult;
    }

    // Business rule: Must have all required responses
    const validation = this.validateResponses(responsesResult.data);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Missing responses: ${validation.missing.join(', ')}` 
      };
    }

    // Calculate scores (delegated to scoring service)
    const scores = await this.scoreService.calculate(responsesResult.data);

    // Update attempt status
    await this.attemptRepo.update(attemptId, {
      status: 'completed',
      completedAt: new Date(),
      scores,
    });

    // Emit event
    await this.eventBus.emit('assessment.attempt.completed', {
      attemptId,
      userId: attempt.userId,
      scores,
    });

    return {
      success: true,
      data: { attemptId, scores },
    };
  }

  private async validatePairAttempt(
    userId: string,
    pairId: string
  ): Promise<Result<void>> {
    // Business validation for pair attempts
    // ...
  }

  private validateResponses(responses: AssessmentResponse[]): ValidationResult {
    // Check all required questions are answered
    // ...
  }
}
```

### Correct: API handler using service

```typescript
// src/api/handlers/assessment.ts
import { AssessmentService } from '@app/services/assessment/AssessmentService';
import { AssessmentAttemptRepository } from '@app/repositories/AssessmentAttemptRepository';

serveJson(async ({ req }) => {
  // HTTP layer: Parse request, auth
  const { dbClient, userContext } = await getAuth(req);
  const body = await req.json();
  const { action } = body;

  // Dependency injection
  const attemptRepo = new AssessmentAttemptRepository(dbClient);
  const responseRepo = new AssessmentResponseRepository(dbClient);
  const scoreService = new ScoringService();
  const assessmentService = new AssessmentService(attemptRepo, responseRepo, scoreService);

  // Delegate to service
  switch (action) {
    case 'start':
      return assessmentService.startAttempt({
        userId: userContext.userId,
        pairId: body.pairId,
      });

    case 'save':
      return assessmentService.saveResponse({
        attemptId: body.attemptId,
        questionId: body.questionId,
        value: body.value,
      });

    case 'submit':
      return assessmentService.submitAttempt(body.attemptId);

    default:
      return { status: 400, body: { error: 'Unknown action' } };
  }
});
```

### Correct: React hook using service

```typescript
// src/hooks/useAssessmentService.ts
export function useAssessmentService() {
  const dbClient = useDatabaseClient();
  
  const service = useMemo(() => {
    const attemptRepo = new AssessmentAttemptRepository(dbClient);
    const responseRepo = new AssessmentResponseRepository(dbClient);
    const scoreService = new ScoringService();
    return new AssessmentService(attemptRepo, responseRepo, scoreService);
  }, [dbClient]);

  return service;
}

// Component usage
function AssessmentFlow() {
  const assessmentService = useAssessmentService();
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);

  const handleStart = async () => {
    const result = await assessmentService.startAttempt({ userId: user.id });
    if (result.success) {
      setAttempt(result.data);
    } else {
      toast.error(result.error);
    }
  };

  // ... rest of component
}
```

### Incorrect: Business logic in handler

```typescript
// BAD: Handler contains business logic
serveJson(async ({ req }) => {
  const { dbClient, userContext } = await getAuth(req);
  const { attemptId, value, questionId } = await req.json();

  // Business logic in handler!
  const { data: attempt } = await dbClient
    .from('assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (attempt.status !== 'started') {
    return { status: 400, body: { error: 'Cannot modify' } };
  }

  if (value < 1 || value > 5) {
    return { status: 400, body: { error: 'Invalid value' } };
  }

  await dbClient.from('assessment_responses').upsert({
    attempt_id: attemptId,
    question_id: questionId,
    value,
  });

  return { body: { success: true } };
});

// GOOD: Handler delegates to service
serveJson(async ({ req }) => {
  const { dbClient, userContext } = await getAuth(req);
  const body = await req.json();

  const service = new AssessmentService(/* deps */);
  return service.saveResponse(body);
});
```

### Incorrect: Business logic in component

```typescript
// BAD: Component contains business logic
function AssessmentPage() {
  const dbClient = useDatabaseClient();

  const handleSubmit = async () => {
    // Business logic in component!
    const { data: responses } = await dbClient
      .from('assessment_responses')
      .select('*')
      .eq('attempt_id', attemptId);

    if (responses.length < REQUIRED_QUESTIONS) {
      toast.error('Answer all questions');
      return;
    }

    // Score calculation in component!
    const score = responses.reduce((sum, r) => sum + r.value, 0) / responses.length;

    await dbClient
      .from('assessment_attempts')
      .update({ status: 'completed', score })
      .eq('id', attemptId);
  };
}

// GOOD: Component uses service
function AssessmentPage() {
  const assessmentService = useAssessmentService();

  const handleSubmit = async () => {
    const result = await assessmentService.submitAttempt(attemptId);
    if (result.success) {
      navigate('/results');
    } else {
      toast.error(result.error);
    }
  };
}
```
