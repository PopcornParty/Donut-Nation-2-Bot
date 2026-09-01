const { getConfig } = require('../db');
const { getAccess } = require('../utils/permissions');
const { error, success, warning, base, THEME } = require('../utils/embeds');
const { parseDuration, parseMoney, sanitizeText, parseIntSafe } = require('../utils/parse');
const giveaways = require('../systems/giveaways');
const payments = require('../systems/payments');
const builds = require('../systems/builds');
const prices = require('../systems/prices');

const lastFastClick = new Map();

function ephemeralError(interaction, message) {
  return interaction.reply({ ephemeral: true, embeds: [error('Oops', message)] });
}

async function handleModal(interaction, client) {
  const customId = interaction.customId;

  if (customId.startsWith('modal_gw_create:')) {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff) return ephemeralError(interaction, 'Staff only.');
    const parts = customId.split(':');
    const mode = parts[1];
    const channelToken = parts[2];
    const prize = sanitizeText(interaction.fields.getTextInputValue('prize'), 100);
    const durationMs = parseDuration(interaction.fields.getTextInputValue('duration'));
    const winners = parseIntSafe(interaction.fields.getTextInputValue('winners'), { min: 1, max: 20 });
    const description = sanitizeText(interaction.fields.getTextInputValue('description') || '', 500) || null;
    const extrasRaw = sanitizeText(interaction.fields.getTextInputValue('extras') || '', 400);
    if (!prize) return ephemeralError(interaction, 'Prize is required.');
    if (!durationMs) return ephemeralError(interaction, 'Use a duration like 10m, 2h, or 1d.');
    if (!winners) return ephemeralError(interaction, 'Winners must be 1 to 20.');

    let imageUrl = null;
    let requirements = null;
    if (extrasRaw) {
      const bits = extrasRaw.split('|').map((p) => p.trim());
      if (bits[0] && /^https?:\/\//i.test(bits[0])) imageUrl = bits[0];
      else if (bits[0]) requirements = bits[0];
      if (bits[1]) requirements = bits[1];
    }

    const cfg = getConfig(interaction.guildId);
    const channelId = channelToken && channelToken !== 'default' ? channelToken : cfg.giveaway_channel_id || interaction.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return ephemeralError(interaction, 'Could not find the giveaway channel.');

    const extra = {};
    if (mode === 'fast_click') {
      extra.armAt = Date.now() + 3000 + Math.floor(Math.random() * 7000);
      extra.armed = false;
    }

    const row = giveaways.createGiveawayRecord({
      guildId: interaction.guildId,
      channelId: channel.id,
      prize,
      description,
      imageUrl,
      requirements,
      winnersCount: winners,
      hostId: interaction.user.id,
      hostName: interaction.user.username,
      mode: giveaways.MODES.includes(mode) ? mode : 'standard',
      endsAt: new Date(Date.now() + durationMs).toISOString(),
      extra
    });

    const message = await channel.send({
      embeds: [giveaways.buildGiveawayEmbed(row)],
      components: giveaways.giveawayButtons(row)
    });
    row.message_id = message.id;
    giveaways.saveGiveaway(row);
    return interaction.reply({ ephemeral: true, embeds: [success('Giveaway created', 'Posted ' + row.id + ' in ' + String(channel) + '.') ] });
  }

  if (customId === 'modal_price_add') {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff) return ephemeralError(interaction, 'Staff only.');
    const name = sanitizeText(interaction.fields.getTextInputValue('item'), 60);
    const order = parseMoney(interaction.fields.getTextInputValue('order'));
    const ah = parseMoney(interaction.fields.getTextInputValue('ah'));
    if (order === null || ah === null) return ephemeralError(interaction, 'Prices must be valid non-negative numbers.');
    try {
      const item = prices.addItem(interaction.guildId, name, order, ah, interaction.user.id);
      return interaction.reply({ embeds: [prices.priceEmbed(item)] });
    } catch (err) {
      return ephemeralError(interaction, err.message);
    }
  }

  if (customId.startsWith('modal_pay_create:')) {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff) return ephemeralError(interaction, 'Staff only.');
    const parts = customId.split(':');
    const amount = parseMoney(interaction.fields.getTextInputValue('amount'));
    if (amount === null || amount <= 0) return ephemeralError(interaction, 'Amount must be greater than 0.');
    const builder = await client.users.fetch(parts[1]).catch(() => null);
    const customer = await client.users.fetch(parts[2]).catch(() => null);
    if (!builder || !customer) return ephemeralError(interaction, 'Could not resolve builder or customer.');
    const row = payments.createPayment({
      guildId: interaction.guildId,
      builderId: builder.id,
      builderTag: builder.username,
      customerId: customer.id,
      customerTag: customer.username,
      amount,
      builderIgn: sanitizeText(interaction.fields.getTextInputValue('builder_ign'), 32),
      customerIgn: sanitizeText(interaction.fields.getTextInputValue('customer_ign'), 32),
      orderId: sanitizeText(interaction.fields.getTextInputValue('order_id') || '', 40) || null,
      notes: sanitizeText(interaction.fields.getTextInputValue('notes') || '', 300) || null,
      createdBy: interaction.user.id
    });
    await payments.sendPaymentLog(client, row);
    return interaction.reply({ embeds: [payments.paymentEmbed(row, 'Payment created')] });
  }

  if (customId.startsWith('modal_price_update:')) {
    const access = getAccess(interaction.member, interaction.guildId);
    if (!access.staff) return ephemeralError(interaction, 'Staff only.');
    const itemName = customId.slice('modal_price_update:'.length);
    const order = parseMoney(interaction.fields.getTextInputValue('order'));
    const ah = parseMoney(interaction.fields.getTextInputValue('ah'));
    if (order === null || ah === null) return ephemeralError(interaction, 'Prices must be valid non-negative numbers.');
    try {
      const item = prices.updateItem(interaction.guildId, itemName, order, ah, interaction.user.id);
      return interaction.reply({ embeds: [prices.priceEmbed(item)] });
    } catch (err) {
      return ephemeralError(interaction, err.message);
    }
  }
}

