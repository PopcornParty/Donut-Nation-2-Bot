const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDb, nowIso, logEvent, getConfig } = require('../db');
const { buildId } = require('../utils/ids');
const { formatMoney } = require('../utils/parse');
const { base, THEME, statusEmoji, success, warning } = require('../utils/embeds');
const { getPayment, applyApprovedEarnings, setPaymentStatus, paymentEmbed } = require('./payments');
const logger = require('../utils/logger');

function getBuild(id) {
  return getDb().prepare('SELECT * FROM builds WHERE id = ?').get(id);
}

function createBuild(data) {
  const id = buildId();
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO builds
        (id, guild_id, payment_id, builder_id, builder_ign, customer_id, customer_ign,
         description, proof_url, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_approval', ?, ?, ?)`
    )
    .run(
      id,
      data.guildId,
      data.paymentId || null,
      data.builderId,
      data.builderIgn || null,
      data.customerId,
      data.customerIgn || null,
      data.description || null,
      data.proofUrl || null,
      data.createdBy,
      ts,
      ts
    );
  logEvent({
    guildId: data.guildId,
    category: 'build',
    message: `Build ${id} submitted`,
    actorId: data.createdBy
  });
  return getBuild(id);
}

function buildEmbed(row, payment) {
  const embed = base('\ud83c\udfd7\ufe0f Build completion request', THEME.info)
    .addFields(
      { name: 'Build ID', value: '`' + row.id + '`', inline: true },
      { name: 'Status', value: `${statusEmoji(row.status)} ${row.status}`, inline: true },
      { name: 'Payment ID', value: row.payment_id ? '`' + row.payment_id + '`' : '\u2014', inline: true },
      { name: 'Builder', value: `<@${row.builder_id}>\nIGN: ${row.builder_ign || '\u2014'}`, inline: true },
      { name: 'Customer', value: `<@${row.customer_id}>\nIGN: ${row.customer_ign || '\u2014'}`, inline: true }
    )
    .setDescription(row.description || 'A build is ready for customer review.');
  if (row.proof_url) embed.addFields({ name: 'Proof', value: row.proof_url });
  if (payment) {
    embed.addFields(
      { name: 'Original payment', value: formatMoney(payment.amount), inline: true },
      { name: 'Tax', value: formatMoney(payment.tax_amount), inline: true },
      { name: 'Builder payout', value: formatMoney(payment.payout), inline: true }
    );
  }
  if (row.approved_by) embed.addFields({ name: 'Approved by', value: `<@${row.approved_by}>`, inline: true });
  return embed;
}

function reviewButtons(buildIdValue) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`build_approve:${buildIdValue}`).setLabel('Approve Build').setStyle(ButtonStyle.Success).setEmoji('\u2705'),
      new ButtonBuilder().setCustomId(`build_changes:${buildIdValue}`).setLabel('Request Changes').setStyle(ButtonStyle.Danger).setEmoji('\u274c')
    )
  ];
}

async function approveBuild(client, row, approverId) {
  if (row.status === 'completed') return { ok: false, reason: 'This build is already completed.' };
  row.status = 'completed';
  row.approved_by = approverId;
  row.completed_at = nowIso();
  getDb()
    .prepare(`UPDATE builds SET status = ?, approved_by = ?, completed_at = ?, updated_at = ? WHERE id = ?`)
    .run(row.status, row.approved_by, row.completed_at, nowIso(), row.id);

  let payment = row.payment_id ? getPayment(row.payment_id) : null;
  if (payment && payment.status === 'pending') {
    payment = setPaymentStatus(payment.id, 'approved');
    applyApprovedEarnings(payment);
  }

  logEvent({
    guildId: row.guild_id,
    category: 'build',
    message: `Build ${row.id} approved`,
    actorId: approverId
  });
  logger.info(`Build ${row.id} approved by ${approverId}`);

  await sendCompletionLog(client, getBuild(row.id), payment);
  return { ok: true, build: getBuild(row.id), payment };
}

async function requestChanges(row, actorId) {
  getDb()
    .prepare(`UPDATE builds SET status = 'changes_requested', updated_at = ? WHERE id = ?`)
    .run(nowIso(), row.id);
  logEvent({
    guildId: row.guild_id,
    category: 'build',
    message: `Build ${row.id} changes requested`,
    actorId
  });
  return getBuild(row.id);
}

async function sendCompletionLog(client, row, payment) {
  const cfg = getConfig(row.guild_id);
  if (!cfg.build_log_channel_id) return;
  const channel = await client.channels.fetch(cfg.build_log_channel_id).catch(() => null);
  if (!channel) return;
  const embed = base('\u2705 Build completed', THEME.success)
    .addFields(
      { name: 'Build ID', value: '`' + row.id + '`', inline: true },
      { name: 'Payment ID', value: row.payment_id ? '`' + row.payment_id + '`' : '\u2014', inline: true },
      { name: 'Approval', value: `${statusEmoji('completed')} approved`, inline: true },
      { name: 'Builder', value: `<@${row.builder_id}>\nIGN: ${row.builder_ign || '\u2014'}`, inline: true },
      { name: 'Customer', value: `<@${row.customer_id}>\nIGN: ${row.customer_ign || '\u2014'}`, inline: true },
      { name: 'Approved by', value: row.approved_by ? `<@${row.approved_by}>` : '\u2014', inline: true }
    )
    .setDescription(row.description || null);
  if (payment) {
    embed.addFields(
      { name: 'Original payment', value: formatMoney(payment.amount), inline: true },
      { name: `${payment.tax_percent}% tax`, value: formatMoney(payment.tax_amount), inline: true },
      { name: 'Builder payout', value: formatMoney(payment.payout), inline: true }
    );
  }
  if (row.completed_at) embed.setTimestamp(new Date(row.completed_at));
  await channel.send({ embeds: [embed] });
}

function listBuilds(guildId, limit = 10) {
  return getDb()
    .prepare('SELECT * FROM builds WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit);
}

module.exports = {
  getBuild,
  createBuild,
  buildEmbed,
  reviewButtons,
  approveBuild,
  requestChanges,
  listBuilds,
  success,
  warning,
  paymentEmbed
};
