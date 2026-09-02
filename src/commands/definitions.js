const { SlashCommandBuilder, ChannelType } = require('discord.js');

const GIVEAWAY_MODES = [
  { name: 'Standard', value: 'standard' },
  { name: 'Double or Keep', value: 'double_or_keep' },
  { name: 'Rock Paper Scissors', value: 'rps' },
  { name: 'Fast Click', value: 'fast_click' }
];
const PRICE_ITEMS = [
  { name: 'Skeleton Spawner', value: 'Skeleton Spawner' },
  { name: 'Zombie Spawner', value: 'Zombie Spawner' },
  { name: 'Spider Spawner', value: 'Spider Spawner' },
  { name: 'Blaze Spawner', value: 'Blaze Spawner' },
  { name: 'Creeper Spawner', value: 'Creeper Spawner' },
  { name: 'Iron Golem Spawner', value: 'Iron Golem Spawner' },
  { name: 'Cow Spawner', value: 'Cow Spawner' },
  { name: 'Sheep Spawner', value: 'Sheep Spawner' },
  { name: 'Pig Spawner', value: 'Pig Spawner' },
  { name: 'Skelly Key', value: 'Skelly Key' }
];

function buildCommands() {
  return [
    new SlashCommandBuilder().setName('help').setDescription('Show commands you can use'),
    new SlashCommandBuilder().setName('dev').setDescription('Dev-only controls').setDefaultMemberPermissions('0')
      .addSubcommand((s) => s.setName('staff').setDescription('Set the Staff role').addRoleOption((o) => o.setName('role').setDescription('Staff role').setRequired(true)))
      .addSubcommand((s) => s.setName('member').setDescription('Set the Member role').addRoleOption((o) => o.setName('role').setDescription('Member role').setRequired(true)))
      .addSubcommand((s) => s.setName('admin').setDescription('Set the Admin role').addRoleOption((o) => o.setName('role').setDescription('Admin role').setRequired(true)))
      .addSubcommand((s) => s.setName('role').setDescription('Create a role or give a role to someone')
        .addStringOption((o) => o.setName('action').setDescription('create or add').setRequired(true).addChoices({ name: 'Create role', value: 'create' }, { name: 'Give role to member', value: 'add' }))
        .addStringOption((o) => o.setName('name').setDescription('Role name if creating'))
        .addUserOption((o) => o.setName('user').setDescription('Member to give the role to'))
        .addRoleOption((o) => o.setName('role').setDescription('Role to give')))
      .addSubcommand((s) => s.setName('view').setDescription('View saved roles')),
    new SlashCommandBuilder().setName('config').setDescription('Configure channels')
      .addSubcommand((s) => s.setName('view').setDescription('View current configuration'))
      .addSubcommand((s) => s.setName('set').setDescription('Update a channel or tax setting')
        .addStringOption((o) => o.setName('key').setDescription('Setting').setRequired(true).addChoices(
          { name: 'Giveaway channel', value: 'giveaway_channel_id' },
          { name: 'Payment log channel', value: 'payment_log_channel_id' },
          { name: 'Build log channel', value: 'build_log_channel_id' },
          { name: 'Tax percent', value: 'tax_percent' }
        ))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addNumberOption((o) => o.setName('number').setDescription('Number').setMinValue(0).setMaxValue(100))),
    new SlashCommandBuilder().setName('giveaway').setDescription('Create and manage giveaways')
      .addSubcommand((s) => s.setName('create').setDescription('Create a giveaway')
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('duration').setDescription('10m, 2h, or 1d').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('How many winners').setRequired(true).setMinValue(1).setMaxValue(20))
        .addUserOption((o) => o.setName('host').setDescription('Host who must pay the winner').setRequired(true))
        .addStringOption((o) => o.setName('mode').setDescription('Mode').addChoices(...GIVEAWAY_MODES))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((s) => s.setName('validate').setDescription('Check a giveaway ID from a ticket').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('end').setDescription('End now').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List recent giveaways')),
    new SlashCommandBuilder().setName('price').setDescription('Skelly and spawner prices')
      .addSubcommand((s) => s.setName('lookup').setDescription('Look up a skelly or spawner price').addStringOption((o) => o.setName('item').setDescription('Item').setRequired(true).addChoices(...PRICE_ITEMS)))
      .addSubcommand((s) => s.setName('list').setDescription('Show all skelly and spawner prices'))
      .addSubcommand((s) => s.setName('add').setDescription('Staff: add or set a price'))
      .addSubcommand((s) => s.setName('update').setDescription('Staff: update a price').addStringOption((o) => o.setName('item').setDescription('Item').setRequired(true).addChoices(...PRICE_ITEMS))),
    new SlashCommandBuilder().setName('build').setDescription('Build orders')
      .addSubcommand((s) => s.setName('create').setDescription('Create a build and auto-make the payment')
        .addUserOption((o) => o.setName('builder').setDescription('Builder').setRequired(true))
        .addUserOption((o) => o.setName('customer').setDescription('Customer').setRequired(true))
        .addStringOption((o) => o.setName('price').setDescription('Price the customer pays').setRequired(true))
        .addStringOption((o) => o.setName('build').setDescription('What is being built').setRequired(true))
        .addStringOption((o) => o.setName('builder_ign').setDescription('Builder IGN'))
        .addStringOption((o) => o.setName('customer_ign').setDescription('Customer IGN')))
      .addSubcommand((s) => s.setName('complete').setDescription('Mark a build ready for approval').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('approve').setDescription('Customer approves a build').addStringOption((o) => o.setName('id').setDescription('Build ID').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List recent builds')),
    new SlashCommandBuilder().setName('payment').setDescription('Builder payments')
      .addSubcommand((s) => s.setName('create').setDescription('Create a payment').addUserOption((o) => o.setName('builder').setRequired(true).setDescription('Builder')).addUserOption((o) => o.setName('customer').setRequired(true).setDescription('Customer')))
      .addSubcommand((s) => s.setName('view').setDescription('View a payment').addStringOption((o) => o.setName('id').setRequired(true).setDescription('Payment ID')))
      .addSubcommand((s) => s.setName('history').setDescription('Recent payments')),
    new SlashCommandBuilder().setName('builder').setDescription('Builder balances')
      .addSubcommand((s) => s.setName('balance').setDescription('View builder balance'))
      .addSubcommand((s) => s.setName('stats').setDescription('View builder stats')),
    new SlashCommandBuilder().setName('help').setDescription('Show commands you can use')
  ].filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i).map((c) => c.toJSON());
}

module.exports = { buildCommands, GIVEAWAY_MODES, PRICE_ITEMS };
