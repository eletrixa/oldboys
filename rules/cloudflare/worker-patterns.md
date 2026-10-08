---
category: cloudflare
scope: [cloudflare]
priority: recommended
applies-to: [cloudflare-workers, typescript]
---

# Cloudflare Worker Patterns

Write Cloudflare Workers that are fast, reliable, and operate within runtime constraints.

---

## Description

Cloudflare Workers run on the edge with specific runtime constraints. This rule covers how to structure workers, handle requests, use bindings, and work within CPU/memory limits for optimal performance.

---

## Specific Guidelines

### DO:
- Use typed environment bindings via `Env` interface
- Export `fetch` handler as default export
- Return `Response` objects (not plain values)
- Use `waitUntil()` for non-blocking background work
- Stream large responses instead of buffering
- Handle errors at the handler level

### DON'T:
- Use Node.js APIs (fs, path, process)
- Block on CPU-intensive operations
- Store state in global variables between requests
- Exceed 128MB memory or 10ms CPU (free) / 30s (paid)
- Forget to handle CORS for browser requests

---

## Implementation Details

### Worker Structure:
```typescript
// src/index.ts
interface Env {
  MY_KV: KVNamespace;
  MY_BUCKET: R2Bucket;
  DATABASE_URL: string;
  API_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    try {
      return await router(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
  
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleCronJob(env));
  },
};
```

### waitUntil for Background Work:
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleRequest(request, env);
    
    // Non-blocking: analytics, logging, cleanup
    ctx.waitUntil(
      Promise.all([
        logToAnalytics(request, response),
        updateCache(env.MY_KV),
      ])
    );
    
    return response;
  },
};
```

---

## Benefits

1. **Edge performance**: Code runs close to users
2. **Type safety**: Typed bindings prevent runtime errors
3. **Reliability**: Proper error handling and resource management
4. **Scalability**: Stateless design handles any load
5. **Cost efficiency**: Optimized for Worker pricing model

---

## Examples

### Correct: Well-structured API worker

```typescript
import { Router } from '@app/router';
import { corsHeaders, handleCORS } from '@app/cors';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }
    
    const url = new URL(request.url);
    
    try {
      // Rate limiting
      const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const isLimited = await checkRateLimit(env.RATE_LIMIT_KV, clientIP);
      
      if (isLimited) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            ...corsHeaders,
          },
        });
      }
      
      // Route request
      const router = new Router(env);
      const response = await router.handle(request);
      
      // Add CORS headers to response
      const corsResponse = new Response(response.body, response);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        corsResponse.headers.set(key, value);
      });
      
      // Background: log request (non-blocking)
      ctx.waitUntil(logRequest(request, response.status, env));
      
      return corsResponse;
      
    } catch (error) {
      console.error('Request failed:', error);
      
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },
};

async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `rate:${ip}`;
  const count = parseInt(await kv.get(key) ?? '0');
  
  if (count > 100) {
    return true;
  }
  
  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return false;
}

async function logRequest(
  request: Request, 
  status: number, 
  env: Env
): Promise<void> {
  // Non-blocking analytics
  const data = {
    url: request.url,
    method: request.method,
    status,
    timestamp: Date.now(),
    cf: request.cf,
  };
  console.log('Request:', JSON.stringify(data));
}
```

### Correct: R2 streaming response

```typescript
interface Env {
  ASSETS_BUCKET: R2Bucket;
}

async function handleAssetRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.slice(1); // Remove leading /
  
  const object = await env.ASSETS_BUCKET.get(key);
  
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }
  
  // Stream response - don't buffer entire file
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');
  
  return new Response(object.body, { headers });
}
```

### Correct: Scheduled worker (cron)

```typescript
interface Env {
  DATABASE_URL: string;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('Cron triggered:', event.cron);
    
    ctx.waitUntil(
      (async () => {
        try {
          // Check which cron triggered
          switch (event.cron) {
            case '0 * * * *': // Every hour
              await cleanupExpiredSessions(env);
              break;
            case '0 0 * * *': // Daily at midnight
              await generateDailyReport(env);
              break;
            default:
              console.log('Unknown cron pattern:', event.cron);
          }
        } catch (error) {
          console.error('Cron job failed:', error);
        }
      })()
    );
  },
};

