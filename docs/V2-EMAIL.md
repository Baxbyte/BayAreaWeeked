# V2: personalized daily email (plan)

**Already done in V1**
- Signup forms (homepage, every hub, `/subscribe/`) collect `email`, `regions[]`, `interests[]` (kids, nightlife, free, live-music, food-drink, outdoors, arts, comedy, weather) and POST JSON to `PUBLIC_SIGNUP_ENDPOINT`.
- `/data/events.json` — public feed of all upcoming events + activities with flags/categories.
- `scripts/digest/build-digest.mjs` — `pickForSubscriber()` + `renderDigest()` produce subject, HTML and text for one subscriber (tested in `scripts/test/digest.test.mjs`).

**To build in V2**
1. Pick an email provider (Resend, Postmark, Buttondown, Mailchimp). Point `PUBLIC_SIGNUP_ENDPOINT` at it (or a tiny serverless function that stores subscribers).
2. Add double opt-in + unsubscribe links (`{{unsubscribe_url}}` placeholder is in the template).
3. Add a scheduled job (e.g. a GitHub Action at 6:30am PT) that loads subscribers, runs the digest builder per person, and sends.
4. Weather-aware intros: reuse `src/scripts/weather.js` logic server-side (Open-Meteo) to lead with rainy/hot/fog picks.
5. Sell the `email-feature` sponsor slot.
