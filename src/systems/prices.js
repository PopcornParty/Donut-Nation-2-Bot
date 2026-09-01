const { getDb, nowIso, logEvent } = require('../db');
const { formatMoney } = require('../utils/parse');
const { base, THEME } = require('../utils/embeds');

function itemKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function getItem(guildId, nameOrKey) {
  const key = itemKey(nameOrKey);
  return getDb()
    .prepare('SELECT * FROM price_items WHERE guild_id = ? AND item_key = ?')
    .get(guildId, key);
}

function addItem(guildId, name, orderPrice, ahPrice, userId) {
  const key = itemKey(name);
  if (!key) throw new Error('Item name is required');
  const existing = getItem(guildId, key);
  if (existing) throw new Error('That item already exists. Use /price update instead.');
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO price_items
        (guild_id, item_key, item_name, order_price, ah_price, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, key, name.trim(), orderPrice, ahPrice, userId, ts);
  getDb()
    .prepare(
      `INSERT INTO price_history (guild_id, item_key, order_price, ah_price, updated_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, key, orderPrice, ahPrice, userId, ts);
  logEvent({ guildId, category: 'price', message: `Added price item ${name}`, actorId: userId });
  return getItem(guildId, key);
}

function updateItem(guildId, nameOrKey, orderPrice, ahPrice, userId) {
  const current = getItem(guildId, nameOrKey);
  if (!current) throw new Error('Item not found. Use /price add first.');
  const ts = nowIso();
  getDb()
    .prepare(
      `UPDATE price_items
       SET prev_order_price = order_price,
           prev_ah_price = ah_price,
           order_price = ?,
           ah_price = ?,
           updated_by = ?,
           updated_at = ?
       WHERE guild_id = ? AND item_key = ?`
    )
    .run(orderPrice, ahPrice, userId, ts, guildId, current.item_key);
  getDb()
    .prepare(
      `INSERT INTO price_history (guild_id, item_key, order_price, ah_price, updated_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, current.item_key, orderPrice, ahPrice, userId, ts);
  logEvent({ guildId, category: 'price', message: `Updated price item ${current.item_name}`, actorId: userId });
  return getItem(guildId, current.item_key);
}

function removeItem(guildId, nameOrKey) {
  const current = getItem(guildId, nameOrKey);
  if (!current) throw new Error('Item not found.');
  getDb().prepare('DELETE FROM price_items WHERE guild_id = ? AND item_key = ?').run(guildId, current.item_key);
  return current;
}

function listItems(guildId) {
  return getDb()
    .prepare('SELECT * FROM price_items WHERE guild_id = ? ORDER BY item_name COLLATE NOCASE')
    .all(guildId);
}

function history(guildId, nameOrKey, limit = 10) {
  const current = getItem(guildId, nameOrKey);
  if (!current) throw new Error('Item not found.');
  const rows = getDb()
    .prepare(
      `SELECT * FROM price_history WHERE guild_id = ? AND item_key = ? ORDER BY recorded_at DESC LIMIT ?`
    )
    .all(guildId, current.item_key, limit);
  return { item: current, rows };
}

function changeText(current, previous) {
  if (previous === null || previous === undefined) return '\u2014';
  const diff = current - previous;
  if (diff === 0) return 'No change';
  const arrow = diff > 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9';
  return `${arrow} ${diff > 0 ? '+' : ''}${formatMoney(diff)}`;
}

function priceEmbed(item) {
  const diff = (item.order_price || 0) - (item.ah_price || 0);
  return base(`\uD83D\uDC8E ${item.item_name}`, THEME.gold)
    .addFields(
      { name: 'Order', value: formatMoney(item.order_price), inline: true },
      { name: 'AH', value: formatMoney(item.ah_price), inline: true },
      { name: 'Difference', value: formatMoney(diff), inline: true },
      { name: 'Order change', value: changeText(item.order_price, item.prev_order_price), inline: true },
      { name: 'AH change', value: changeText(item.ah_price, item.prev_ah_price), inline: true },
      { name: 'Last updated', value: `<t:${Math.floor(new Date(item.updated_at).getTime() / 1000)}:R>`, inline: true }
    )
    .setDescription('Staff-maintained Donut SMP prices. No unofficial live API is used.');
}

module.exports = {
  itemKey,
  getItem,
  addItem,
  updateItem,
  removeItem,
  listItems,
  history,
  priceEmbed
};
