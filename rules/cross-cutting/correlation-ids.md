---
category: cross-cutting
scope: [backend]
priority: recommended
applies-to: [all]
tags: [observability, tracing]
---

# Correlation IDs and Structured Logging

Use correlation IDs and structured logging to trace a single user action end-to-end across frontend, services, and edge functions.

---

## Clear description

Correlation IDs enable reliable debugging and auditability by tying together:

- Frontend actions
- Service/repository operations
- Edge function requests
- Sentry events

All logs should be structured and include the correlation ID.

---

## Specific guidelines

- **DO** generate a `correlationId` at the start of a user action/flow.
- **DO** propagate the correlation ID through services and API calls.
- **DO** send the correlation ID to edge functions via the `X-Correlation-ID` header.
- **DO** include `correlationId` in all logging context and Sentry `extra`.
- **DO** log as structured JSON (or via the unified logging abstraction).
- **DON'T** use raw `console.log` in the app; use the logging system.
- **DON'T** log secrets, tokens, raw JWTs, payment details, or sensitive PII.
- **DON'T** create a new correlation ID mid-flow (except for a new top-level user action).

---

## Implementation details

- **Frontend**
  - Generate a `correlationId` at the start of a user interaction (button click, form submit, mutation).
  - Include it in:
    - log context
    - Sentry `extra`
    - edge function calls as `X-Correlation-ID`

- **Edge functions**
  - Read `X-Correlation-ID`.
  - Include it in all logs.
  - Attach it to Sentry scopes.

- **Logging schema** (conceptual)
  - `level`, `message`, `correlationId`, and a small structured context object.

---

## Benefits

- **Faster debugging** across distributed boundaries
- **Reliable incident investigation** (Sentry + logs match)
- **Reduced log noise** via structured context
- **Easier monitoring** (grouping by correlation ID)

---

## Examples

### Correct (frontend): generate + propagate

```ts
import { logger } from '@app/services/logging/LoggingService';

function nanoCorrelationId(): string {
  return `req_${crypto.randomUUID()}`;
}

async function onSubmitPurchase(form: PurchaseFormValues) {
  const correlationId = nanoCorrelationId();

  logger.info('Purchase submit started', {
    correlationId,
    action: 'purchase.submit',
    metadata: { productSlug: form.productSlug },
  });

  const res = await fetch('/functions/v1/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    },
    body: JSON.stringify({ productSlug: form.productSlug }),
  });

  if (!res.ok) {
    logger.error('Purchase submit failed', new Error('Checkout create failed'), {
      correlationId,
      action: 'purchase.submit',
    });
    return;
  }

  logger.info('Purchase submit completed', {
    correlationId,
    action: 'purchase.submit',
  });
}
```

### Correct (edge function): read header + log

```ts
import { serveJson } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('create-checkout');

serveJson(async ({ req }) => {
  const correlationId = req.headers.get('X-Correlation-ID') ?? 'missing';

  logger.info('Checkout create start', {
    correlationId,
    action: 'stripe.checkout.create',
  });

  // ... do work ...

  logger.info('Checkout create success', {
    correlationId,
    action: 'stripe.checkout.create',
  });

  return { body: { ok: true } };
});
```

### Incorrect: no correlation id + unstructured console

```ts
async function onSubmit() {
  console.log('starting');
  await fetch('/functions/v1/create-checkout', { method: 'POST' });
  console.log('done');
}
```

### Incorrect: logging sensitive values

```ts
logger.info('Auth header', {
  correlationId,
  metadata: {
    authorization: req.headers.get('Authorization'), // never log tokens
  },
});
```
