---
category: cloudflare
scope: [cloudflare]
priority: recommended
applies-to: [cloudflare-workers, typescript]
---

# Cloudflare Worker Bindings

Use KV, R2, Queues, Durable Objects, and other bindings correctly.

---

## Description

Cloudflare Workers connect to storage and services via typed bindings. This rule covers how to configure and use KV namespaces, R2 buckets, Queues, D1 databases, and other Cloudflare services with proper typing and error handling.

---

## Specific Guidelines

### DO:
- Define typed `Env` interface for all bindings
- Configure bindings in `wrangler.toml`
- Use appropriate storage for use case (KV vs R2 vs D1)
- Handle binding operation errors
- Use metadata for KV and R2 objects
- Batch operations when possible

### DON'T:
- Use untyped binding access
- Assume binding operations always succeed
- Store large values in KV (use R2)
- Forget expiration for temporary data
- Ignore rate limits on bindings

---

## Implementation Details

### Binding Type Definitions:
```typescript
interface Env {
  // KV Namespaces
  SESSION_KV: KVNamespace;
  CONFIG_KV: KVNamespace;
  
  // R2 Buckets
  ASSETS_BUCKET: R2Bucket;
  UPLOADS_BUCKET: R2Bucket;
  
  // Queues
  EMAIL_QUEUE: Queue;
  ANALYTICS_QUEUE: Queue;
  
  // D1 Database
  DB: D1Database;
  
  // Durable Objects
  COUNTER: DurableObjectNamespace;
  
  // Environment Variables
  API_KEY: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
}
```

### wrangler.toml Configuration:
```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "abc123"

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "my-assets"

[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-notifications"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "xyz789"

[vars]
ENVIRONMENT = "production"
```

---

## Benefits

1. **Type safety**: Catch binding errors at compile time
2. **Clear dependencies**: All bindings visible in Env interface
3. **Appropriate storage**: Right tool for each use case
4. **Error handling**: Graceful degradation on failures
5. **Performance**: Optimized for edge runtime

---

## Examples

### Correct: KV namespace operations

```typescript
interface Env {
  SESSION_KV: KVNamespace;
}

interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

async function getSession(
  kv: KVNamespace, 
  sessionId: string
): Promise<Session | null> {
  try {
    const data = await kv.get(sessionId, { type: 'json' });
    
    if (!data) {
      return null;
    }
    
    const session = data as Session;
    
    // Check expiration
    if (session.expiresAt < Date.now()) {
      // Delete expired session in background
      await kv.delete(sessionId);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('KV get failed:', error);
    return null;
  }
}

async function createSession(
  kv: KVNamespace,
  userId: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  
  const session: Session = {
    userId,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
  };
  
  await kv.put(sessionId, JSON.stringify(session), {
    // Auto-expire after 24 hours
    expirationTtl: 24 * 60 * 60,
    // Metadata for quick lookups
    metadata: { userId, createdAt: now },
  });
  
  return sessionId;
}

async function listUserSessions(
  kv: KVNamespace,
  userId: string
): Promise<string[]> {
  // List with prefix if using prefixed keys
  const { keys } = await kv.list({ prefix: `session:${userId}:` });
  
  return keys.map(key => key.name);
}
```

### Correct: R2 bucket operations

```typescript
interface Env {
  UPLOADS_BUCKET: R2Bucket;
}

async function uploadFile(
  bucket: R2Bucket,
  key: string,
  file: File,
  metadata: Record<string, string>
): Promise<R2Object> {
  const object = await bucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
    },
    customMetadata: metadata,
  });
  
  return object;
}

async function getFile(
  bucket: R2Bucket,
  key: string
): Promise<Response> {
  const object = await bucket.get(key);
  
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  
  // Conditional request support
  return new Response(object.body, { headers });
}

async function deleteFile(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

async function listFiles(
  bucket: R2Bucket,
  prefix: string
): Promise<R2Object[]> {
  const listed = await bucket.list({ prefix, limit: 100 });
  
  const objects: R2Object[] = [];
  
  for (const object of listed.objects) {
    objects.push(object);
  }
  
  // Handle pagination
  let cursor = listed.cursor;
  while (listed.truncated && cursor) {
    const next = await bucket.list({ prefix, cursor });
    objects.push(...next.objects);
    cursor = next.cursor;
  }
  
  return objects;
}
```

