const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  time,
  TimestampStyles
} = require('discord.js');
const { getDb, nowIso, logEvent, getConfig } = require('../db');
const { giveawayId, claimId } = require('../utils/ids');
const { base, THEME, statusEmoji, error, success } = require('../utils/embeds');
const logger = require('../utils/logger');

const MODES = ['standard', 'double_or_keep', 'rps', 'fast_click'];

function modeLabel(mode) {
  return {
    standard: 'Standard Draw',
    double_or_keep: 'Double or Keep',
    rps: 'Rock Paper Scissors',
    fast_click: 'Fast Click'
  }[mode] || mode;
}

function parseWinners(row) {
  try {
    return row.winners_json ? JSON.parse(row.winners_json) : [];
  } catch {
    return [];
  }
}

function extraOf(row) {
  try {
    return row.extra_json ? JSON.parse(row.extra_json) : {};
  } catch {
    return {};
  }
}

function entryCount(id) {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM giveaway_entries WHERE giveaway_id = ?').get(id);
  return row?.c || 0;
}

function buildGiveawayEmbed(row, entries) {
  const winners = parseWinners(row);
  const extra = extraOf(row);
  const ends = new Date(row.ends_at);
  const color =
    row.status === 'active'
      ? THEME.pink
      : row.claimed
        ? THEME.gold
        : row.status === 'ended'
          ? THEME.chocolate
          : THEME.info;

  const embed = base(`\ud83c\udf81 ${row.prize}`, color)
    .setDescription(row.description || 'Enter below for a chance to win.')
    .addFields(
      { name: '\ud83c\udfc6 Prize', value: row.prize, inline: true },
      { name: '\ud83d\udc65 Winners', value: String(row.winners_count), inline: true },
      { name: '\ud83c\udfae Mode', value: modeLabel(row.mode), inline: true },
      { name: '\ud83d\udc64 Host', value: row.host_id ? `<@${row.host_id}>` : row.host_name || 'Staff', inline: true },
      {
        name: '\u23f0 Ends',
        value: row.status === 'active' ? `${time(ends, TimestampStyles.RelativeTime)}\n${time(ends, TimestampStyles.ShortDateTime)}` : 'Ended',
        inline: true
      },
      { name: '\ud83c\udfab Entries', value: String(entries ?? entryCount(row.id)), inline: true },
      {
        name: '\ud83d\udccc Status',
        value: `${statusEmoji(row.claimed ? 'claimed' : row.status)} ${row.claimed ? 'Claimed' : row.status}`,
        inline: true
      }
    );

  if (row.requirements) embed.addFields({ name: '\ud83d\udccb Requirements', value: row.requirements, inline: false });
  if (winners.length) embed.addFields({ name: '\ud83c\udfc5 Winner(s)', value: winners.map((id) => `<@${id}>`).join(', '), inline: false });
  if (row.claimed && row.claimed_by) {
    embed.addFields({
      name: '\ud83c\udf81 Claimed by',
      value: `<@${row.claimed_by}> • ${time(new Date(row.claimed_at), TimestampStyles.ShortDateTime)}`,
      inline: false
    });
  }
  if (extra.resultText) embed.addFields({ name: '\ud83c\udfb2 Game result', value: extra.resultText, inline: false });
  if (row.image_url) embed.setImage(row.image_url);
  embed.setFooter({ text: `Donut Nation 2 • ${row.id}` });
  return embed;
}

