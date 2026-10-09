# 016 — treg as a second source for profile enrichment and sourcing

Status: in progress (2026-10-09). Dossier `00-SYNTHESIS.md` follows once the catalog research lands.

Scope: add treg.to catalog endpoints (people enrichment by LinkedIn URL, people search by name + employer, per-platform
profile reads) as paid `treg/*` collector steps in the hiring and due-diligence recipes, so every social profile the
Apify scrape found is read a second time by an independent provider ("double verified") and profiles Apify missed are
found before the identity lineup. Secret `TREG_TOKEN` (optional: unset = the steps record "not searched").
