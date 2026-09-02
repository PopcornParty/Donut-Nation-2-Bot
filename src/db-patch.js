const dbMod = require('./db');

function ensureCols() {
  const database = dbMod.getDb();
  const cols = database.prepare('PRAGMA table_info(server_config)').all().map((c) => c.name);
  if (!cols.includes('owner_user_ids')) database.exec("ALTER TABLE server_config ADD COLUMN owner_user_ids TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes('dev_user_ids')) database.exec("ALTER TABLE server_config ADD COLUMN dev_user_ids TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes('member_role_id')) database.exec('ALTER TABLE server_config ADD COLUMN member_role_id TEXT');
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const origGet = dbMod.getConfig;
dbMod.getConfig = function getConfigPatched(guildId) {
  ensureCols();
  const cfg = origGet(guildId);
  cfg.owner_user_ids = asList(cfg.owner_user_ids);
  cfg.dev_user_ids = asList(cfg.dev_user_ids);
  return cfg;
};

const origUpdate = dbMod.updateConfig;
dbMod.updateConfig = function updateConfigPatched(guildId, patch) {
  ensureCols();
  origUpdate(guildId, patch);
  const extra = {};
  if (patch.owner_user_ids !== undefined) extra.owner_user_ids = JSON.stringify(patch.owner_user_ids || []);
  if (patch.dev_user_ids !== undefined) extra.dev_user_ids = JSON.stringify(patch.dev_user_ids || []);
  if (patch.member_role_id !== undefined) extra.member_role_id = patch.member_role_id;
  if (Object.keys(extra).length) {
    const sets = Object.keys(extra).map((key) => key + ' = ?');
    const values = Object.values(extra);
    values.push(guildId);
    dbMod.getDb().prepare('UPDATE server_config SET ' + sets.join(', ') + ' WHERE guild_id = ?').run(...values);
  }
  return dbMod.getConfig(guildId);
};

module.exports = dbMod;
