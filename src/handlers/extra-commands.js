const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAccess } = require('../utils/permissions');
const { success, error, base, THEME } = require('../utils/embeds');
const { parseMoney, sanitizeText, formatMoney } = require('../utils/parse');
const payments = require('../systems/payments');
const builds = require('../systems/builds');
const giveaways = require('../systems/giveaways');
const prices = require('../systems/prices');

function deny(interaction, message) {
  return interaction.reply({ ephemeral: true, embeds: [error('Not allowed', message)] });
}
function timeAgo(iso) {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + ' minute(s) ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' hour(s) ago';
  return Math.floor(hours / 24) + ' day(s) ago';
}

async function handleExtra(interaction, client) {
  const name = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (name === 'price' && (sub === 'lookup' || sub === 'list')) {
    if (sub === 'list') return interaction.reply({ embeds: [prices.catalogEmbed(interaction.guildId)] });
    const item = prices.getOrDefault(interaction.guildId, interaction.options.getString('item', true));
    return interaction.reply({ embeds: [prices.priceEmbed(item)] });
  }

  if (name === 'build' && sub === 'create') {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff && !access.builder && !access.dev) return deny(interaction, 'Builders and staff only.');
    const builder = interaction.options.getUser('builder', true);
    const customer = interaction.options.getUser('customer', true);
    const amount = parseMoney(interaction.options.getString('price', true));
    if (amount === null || amount <= 0) return deny(interaction, 'Price must be a number greater than 0.');
    const description = sanitizeText(interaction.options.getString('build', true), 500);
    const builderIgn = sanitizeText(interaction.options.getString('builder_ign') || builder.username, 32);
    const customerIgn = sanitizeText(interaction.options.getString('customer_ign') || customer.username, 32);
    const payment = payments.createPayment({
      guildId: interaction.guildId,
      builderId: builder.id,
      builderTag: builder.username,
      customerId: customer.id,
      customerTag: customer.username,
      amount,
      builderIgn,
      customerIgn,
      notes: 'Auto-created from /build create',
      createdBy: interaction.user.id
    });
    const build = builds.createBuild({
      guildId: interaction.guildId,
      paymentId: payment.id,
      builderId: builder.id,
      builderIgn,
      customerId: customer.id,
      customerIgn,
      description,
      createdBy: interaction.user.id
    });
    await payments.sendPaymentLog(client, payment);
    return interaction.reply({
      content: String(customer) + ' a build was created.',
      embeds: [builds.buildEmbed(build, payment), payments.paymentEmbed(payment, 'Auto payment created')],
      components: [].concat(builds.reviewButtons(build.id), payments.paymentButtons(payment))
    });
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
    const components = (!paid && access.staff) ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw_paid:' + row.id).setLabel('Mark Giveaway Paid').setStyle(ButtonStyle.Success))] : [];
    return interaction.reply({ embeds: [embed], components });
  }
  return null;
}

module.exports = { handleExtra };
