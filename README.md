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

## Going live (GitHub Pages, free)
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions** (required — deploys fail until this is set).
2. Repo **Settings → Secrets and variables → Actions → New repository secret**: `PEXELS_API_KEY` (your Pexels key) for more photo variety. Optional: `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID` (both free, add hundreds of concerts & games), `OPENROUTER_API_KEY` (AI reader for venue calendars & news roundups).
3. Push to `main`. The **Daily scrape, build & deploy** workflow runs at ~5am and ~5pm Pacific (or run it by hand from the Actions tab).
4. Strongly recommended for SEO: add a **custom domain** (Settings → Pages), then set the repo variable `SITE_URL` (e.g. `https://bayareaweekend.com`).

Prefer Vercel/Netlify/Cloudflare? Import the repo there (build `npm run build`, output `dist`) and set repo variable `DEPLOY_TARGET=external`. The daily workflow still scrapes and commits fresh data, which triggers your host's rebuild.

## Failure limit (test mode)
The daily, photo and photo-candidate workflows have a **circuit breaker**: if a workflow fails 3 times within 24 hours, every further run is skipped until 24 hours after that 3rd failure. To run anyway, use **Actions → (workflow) → Run workflow** and tick **force**. The rule lives in `.github/scripts/circuit-breaker.mjs`.

## Settings
Repo **variables** (Settings → Secrets and variables → Actions → Variables): `SITE_URL`, `SITE_NAME`, `PUBLIC_SIGNUP_ENDPOINT`, `PUBLIC_SPONSOR_ENDPOINT`, `PUBLIC_CONTACT_EMAIL`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY`, `OPENROUTER_MODEL`, `DEPLOY_TARGET`.

Repo **secrets** (all optional): `PEXELS_API_KEY`, `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID`, `OPENROUTER_API_KEY`, `GOOGLE_INDEXING_SA_JSON`.

See `.env.example` and the guides in `docs/`:
- [docs/SEO.md](docs/SEO.md) — the ranking + daily indexing checklist (do this first!)
- [docs/SOURCES.md](docs/SOURCES.md) — how scraping works and how to add sources
- [docs/SPONSORS.md](docs/SPONSORS.md) — running sponsored placements, bids and deals
- [docs/V2-EMAIL.md](docs/V2-EMAIL.md) — plan for the personalized daily email
