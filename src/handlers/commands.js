const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { getConfig, updateConfig, logEvent } = require('../db');
const { requireAccess, getAccess } = require('../utils/permissions');
const { base, success, error, THEME } = require('../utils/embeds');
const { parseDuration, parseTimeHHMM, sanitizeText, formatMoney } = require('../utils/parse');
const giveaways = require('../systems/giveaways');
const payments = require('../systems/payments');
const builds = require('../systems/builds');
const prices = require('../systems/prices');
const partnership = require('../systems/partnership');

function deny(interaction, message) {
  return interaction.reply({ ephemeral: true, embeds: [error('Not allowed', message)] });
}
function ok(interaction, title, description) {
  return interaction.reply({ ephemeral: true, embeds: [success(title, description)] });
}
function input(id, label, style, required, extra) {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required);
  if (extra && extra.value) t.setValue(extra.value);
  if (extra && extra.max) t.setMaxLength(extra.max);
  return new ActionRowBuilder().addComponents(t);
}

async function handleHelp(interaction) {
  const access = getAccess(interaction.member, interaction.guildId, interaction.user);
  const lines = ['**Everyone**', '`/help` `/price lookup` `/price list` `/price history`'];
  if (access.customer || access.staff) lines.push('', '**Customers**', '`/build approve` `/build changes` `/build view`');
  if (access.builder || access.staff) lines.push('', '**Builders**', '`/builder balance` `/build complete` `/build list`');
  if (access.staff) lines.push('', '**Staff**', '`/giveaway *` `/payment *` `/price add|update|remove`');
  if (access.admin) lines.push('', '**Admins**', '`/config` `/partner *` `/dailygiveaway *`');
  if (access.dev) {
    lines.push(
      '',
      '**Dev / Server owner only**',
      '`/dev admin` set the Admin role',
      '`/dev staff` set the Staff role',
      '`/dev member` `/dev builder` `/dev customer`',
      '`/dev addowner` `/dev removeowner` `/dev view`'
    );
  }
  return interaction.reply({ ephemeral: true, embeds: [base('Donut Nation 2 Commands', THEME.pink).setDescription(lines.join('\n'))] });
}

async function handleConfig(interaction) {
  const gate = requireAccess(interaction, 'admin');
  if (!gate.ok) return deny(interaction, gate.message);
  const sub = interaction.options.getSubcommand();
  const cfg = getConfig(interaction.guildId);
  if (sub === 'view') {
    const embed = base('Server configuration', THEME.info).addFields(
      { name: 'Giveaway channel', value: cfg.giveaway_channel_id ? '<#' + cfg.giveaway_channel_id + '>' : '-', inline: true },
      { name: 'Payment log', value: cfg.payment_log_channel_id ? '<#' + cfg.payment_log_channel_id + '>' : '-', inline: true },
      { name: 'Build log', value: cfg.build_log_channel_id ? '<#' + cfg.build_log_channel_id + '>' : '-', inline: true },
      { name: 'Daily channel', value: cfg.daily_giveaway_channel_id ? '<#' + cfg.daily_giveaway_channel_id + '>' : '-', inline: true },
      { name: 'Partnership channel', value: cfg.partnership_channel_id ? '<#' + cfg.partnership_channel_id + '>' : '-', inline: true },
      { name: 'Admin roles', value: (cfg.admin_role_ids || []).length ? cfg.admin_role_ids.map((id) => '<@&' + id + '>').join(' ') : '-', inline: false },
      { name: 'Staff roles', value: (cfg.staff_role_ids || []).length ? cfg.staff_role_ids.map((id) => '<@&' + id + '>').join(' ') : '-', inline: false },
      { name: 'Extra owners', value: (cfg.owner_user_ids || []).length ? cfg.owner_user_ids.map((id) => '<@' + id + '>').join(' ') : 'None', inline: false },
      { name: 'Tax', value: String(cfg.tax_percent) + '%', inline: true }
    );
    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('config_quick').setPlaceholder('Quick setup').addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Partnership setup').setValue('partner'),
        new StringSelectMenuOptionBuilder().setLabel('Daily giveaway setup').setValue('daily'),
        new StringSelectMenuOptionBuilder().setLabel('Log channels').setValue('logs'),
        new StringSelectMenuOptionBuilder().setLabel('Roles (Dev only)').setValue('roles')
      )
    );
    return interaction.reply({ ephemeral: true, embeds: [embed], components: [menu] });
  }
  const key = interaction.options.getString('key', true);
  if (['admin_role_add', 'owner_user_add', 'staff_role_add', 'builder_role_id', 'customer_role_id', 'partnership_role_id'].includes(key)) {
    return deny(interaction, 'Role changes are Dev / server-owner only. Use /dev instead.');
  }
  const channel = interaction.options.getChannel('channel');
  const number = interaction.options.getNumber('number');
  const patch = {};
  if (key.endsWith('_channel_id')) {
    if (!channel) return deny(interaction, 'Pick a channel.');
    patch[key] = channel.id;
  } else if (key === 'tax_percent') {
    if (number === null || number < 0 || number > 100) return deny(interaction, 'Tax must be 0-100.');
    patch.tax_percent = number;
  } else {
    return deny(interaction, 'Unknown setting.');
  }
  updateConfig(interaction.guildId, patch);
  logEvent({ guildId: interaction.guildId, category: 'config', message: 'Config updated: ' + key, actorId: interaction.user.id });
  return ok(interaction, 'Configuration saved', 'Updated `' + key + '`.');
}

