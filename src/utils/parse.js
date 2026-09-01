const DURATION_UNITS = {
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  mins: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hrs: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  const matches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)];
  if (!matches.length) {
    const asNum = Number(cleaned);
    if (Number.isFinite(asNum) && asNum > 0) return Math.round(asNum * 60 * 1000);
    return null;
  }
  let total = 0;
  for (const match of matches) {
    const value = Number(match[1]);
    const unit = DURATION_UNITS[match[2]];
    if (!unit || !Number.isFinite(value) || value <= 0) return null;
    total += value * unit;
  }
  if (total < 10 * 1000) return null;
  if (total > 30 * 24 * 60 * 60 * 1000) return null;
  return Math.round(total);
}

function parseMoney(input) {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[$,\s]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function parseTimeHHMM(input) {
  if (!input) return null;
  const match = String(input).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function sanitizeText(input, max = 1000) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseIntSafe(input, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(String(input), 10);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

module.exports = {
  parseDuration,
  parseMoney,
  formatMoney,
  parseTimeHHMM,
  sanitizeText,
  parseIntSafe
};
