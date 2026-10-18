import test from 'node:test';
import assert from 'node:assert/strict';
import { tidyPrice } from '../../src/lib/price.mjs';

test('price labels stay readable', () => {
  assert.equal(tidyPrice('$185.24–$15459.95', 185.24, 15459.95), 'From $185.24');
  assert.equal(tidyPrice('$20 adv / $25 door', 20, 25), '$20 adv / $25 door');
  assert.equal(tidyPrice(null, 15, 40), '$15–$40');
  assert.equal(tidyPrice(null, 0, 0), 'Free');
  assert.equal(tidyPrice(null, null, null), null);
});
