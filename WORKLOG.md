# Worklog

Rough notes on what got done today, in commit order.

---

**2026-08-24 11:46** — `3caa60a` Initial commit  
Kicked off the repo, added `.gitattributes`. Nothing else yet.

**2026-08-24 12:39** — `bdae973` money basic  
Wired up `package.json`, `currencies.js`, and `money.js` — integer minor units, round-half-up, AED/BHD decimals.

**2026-08-24 12:59** — `57025d4` events  
Dropped in the E1–E10 event stream and the `Account` class in `ledger.js` (postings, holds, balance queries).

**2026-08-24 14:08** — `b11f887` engine and report  
Built the replay engine, day-close logic, interest capitalization, CLI runner, and the six-day report output.

**2026-08-24 14:33** — `bab00ea` issue fix  
Fixed holds math — was adding holds instead of subtracting, and only ACTIVE holds should count against available balance. Also fixed opening balance valueDay.

**2026-08-24 14:47** — `05e5364` extra issue and test  
Corrected the event stream (E6–E10 were wrong), fixed a typo in `divRoundHalfUp`, added precision guard in `toMinor`, first round of engine/money/failing tests.

**2026-08-24 16:01** — `518dd37` more test  
Filled out the rest of the acceptance criteria tests — Auth-A settlement, Auth-Z rejection, Auth-B decline, E9/fee behaviour, BHD instalment split, AED interest sum.

**2026-08-24 17:05** — `1cda8be` readme files  
Wrote up README, AMBIGUITIES, REJECTED, and NUMBERS — mostly documenting the calls I made and which spec criteria I disagree with.
