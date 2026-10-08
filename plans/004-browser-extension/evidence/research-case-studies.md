# Case studies: browser extensions that enrich a LinkedIn profile via a backend
Research date: 2026-10-08. F = fact with a source I fetched. I = my inference. Many vendor and blog pages were summarized by a fetch tool, not read verbatim; treat quotes as paraphrase unless in quotation marks.

## Per tool

### Lusha (Chrome, Edge)
- F: Launched on Product Hunt 8 Jun 2016 (151 upvotes). v1 was "a simple Google Chrome extension integrated with LinkedIn", freemium, 5 free credits/month. Started as an HR/recruiting side project. (zeliq.com/fr/blog/lusha-avis, hunted.space/dashboard/lusha/launches/lusha)
- F: Docs list Chrome and Edge stores only. Install sends the user to LinkedIn to accept a privacy pop-up. Docs claim the extension "doesn't automate any browsing activity on LinkedIn and doesn't break any terms of service". (docs.lusha.com/user-guide/extension/install-lusha-extension)
- F: GDPR stance: legitimate interest, opt-out/suppression list, DPA, ISO 27701/27001. Sources include user community, public records, partners, web scraping. (lusha.com/legal/personal-information-notice, docs.lusha.com privacy pages)
- I: Entry point = injected widget on profile; result is inline lookup against a pre-built contact DB, so no long job.

### Kaspr (Chrome only per help page)
- F: Help article documents only Chrome. User must "sync" LinkedIn by clicking "Yes, connect with LinkedIn"; the widget "automatically pops up whenever you're on LinkedIn". (help.kaspr.io/en/articles/8800182)
- F: CNIL fined Kaspr EUR 240,000 on 5 Dec 2024. Findings: collected contact data of people who had restricted visibility to 1st/2nd-degree connections (no legal basis, beyond reasonable expectation); 5-year retention per update too long; data subjects informed only from 2022, English only; weak Art. 15 answers ("publicly accessible sources" with no detail). Compliance deadline 18 Jun 2025. ~160M contacts DB. (cnil.fr/en/data-scraping-kaspr-fined-eu240000)
- I: Strongest regulatory precedent: the extension read/queried data visible only to the logged-in user. "Public" must mean public to an anonymous visitor.

### Seamless.AI (Chrome)
- F: Chrome extension on LinkedIn (incl. Recruiter, Sales Navigator), Gmail, Salesforce. Shows profile name, lets user generate the contact, previews title/email/phone "directly in the sidebar". Moved from an overlay fly-out to the Chrome Side Panel API on 8 Nov 2024 because the fly-out covered the page. (seamless.ai/customers/blog/products/seamless-ai-chrome-side-panel; seamless.ai help articles)
- F: Trustpilot/Capterra reviewers report LinkedIn flagging for automation and throttling at 2,000 contacts/day on "unlimited" plans (anecdotal, user reviews).
- No Firefox version found.

### Apollo.io (Chrome)
- F: LinkedIn removed Apollo's and Seamless's company/brand pages. Salesmotion dates it 7 Mar 2025 and says Apollo's page was later restored (as of Aug 2026). LeadGenius article dated 17 Oct 2025 describes the same takedown; I could not reconcile the dates. Apollo's CEO Tim Zheng: removal "does not disrupt Apollo's services or impact our core platform functionality"; also quoted as "actively working with LinkedIn to understand the nature of our brand page restriction". LinkedIn gave no public reason. (salesmotion.io/blog/linkedin-bans-apollo-..., leadgenius.com/resources/linkedins-crackdown-...)
- I: This is brand-page action, not documented user-account bans. Do not read it as "Apollo users were banned".

### Hunter.io (Chrome, Edge, Firefox)
- F: Extension is open source (Apache-2.0), github.com/hunter-io/browser-extension. One codebase, Grunt build emits build-chrome, build-edge, build-firefox. Stores: Chrome Web Store, Edge Add-ons, Firefox Add-ons. Free tier 25 searches/month, needs an account. It works from the visited page's domain, not LinkedIn profile DOM.
- I: Best example of a tool that avoids LinkedIn ToS exposure entirely and ships all three browsers from one source tree. Auth mechanism not documented in what I read; likely session/API key.

