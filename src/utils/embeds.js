const { EmbedBuilder, Colors } = require('discord.js');

const THEME = {
  pink: 0xff6b9d,
  chocolate: 0x8b5a2b,
  gold: 0xf5c542,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  info: 0x5865f2,
  dark: 0x2b1d16
};

function base(title, color = THEME.pink) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: 'Donut Nation 2' })
    .setTimestamp(new Date());
}

function success(title, description) {
  return base(title, THEME.success).setDescription(description ?? null);
}

function error(title, description) {
  return base(title || 'Error', THEME.danger).setDescription(description ?? null);
}

function warning(title, description) {
  return base(title, THEME.warning).setDescription(description ?? null);
}

function info(title, description) {
  return base(title, THEME.info).setDescription(description ?? null);
}

function statusEmoji(status) {
  const map = {
    pending: '🟡',
    approved: '🟢',
    paid: '💸',
    cancelled: '⛔',
    active: '🟢',
    ended: '⏹️',
    claimed: '🎁',
    waiting_approval: '🟡',
    completed: '✅',
    changes_requested: '📝',
    qualified: '🎉',
    tracking: '📡'
  };
  return map[String(status || '').toLowerCase()] || '•';
}

module.exports = {
  THEME,
  base,
  success,
  error,
  warning,
  info,
  statusEmoji,
  Colors
};
