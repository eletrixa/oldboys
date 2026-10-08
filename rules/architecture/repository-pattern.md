---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Repository Pattern

Encapsulate all database access in repository classes with security-aware base classes.

---

## Description

The repository pattern separates data access logic from business logic. All database operations should go through repository classes that extend a security-aware base, ensuring consistent authorization enforcement and type safety.

---

## Specific Guidelines

### DO:
- Create repository class for each database entity
- Extend a security-aware base repository for protected tables
- Inject database client via constructor
- Return typed Result objects from repository methods
- Use repository methods in services, never raw queries
- Keep repositories focused on CRUD operations

### DON'T:
- Use raw database queries directly in components/services
- Put business logic in repositories
- Create repositories without proper typing
- Skip the security-aware base class for user data
- Mix multiple entity types in one repository
- Return raw database responses without transformation

---

## Implementation Details

### Repository Structure:

```
src/core/repositories/
├── interfaces/
│   ├── IUserRepository.ts
│   └── IOrderRepository.ts
├── implementations/
│   ├── SecurityAwareRepository.ts  # Base class
│   ├── UserRepository.ts
│   └── OrderRepository.ts
└── index.ts                        # Exports
```

### SecurityAwareRepository Base Class:

```typescript
export abstract class SecurityAwareRepository<T> {
  constructor(
    protected readonly dbClient: DatabaseClient,
    protected readonly config: {
      entityName: string;
      tableName: string;
    }
  ) {}

  protected async createSecure(
    data: Omit<T, 'id'>,
    authUser: User
  ): Promise<Result<T>> {
    // RLS enforced via per-request client
  }

  protected async findByIdSecure(
    id: string,
    authUser: User
  ): Promise<Result<T | null>> {
    // RLS enforced
  }
}
```

---

## Benefits

1. **Security**: Authorization enforced at repository level
2. **Type safety**: Typed inputs and outputs
3. **Testability**: Easy to mock repositories
4. **Maintainability**: Database logic centralized
5. **Consistency**: Same patterns across all data access

---

## Examples

### Correct: Repository implementation

```typescript
// src/core/repositories/implementations/AssessmentAttemptRepository.ts
import { DatabaseClient } from '@app/database';
import { SecurityAwareRepository } from './SecurityAwareRepository';
import type { AssessmentAttempt, CreateAttemptDTO } from '@app/types/assessment';
import type { Result } from '@app/types/result';

export class AssessmentAttemptRepository extends SecurityAwareRepository<AssessmentAttempt> {
  constructor(dbClient: DatabaseClient) {
    super(dbClient, {
      entityName: 'AssessmentAttempt',
      tableName: 'assessment_attempts',
    });
  }

  async create(data: CreateAttemptDTO): Promise<Result<AssessmentAttempt>> {
    const { data: attempt, error } = await this.dbClient
      .from('assessment_attempts')
      .insert({
        user_id: data.userId,
        pair_id: data.pairId,
        role: data.role,
        status: 'started',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: this.mapToEntity(attempt) };
  }

  async findById(id: string): Promise<Result<AssessmentAttempt | null>> {
    const { data, error } = await this.dbClient
      .from('assessment_attempts')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ? this.mapToEntity(data) : null };
  }

  async findByUserId(userId: string): Promise<Result<AssessmentAttempt[]>> {
    const { data, error } = await this.dbClient
      .from('assessment_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.map(this.mapToEntity) };
  }

  async updateStatus(
    id: string,
    status: AssessmentAttempt['status']
  ): Promise<Result<AssessmentAttempt>> {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.dbClient
      .from('assessment_attempts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: this.mapToEntity(data) };
  }

  private mapToEntity(row: any): AssessmentAttempt {
    return {
      id: row.id,
      userId: row.user_id,
      pairId: row.pair_id,
      role: row.role,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      score: row.score,
    };
  }
}
```

### Correct: Using repository in service

