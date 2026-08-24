# NUMBERS.md

Every constant in this codebase, split into two groups: values the spec
handed me directly (nothing to justify, just cite the source), and values
I had to pick myself because the spec was silent. The second group is
where "why this and not half of it" actually applies.

| Constant | Value | Where |
|---|---|---|
| Overdraft fee | AED 25.00, flat, per account per day | `OVERDRAFT_FEE_MINOR.AED = 2500` in `src/currencies.js` |
| Daily interest rate | 0.04% of closing balance, positive only | `DAILY_INTEREST_BPS_NUM/DEN = 4/10000` in `src/currencies.js` |
| AED precision | 2 decimal places | `DECIMALS.AED = 2` |
| BHD precision | 3 decimal places | `DECIMALS.BHD = 3` |
| Window length | 6 days | `WINDOW_DAYS = 6` in `src/engine.js` |


## Usecase, and why

**Rounding mode: round-half-up, on integers only.**
`divRoundHalfUp` in `src/money.js` never touches a JS float for money math
— every amount is an integer count of the currency's smallest unit (fils
for AED, fils for BHD — yes, both currencies happen to call their minor
unit "fils", that's a coincidence, not a bug). Interest is computed as
`(balance * 4) / 10000` via integer floor + remainder comparison, so
`0.186...` always resolves to exactly `19` (fils/cents), never `18.999999`
or `19.000001`. I picked round-half-up over round-half-even (banker's
rounding) because the spec doesn't mention statistical bias avoidance
anywhere, and round-half-up is the simpler rule to explain and verify by
hand — there's no requirement here that would justify the extra
complexity of round-half-even.

**Why summing daily accruals never needs a reconciling remainder.**
The capitalized Day 6 interest credit is *not* computed as one shot over
the whole 6-day balance history. It's the sum of six already-rounded daily
integers (`account.dailyAccrual` in `src/engine.js`). Since each day's
accrual is rounded to the currency's minor unit before being stored, and
the total is just an integer sum of integers, the total is *automatically*
exactly equal to the sum of the parts — there's no floating-point total to
round down again and no remainder to discard. This is why
[REJECTED.md](REJECTED.md)'s criterion #8 ("the remainder is discarded")
doesn't apply here: there is no remainder, by construction, not because
one was silently dropped.

**BHD instalment split: largest-remainder to the last instalment.**
`10.000 / 3` doesn't divide evenly at 3dp (`3333.33...` fils). I split as
`floor(total / n)` for the first `n - 1` instalments, and gave whatever's
left (`total - base*(n-1)`) to the last one: `3.333, 3.333, 3.334`. I put
the remainder on the *last* instalment rather than the first because that
was the simpler rule to state and code (`base` repeated `n-1` times, then
one final adjusted line), not because of any accounting principle — a
system that back-dates instalments or needs them all reported up front
might reasonably want the remainder on the *first* one instead. Either
choice sums exactly to `10.000`; I just needed to pick one and be
consistent, which is why [REJECTED.md](REJECTED.md) throws out the "all
three are 3.334" criterion — no valid split can make all three equal at
this precision and still sum to the total.

**Fee currency table has exactly one entry.**
`OVERDRAFT_FEE_MINOR` only defines `AED`. If a BHD account ever went
negative, `closeDay` throws rather than guessing a fee amount for a
currency the spec never priced. See [AMBIGUITIES.md](AMBIGUITIES.md) for
why I didn't invent a BHD fee number.
