# AMBIGUITIES.md

Ambiguities found in the spec, and how I resolved each one. These are the
decisions that actually shaped the design — not typos, genuine
underspecification.

## 1. Replay order vs. the "Day" label on each event

The spec says events are "replayed in this order" and then lists E1..E10
with a `Day` column. That column is non-decreasing for every event
*except* E10, which is tagged Day 5 but appears after E9, tagged Day 6.

I read "replayed in this order" literally: process E1 through E10 in the
exact sequence given, and treat each event's `Day` field as metadata (which
day it was recorded on, for reporting and day-close purposes) rather than
a sort key. I did **not** re-sort the stream by `Day` before replaying it.

This only matters at all because E10 touches a completely different
account (ACC-002) than every other event (ACC-001). Since day-close is
implemented per account (see `replayAccount` in `src/engine.js`), and
ACC-002's *own* event sequence (just E10) is trivially in day order, the
global list's apparent out-of-order tail has no effect on correctness. If
a future event stream had two events for the *same* account with
non-monotonic `Day` values, this design would need a real decision — right
now it's untested territory and I didn't build for it.

## 2. Does a backdated entry reopen a day that already closed?

This is the one that actually decides where E7's overdraft fee lands, and
it's the crux of [REJECTED.md](REJECTED.md)'s #2.

E7 is entered on Day 5 but carries `value_date` Day 2. By the time E7
arrives, Day 2 has already closed — its fee decision (none, balance was
+250.00) and its interest accrual (AED 0.10) are already booked into
`closedDays` and `dailyAccrual`.

Two readings are defensible:

- **(a) Retroactive:** re-open Day 2, recompute its closing balance with
  E7 included, and assess the fee *there*, backdated.
- **(b) Forward-only:** Day 2's close is final the moment it happens.
  E7 lands in the ledger later and is picked up by the *next* day-close
  that hasn't happened yet — Day 5's.

I went with (b). The requirement states the ledger is "append-only" and
"no event record is ever mutated or deleted." A fee decision that gets
silently rewritten three days after the fact because new information
arrived is, functionally, a mutation of history — it changes what account
holders were told on Day 2 into something that turns out to have been
false. (a) would also require deciding whether interest already paid out
on the old (wrong) Day 2 balance gets clawed back, which the spec never
addresses. (b) requires no such reconciliation: Day 2's close stands, and
Day 5's close — which hasn't happened yet when E7 arrives — is where the
negative balance actually gets caught and fee'd.

The engine still supports asking "what would Day 2 recompute to *right
now*, with everything posted so far" — that's `ledgerBalanceAsOf(2)` — and
it correctly returns −370.00 once E7 exists. That's a read-only query, not
a mutation, and it's how `test/engine.test.js` verifies the accepted
"−370.00" criterion without contradicting the forward-only fee timing.

## 3. What does "ledger balance" mean for a real-time authorization check?

The spec defines closing balance as "all entries with value_date ≤ that
day." For a same-day authorization check (is there enough available
balance right now?), "that day" naturally means "the day the
authorization event happens" — so `availableBalanceAsOf(event.valueDay)`
in `src/engine.js`.

This dataset never actually distinguishes this choice from the alternative
(total of all postings booked so far, regardless of value date) because no
posting here has a value_date in the future relative to when it's entered.
I picked the value_date-filtered definition anyway, for consistency with
every other balance calculation in the system — there's exactly one
definition of "the ledger balance as of day N" used everywhere (day-close,
authorization checks, recompute queries), not two.

## 4. Settlement amount vs. hold amount

E5 settles Auth-A (a 200.00 hold) for 185.00 — less than the hold. I
allowed this: the settlement posts the actual amount (185.00 debit) and
releases the *entire* hold, regardless of the gap between what was held
and what was charged. Real card-present authorizations behave exactly
like this (fuel pumps, hotels, car rentals routinely settle for less, and
sometimes more, than the estimated hold). The spec never states a
tolerance or a rule for settling above the hold amount, so I didn't invent
one — the engine accepts any settlement amount against an ACTIVE hold.

## 5. Double-settlement / settling a non-active hold

Not exercised by the given event stream, but the code guards it anyway:
`SETTLEMENT` is rejected if the referenced hold is missing *or* not
`ACTIVE` (already `SETTLED` or `DECLINED`). This wasn't in the spec
explicitly, but "an authorization is approved only if ... " combined with
append-only, no-mutation semantics implied to me that a hold, once
resolved, cannot be resolved a second time. I chose to make this an error
event, symmetric with the unknown-authorization case, rather than silently
ignoring a second settlement attempt.

## 6. Zero balance and interest

"Positive balances only" — I read `0.00` as not positive, so it accrues
no interest. This matters for ACC-002's Days 1–4, which sit at the BHD
opening balance of `0.000` before E10 lands on Day 5.

## 7. Fee amount for a currency other than AED

The spec only prices the overdraft fee in AED. `OVERDRAFT_FEE_MINOR` in
`src/currencies.js` has no BHD entry on purpose. Nothing in this event
stream drives ACC-002 negative, so it's never exercised, but I chose to
make `closeDay` throw rather than reuse the AED figure, silently convert
it, or default to zero — all three would be guessing at a number the spec
never gave me.

## 8. Reversal's value_date

E9's definition explicitly states `value_date Day 2` — the same value date
as the E7 posting it reverses. I used the value_date given on the
reversal event itself rather than assuming "a reversal always inherits its
target's value_date" as a general rule. In this case they happen to
coincide, which is what makes the reversal net out to zero at every day's
recompute from Day 2 onward. Had the spec given E9 a different value_date,
I'd have used that instead and the reversal would *not* fully cancel E7 at
every historical day — I did not build in an assumption that reversals
must match their target's value_date, because the spec didn't state one.
