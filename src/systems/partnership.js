const { getConfig, updateConfig, nowIso, logEvent, getDb } = require('../db');
const { base, THEME, statusEmoji } = require('../utils/embeds');
const logger = require('../utils/logger');

async function snapshotGuild(guild) {
  let online = 0;
  try {
    const fetched = guild.approximatePresenceCount;
    if (typeof fetched === 'number') online = fetched;
    else if (guild.presences?.cache) {
      online = guild.presences.cache.filter((p) => p.status && p.status !== 'offline').size;
    } else {
      online = guild.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size;
    }
  } catch {
    online = 0;
  }
  const members = guild.memberCount || guild.members?.cache?.size || 0;
  return { members, online };
}

function qualifies(cfg, snap) {
  const membersOk = snap.members >= (cfg.partner_min_members || 0);
  const onlineOk = snap.online >= (cfg.partner_min_online || 0);
  return membersOk && onlineOk;
}

async function checkPartnership(client, guild) {
  const cfg = getConfig(guild.id);
  const snap = await snapshotGuild(guild);
  const ts = nowIso();

  getDb()
    .prepare(
      `INSERT INTO partnerships (guild_id, notified, member_count, online_count, updated_at)
       VALUES (?, 0, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET member_count = excluded.member_count, online_count = excluded.online_count, updated_at = excluded.updated_at`
    )
    .run(guild.id, snap.members, snap.online, ts);

  if (!qualifies(cfg, snap)) return { qualified: false, snap, cfg };
  if (cfg.partner_notified) return { qualified: true, already: true, snap, cfg };

  updateConfig(guild.id, { partner_notified: true, partner_qualified_at: ts });
  getDb()
    .prepare('UPDATE partnerships SET notified = 1, notified_at = ?, qualified_at = ?, updated_at = ? WHERE guild_id = ?')
    .run(ts, ts, ts, guild.id);

  if (cfg.partnership_channel_id) {
    const channel = await client.channels.fetch(cfg.partnership_channel_id).catch(() => null);
    if (channel) {
      const rolePing = cfg.partnership_role_id ? `<@&${cfg.partnership_role_id}>` : '';
      await channel.send({
        content: rolePing || undefined,
        embeds: [
          base('\uD83C\uDF69 Partnership unlocked', THEME.gold)
            .setDescription(`**Donut Nation 2** now meets the configured partnership requirements.`)
            .addFields(
              { name: 'Members', value: String(snap.members), inline: true },
              { name: 'Online', value: String(snap.online), inline: true },
              { name: 'Required members', value: String(cfg.partner_min_members), inline: true },
              { name: 'Required online', value: String(cfg.partner_min_online), inline: true }
            )
        ]
      });
    }
  }

  logEvent({
    guildId: guild.id,
    category: 'partnership',
    message: `Partnership threshold reached (${snap.members} members)`
  });
  logger.info(`Partnership qualified for guild ${guild.id}`);
  return { qualified: true, already: false, snap, cfg: getConfig(guild.id) };
}

function resetPartnership(guildId, actorId) {
  updateConfig(guildId, { partner_notified: false, partner_qualified_at: null });
  getDb()
    .prepare('UPDATE partnerships SET notified = 0, notified_at = NULL, reset_by = ?, updated_at = ? WHERE guild_id = ?')
    .run(actorId, nowIso(), guildId);
  logEvent({ guildId, category: 'partnership', message: 'Partnership status reset', actorId });
}

function statusEmbed(guild, cfg, snap) {
  const ok = qualifies(cfg, snap);
  return base('\uD83E\uDD1D Partnership status', ok ? THEME.gold : THEME.info)
    .addFields(
      { name: 'Members', value: `${snap.members} / ${cfg.partner_min_members}`, inline: true },
      { name: 'Online', value: `${snap.online} / ${cfg.partner_min_online}`, inline: true },
      { name: 'Activity min', value: String(cfg.partner_min_activity || 0), inline: true },
      { name: 'Qualified', value: ok ? 'Yes' : 'Not yet', inline: true },
      { name: 'Notification sent', value: cfg.partner_notified ? `${statusEmoji('qualified')} Yes` : 'No', inline: true },
      {
        name: 'Announce to',
        value: `${cfg.partnership_channel_id ? `<#${cfg.partnership_channel_id}>` : 'Not set'}\n${cfg.partnership_role_id ? `<@&${cfg.partnership_role_id}>` : 'No role'}`,
        inline: false
      }
    )
    .setDescription(guild.name);
}

module.exports = {
  snapshotGuild,
  checkPartnership,
  resetPartnership,
  statusEmbed
};
