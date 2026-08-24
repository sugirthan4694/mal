const { WINDOW_DAYS } = require('./engine');

function printReport({ accounts, errors }) {
  for (const account of Object.values(accounts)) {
    console.log(`\n=== ${account.id} (${account.currency}) ===`);

    for (let day = 1; day <= WINDOW_DAYS; day++) {
      const closed = account.closedDays.get(day);
      console.log(`\nDay ${day}`);
      console.log(`  closing ledger balance: ${account.format(closed.balanceAfterFee)}`);
      if (closed.feeAssessed) {
        console.log(`  overdraft fee assessed: ${account.format(closed.feeMinor)}`);
      }
      if (closed.interestAccrualMinor > 0) {
        console.log(`  interest accrued (uncapitalized): ${account.format(closed.interestAccrualMinor)}`);
      }

      for (const holdEvent of account.holdEvents.filter((h) => h.day === day)) {
        console.log(`  authorization ${holdEvent.authId}: ${holdEvent.status}`);
      }

      for (const err of errors.filter((e) => e.day === day && e.account === account.id)) {
        console.log(`  error [${err.eventId}]: ${err.reason}`);
      }

      if (day === WINDOW_DAYS) {
        const capitalized = account.postings.find((p) => p.type === 'INTEREST');
        if (capitalized) {
          console.log(`  interest capitalized: ${account.format(capitalized.amountMinor)}`);
          console.log(`  final closing balance (post-capitalization): ${account.format(account.ledgerBalanceAsOf(WINDOW_DAYS))}`);
        }
      }
    }
  }
}

module.exports = { printReport };
