---
category: cloudflare
scope: [cloudflare]
priority: recommended
applies-to: [cloudflare-workers, typescript]
---

# Cloudflare Worker Configuration

Configure Workers with proper wrangler.toml settings, environments, and secrets.

---

## Description

Cloudflare Workers are configured via `wrangler.toml` for bindings, environments, routes, and build settings. This rule covers how to structure configuration for different environments, manage secrets, and set up routing.

---

## Specific Guidelines

### DO:
- Use environment-specific configuration (`[env.production]`, `[env.staging]`)
- Store secrets via `wrangler secret` command (not in toml)
- Use `vars` for non-sensitive environment variables
- Configure appropriate compatibility dates
- Set up proper routes/custom domains
- Enable development mode only locally

### DON'T:
- Commit secrets to wrangler.toml
- Use same binding IDs for different environments
- Forget to set compatibility_date
- Mix production and development bindings
- Hardcode environment-specific URLs

---

## Implementation Details

### Project Structure:
```
cloudflare/workers/api-gateway/
├── src/
│   └── index.ts
├── wrangler.toml
├── package.json
└── tsconfig.json
```

### Basic wrangler.toml:
```toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

# Default/development environment
[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "dev-cache-kv-id"
preview_id = "dev-cache-kv-preview-id"

# Staging environment
[env.staging]
name = "my-api-staging"
routes = [{ pattern = "api-staging.example.com/*", zone_name = "example.com" }]

[env.staging.vars]
ENVIRONMENT = "staging"
LOG_LEVEL = "info"
SUPABASE_URL = "https://your-project.supabase.co"

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "staging-cache-kv-id"

# Production environment
[env.production]
name = "my-api"
routes = [{ pattern = "api.example.com/*", zone_name = "example.com" }]

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
SUPABASE_URL = "https://api.example.com"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "production-cache-kv-id"
```

### Secrets Management:
```bash
# Add secrets for each environment
wrangler secret put API_KEY --env production
wrangler secret put API_KEY --env staging

# List secrets
wrangler secret list --env production

# Delete secret
wrangler secret delete OLD_KEY --env production
```

---

## Benefits

1. **Environment isolation**: Different configs for dev/staging/prod
2. **Secret protection**: Sensitive data not in source control
3. **Easy deployment**: Deploy to any env with single command
4. **Type safety**: Bindings match Env interface
5. **Maintainability**: All config in one place

---

## Examples

### Correct: Complete multi-environment configuration

```toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Build configuration
[build]
command = "npm run build"
watch_dir = "src"

# Triggers (cron schedules)
[triggers]
crons = ["0 * * * *", "0 0 * * *"]

# Observability
[observability]
enabled = true

# ─────────────────────────────────────────────────────────
# Development (default when running `wrangler dev`)
# ─────────────────────────────────────────────────────────
[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
SITE_URL = "http://localhost:8080"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "dev-session-kv"
preview_id = "dev-session-kv"

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "my-assets-dev"

[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-queue-dev"

# ─────────────────────────────────────────────────────────
# Staging Environment
# ─────────────────────────────────────────────────────────
[env.staging]
name = "my-api-staging"
routes = [
  { pattern = "api-staging.example.com/*", zone_name = "example.com" }
]

[env.staging.vars]
ENVIRONMENT = "staging"
LOG_LEVEL = "info"
SITE_URL = "https://staging.example.com"
SUPABASE_URL = "https://your-project.supabase.co"

[[env.staging.kv_namespaces]]
binding = "SESSION_KV"
id = "staging-session-kv-abc123"

[[env.staging.r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "my-assets-staging"

[[env.staging.queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-queue-staging"

# ─────────────────────────────────────────────────────────
# Production Environment
# ─────────────────────────────────────────────────────────
[env.production]
name = "my-api"
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "error"
SITE_URL = "https://example.com"
SUPABASE_URL = "https://api.example.com"

[[env.production.kv_namespaces]]
binding = "SESSION_KV"
id = "production-session-kv-xyz789"

[[env.production.r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "my-assets"

[[env.production.queues.producers]]
binding = "EMAIL_QUEUE"
queue = "email-queue"

# Production-only: Durable Objects
[[env.production.durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"
```

