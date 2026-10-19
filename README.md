# Bay Area Weekend 🌉

A fast, fun, SEO-first directory of things to do across the San Francisco Bay Area — rebuilt automatically twice a day from dozens of event sources.

**What's inside**
- **Daily scraper** (`scripts/scrape/`) — AllEvents (30+ cities), SF Funcheap, 19hz (nightlife), Luma, Ferry Building, Stanford / UCSF / SJSU public calendars, plus Ticketmaster & SeatGeek (free keys) and an optional AI reader for news roundups and venue calendars (Cal Academy, SFMOMA, Cobb's, Yoshi's, libraries, parks…). Sites that block automated access (Eventbrite, DoTheBay, SF Station) are respected and left off. Everything is cleaned, de-duplicated, geocoded, placed in real neighborhood boundaries and tagged.
- **Real photos** (`scripts/images/`) — Wikimedia Commons (real Bay Area places & events) + Pexels, quality-checked and credited (`/photo-credits/`). A contact sheet of every chosen photo is published to the `image-review` branch for a quick visual check.
- **Real map** — live street map (Leaflet + OpenStreetMap/CARTO) with official county and SF/Oakland/San José neighborhood boundaries (`scripts/geo/`).
- **Directory pages** for 5 regions, ~80 cities, SF/Oakland/San Jose neighborhoods, 16 genres and 8 vibes (Kid-Friendly, Nightlife, Free, Hot Day, Rainy Day, Fog Escape, Date Night, Near BART) — plus every combination that has enough listings.
- **Explore map** (`/explore/`) — Leaflet map with clickable regions, filters, and plain-English search (“free kids stuff in Oakland Saturday”), Spin the Bay 🎰, Near me, and a live weather hint.
- **My Plan** — heart events, see a day-by-day timeline with clash warnings, export to calendar, share a link.
- **Sponsors** — bid board, sponsored top spots (always labeled), ticket deals (`/advertise/`, `/deals/`, `data/sponsors.json`).
- **V2 email prep** — signup with region/interest preferences, public feed at `/data/events.json`, and a ready digest builder (`scripts/digest/`).
- **SEO + AEO** — Event/FAQ/Breadcrumb/ItemList structured data, honest sitemaps, RSS + JSON Feed, `llms.txt`, IndexNow + WebSub pings after every deploy.

## Quick start
```bash
npm install
npm run scrape          # pull live events (needs internet) → data/events.json
npm run dev             # http://localhost:4321
npm test                # scraper + digest tests
npm run build           # static site → dist/
```

## Going live (Vercel)
The site is hosted on Vercel (project `bayareaweeked`, https://bayareaweeked.vercel.app). Vercel rebuilds and publishes on every push to `main`, including the bot's twice-daily data commits.
1. Vercel finds its own address automatically, custom domains included. Set `SITE_URL` (in Vercel *and* as a GitHub repo variable) only if you want to override it.
2. Vercel **Deployment Protection** must leave production public, or Google can't see the site. The **Live site check** workflow fails loudly if it's behind a login.
3. Photos are built and safety-checked on GitHub, so add the Pexels key as a GitHub secret `PEXELS_API_KEY` (Settings → Secrets and variables → Actions). A Vercel env var `Pexels_API` is only checked at build time (`pexels-check:` line in the Vercel build log). Optional secrets: `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID` (concerts & games), `OPENROUTER_API_KEY` (AI reader for venue calendars & news roundups).
4. **Daily scrape, build & deploy** runs ~5am and ~5pm Pacific: scrape → G/PG check → commit data (Vercel deploys it) → wait until the live site has the new data → IndexNow/WebSub pings.
5. **Live site check** waits for Vercel to publish each push to `main`, then runs the browser test suite on the live site.

## Photos & maps quality
- **Organizer images** are shown only if they pass the G/PG check *and* the content review in `data/image-review.json` (no logos, text-only flyers, off-topic or adult-themed graphics). With an `OPENROUTER_API_KEY` secret (a normal inference key), the daily job reviews new images with a vision model; without it, new images stay hidden and the listing uses a real venue or genre photo. Listings whose title has masked profanity never show their image.
- **Site Audit** workflow publishes review sheets of every photo plus live map screenshots to the `site-audit` branch.
- **Maps:** venue pages embed Google Maps (no key needed). The explore/region maps use OpenStreetMap tiles (Esri as automatic backup), or Google Maps when `PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel (enable the *Map Tiles API* and restrict the key to your domain).

## Failure limit (test mode)
The daily, photo and photo-candidate workflows have a **circuit breaker**: if a workflow fails 3 times within 24 hours, every further run is skipped until 24 hours after that 3rd failure. To run anyway, use **Actions → (workflow) → Run workflow** and tick **force**, or push a commit whose message contains `[force-run]`. The rule lives in `.github/scripts/circuit-breaker.mjs`.

## Settings
Repo **variables** (Settings → Secrets and variables → Actions → Variables): `SITE_URL`, `SITE_NAME`, `PUBLIC_SIGNUP_ENDPOINT`, `PUBLIC_SPONSOR_ENDPOINT`, `PUBLIC_CONTACT_EMAIL`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY`, `OPENROUTER_MODEL`, `DEPLOY_TARGET`.

Repo **secrets** (all optional): `PEXELS_API_KEY`, `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID`, `OPENROUTER_API_KEY`, `GOOGLE_INDEXING_SA_JSON`.

See `.env.example` and the guides in `docs/`:
- [docs/SEO.md](docs/SEO.md) — the ranking + daily indexing checklist (do this first!)
- [docs/SOURCES.md](docs/SOURCES.md) — how scraping works and how to add sources
- [docs/SPONSORS.md](docs/SPONSORS.md) — running sponsored placements, bids and deals
- [docs/V2-EMAIL.md](docs/V2-EMAIL.md) — plan for the personalized daily email
