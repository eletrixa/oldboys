---
rule: typescript/generics
title: Generics
category: typescript
scope: [typescript]
priority: recommended
applies-to: [typescript]
tags: [generics, type-parameters, constraints, reusability, type-safety]
---

# TypeScript Generics

Write flexible, reusable code with properly constrained generic types.

---

## Description

Generics enable writing code that works with multiple types while maintaining type safety. This rule covers when to use generics, how to constrain them effectively, and patterns that maximize reusability without sacrificing clarity.

---

## Specific Guidelines

### DO:
- Use meaningful generic parameter names (`TItem`, `TResult`, not just `T`)
- Constrain generics with `extends` when you need specific properties
- Use `readonly` constraints for input arrays/objects
- Prefer generic constraints over union types for flexibility
- Use default type parameters when a sensible default exists
- Let TypeScript infer generic arguments when possible

### DON'T:
- Use single-letter generics except for very simple cases
- Create overly complex generic signatures (>3 type parameters)
- Force generic usage when a concrete type suffices
- Use `any` as a generic constraint
- Nest generics excessively (hard to read and maintain)

---

## Implementation Details

### Naming Conventions:
```typescript
// Prefer descriptive names with T prefix
type Result<TData, TError = Error> = 
  | { success: true; data: TData }
  | { success: false; error: TError };

// For simple utilities, short names are acceptable
function identity<T>(value: T): T {
  return value;
}

// For complex generics, use descriptive names
function transformArray<TInput, TOutput>(
  items: readonly TInput[],
  transformer: (item: TInput, index: number) => TOutput
): TOutput[] {
  return items.map(transformer);
}
```

### Constraining Generics:
```typescript
// Require specific properties
function getProperty<TObj, TKey extends keyof TObj>(
  obj: TObj,
  key: TKey
): TObj[TKey] {
  return obj[key];
}

// Require a shape
interface HasId {
  id: string;
}

function findById<TItem extends HasId>(
  items: readonly TItem[],
  id: string
): TItem | undefined {
  return items.find(item => item.id === id);
}
```

### Default Type Parameters:
```typescript
interface ApiResponse<TData = unknown, TError = Error> {
  data?: TData;
  error?: TError;
  status: number;
}

// Can omit defaults
const response1: ApiResponse = { status: 200 };

// Or specify one
const response2: ApiResponse<User> = { 
  data: user, 
  status: 200 
};

// Or both
const response3: ApiResponse<User, ValidationError> = {
  error: validationError,
  status: 400,
};
```

---

## Benefits

1. **Type safety**: Maintain type information through transformations
2. **Reusability**: Write once, use with many types
3. **IDE support**: Full autocomplete and error detection
4. **Self-documenting**: Constraints document expected types
5. **Refactoring safety**: Type system catches mismatches

---

## Examples

### Correct: Generic repository pattern

```typescript
interface Repository<TEntity extends { id: string }> {
  findById(id: string): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  create(data: Omit<TEntity, 'id'>): Promise<TEntity>;
  update(id: string, data: Partial<TEntity>): Promise<TEntity>;
  delete(id: string): Promise<void>;
}

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    const { data } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }
  
  async findAll(): Promise<User[]> {
    const { data } = await db.from('users').select('*');
    return data ?? [];
  }
  
  async create(userData: Omit<User, 'id'>): Promise<User> {
    const { data, error } = await db
      .from('users')
      .insert(userData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  
  async update(id: string, userData: Partial<User>): Promise<User> {
    const { data, error } = await db
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  
  async delete(id: string): Promise<void> {
    await db.from('users').delete().eq('id', id);
  }
}
```

### Correct: Generic result type

