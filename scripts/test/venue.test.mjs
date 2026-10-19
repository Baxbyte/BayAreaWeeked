import test from 'node:test';
import assert from 'node:assert/strict';
import { isOutOfArea, isPlaceholderVenue } from '../../src/lib/venue.mjs';
import { normalize } from '../scrape/normalize.mjs';

test('placeholder and out-of-area venues', () => {
  for (const v of ['Sign in to download the location', 'TBA', 'See flyer for locations', null]) assert.equal(isPlaceholderVenue(v), true, v);
  for (const v of ['The Fillmore', 'Yoshi\'s Oakland', 'Secret Location (SF)']) assert.equal(isPlaceholderVenue(v), false, v);
  for (const v of ['Albuquerque, N.M.', 'Arrow, Okla.', 'Lahaina, Hawai‘i']) assert.equal(isOutOfArea(v), true, v);
  assert.equal(isOutOfArea('Oakland, CA'), false);
});

test('placeholder venue falls back to the source venue', () => {
  const base = { title: 'Club fair', start: '2030-05-01T18:00:00-07:00', city: 'San Jose', venueName: 'Sign in to download the location' };
  const campus = { name: 'San José State University', lat: 37.3352, lng: -121.8811 };
  const a = normalize(base, { venue: campus });
  assert.equal(a.venue.name, campus.name);
  assert.equal(a.venue.approx, false);
  assert.equal(normalize(base).venue.name, null);
  assert.equal(normalize({ ...base, venueName: 'Albuquerque, N.M.' }), null);
});
