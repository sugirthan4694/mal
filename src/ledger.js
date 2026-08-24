const { toMinor, formatMinor } = require('./money');

class Account {
  constructor(id, currency, openingBalance = '0') {
    this.id = id;
    this.currency = currency;
    this.postings = [];
    this.holds = new Map();
    this.holdEvents = [];
    this.dailyAccrual = new Map();
    this.closedDays = new Map();
    this.recomputeLog = [];

    const opening = toMinor(openingBalance, currency);
    if (opening !== 0) {
      this.postings.push({ type: 'OPENING', amountMinor: opening, valueDay: 0, bookedDay: 0, ref: 'opening' });
    }
  }

  post(type, amountMinor, valueDay, bookedDay, ref) {
    const posting = { type, amountMinor, valueDay, bookedDay, ref };
    this.postings.push(posting);
    return posting;
  }

  ledgerBalanceAsOf(day) {
    return this.postings.reduce((sum, p) => (p.valueDay <= day ? sum + p.amountMinor : sum), 0);
  }

  activeHoldsTotal() {
    let total = 0;
    for (const hold of this.holds.values()) {
      if (hold.status === 'ACTIVE') total += hold.amountMinor;
    }
    return total;
  }

  availableBalanceAsOf(day) {
    return this.ledgerBalanceAsOf(day) - this.activeHoldsTotal();
  }

  format(minor) {
    return formatMinor(minor, this.currency);
  }
}

module.exports = { Account };
