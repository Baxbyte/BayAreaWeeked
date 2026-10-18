# Bay Area Weekend 🌉

A fast, fun, SEO-first directory of things to do across the San Francisco Bay Area — rebuilt automatically twice a day from dozens of event sources.

**What's inside**
- **Daily scraper** (`scripts/scrape/`) — Ticketmaster, SeatGeek, Eventbrite, DoTheBay, AllEvents, SF Station, SF Funcheap, 19hz (nightlife), Stanford events, optional AI-read news roundups (SFist, KQED, Oaklandside, Berkeleyside…), plus any iCal / RSS / WordPress calendar you add. Everything is cleaned, de-duplicated, geocoded and tagged.
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
1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Push to `main`. The **Daily scrape, build & deploy** workflow runs at ~5am and ~5pm Pacific (or run it by hand from the Actions tab).
3. Strongly recommended for SEO: add a **custom domain** (Settings → Pages), then set the repo variable `SITE_URL` (e.g. `https://bayareaweekend.com`).

Prefer Vercel/Netlify/Cloudflare? Import the repo there (build `npm run build`, output `dist`) and set repo variable `DEPLOY_TARGET=external`. The daily workflow still scrapes and commits fresh data, which triggers your host's rebuild.

## Settings
Repo **variables** (Settings → Secrets and variables → Actions → Variables): `SITE_URL`, `SITE_NAME`, `PUBLIC_SIGNUP_ENDPOINT`, `PUBLIC_SPONSOR_ENDPOINT`, `PUBLIC_CONTACT_EMAIL`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY`, `OPENROUTER_MODEL`, `DEPLOY_TARGET`.

Repo **secrets** (all optional, each unlocks more events): `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID`, `OPENROUTER_API_KEY`, `GOOGLE_INDEXING_SA_JSON`.

See `.env.example` and the guides in `docs/`:
- [docs/SEO.md](docs/SEO.md) — the ranking + daily indexing checklist (do this first!)
- [docs/SOURCES.md](docs/SOURCES.md) — how scraping works and how to add sources
- [docs/SPONSORS.md](docs/SPONSORS.md) — running sponsored placements, bids and deals
- [docs/V2-EMAIL.md](docs/V2-EMAIL.md) — plan for the personalized daily email
