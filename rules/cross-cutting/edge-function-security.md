---
category: cross-cutting
scope: [serverless]
priority: recommended
applies-to: [deno, supabase, typescript]
tags: [edge-functions, serverless]
---

# Supabase Edge Function Security

Protect edge functions with proper authentication, authorization, and data handling.

---

## Description

Edge functions are publicly accessible endpoints. Security must be enforced at multiple layers: authentication (who is calling), authorization (what are they allowed to do), input validation, and secure data handling. This rule covers security best practices for Supabase Edge Functions.

---

## Specific Guidelines

### DO:
- Always validate bearer tokens before processing
- Use per-request Supabase clients to enforce RLS
- Verify resource ownership before operations
- Use Zod for strict input validation
- Log security events (auth failures, unauthorized access)
- Access secrets via `Deno.env.get()` only

### DON'T:
- Log secrets, tokens, or sensitive data
- Return secrets in responses
- Trust client-provided user IDs
- Use service role key for user-facing operations
- Skip auth checks for "internal" functions
- Expose stack traces in production

---

## Implementation Details

### Authentication Flow:
```typescript
// 1. Extract token
const authHeader = req.headers.get('authorization');
const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

if (!token) {
  return json(401, { error: 'Authorization required' });
}

// 2. Create authenticated client
const supabase = createClient(token);

// 3. Verify token and get user
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return json(401, { error: 'Invalid or expired token' });
}

// user.id is now trusted
```

### Authorization Pattern:
```typescript
// Check resource ownership
const { data: resource, error } = await supabase
  .from('resources')
  .select('*')
  .eq('id', resourceId)
  .eq('owner_id', user.id) // MUST match authenticated user
  .single();

if (error || !resource) {
  // Don't reveal if resource exists but user doesn't own it
  return json(404, { error: 'Resource not found' });
}
```

### Secrets Management:
```typescript
// Access secrets safely
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
  logger.error('STRIPE_SECRET_KEY not configured');
  return json(500, { error: 'Configuration error' });
}

// NEVER log secrets
console.log(stripeKey); // NEVER!
logger.info('Stripe configured', { key: stripeKey }); // NEVER!
```

---

## Benefits

1. **Defense in depth**: Multiple security layers
2. **RLS enforcement**: Database-level access control
3. **Audit trail**: Security events are logged
4. **Secrets protection**: Credentials never exposed
5. **Least privilege**: Users only access their own data

---

## Examples

### Correct: Full authentication and authorization

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders, json, bearer } from '../_shared/http.ts';
import { createClient } from '../_shared/supabase-client.ts';
import { logger } from '../_shared/logger.ts';

