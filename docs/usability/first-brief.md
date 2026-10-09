# First brief: usability test for a non-technical recruiter

The team plan says onboarding is done when "a non-technical tester completes it unaided". This file holds the test script and the results. Result 1 is a **simulation** (an AI persona driving a browser), not a person. Result 2, the test with a real person, has not been run yet.

## (a) Script for a real non-technical tester

**Who:** someone who hires or does HR admin and has never used Radar. Not a developer and not a team member.

**Setup** (choose one, before the tester arrives):
- **Fresh account:** the tester registers at https://oldboys.asajj.cz. Registration is limited to 10 per hour per IP, so do it only once.
- **Team account:** log in for them and start on **My briefs**.

Use a laptop browser at full width. Open only https://oldboys.asajj.cz. Start a screen recording if the tester agrees.

**Task card** (print it, or hand it over as a note from "your manager"):

> Please prepare an interview brief.
> - Position: a marketing role from the list, for example Growth Marketer or Marketing Manager.
> - Candidate: Josef Buryan, LinkedIn https://www.linkedin.com/in/josef-buryan
>
> When the brief is ready:
> - **T1** Find which requirement of the position has no public evidence.
> - **T2** Open the exact quote behind one point.
> - **T3** Find the notice for the candidate and copy it.

Josef is a team member and has agreed to this. Use no other real person. Start **one** research run only (about $0.80).

**Rules for the moderator:**
- Do not help, do not point, do not explain words. Say only "What would you do now?"
- Ask the tester to think aloud.
- If the tester is stuck for **2 minutes**, write down the screen and the time. Then give the **smallest** hint (for example "Look at the top of the page") and note that you did.
- If the identity question appears ("Quick question: is this … profile also …?"), let the tester decide alone.
- While the brief is being prepared (6 to 12 minutes), let the tester do anything, for example read the guide. Note what they do.

**What to record for each step:**
- the start and end time
- done alone (yes / with hint / no)
- every hesitation: the screen, the word or element that was unclear, what the tester said
- whether they opened the guide (/guide), and whether it helped
- the answer they gave for T1 to T3

**Result table template:**

| Step | Done alone | Time | Hesitations (screen · word) | Guide used / helped | Notes |
|---|---|---|---|---|---|
| Register |  |  |  |  |  |
| Welcome page, find the guide |  |  |  |  |  |
| Pick the position |  |  |  |  |  |
| Add the candidate, start |  |  |  |  |  |
| Wait (identity question?) |  |  |  |  |  |
| T1 requirement without evidence |  |  |  |  |  |
| T2 exact quote |  |  |  |  |  |
| T3 copy the candidate notice |  |  |  |  |  |

At the end ask: "Which word was the most unclear?" and "Would you use this before a real interview? Why or why not?"

## (b) Result 1 — simulated walk (AI persona with Playwright, not a real person), 2026-10-09 05:34–05:38

**This is a simulation.** An AI agent played "Jana, an HR administrator at a small office, first time in Radar, not technical". It used Playwright at 1440 px and repeated the key screens at 390 px. It used only what was on the screen, with normal clicks and typing, and typed no URL except the site address. The times are the agent's times. A real person would be slower, so the times say nothing about real reading speed. The agent knows the words "fact", "inference", "evidence" from its training, so it understands them faster than a real person would.

- Account: `qa-guide-0535@example.test`, company "Guide Test Ltd" (outside the Czech Republic, country GB).
- Research run: **none started by Jana.** "Research 1 candidate" answered "Started 0 runs. Skipped 1: already started" and linked "Open the existing brief". Jana followed that link. So T1 to T3 were done on the existing finished brief of the same consenting person: `/runs/c9c2a2b6` (Growth Marketer, research 2026-10-09 02:26 UTC, 11 min 30 s, cost shown $0.84, label CACHED). The walk itself spent $0.
- The identity question did not appear, because no run started. The existing brief shows "Identity confirmed · 3 profiles".

