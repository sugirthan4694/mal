const test = require('node:test');
const assert = require('node:assert/strict');
const { toMinor, formatMinor, divRoundHalfUp } = require('../src/money');

test('toMinor parses AED (2dp) into fils-free cents', () => {
  assert.equal(toMinor('1200.00', 'AED'), 120000);
  assert.equal(toMinor('950.00', 'AED'), 95000);
  assert.equal(toMinor('0', 'AED'), 0);
});

test('toMinor parses BHD (3dp)', () => {
  assert.equal(toMinor('10.000', 'BHD'), 10000);
  assert.equal(toMinor('0.000', 'BHD'), 0);
});

test('toMinor rejects more precision than the currency allows', () => {
  assert.throws(() => toMinor('1.005', 'AED'));
});