async function handlePartner(interaction) {
  const gate = requireAccess(interaction, 'admin');
  if (!gate.ok) return deny(interaction, gate.message);
  const sub = interaction.options.getSubcommand();
  if (sub === 'setup') {
    updateConfig(interaction.guildId, {
      partnership_channel_id: interaction.options.getChannel('channel', true).id,
      partnership_role_id: interaction.options.getRole('role', true).id
    });
    return ok(interaction, 'Partnership setup', 'Announcement channel and role saved.');
  }
  if (sub === 'requirements') {
    updateConfig(interaction.guildId, {
      partner_min_members: interaction.options.getInteger('min_members', true),
      partner_min_online: interaction.options.getInteger('min_online', true),
      partner_min_activity: interaction.options.getInteger('min_activity') || 0
    });
    return ok(interaction, 'Requirements saved', 'Partnership thresholds updated.');
  }
  if (sub === 'status') {
    const cfg = getConfig(interaction.guildId);
    const snap = await partnership.snapshotGuild(interaction.guild);
    return interaction.reply({ ephemeral: true, embeds: [partnership.statusEmbed(interaction.guild, cfg, snap)] });
  }
  partnership.resetPartnership(interaction.guildId, interaction.user.id);
  return ok(interaction, 'Partnership reset', 'A new notification can fire next time.');
}

async function handleGiveaway(interaction, client) {
  const sub = interaction.options.getSubcommand();
  if (['create', 'end', 'reroll', 'claim', 'unclaim'].indexOf(sub) !== -1) {
    const gate = requireAccess(interaction, 'staff');
    if (!gate.ok) return deny(interaction, gate.message);
  }
  if (sub === 'create') {
    const prize = sanitizeText(interaction.options.getString('prize', true), 100);
    const durationRaw = interaction.options.getString('duration', true);
    const durationMs = parseDuration(durationRaw);
    const winners = interaction.options.getInteger('winners', true);
    const host = interaction.options.getUser('host', true);
    const mode = interaction.options.getString('mode') || 'standard';
    const channelOpt = interaction.options.getChannel('channel');
    const description = sanitizeText(interaction.options.getString('description') || '', 500) || null;
    if (!prize) return deny(interaction, 'Prize is required.');
    if (!durationMs) return deny(interaction, 'Use a time like 10m, 2h, or 1d.');
    const cfg = getConfig(interaction.guildId);
    const channelId = channelOpt ? channelOpt.id : cfg.giveaway_channel_id || interaction.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return deny(interaction, 'Could not find the giveaway channel.');
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
      winnersCount: winners,
      hostId: host.id,
      hostName: host.username,
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
    return interaction.reply({
      ephemeral: true,
      embeds: [success('Giveaway created', '**' + prize + '** posted in ' + String(channel) + '.\nID: `' + row.id + '`\nHost: <@' + host.id + '>\nWinners: ' + winners + '\nEnds in ' + durationRaw + '.')]
    });
  }
  if (sub === 'list') {
    const rows = giveaways.listGiveaways(interaction.guildId, 10);
    if (!rows.length) return ok(interaction, 'Giveaways', 'No giveaways yet.');
    return interaction.reply({ ephemeral: true, embeds: [base('Recent giveaways').setDescription(rows.map((r) => '`' + r.id + '` ' + r.prize + ' - ' + r.status).join('\n'))] });
  }
  const row = giveaways.getGiveaway(interaction.options.getString('id'));
  if (!row || row.guild_id !== interaction.guildId) return deny(interaction, 'Giveaway not found.');
  if (sub === 'end') {
    if (row.status !== 'active') return deny(interaction, 'That giveaway is not active.');
    await giveaways.endGiveaway(client, row);
    return ok(interaction, 'Giveaway ended', '`' + row.id + '` has been closed.');
  }
  if (sub === 'reroll') {
    await giveaways.endGiveaway(client, row, { reroll: true });
    return ok(interaction, 'Giveaway rerolled', 'New winner(s) selected for `' + row.id + '`.');
  }
  if (sub === 'claim') {
    const winners = giveaways.parseWinners(row);
    const claimed = giveaways.markClaimed(row, winners[0] || interaction.user.id);
    await giveaways.refreshGiveawayMessage(client, claimed);
    return ok(interaction, 'Marked claimed', '`' + row.id + '` is now claimed.');
  }
  const updated = giveaways.unclaim(row);
  await giveaways.refreshGiveawayMessage(client, updated);
  return ok(interaction, 'Marked unclaimed', '`' + row.id + '` can be claimed again.');
}

