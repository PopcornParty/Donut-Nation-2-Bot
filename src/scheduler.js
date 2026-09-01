const cron = require('node-cron');
const logger = require('./utils/logger');
const { listGuildConfigs, updateConfig, nowIso, logEvent } = require('./db');
const { parseDuration, sanitizeText } = require('./utils/parse');
const giveaways = require('./systems/giveaways');
const partnership = require('./systems/partnership');

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function currentHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function postDailyGiveaway(client, cfg) {
  const channel = await client.channels.fetch(cfg.daily_giveaway_channel_id).catch(() => null);
  if (!channel) {
    logger.warn(`Daily giveaway channel missing for guild ${cfg.guild_id}`);
    return;
  }
  const durationMs = parseDuration(cfg.daily_giveaway_duration || '12h') || 12 * 60 * 60 * 1000;
  const extra = {};
  if (cfg.daily_giveaway_mode === 'fast_click') {
    extra.armAt = Date.now() + 3000 + Math.floor(Math.random() * 7000);
    extra.armed = false;
  }
  const row = giveaways.createGiveawayRecord({
    guildId: cfg.guild_id,
    channelId: channel.id,
    prize: sanitizeText(cfg.daily_giveaway_prize, 100),
    description: 'Automatic daily giveaway from Donut Nation 2.',
    winnersCount: cfg.daily_giveaway_winners || 1,
    hostId: client.user.id,
    hostName: cfg.daily_giveaway_host || 'Donut Nation 2',
    mode: cfg.daily_giveaway_mode || 'standard',
    endsAt: new Date(Date.now() + durationMs).toISOString(),
    extra
  });
  const message = await channel.send({
    embeds: [giveaways.buildGiveawayEmbed(row)],
    components: giveaways.giveawayButtons(row)
  });
  row.message_id = message.id;
  giveaways.saveGiveaway(row);
  updateConfig(cfg.guild_id, { daily_giveaway_last_run: todayKey() });
  logEvent({
    guildId: cfg.guild_id,
    category: 'giveaway',
    message: `Daily giveaway posted ${row.id}`
  });
  logger.info(`Daily giveaway posted for ${cfg.guild_id}: ${row.id}`);
}

async function tickDaily(client) {
  const now = currentHHMM();
  const today = todayKey();
  for (const cfg of listGuildConfigs()) {
    if (!cfg.daily_giveaway_enabled) continue;
    if (!cfg.daily_giveaway_time || !cfg.daily_giveaway_channel_id || !cfg.daily_giveaway_prize) continue;
    if (cfg.daily_giveaway_last_run === today) continue;
    if (cfg.daily_giveaway_time !== now) continue;
    try {
      await postDailyGiveaway(client, cfg);
    } catch (err) {
      logger.error(`Daily giveaway failed for ${cfg.guild_id}:`, err);
    }
  }
}

async function tickMaintenance(client) {
  try {
    await giveaways.processDueGiveaways(client);
    await giveaways.armFastClickGames(client);
  } catch (err) {
    logger.error('Giveaway maintenance failed:', err);
  }
  for (const guild of client.guilds.cache.values()) {
    try {
      await partnership.checkPartnership(client, guild);
    } catch (err) {
      logger.error(`Partnership check failed for ${guild.id}:`, err);
    }
  }
}

function startScheduler(client) {
  cron.schedule('* * * * *', () => {
    tickDaily(client).catch((err) => logger.error(err));
    tickMaintenance(client).catch((err) => logger.error(err));
  });
  logger.info('Scheduler started (every minute). Daily giveaways persist via last_run date in SQLite.');
}

module.exports = { startScheduler, postDailyGiveaway, tickDaily, tickMaintenance };