### Correct: Queue producer and consumer

```typescript
// Producer (API Worker)
interface Env {
  EMAIL_QUEUE: Queue;
}

interface EmailJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

async function queueEmail(
  queue: Queue,
  email: EmailJob
): Promise<void> {
  await queue.send(email, {
    // Delay sending by 5 seconds
    delaySeconds: 5,
  });
}

// Consumer (Queue Worker)
export default {
  async queue(
    batch: MessageBatch<EmailJob>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await sendEmail(message.body, env);
        message.ack(); // Acknowledge success
      } catch (error) {
        console.error('Email failed:', error);
        
        if (message.attempts < 3) {
          message.retry(); // Retry later
        } else {
          // Move to dead letter queue or log permanently
          console.error('Email permanently failed:', message.body);
          message.ack(); // Don't retry anymore
        }
      }
    }
  },
};
```

### Correct: D1 database operations

```typescript
interface Env {
  DB: D1Database;
}

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

async function getUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
  
  return result;
}

async function createUser(
  db: D1Database,
  user: Omit<User, 'id' | 'created_at'>
): Promise<User> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  
  await db
    .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, user.email, user.name, createdAt)
    .run();
  
  return { ...user, id, created_at: createdAt };
}

async function batchInsert(
  db: D1Database,
  items: Array<{ name: string; value: number }>
): Promise<void> {
  // Use batch for multiple operations
  const statements = items.map(item =>
    db
      .prepare('INSERT INTO items (name, value) VALUES (?, ?)')
      .bind(item.name, item.value)
  );
  
  await db.batch(statements);
}
```

### Incorrect: Untyped binding access

```typescript
// BAD: No type safety
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // No autocomplete, no error checking
    const data = await env.SOME_KV.get('key');
    const object = await env.BUCKET.get('file');
    
    // Typo won't be caught!
    const config = await env.CONFG_KV.get('settings'); // Runtime error
    
    return new Response(data);
  },
};

// GOOD: Typed bindings
interface Env {
  SOME_KV: KVNamespace;
  BUCKET: R2Bucket;
  CONFIG_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Autocomplete, type checking
    const data = await env.SOME_KV.get('key');
    const object = await env.BUCKET.get('file');
    
    // Typo caught at compile time!
    const config = await env.CONFIG_KV.get('settings');
    
    return new Response(data);
  },
};
```

### Incorrect: Ignoring binding errors

```typescript
// BAD: No error handling
async function getConfig(kv: KVNamespace): Promise<Config> {
  const data = await kv.get('config', { type: 'json' });
  return data as Config; // Could be null! Could throw!
}

// GOOD: Handle all cases
async function getConfig(kv: KVNamespace): Promise<Config | null> {
  try {
    const data = await kv.get('config', { type: 'json' });
    
    if (!data) {
      console.warn('Config not found in KV');
      return null;
    }
    
    return data as Config;
  } catch (error) {
    console.error('KV operation failed:', error);
    return null;
  }
}
```

### Incorrect: Large values in KV

```typescript
// BAD: KV has 25MB limit, better for small values
async function storeVideo(kv: KVNamespace, video: ArrayBuffer): Promise<void> {
  // Will fail for large files, slow for medium files
  await kv.put('video', video);
}

// GOOD: Use R2 for large objects
async function storeVideo(bucket: R2Bucket, video: ArrayBuffer): Promise<void> {
  // R2 designed for large objects
  await bucket.put('video.mp4', video, {
    httpMetadata: { contentType: 'video/mp4' },
  });
}

// Use KV for small metadata
async function storeVideoMetadata(
  kv: KVNamespace,
  metadata: { title: string; duration: number; r2Key: string }
): Promise<void> {
  await kv.put('video-meta', JSON.stringify(metadata));
}
```

### Incorrect: Forgetting TTL for temporary data

```typescript
// BAD: Temporary data stored forever
async function cacheResponse(kv: KVNamespace, key: string, data: unknown): Promise<void> {
  // Never expires - wastes storage, may serve stale data
  await kv.put(key, JSON.stringify(data));
}

// GOOD: Set appropriate TTL
async function cacheResponse(
  kv: KVNamespace, 
  key: string, 
  data: unknown,
  ttlSeconds = 3600
): Promise<void> {
  // Auto-expires after TTL
  await kv.put(key, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
}
```