async function handleDaily(interaction) {
  const gate = requireAccess(interaction, 'admin');
  if (!gate.ok) return deny(interaction, gate.message);
  const sub = interaction.options.getSubcommand();
  if (sub === 'setup') {
    const timeValue = parseTimeHHMM(interaction.options.getString('time', true));
    if (!timeValue) return deny(interaction, 'Time must be HH:MM.');
    const duration = interaction.options.getString('duration') || '12h';
    if (!parseDuration(duration)) return deny(interaction, 'Invalid duration.');
    updateConfig(interaction.guildId, {
      daily_giveaway_channel_id: interaction.options.getChannel('channel', true).id,
      daily_giveaway_time: timeValue,
      daily_giveaway_prize: sanitizeText(interaction.options.getString('prize', true), 100),
      daily_giveaway_winners: interaction.options.getInteger('winners') || 1,
      daily_giveaway_mode: interaction.options.getString('mode') || 'standard',
      daily_giveaway_host: sanitizeText(interaction.options.getString('host') || 'Donut Nation 2', 80),
      daily_giveaway_duration: duration
    });
    return ok(interaction, 'Daily giveaway configured', 'Scheduled for ' + timeValue + '. Enable with /dailygiveaway enable.');
  }
  if (sub === 'enable') {
    const cfg = getConfig(interaction.guildId);
    if (!cfg.daily_giveaway_channel_id || !cfg.daily_giveaway_time || !cfg.daily_giveaway_prize) return deny(interaction, 'Run /dailygiveaway setup first.');
    updateConfig(interaction.guildId, { daily_giveaway_enabled: true });
    return ok(interaction, 'Daily giveaway enabled', 'It will keep working after restarts.');
  }
  if (sub === 'disable') {
    updateConfig(interaction.guildId, { daily_giveaway_enabled: false });
    return ok(interaction, 'Daily giveaway disabled', 'Scheduled posts are paused.');
  }
  const cfg = getConfig(interaction.guildId);
  return interaction.reply({
    ephemeral: true,
    embeds: [base('Daily giveaway', THEME.info).addFields(
      { name: 'Enabled', value: cfg.daily_giveaway_enabled ? 'Yes' : 'No', inline: true },
      { name: 'Time', value: cfg.daily_giveaway_time || '-', inline: true },
      { name: 'Prize', value: cfg.daily_giveaway_prize || '-', inline: true },
      { name: 'Last run', value: cfg.daily_giveaway_last_run || 'Never', inline: true }
    )]
  });
}

