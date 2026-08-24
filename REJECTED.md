# REJECTED.md

Of the 8 acceptance criteria, 4 are correct and 4 are wrong. This file
covers the wrong ones, with the arithmetic, and closes with approaches I
tried and abandoned while building this.

## Accepted flow

1. "Day 2 closing ledger balance, evaluated at end of Day 5, before any
   fee, is AED −370.00." — Correct. `1200.00 − 950.00 − 620.00 = −370.00`
   (E1, E2, E7; E3's hold doesn't touch ledger balance). Verified in
   `test/engine.test.js` against a point-in-time snapshot, not the fully
   replayed ledger — see [AMBIGUITIES.md](AMBIGUITIES.md) §2 for why that
   distinction matters.
3. "The Day 4 settlement of Auth-A must be accepted." — Correct. Auth-A
   exists (E3) and is still `ACTIVE` when E5 settles it.
4. "Any settlement referencing an unknown authorization ID must be
   rejected and funds must not leave the account." — Correct, and exactly
   what E6 (`Auth-Z`, never authorized) tests.
5. "If Auth-B is approved, its hold reduces available balance but not
   ledger balance." — Correct as a general statement of how holds work
   under this spec's own definition of available balance. Worth flagging:
   in this event stream Auth-B is never actually approved — by the time
   E8 arrives, E7 has already pushed the ledger balance to −155.00, so the
   hold is declined outright, before the antecedent of this "if" is ever
   true. The statement isn't wrong, it just describes a case that doesn't
   occur here.

## Rejected flow

### #2 — "E7 causes exactly one overdraft fee to be assessed, on Day 2."

**Half right.** E7 does cause exactly one fee. It is not assessed on
Day 2.

Day 2 closed back when only E1, E2, and E3 existed — closing balance
+250.00, no fee, interest accrued normally. That close is done; the spec
says events are never mutated, and a fee decision is exactly the kind of
thing that shouldn't get rewritten after the fact just because a
backdated entry showed up three days later. E7 is entered on Day 5, and
Day 5 is the first day-close that actually sees it: closing balance goes
to −155.00, and *that's* where the AED 25.00 fee posts, with
`value_date = Day 5`.

Full reasoning in [AMBIGUITIES.md](AMBIGUITIES.md) §2. Test:
`test/engine.test.js`, "E7 causes exactly one overdraft fee, but on Day 5,
not Day 2."

### #6 — "After E9, all balances and fees return to their pre-E7 values."

**Wrong**, and it's wrong about the part it's most confident about: fees.

E9 reverses E7 — it posts a +620.00 credit at `value_date` Day 2, which
exactly cancels E7 at every day's balance recompute from Day 2 onward.
The *ledger balance* genuinely does return to its pre-E7 shape.

The fee does not. It was assessed on Day 5, as a real, immutable posting
with its own `value_date`. E9 reverses E7 — it says nothing about the fee
that E7's dip triggered three events later. Reversing a transaction is not
the same operation as undoing everything that transaction caused
downstream; this ledger has no event type for the second thing (something
like an explicit fee waiver), and building one wasn't in scope.
`test/failing.test.js` encodes this exact claim (zero fees after E9,
matching the zero fees that existed before E7) and fails on purpose,
because there is in fact one fee posting that survives.

### #7 — "The three BHD instalments in E10 must each be BHD 3.334."

**Impossible, not just wrong.** `3.334 × 3 = 10.002`, not `10.000`. No
split of three instalments can be identical at 3 decimal places and still
sum to exactly `10.000`, since `10.000 / 3` doesn't terminate at 3dp. The
actual split is `3.333, 3.333, 3.334` (see
[NUMBERS.md](NUMBERS.md) for which instalment absorbs the remainder and
why). Test: `test/engine.test.js`, "the three BHD instalments are not all
3.334."

### #8 — "If the rounded daily interest accruals do not sum to the
capitalized total, the remainder is discarded."

**Contradicts the spec's own rule two paragraphs earlier**, which
requires the rounded daily accruals to sum *exactly* to the capitalized
total. Discarding a remainder is a way of *not* meeting that requirement
— it would mean real money (however small) vanishes from the ledger,
which is the one thing an append-only accounting system can't do.

In this implementation the situation this criterion worries about never
comes up: the capitalized total is computed as the sum of six
already-rounded integer accruals, not as one number that's rounded a
second time at the end. There is no leftover remainder to discard because
there's nothing left over — see [NUMBERS.md](NUMBERS.md) for the
construction. Test: `test/engine.test.js`, both "sum exactly to the
capitalized total" cases (AED and BHD).

## Approaches abandoned mid-build

**Floats for money.** First pass at `money.js` used plain JS numbers
(`0.04 / 100 * balance`, etc.) with `Math.round` at the end. Dropped it
almost immediately once I got to the "rounded daily accruals must sum
exactly to the capitalized total" requirement — `0.1 + 0.1 + 0.26` and
similar sums are exactly the kind of thing that silently drifts by a
fraction of a cent in floating point, and I didn't want to debug a
criterion-#8-shaped bug in my own code. Rewrote everything to integer
minor units before writing a single test.

**Sorting the event stream by `Day` before replay.** Briefly considered
normalizing the input by sorting on the `Day` field so E10 would run
before E9, on the theory that it would make the per-account day-close loop
simpler to write (strictly increasing days, no need to think about
cross-account interleaving at all). Abandoned it once I reread "replayed
in this order" as a deliberate constraint, not an accident of how the
events happened to be listed — see [AMBIGUITIES.md](AMBIGUITIES.md) §1.
Sorting would have quietly answered an ambiguity the spec probably meant
to test, rather than making a defensible call about it.

**One global day-close loop instead of one per account.** First attempt
had a single `for day in 1..6` loop that closed both accounts on the same
pass. Abandoned it when I hit the E7/Day-2 timing question (#2 above): a
single global loop makes it awkward to express "close this account's Day 2
before this account has even seen E7," because the loop is walking
calendar days, not each account's own event history. Splitting day-close
into a per-account replay (`replayAccount` in `src/engine.js`) made the
forward-only close timing fall out naturally instead of needing special
casing.
