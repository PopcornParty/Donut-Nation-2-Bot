const { updateConfig, getConfig } = require('../db');
const { HARDCODED_DEVS } = require('../utils/permissions');
const { success, error, base, THEME } = require('../utils/embeds');

function reply(interaction, title, text, bad) {
  return interaction.reply({
    ephemeral: true,
    embeds: [bad ? error('Not allowed', text) : success(title, text)]
  });
}

async function handleRoleConfig(interaction) {
  if (interaction.commandName !== 'dev') return null;
  if (!HARDCODED_DEVS.includes(String(interaction.user.id))) {
    return reply(interaction, '', 'This command is only for the bot Dev.', true);
  }
  const sub = interaction.options.getSubcommand();
  const cfg = getConfig(interaction.guildId);
  if (sub === 'view') {
    return interaction.reply({
      ephemeral: true,
      embeds: [base('Dev role settings', THEME.pink).addFields(
        { name: 'Admin', value: (cfg.admin_role_ids || []).length ? cfg.admin_role_ids.map((id) => '<@&' + id + '>').join(' ') : 'Not set', inline: true },
        { name: 'Staff', value: (cfg.staff_role_ids || []).length ? cfg.staff_role_ids.map((id) => '<@&' + id + '>').join(' ') : 'Not set', inline: true },
        { name: 'Member', value: cfg.member_role_id ? '<@&' + cfg.member_role_id + '>' : 'Not set', inline: true }
      )]
    });
  }
  if (sub === 'admin') {
    updateConfig(interaction.guildId, { admin_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Admin role set', 'Saved.');
  }
  if (sub === 'staff') {
    updateConfig(interaction.guildId, { staff_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Staff role set', 'Saved.');
  }
  if (sub === 'member') {
    updateConfig(interaction.guildId, { member_role_id: interaction.options.getRole('role', true).id });
    return reply(interaction, 'Member role set', 'Saved.');
  }
  return null;
}

module.exports = { handleRoleConfig };