async function handleButton(interaction, client) {
  const bits = interaction.customId.split(':');
  const action = bits[0];
  const id = bits[1];
  const extra = bits[2];

  if (action === 'gw_join') {
    const row = giveaways.getGiveaway(id);
    if (!row || row.status !== 'active') return ephemeralError(interaction, 'This giveaway is closed.');
    if (!giveaways.addEntry(id, interaction.user.id)) return ephemeralError(interaction, 'You already joined this giveaway.');
    await giveaways.refreshGiveawayMessage(client, giveaways.getGiveaway(id));
    return interaction.reply({ ephemeral: true, embeds: [success('Entered', 'You joined **' + row.prize + '**.')] });
  }

  if (action === 'gw_leave') {
    const row = giveaways.getGiveaway(id);
    if (!row || row.status !== 'active') return ephemeralError(interaction, 'This giveaway is closed.');
    if (!giveaways.removeEntry(id, interaction.user.id)) return ephemeralError(interaction, 'You were not entered.');
    await giveaways.refreshGiveawayMessage(client, giveaways.getGiveaway(id));
    return interaction.reply({ ephemeral: true, embeds: [warning('Left giveaway', 'Your entry was removed.')] });
  }

  if (action === 'gw_fast') {
    const row = giveaways.getGiveaway(id);
    if (!row || row.status !== 'active') return ephemeralError(interaction, 'This game is over.');
    const data = giveaways.extraOf(row);
    if (!data.armed) return ephemeralError(interaction, 'Too early. Wait for the button to turn red.');
    const last = lastFastClick.get(interaction.guildId) || 0;
    if (Date.now() - last < 1500) return ephemeralError(interaction, 'Slow down a second.');
    lastFastClick.set(interaction.guildId, Date.now());
    row.winners_json = JSON.stringify([interaction.user.id]);
    row.extra_json = JSON.stringify(Object.assign({}, data, { armed: false, resultText: '<@' + interaction.user.id + '> clicked first!' }));
    giveaways.saveGiveaway(row);
    await giveaways.endGiveaway(client, giveaways.getGiveaway(id));
    return interaction.reply({ embeds: [success('Fast Click winner', '<@' + interaction.user.id + '> won **' + row.prize + '**!')] });
  }

  if (action === 'gw_claim') {
    const row = giveaways.getGiveaway(id);
    if (!row) return ephemeralError(interaction, 'Giveaway not found.');
    if (row.status !== 'ended') return ephemeralError(interaction, 'This giveaway has not ended.');
    if (row.claimed) return ephemeralError(interaction, 'This prize was already claimed.');
    if (!giveaways.parseWinners(row).includes(interaction.user.id)) return ephemeralError(interaction, 'Only a winner can claim this prize.');
    const updated = giveaways.markClaimed(row, interaction.user.id);
    await giveaways.refreshGiveawayMessage(client, updated);
    return interaction.reply({ embeds: [success('Prize claimed', '<@' + interaction.user.id + '> claimed **' + row.prize + '**.')] });
  }

  if (action === 'gw_keep' || action === 'gw_double') {
    const row = giveaways.getGiveaway(id);
    if (!row) return ephemeralError(interaction, 'Giveaway not found.');
    const data = giveaways.extraOf(row);
    if (!data.awaitingChoice) return ephemeralError(interaction, 'This choice is already locked.');
    if (!giveaways.parseWinners(row).includes(interaction.user.id)) return ephemeralError(interaction, 'Only the winner can choose.');
    data.choiceBy = data.choiceBy || {};
    if (data.choiceBy[interaction.user.id]) return ephemeralError(interaction, 'You already chose.');
    data.choiceBy[interaction.user.id] = action === 'gw_keep' ? 'KEEP' : 'DOUBLE';
    let resultText;
    if (action === 'gw_keep') {
      resultText = '<@' + interaction.user.id + '> chose **KEEP** and receives **' + row.prize + '**.';
    } else {
      const win = Math.random() < 0.5;
      resultText = win
        ? '<@' + interaction.user.id + '> chose **DOUBLE** and won! Prize becomes **' + row.prize + ' x2**.'
        : '<@' + interaction.user.id + '> chose **DOUBLE** and lost the extra chance. Original prize still stands.';
      data.doubleResult = win ? 'win' : 'lose';
    }
    data.awaitingChoice = false;
    data.resultText = resultText;
    row.extra_json = JSON.stringify(data);
    giveaways.saveGiveaway(row);
    await giveaways.refreshGiveawayMessage(client, giveaways.getGiveaway(id));
    return interaction.reply({ embeds: [base('Double or Keep', THEME.gold).setDescription(resultText)] });
  }

  if (action === 'gw_rps') {
    const row = giveaways.getGiveaway(id);
    if (!row) return ephemeralError(interaction, 'Giveaway not found.');
    const data = giveaways.extraOf(row);
    if (!data.awaitingRps) return ephemeralError(interaction, 'This match is already finished.');
    if (!giveaways.parseWinners(row).includes(interaction.user.id)) return ephemeralError(interaction, 'Only the winner can play.');
    data.rpsBy = data.rpsBy || {};
    if (data.rpsBy[interaction.user.id]) return ephemeralError(interaction, 'You already picked.');
    if (['rock', 'paper', 'scissors'].indexOf(extra) === -1) return ephemeralError(interaction, 'Invalid move.');
    data.rpsBy[interaction.user.id] = extra;
    const botChoices = ['rock', 'paper', 'scissors'];
    const bot = botChoices[Math.floor(Math.random() * 3)];
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const outcome = extra === bot ? 'tie' : beats[extra] === bot ? 'win' : 'lose';
    data.awaitingRps = false;
    data.resultText = outcome === 'tie'
      ? '<@' + interaction.user.id + '> played **' + extra + '**. Bot played **' + bot + '**. Tie - prize still awarded.'
      : outcome === 'win'
        ? '<@' + interaction.user.id + '> played **' + extra + '** and beat the bot **' + bot + '**. Prize won!'
        : '<@' + interaction.user.id + '> played **' + extra + '** but the bot **' + bot + '** won.';
    row.extra_json = JSON.stringify(data);
    giveaways.saveGiveaway(row);
    await giveaways.refreshGiveawayMessage(client, giveaways.getGiveaway(id));
    return interaction.reply({ embeds: [base('Rock Paper Scissors', THEME.info).setDescription(data.resultText)] });
  }

  if (action === 'build_approve' || action === 'build_changes') {
    const row = builds.getBuild(id);
    if (!row) return ephemeralError(interaction, 'Build not found.');
    const access = getAccess(interaction.member, interaction.guildId);
    if (interaction.user.id !== row.customer_id && !access.staff) {
      return ephemeralError(interaction, 'Only the assigned customer can use these buttons.');
    }
    if (action === 'build_approve') {
      const result = await builds.approveBuild(client, row, interaction.user.id);
      if (!result.ok) return ephemeralError(interaction, result.reason);
      return interaction.update({
        embeds: [success('Build approved', '`' + row.id + '` is completed.')],
        components: []
      });
    }
    await builds.requestChanges(row, interaction.user.id);
    return interaction.update({
      embeds: [warning('Changes requested', 'The builder should revise `' + row.id + '`.')],
      components: []
    });
  }
}

async function handleSelect(interaction) {
  if (interaction.customId !== 'config_quick') return;
  const access = getAccess(interaction.member, interaction.guildId);
  if (!access.admin) return ephemeralError(interaction, 'Admins only.');
  const choice = interaction.values[0];
  const text = choice === 'partner'
    ? 'Run /partner setup then /partner requirements.'
    : choice === 'daily'
      ? 'Run /dailygiveaway setup then /dailygiveaway enable.'
      : choice === 'logs'
        ? 'Use /config set to assign payment, build, and giveaway log channels.'
        : 'Use /config set to add staff, admin, builder, and customer roles.';
  return interaction.reply({ ephemeral: true, embeds: [base('Next step', THEME.info).setDescription(text)] });
}

module.exports = { handleModal, handleButton, handleSelect };