```typescript
// src/services/AssessmentService.ts
export class AssessmentService {
  constructor(
    private readonly attemptRepo: AssessmentAttemptRepository,
    private readonly responseRepo: AssessmentResponseRepository,
    private readonly scoreCalculator: ScoreCalculator
  ) {}

  async startAttempt(userId: string, pairId?: string): Promise<Result<AssessmentAttempt>> {
    // Business logic
    const existingResult = await this.attemptRepo.findByUserId(userId);
    if (!existingResult.success) {
      return existingResult;
    }

    const activeAttempt = existingResult.data.find(a => a.status === 'started');
    if (activeAttempt) {
      return { success: false, error: 'Active attempt already exists' };
    }

    // Delegate data access to repository
    return this.attemptRepo.create({
      userId,
      pairId,
      role: pairId ? 'self' : 'individual',
    });
  }

  async submitAttempt(attemptId: string): Promise<Result<AssessmentAttempt>> {
    const attemptResult = await this.attemptRepo.findById(attemptId);
    if (!attemptResult.success || !attemptResult.data) {
      return { success: false, error: 'Attempt not found' };
    }

    const attempt = attemptResult.data;
    if (attempt.status !== 'started') {
      return { success: false, error: 'Attempt is not in progress' };
    }

    // Get responses via repository
    const responsesResult = await this.responseRepo.findByAttemptId(attemptId);
    if (!responsesResult.success) {
      return responsesResult;
    }

    // Calculate score (business logic)
    const score = this.scoreCalculator.calculate(responsesResult.data);

    // Update via repository
    return this.attemptRepo.updateStatus(attemptId, 'completed');
  }
}
```

### Correct: Repository interface for DI

```typescript
// src/core/repositories/interfaces/IAssessmentAttemptRepository.ts
export interface IAssessmentAttemptRepository {
  create(data: CreateAttemptDTO): Promise<Result<AssessmentAttempt>>;
  findById(id: string): Promise<Result<AssessmentAttempt | null>>;
  findByUserId(userId: string): Promise<Result<AssessmentAttempt[]>>;
  updateStatus(id: string, status: string): Promise<Result<AssessmentAttempt>>;
}

// Allows easy mocking in tests
class MockAssessmentAttemptRepository implements IAssessmentAttemptRepository {
  create = vi.fn();
  findById = vi.fn();
  findByUserId = vi.fn();
  updateStatus = vi.fn();
}
```

### Incorrect: Direct database queries in components

```typescript
// BAD: Database access in component
function AssessmentDashboard({ userId }: Props) {
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);

  useEffect(() => {
    // Direct database query in component!
    dbClient
      .from('assessment_attempts')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => setAttempts(data ?? []));
  }, [userId]);

  return <AttemptsList attempts={attempts} />;
}

// GOOD: Use repository via hook/service
function AssessmentDashboard({ userId }: Props) {
  const { data: attempts } = useAssessmentAttempts(userId);
  return <AttemptsList attempts={attempts ?? []} />;
}

// Hook uses repository
function useAssessmentAttempts(userId: string) {
  const repo = useAssessmentAttemptRepository();
  return useQuery({
    queryKey: ['assessment', 'attempts', userId],
    queryFn: () => repo.findByUserId(userId),
  });
}
```

### Incorrect: Business logic in repository

```typescript
// BAD: Repository does business logic
class AssessmentAttemptRepository {
  async submitAndCalculateScore(attemptId: string): Promise<Result<number>> {
    const attempt = await this.findById(attemptId);
    
    // Business logic in repository!
    if (attempt.status !== 'started') {
      throw new Error('Cannot submit');
    }

    const responses = await this.getResponses(attemptId);
    
    // Score calculation is business logic!
    const score = responses.reduce((sum, r) => sum + r.value, 0) / responses.length;
    
    await this.update(attemptId, { status: 'completed', score });
    
    return { success: true, data: score };
  }
}

// GOOD: Repository only does CRUD, service handles logic
class AssessmentAttemptRepository {
  async findById(id: string): Promise<Result<AssessmentAttempt | null>> { /* ... */ }
  async update(id: string, data: Partial<AssessmentAttempt>): Promise<Result<AssessmentAttempt>> { /* ... */ }
}

class AssessmentService {
  async submitAttempt(attemptId: string): Promise<Result<number>> {
    // Business logic in service
    const attempt = await this.attemptRepo.findById(attemptId);
    if (attempt.status !== 'started') {
      return { success: false, error: 'Cannot submit' };
    }

    const responses = await this.responseRepo.findByAttemptId(attemptId);
    const score = this.scoreCalculator.calculate(responses);

    await this.attemptRepo.update(attemptId, { status: 'completed', score });
    
    return { success: true, data: score };
  }
}
```

### Incorrect: Missing type safety

```typescript
// BAD: Untyped repository
class UserRepository {
  async findById(id: string) {
    const { data } = await dbClient.from('users').select('*').eq('id', id).single();
    return data; // Type is any!
  }
}

// GOOD: Fully typed
class UserRepository {
  async findById(id: string): Promise<Result<User | null>> {
    const { data, error } = await this.dbClient
      .from('users')
      .select('id, email, name, created_at')
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      data: data ? this.mapToEntity(data) : null 
    };
  }

  private mapToEntity(row: DatabaseRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.created_at),
    };
  }
}
```
