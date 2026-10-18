import assert from 'node:assert/strict';
import test from 'node:test';
import { clean, isExplicit } from '../../src/lib/policy.mjs';
import { normalize } from '../scrape/normalize.mjs';

test('explicit events are dropped entirely', () => {
  for (const t of ['Fetish Night at The Club', 'XXX Party', 'Strip Club Saturdays', 'Lingerie Fashion Show', 'Folsom Street Fair 2026', 'Nude Yoga']) {
    assert.equal(isExplicit(t), true, t);
    assert.equal(normalize({ sourceId: 's', title: t, start: '2026-10-24T20:00', city: 'San Francisco' }), null, t);
  }
  assert.equal(normalize({ sourceId: 's', title: 'Jazz Night', description: 'An erotic evening of …', start: '2026-10-24T20:00', city: 'San Francisco' }), null);
});

test('ordinary events pass', () => {
  for (const t of ['Toddler Storytime', 'Drag Queen Bingo', 'Techno Warehouse Party 21+', 'Wine Tasting', 'Sussex Street Fair']) assert.equal(isExplicit(t), false, t);
});

test('profanity is masked in titles and descriptions', () => {
  assert.equal(clean('Your Fucked Up Relationship'), 'Your F***** Up Relationship');
  assert.equal(clean('Holy shit comedy'), 'Holy s*** comedy');
  assert.equal(clean('Classic Rock'), 'Classic Rock');
  const e = normalize({ sourceId: 's', title: 'Bitch Please Comedy Show', description: 'damn good laughs', start: '2026-10-24T20:00', city: 'Oakland' });
  assert.equal(e.title, 'B**** Please Comedy Show');
  assert.equal(e.description, 'd*** good laughs');
});
