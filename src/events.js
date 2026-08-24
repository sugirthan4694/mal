const ACCOUNTS = {
  'ACC-001': { currency: 'AED' },
  'ACC-002': { currency: 'BHD' },
};

const EVENTS = [
  { id: 'E1', day: 1, type: 'CREDIT', account: 'ACC-001', amount: '1200.00', valueDay: 1 },
  { id: 'E2', day: 1, type: 'DEBIT', account: 'ACC-001', amount: '950.00', valueDay: 1 },
  { id: 'E3', day: 2, type: 'AUTHORIZATION', account: 'ACC-001', authId: 'Auth-A', amount: '200.00', valueDay: 2 },
  { id: 'E4', day: 3, type: 'CREDIT', account: 'ACC-001', amount: '400.00', valueDay: 3 },
  { id: 'E5', day: 4, type: 'SETTLEMENT', account: 'ACC-001', authId: 'Auth-A', amount: '185.00', valueDay: 4 },
  { id: 'E6', day: 4, type: 'SETTLEMENT', account: 'ACC-001', authId: 'Auth-Z', amount: '180.00', valueDay: 4 },
  { id: 'E7', day: 5, type: 'DEBIT', account: 'ACC-001', amount: '620.00', valueDay: 2 },
  { id: 'E8', day: 5, type: 'AUTHORIZATION', account: 'ACC-001', authId: 'Auth-B', amount: '90.00', valueDay: 5 },
  { id: 'E9', day: 6, type: 'REVERSAL', account: 'ACC-001', reverses: 'E7', valueDay: 2 },
  { id: 'E10', day: 5, type: 'CREDIT', account: 'ACC-002', amount: '10.000', valueDay: 5, instalments: 3 },
];

module.exports = { ACCOUNTS, EVENTS };
