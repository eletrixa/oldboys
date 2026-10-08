---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# Data Fetching

Patterns for fetching data in Next.js App Router: server components, caching, static generation, and server actions.

## Guidelines

- Prefer server components for data fetching — no client-side waterfalls
- Cache external API responses with appropriate TTL (KV, Redis, or Next.js fetch cache)
- Use `generateStaticParams` for dynamic routes with known slugs
- Use server actions for form submissions
- Never use client-side data fetching libraries (SWR, React Query) for data that can be fetched on the server

### DO

- Fetch data in server components and pass it as props
- Cache external API calls to avoid hammering third-party services
- Use `generateStaticParams` for static generation of dynamic routes
- Use server actions for mutations (form submissions, data writes)
- Keep content in strongly typed TypeScript files or fetch from a type-safe API

### DON'T

- Don't fetch data in client components with `useEffect` + `fetch`
- Don't call third-party APIs directly from client components
- Don't skip caching for frequently-fetched external data
- Don't store typed content in JSON files — use `.ts` files for type safety

## Implementation

### Server Component Direct Fetch

```tsx
// app/(dashboard)/overview/page.tsx
import { getMetrics } from "@/lib/metrics";
import { MetricsView } from "@/components/metrics-view";

export default async function OverviewPage() {
  const metrics = await getMetrics();
  return <MetricsView data={metrics} />;
}
```

### Cached External API Fetch

```ts
// lib/kv-cache.ts
interface CacheOptions {
  ttlSeconds: number;
}

export async function kvCacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const kv = getKvNamespace(); // e.g. Cloudflare KV or Redis

  const cached = await kv.get(key, "json");
  if (cached !== null) return cached as T;

  const fresh = await fetcher();
  await kv.put(key, JSON.stringify(fresh), {
    expirationTtl: options.ttlSeconds,
  });

  return fresh;
}
```

```tsx
// app/(dashboard)/scorecard/page.tsx
import { kvCacheGet } from "@/lib/kv-cache";
import { fetchExternalScore } from "@/lib/external-api";

export default async function ScorecardPage() {
  const score = await kvCacheGet(
    "score:user:current",
    () => fetchExternalScore(),
    { ttlSeconds: 900 } // 15 minutes
  );

  return <ScorecardDisplay score={score} />;
}
```

### Static Content Pattern (no database)

```ts
// lib/data/projects.ts
import type { Project } from "@/lib/types";

export const projects: Project[] = [
  {
    slug: "project-alpha",
    title: "Project Alpha",
    description: "A redesign of the document management web app.",
    tags: ["Next.js", "TypeScript", "Tailwind"],
    image: "/images/projects/alpha.webp",
    year: 2025,
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getAllProjectSlugs(): string[] {
  return projects.map((p) => p.slug);
}
```

```ts
// lib/types.ts
export interface Project {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  image: string;
  year: number;
  url?: string;
}
```

### Static Params for Dynamic Routes

```tsx
// app/(marketing)/projects/[slug]/page.tsx
import { getAllProjectSlugs, getProjectBySlug } from "@/lib/data/projects";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllProjectSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const project = getProjectBySlug(params.slug);
  if (!project) return {};

  return {
    title: project.title,
    description: project.description,
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = getProjectBySlug(params.slug);
  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
```

### Server Action for Form Submission

```tsx
// lib/actions/contact.ts
"use server";

import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  message: z.string().min(10).max(5000),
});

export async function submitContactForm(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  const result = contactSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors };
  }

  const { name, email, message } = result.data;

  // Send email / write to DB / etc.
  await sendEmail({ name, email, message });

  return { success: true };
}
```

### Cache TTL Strategy

| Data type | Recommended TTL | Reason |
|-----------|-----------------|--------|
| Auth tokens (OAuth) | ~23 hours | Rotate before expiry |
| User profile / gear | 1 hour | Changes infrequently |
| Real-time scores | 15 minutes | Updates frequently |
| Roster / membership | 2 hours | Changes rarely |
| Third-party spreadsheets | 30 minutes | Manual edits are infrequent |
| Static site content | Build time | Does not change at runtime |

## Examples

### Correct

```tsx
// Server component with cached external data
const data = await kvCacheGet("key", fetcher, { ttlSeconds: 3600 });

// API route sets edge cache headers
return NextResponse.json(data, {
  headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=60" },
});

// Static content in typed TS files
import { projects } from "@/lib/data/projects";
export default function ProjectsView() {
  return projects.map((p) => <ProjectCard key={p.slug} project={p} />);
}
```

### Incorrect

```tsx
// BAD: fetching in a client component
"use client";
useEffect(() => {
  fetch("/api/data").then(r => r.json()).then(setData);
}, []);

// BAD: calling third-party API directly from client
"use client";
fetch("https://api.third-party.com/...");
// Always go through server components or internal API routes

// BAD: no caching — hammering external APIs on every request
const data = await fetch("https://external-api.com/...");
// Wrap in kvCacheGet() or use Next.js fetch cache options

// BAD: JSON file for typed content
import data from "@/data/projects.json"; // No type safety
```
