# Sponsored placements, bids & deals

1. Organizers submit bids on `/advertise/` (posted to `PUBLIC_SPONSOR_ENDPOINT`, or emailed to `PUBLIC_CONTACT_EMAIL`).
2. You review, invoice, and add a campaign to `data/sponsors.json → campaigns` (copy the example in `data/sponsors.example.json`).
3. The next build places it: highest active `bid` wins each slot (`maxWinners` per slot), filtered by `match.regions / cities / categories / vibes`.
4. Campaigns start/stop automatically using `start` / `end` (Pacific dates).

Sponsored listings always show “★ Sponsored” + a gold outline, appear first in lists and on the map (gold pin), and their `deal` shows on cards, the event page and `/deals/`. The public **bid board** on `/advertise/` shows the floor and current top bid per slot.

Slots: `home-spotlight`, `weekend-top`, `region-top`, `vibe-top`, `category-top`, `explore-pin`, `deals-feature`, `email-feature` (V2).
