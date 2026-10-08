---
category: nextjs
scope: [nextjs]
priority: recommended
applies-to: [react, typescript, nextjs]
---

# API Routes

Route handler conventions for Next.js App Router. All handlers live under `app/api/` and follow a consistent pattern: Zod validation, proper HTTP status codes, and JSON responses.

## Guidelines

- Use `NextRequest` / `NextResponse` from `next/server`
- Validate all incoming data with Zod before processing
- Return structured JSON with a consistent shape: `{ success, data?, error? }` or `{ error: string }`
- Handle errors gracefully — never expose internal error details to the client
- Keep route handlers thin — delegate business logic to service functions in `lib/`

### DO

- Validate request body and query parameters with Zod schemas
- Return appropriate HTTP status codes (200, 400, 404, 422, 429, 500, 502)
- Log errors server-side for debugging
- Add `Cache-Control` headers for GET endpoints that can be edge-cached
- Return 502 Bad Gateway when an upstream/external API fails

### DON'T

- Note: `export const runtime = 'edge'` may cause silent 500s on Cloudflare Workers via OpenNext. For Vercel Edge or AWS Lambda@Edge, edge runtime is appropriate. Test thoroughly on your target platform.
- Don't expose API keys, tokens, or internal error messages in responses
- Don't return plain text errors — always return `{ error: "message" }` JSON
- Don't skip validation even if the client also validates
- Don't put business logic directly in route handlers

## Implementation

### Standard GET Route Handler

```ts
// app/api/character/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchCharacterProfile } from "@/lib/external-api";

const querySchema = z.object({
  name: z.string().min(2).max(50),
  region: z.string().min(2).default("us"),
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, region } = parsed.data;

  try {
    const profile = await fetchCharacterProfile(name, region);

    return NextResponse.json(profile, {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Profile fetch failed:", error);

    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 502 }
    );
  }
}
```

### POST Route with Body Validation

```ts
// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid form data.",
          fieldErrors: result.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const { name, email, message } = result.data;

    await sendEmail({ name, email, message });

    return NextResponse.json({
      success: true,
      data: { message: "Message sent successfully." },
    });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
```

### Health Check

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Verify critical dependencies are reachable
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 500 }
    );
  }
}
```

### JSON Response Shape

```ts
// Success response
{
  "success": true,
  "data": { "message": "Operation completed." }
}

// Validation error (422)
{
  "success": false,
  "error": "Invalid form data.",
  "fieldErrors": {
    "email": ["Enter a valid email address."],
    "message": ["Message must be at least 10 characters."]
  }
}

// Server error (500)
{
  "success": false,
  "error": "An unexpected error occurred."
}
```

### HTTP Status Code Reference

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request — invalid query parameters or malformed body |
| 404 | Not Found — resource does not exist |
| 422 | Unprocessable Entity — validation failed |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — unexpected server failure |
| 502 | Bad Gateway — upstream/external API failed |

## Examples

### Correct

```ts
// Thin handler with Zod validation and proper status codes
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "..." }, { status: 400 });

  try {
    const data = await serviceFunction(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Handler error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 502 });
  }
}
```

### Incorrect

```ts
// CAUTION: runtime = "edge" — causes silent 500s on Cloudflare Workers via OpenNext.
// Appropriate for Vercel Edge or AWS Lambda@Edge. Test on your target platform.
export const runtime = "edge";

// BAD: plain text error response
return new Response("Something went wrong", { status: 500 });

// BAD: leaking internal error details
return NextResponse.json({ error: err.message, token: accessToken });

// BAD: no validation
export async function POST(request: NextRequest) {
  const { name, email } = await request.json();
  // Using data directly without validating shape or types
}

// BAD: business logic in route handler
export async function GET() {
  const raw = await db.query("SELECT * FROM users");
  const filtered = raw.filter(u => u.active);
  const transformed = filtered.map(u => ({ ...u, displayName: u.name.toUpperCase() }));
  // Extract to a service function instead
}
```
