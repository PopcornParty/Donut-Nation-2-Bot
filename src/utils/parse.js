const DURATION_UNITS = { s:1000,sec:1000,secs:1000,second:1000,seconds:1000,m:60000,min:60000,mins:60000,minute:60000,minutes:60000,h:3600000,hr:3600000,hrs:3600000,hour:3600000,hours:3600000,d:86400000,day:86400000,days:86400000,w:604800000,week:604800000,weeks:604800000 };
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  const matches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)];
  if (!matches.length) { const asNum = Number(cleaned); return Number.isFinite(asNum) && asNum > 0 ? Math.round(asNum * 60000) : null; }
  let total = 0;
  for (const match of matches) { const value = Number(match[1]); const unit = DURATION_UNITS[match[2]]; if (!unit || !Number.isFinite(value) || value <= 0) return null; total += value * unit; }
  if (total < 10000 || total > 30 * 86400000) return null;
  return Math.round(total);
}
function parseMoney(input) {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[$,\s]/g, '').toLowerCase();
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) { const value = Number(cleaned); if (!Number.isFinite(value) || value < 0) return null; return Math.round(value * 100) / 100; }
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[match[2]] || 1;
  const value = Number(match[1]) * mult;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}
function formatMoney(amount) {
  const n = Number(amount) || 0; const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  const trim = (value) => value.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e9) return sign + trim(abs / 1e9) + 'b';
  if (abs >= 1e6) return sign + trim(abs / 1e6) + 'm';
  if (abs >= 1e3) return sign + trim(abs / 1e3) + 'k';
  return sign + trim(abs);
}
function parseTimeHHMM(input) {
  if (!input) return null;
  const match = String(input).trim().match(/^(\d{1,2}):(\d{2})$/); if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}
function sanitizeText(input, max = 1000) { return input == null ? '' : String(input).replace(/\s+/g, ' ').trim().slice(0, max); }
function parseIntSafe(input, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(String(input), 10); if (!Number.isFinite(n) || n < min || n > max) return null; return n;
}
module.exports = { parseDuration, parseMoney, formatMoney, parseTimeHHMM, sanitizeText, parseIntSafe };
