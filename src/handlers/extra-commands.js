const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAccess } = require('../utils/permissions');
const { error, base, THEME } = require('../utils/embeds');
const { parseMoney, sanitizeText } = require('../utils/parse');
const { getDb, nowIso } = require('../db');
const payments = require('../systems/payments');
const builds = require('../systems/builds');
const giveaways = require('../systems/giveaways');
const prices = require('../systems/prices');
const { paymentButtons } = require('../systems/pay-buttons');
const donut = require('../systems/donuteasy');

function deny(interaction, message) {
  return interaction.reply({ ephemeral: true, embeds: [error('Not allowed', message)] });
}
function timeAgo(iso) {
  if (!iso) return 'unknown';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins + ' minute(s) ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' hour(s) ago';
  return Math.floor(hours / 24) + ' day(s) ago';
}

async function handleExtra(interaction, client) {
  const name = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (name === 'showcase') return interaction.reply({ embeds: require('./showcase').showcaseEmbeds() });

  if (name === 'stats') {
    try { return interaction.reply({ embeds: [donut.statsEmbed(interaction.options.getString('player', true), await donut.playerStats(interaction.options.getString('player', true), interaction.options.getString('fields') || undefined))] }); }
    catch (err) { return deny(interaction, err.message); }
  }
  if (name === 'online') {
    try { return interaction.reply({ embeds: [donut.onlineEmbed(interaction.options.getString('player', true), await donut.playerOnline(interaction.options.getString('player', true)))] }); }
    catch (err) { return deny(interaction, err.message); }
  }
  if (name === 'ah') {
    try {
      if (sub === 'item') return interaction.reply({ embeds: [donut.auctionEmbed('AH — ' + interaction.options.getString('item', true), await donut.auctionItem(interaction.options.getString('item', true)))] });
      if (sub === 'search') return interaction.reply({ embeds: [donut.auctionEmbed('AH search — ' + interaction.options.getString('query', true), await donut.auctionSearch(interaction.options.getString('query', true)))] });
      return interaction.reply({ embeds: [donut.auctionEmbed('Tracked auction prices', await donut.auctionAll())] });
    } catch (err) { return deny(interaction, err.message); }
  }

  if (name === 'payment' && (sub === 'create' || sub === 'complete')) {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff && !access.dev) return deny(interaction, 'Staff only.');
    if (sub === 'complete') {
      const row = payments.getPayment(interaction.options.getString('id', true).trim());
      if (!row || row.guild_id !== interaction.guildId) return deny(interaction, 'Payment not found.');
      return interaction.reply({ embeds: [payments.paymentEmbed(payments.setPaymentStatus(row.id, 'paid'), 'Payment completed')] });
    }
    const type = interaction.options.getString('type');
    if (type === 'giveaway') {
      const host = interaction.options.getUser('host') || interaction.options.getUser('builder');
      const winner = interaction.options.getUser('winner') || interaction.options.getUser('customer');
      const amount = parseMoney(interaction.options.getString('amount'));
      if (!host || !winner || amount == null || amount <= 0) return deny(interaction, 'Giveaway payments need host, winner, and amount like 50m.');
      const gwId = sanitizeText(interaction.options.getString('giveaway_id') || '', 40);
      const payment = payments.createPayment({
        guildId: interaction.guildId, builderId: winner.id, builderTag: winner.username, customerId: host.id, customerTag: host.username,
        amount, builderIgn: winner.username, customerIgn: host.username, orderId: gwId || null,
        notes: 'Giveaway payout. No tax. Host pays winner.', createdBy: interaction.user.id, taxPercent: 0
      });
      try { getDb().prepare('UPDATE payments SET tax_percent = 0, tax_amount = 0, payout = ?, updated_at = ? WHERE id = ?').run(amount, nowIso(), payment.id); } catch (err) {}
      const fresh = payments.getPayment(payment.id);
      await payments.sendPaymentLog(client, fresh);
      return interaction.reply({ embeds: [payments.paymentEmbed(fresh, 'Giveaway payment')], components: paymentButtons(fresh) });
    }
  }

  if (name === 'price' && (sub === 'lookup' || sub === 'list')) {
    if (sub === 'list') return interaction.reply({ embeds: [prices.catalogEmbed(interaction.guildId)] });
    return interaction.reply({ embeds: [prices.priceEmbed(prices.getOrDefault(interaction.guildId, interaction.options.getString('item', true)))] });
  }

  if (name === 'build' && sub === 'create') {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff && !access.builder && !access.dev) return deny(interaction, 'Builders and staff only.');
    const builder = interaction.options.getUser('builder', true);
    const customer = interaction.options.getUser('customer', true);
    const amount = parseMoney(interaction.options.getString('price', true));
    if (amount == null || amount <= 0) return deny(interaction, 'Price must look like 50m or 5.5m.');
    const description = sanitizeText(interaction.options.getString('build', true), 500);
    const payment = payments.createPayment({ guildId: interaction.guildId, builderId: builder.id, builderTag: builder.username, customerId: customer.id, customerTag: customer.username, amount, builderIgn: builder.username, customerIgn: customer.username, notes: 'Auto-created from /build create', createdBy: interaction.user.id });
    const build = builds.createBuild({ guildId: interaction.guildId, paymentId: payment.id, builderId: builder.id, builderIgn: builder.username, customerId: customer.id, customerIgn: customer.username, description, createdBy: interaction.user.id });
    await payments.sendPaymentLog(client, payment);
    return interaction.reply({ content: String(customer) + ' a build was created.', embeds: [builds.buildEmbed(build, payment), payments.paymentEmbed(payment, 'Auto payment created')], components: [].concat(builds.reviewButtons(build.id), paymentButtons(payment)) });
  }

  if (name === 'giveaway' && sub === 'validate') {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff && !access.dev) return deny(interaction, 'Staff only.');
    const row = giveaways.getGiveaway(interaction.options.getString('id', true).trim());
    if (!row || row.guild_id !== interaction.guildId) return deny(interaction, 'Giveaway ID not found.');
    const extra = giveaways.extraOf(row);
    const winners = giveaways.parseWinners(row);
    const paid = Boolean(extra.prizePaid);
    const embed = base('Giveaway validate', paid ? THEME.gold : THEME.info).addFields(
      { name: 'Giveaway ID', value: '`' + row.id + '`', inline: true },
      { name: 'Prize', value: row.prize, inline: true },
      { name: 'Paid', value: paid ? 'Yes' : 'No', inline: true },
      { name: 'Host pays', value: '<@' + row.host_id + '>', inline: true },
      { name: 'Winner', value: winners.length ? winners.map((w) => '<@' + w + '>').join(', ') : 'None', inline: true },
      { name: 'When', value: row.ended_at ? timeAgo(row.ended_at) : 'Still active', inline: true }
    ).setDescription('Winner gives this ID in their ticket. Host owes the prize.');
    const components = (!paid && (access.staff || access.dev)) ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw_paid:' + row.id).setLabel('Mark Giveaway Paid').setStyle(ButtonStyle.Success))] : [];
    return interaction.reply({ embeds: [embed], components });
  }
  return null;
}
module.exports = { handleExtra };
