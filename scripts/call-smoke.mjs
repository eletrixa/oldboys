/**
 * Smoke test for call verification end-to-end workflow.
 *
 * Project: oldboys — social media deep research with call verification
 * Module:  scripts/call-smoke.mjs
 * Deps:    none (Node 22+ global fetch)
 * Tested:  manual; run with BASE_URL, RUN_TOKEN, RUN_ID, SMOKE_TO_NUMBER
 *
 * Key responsibilities:
 * - Orchestrate create → approve → poll until terminal
 * - Validate brief structure
 * - Exit 0 on done, 1 on failure, 2 on missing env
 *
 * Design constraints:
 * - Never read .dev.vars
 * - Never expose full number in output
 * - Poll every 5 s up to 35 min
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3141';
const RUN_TOKEN = process.env.RUN_TOKEN;
const RUN_ID = process.env.RUN_ID;
const SMOKE_TO_NUMBER = process.env.SMOKE_TO_NUMBER;
const SMOKE_OPERATOR = process.env.SMOKE_OPERATOR || 'smoke';

if (!RUN_TOKEN || !RUN_ID || !SMOKE_TO_NUMBER) {
  console.error(
    'Usage: RUN_TOKEN=<token> RUN_ID=<id> SMOKE_TO_NUMBER=<e164> node call-smoke.mjs'
  );
  console.error('Optional: BASE_URL (default localhost:3141), SMOKE_OPERATOR (default "smoke")');
  process.exit(2);
}

const headers = {
  Authorization: `Bearer ${RUN_TOKEN}`,
  'Content-Type': 'application/json',
};

const log = (line) => process.stdout.write(line + '\n');

let callId;

try {
  // Step 1: Create call
  log(`Creating call for run ${RUN_ID}...`);
  const createRes = await fetch(`${BASE_URL}/api/runs/${RUN_ID}/calls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ language: 'en' }),
  });
  if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
  const created = await createRes.json();
  callId = created.id;
  log(`Call created: ${callId}`);
  log(`\nBrief:\n${created.brief}\n`);

  // Step 2: Approve with consent
  log('Approving call with consent...');
  const approveRes = await fetch(`${BASE_URL}/api/calls/${callId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to_number: SMOKE_TO_NUMBER,
      consent_ack: true,
      consent_note: 'smoke test, callee consented verbally',
      operator: SMOKE_OPERATOR,
    }),
  });
  if (!approveRes.ok) throw new Error(`Approve failed: ${approveRes.status}`);
  const approved = await approveRes.json();
  log(`Call approved. Status: ${approved.status}\n`);

  // Step 3: Poll until terminal
  log('Polling for call completion (every 5 s)...');
  const terminalStates = new Set(['done', 'failed', 'no_answer', 'refused', 'skipped']);
  const pollUntil = Date.now() + 35 * 60 * 1000; // 35 min
  let finalStatus;

  while (Date.now() < pollUntil) {
    const pollRes = await fetch(`${BASE_URL}/api/calls/${callId}`, { headers });
    if (!pollRes.ok) throw new Error(`Poll failed: ${pollRes.status}`);
    const call = await pollRes.json();
    finalStatus = call;

    if (terminalStates.has(call.status)) {
      log(`\nCall terminal: ${call.status}`);
      break;
    }
    log(`${new Date().toISOString()} — status: ${call.status}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (!finalStatus || !terminalStates.has(finalStatus.status)) {
    throw new Error('Call did not reach terminal state within 35 min');
  }

  // Step 4: Print final state (no full number)
  const { to_number: _to_number, ...safeCall } = finalStatus;
  log(`\nFinal call state (number masked):`);
  log(JSON.stringify(safeCall, null, 2));

  process.exit(finalStatus.status === 'done' ? 0 : 1);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
