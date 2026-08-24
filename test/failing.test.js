const test = require('node:test');
const assert = require('node:assert/strict');
const { replay } = require('../src/engine');
const { ACCOUNTS, EVENTS } = require('../src/events');

test('claim under test: after E9, ACC-001 has zero overdraft fees (same as before E7)', () => {
  const { accounts } = replay(EVENTS, ACCOUNTS);
  const feeCount = accounts['ACC-001'].postings.filter((p) => p.type === 'FEE').length;
  assert.equal(feeCount, 0);
});
