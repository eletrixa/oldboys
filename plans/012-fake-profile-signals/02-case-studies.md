# Case studies — fake and impersonated profiles: what real teams and platforms report

## Hiring-fraud cases

**KnowBe4, July 2024** (https://blog.knowbe4.com/how-a-north-korean-fake-it-worker-tried-to-infiltrate-us). A stolen valid US identity passed background check. AI-edited stock photos matched across four video interviews. Shipping address differed from residence. Post-incident signals: VoIP numbers with no digital footprint, DOB/address mismatch, conflicting personal info, VPN/VM use, unresponsiveness on social calls. New controls: name consistency checks, phone references, resume gaps, work-knowledge interview questions, address matching.

**CrowdStrike Famous Chollima, 2025** (https://cyberscoop.com/crowdstrike-north-korean-operatives/). 320+ incidents in 12 months. Personas used GenAI for resumes and real-time deepfakes in interviews.

**Gartner, 2026** (https://www.hrdive.com/news/fake-job-candidates-ai/757126/). By 2028, one in four candidate profiles worldwide could be fake. 6% of 3,000 candidates admitted interview fraud. Only 7% of recruiters use ID validation.

**Greenhouse, 2025** (https://www.greenhouse.com/guidance/mitigate-rising-candidate-fraud-through-identity-verification). 31% of 4,136 managers interviewed a suspected deepfake candidate.

**FBI IC3 PSA I-012325** (https://www.ic3.gov/psa/2025/psa250123). Red flags: profiles not matching resume, multiple profiles with different pictures, reused VoIP phone and email, refusal of video, face-swap tools, AI-edited document photos.

**Pindrop, 2025** (https://www.pindrop.com/article/north-korean-it-worker-alert-hiring-fraud/). Fake applicant emails first appear 48 days before job start versus 1,646 days for legitimate. Phone-name match: 0.09 fraudulent vs 0.99 legitimate.

## Platforms

**LinkedIn, H2 2025** (https://about.linkedin.com/transparency/community-report). 88.9 million fake accounts stopped at registration, 24.8 million blocked after. 99.7% caught before any member report. Members: 115 million+ verified (less than one in ten). The platform deployed embedding detectors for AI-generated profile photos achieving 99.6% true-positive rate at 1% false-positive rate on StyleGAN1-3, Generated.photos, and Stable Diffusion. A 2024 follow-up report (https://www.websiteplanet.com/news/linkedin-ai-image-detector) showed 98% recall at 0.5% FPR and 84.5% accuracy on unseen generators. Detection does not generalize to diffusion-model images.

**Meta threat reports** (https://www.npr.org/2022/12/15/1143114122/ai-generated-fake-faces-have-become-a-hallmark-of-online-influence-operations, December 2022). Over two-thirds of disrupted coordinated networks used AI-generated profile photos. Detection relies on behavioral and network signals, not image analysis alone. Human red flags in GAN faces: irregular ear and hair structure, eye misalignment, odd backgrounds, asymmetric glasses or earrings.

**X, 2025** (https://kiledjian.com/2025/11/22/understanding-xs-about-this-account.html). The "About this account" panel shows creation date, country or region, username-change count, app-store or web-client source, and VPN warning. Access requires the app or web UI; API availability is undocumented.

## Research with numbers

**Goga, IMC 2015** (https://www.lix.polytechnique.fr/~goga/papers/impersonators_IMC2015.pdf). Account-pair classifier: 90% TPR at 1% FPR for victim-impersonator pairs. Single-account SVM: 34% TPR at 0.1% FPR. Humans spotted 18% of impersonators.

**Weak Links, 2025** (https://pith.science/paper/2507.16860). Numeric features (job count, education, skills, connection stats) resist attack better than text. False-accept on GPT profiles: 42-52% baseline, 1.3-2.6% after training. Human F1: 58.9%.

**Adikari & Dutta** (https://arxiv.org/pdf/2307.11864). Profile features achieve 87.34% accuracy on 20 real and 17 fake profiles.

**StarScout, 2024** (https://arxiv.org/abs/2412.13459). 6.0 million fake GitHub stars (15.8% of repos >50 stars, July 2024).

**Kumar et al., sockpuppets** (https://ar5iv.arxiv.org/html/1703.07355). Sockpuppets start fewer discussions, write shorter posts, more first-person pronouns, clustered networks.

## Tools and prices

Reverse image (Google Lens) via Apify: $0.005 per image with matches. Account age on X: $0.15 to $3 per 1,000 profiles. AI-generated image detection: Sightengine $0.01 per check (free 2,000 per month); Hive $6 per 1,000 images. TinEye API: $0.04 per search. Username search (Maigret): ~$0.02 to $0.10 per handle via Apify.

## Legal (not legal advice)

**WP29 Opinion 2/2017** (https://www.rpclegal.com/snapshots/data-protection/data-protection-working-party-adopts-opinion-22017-on-data-processing-at-work/). Employers must not treat accessible social media as permitted recruitment screening. Legal ground (legitimate interest), necessity, proportionality, and transparency are required. Only data relevant to job performance may be used. Candidates must be informed in advance. Data must be deleted if the hire is declined.

**Czech guidance** (https://www.pravniprostor.cz/clanky/pracovni-pravo/ochrana-osobnich-udaju-v-personalni-praxi). Vetting applicants on social networks is not in line with law except professional networks intended for applicant presentation, and the applicant must be informed.

**EDPB Guidelines 05/2022** (https://www.edpb.europa.eu/documents/435_en). A publicly posted photo does not authorize creating biometric templates for identification. Face matching and templates fall under Article 9(1) biometrics and generally require explicit consent. Plain reverse image search by a third-party engine is personal data processing requiring Article 6(1)(f) balancing and Article 14 notice but not Article 9 by itself. AI-generation scoring analyzes the image, not the person, but still processes the photo.

**PimEyes enforcement** (Hamburg, noyb). PimEyes faces enforcement under GDPR over reverse-image facial matching.

## Negative results

The following were searched and not found: Zarei et al. (cited but not retrieved); HireRight-specific hiring-fraud indicators; Botometer maintenance for post-2023 X API; LinkedIn profile creation date public without login; Bing Visual Search API (retired August 11, 2025); official X API for "About this account" join date; CrowdStrike detailed indicator list outside the full PDF.

## Assumptions

Every claim tagged ASSUMPTION in the source research: Apify google-lens actor update date not shown. CrowdStrike detailed indicator list in full report PDF only. LinkedIn profile creation date likely login-gated on public profiles. GDPR Art. 9 restrictions on Czech Labour Code sections 316 and 30 (secondary source only). GitHub commit-email mismatch signal uses standard REST fields (threshold undefined). X API availability for "About this account" undocumented. Botometer generalization poor across platforms. Numeric handle suffix and default avatar as X fraud signals (no peer-reviewed source). Botometer not maintained for post-2023 X API. HF free credits $0.10 per month and serverless model availability unverified. HF detector test distribution not LinkedIn headshots; training data for umm-maybe/AI-image-detector ended October 2022, fails on webcams and unseen Midjourney 5, SDXL, DALLE-3. Sparse-profile people, new graduates, career changers, name changes, non-Latin names, and company headshots reused from employer domains: no source with decision threshold.