const DeleteAttemptSchema = z.object({
  attemptId: z.string().uuid(),
});

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'DELETE') {
    return json(405, { error: 'Method Not Allowed' });
  }
  
  // 1. Authentication
  const token = bearer(req);
  if (!token) {
    logger.warn('Missing auth token', { requestId });
    return json(401, { error: 'Authorization required' });
  }
  
  const supabase = createClient(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    logger.warn('Invalid token', { requestId, error: authError?.message });
    return json(401, { error: 'Invalid or expired token' });
  }
  
  // 2. Input validation
  const body: unknown = await req.json();
  const parsed = DeleteAttemptSchema.safeParse(body);
  
  if (!parsed.success) {
    return json(400, { 
      error: 'Invalid input',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  
  const { attemptId } = parsed.data;
  
  try {
    // 3. Authorization - verify ownership
    const { data: attempt, error: fetchError } = await supabase
      .from('attempts')
      .select('id, user_id, status')
      .eq('id', attemptId)
      .single();
    
    // Resource not found or RLS blocked (user doesn't own it)
    if (fetchError || !attempt) {
      logger.info('Attempt not found or unauthorized', { 
        requestId, 
        attemptId,
        userId: user.id,
      });
      // Don't reveal if attempt exists for different user
      return json(404, { error: 'Attempt not found' });
    }
    
    // 4. Business rule: can't delete completed attempts
    if (attempt.status === 'completed') {
      return json(400, { error: 'Cannot delete completed attempts' });
    }
    
    // 5. Perform deletion
    const { error: deleteError } = await supabase
      .from('attempts')
      .delete()
      .eq('id', attemptId)
      .eq('user_id', user.id); // Extra safety
    
    if (deleteError) {
      throw deleteError;
    }
    
    logger.info('Attempt deleted', { requestId, attemptId, userId: user.id });
    
    return json(200, { success: true });
    
  } catch (error) {
    logger.error('Delete failed', { 
      requestId, 
      attemptId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    
    return json(500, { error: 'Internal server error' });
  }
});
```

### Correct: Secure webhook handling

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0';
import { corsHeaders, json } from '../_shared/http.ts';
import { logger } from '../_shared/logger.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }
  
  // 1. Get webhook secret from environment
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return json(500, { error: 'Configuration error' });
  }
  
  // 2. Get signature header
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    logger.warn('Missing Stripe signature');
    return json(401, { error: 'Missing signature' });
  }
  
  // 3. Verify webhook signature
  const body = await req.text();
  let event: Stripe.Event;
  
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });
    
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.warn('Invalid webhook signature', { 
      error: err instanceof Error ? err.message : 'Unknown' 
    });
    return json(401, { error: 'Invalid signature' });
  }
  
  // 4. Process verified event
  logger.info('Webhook received', { type: event.type, id: event.id });
  
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    // ... more cases
    default:
      logger.info('Unhandled event type', { type: event.type });
  }
  
  return json(200, { received: true });
});
```

### Incorrect: Trusting client-provided user ID

```typescript
// BAD: Trust client-provided userId
serve(async (req: Request) => {
  const body = await req.json();
  
  // Client can send ANY user ID!
  const { userId, action } = body;
  
  // This allows impersonation!
  const { data } = await adminClient
    .from('user_settings')
    .update({ ...action })
    .eq('user_id', userId); // Security vulnerability!
});

// GOOD: Get userId from verified token
serve(async (req: Request) => {
  const token = bearer(req);
  const supabase = createClient(token);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return json(401, { error: 'Unauthorized' });
  }
  
  const body = await req.json();
  const { action } = body;
  
  // Use authenticated user.id
  const { data } = await supabase
    .from('user_settings')
    .update({ ...action })
    .eq('user_id', user.id); // Verified user ID
});
```

### Incorrect: Logging sensitive data

```typescript
// BAD: Logging secrets and tokens
serve(async (req: Request) => {
  const token = bearer(req);
  
  // Never log tokens!
  console.log('Received token:', token);
  logger.info('Auth token', { token });
  
  const apiKey = Deno.env.get('API_KEY');
  
  // Never log API keys!
  console.log('Using API key:', apiKey);
  
  const body = await req.json();
  
  // Never log full request bodies (may contain passwords, CC numbers)
  logger.info('Request body', { body });
});

// GOOD: Log safely
serve(async (req: Request) => {
  const token = bearer(req);
  
  // Log presence, not value
  logger.info('Request received', { hasToken: !!token });
  
  // Log sanitized data
  const body = await req.json();
  logger.info('Request received', { 
    action: body.action,
    resourceId: body.resourceId,
    // Don't log: password, creditCard, token, etc.
  });
});
```

### Incorrect: Returning secrets in response

```typescript
// BAD: Exposing internal data
serve(async (req: Request) => {
  try {
    const apiKey = Deno.env.get('EXTERNAL_API_KEY');
    const result = await callExternalApi(apiKey);
    
    // Never return internal keys/config!
    return json(200, { 
      data: result,
      config: {
        apiKey, // Exposed!
        internalUrl: Deno.env.get('INTERNAL_URL'), // Exposed!
      }
    });
  } catch (error) {
    // Never return stack traces in production!
    return json(500, { 
      error: error.message,
      stack: error.stack, // Internal details exposed!
    });
  }
});

// GOOD: Return only necessary data
serve(async (req: Request) => {
  try {
    const result = await callExternalApi();
    
    return json(200, { data: result });
  } catch (error) {
    logger.error('API call failed', { error: error.message });
    
    return json(500, { error: 'External service unavailable' });
  }
});
```