### Crystal Knows (Chromium only)
- F: Injects a "View Personality" button on the right of LinkedIn profiles, then shows abbreviated personality info on later visits. Works on public profiles, Recruiter, Sales Navigator, Salesforce, HubSpot. Docs: Chromium only (Chrome, Edge, Brave); Firefox and Safari explicitly not supported. (docs.crystalknows.com/how-do-i-use-crystal-in-linkedin, .../what-platforms-can-i-use-the-crystal-chrome-extension-with)
- F: Academic/ethics criticism (SPIR/AOIR paper; Gizmodo; Prindle Institute 2015): profiles generated without the person's consent, risk of inaccurate or discriminatory use. I found no regulator action.
- I: Closest analogue to a "profile of a person" product; the criticism applies to personality inference, which the oldboys brief already forbids.

### Clay ("Clip to Clay" extension)
- F: Extension saves LinkedIn profile URLs/contacts into a Clay table; enrichment (person-from-profile, waterfall email) then runs server-side in Clay. (community.clay.com threads; simular.ai workflow page). I could not fetch the thread that states exactly what the extension scrapes; treat the "URL only" reading as partly inferred.
- I: Same shape as the proposed tool: client captures identity, backend does the work.

### PhantomBuster (Chrome and Firefox)
- F: Extension exists to hand LinkedIn (and other sites) session cookies to PhantomBuster's cloud runners ("Connect to [site]"). Firefox add-on has 3,751 users, version 1.3.10, updated July 2026; requests access to cookies on 20+ domains. (addons.mozilla.org/en-US/firefox/addon/phantombuster/)
- I: Highest ToS/account-risk model: the vendor's servers act as the user's logged-in session. Avoid.

### Dux-Soup
- F: Automation extension (visits, messages); cloud tier added so the browser can stay closed. Review sites cite restriction rates (e.g. "23% warnings in 90 days") but these are unsourced vendor-blog numbers; I do not rely on them.

### Surfe (ex-Leadjet), Clearbit Connect, Humantic
- F: Surfe overlays CRM data on LinkedIn profiles and one-click-adds contacts to HubSpot/Salesforce/Pipedrive; Chrome in what I found, Firefox unknown.
- F: Clearbit Connect (Gmail extension) was sunset 30 Apr 2025 after HubSpot's acquisition (announced Nov 2023). (clearbit.com/blog/the-future-of-clearbits-free-tools)
- Humantic: nothing usable found; not reported.

## Cross-cutting answers

1. Entry points (F): injected button/widget on profile (Crystal, Kaspr, Lusha), side panel (Seamless, since Nov 2024), popup from toolbar (Hunter), Sales Navigator/Recruiter pages (Seamless, Crystal, Surfe). Context menu: none of the sampled tools advertise it (I: gap = lower ToS exposure, works on any page).
2. DOM vs server: vendors mostly do not publish. Seamless shows the profile name from the page; Hunter uses the page domain; Clay stores the URL. I: most read name/title/company/URL from the DOM and resolve emails/phones from their own DBs. Kaspr's CNIL case shows what goes wrong when logged-in-only fields are read.
3. Completion (F/I): Lusha, Seamless, Kaspr return inline in the widget/side panel (I: because pre-built DB lookup is fast). Clay returns via table rows in the web app. For a multi-minute research job nothing sampled is directly comparable (I): need Workflow + SSE/poll + badge/notification + email link.
4. Auth (F where stated): Kaspr and Lusha require account login plus a LinkedIn "connect"/privacy acceptance step; Hunter free account with usage quota; PhantomBuster hands over LinkedIn session cookies (risky). Most use the vendor's own login, not LinkedIn credentials.
5. Browsers (F): Hunter ships Chrome+Edge+Firefox; PhantomBuster Chrome+Firefox; Lusha Chrome+Edge; Crystal Chromium only, Firefox explicitly unsupported; Kaspr and Seamless Chrome only in docs I read. I: Firefox lags for everything except Hunter and PhantomBuster, and Firefox lacks the Chrome side panel API (Firefox has its own sidebar_action).
6. LinkedIn enforcement (F):
 - LinkedIn Help "Prohibited software and extensions": bans third-party "crawlers, bots, browser plug-ins, or browser extensions that scrape, modify the appearance of, or automate activity"; members risk restriction; tools may stop working without notice. (linkedin.com/help/linkedin/answer/a1341387)
 - hiQ v. LinkedIn: Nov 2022 summary judgment held user-agreement scraping bans enforceable in contract; 7 Dec 2022 stipulated judgment USD 500,000 vs hiQ (breach of contract, CFAA via fake accounts/password-protected pages, Cal. unauthorized access, trespass, misappropriation, spoliation sanctions), permanent injunction, destroy scraped data and derived code/algorithms. (privacyworld.blog 2022/12; proskauer; natlawreview). I (not verified here): the earlier 9th Cir. holding that scraping truly public pages is not CFAA "without authorization" was left standing but did not protect hiQ from contract claims.
 - Browserflow C&D, 30 Jan 2023 (HN item 34583932): LinkedIn cited hiQ, demanded stopping LinkedIn scraping marketing and removing LinkedIn logos; commenters flagged cloud-side execution as extra liability.
 - Lawsuits against data vendors: Proxycurl (filed Jan 2025; LinkedIn announced resolution 28 Jul 2025; tool reported shut down); ProAPIs/iScraper (filed Oct 2025; "agreement in principle" Feb 2026). Allegations centered on fake accounts at scale. (news.linkedin.com/2025/LinkedInWinsLegalBattleToProtectMemberData; secondary press)
 - BrowserGate (2026): Fairlinked report alleges LinkedIn JS probes for 6,236 extension IDs; LinkedIn acknowledged scanning, saying it detects ToS-violating scrapers; class action filed 7 Apr 2026 N.D. Cal. (securityaffairs.com/191383; secondary). Implication (I): merely having a LinkedIn-touching extension installed can be detected.
 - Documented bans of end users of Lusha/Kaspr/Hunter: none found from primary sources; only vendor-blog claims.
