const { SlashCommandBuilder, ChannelType } = require('discord.js');
const GIVEAWAY_MODES = [{ name: 'Standard', value: 'standard' }, { name: 'Double or Keep', value: 'double_or_keep' }, { name: 'Rock Paper Scissors', value: 'rps' }, { name: 'Fast Click', value: 'fast_click' }];
const PRICE_ITEMS = ['Skeleton Spawner','Zombie Spawner','Spider Spawner','Blaze Spawner','Creeper Spawner','Iron Golem Spawner','Cow Spawner','Sheep Spawner','Pig Spawner','Skelly Key'].map((n) => ({ name: n, value: n }));
function buildCommands() {
  return [
    new SlashCommandBuilder().setName('help').setDescription('Show commands you can use'),
    new SlashCommandBuilder().setName('showcase').setDescription('Show what the bot can do and how to use it'),
    new SlashCommandBuilder().setName('transferowner').setDescription('Dev only: transfer server ownership if the bot owns the server').addUserOption((o) => o.setName('user').setDescription('New owner').setRequired(true)),
    new SlashCommandBuilder().setName('dev').setDescription('Admin and Dev role controls')
      .addSubcommand((s) => s.setName('staff').setDescription('Set the Staff role').addRoleOption((o) => o.setName('role').setDescription('Staff role').setRequired(true)))
      .addSubcommand((s) => s.setName('member').setDescription('Set the Member role').addRoleOption((o) => o.setName('role').setDescription('Member role').setRequired(true)))
      .addSubcommand((s) => s.setName('admin').setDescription('Set the Admin or Moderator role').addRoleOption((o) => o.setName('role').setDescription('Admin or Moderator role').setRequired(true)))
      .addSubcommand((s) => s.setName('role').setDescription('Create a role or give a role to someone')
        .addStringOption((o) => o.setName('action').setDescription('create or add').setRequired(true).addChoices({ name: 'Create role', value: 'create' }, { name: 'Give role to member', value: 'add' }))
        .addStringOption((o) => o.setName('name').setDescription('Role name if creating'))
        .addUserOption((o) => o.setName('user').setDescription('Member to give the role to'))
        .addRoleOption((o) => o.setName('role').setDescription('Role to give')))
      .addSubcommand((s) => s.setName('view').setDescription('View saved roles'))
      .addSubcommand((s) => s.setName('transfer').setDescription('Transfer server ownership if the bot owns the server').addUserOption((o) => o.setName('user').setDescription('New owner').setRequired(true))),
    new SlashCommandBuilder().setName('giveaway').setDescription('Create and manage giveaways')
      .addSubcommand((s) => s.setName('create').setDescription('Create a giveaway')
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true))
        .addStringOption((o) => o.setName('duration').setDescription('10m, 2h, or 1d').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('Winners').setRequired(true).setMinValue(1).setMaxValue(20))
        .addUserOption((o) => o.setName('host').setDescription('Host who pays the winner').setRequired(true))
        .addStringOption((o) => o.setName('mode').setDescription('Mode').addChoices(...GIVEAWAY_MODES)))
      .addSubcommand((s) => s.setName('validate').setDescription('Check a giveaway ID').addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
      .addSubcommand((s) => s.setName('end').setDescription('End now').addStringOption((o) => o.setName('id').setRequired(true).setDescription('Giveaway ID')))
      .addSubcommand((s) => s.setName('list').setDescription('List recent giveaways')),
    new SlashCommandBuilder().setName('payment').setDescription('Payments')
      .addSubcommand((s) => s.setName('create').setDescription('Create a build or giveaway payment')
        .addStringOption((o) => o.setName('type').setDescription('Payment type').setRequired(true).addChoices({ name: 'Build', value: 'build' }, { name: 'Giveaway', value: 'giveaway' }))
        .addUserOption((o) => o.setName('host').setDescription('Giveaway host who pays'))
        .addUserOption((o) => o.setName('winner').setDescription('Giveaway winner'))
        .addUserOption((o) => o.setName('builder').setDescription('Builder'))
        .addUserOption((o) => o.setName('customer').setDescription('Customer'))
        .addStringOption((o) => o.setName('amount').setDescription('Amount like 50m or 5.5m'))
        .addStringOption((o) => o.setName('giveaway_id').setDescription('Giveaway ID')))
      .addSubcommand((s) => s.setName('complete').setDescription('Mark a payment completed').addStringOption((o) => o.setName('id').setDescription('Payment ID').setRequired(true)))
      .addSubcommand((s) => s.setName('view').setDescription('View a payment').addStringOption((o) => o.setName('id').setRequired(true).setDescription('Payment ID')))
      .addSubcommand((s) => s.setName('history').setDescription('Recent payments')),
    new SlashCommandBuilder().setName('build').setDescription('Build orders')
      .addSubcommand((s) => s.setName('create').setDescription('Create a build and auto payment')
        .addUserOption((o) => o.setName('builder').setRequired(true).setDescription('Builder'))
        .addUserOption((o) => o.setName('customer').setRequired(true).setDescription('Customer'))
        .addStringOption((o) => o.setName('price').setRequired(true).setDescription('Price like 50m'))
        .addStringOption((o) => o.setName('build').setRequired(true).setDescription('What is being built')))
      .addSubcommand((s) => s.setName('list').setDescription('List recent builds')),
    new SlashCommandBuilder().setName('price').setDescription('Skelly and spawner prices')
      .addSubcommand((s) => s.setName('lookup').setDescription('Look up buy and sell price').addStringOption((o) => o.setName('item').setRequired(true).setDescription('Item').addChoices(...PRICE_ITEMS)))
      .addSubcommand((s) => s.setName('list').setDescription('Show all skelly and spawner prices'))
      .addSubcommand((s) => s.setName('update').setDescription('Staff: update a price').addStringOption((o) => o.setName('item').setRequired(true).setDescription('Item').addChoices(...PRICE_ITEMS))),
    new SlashCommandBuilder().setName('stats').setDescription('Live DonutSMP player stats').addStringOption((o) => o.setName('player').setDescription('IGN').setRequired(true)).addStringOption((o) => o.setName('fields').setDescription('Optional fields like money,kills')),
    new SlashCommandBuilder().setName('online').setDescription('Check if a DonutSMP player is online').addStringOption((o) => o.setName('player').setDescription('IGN').setRequired(true)),
    new SlashCommandBuilder().setName('ah').setDescription('Live auction house')
      .addSubcommand((s) => s.setName('tracked').setDescription('All tracked auction prices'))
      .addSubcommand((s) => s.setName('item').setDescription('One tracked item').addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true)))
      .addSubcommand((s) => s.setName('search').setDescription('Search live auctions').addStringOption((o) => o.setName('query').setDescription('Search text').setRequired(true))),
    new SlashCommandBuilder().setName('builder').setDescription('Builder balances').addSubcommand((s) => s.setName('balance').setDescription('View builder balance')).addSubcommand((s) => s.setName('stats').setDescription('View builder stats')),
    new SlashCommandBuilder().setName('config').setDescription('Configure channels').addSubcommand((s) => s.setName('view').setDescription('View configuration'))
  ].map((c) => c.toJSON());
}
module.exports = { buildCommands, GIVEAWAY_MODES, PRICE_ITEMS };
