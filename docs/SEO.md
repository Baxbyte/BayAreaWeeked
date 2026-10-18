# SEO & AEO playbook

SEO is the #1 priority. Here's what the site already does automatically, and the few one-time steps only you can do.

## Built in (automatic, every build)
- **Fresh, date-stamped hub pages** — titles like “Things to Do in Oakland This Weekend (Oct 23–25)” for every region, city, neighborhood, genre, vibe and their combinations. Thin pages (fewer than 3 listings) are automatically `noindex`.
- **Structured data** — `Event` (with the right subtype: MusicEvent, ComedyEvent, Festival…), `TouristAttraction`, `FAQPage`, `BreadcrumbList`, `CollectionPage` + `ItemList`, `WebSite` + `SearchAction`, `Organization`.
- **Answer-engine friendly** — every hub opens with a “Quick answer” list and ends with an FAQ; every event has a “Good to know” Q&A (when, where, cost, kid-friendly?, rainy-day?, transit). `/llms.txt` and `/llms-full.txt` give AI assistants a clean map and the full week of events. `robots.txt` explicitly welcomes GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.
- **Honest sitemaps** — `/sitemap.xml` → pages, events (with images), places. `lastmod` only changes when a listing's details actually change, so Google trusts it.
- **Feeds** — `/rss.xml` (with a WebSub hub) and `/feed.json` of newly added events.
- **Instant indexing after every deploy** (`scripts/indexnow.mjs`):
  - **IndexNow** → Bing, Yandex, Seznam, Naver, Yep (and Bing powers ChatGPT search & DuckDuckGo). Only new/changed URLs are sent.
  - **WebSub** ping for the RSS feed (Google uses feeds for discovery).
  - *Optional* **Google Indexing API** (`GOOGLE_INDEXING_SA_JSON` secret). Heads-up: Google officially supports this API only for job-posting and livestream pages, so use at your own discretion.
- **Fast pages** — static HTML, almost no JavaScript outside the map, lazy images, system fonts + one display font.
- Canonicals, Open Graph/Twitter cards, `geo.region` meta, breadcrumb trails and dense internal linking (footer directory, related links on every page).

## One-time setup (you)
1. **Custom domain** (e.g. `bayareaweekend.com`) → set `SITE_URL`. A real domain ranks far better than `github.io`.
2. **Google Search Console** → add the domain property, verify (`GOOGLE_SITE_VERIFICATION`), submit `https://YOURDOMAIN/sitemap.xml`. Google re-reads sitemaps automatically; there is no longer a “ping” endpoint, so Search Console + feeds is the reliable path.
3. **Bing Webmaster Tools** → import from Search Console (or verify with `BING_SITE_VERIFICATION`), submit the sitemap. IndexNow then handles daily submissions.
4. Optional: set your own `INDEXNOW_KEY` (any 32-char hex string).
5. Build links: submit the site to local directories, Reddit r/bayarea weekend threads, neighborhood newsletters, and ask featured organizers to link to their listing.

## Ideas for later
- Short original intros for the top 20 neighborhood pages (unique copy helps them rank).
- Per-page Open Graph images.
- A weekly “Best of the weekend” editorial post.