```typescript
type Result<TData, TError = Error> =
  | { success: true; data: TData }
  | { success: false; error: TError };

function ok<TData>(data: TData): Result<TData, never> {
  return { success: true, data };
}

function err<TError>(error: TError): Result<never, TError> {
  return { success: false, error };
}

// Usage with type inference
async function parseConfig(raw: string): Result<Config, ParseError> {
  try {
    const config = JSON.parse(raw);
    if (!isValidConfig(config)) {
      return err(new ParseError('Invalid config structure'));
    }
    return ok(config);
  } catch (e) {
    return err(new ParseError('Invalid JSON'));
  }
}

// Consuming the result
const result = await parseConfig(configString);
if (result.success) {
  // TypeScript knows result.data is Config
  initializeApp(result.data);
} else {
  // TypeScript knows result.error is ParseError
  console.error(result.error.message);
}
```

### Correct: Generic hook with constraints

```typescript
interface UseQueryOptions<TData> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
}

interface UseQueryResult<TData, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

function useQuery<TData, TError = Error>(
  options: UseQueryOptions<TData>
): UseQueryResult<TData, TError> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await options.queryFn();
      setData(result);
    } catch (e) {
      setError(e as TError);
    } finally {
      setIsLoading(false);
    }
  }, [options.queryFn]);
  
  useEffect(() => {
    if (options.enabled !== false) {
      refetch();
    }
  }, [options.enabled, refetch]);
  
  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    refetch,
  };
}

// Usage - types are inferred
const { data, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
// data is User | undefined
```

### Correct: Mapped type with generics

```typescript
// Make all properties optional and nullable
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P] | null;
};

// Pick only specific keys with type transformation
type PickAndTransform<TObj, TKeys extends keyof TObj, TNew> = {
  [K in TKeys]: TNew;
};

// Practical example: form state from entity
interface User {
  id: string;
  email: string;
  profile: {
    name: string;
    bio: string;
    avatar: string;
  };
}

type UserFormState = DeepPartial<Omit<User, 'id'>>;
// Result:
// {
//   email?: string | null;
//   profile?: {
//     name?: string | null;
//     bio?: string | null;
//     avatar?: string | null;
//   };
// }
```

### Incorrect: Single letter generics everywhere

```typescript
// BAD: What does T, U, V mean?
function process<T, U, V>(
  data: T,
  transform: (item: T) => U,
  validate: (result: U) => V
): V {
  return validate(transform(data));
}

// GOOD: Descriptive names
function process<TInput, TIntermediate, TOutput>(
  data: TInput,
  transform: (item: TInput) => TIntermediate,
  validate: (result: TIntermediate) => TOutput
): TOutput {
  return validate(transform(data));
}
```

### Incorrect: Overly complex generic signature

```typescript
// BAD: Too many type parameters, hard to understand
function createHandler<
  TReq extends Request,
  TRes extends Response,
  TContext extends Record<string, unknown>,
  TMiddleware extends Middleware<TReq, TRes>,
  THandler extends Handler<TReq, TRes, TContext>,
  TResult extends Result<unknown>
>(
  middleware: TMiddleware[],
  handler: THandler,
  context: TContext
): TResult {
  // ...
}

// GOOD: Simplify with intermediate types or split functions
interface HandlerConfig<TContext = Record<string, unknown>> {
  middleware: Middleware[];
  context: TContext;
}

function createHandler<TContext>(
  config: HandlerConfig<TContext>,
  handler: Handler<TContext>
): HandlerResult {
  // ...
}
```

### Incorrect: Unnecessary generics

```typescript
// BAD: Generic adds no value here
function formatUserName<T extends User>(user: T): string {
  return `${user.firstName} ${user.lastName}`;
}

// GOOD: Just use the concrete type
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

// BAD: Generic that's always the same type
function fetchUsers<T>(): Promise<T> {
  return fetch('/api/users').then(r => r.json());
}

// GOOD: Explicit return type
function fetchUsers(): Promise<User[]> {
  return fetch('/api/users').then(r => r.json());
}
```

### Incorrect: Using any as constraint

```typescript
// BAD: any defeats the purpose of generics
function process<T extends any>(data: T): T {
  return data;
}

// GOOD: Use unknown or remove constraint
function process<T>(data: T): T {
  return data;
}

// Or use a meaningful constraint
function process<T extends Record<string, unknown>>(data: T): T {
  return data;
}
```
