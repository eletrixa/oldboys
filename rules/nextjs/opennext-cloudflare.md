---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# OpenNext / Cloudflare Workers

Known issues and required configuration for deploying Next.js to Cloudflare Workers via OpenNext.

## Critical Rules

1. **Never use `export const runtime = "edge"`** in any route or page. OpenNext handles the runtime; this directive causes silent 500 errors on Cloudflare Workers with no useful logs.

2. **Set `images.unoptimized = true`** in `next.config.ts`. Cloudflare Workers does not support the Next.js Image Optimization API.

3. **Use `initOpenNextCloudflareForDev()`** in `next.config.ts` to bind KV namespaces during local development.

4. **Deploy via CI (GitHub Actions), not from Windows CLI.** The `opennextjs-cloudflare` build step has path-separator issues on Windows that cause broken deployments.

5. **Use `middleware.ts`** for any middleware needs. OpenNext does not support `proxy.ts`.

6. **Do not use `output: "standalone"`** — OpenNext manages the build output format.

## Guidelines

### DO

- Set `images.unoptimized: true` in `next.config.ts`
- Use `<Image>` component for layout stability but accept unoptimized output
- Pre-optimize images to `.webp` at build time since runtime optimization is unavailable
- Use `initOpenNextCloudflareForDev()` to get KV bindings in dev mode
- Set all environment variables in both `.dev.vars` (local) and Cloudflare dashboard (production)
- Deploy via GitHub Actions (Linux runner) for reliable builds

### DON'T

- Don't export `runtime = "edge"` from any file
- Don't use `next/image` custom loaders expecting Cloudflare image transforms
- Don't use Node.js-specific APIs unavailable in Workers: `fs`, `child_process`, `path`, etc.
- Don't use `output: "standalone"` in `next.config.ts`
- Don't use `proxy.ts` — it is not supported by OpenNext

## Implementation

### next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // Required for Cloudflare Workers
  },
  // Do not add output: "standalone" — OpenNext manages this
};

// Bind KV namespaces for local dev
if (process.env.NODE_ENV === "development") {
  const { initOpenNextCloudflareForDev } = await import(
    "@opennextjs/cloudflare"
  );
  await initOpenNextCloudflareForDev();
}

export default nextConfig;
```

### open-next.config.ts

```ts
import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
    },
  },
};

export default config;
```

### package.json Scripts

```jsonc
{
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "cf:build": "opennextjs-cloudflare build",
    "cf:deploy": "opennextjs-cloudflare build && wrangler deploy",
    "cf:preview": "opennextjs-cloudflare build && wrangler dev"
  }
}
```

### wrangler.jsonc

```jsonc
{
  "name": "my-app",
  "compatibility_date": "2025-01-01",
  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "<production-kv-id>",
      "preview_id": "<preview-kv-id>"
    }
  ]
}
```

### Accessing KV in Server Code

```ts
// lib/kv.ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getKvNamespace() {
  const { env } = getCloudflareContext();
  return env.CACHE_KV;
}
```

### GitHub Actions Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx opennextjs-cloudflare build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Image Usage

```tsx
// Use next/image for layout stability — images are served unoptimized
// Pre-optimize to .webp before adding to public/
import Image from "next/image";

<Image
  src="/images/hero.webp"
  alt="Hero image"
  width={800}
  height={450}
  className="rounded-lg"
/>
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Silent 500 on deployed route | `export const runtime = "edge"` | Remove the export |
| Images return 500 | `images.unoptimized` not set | Add `images: { unoptimized: true }` |
| KV returns null in dev | Missing `initOpenNextCloudflareForDev()` | Add it to `next.config.ts` |
| Build fails on Windows | Path separator issues in OpenNext | Deploy via GitHub Actions |
| `proxy.ts` not working | Not supported by OpenNext | Use `middleware.ts` instead |
| `.next` cache corruption | Windows file locking | Delete `.next` folder and restart |

## Examples

### Correct

```ts
// No runtime directive — OpenNext handles it automatically
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};
```

### Incorrect

```ts
// BAD: causes silent 500 on Cloudflare Workers
export const runtime = "edge";
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
```

```ts
// BAD: standalone output breaks OpenNext
const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
};
```

```ts
// BAD: custom image loader expecting Cloudflare transforms
const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/cf-image-loader.ts",
  },
};
```
