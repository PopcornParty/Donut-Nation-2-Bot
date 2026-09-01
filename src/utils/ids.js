const crypto = require('crypto');

function randomPart(length = 6) {
  return crypto.randomBytes(8).toString('hex').slice(0, length).toUpperCase();
}

function makeId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}${randomPart(4)}`;
}

module.exports = {
  giveawayId: () => makeId('GW'),
  paymentId: () => makeId('PAY'),
  buildId: () => makeId('BLD'),
  claimId: () => makeId('CLM'),
  logId: () => makeId('LOG')
};
