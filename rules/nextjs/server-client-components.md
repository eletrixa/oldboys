---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# Server vs Client Components

Server components are the default in Next.js App Router. Push `"use client"` as far down the component tree as possible to maximize server rendering and minimize client JavaScript.

## When to Use Each

### Server Components Can

- Fetch data directly (databases, external APIs, caches)
- Access environment variables and secrets
- Import server-only modules
- Render with zero client-side JavaScript
- Be `async` functions that `await` data

### Client Components Must Be Used For

- `useState`, `useEffect`, `useRef`, and other React hooks
- Event handlers: `onClick`, `onChange`, `onSubmit`
- Browser APIs: `window`, `document`, `localStorage`
- Third-party libraries that use hooks or browser APIs
- Real-time subscriptions (Convex, WebSocket, SSE listeners)

## The Boundary Pattern

```
Server Component (page.tsx)         -- fetches data, reads from DB/cache
  --> passes serializable data as props
    --> Client Component ("use client")  -- handles interactivity
```

## Guidelines

### DO

- Keep `page.tsx` as a server component — fetch data there and pass it down
- Mark only the leaf components that need interactivity as `"use client"`
- Use the `children` pattern to keep server-rendered content inside client layouts
- Pass only plain serializable data (objects, arrays, primitives) from server to client

### DON'T

- Don't add `"use client"` to `page.tsx` or `layout.tsx`
- Don't import server-only code (DB bindings, env secrets) in `"use client"` files
- Don't make a parent `"use client"` when only a child needs it — the directive cascades down
- Don't pass functions as props from server to client components (functions are not serializable)

## Implementation

### Server Component Fetching Data

```tsx
// app/(dashboard)/overview/page.tsx — SERVER component (no directive)
import { getMetrics } from "@/lib/metrics";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";

export default async function OverviewPage() {
  const metrics = await getMetrics();

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <MetricsDashboard data={metrics} />
    </div>
  );
}
```

### Client Leaf Component

```tsx
// components/metrics/metrics-dashboard.tsx — CLIENT (needs useState)
"use client";

import { useState } from "react";
import type { MetricsData } from "@/types/metrics";

interface MetricsDashboardProps {
  data: MetricsData; // Plain serializable data from server
}

export function MetricsDashboard({ data }: MetricsDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab("overview")}>Overview</button>
        <button onClick={() => setActiveTab("details")}>Details</button>
      </nav>
      {activeTab === "overview" && <Overview data={data} />}
      {activeTab === "details" && <Details data={data} />}
    </div>
  );
}
```

### Children Pattern (Server Content Inside Client Shell)

```tsx
// components/layout/collapsible-panel.tsx — CLIENT (needs state)
"use client";

import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode; // Server-rendered content passed in
}

export function CollapsiblePanel({ title, children }: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between p-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-semibold">{title}</span>
        <span>{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}
```

```tsx
// Usage in a server component — children stay server-rendered
import { CollapsiblePanel } from "@/components/layout/collapsible-panel";
import { DataTable } from "@/components/data-table";

export default async function ReportPage() {
  const rows = await getReportData();

  return (
    <CollapsiblePanel title="Report">
      <DataTable rows={rows} /> {/* This is server-rendered */}
    </CollapsiblePanel>
  );
}
```

### Convex / Real-time Subscriptions (Client Only)

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function TaskBoard() {
  const tasks = useQuery(api.tasks.list);
  const updateTask = useMutation(api.tasks.update);

  if (tasks === undefined) return <Skeleton className="h-64" />;

  return (
    <Board
      tasks={tasks}
      onStatusChange={(id, status) => updateTask({ id, status })}
    />
  );
}
```

## Examples

### Correct

```tsx
// Server page passes serializable data to client component
// page.tsx (server) --> <InteractiveWidget data={plainObject} />
```

### Incorrect

```tsx
// BAD: "use client" on a page
"use client";
export default function OverviewPage() { /* ... */ }

// BAD: passing a function from server to client
export default function Page() {
  const handleClick = () => console.log("click");
  return <ClientButton onClick={handleClick} />; // Functions are not serializable
}

// BAD: importing server-only module in a client component
"use client";
import { getDbBinding } from "@/lib/db"; // Server-only module

// BAD: making a parent "use client" when only a child needs it
"use client"; // Cascades — all children lose server rendering
export default function Layout({ children }) {
  return <div>{children}</div>;
}
```
