const { updateConfig, getConfig } = require('../db');
const { HARDCODED_DEVS, getAccess } = require('../utils/permissions');
const { success, error, base, THEME } = require('../utils/embeds');

function reply(interaction, title, text, bad) {
  return interaction.reply({ ephemeral: true, embeds: [bad ? error('Not allowed', text) : success(title, text)] });
}

async function handleRoleConfig(interaction) {
  if (interaction.commandName !== 'dev' && interaction.commandName !== 'transferowner') return null;
  if (interaction.commandName === 'transferowner' || (interaction.commandName === 'dev' && interaction.options.getSubcommand(false) === 'transfer')) {
    if (!HARDCODED_DEVS.includes(String(interaction.user.id))) {
      return reply(interaction, '', 'Only the locked Dev account can transfer ownership.', true);
    }
    const user = interaction.options.getUser('user', true);
    const guild = interaction.guild;
    if (guild.ownerId !== interaction.client.user.id) {
      return interaction.reply({ ephemeral: true, embeds: [error('Discord will not allow this', 'A bot can only transfer a server it owns.\nThis server is owned by <@' + guild.ownerId + '>, not the bot.\n\nUse Discord: Server Settings → Members → Transfer Ownership from the current owner account.\nIf that account was hacked, recover it with Discord Support. The bot cannot take ownership from a person.')] });
    }
    try {
      await guild.setOwner(user, 'Requested by locked Dev ' + interaction.user.id);
      return reply(interaction, 'Ownership transferred', 'New owner is <@' + user.id + '>.');
    } catch (err) {
      return reply(interaction, '', 'Discord blocked the transfer: ' + err.message, true);
    }
  }

  const access = getAccess(interaction.member, interaction.guildId);
  if (!HARDCODED_DEVS.includes(String(interaction.user.id)) && !access.admin) {
    return reply(interaction, '', 'Only Dev, Admin, or Moderator can use /dev.', true);
  }
  const sub = interaction.options.getSubcommand();
  const cfg = getConfig(interaction.guildId);
  if (sub === 'view') {
    return interaction.reply({ ephemeral: true, embeds: [base('Dev role settings', THEME.pink).addFields(
      { name: 'Admin / Moderator', value: (cfg.admin_role_ids || []).length ? cfg.admin_role_ids.map((id) => '<@&' + id + '>').join(' ') : 'Not set', inline: true },
      { name: 'Staff', value: (cfg.staff_role_ids || []).length ? cfg.staff_role_ids.map((id) => '<@&' + id + '>').join(' ') : 'Not set', inline: true },
      { name: 'Member', value: cfg.member_role_id ? '<@&' + cfg.member_role_id + '>' : 'Not set', inline: true }
    )] });
  }
  if (sub === 'admin') {
    updateConfig(interaction.guildId, { admin_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Admin role set', 'That role can use /dev and staff commands.');
  }
  if (sub === 'staff') {
    updateConfig(interaction.guildId, { staff_role_ids: [interaction.options.getRole('role', true).id] });
    return reply(interaction, 'Staff role set', 'Saved.');
  }
  if (sub === 'member') {
    const role = interaction.options.getRole('role', true);
    if (role.id === interaction.guild.id) return reply(interaction, '', '@everyone is not a Member role.', true);
    updateConfig(interaction.guildId, { member_role_id: role.id });
    return reply(interaction, 'Member role set', 'Saved ' + role.name + '.');
  }
  if (sub === 'role') {
    const action = interaction.options.getString('action', true);
    if (action === 'create') {
      const created = await interaction.guild.roles.create({ name: interaction.options.getString('name', true), reason: 'Created by /dev role' });
      return reply(interaction, 'Role created', 'Created ' + created.name + '.');
    }
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return reply(interaction, '', 'Could not find that member.', true);
    try { await member.roles.add(role, 'Added by /dev role'); }
    catch (err) { return reply(interaction, '', 'Put the bot role above that role and enable Manage Roles.', true); }
    return reply(interaction, 'Role added', 'Gave ' + role.name + ' to ' + user.username + '.');
  }
  return null;
}
module.exports = { handleRoleConfig };
