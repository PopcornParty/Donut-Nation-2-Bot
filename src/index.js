require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, ActivityType } = require('discord.js');
const logger = require('./utils/logger');
const { initDatabase } = require('./db');
const { deployCommands } = require('./deploy-commands');
const { handleChatCommand } = require('./handlers/commands');
const { handleButton, handleModal, handleSelect } = require('./handlers/components');
const { startScheduler } = require('./scheduler');
const { startHealthServer } = require('./health');
const partnership = require('./systems/partnership');
logger.info('Loaded command and component handlers');

function requiredEnv() {
  const missing = ['DISCORD_TOKEN', 'CLIENT_ID'].filter((key) => !process.env[key]);
  if (missing.length) throw new Error('Missing required environment variables: ' + missing.join(', '));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, async (readyClient) => {
  logger.info('Logged in as ' + readyClient.user.tag);
  readyClient.user.setPresence({ activities: [{ name: 'Donut Nation 2', type: ActivityType.Watching }], status: 'online' });
  try { await deployCommands(readyClient); } catch (err) { logger.warn('Slash command deploy after login failed: ' + err.message); }
  startScheduler(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'dev' || interaction.commandName === 'transferowner') {
        const extra = await require('./handlers/role-config').handleRoleConfig(interaction);
        if (extra) return extra;
      }
      const extraCmd = await require('./handlers/extra-commands').handleExtra(interaction, client);
      if (extraCmd) return extraCmd;
      await handleChatCommand(interaction, client);
      return;
    }
    if (interaction.isButton()) {
      const extraBtn = await require('./handlers/extra-buttons').handleExtraButton(interaction);
      if (extraBtn) return extraBtn;
      await handleButton(interaction, client);
      return;
    }
    if (interaction.isModalSubmit()) { await handleModal(interaction, client); return; }
    if (interaction.isStringSelectMenu()) await handleSelect(interaction, client);
  } catch (err) {
    logger.error('Interaction failed:', err);
    const payload = { ephemeral: true, embeds: [{ color: 0xed4245, title: 'Something went wrong', description: 'The bot hit an error handling that action.', footer: { text: 'Donut Nation 2' } }] };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (replyErr) { logger.warn(replyErr.message); }
  }
});

client.on(Events.GuildMemberAdd, (member) => {
  partnership.checkPartnership(client, member.guild).catch((err) => logger.warn(err.message));
});
client.on('error', (err) => logger.error('Client error:', err));
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));

async function main() {
  requiredEnv();
  initDatabase();
  require('./db-patch');
  startHealthServer();
  await client.login(process.env.DISCORD_TOKEN);
}
main().catch((err) => { logger.error('Fatal startup error:', err); process.exit(1); });
