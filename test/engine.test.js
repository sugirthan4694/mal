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

test('accepted criterion: the Day 4 settlement of Auth-A is accepted', () => {
  const { accounts, errors } = run();
  const acc = accounts['ACC-001'];
  assert.equal(acc.holds.get('Auth-A').status, 'SETTLED');
  assert.equal(errors.some((e) => e.eventId === 'E5'), false);
  const settlement = acc.postings.find((p) => p.ref === 'E5');
  assert.equal(settlement.amountMinor, -18500);
});

test('accepted criterion: settlement against an unknown authorization is rejected and moves no funds', () => {
  const { accounts, errors } = run();
  const acc = accounts['ACC-001'];
  assert.ok(errors.some((e) => e.eventId === 'E6'));
  assert.equal(acc.postings.some((p) => p.ref === 'E6'), false);
});

test('Auth-B is declined: the backdated E7 debit already leaves available balance negative', () => {
  const { accounts } = run();
  const hold = accounts['ACC-001'].holds.get('Auth-B');
  assert.equal(hold.status, 'DECLINED');
});

test('rejected criterion: E9 undoes the E7 posting, but not the fee it triggered', () => {
  const { accounts } = run();
  const acc = accounts['ACC-001'];
  const feePostings = acc.postings.filter((p) => p.type === 'FEE');
  assert.equal(feePostings.length, 1);
  const reversal = acc.postings.find((p) => p.type === 'REVERSAL');
  assert.equal(reversal.amountMinor, 62000);
  assert.equal(reversal.valueDay, 2);
});

test('rejected criterion: the three BHD instalments are not all 3.334 — they sum exactly to 10.000', () => {
  const { accounts } = run();
  const acc = accounts['ACC-002'];
  const instalments = acc.postings.filter((p) => p.type === 'CREDIT');
  assert.equal(instalments.length, 3);
  const amounts = instalments.map((p) => p.amountMinor).sort((a, b) => a - b);
  assert.deepEqual(amounts, [3333, 3333, 3334]);
  assert.equal(amounts.reduce((a, b) => a + b, 0), 10000);
});

test('accepted rule: rounded daily interest accruals sum exactly to the capitalized total (AED)', () => {
  const { accounts } = run();
  const acc = accounts['ACC-001'];
  let sumOfDailyAccruals = 0;
  for (let d = 1; d <= 6; d++) sumOfDailyAccruals += acc.dailyAccrual.get(d);
  const capitalized = acc.postings.find((p) => p.type === 'INTEREST');
  assert.equal(sumOfDailyAccruals, capitalized.amountMinor);
  assert.equal(capitalized.amountMinor, 83);
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
