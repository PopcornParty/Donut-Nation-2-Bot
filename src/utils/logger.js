const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel() {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

function stamp() {
  return new Date().toISOString();
}

function write(level, args) {
  if (LEVELS[level] < currentLevel()) return;
  const prefix = `[${stamp()}] [${level.toUpperCase()}]`;
  const stream = level === 'error' ? console.error : console.log;
  stream(prefix, ...args);
}

const logger = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args)
};

module.exports = logger;
