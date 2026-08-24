const test = require('node:test');
const assert = require('node:assert/strict');
const { replay } = require('../src/engine');
const { ACCOUNTS, EVENTS } = require('../src/events');

function run() {
  return replay(EVENTS, ACCOUNTS);
}

test('accepted criterion: Day 2 balance recomputed at end of Day 5, before the Day 5 fee, is AED -370.00', () => {
  const { accounts } = run();
  const acc = accounts['ACC-001'];
  const atDay5Close = acc.recomputeLog.find((s) => s.atCloseOfDay === 5);
  assert.equal(atDay5Close.balances[2], -37000);
});

test('the historical Day 2 close is untouched by the later backdated entry', () => {
  const { accounts } = run();
  const closed = accounts['ACC-001'].closedDays.get(2);
  assert.equal(closed.balanceAfterFee, 25000);
  assert.equal(closed.feeAssessed, false);
});

test('rejected criterion: E7 causes exactly one overdraft fee, but on Day 5, not Day 2', () => {
  const { accounts } = run();
  const acc = accounts['ACC-001'];
  assert.equal(acc.closedDays.get(2).feeAssessed, false);
  assert.equal(acc.closedDays.get(5).feeAssessed, true);
  assert.equal(acc.closedDays.get(5).feeMinor, 2500);
  const feePostings = acc.postings.filter((p) => p.type === 'FEE');
  assert.equal(feePostings.length, 1);
});

test('accepted rule: rounded daily interest accruals sum exactly to the capitalized total (BHD)', () => {
  const { accounts } = run();
  const acc = accounts['ACC-002'];
  let sumOfDailyAccruals = 0;
  for (let d = 1; d <= 6; d++) sumOfDailyAccruals += acc.dailyAccrual.get(d);
  const capitalized = acc.postings.find((p) => p.type === 'INTEREST');
  assert.equal(sumOfDailyAccruals, capitalized.amountMinor);
  assert.equal(capitalized.amountMinor, 8);
});

test('final closing balances after capitalization', () => {
  const { accounts } = run();
  assert.equal(accounts['ACC-001'].ledgerBalanceAsOf(6), 44083);
  assert.equal(accounts['ACC-002'].ledgerBalanceAsOf(6), 10008);
});