| Step | Done alone | Time (agent) | Hesitations | Guide |
|---|---|---|---|---|
| Landing → Create account → 2 steps | yes | 0:30 | Company step: "Country (2 letters)" has no example; DIČ and Legal form stay visible for a foreign company | not needed |
| Welcome page, guide link | yes | 0:10 | none; "New to Radar? Read the 3-minute guide" is clearly visible under the greeting | opened, read, came back |
| Pick the position | yes, by a detour | 0:45 | **"Role you are hiring for" on the welcome page shows no list.** The hint says "Pick a preselected role", but typing "Marketing" or pressing the down arrow shows nothing. Jana followed guide step 1 and clicked **New brief** in the header; there "Find a position" lists Growth Marketer | **helped**: step 1 "Click New brief" got her out |
| Add the candidate, start | yes | 0:25 | "Research 1 candidate" matched the guide. The result "Started 0 runs. Skipped 1: already started" confused her: she had never started anything. "Open the existing brief" took her to a brief of another company | no help; the guide does not mention this case |
| T1 requirement with no public evidence | **unclear answer** | 1:00 | The guide says "must-haves", the brief says **"Role criteria"**. "In 30 seconds" says **"0 of 4"** with all four listed, the Interview plan says "only partial public evidence" for each, and the Evidence tab says **"1 of 4 must-haves evidenced, 3 partly"** with **63%**. Jana first tried **Sources and gaps**, which lists sources, not requirements, with raw errors (HTTP 400 JSON, Apify run ids). Her answer: "the summary says none of the 4 has evidence", which the Evidence tab contradicts | partly; the glossary "Gap" sent her to the wrong tab |
| T2 exact quote | yes | 0:45 | Guide step 4 says click **Show evidence**: that button is not on the brief (only on the landing page). "See the evidence" switched to the Evidence tab but did not scroll to it. Opening the topic "Writing and publications" showed each point with its quote and a linkedin.com link, e.g. "Groupon is now inside ChatGPT and Claude." One **Inference** line also had a direct quote, while the glossary said Inference has "no direct quote" | **misled** by the old label, then found it alone |
| T3 copy the candidate notice | yes | 0:10 | none: **More exports** → **Copy candidate notice** → "Copied", exactly as the guide says (EN / CZ switch above it) | **helped** directly |
| 390 px | yes | — | Guide reads well, header in one row, phone Menu has Guide. On the brief, the tabs scroll sideways and More exports sits low under the content | — |

**Summary:** register → brief → T1 to T3 completed without outside help, with **6 hesitations**. T1 ended with an answer the page itself contradicts. Jana did not start her own run (see above).

**What Jana also saw, outside the tasks:** the Evidence tab's "4. Working style" shows a **Big Five** chart (Openness, Conscientiousness, Extraversion, Agreeableness, Stress response) with "How to work with them", plus **DISC** and **MBTI (ENTJ · low confidence)**. The tab also says "Role fit scorecard" with "+13 pts" per line. The guide she had just read says "Radar never scores or ranks people". JURY.md already lists both as known issues 1 and 2. A first-time user sees them in their first brief.

**What the guide fixed (commit `fix(guide): …`, copy only, in `src/app/guide/guide-content.ts`):**
- Step 4: to see the quote, open the **Evidence** tab and click a topic (replaces the "Show evidence" button the brief does not have).
- Step 4: must-have coverage is in **Role criteria with public evidence** under **In 30 seconds**; the brief calls must-haves role criteria (also in the Must-have entry).
- Inference: "A quote may be shown with it, but the quote does not say the point directly."
- Fit: the Evidence tab shows the same share at the top, as a percentage.
- Welcome page line: type the job title there, or pick from the list of positions via **New brief**; step 1 says **New** on a phone.
- Wording checked against the code (`7c42037`): "public sources" instead of "public professional sources"; "never decides for you, or ranks candidates against each other" instead of "never scores or ranks people"; protected topics are kept out of the brief; Radar never contacts the candidate unless you start a phone call they agreed to; nothing behind a login; decide identity by employer, city and job history, never by the photo; use **Delete candidate data** when you reject the candidate; the example question uses Jan, not Jana.

**Still unclear (not copy, left for the team):**
1. **Fixed in `429915c`:** the welcome page now passes `ROLE_OPTIONS`, so the role list appears. Was: welcome page role field (`src/app/onboarding/page.tsx`): `<StartForm autoFocusRole />` gets no `roleOptions`, so the role list never appears although the hint says "Pick a preselected role". `/briefs/new/page.tsx` passes `ROLE_OPTIONS`; the welcome page does not.
2. A new company sees and reuses other companies' positions, and "Research 1 candidate" skips a candidate another company already researched ("Started 0 runs. Skipped 1: already started") and links that company's brief. This is the positions-org-scope gap (Part B waits on a remote migration).
3. "0 of 4" in **In 30 seconds** against "1 of 4 must-haves evidenced, 3 partly · 63%" in the Evidence tab for the same brief.
4. **Sources and gaps** shows raw technical reasons (HTTP status with JSON, Apify run ids) to a non-technical reader.
5. "See the evidence" switches the tab but leaves the view at the top.
6. Big Five / DISC / MBTI and "scorecard … pts" in the first brief (JURY known issues 1 and 2).
7. Registration: "Country (2 letters)" without an example (**fixed in `7c42037`:** placeholder GB and "For example GB, DE or US."); Czech-only fields (DIČ) shown for a foreign company (still open).
8. Console: `/api/runs/<id>/calls/proposal` answers 403 for this account on another company's brief (no visible effect).

## (c) Result 2 — real non-technical tester: not run yet

Use the script in (a) and add a table in the same format as (b). Until then, "completes it unaided" is shown only by the simulation above.
