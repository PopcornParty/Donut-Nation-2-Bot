require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} = require('discord.js');
const logger = require('./utils/logger');
const { initDatabase, logEvent } = require('./db');
const { deployCommands } = require('./deploy-commands');
const { handleChatCommand } = require('./handlers/commands');
const { handleButton, handleModal, handleSelect } = require('./handlers/components');
logger.info('Loaded command and component handlers');
const { startScheduler } = require('./scheduler');
const { startHealthServer } = require('./health');
const partnership = require('./systems/partnership');

function requiredEnv() {
  const missing = ['DISCORD_TOKEN', 'CLIENT_ID'].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);
  readyClient.user.setPresence({
    activities: [{ name: 'Donut Nation 2', type: ActivityType.Watching }],
    status: 'online'
  });
  logEvent({ category: 'system', message: `Bot started as ${readyClient.user.tag}` });
  startScheduler(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatCommand(interaction, client);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction, client);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction, client);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction, client);
    }
  } catch (err) {
    logger.error('Interaction failed:', err);
    logEvent({
      guildId: interaction.guildId || null,
      category: 'error',
      message: `Interaction failed: ${err.message}`,
      actorId: interaction.user?.id
    });
    const payload = {
      ephemeral: true,
      embeds: [
        {
          color: 0xed4245,
          title: 'Something went wrong',
          description: 'The bot hit an error handling that action. Staff have a log entry.',
          timestamp: new Date().toISOString(),
          footer: { text: 'Donut Nation 2' }
        }
      ]
    };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (replyErr) {
      logger.warn(`Could not send error reply: ${replyErr.message}`);
    }
  }
});

client.on(Events.GuildMemberAdd, (member) => {
  partnership.checkPartnership(client, member.guild).catch((err) => {
    logger.warn(`Partnership check after join failed: ${err.message}`);
  });
});

client.on('error', (err) => logger.error('Client error:', err));
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('SIGINT', () => {
  logEvent({ category: 'system', message: 'Bot shutting down (SIGINT)' });
  client.destroy();
  process.exit(0);
});
process.on('SIGTERM', () => {
  logEvent({ category: 'system', message: 'Bot shutting down (SIGTERM)' });
  client.destroy();
  process.exit(0);
});

async function main() {
  requiredEnv();
  initDatabase();
  startHealthServer();
  try {
    await deployCommands();
  } catch (err) {
    logger.warn(`Slash command deploy failed (bot will still start): ${err.message}`);
  }
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