function giveawayButtons(row) {
  const rows = [];
  if (row.status === 'active' && row.mode !== 'fast_click') {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_join:${row.id}`).setLabel('Join Giveaway').setStyle(ButtonStyle.Success).setEmoji('\ud83c\udf89'),
        new ButtonBuilder().setCustomId(`gw_leave:${row.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary)
      )
    );
  }
  if (row.status === 'active' && row.mode === 'fast_click') {
    const extra = extraOf(row);
    const armed = Boolean(extra.armed);
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gw_fast:${row.id}`)
          .setLabel(armed ? 'CLICK NOW' : 'Wait...')
          .setStyle(armed ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(!armed)
      )
    );
  }
  if (row.status === 'ended' && !row.claimed && parseWinners(row).length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_claim:${row.id}`).setLabel('Claim Prize').setStyle(ButtonStyle.Primary).setEmoji('\ud83c\udf81')
      )
    );
  }
  if (row.status === 'ended' && row.mode === 'double_or_keep' && extraOf(row).awaitingChoice) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_keep:${row.id}`).setLabel('KEEP').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gw_double:${row.id}`).setLabel('DOUBLE').setStyle(ButtonStyle.Danger)
      )
    );
  }
  if (row.status === 'ended' && row.mode === 'rps' && extraOf(row).awaitingRps) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gw_rps:${row.id}:rock`).setLabel('Rock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`gw_rps:${row.id}:paper`).setLabel('Paper').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`gw_rps:${row.id}:scissors`).setLabel('Scissors').setStyle(ButtonStyle.Secondary)
      )
    );
  }
  return rows;
}

async function refreshGiveawayMessage(client, row) {
  try {
    const channel = await client.channels.fetch(row.channel_id);
    if (!channel) return;
    const message = await channel.messages.fetch(row.message_id);
    await message.edit({ embeds: [buildGiveawayEmbed(row)], components: giveawayButtons(row) });
  } catch (err) {
    logger.warn(`Could not refresh giveaway ${row.id}: ${err.message}`);
  }
}

function createGiveawayRecord(data) {
  const id = giveawayId();
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO giveaways
        (id, guild_id, channel_id, prize, description, image_url, requirements, winners_count,
         host_id, host_name, mode, status, ends_at, extra_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    )
    .run(
      id,
      data.guildId,
      data.channelId,
      data.prize,
      data.description || null,
      data.imageUrl || null,
      data.requirements || null,
      data.winnersCount,
      data.hostId,
      data.hostName || null,
      data.mode || 'standard',
      data.endsAt,
      JSON.stringify(data.extra || {}),
      ts
    );
  return getGiveaway(id);
}

function getGiveaway(id) {
  return getDb().prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
}

function saveGiveaway(row) {
  getDb()
    .prepare(
      `UPDATE giveaways SET message_id = ?, status = ?, ended_at = ?, winners_json = ?,
        claimed = ?, claimed_by = ?, claimed_at = ?, extra_json = ? WHERE id = ?`
    )
    .run(
      row.message_id || null,
      row.status,
      row.ended_at || null,
      row.winners_json || null,
      row.claimed ? 1 : 0,
      row.claimed_by || null,
      row.claimed_at || null,
      row.extra_json || null,
      row.id
    );
  return getGiveaway(row.id);
}

function addEntry(giveawayIdValue, userId) {
  try {
    getDb()
      .prepare('INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)')
      .run(giveawayIdValue, userId, nowIso());
    return true;
  } catch {
    return false;
  }
}

function removeEntry(giveawayIdValue, userId) {
  const info = getDb()
    .prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?')
    .run(giveawayIdValue, userId);
  return info.changes > 0;
}

function listEntries(giveawayIdValue) {
  return getDb().prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayIdValue).map((r) => r.user_id);
}

function pickWinners(userIds, count) {
  const pool = [...new Set(userIds)];
  const winners = [];
  while (pool.length && winners.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

const endingLocks = new Set();

async function endGiveaway(client, row, { reroll = false } = {}) {
  if (!row?.id) return row;
  if (!reroll && endingLocks.has(row.id)) return getGiveaway(row.id);
  endingLocks.add(row.id);
  try {
    return await finishGiveaway(client, row, { reroll });
  } finally {
    endingLocks.delete(row.id);
  }
}

async function finishGiveaway(client, row, { reroll = false } = {}) {
  const fresh = getGiveaway(row.id) || row;
  if (!reroll && fresh.status === 'ended') return fresh;
  row = fresh;
  const entries = listEntries(row.id);
  let winners = [];
  const extra = extraOf(row);

  if (row.mode === 'fast_click') {
    winners = parseWinners(row);
    extra.armed = false;
  } else {
    winners = pickWinners(entries, row.winners_count);
  }

  row.status = 'ended';
  row.ended_at = nowIso();
  row.winners_json = JSON.stringify(winners);

  if (row.mode === 'double_or_keep' && winners.length) {
    extra.awaitingChoice = true;
    extra.choiceBy = {};
  }
  if (row.mode === 'rps' && winners.length) {
    extra.awaitingRps = true;
    extra.rpsBy = {};
  }
  row.extra_json = JSON.stringify(extra);
  saveGiveaway(row);

  await refreshGiveawayMessage(client, getGiveaway(row.id));

  const channel = await client.channels.fetch(row.channel_id).catch(() => null);
  if (channel) {
    if (!winners.length) {
      await channel.send({ embeds: [error('Giveaway ended', `No valid entries for **${row.prize}** (${row.id}).`)] });
    } else {
      const mention = winners.map((id) => `<@${id}>`).join(', ');
      const components = [];
      if (row.mode === 'standard' || !['double_or_keep', 'rps'].includes(row.mode)) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_claim:${row.id}`).setLabel('Claim Prize').setStyle(ButtonStyle.Primary).setEmoji('\ud83c\udf81')
          )
        );
      }
      await channel.send({
        content: `\ud83c\udf89 Congratulations ${mention}!`,
        embeds: [success('Giveaway ended', `**${row.prize}**\nHost: <@${row.host_id}>\nWinner(s): ${mention}\nID: \`${row.id}\``)],
        components
      });
    }
  }

  const cfg = getConfig(row.guild_id);
  if (cfg.giveaway_log_channel_id) {
    const logCh = await client.channels.fetch(cfg.giveaway_log_channel_id).catch(() => null);
    if (logCh) {
      await logCh.send({
        embeds: [
          base('\ud83d\udcdc Giveaway log', THEME.chocolate)
            .setDescription(`${reroll ? 'Rerolled' : 'Ended'} **${row.prize}**`)
            .addFields(
              { name: 'ID', value: row.id, inline: true },
              { name: 'Winners', value: winners.length ? winners.map((id) => `<@${id}>`).join(', ') : 'None', inline: true },
              { name: 'Entries', value: String(entries.length), inline: true }
            )
        ]
      });
    }
  }

  logEvent({
    guildId: row.guild_id,
    category: 'giveaway',
    message: `Giveaway ${row.id} ended`,
    extra: { winners, entries: entries.length, reroll }
  });
  logger.info(`Giveaway ${row.id} ended with ${winners.length} winner(s)`);
  return getGiveaway(row.id);
}

