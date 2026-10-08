---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# Layouts and Metadata

Root layout configuration, provider nesting, and metadata patterns for Next.js App Router.

## Guidelines

- The root layout sets global providers, fonts, `<html>` attributes, and global styles
- Nested layouts add section-specific shells (sidebar, header) without duplicating providers
- Use `next/font` for self-hosted fonts — never load fonts from external CDNs at runtime
- Every `page.tsx` must export `metadata` or `generateMetadata`
- Canonical URLs should always be set via `alternates.canonical`
- Store the site URL in a config constant — never hardcode it

### DO

- Set `lang` attribute on the `<html>` element
- Include Open Graph and Twitter meta tags in root metadata
- Use `next/font` for self-hosted fonts (no external font requests at runtime)
- Set `metadataBase` in the root layout's metadata export
- Add canonical URLs to every page via `alternates.canonical`
- Use a `metadata.title.template` in the root layout for consistent tab titles

### DON'T

- Don't load fonts from Google Fonts CDN directly — use `next/font/google` (it self-hosts)
- Don't put page-specific logic in the root layout
- Don't duplicate providers across nested layouts
- Don't hardcode the domain string — use a constant from `lib/config.ts`

## Implementation

### Site Config

```ts
// lib/config.ts
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
export const SITE_NAME = "My App";
```

### Root Layout with Metadata

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  description: "App description for SEO.",
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
        {children}
      </body>
    </html>
  );
}
```

### Root Layout with Providers

```tsx
// app/layout.tsx (with auth and data providers)
import { SessionProvider } from "next-auth/react";
import { ConvexProviderWithAuth } from "convex/react";
import { convex, useAuthFromNextAuth } from "@/lib/convex";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <ConvexProviderWithAuth client={convex} useAuth={useAuthFromNextAuth}>
            {children}
          </ConvexProviderWithAuth>
        </SessionProvider>
      </body>
    </html>
  );
}
```

### Nested Layout (Dashboard)

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// Do NOT duplicate SessionProvider or ConvexProvider here — they are in root layout

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

### Layout Nesting Diagram

```
app/layout.tsx              ← SessionProvider + global providers
  └── (dashboard)/layout.tsx  ← Sidebar + Header shell
        └── overview/page.tsx  ← Page content
```

### Per-Page Metadata

```tsx
// app/about/page.tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "About",         // Becomes "About | My App" via root template
  description: "About the team and the mission.",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return <AboutView />;
}
```

### Dynamic Metadata

```tsx
// app/projects/[slug]/page.tsx
import type { Metadata } from "next";
import { getProjectBySlug } from "@/lib/data/projects";

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
    openGraph: {
      title: project.title,
      description: project.description,
      images: [{ url: project.image }],
    },
  };
}
```

### Breadcrumbs Component

```tsx
// components/layout/breadcrumbs.tsx
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

## Examples

### Correct

```tsx
// Canonical URL using config constant
alternates: { canonical: `${SITE_URL}/projects` }

// Font via next/font (self-hosted)
const inter = Inter({ subsets: ["latin"] });

// Title template in root — pages only need to set their own title
export const metadata: Metadata = {
  title: { default: "My App", template: `%s | My App` },
};
```

### Incorrect

```tsx
// BAD: hardcoded domain
alternates: { canonical: "https://example.com/projects" }

// BAD: loading font from CDN directly (use next/font instead)
// <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />

// BAD: duplicating providers in a nested layout
// app/(dashboard)/layout.tsx
import { SessionProvider } from "next-auth/react"; // Already in root layout!
export default function DashboardLayout({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```
