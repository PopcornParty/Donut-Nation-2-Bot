const { updateConfig, getConfig } = require('../db');
const { requireAccess } = require('../utils/permissions');
const { success, error } = require('../utils/embeds');

function reply(interaction, title, text, bad) {
  return interaction.reply({
    ephemeral: true,
    embeds: [bad ? error('Not allowed', text) : success(title, text)]
  });
}

async function handleRoleConfig(interaction) {
  const sub = interaction.options.getSubcommand();
  if (['admin', 'staff', 'member', 'dev'].indexOf(sub) === -1) return null;

  const gate = requireAccess(interaction, 'admin');
  if (!gate.ok) return reply(interaction, '', gate.message, true);

  const cfg = getConfig(interaction.guildId);
  if (sub === 'admin') {
    if (!gate.access.owner && !gate.access.dev) return reply(interaction, '', 'Only the owner or a Dev can set Admin.', true);
    updateConfig(interaction.guildId, { admin_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Admin role set', 'That role can now use admin commands.');
  }
  if (sub === 'staff') {
    updateConfig(interaction.guildId, { staff_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Staff role set', 'That role can now use staff commands like /giveaway.');
  }
  if (sub === 'member') {
    updateConfig(interaction.guildId, { member_role_id: interaction.options.getRole('role', true).id });
    return reply(interaction, 'Member role set', 'Saved the Member role.');
  }
  if (!gate.access.dev && !gate.access.owner) return reply(interaction, '', 'Only a Dev or the server owner can add a Dev.', true);
  const user = interaction.options.getUser('user', true);
  updateConfig(interaction.guildId, { dev_user_ids: Array.from(new Set([].concat(cfg.dev_user_ids || [], [user.id]))) });
  return reply(interaction, 'Dev added', '<@' + user.id + '> now has Dev access, above admin and owner.');
}

module.exports = { handleRoleConfig };
