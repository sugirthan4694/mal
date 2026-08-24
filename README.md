# Ledger core

An in-memory account ledger. No web layer, no database, no UI — a pure
in-process engine that replays a fixed event stream and prints a per-day
report. Node.js, no dependencies, no build step.

## Running it

Print the six-day report:

```
node bin/run.js
```

or

```
npm start
```

## Output

For each account, the report prints one block per day (Day 1 – Day 6):

- `closing ledger balance` — the account's balance after that day's
  transactions and, if one was assessed, that day's overdraft fee. This is
  the official, immutable closing figure for the day — it is never
  recalculated later even if a backdated entry arrives afterwards.
- `overdraft fee assessed` — only printed on a day the fee actually
  posted.
- `interest accrued (uncapitalized)` — that day's interest, computed but
  not yet paid out. It sits pending until Day 6.
- `authorization <id>: <STATE>` — printed on the day an authorization was
  created (`ACTIVE`/`DECLINED`) or settled (`SETTLED`), not on every day
  it happens to still exist.
- `error [<event id>]: <reason>` — an event that was rejected outright
  (e.g. a settlement against an authorization ID the ledger has never
  seen). Rejected events never post anything.
- On Day 6 only: `interest capitalized` (the single credit that pays out
  the sum of the six daily accruals) and the `final closing balance`
  after that credit.

## File structure

```
src/currencies.js   currency & constants
src/money.js        parsing, integer rounding
src/events.js       input stream
src/ledger.js       Account: post, holds, balance queries
src/engine.js       replay + day-close
src/report.js       report
bin/run.js          CLI entry
```