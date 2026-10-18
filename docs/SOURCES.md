# Event sources

`npm run scrape` runs every enabled source in `data/sources.json`, then normalizes, classifies, geocodes and de-duplicates. Results go to `data/events.json`; a per-source health report goes to `data/scrape-report.json`.

| Adapter | Use it for | Notes |
|---|---|---|
| `jsonld` | Any page with schema.org Event data (Eventbrite, AllEvents, DoTheBay, most venue sites) | `urls` or `urlTemplate` with `{yyyy}/{mm}/{dd}`, `followLinks` to crawl detail pages |
| `rss` | Event blogs & calendars | `pubDateIsEventDate` (Funcheap), `dateFromText` |
| `ical` | Libraries, parks, universities, venues (`.ics`) | Recurring events expanded |
| `localist` | Localist calendars (Stanford and many campuses/cities) | `base` URL |
| `tribe` | WordPress “The Events Calendar” sites | `sites` list |
| `ticketmaster` | Concerts, sports, theater | `TICKETMASTER_API_KEY` (free) |
| `seatgeek` | Concerts, sports, comedy | `SEATGEEK_CLIENT_ID` (free) |
| `nineteenhz` | Electronic music / nightlife | 19hz.info Bay Area list |
| `roundups` | “Things to do this weekend” news articles | `OPENROUTER_API_KEY`; facts only, our own one-line summaries |

**Good manners built in:** a clear bot User-Agent, robots.txt checks, 1+ second gaps between requests to the same site, retries with backoff, and links back to every original listing.

**Reliability:** if a source fails, yesterday's upcoming events from it are kept so pages don't go empty. Ended events drop off automatically.

**Add a source:** append an entry to `data/sources.json`, run `node scripts/scrape/index.mjs --only=<id>`, and check the report.

**Always-on picks:** hand-curated favorites live in `data/evergreen.json` (96 places across all regions). Edit freely.
