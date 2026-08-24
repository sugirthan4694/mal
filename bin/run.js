const { replay } = require('../src/engine');
const { ACCOUNTS, EVENTS } = require('../src/events');
const { printReport } = require('../src/report');

const result = replay(EVENTS, ACCOUNTS);
printReport(result);
