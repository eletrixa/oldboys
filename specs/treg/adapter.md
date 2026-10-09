# Unit: treg adapter (`TregCall` port, `makeTregCall`)

Plan: `plans/016-treg-enrichment/00-SYNTHESIS.md` (Port, Adapter rows).

## Purpose
- One metered HTTP call to treg.to by endpoint id, behind a plain function port; the runner owns budget and notes, the adapter owns the wire format.
- Files: `src/domain/ports.ts` (`TregCall`, `Ports.callTreg: TregCall | null`), `src/adapters/treg.ts` (`makeTregCall`; URL building is internal), `src/adapters/__tests__/treg.test.ts`.

## Inputs
- `makeTregCall(token: string): TregCall`.
- `TregCall = (req: { endpoint: string; method: "GET" | "POST"; params: Record<string, string | number | boolean | string[]>; maxCostUsd: number }) => Promise<{ payload: unknown; cost_usd: number }>`.
- URL building is internal to `makeTregCall` (observable through the fetch URL).
- Base `https://treg.to/call` (module constant); timeout `TIMEOUT_MS` (20 000 ms, `src/adapters/fetch.ts`); user agent `UA` (`oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)`).

## Outputs
- URL:
  - GET: `https://treg.to/call/<endpoint>?<query>`; each param `k=String(v)`, arrays joined with `,` (encoded `%2C`), `URLSearchParams` encoding (space = `+`); empty params = no `?`.
  - POST: bare `https://treg.to/call/<endpoint>`, never a query string; params go as the JSON body `JSON.stringify(params)`.
- Headers (all calls): `X-Treg-Token: <token>`, `X-Treg-Route-Max-Cost: <maxCostUsd>` as a plain decimal (no exponent, no trailing zeros: `0.005`, `0.01`, `10`), `accept: application/json`, `user-agent: UA`. POST adds `content-type: application/json`. GET sends no body.
- Result: `{ payload, cost_usd }`.
  - `payload` = parsed JSON of the 2xx body; empty or whitespace-only body = `null`.
  - `cost_usd` = `Number(X-Treg-Cost-Micro) / 1e6`; header missing or not finite (NaN, Infinity) = `0`.

## Rules
- The token is sent in the `X-Treg-Token` header only; never in the URL, body, error message or any note. Errors redact both the raw token and `encodeURIComponent(token)` as `[token]`.
- `signal: AbortSignal.timeout(TIMEOUT_MS)` on every request; no retry, no fallback; the runner turns a throw into a note.
- Non-2xx whose body is JSON with `detail.error` (string) throws `Error("treg <endpoint>: HTTP <status> <detail.error>: <detail.message>")` (no braces or quotes; message optional and then the `: ` part is omitted; message whitespace collapsed, token-redacted, first 160 characters), e.g. `treg apollo.people.enrich: HTTP 402 insufficient_balance: apollo.people.enrich would cost ~$0.026 on treg's apollo key and this team's balance is $0.000141.`; also for the 503 `provider_capacity_unavailable` detail.
- Any other non-2xx body throws `Error("treg <endpoint>: HTTP <status> <snippet>")`; snippet = body with whitespace runs collapsed to one space, trimmed, first 160 characters. 402 = balance exhausted, 503 = provider capacity; both are uncharged.
- A failed call returns no cost (the throw carries none); the runner reserves `maxCostUsd` and settles on success only.
- The adapter does not parse provider payloads and does not know endpoints; allow-list parsing lives in the collectors.
- The adapter does not check budget; `maxCostUsd` is only forwarded as the provider-side cap.

## Failure modes
- 402 / 503 / any non-2xx: Error as above (message never contains the token, even if the provider echoes it in the body).
- Timeout / network error: the `fetch` rejection propagates unchanged (`TimeoutError` / `TypeError`).
- 2xx with a non-JSON body: throws an Error whose message starts `treg <endpoint>:` (no raw token, no body longer than the snippet).

## Tests that prove it (`treg.test.ts`, fake global `fetch`, no network)
Existing:
- GET: url with `+` and `%2C` encoding, method GET, no body, the four headers, `cost_usd` 0.0015 from `1500`.
- POST: bare url, JSON body, `content-type`, `X-Treg-Route-Max-Cost: 0.01`.
- Cost 0 when the header is missing or `abc`.
- 402 throws `treg e: HTTP 402 <collapsed snippet>`.
- Empty 2xx body = `{ payload: null, cost_usd: 0 }`.
- A GET with empty params has no query string (asserted through `makeTregCall`).

To add:
- Snippet is cut at 160 characters (a 500-character body).
- The thrown message never contains the token (body echoing it, 402 and 2xx-invalid-JSON cases).
- 503 throws with status 503.
- Invalid JSON on 2xx throws a message starting `treg <endpoint>:`.
- `X-Treg-Route-Max-Cost` plain decimal for `10`, `0.00022`, `1e-7` (never `1e-7`).
- A request carries an abort signal (`fetch` init `signal` is an `AbortSignal`); no second `fetch` call after a failure (no retry).
- Negative cost header gives `0`.
- URL-encoded token (`+`, `/`, `=`) echoed in a body is redacted in both forms.
- `detail.error` + `detail.message` gives the plain sentence (message cut at 160, no braces or quotes); 503 detail without message gives `HTTP 503 provider_capacity_unavailable`; token in the message is redacted.
- POST url has no `?` even with params.
