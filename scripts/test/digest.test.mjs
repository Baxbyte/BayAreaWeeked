import assert from 'node:assert/strict';
import test from 'node:test';
import { pickForSubscriber, renderDigest } from '../digest/build-digest.mjs';
import { normalize } from '../scrape/normalize.mjs';

test('digest picks match regions + interests and skip 21+ for kid-focused subscribers', () => {
  const now = new Date('2026-10-21T17:00:00Z');
  const mk = (t, city, extra = {}) => ({ ...normalize({ sourceId: 's', title: t, start: '2026-10-24T11:00', city, ...extra }), firstSeen: now.toISOString() });
  const items = [mk('Family Storytime', 'Oakland'), mk('Techno Rave 21+', 'Oakland'), mk('Kids Science Day', 'San Jose'), mk('Free Concert in the Park', 'Berkeley')];
  const picks = pickForSubscriber(items, { regions: ['east-bay'], interests: ['kids'] }, now);
  assert.deepEqual(picks.map((p) => p.title).sort(), ['Family Storytime', 'Free Concert in the Park']);
  const mail = renderDigest(picks, { regions: ['east-bay'] }, now);
  assert.match(mail.html, /Family Storytime/);
  assert.match(mail.subject, /more/);
});