### Correct: Typed Env matching wrangler.toml

```typescript
// src/types.ts
export interface Env {
  // Environment variables (from [vars])
  ENVIRONMENT: 'development' | 'staging' | 'production';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  SITE_URL: string;
  SUPABASE_URL: string;
  
  // Secrets (from wrangler secret)
  SUPABASE_ANON_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // KV Namespaces
  SESSION_KV: KVNamespace;
  
  // R2 Buckets
  ASSETS_BUCKET: R2Bucket;
  
  // Queues
  EMAIL_QUEUE: Queue;
  
  // Durable Objects (production only)
  RATE_LIMITER?: DurableObjectNamespace;
}

// src/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`[${env.ENVIRONMENT}] Request received`);
    
    // Environment-aware logging
    if (env.LOG_LEVEL === 'debug') {
      console.log('Debug:', request.url);
    }
    
    return new Response('OK');
  },
};
```

### Correct: Secrets management workflow

```bash
# Initial setup - run once per environment
# These prompts for values interactively (not logged)

# Production secrets
wrangler secret put SUPABASE_ANON_KEY --env production
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put STRIPE_WEBHOOK_SECRET --env production

# Staging secrets
wrangler secret put SUPABASE_ANON_KEY --env staging
wrangler secret put STRIPE_SECRET_KEY --env staging
wrangler secret put STRIPE_WEBHOOK_SECRET --env staging

# Verify secrets are set
wrangler secret list --env production
# Output:
# - SUPABASE_ANON_KEY
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET

# Rotate a secret
wrangler secret put STRIPE_SECRET_KEY --env production
# Enter new value when prompted

# Delete old secret
wrangler secret delete OLD_SECRET_NAME --env production
```

### Correct: Deployment commands

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# Local development
wrangler dev

# Local dev with specific environment vars
wrangler dev --env staging

# Tail logs
wrangler tail --env production
wrangler tail --env staging --format json
```

### Incorrect: Secrets in wrangler.toml

```toml
# BAD: Secrets committed to source control!
[vars]
STRIPE_SECRET_KEY = "sk_live_xxxxx"  # NEVER DO THIS!
DATABASE_PASSWORD = "super_secret"    # NEVER DO THIS!
API_KEY = "key_12345"                 # NEVER DO THIS!

# GOOD: Only non-sensitive vars in toml
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
PUBLIC_API_URL = "https://api.example.com"

# Secrets added via CLI:
# wrangler secret put STRIPE_SECRET_KEY --env production
```

### Incorrect: Same binding IDs across environments

```toml
# BAD: Using same KV ID for all environments
[[kv_namespaces]]
binding = "CACHE_KV"
id = "abc123"  # Same ID everywhere!

[env.staging.kv_namespaces]
binding = "CACHE_KV"
id = "abc123"  # Staging uses production KV!

[env.production.kv_namespaces]
binding = "CACHE_KV"
id = "abc123"  # Same as staging!

# GOOD: Different IDs per environment
[[kv_namespaces]]
binding = "CACHE_KV"
id = "dev-cache-kv-111"

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "staging-cache-kv-222"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "production-cache-kv-333"
```

### Incorrect: Hardcoded environment URLs

```typescript
// BAD: Hardcoded URLs
async function callApi(): Promise<Response> {
  return fetch('https://api.example.com/endpoint'); // Always production!
}

// GOOD: Use environment variables
async function callApi(env: Env): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/endpoint`);
}
```

### Incorrect: Missing compatibility date

```toml
# BAD: No compatibility date
name = "my-worker"
main = "src/index.ts"
# Missing compatibility_date!

# Worker behavior may change unexpectedly with new CF releases

# GOOD: Pin compatibility date
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"  # Behavior locked to this date

# Update periodically after testing
```
