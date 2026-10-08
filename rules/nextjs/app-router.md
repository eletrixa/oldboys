---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# App Router

Next.js App Router file-based routing conventions. Route groups organize layouts without affecting URL paths.

## File Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI — the only file that makes a route publicly accessible |
| `layout.tsx` | Shared UI wrapping child routes — does not re-render on navigation |
| `loading.tsx` | Instant loading state shown while `page.tsx` streams in |
| `error.tsx` | Error boundary — must be a `"use client"` component |
| `not-found.tsx` | 404 UI for the route segment |

Every `page.tsx` and `layout.tsx` must use a default export.

## Guidelines

- All pages are Server Components by default; add `"use client"` only when needed
- Use route groups `(group-name)` for layout sharing without affecting URL paths
- Every `page.tsx` must export `metadata` or `generateMetadata` for SEO
- Keep `page.tsx` thin — fetch data, pass to feature components

### DO

- Use standard file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- Use route groups for shared layouts without changing URLs
- Add `loading.tsx` for routes that fetch slow or dynamic data
- Use `error.tsx` as a client component with a retry button
- Co-locate route-specific components near the route when they are not shared

### DON'T

- Don't put business logic in `page.tsx` or `layout.tsx`
- Don't create deeply nested route segments — keep the structure flat
- Don't use the `pages/` directory — App Router only
- Don't forget that `layout.tsx` persists state across child navigations

## Implementation

### Typical Route Structure

```
app/
  layout.tsx              # Root layout: fonts, providers, navbar, footer
  page.tsx                # Homepage (/)
  not-found.tsx           # Custom 404
  (marketing)/
    about/
      page.tsx            # /about
    projects/
      page.tsx            # /projects
      [slug]/
        page.tsx          # /projects/[slug]
    contact/
      page.tsx            # /contact
  (dashboard)/
    layout.tsx            # Dashboard shell (sidebar, header)
    overview/
      page.tsx            # /overview
    settings/
      page.tsx            # /settings
  api/
    contact/
      route.ts            # POST /api/contact
```

### Thin Page Pattern

```tsx
// app/(marketing)/projects/page.tsx
import type { Metadata } from "next";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = {
  title: "Projects",
  description: "Selected projects and case studies.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/projects`,
  },
};

export default function ProjectsPage() {
  return <ProjectsView />;
}
```

### Root Layout

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Your app description.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### Dashboard Layout (route group)

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Error Boundary

```tsx
// app/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 btn btn-primary">
        Try again
      </button>
    </div>
  );
}
```

### Not Found Page

```tsx
// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h2 className="text-4xl font-bold">404</h2>
      <p className="mt-2 text-muted-foreground">Page not found.</p>
      <Link href="/" className="mt-4 underline">
        Back to home
      </Link>
    </div>
  );
}
```

### Loading State

```tsx
// app/(dashboard)/overview/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <Skeleton className="h-64 w-full" />;
}
```

## Examples

### Correct

```tsx
// Route group — URL is /projects, not /(marketing)/projects
// app/(marketing)/projects/page.tsx --> /projects
export default function ProjectsPage() {
  return <ProjectsView />;
}
```

### Incorrect

```tsx
// BAD: using pages/ directory
// pages/projects.tsx

// BAD: putting fetch logic in layout.tsx
// BAD: creating /app/dashboard/overview/ without a route group
//      (URL becomes /dashboard/overview instead of /overview)

// BAD: business logic in page.tsx
export default async function ProjectsPage() {
  const data = await fetch("...");
  const parsed = await data.json();
  // ... 50 lines of logic
}
```