async function processDueGiveaways(client) {
  const due = getDb()
    .prepare(`SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= ?`)
    .all(nowIso());
  for (const row of due) {
    try {
      await endGiveaway(client, row);
    } catch (err) {
      logger.error(`Failed ending giveaway ${row.id}:`, err);
    }
  }
}

async function armFastClickGames(client) {
  const active = getDb()
    .prepare(`SELECT * FROM giveaways WHERE status = 'active' AND mode = 'fast_click'`)
    .all();
  for (const row of active) {
    const extra = extraOf(row);
    if (extra.armed || (extra.armAt && extra.armAt > Date.now())) continue;
    if (!extra.armAt) continue;
    extra.armed = true;
    row.extra_json = JSON.stringify(extra);
    saveGiveaway(row);
    await refreshGiveawayMessage(client, getGiveaway(row.id));
  }
}

function markClaimed(row, userId) {
  const current = getGiveaway(row.id) || row;
  if (current.claimed) return current;
  row = current;
  row.claimed = 1;
  row.claimed_by = userId;
  row.claimed_at = nowIso();
  saveGiveaway(row);
  getDb()
    .prepare('INSERT INTO giveaway_claims (id, giveaway_id, user_id, claimed_at) VALUES (?, ?, ?, ?)')
    .run(claimId(), row.id, userId, row.claimed_at);
  logEvent({
    guildId: row.guild_id,
    category: 'giveaway',
    message: `Giveaway ${row.id} claimed by ${userId}`,
    actorId: userId
  });
  return getGiveaway(row.id);
}

function unclaim(row) {
  row.claimed = 0;
  row.claimed_by = null;
  row.claimed_at = null;
  saveGiveaway(row);
  return getGiveaway(row.id);
}

function listGiveaways(guildId, limit = 10) {
  return getDb()
    .prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit);
}

module.exports = {
  MODES,
  modeLabel,
  parseWinners,
  extraOf,
  entryCount,
  buildGiveawayEmbed,
  giveawayButtons,
  refreshGiveawayMessage,
  createGiveawayRecord,
  getGiveaway,
  saveGiveaway,
  addEntry,
  removeEntry,
  listEntries,
  pickWinners,
  endGiveaway,
  processDueGiveaways,
  armFastClickGames,
  markClaimed,
  unclaim,
  listGiveaways
};
