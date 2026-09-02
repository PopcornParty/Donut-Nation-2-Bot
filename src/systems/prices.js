const { getDb, nowIso, logEvent } = require('../db');
const { formatMoney } = require('../utils/parse');
const { base, THEME } = require('../utils/embeds');

const CATALOG = ['Skeleton Spawner','Zombie Spawner','Spider Spawner','Blaze Spawner','Creeper Spawner','Iron Golem Spawner','Cow Spawner','Sheep Spawner','Pig Spawner','Skelly Key'];

function itemKey(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function getItem(guildId, nameOrKey) {
  return getDb().prepare('SELECT * FROM price_items WHERE guild_id = ? AND item_key = ?').get(guildId, itemKey(nameOrKey));
}
function addItem(guildId, name, orderPrice, ahPrice, userId) {
  const key = itemKey(name);
  if (!key) throw new Error('Item name is required');
  const existing = getItem(guildId, key);
  if (existing) throw new Error('That item already exists. Use /price update instead.');
  const ts = nowIso();
  getDb().prepare('INSERT INTO price_items (guild_id, item_key, item_name, order_price, ah_price, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(guildId, key, name.trim(), orderPrice, ahPrice, userId, ts);
  return getItem(guildId, key);
}
function updateItem(guildId, nameOrKey, orderPrice, ahPrice, userId) {
  const current = getItem(guildId, nameOrKey);
  if (!current) return addItem(guildId, nameOrKey, orderPrice, ahPrice, userId);
  const ts = nowIso();
  getDb().prepare('UPDATE price_items SET prev_order_price = order_price, prev_ah_price = ah_price, order_price = ?, ah_price = ?, updated_by = ?, updated_at = ? WHERE guild_id = ? AND item_key = ?').run(orderPrice, ahPrice, userId, ts, guildId, current.item_key);
  return getItem(guildId, current.item_key);
}
function getOrDefault(guildId, name) {
  const existing = getItem(guildId, name);
  if (existing) return existing;
  try { return addItem(guildId, name, 0, 0, 'system'); } catch { return getItem(guildId, name); }
}
function catalogEmbed(guildId) {
  const lines = CATALOG.map((name) => {
    const item = getOrDefault(guildId, name);
    return '**' + item.item_name + '** — Order ' + formatMoney(item.order_price) + ' | AH ' + formatMoney(item.ah_price);
  });
  return base('Skelys and Spawners', THEME.gold).setDescription(lines.join('\n'));
}
function priceEmbed(item) {
  return base(item.item_name, THEME.gold).addFields(
    { name: 'Order', value: formatMoney(item.order_price), inline: true },
    { name: 'AH', value: formatMoney(item.ah_price), inline: true }
  );
}
function listItems(guildId) {
  return getDb().prepare('SELECT * FROM price_items WHERE guild_id = ? ORDER BY item_name COLLATE NOCASE').all(guildId);
}
function removeItem() { throw new Error('Use /price update'); }
function history() { return { item: null, rows: [] }; }

module.exports = { itemKey, getItem, addItem, updateItem, removeItem, listItems, history, priceEmbed, getOrDefault, catalogEmbed, CATALOG };
