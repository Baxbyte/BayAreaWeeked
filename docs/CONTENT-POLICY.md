# Family-friendly content policy (G/PG only)

Every image and listing on the site must be suitable for all ages. This is enforced automatically, in layers, and **fails closed** — if something can't be verified as safe, it isn't shown.

## Photos
1. **Hand-picked only.** Site photos come exclusively from `data/photo-picks.json`, chosen by a person from numbered candidate sheets. Nothing is auto-published.
2. **Automatic image-safety scan.** Every photo (hand-picked, Pexels, and every organizer's event image) is scanned locally with the open-source NSFWJS classifier (`scripts/safety/image-safety.mjs`). Both the full image and a center crop are checked against strict limits (Porn ≥ 8%, Hentai ≥ 8% or Sexy ≥ 30% → rejected). Unreadable/unverifiable images are rejected too.
3. **Blocked sources.** Photo sets and events that commonly include nudity (e.g. Bay to Breakers, Folsom Street Fair, Up Your Alley) are excluded by name, along with any file whose title, description or categories mention nudity, swimwear, lingerie, etc.
4. **Organizer images stay hidden until approved.** Event images are shown only after they pass the scan (`data/image-safety.json` caches results). Otherwise a hand-picked photo is used.
5. **Repo check blocks deploys.** `npm run safety` scans every image in the repo and fails CI if any photo is flagged, unlisted, or not hand-picked. Deploys and photo updates can't happen unless it passes.

## Listings text
- Sexually explicit events (strip clubs, fetish/kink parties, nude events, etc.) are dropped entirely (`src/lib/policy.mjs`).
- Profanity in titles, descriptions, venue names and tags is masked (e.g. "f*****").
- "Adult nightlife" means 21+ bars, clubs, DJs and late shows — never explicit content.

## Reporting
If anything slips through, remove its id from `data/photo-picks.json` (or add the event's words to `src/lib/policy.mjs`) and push — the next build removes it everywhere.
