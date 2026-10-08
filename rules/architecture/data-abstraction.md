---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Data Abstraction Rules

## Overview

All data access MUST go through abstraction layers to ensure audit logging, type safety, and data warehouse compatibility.

---

## Core Rules

### R1: No Direct Database Calls in Components

Components MUST NOT call the database client directly.

```typescript
// FORBIDDEN in components
const MyComponent = () => {
  const handleSave = async () => {
    // WRONG: Direct database call in component
    await dbClient.from('production_records').insert(data);
  };
};

// CORRECT: Use mutation hook
const MyComponent = () => {
  const { createRecord } = useProductionMutation();

  const handleSave = async () => {
    await createRecord(data);  // Hook handles audit, validation, cache
  };
};
```

### R2: All Mutations Through Audited Hooks

Every mutation MUST go through a hook that includes audit logging:

```typescript
// src/hooks/production/useProductionMutation.ts
export function useProductionMutation() {
  return useMutation({
    mutationFn: async (data: CreateProductionInput) => {
      // 1. Execute mutation
      const { data: record, error } = await dbClient
        .from('production_records')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // 2. Audit logging (REQUIRED)
      await logAuditEntry({
        action: 'create',
        entity: 'production_records',
        entity_id: record.id,
        before_values: null,
        after_values: record,
        context_id: data.context_id,
      });

      return record;
    },
  });
}
```

### R3: Queries Can Be Direct (with Types)

Read operations can use direct database queries in hooks, but MUST use generated types:

```typescript
// ACCEPTABLE: Direct query in hook with types
export function useProductionHistory(contextId: string) {
  return useQuery({
    queryKey: ['production_records', contextId],
    queryFn: async () => {
      const { data, error } = await dbClient
        .from('production_records')
        .select('*')
        .eq('context_id', contextId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as ProductionRecord[];  // Type assertion
    },
  });
}
```

---

## Data Access Layers

### Layer 1: Components

- Use hooks for all data operations
- No database client imports allowed
- Handle loading/error states from hooks

```typescript
// Component uses hooks only
import { useProductionHistory, useProductionMutation } from '@app/hooks/production';

const ProductionPage = () => {
  const { data, isLoading } = useProductionHistory(contextId);
  const { createRecord } = useProductionMutation();
  // ...
};
```

### Layer 2: Hooks

- React Query hooks for fetching (`useQuery`)
- Mutation hooks with audit logging (`useMutation`)
- Cache invalidation logic
- Optimistic updates

```typescript
// Hook encapsulates data access + audit
export function useProductionMutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => { /* ... with audit */ },
    onSuccess: () => {
      queryClient.invalidateQueries(['production_records']);
    },
  });

  return { createRecord: createMutation.mutate };
}
```

### Layer 3: Services (Optional)

For complex business logic spanning multiple entities:

```typescript
// src/services/sorting-service.ts
export class SortingService {
  async completeSorting(batchId: string, results: SortingResults) {
    // 1. Create sorting record
    // 2. Update inventory levels
    // 3. Update batch status
    // 4. Log all audit entries
    // All in a transaction-like pattern
  }
}
```

---

## Pattern: Centralized Mutation Hook

### Structure

```typescript
// src/hooks/{domain}/use{Entity}Mutation.ts
export function use{Entity}Mutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createMutation = useMutation({
    mutationFn: async (input: Create{Entity}Input) => {
      // Validation
      const validated = validateInput(input);

      // Mutation
      const { data, error } = await dbClient
        .from('{table_name}')
        .insert(validated)
        .select()
        .single();

      if (error) throw error;

      // Audit
      await logAuditEntry({
        action: 'create',
        entity: '{table_name}',
        entity_id: data.id,
        before_values: null,
        after_values: data,
        context_id: input.context_id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['{table_name}']);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, changes }: Update{Entity}Input) => {
      // Get before state
      const { data: before } = await dbClient
        .from('{table_name}')
        .select()
        .eq('id', id)
        .single();

      // Mutation
      const { data, error } = await dbClient
        .from('{table_name}')
        .update(changes)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Audit
      await logAuditEntry({
        action: 'update',
        entity: '{table_name}',
        entity_id: id,
        before_values: before,
        after_values: data,
        context_id: data.context_id,
      });

      return data;
    },
  });

  return {
    create: createMutation.mutate,
    update: updateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
```

---

## DWH Readiness Checklist

Before any mutation hook is complete, verify:

- [ ] Audit logging with correct `entity` (table name)
- [ ] DWH context fields (`context_id`, `organization_id`) when applicable
- [ ] Correct `action` type (create/update/delete/deactivate/status_change)
- [ ] Before state captured for updates
- [ ] After state includes all changed fields

---

## Exceptions

### Allowed Direct Access

1. **Auth operations**: `auth.*` in auth context
2. **Storage operations**: `storage.*` for file uploads
3. **Realtime subscriptions**: `channel()` for live updates
4. **Admin utilities**: One-off scripts in `/scripts`

### Not Allowed

1. **Component-level mutations**: Always use hooks
2. **Unaudited mutations**: All business data changes need audit
3. **Raw SQL in components**: Use typed queries through hooks

---

## Related

- Repository Pattern (`./repository-pattern.md`)
