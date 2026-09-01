const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const logger = require('./utils/logger');

const DEFAULT_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'donut.db');

let db;

function getDb() {
  if (!db) throw new Error('Database has not been initialized');
  return db;
}

function initDatabase(filePath = DEFAULT_PATH) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      username TEXT,
      ign TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_config (
      guild_id TEXT PRIMARY KEY,
      giveaway_channel_id TEXT,
      giveaway_log_channel_id TEXT,
      payment_log_channel_id TEXT,
      build_log_channel_id TEXT,
      daily_giveaway_channel_id TEXT,
      partnership_channel_id TEXT,
      partnership_role_id TEXT,
      staff_role_ids TEXT NOT NULL DEFAULT '[]',
      admin_role_ids TEXT NOT NULL DEFAULT '[]',
      builder_role_id TEXT,
      customer_role_id TEXT,
      tax_percent REAL NOT NULL DEFAULT 20,
      daily_giveaway_enabled INTEGER NOT NULL DEFAULT 0,
      daily_giveaway_time TEXT,
      daily_giveaway_prize TEXT,
      daily_giveaway_winners INTEGER NOT NULL DEFAULT 1,
      daily_giveaway_mode TEXT NOT NULL DEFAULT 'standard',
      daily_giveaway_host TEXT,
      daily_giveaway_duration TEXT NOT NULL DEFAULT '12h',
      daily_giveaway_last_run TEXT,
      partner_min_members INTEGER NOT NULL DEFAULT 100,
      partner_min_online INTEGER NOT NULL DEFAULT 0,
      partner_min_activity INTEGER NOT NULL DEFAULT 0,
      partner_notified INTEGER NOT NULL DEFAULT 0,
      partner_qualified_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      prize TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      requirements TEXT,
      winners_count INTEGER NOT NULL DEFAULT 1,
      host_id TEXT NOT NULL,
      host_name TEXT,
      mode TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'active',
      ends_at TEXT NOT NULL,
      ended_at TEXT,
      winners_json TEXT,
      claimed INTEGER NOT NULL DEFAULT 0,
      claimed_by TEXT,
      claimed_at TEXT,
      extra_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      PRIMARY KEY (giveaway_id, user_id),
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS giveaway_claims (
      id TEXT PRIMARY KEY,
      giveaway_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      claimed_at TEXT NOT NULL,
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      builder_id TEXT NOT NULL,
      builder_ign TEXT,
      customer_id TEXT NOT NULL,
      customer_ign TEXT,
      amount REAL NOT NULL,
      tax_percent REAL NOT NULL,
      tax_amount REAL NOT NULL,
      payout REAL NOT NULL,
      order_id TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT NOT NULL,
      log_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS builders (
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      ign TEXT,
      total_earned REAL NOT NULL DEFAULT 0,
      total_tax REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      payment_id TEXT,
      builder_id TEXT NOT NULL,
      builder_ign TEXT,
      customer_id TEXT NOT NULL,
      customer_ign TEXT,
      description TEXT,
      proof_url TEXT,
      status TEXT NOT NULL DEFAULT 'waiting_approval',
      request_channel_id TEXT,
      request_message_id TEXT,
      approved_by TEXT,
      completed_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      order_price REAL NOT NULL DEFAULT 0,
      ah_price REAL NOT NULL DEFAULT 0,
      prev_order_price REAL,
      prev_ah_price REAL,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (guild_id, item_key)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      order_price REAL NOT NULL,
      ah_price REAL NOT NULL,
      updated_by TEXT,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partnerships (
      guild_id TEXT PRIMARY KEY,
      notified INTEGER NOT NULL DEFAULT 0,
      notified_at TEXT,
      qualified_at TEXT,
      member_count INTEGER,
      online_count INTEGER,
      reset_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      guild_id TEXT,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      actor_id TEXT,
      extra_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status, ends_at);
    CREATE INDEX IF NOT EXISTS idx_payments_builder ON payments(guild_id, builder_id);
    CREATE INDEX IF NOT EXISTS idx_builds_customer ON builds(guild_id, customer_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(guild_id, item_key, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_logs_cat ON logs(category, created_at);
  `);

  logger.info(`Database ready at ${filePath}`);
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

function logEvent({ guildId = null, category, message, actorId = null, extra = null }) {
  const { logId } = require('./utils/ids');
  getDb()
    .prepare(
      `INSERT INTO logs (id, guild_id, category, message, actor_id, extra_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(logId(), guildId, category, message, actorId, extra ? JSON.stringify(extra) : null, nowIso());
}

function ensureUser(user) {
  if (!user) return;
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO users (discord_id, username, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, updated_at = excluded.updated_at`
    )
    .run(user.id, user.username || user.tag || user.id, ts, ts);
}

function getConfig(guildId) {
  const row = getDb().prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);
  if (row) return hydrateConfig(row);
  const ts = nowIso();
  getDb()
    .prepare('INSERT INTO server_config (guild_id, updated_at) VALUES (?, ?)')
    .run(guildId, ts);
  return hydrateConfig(getDb().prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId));
}

function hydrateConfig(row) {
  return {
    ...row,
    staff_role_ids: safeJson(row.staff_role_ids, []),
    admin_role_ids: safeJson(row.admin_role_ids, []),
    daily_giveaway_enabled: Boolean(row.daily_giveaway_enabled),
    partner_notified: Boolean(row.partner_notified)
  };
}

function updateConfig(guildId, patch) {
  getConfig(guildId);
  const allowed = [
    'giveaway_channel_id',
    'giveaway_log_channel_id',
    'payment_log_channel_id',
    'build_log_channel_id',
    'daily_giveaway_channel_id',
    'partnership_channel_id',
    'partnership_role_id',
    'staff_role_ids',
    'admin_role_ids',
    'builder_role_id',
    'customer_role_id',
    'tax_percent',
    'daily_giveaway_enabled',
    'daily_giveaway_time',
    'daily_giveaway_prize',
    'daily_giveaway_winners',
    'daily_giveaway_mode',
    'daily_giveaway_host',
    'daily_giveaway_duration',
    'daily_giveaway_last_run',
    'partner_min_members',
    'partner_min_online',
    'partner_min_activity',
    'partner_notified',
    'partner_qualified_at'
  ];
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key)) continue;
    let stored = value;
    if (key === 'staff_role_ids' || key === 'admin_role_ids') {
      stored = JSON.stringify(Array.isArray(value) ? value : []);
    }
    if (typeof stored === 'boolean') stored = stored ? 1 : 0;
    sets.push(`${key} = ?`);
    values.push(stored);
  }
  if (!sets.length) return getConfig(guildId);
  sets.push('updated_at = ?');
  values.push(nowIso(), guildId);
  getDb().prepare(`UPDATE server_config SET ${sets.join(', ')} WHERE guild_id = ?`).run(...values);
  return getConfig(guildId);
}

function safeJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function listGuildConfigs() {
  return getDb()
    .prepare('SELECT * FROM server_config')
    .all()
    .map(hydrateConfig);
}

module.exports = {
  initDatabase,
  getDb,
  nowIso,
  logEvent,
  ensureUser,
  getConfig,
  updateConfig,
  listGuildConfigs,
  safeJson
};