7. Store takedowns: F: nothing primary found of a named LinkedIn tool removed from Chrome Web Store/AMO in 2023-2026. A 2019 blog listed ~90 extensions that "may" be removed under Google's Oct 2019 data-policy deadline; it was speculation. LeadGenius (competitor, Sep 2025) says Google tightened policy on background scraping and affiliate injection. I: the real risk is the Limited Use / single-purpose / minimal-permission review, not LinkedIn.
8. Privacy stances: Lusha = legitimate interest + opt-out + DPA. Kaspr = "publicly accessible sources", fined. Crystal = "publicly available information", criticized for no consent. I: "public" claims fail if data was visible only to a logged-in member.

## v1 feature sets (F, thin)
- Lusha v1: Chrome extension, LinkedIn only, 5 free credits/month.
- Hunter v1/current: popup, domain lookup, 25 free searches.
- Seamless: overlay fly-out first, side panel only 8 years later... (I: fly-out covering the page was the top UX complaint).
- Not findable: what founders would change; no retrospectives found. Anything on that is inference.

## Implications for a tool reading only profile URL, name, location (I, strongest first)
1. Reading three visible fields and fetching public data server-side is the lowest-risk design seen; Kaspr's fine and PhantomBuster's cookie model are the two things to avoid. Never read connection-gated fields or send LinkedIn cookies.
2. Do not fetch linkedin.com server-side with any account or fake account (hiQ judgment, Proxycurl, ProAPIs). Use the URL only as an identity anchor; resolve through other public sources.
3. Do not automate clicks, scrolling or pagination; a one-click, user-initiated action matches Chrome Web Store "explicit user action" emphasis and LinkedIn's "automate activity" wording.
4. Request minimal host permissions (activeTab or only linkedin.com/in/*), or a context menu that works on any page; no cookies permission.
5. Do not market it as a "LinkedIn scraper", no LinkedIn logos (Browserflow C&D).
6. Job completion needs a new pattern: return a run id instantly, then badge/notification + link to the report; email fallback. Inline-lookup tools do not need this.
7. Ship Chrome+Edge first from one source; Firefox via WebExtension polyfill is cheap (Hunter proves it), but avoid chrome.sidePanel.
8. Publish a privacy page: public sources only, retention limit, source disclosure per claim (answers the Art. 14/15 failures CNIL punished Kaspr for), opt-out/suppression.
9. Auth: vendor login or a per-user token; never LinkedIn credentials.
