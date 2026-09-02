const { base, THEME } = require('../utils/embeds');
function showcaseEmbeds() {
  return [
    base('Donut Nation 2 Bot', THEME.pink).setDescription('Community bot for Donut Nation 2. It handles giveaways, builder payments, build approvals, staff roles, live DonutSMP stats, and auction prices.'),
    base('Who can use what', THEME.info).setDescription('**Everyone**\n`/help` `/showcase` `/price lookup` `/price list` `/stats` `/online` `/ah`\nJoin giveaways with the Join button.\n\n**Staff**\nGiveaways, builder payments, build tools, giveaway validate.\n\n**Admin / Moderator**\nEverything staff can do, plus `/dev` and config.\n\n**Dev**\nHighest access. Can use every command.'),
    base('Giveaways', THEME.gold).setDescription('1. Staff run `/giveaway create` with prize, time (`10m`, `2h`, `1d`), winners, and host.\n2. Members press Join.\n3. Winners get an ID like `GW-XXXX`.\n4. Winner opens a ticket and gives that ID.\n5. Staff run `/giveaway validate`. It shows winner, host, how long ago, and paid or not.\n6. Host pays the winner. Staff press **Mark Giveaway Paid**.\n7. Optional: `/payment create` type Giveaway with host, winner, and amount (`50m`). No tax. Press **Mark Payment Completed**.'),
    base('Builds and payments', THEME.gold).setDescription('`/build create` makes the build and a taxed builder payment together.\nCustomer pays the full price. Tax is taken. Builder gets the rest.\n`/payment create` type Build is the manual payment flow.\n`/payment complete` or the completed button marks it paid.\nGiveaway payments have no tax.'),
    base('Money format', THEME.info).setDescription('Type `50m`, `5.5m`, `200k`, or `1.2b`. The bot shows money the same way. 50000000 becomes 50m.'),
    base('Prices, stats, and AH', THEME.gold).setDescription('`/price lookup` and `/price list` are public buy/sell prices for skelys and spawners.\n`/stats player:` live player stats.\n`/online player:` online check.\n`/ah tracked` `/ah item` `/ah search` live auction data.\nSet `DONUTEASY_API_KEY` on Railway for live data.'),
    base('Staff setup', THEME.pink).setDescription('Dev, Admin, or Moderator run:\n`/dev admin` pick Admin or Moderator\n`/dev staff` pick Staff\n`/dev member` pick a real Member role, not @everyone\n`/dev role` create or give a role\nBot role must sit above the roles it assigns, and needs Manage Roles.')
  ];
}
module.exports = { showcaseEmbeds };
