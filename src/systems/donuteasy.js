const { formatMoney } = require('../utils/parse');
const { base, THEME } = require('../utils/embeds');
const BASE = (process.env.DONUTEASY_BASE_URL || 'https://donutsmpbot-production.up.railway.app/api/donuteasy/v1').replace(/\/$/, '');
function flatten(obj, prefix, out) {
  prefix = prefix || ''; out = out || {};
  if (obj == null) return out;
  if (Array.isArray(obj)) { out[prefix || 'list'] = obj.slice(0, 12).map((v) => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', '); return out; }
  if (typeof obj !== 'object') { out[prefix || 'value'] = String(obj); return out; }
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, next, out);
    else if (Array.isArray(value)) out[next] = value.slice(0, 8).map((v) => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
    else out[next] = value;
  }
  return out;
}
function prettyValue(key, value) {
  const k = String(key).toLowerCase();
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && /(money|price|bal|coin|sell|buy|worth)/.test(k)) return formatMoney(value);
  return String(value);
}
async function donutGet(path) {
  const key = process.env.DONUTEASY_API_KEY;
  if (!key) throw new Error('Set DONUTEASY_API_KEY in Railway Variables.');
  const url = path.startsWith('http') ? path : BASE + path;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 800) }; }
  if (!res.ok) throw new Error(String((json && (json.message || json.error || json.detail)) || ('HTTP ' + res.status)));
  return json;
}
function pick(obj, names) {
  const flat = flatten(obj);
  for (const name of names) {
    const hit = Object.entries(flat).find(([k]) => k.toLowerCase() === name.toLowerCase() || k.toLowerCase().endsWith('.' + name.toLowerCase()));
    if (hit) return hit[1];
  }
  return null;
}
function statsEmbed(player, data) {
  const embed = base('DonutSMP stats — ' + player, THEME.gold);
  const fields = [['Money', pick(data, ['money', 'balance', 'bal'])], ['Kills', pick(data, ['kills'])], ['Deaths', pick(data, ['deaths'])], ['Playtime', pick(data, ['playtime', 'time'])], ['Shards', pick(data, ['shards'])]];
  for (const [name, value] of fields) if (value != null) embed.addFields({ name, value: prettyValue(name, value), inline: true });
  if (!embed.data.fields || !embed.data.fields.length) embed.setDescription('```json\n' + JSON.stringify(data, null, 2).slice(0, 800) + '\n```');
  return embed;
}
function onlineEmbed(player, data) {
  const online = pick(data, ['online', 'isOnline', 'status']);
  const yes = online === true || String(online).toLowerCase() === 'online' || String(online) === 'true';
  return base(player + ' online status', yes ? THEME.success : THEME.info).setDescription(yes ? player + ' is online.' : player + ' looks offline.');
}
function auctionEmbed(title, data) {
  const embed = base(title, THEME.gold);
  const list = Array.isArray(data) ? data : data.items || data.data || data.results || data.auctions || [];
  if (Array.isArray(list) && list.length) {
    embed.setDescription(list.slice(0, 12).map((item) => {
      const name = item.name || item.item || item.id || item.symbol || 'item';
      const buy = item.buy ?? item.buyPrice ?? item.price ?? item.lowest;
      const sell = item.sell ?? item.sellPrice;
      return '**' + name + '** — ' + (buy != null ? 'Buy ' + formatMoney(buy) + ' ' : '') + (sell != null ? 'Sell ' + formatMoney(sell) : '');
    }).join('\n'));
    return embed;
  }
  embed.setDescription('```json\n' + JSON.stringify(data, null, 2).slice(0, 900) + '\n```');
  return embed;
}
async function playerStats(player, fields) { return donutGet('/stats/' + encodeURIComponent(player) + (fields ? '?fields=' + encodeURIComponent(fields) : '')); }
async function playerOnline(player) { return donutGet('/online/' + encodeURIComponent(player)); }
async function auctionAll() { return donutGet('/auction'); }
async function auctionItem(item) { return donutGet('/auction/' + encodeURIComponent(item)); }
async function auctionSearch(query) { return donutGet('/auction?search=' + encodeURIComponent(query)); }
module.exports = { donutGet, playerStats, playerOnline, auctionAll, auctionItem, auctionSearch, statsEmbed, onlineEmbed, auctionEmbed };
