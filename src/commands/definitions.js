const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const GIVEAWAY_MODES = [
  { name: 'Standard', value: 'standard' },
  { name: 'Double or Keep', value: 'double_or_keep' },
  { name: 'Rock Paper Scissors', value: 'rps' },
  { name: 'Fast Click', value: 'fast_click' }
];

function buildCommands() {
  return [
    new SlashCommandBuilder().setName('help').setDescription('Show commands you can use'),
    new SlashCommandBuilder()
      .setName('dev')
      .setDescription('Dev / server-owner only: set Admin, Staff, and other bot roles')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((s) => s.setName('admin').setDescription('Set the Admin role').addRoleOption((o) => o.setName('role').setDescription('Admin role').setRequired(true)))
      .addSubcommand((s) => s.setName('staff').setDescription('Set the Staff role').addRoleOption((o) => o.setName('role').setDescription('Staff role').setRequired(true)))
      .addSubcommand((s) => s.setName('member').setDescription('Set the Member role').addRoleOption((o) => o.setName('role').setDescription('Member role').setRequired(true)))
      .addSubcommand((s) => s.setName('builder').setDescription('Set the Builder role').addRoleOption((o) => o.setName('role').setDescription('Builder role').setRequired(true)))
      .addSubcommand((s) => s.setName('customer').setDescription('Set the Customer role').addRoleOption((o) => o.setName('role').setDescription('Customer role').setRequired(true)))
      .addSubcommand((s) => s.setName('addowner').setDescription('Give a trusted user extra owner bot access').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('removeowner').setDescription('Remove extra owner bot access').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('view').setDescription('View saved Dev role settings')),
    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Configure channels and bot settings')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('view').setDescription('View current configuration'))
      .addSubcommand((s) => s.setName('set').setDescription('Update a channel or tax setting')
        .addStringOption((o) => o.setName('key').setDescription('Setting to change').setRequired(true).addChoices(
          { name: 'Giveaway channel', value: 'giveaway_channel_id' },
          { name: 'Payment log channel', value: 'payment_log_channel_id' },
          { name: 'Build completion log channel', value: 'build_log_channel_id' },
          { name: 'Daily giveaway channel', value: 'daily_giveaway_channel_id' },
          { name: 'Partnership channel', value: 'partnership_channel_id' },
          { name: 'Tax percent', value: 'tax_percent' }
        ))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel value').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addNumberOption((o) => o.setName('number').setDescription('Numeric value').setMinValue(0).setMaxValue(100))),
    new SlashCommandBuilder()
      .setName('partner')
      .setDescription('Automatic partnership system')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('setup').setDescription('Set partnership announcement channel and role')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to ping').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName('role').setDescription('Role to ping').setRequired(true)))
      .addSubcommand((s) => s.setName('requirements').setDescription('Set partnership requirements')
        .addIntegerOption((o) => o.setName('min_members').setDescription('Minimum member count').setMinValue(1).setRequired(true))
        .addIntegerOption((o) => o.setName('min_online').setDescription('Minimum online members').setMinValue(0).setRequired(true)))
      .addSubcommand((s) => s.setName('status').setDescription('Show partnership progress'))
      .addSubcommand((s) => s.setName('reset').setDescription('Allow the partnership notification to fire again')),
    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Create and manage giveaways')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((s) => s.setName('create').setDescription('Create a giveaway')
        .addStringOption((o) => o.setName('prize').setDescription('What people can win').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('duration').setDescription('How long until it ends, like 10m, 2h, or 1d').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('How many winners').setRequired(true).setMinValue(1).setMaxValue(20))
        .addUserOption((o) => o.setName('host').setDescription('Who is hosting this giveaway').setRequired(true))
        .addStringOption((o) => o.setName('mode').setDescription('Giveaway game mode').addChoices(...GIVEAWAY_MODES))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to post in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption((o) => o.setName('description').setDescription('Optional extra details').setMaxLength(500)))
      .addSubcommand((s) => s.setName('end').setDescription('End a giveaway now').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('reroll').setDescription('Reroll winners').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('claim').setDescription('Staff-mark a giveaway as claimed').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('unclaim').setDescription('Staff-mark a giveaway as unclaimed').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List recent giveaways')),
    new SlashCommandBuilder()
      .setName('dailygiveaway')
      .setDescription('Automatic daily giveaway host')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('setup').setDescription('Configure the daily giveaway')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption((o) => o.setName('time').setDescription('Time HH:MM').setRequired(true))
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true)))
      .addSubcommand((s) => s.setName('enable').setDescription('Enable the daily giveaway'))
      .addSubcommand((s) => s.setName('disable').setDescription('Disable the daily giveaway'))
      .addSubcommand((s) => s.setName('status').setDescription('Show daily giveaway settings')),
    new SlashCommandBuilder()
      .setName('price')
      .setDescription('Donut SMP item price tracker')
      .addSubcommand((s) => s.setName('lookup').setDescription('Look up an item price').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('add').setDescription('Add a tracked item'))
      .addSubcommand((s) => s.setName('list').setDescription('List tracked items')),
    new SlashCommandBuilder()
      .setName('payment')
      .setDescription('Builder payment tracker')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((s) => s.setName('create').setDescription('Create a payment')
        .addUserOption((o) => o.setName('builder').setDescription('Builder').setRequired(true))
        .addUserOption((o) => o.setName('customer').setDescription('Customer').setRequired(true)))
      .addSubcommand((s) => s.setName('view').setDescription('View a payment').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('history').setDescription('Recent payments')),
    new SlashCommandBuilder()
      .setName('builder')
      .setDescription('Builder payout tracking')
      .addSubcommand((s) => s.setName('balance').setDescription('View builder balance'))
      .addSubcommand((s) => s.setName('stats').setDescription('View builder stats')),
    new SlashCommandBuilder()
      .setName('build')
      .setDescription('Build completion and approval')
      .addSubcommand((s) => s.setName('complete').setDescription('Submit a completed build')
        .addUserOption((o) => o.setName('builder').setDescription('Builder').setRequired(true))
        .addUserOption((o) => o.setName('customer').setDescription('Customer').setRequired(true))
        .addStringOption((o) => o.setName('builder_ign').setDescription('Builder IGN').setRequired(true))
        .addStringOption((o) => o.setName('customer_ign').setDescription('Customer IGN').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('What was built').setRequired(true)))
      .addSubcommand((s) => s.setName('approve').setDescription('Approve a build').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List recent builds'))
  ].map((c) => c.toJSON());
}

module.exports = { buildCommands, GIVEAWAY_MODES };