async function cleanupExpiredSessions(env: Env): Promise<void> {
  // Cleanup logic
  console.log('Cleaning up expired sessions');
}

async function generateDailyReport(env: Env): Promise<void> {
  // Report generation logic
  console.log('Generating daily report');
}
```

### Incorrect: Using Node.js APIs

```typescript
// BAD: Node.js APIs don't exist in Workers
import fs from 'fs';
import path from 'path';

export default {
  async fetch(request: Request): Promise<Response> {
    // fs doesn't exist!
    const content = fs.readFileSync('./data.json');
    
    // process doesn't exist!
    const apiKey = process.env.API_KEY;
    
    // path doesn't exist!
    const filePath = path.join(__dirname, 'file.txt');
    
    return new Response(content);
  },
};

// GOOD: Use Web APIs and bindings
interface Env {
  API_KEY: string;
  DATA_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use KV for data storage
    const content = await env.DATA_KV.get('data');
    
    // Use env bindings for secrets
    const apiKey = env.API_KEY;
    
    // Use URL API for path handling
    const url = new URL(request.url);
    
    return new Response(content);
  },
};
```

### Incorrect: Global state between requests

```typescript
// BAD: Global state persists unpredictably
let requestCount = 0;
let cachedData: unknown = null;

export default {
  async fetch(request: Request): Promise<Response> {
    requestCount++; // Unreliable! Worker may restart
    
    if (!cachedData) {
      cachedData = await fetchExpensiveData(); // May be stale
    }
    
    return new Response(JSON.stringify({
      count: requestCount,
      data: cachedData,
    }));
  },
};

// GOOD: Use KV or Cache API for state
interface Env {
  STATE_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use KV for persistent state
    const count = parseInt(await env.STATE_KV.get('count') ?? '0');
    await env.STATE_KV.put('count', String(count + 1));
    
    // Use Cache API for cached data
    const cache = caches.default;
    const cacheKey = new Request('https://cache/data');
    
    let response = await cache.match(cacheKey);
    if (!response) {
      const data = await fetchExpensiveData();
      response = new Response(JSON.stringify(data));
      response.headers.set('Cache-Control', 'max-age=3600');
      await cache.put(cacheKey, response.clone());
    }
    
    return response;
  },
};
```

### Incorrect: Blocking on heavy computation

```typescript
// BAD: CPU-intensive blocking work
export default {
  async fetch(request: Request): Promise<Response> {
    const body = await request.json();
    
    // May exceed CPU limits!
    const result = heavyComputation(body.data);
    
    // Large data in memory
    const bigArray = new Array(10_000_000).fill(0).map((_, i) => i * 2);
    
    return new Response(JSON.stringify({ result, bigArray }));
  },
};

// GOOD: Offload heavy work or stream
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const body = await request.json();
    
    // Offload to Queue for async processing
    await env.HEAVY_WORK_QUEUE.send({
      data: body.data,
      callbackUrl: body.callbackUrl,
    });
    
    return new Response(JSON.stringify({ 
      status: 'processing',
      message: 'Results will be sent to callback URL',
    }));
  },
};
```

### Incorrect: Forgetting to await async operations

```typescript
// BAD: Not awaiting promises
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const body = await request.json();
    
    // Not awaited - may not complete before response
    saveToDatabase(env, body);
    
    // Not awaited - logging may be lost
    logAnalytics(body);
    
    return new Response('OK');
  },
};

// GOOD: Await critical work, use waitUntil for non-critical
export default {
  async fetch(
    request: Request, 
    env: Env, 
    ctx: ExecutionContext
  ): Promise<Response> {
    const body = await request.json();
    
    // Await critical operations
    await saveToDatabase(env, body);
    
    // Use waitUntil for non-critical background work
    ctx.waitUntil(logAnalytics(body));
    
    return new Response('OK');
  },
};
```
