const giveaways = require('./giveaways');

function markPrizePaid(row, staffId) {
  if (giveaways.markPrizePaid) return giveaways.markPrizePaid(row, staffId);
  const extra = giveaways.extraOf(row);
  extra.prizePaid = true;
  extra.prizePaidAt = new Date().toISOString();
  extra.prizePaidBy = staffId;
  row.extra_json = JSON.stringify(extra);
  giveaways.saveGiveaway(row);
  return giveaways.getGiveaway(row.id);
}

module.exports = { markPrizePaid };
