const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

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
      .setName('config')
      .setDescription('Configure Donut Nation 2 bot settings')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('view').setDescription('View current configuration'))
      .addSubcommand((s) => s.setName('admin').setDescription('Set the Admin role').addRoleOption((o) => o.setName('role').setDescription('Admin role').setRequired(true)))
      .addSubcommand((s) => s.setName('staff').setDescription('Set the Staff role').addRoleOption((o) => o.setName('role').setDescription('Staff role').setRequired(true)))
      .addSubcommand((s) => s.setName('member').setDescription('Set the Member role').addRoleOption((o) => o.setName('role').setDescription('Member role').setRequired(true)))
      .addSubcommand((s) => s.setName('dev').setDescription('Add a Dev user (highest access)').addUserOption((o) => o.setName('user').setDescription('Dev user').setRequired(true)))
      .addSubcommand((s) =>
        s.setName('set').setDescription('Update a configuration value')
          .addStringOption((o) =>
            o.setName('key').setDescription('Setting to change').setRequired(true).addChoices(
              { name: 'Giveaway channel', value: 'giveaway_channel_id' },
              { name: 'Giveaway log channel', value: 'giveaway_log_channel_id' },
              { name: 'Payment log channel', value: 'payment_log_channel_id' },
              { name: 'Build completion log channel', value: 'build_log_channel_id' },
              { name: 'Daily giveaway channel', value: 'daily_giveaway_channel_id' },
              { name: 'Partnership channel', value: 'partnership_channel_id' },
              { name: 'Partnership role', value: 'partnership_role_id' },
              { name: 'Builder role', value: 'builder_role_id' },
              { name: 'Customer role', value: 'customer_role_id' },
              { name: 'Staff role (add)', value: 'staff_role_add' },
              { name: 'Admin role (add)', value: 'admin_role_add' },
              { name: 'Extra owner', value: 'owner_user_add' },
              { name: 'Tax percent', value: 'tax_percent' }
            )
          )
          .addChannelOption((o) => o.setName('channel').setDescription('Channel value').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
          .addRoleOption((o) => o.setName('role').setDescription('Role value'))
          .addUserOption((o) => o.setName('user').setDescription('User value (extra owner)'))
          .addNumberOption((o) => o.setName('number').setDescription('Numeric value').setMinValue(0).setMaxValue(100))
      ),
    new SlashCommandBuilder()
      .setName('partner')
      .setDescription('Automatic partnership system')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('setup').setDescription('Set partnership announcement channel and role')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to ping').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName('role').setDescription('Role to ping').setRequired(true)))
      .addSubcommand((s) => s.setName('requirements').setDescription('Set partnership requirements')
        .addIntegerOption((o) => o.setName('min_members').setDescription('Minimum member count').setMinValue(1).setRequired(true))
        .addIntegerOption((o) => o.setName('min_online').setDescription('Minimum online members').setMinValue(0).setRequired(true))
        .addIntegerOption((o) => o.setName('min_activity').setDescription('Optional activity score').setMinValue(0)))
      .addSubcommand((s) => s.setName('status').setDescription('Show partnership progress'))
      .addSubcommand((s) => s.setName('reset').setDescription('Allow the partnership notification to fire again')),
    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Create and manage giveaways')
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
        .addStringOption((o) => o.setName('time').setDescription('Time HH:MM in server timezone').setRequired(true))
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('Winner count').setMinValue(1).setMaxValue(10))
        .addStringOption((o) => o.setName('mode').setDescription('Mode').addChoices(...GIVEAWAY_MODES))
        .addStringOption((o) => o.setName('host').setDescription('Host display name'))
        .addStringOption((o) => o.setName('duration').setDescription('How long it runs, e.g. 12h')))
      .addSubcommand((s) => s.setName('enable').setDescription('Enable the daily giveaway'))
      .addSubcommand((s) => s.setName('disable').setDescription('Disable the daily giveaway'))
      .addSubcommand((s) => s.setName('status').setDescription('Show daily giveaway settings')),
    new SlashCommandBuilder()
      .setName('price')
      .setDescription('Donut SMP item price tracker')
      .addSubcommand((s) => s.setName('lookup').setDescription('Look up an item price').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('add').setDescription('Add a tracked item (opens a modal)'))
      .addSubcommand((s) => s.setName('update').setDescription('Update an item (opens a modal)').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('remove').setDescription('Remove a tracked item').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('history').setDescription('Show price history').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List tracked items')),
    new SlashCommandBuilder()
      .setName('payment')
      .setDescription('Builder payment tracker')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('create').setDescription('Create a payment (opens a modal)')
        .addUserOption((o) => o.setName('builder').setDescription('Builder').setRequired(true))
        .addUserOption((o) => o.setName('customer').setDescription('Customer').setRequired(true)))
      .addSubcommand((s) => s.setName('view').setDescription('View a payment').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('approve').setDescription('Approve a payment').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('paid').setDescription('Mark a payment as paid out').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('cancel').setDescription('Cancel a payment').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('history').setDescription('Recent payments').addUserOption((o) => o.setName('builder').setDescription('Filter by builder'))),
    new SlashCommandBuilder()
      .setName('builder')
      .setDescription('Builder payout tracking')
      .addSubcommand((s) => s.setName('balance').setDescription('View builder balance').addUserOption((o) => o.setName('user').setDescription('Builder (defaults to you)')))
      .addSubcommand((s) => s.setName('stats').setDescription('View builder stats').addUserOption((o) => o.setName('user').setDescription('Builder (defaults to you)'))),
    new SlashCommandBuilder()
      .setName('build')
      .setDescription('Build completion and approval')
      .addSubcommand((s) => s.setName('complete').setDescription('Submit a completed build for customer approval')
        .addUserOption((o) => o.setName('builder').setDescription('Builder').setRequired(true))
        .addUserOption((o) => o.setName('customer').setDescription('Customer').setRequired(true))
        .addStringOption((o) => o.setName('builder_ign').setDescription('Builder IGN').setRequired(true))
        .addStringOption((o) => o.setName('customer_ign').setDescription('Customer IGN').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('What was built').setRequired(true))
        .addStringOption((o) => o.setName('payment_id').setDescription('Linked payment ID'))
        .addStringOption((o) => o.setName('proof').setDescription('Image URL or proof link')))
      .addSubcommand((s) => s.setName('view').setDescription('View a build').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('approve').setDescription('Approve a build (customer or staff)').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('changes').setDescription('Request changes on a build').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List recent builds'))
  ].map((c) => c.toJSON());
}

module.exports = { buildCommands, GIVEAWAY_MODES };
