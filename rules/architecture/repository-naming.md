---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Repository Naming Conventions

Use consistent method naming in repository interfaces and implementations.

---

## Clear description

Predictable repository method names reduce cognitive load and make code searchable.

Repositories should expose standard CRUD/query methods and return `Result<T>` (or `BatchResult<T>`).

---

## Specific guidelines

- **DO** use `find*` for reads.
- **DO** use `create`, `update`, `delete`, `upsert` for mutations.
- **DO** use `count*`, `exists`, `has*` for counts/booleans.
- **DO** return `Result<T>` and use nullable returns only when "not found" is expected.
- **DON'T** use `get*`, `fetch*`, `retrieve*` as primary repository verbs.
- **DON'T** use vague names like `process`, `doSomething`.
- **DON'T** accept `unknown` filters; define typed filter DTOs.

---

## Implementation details

- **Single entity**
  - `findById(id)` returns `Result<Entity>` (not found treated as failure)
  - `findByEmail(email)` returns `Result<Entity | null>`

- **Collections**
  - `findAll(options?)` returns `Result<Entity[]>` (empty array for none)

- **Optional params**
  - Use `options` objects for paging/sorting.

---

## Benefits

- **Consistency** across domains
- **Easier onboarding** for devs/agents
- **More reliable refactors** (predictable patterns)

---

## Examples

### Correct: standard repository interface

```ts
export interface IUserRepository {
  findById(id: string): Promise<Result<User>>;
  findByEmail(email: string): Promise<Result<User | null>>;

  findAll(options?: { limit?: number; offset?: number }): Promise<Result<User[]>>;
  count(): Promise<Result<number>>;

  create(data: CreateUserDTO): Promise<Result<User>>;
  update(id: string, data: UpdateUserDTO): Promise<Result<User>>;
  delete(id: string): Promise<Result<void>>;
}
```

### Correct: domain-specific verb + noun

```ts
export interface IUserRewardRepository {
  findByUserId(userId: string): Promise<Result<UserReward[]>>;
  awardPoints(userId: string, points: number): Promise<Result<UserReward>>;
}
```

### Incorrect: vague naming

```ts
export interface IBadRepository {
  getById(id: string): Promise<User>; // use findById + Result
  fetchUsers(): Promise<any[]>; // naming + typing
  process(data: unknown): Promise<unknown>; // meaningless
}
```