async function handlePrice(interaction) {
  const sub = interaction.options.getSubcommand();
  if (['add', 'update', 'remove'].indexOf(sub) !== -1) {
    const gate = requireAccess(interaction, 'staff');
    if (!gate.ok) return deny(interaction, gate.message);
  }
  if (sub === 'add') {
    const modal = new ModalBuilder().setCustomId('modal_price_add').setTitle('Add item price');
    modal.addComponents(input('item', 'Item name', TextInputStyle.Short, true), input('order', 'Order price', TextInputStyle.Short, true), input('ah', 'AH price', TextInputStyle.Short, true));
    return interaction.showModal(modal);
  }
  if (sub === 'update') {
    const modal = new ModalBuilder().setCustomId('modal_price_update:' + interaction.options.getString('item', true)).setTitle('Update item price');
    modal.addComponents(input('order', 'New order price', TextInputStyle.Short, true), input('ah', 'New AH price', TextInputStyle.Short, true));
    return interaction.showModal(modal);
  }
  if (sub === 'lookup') {
    const item = prices.getItem(interaction.guildId, interaction.options.getString('item', true));
    if (!item) return deny(interaction, 'Item not tracked yet. Staff can add it with /price add.');
    return interaction.reply({ embeds: [prices.priceEmbed(item)] });
  }
  if (sub === 'remove') {
    const removed = prices.removeItem(interaction.guildId, interaction.options.getString('item', true));
    return ok(interaction, 'Item removed', 'Stopped tracking **' + removed.item_name + '**.');
  }
  if (sub === 'history') {
    const result = prices.history(interaction.guildId, interaction.options.getString('item', true), 8);
    const desc = result.rows.map((r) => formatMoney(r.order_price) + ' / ' + formatMoney(r.ah_price)).join('\n');
    return interaction.reply({ embeds: [base(result.item.item_name + ' history').setDescription(desc || 'No history.')] });
  }
  const items = prices.listItems(interaction.guildId);
  if (!items.length) return ok(interaction, 'Price list', 'No items yet.');
  return interaction.reply({ embeds: [base('Tracked items').setDescription(items.map((i) => '**' + i.item_name + '** Order ' + formatMoney(i.order_price) + ' AH ' + formatMoney(i.ah_price)).join('\n'))] });
}

async function handlePayment(interaction, client) {
  const sub = interaction.options.getSubcommand();
  if (sub !== 'view') {
    const gate = requireAccess(interaction, 'staff');
    if (!gate.ok) return deny(interaction, gate.message);
  }
  if (sub === 'create') {
    const builder = interaction.options.getUser('builder', true);
    const customer = interaction.options.getUser('customer', true);
    const modal = new ModalBuilder().setCustomId('modal_pay_create:' + builder.id + ':' + customer.id).setTitle('Create payment');
    modal.addComponents(
      input('amount', 'Amount customer pays', TextInputStyle.Short, true),
      input('builder_ign', 'Builder IGN', TextInputStyle.Short, true, { max: 32 }),
      input('customer_ign', 'Customer IGN', TextInputStyle.Short, true, { max: 32 }),
      input('order_id', 'Order / build ID (optional)', TextInputStyle.Short, false),
      input('notes', 'Notes (optional)', TextInputStyle.Paragraph, false)
    );
    return interaction.showModal(modal);
  }
  if (sub === 'history') {
    const builder = interaction.options.getUser('builder');
    const rows = payments.listPayments(interaction.guildId, { builderId: builder ? builder.id : undefined, limit: 10 });
    if (!rows.length) return ok(interaction, 'Payments', 'No payments found.');
    return interaction.reply({ ephemeral: true, embeds: [base('Payment history').setDescription(rows.map((r) => '`' + r.id + '` ' + formatMoney(r.amount) + ' ' + r.status).join('\n'))] });
  }
  const row = payments.getPayment(interaction.options.getString('id', true));
  if (!row || row.guild_id !== interaction.guildId) return deny(interaction, 'Payment not found.');
  if (sub === 'view') return interaction.reply({ ephemeral: true, embeds: [payments.paymentEmbed(row)] });
  if (sub === 'approve') {
    if (row.status === 'cancelled') return deny(interaction, 'Cancelled payments cannot be approved.');
    return interaction.reply({ embeds: [payments.paymentEmbed(payments.setPaymentStatus(row.id, 'approved'), 'Payment approved')] });
  }
  if (sub === 'paid') {
    if (row.status === 'cancelled') return deny(interaction, 'Cancelled payments cannot be marked paid.');
    return interaction.reply({ embeds: [payments.paymentEmbed(payments.setPaymentStatus(row.id, 'paid'), 'Payment marked paid')] });
  }
  return interaction.reply({ embeds: [payments.paymentEmbed(payments.setPaymentStatus(row.id, 'cancelled'), 'Payment cancelled')] });
}

