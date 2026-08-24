const { Account } = require('./ledger');
const { toMinor, divRoundHalfUp } = require('./money');
const { OVERDRAFT_FEE_MINOR } = require('./currencies');

const WINDOW_DAYS = 6;

function snapshotRecompute(account, atCloseOfDay) {
  const balances = {};
  for (let d = 1; d <= WINDOW_DAYS; d++) balances[d] = account.ledgerBalanceAsOf(d);
  account.recomputeLog.push({ atCloseOfDay, balances });
}

function closeDay(account, day) {
  snapshotRecompute(account, day);
  const balanceBeforeFee = account.ledgerBalanceAsOf(day);
  let feeAssessed = false;
  let feeMinor = 0;

  if (balanceBeforeFee < 0) {
    feeMinor = OVERDRAFT_FEE_MINOR[account.currency];
    if (feeMinor === undefined) {
      throw new Error(`No overdraft fee defined for currency ${account.currency}`);
    }
    account.post('FEE', -feeMinor, day, day, `overdraft-fee-day-${day}`);
    feeAssessed = true;
  }

  const balanceAfterFee = account.ledgerBalanceAsOf(day);
  let interestAccrualMinor = 0;
  if (balanceAfterFee > 0) {
    interestAccrualMinor = divRoundHalfUp(balanceAfterFee * 4, 10000);
  }
  account.dailyAccrual.set(day, interestAccrualMinor);

  account.closedDays.set(day, {
    day,
    balanceBeforeFee,
    feeAssessed,
    feeMinor: feeAssessed ? feeMinor : 0,
    balanceAfterFee,
    interestAccrualMinor,
  });
}

function capitalizeInterest(account) {
  let total = 0;
  for (let d = 1; d <= WINDOW_DAYS; d++) {
    total += account.dailyAccrual.get(d) || 0;
  }
  if (total > 0) {
    account.post('INTEREST', total, WINDOW_DAYS, WINDOW_DAYS, 'capitalized-interest');
  }
  return total;
}

function processEvent(event, accounts, errors) {
  const account = accounts[event.account];

  if (event.type === 'CREDIT' || event.type === 'DEBIT') {
    const sign = event.type === 'CREDIT' ? 1 : -1;
    if (event.instalments && event.instalments > 1) {
      const totalMinor = toMinor(event.amount, account.currency);
      const base = Math.floor(totalMinor / event.instalments);
      const remainder = totalMinor - base * event.instalments;
      for (let i = 0; i < event.instalments; i++) {
        const isLast = i === event.instalments - 1;
        const amount = isLast ? base + remainder : base;
        account.post(event.type, sign * amount, event.valueDay, event.day, `${event.id}-instalment-${i + 1}`);
      }
    } else {
      const amountMinor = toMinor(event.amount, account.currency);
      account.post(event.type, sign * amountMinor, event.valueDay, event.day, event.id);
    }
    return;
  }

  if (event.type === 'AUTHORIZATION') {
    const amountMinor = toMinor(event.amount, account.currency);
    const availableAfterHold = account.availableBalanceAsOf(event.valueDay) - amountMinor;
    const approved = availableAfterHold >= 0;
    const status = approved ? 'ACTIVE' : 'DECLINED';
    account.holds.set(event.authId, {
      authId: event.authId,
      amountMinor,
      status,
      createdEvent: event.id,
      createdDay: event.day,
    });
    account.holdEvents.push({ day: event.day, authId: event.authId, status });
    return;
  }

  if (event.type === 'SETTLEMENT') {
    const hold = account.holds.get(event.authId);
    if (!hold || hold.status !== 'ACTIVE') {
      errors.push({
        eventId: event.id,
        day: event.day,
        account: event.account,
        reason: hold
          ? `Settlement rejected: authorization ${event.authId} is not active (status=${hold.status})`
          : `Settlement rejected: unknown authorization ${event.authId}`,
      });
      return;
    }
    const amountMinor = toMinor(event.amount, account.currency);
    account.post('SETTLEMENT', -amountMinor, event.valueDay, event.day, event.id);
    hold.status = 'SETTLED';
    hold.settledEvent = event.id;
    hold.settledDay = event.day;
    account.holdEvents.push({ day: event.day, authId: event.authId, status: 'SETTLED' });
    return;
  }

  if (event.type === 'REVERSAL') {
    const original = account.postings.find((p) => p.ref === event.reverses);
    if (!original) {
      errors.push({ eventId: event.id, day: event.day, account: event.account, reason: `Reversal rejected: original entry ${event.reverses} not found` });
      return;
    }
    account.post('REVERSAL', -original.amountMinor, event.valueDay, event.day, `${event.id}-reverses-${event.reverses}`);
    return;
  }

  throw new Error(`Unknown event type: ${event.type}`);
}

function replayAccount(accountEvents, account, errors) {
  let openDay = null;

  for (const event of accountEvents) {
    if (openDay === null) {
      for (let d = 1; d < event.day; d++) closeDay(account, d);
      openDay = event.day;
    } else if (event.day > openDay) {
      closeDay(account, openDay);
      for (let d = openDay + 1; d < event.day; d++) closeDay(account, d);
      openDay = event.day;
    }
    processEvent(event, { [event.account]: account }, errors);
  }

  if (openDay === null) openDay = 1;
  for (let d = openDay; d <= WINDOW_DAYS; d++) {
    if (!account.closedDays.has(d)) closeDay(account, d);
  }

  capitalizeInterest(account);
}

function replay(events, accountsConfig) {
  const accounts = {};
  for (const [id, cfg] of Object.entries(accountsConfig)) {
    accounts[id] = new Account(id, cfg.currency, cfg.openingBalance);
  }

  const errors = [];
  const byAccount = new Map(Object.keys(accounts).map((id) => [id, []]));
  for (const event of events) {
    byAccount.get(event.account).push(event);
  }

  for (const [id, account] of Object.entries(accounts)) {
    replayAccount(byAccount.get(id), account, errors);
  }

  return { accounts, errors };
}

module.exports = { replay, closeDay, capitalizeInterest, WINDOW_DAYS };
