require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { buildCommands } = require('./commands/definitions');
const logger = require('./utils/logger');

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID are required to register slash commands.');
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const body = buildCommands();
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    logger.info(`Registered ${body.length} guild commands for ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info(`Registered ${body.length} global commands`);
  }
}

if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

module.exports = { deployCommands };