async function handleBuilder(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const access = getAccess(interaction.member, interaction.guildId, interaction.user);
  if (target.id !== interaction.user.id && !access.staff) return deny(interaction, 'Only staff can view another builder.');
  if (target.id === interaction.user.id && !access.builder && !access.staff) return deny(interaction, 'This command is for builders and staff.');
  const stats = payments.builderStats(interaction.guildId, target.id);
  return interaction.reply({
    ephemeral: true,
    embeds: [base('Builder balance', THEME.gold).setDescription('Builder: <@' + target.id + '>').addFields(
      { name: 'Total completed', value: formatMoney(stats.completedAmount), inline: true },
      { name: 'Net earnings', value: formatMoney(stats.netEarnings), inline: true },
      { name: 'Already paid', value: formatMoney(stats.alreadyPaid), inline: true },
      { name: 'Currently owed', value: formatMoney(stats.owed), inline: true }
    )]
  });
}

async function handleBuild(interaction, client) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'complete') {
    const gate = requireAccess(interaction, 'builder');
    if (!gate.ok) return deny(interaction, gate.message);
    const paymentId = interaction.options.getString('payment_id');
    if (paymentId) {
      const pay = payments.getPayment(paymentId);
      if (!pay || pay.guild_id !== interaction.guildId) return deny(interaction, 'Payment ID not found.');
    }
    const customer = interaction.options.getUser('customer', true);
    const row = builds.createBuild({
      guildId: interaction.guildId,
      paymentId,
      builderId: interaction.options.getUser('builder', true).id,
      builderIgn: sanitizeText(interaction.options.getString('builder_ign', true), 32),
      customerId: customer.id,
      customerIgn: sanitizeText(interaction.options.getString('customer_ign', true), 32),
      description: sanitizeText(interaction.options.getString('description', true), 500),
      proofUrl: sanitizeText(interaction.options.getString('proof') || '', 300) || null,
      createdBy: interaction.user.id
    });
    const payment = paymentId ? payments.getPayment(paymentId) : null;
    return interaction.reply({
      content: String(customer) + ' please review this build.',
      embeds: [builds.buildEmbed(row, payment)],
      components: builds.reviewButtons(row.id)
    });
  }
  if (sub === 'list') {
    const gate = requireAccess(interaction, 'builder');
    if (!gate.ok) return deny(interaction, gate.message);
    const rows = builds.listBuilds(interaction.guildId, 10);
    if (!rows.length) return ok(interaction, 'Builds', 'No builds yet.');
    return interaction.reply({ ephemeral: true, embeds: [base('Recent builds').setDescription(rows.map((r) => '`' + r.id + '` ' + r.status).join('\n'))] });
  }
  const row = builds.getBuild(interaction.options.getString('id', true));
  if (!row || row.guild_id !== interaction.guildId) return deny(interaction, 'Build not found.');
  const payment = row.payment_id ? payments.getPayment(row.payment_id) : null;
  if (sub === 'view') return interaction.reply({ ephemeral: true, embeds: [builds.buildEmbed(row, payment)] });
  if (interaction.user.id !== row.customer_id) {
    const gate = requireAccess(interaction, 'staff');
    if (!gate.ok) return deny(interaction, 'Only the assigned customer (or staff) can do that.');
  }
  if (sub === 'approve') {
    const result = await builds.approveBuild(client, row, interaction.user.id);
    if (!result.ok) return deny(interaction, result.reason);
    return interaction.reply({ embeds: [success('Build approved', '`' + row.id + '` is completed.')] });
  }
  await builds.requestChanges(row, interaction.user.id);
  return interaction.reply({ embeds: [success('Changes requested', 'The builder should update `' + row.id + '`.')] });
}

async function handleChatCommand(interaction, client) {
  switch (interaction.commandName) {
    case 'help': return handleHelp(interaction);
    case 'config': return handleConfig(interaction);
    case 'partner': return handlePartner(interaction);
    case 'giveaway': return handleGiveaway(interaction, client);
    case 'dailygiveaway': return handleDaily(interaction);
    case 'price': return handlePrice(interaction);
    case 'payment': return handlePayment(interaction, client);
    case 'builder': return handleBuilder(interaction);
    case 'build': return handleBuild(interaction, client);
    default: return deny(interaction, 'Unknown command.');
  }
}

module.exports = { handleChatCommand };
