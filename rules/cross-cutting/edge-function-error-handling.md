---
category: cross-cutting
scope: [serverless]
priority: recommended
applies-to: [deno, supabase, typescript]
tags: [edge-functions, serverless]
---

# Supabase Edge Function Error Handling

Handle errors gracefully with consistent responses and proper logging.

---

## Description

Edge functions must handle errors gracefully, providing useful feedback to clients while logging details for debugging. This rule covers error classification, response formatting, retry handling, and monitoring integration.

---

## Specific Guidelines

### DO:
- Use custom error classes for different error types
- Return appropriate HTTP status codes (4xx vs 5xx)
- Log errors with context (requestId, userId, operation)
- Distinguish client errors from server errors
- Include error codes for programmatic handling
- Provide actionable error messages

### DON'T:
- Return 500 for all errors
- Expose internal error details in production
- Swallow errors silently
- Use generic error messages without codes
- Forget to log before returning error responses

---

## Implementation Details

### Custom Error Classes:
```typescript
// _shared/errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_REQUIRED', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}
```

### Error Handler Pattern:
```typescript
function handleError(error: unknown, requestId: string): Response {
  // Known application errors
  if (error instanceof AppError) {
    logger.warn('Application error', {
      requestId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    
    return json(error.statusCode, {
      error: error.message,
      code: error.code,
      ...(error.details && { details: error.details }),
    });
  }
  
  // Database errors (Supabase/PostgreSQL)
  if (isPostgresError(error)) {
    return handlePostgresError(error, requestId);
  }
  
  // Unknown errors - log full details, return generic message
  logger.error('Unexpected error', {
    requestId,
    error: error instanceof Error ? error.stack : String(error),
  });
  
  return json(500, {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId, // For support reference
  });
}
```

---

## Benefits

1. **Consistent API**: Clients know what error shape to expect
2. **Debugging**: Structured logs with context
3. **User experience**: Actionable error messages
4. **Monitoring**: Error codes enable alerting
5. **Security**: Internal details not exposed

---

## Examples

### Correct: Comprehensive error handling

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders, json, bearer } from '../_shared/http.ts';
import { createClient } from '../_shared/supabase-client.ts';
import { logger } from '../_shared/logger.ts';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '../_shared/errors/index.ts';

const SubmitSchema = z.object({
  attemptId: z.string().uuid(),
});

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    if (req.method !== 'POST') {
      throw new AppError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
    }
    
    const token = bearer(req);
    if (!token) {
      throw new AuthenticationError();
    }
    
    const supabase = createClient(token);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new AuthenticationError('Invalid or expired token');
    }
    
    // Parse input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }
    
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid request data',
        parsed.error.flatten().fieldErrors
      );
    }
    
    const { attemptId } = parsed.data;
    
    // Fetch resource
    const { data: attempt, error: fetchError } = await supabase
      .from('attempts')
      .select('id, status, user_id')
      .eq('id', attemptId)
      .single();
    
    if (fetchError || !attempt) {
      throw new NotFoundError('Attempt');
    }
    
    // Already submitted
    if (attempt.status === 'submitted' || attempt.status === 'completed') {
      throw new ConflictError('Attempt already submitted');
    }
    
    // Not started
    if (attempt.status === 'not_started') {
      throw new ValidationError('Cannot submit attempt that was not started');
    }
    
    // Submit
    const { error: submitError } = await supabase
      .from('attempts')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', attemptId);
    
    if (submitError) {
      throw submitError;
    }
    
    logger.info('Attempt submitted', { requestId, attemptId, userId: user.id });
    
    return json(200, { 
      success: true,
      data: { attemptId, status: 'submitted' },
    });
    
  } catch (error) {
    return handleError(error, requestId);
  }
});

function handleError(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    logger.warn('Application error', {
      requestId,
      code: error.code,
      message: error.message,
    });
    
    return json(error.statusCode, {
      error: error.message,
      code: error.code,
      ...(error.details && { details: error.details }),
    });
  }
  
  // PostgreSQL unique constraint violation
  if (isPostgresError(error) && error.code === '23505') {
    logger.warn('Duplicate entry', { requestId, error: error.message });
    return json(409, {
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }
  
  // PostgreSQL foreign key violation
  if (isPostgresError(error) && error.code === '23503') {
    logger.warn('Foreign key violation', { requestId, error: error.message });
    return json(400, {
      error: 'Referenced resource does not exist',
      code: 'INVALID_REFERENCE',
    });
  }
  
  // Unknown error
  logger.error('Unexpected error', {
    requestId,
    error: error instanceof Error ? error.stack : String(error),
  });
  
  return json(500, {
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    requestId,
  });
}

interface PostgresError {
  code: string;
  message: string;
  details?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PostgresError).code === 'string'
  );
}
```

### Correct: Error response with retry info

```typescript
// For rate limiting or temporary failures
function handleRateLimitError(retryAfter: number, requestId: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter,
      requestId,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        ...corsHeaders,
      },
    }
  );
}

// For temporary service unavailability
function handleServiceUnavailable(requestId: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      requestId,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '30',
        ...corsHeaders,
      },
    }
  );
}
```

### Incorrect: Generic 500 for all errors

```typescript
// BAD: All errors return 500
serve(async (req: Request) => {
  try {
    const body = await req.json();
    const { userId } = body;
    
    const result = await processUser(userId);
    return json(200, result);
    
  } catch (error) {
    // Invalid input? 500. Auth failed? 500. Not found? 500.
    console.error(error);
    return json(500, { error: 'Something went wrong' });
  }
});
```

### Incorrect: Exposing internal details

```typescript
// BAD: Leaking internal information
serve(async (req: Request) => {
  try {
    await riskyOperation();
  } catch (error) {
    // Exposes database schema, file paths, etc.
    return json(500, {
      error: error.message,
      stack: error.stack,
      query: 'SELECT * FROM users WHERE password = ...',
      config: {
        dbHost: Deno.env.get('DB_HOST'),
        apiKey: Deno.env.get('API_KEY'),
      },
    });
  }
});
```

### Incorrect: Swallowing errors

```typescript
// BAD: Errors swallowed silently
serve(async (req: Request) => {
  const body = await req.json();
  
  try {
    await processPayment(body);
  } catch (error) {
    // Error swallowed, no logging!
  }
  
  // Returns success even if payment failed!
  return json(200, { success: true });
});

// GOOD: Always handle and report errors
serve(async (req: Request) => {
  const body = await req.json();
  
  try {
    await processPayment(body);
    return json(200, { success: true });
  } catch (error) {
    logger.error('Payment failed', { error: error.message });
    return json(500, { 
      error: 'Payment processing failed',
      code: 'PAYMENT_FAILED',
    });
  }
});
```

### Incorrect: Inconsistent error shapes

```typescript
// BAD: Different error shapes make client handling hard
serve(async (req: Request) => {
  // Sometimes returns { error: string }
  if (!token) {
    return json(401, { error: 'Unauthorized' });
  }
  
  // Sometimes returns { message: string }
  if (!body.id) {
    return json(400, { message: 'ID required' });
  }
  
  // Sometimes returns { msg: string, success: false }
  if (error) {
    return json(500, { msg: 'Failed', success: false });
  }
});

// GOOD: Consistent error shape
interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
  requestId?: string;
}

// All errors follow this shape
return json(statusCode, {
  error: 'Human readable message',
  code: 'MACHINE_READABLE_CODE',
  details: optionalDetails,
  requestId: forSupport,
});
```
