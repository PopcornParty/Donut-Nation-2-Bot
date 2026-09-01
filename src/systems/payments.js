const { getDb, nowIso, logEvent, getConfig, ensureUser } = require('../db');
const { paymentId } = require('../utils/ids');
const { formatMoney } = require('../utils/parse');
const { base, THEME, statusEmoji } = require('../utils/embeds');
const logger = require('../utils/logger');

function calcSplit(amount, taxPercent) {
  const tax = Math.round(amount * (taxPercent / 100) * 100) / 100;
  const payout = Math.round((amount - tax) * 100) / 100;
  return { tax, payout };
}

function getPayment(id) {
  return getDb().prepare('SELECT * FROM payments WHERE id = ?').get(id);
}

function upsertBuilder(guildId, discordId, ign) {
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO builders (guild_id, discord_id, ign, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, discord_id) DO UPDATE SET
         ign = COALESCE(excluded.ign, builders.ign),
         updated_at = excluded.updated_at`
    )
    .run(guildId, discordId, ign || null, ts);
}

function createPayment(data) {
  const cfg = getConfig(data.guildId);
  const taxPercent = Number(cfg.tax_percent ?? 20);
  const { tax, payout } = calcSplit(data.amount, taxPercent);
  const id = paymentId();
  const ts = nowIso();
  ensureUser({ id: data.builderId, username: data.builderTag });
  ensureUser({ id: data.customerId, username: data.customerTag });
  upsertBuilder(data.guildId, data.builderId, data.builderIgn);

  getDb()
    .prepare(
      `INSERT INTO payments
        (id, guild_id, builder_id, builder_ign, customer_id, customer_ign, amount, tax_percent,
         tax_amount, payout, order_id, notes, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .run(
      id,
      data.guildId,
      data.builderId,
      data.builderIgn || null,
      data.customerId,
      data.customerIgn || null,
      data.amount,
      taxPercent,
      tax,
      payout,
      data.orderId || null,
      data.notes || null,
      data.createdBy,
      ts,
      ts
    );

  logEvent({
    guildId: data.guildId,
    category: 'payment',
    message: `Payment ${id} created for ${formatMoney(data.amount)}`,
    actorId: data.createdBy,
    extra: { builderId: data.builderId, customerId: data.customerId }
  });
  logger.info(`Payment ${id} created`);
  return getPayment(id);
}

function setPaymentStatus(id, status) {
  const allowed = ['pending', 'approved', 'paid', 'cancelled'];
  if (!allowed.includes(status)) throw new Error('Invalid payment status');
  const previous = getPayment(id);
  if (!previous) return null;
  if (previous.status === status) return previous;
  getDb()
    .prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowIso(), id);
  const row = getPayment(id);
  if (row && status === 'paid' && previous.status !== 'paid') {
    applyPaidToBuilder(row);
  }
  logEvent({
    guildId: row?.guild_id,
    category: 'payment',
    message: `Payment ${id} status → ${status}`
  });
  return row;
}

function applyApprovedEarnings(payment) {
  upsertBuilder(payment.guild_id, payment.builder_id, payment.builder_ign);
  getDb()
    .prepare(
      `UPDATE builders
       SET total_earned = total_earned + ?, total_tax = total_tax + ?, updated_at = ?
       WHERE guild_id = ? AND discord_id = ?`
    )
    .run(payment.payout, payment.tax_amount, nowIso(), payment.guild_id, payment.builder_id);
}

function applyPaidToBuilder(payment) {
  upsertBuilder(payment.guild_id, payment.builder_id, payment.builder_ign);
  getDb()
    .prepare(
      `UPDATE builders
       SET total_paid = total_paid + ?, updated_at = ?
       WHERE guild_id = ? AND discord_id = ?`
    )
    .run(payment.payout, nowIso(), payment.guild_id, payment.builder_id);
}

function builderStats(guildId, discordId) {
  upsertBuilder(guildId, discordId, null);
  const builder = getDb()
    .prepare('SELECT * FROM builders WHERE guild_id = ? AND discord_id = ?')
    .get(guildId, discordId);
  const owedRow = getDb()
    .prepare(
      `SELECT COALESCE(SUM(payout), 0) AS owed
       FROM payments
       WHERE guild_id = ? AND builder_id = ? AND status IN ('approved')`
    )
    .get(guildId, discordId);
  const totals = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('approved','paid') THEN amount ELSE 0 END), 0) AS completed_amount,
         COALESCE(SUM(CASE WHEN status IN ('approved','paid') THEN tax_amount ELSE 0 END), 0) AS completed_tax,
         COALESCE(SUM(CASE WHEN status IN ('approved','paid') THEN payout ELSE 0 END), 0) AS completed_payout,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN payout ELSE 0 END), 0) AS already_paid
       FROM payments
       WHERE guild_id = ? AND builder_id = ?`
    )
    .get(guildId, discordId);
  return {
    builder,
    completedAmount: totals.completed_amount,
    completedTax: totals.completed_tax,
    netEarnings: totals.completed_payout,
    alreadyPaid: totals.already_paid,
    owed: owedRow.owed
  };
}

function paymentEmbed(row, title = '💳 Payment') {
  return base(title, THEME.gold)
    .addFields(
      { name: 'Payment ID', value: '`' + row.id + '`', inline: true },
      { name: 'Status', value: `${statusEmoji(row.status)} ${row.status}`, inline: true },
      { name: 'Order ID', value: row.order_id || '—', inline: true },
      { name: 'Builder', value: `<@${row.builder_id}>\nIGN: ${row.builder_ign || '—'}`, inline: true },
      { name: 'Customer', value: `<@${row.customer_id}>\nIGN: ${row.customer_ign || '—'}`, inline: true },
      { name: 'Created by', value: `<@${row.created_by}>`, inline: true },
      { name: 'Customer pays', value: formatMoney(row.amount), inline: true },
      { name: `${row.tax_percent}% tax`, value: formatMoney(row.tax_amount), inline: true },
      { name: 'Builder receives', value: formatMoney(row.payout), inline: true }
    )
    .setDescription(row.notes || null);
}

async function sendPaymentLog(client, row) {
  const cfg = getConfig(row.guild_id);
  if (!cfg.payment_log_channel_id) return;
  const channel = await client.channels.fetch(cfg.payment_log_channel_id).catch(() => null);
  if (!channel) return;
  const msg = await channel.send({ embeds: [paymentEmbed(row, '📒 Payment log')] });
  getDb().prepare('UPDATE payments SET log_message_id = ? WHERE id = ?').run(msg.id, row.id);
}

function listPayments(guildId, { builderId, limit = 10 } = {}) {
  if (builderId) {
    return getDb()
      .prepare('SELECT * FROM payments WHERE guild_id = ? AND builder_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(guildId, builderId, limit);
  }
  return getDb()
    .prepare('SELECT * FROM payments WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit);
}

module.exports = {
  calcSplit,
  getPayment,
  createPayment,
  setPaymentStatus,
  applyApprovedEarnings,
  builderStats,
  paymentEmbed,
  sendPaymentLog,
  listPayments,
  upsertBuilder
};
