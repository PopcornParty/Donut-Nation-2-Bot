/**
 * Offline logic checks for payments, giveaways, and daily-run persistence.
 * Run: node src/logic-test.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = path.join(os.tmpdir(), `donut-test-${Date.now()}.db`);
process.env.DATABASE_PATH = tmp;
process.env.LOG_LEVEL = 'error';

const db = require('./db');
const payments = require('./systems/payments');
const giveaways = require('./systems/giveaways');
const builds = require('./systems/builds');
const prices = require('./systems/prices');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  db.initDatabase(tmp);
  const guildId = 'guild-1';
  db.getConfig(guildId);

  const payment = payments.createPayment({
    guildId,
    builderId: 'builder-1',
    builderTag: 'Builder',
    customerId: 'customer-1',
    customerTag: 'Customer',
    amount: 10000,
    builderIgn: 'BuilderIGN',
    customerIgn: 'CustomerIGN',
    createdBy: 'staff-1'
  });
  assert(payment.tax_amount === 2000, `Expected tax 2000, got ${payment.tax_amount}`);
  assert(payment.payout === 8000, `Expected payout 8000, got ${payment.payout}`);
  assert(payment.status === 'pending', 'New payment should be pending');

  payments.setPaymentStatus(payment.id, 'approved');
  let stats = payments.builderStats(guildId, 'builder-1');
  assert(stats.owed === 8000, `Expected owed 8000, got ${stats.owed}`);
  assert(stats.netEarnings === 8000, `Expected net 8000, got ${stats.netEarnings}`);

  payments.setPaymentStatus(payment.id, 'paid');
  stats = payments.builderStats(guildId, 'builder-1');
  assert(stats.owed === 0, `Expected owed 0 after paid, got ${stats.owed}`);
  assert(stats.alreadyPaid === 8000, `Expected paid 8000, got ${stats.alreadyPaid}`);

  const gw = giveaways.createGiveawayRecord({
    guildId,
    channelId: 'ch-1',
    prize: 'Donut stack',
    winnersCount: 1,
    hostId: 'host-1',
    hostName: 'Host',
    mode: 'standard',
    endsAt: new Date(Date.now() + 60_000).toISOString()
  });
  assert(giveaways.addEntry(gw.id, 'user-a'), 'first entry should work');
  assert(!giveaways.addEntry(gw.id, 'user-a'), 'duplicate entry should fail');
  giveaways.addEntry(gw.id, 'user-b');
  const winners = giveaways.pickWinners(giveaways.listEntries(gw.id), 1);
  assert(winners.length === 1, 'should pick one winner');
  gw.status = 'ended';
  gw.winners_json = JSON.stringify(winners);
  giveaways.saveGiveaway(gw);
  const claimed = giveaways.markClaimed(giveaways.getGiveaway(gw.id), winners[0]);
  assert(claimed.claimed === 1, 'claim should persist');
  assert(claimed.claimed_by === winners[0], 'claim user should match winner');

  db.updateConfig(guildId, {
    daily_giveaway_enabled: true,
    daily_giveaway_time: '21:00',
    daily_giveaway_prize: 'Daily donut',
    daily_giveaway_last_run: null
  });
  const before = db.getConfig(guildId);
  assert(before.daily_giveaway_enabled === true, 'daily should enable');
  db.updateConfig(guildId, { daily_giveaway_last_run: '2026-09-01' });
  const afterRestart = db.getConfig(guildId);
  assert(afterRestart.daily_giveaway_last_run === '2026-09-01', 'last_run must survive reload');
  assert(afterRestart.daily_giveaway_prize === 'Daily donut', 'daily prize must persist');

  const pay2 = payments.createPayment({
    guildId,
    builderId: 'builder-2',
    builderTag: 'Builder2',
    customerId: 'customer-2',
    customerTag: 'Customer2',
    amount: 10000,
    builderIgn: 'B2',
    customerIgn: 'C2',
    createdBy: 'staff-1'
  });
  const build = builds.createBuild({
    guildId,
    paymentId: pay2.id,
    builderId: 'builder-2',
    builderIgn: 'B2',
    customerId: 'customer-2',
    customerIgn: 'C2',
    description: 'Mega donut house',
    createdBy: 'builder-2'
  });
  assert(build.status === 'waiting_approval', 'new build waits for customer');
  const fakeClient = { channels: { fetch: async () => null } };
  const approved = await builds.approveBuild(fakeClient, build, 'customer-2');
  assert(approved.ok, 'customer approval should succeed');
  const payAfter = payments.getPayment(pay2.id);
  assert(payAfter.status === 'approved', 'linked payment should become approved');
  const stats2 = payments.builderStats(guildId, 'builder-2');
  assert(stats2.owed === 8000, `build approval should add owed 8000, got ${stats2.owed}`);

  const item = prices.addItem(guildId, 'Diamond', 1200, 950, 'staff-1');
  assert(item.order_price === 1200, 'order price stored');
  const updated = prices.updateItem(guildId, 'diamond', 1300, 900, 'staff-1');
  assert(updated.prev_order_price === 1200, 'previous order price kept');
  const hist = prices.history(guildId, 'Diamond', 5);
  assert(hist.rows.length === 2, 'price history should have two snapshots');

  console.log('All logic tests passed.');
  console.log(`Payment ${payment.id}: tax=${payment.tax_amount} payout=${payment.payout}`);
  console.log(`Giveaway ${gw.id}: winner=${winners[0]} claimed=${claimed.claimed_by}`);
}

run()
  .then(() => {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  })
  .catch((err) => {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    console.error(err);
    process.exit(1);
  });
