const { updateConfig, getConfig, logEvent } = require('../db');
const { isRoot, isEveryoneRole, HARDCODED_DEVS } = require('../utils/permissions');
const { success, error, base, THEME } = require('../utils/embeds');

function reply(interaction, title, text, bad) {
  return interaction.reply({
    ephemeral: true,
    embeds: [bad ? error('Not allowed', text) : success(title, text)]
  });
}

function roleLine(ids) {
  if (!ids || !ids.length) return 'Not set';
  return ids.map((id) => '<@&' + id + '>').join(' ');
}

async function handleRoleConfig(interaction) {
  if (interaction.commandName !== 'dev') return false;

  if (!isRoot(interaction.member, interaction.user)) {
    await reply(
      interaction,
      '',
      'Hidden Dev commands are only for user ' + HARDCODED_DEVS[0] + ' or the server owner.',
      true
    );
    return true;
  }

  const sub = interaction.options.getSubcommand();
  const cfg = getConfig(interaction.guildId);

  if (sub === 'help') {
    await interaction.reply({
      ephemeral: true,
      embeds: [base('Hidden Dev commands', THEME.pink).setDescription(
        [
          'You are Dev. Only your user ID (`' + HARDCODED_DEVS[0] + '`) or the server owner can use these.',
          '',
          '`/dev admin` — set which Discord role has Admin',
          '`/dev staff` — set which Discord role has Staff',
          '`/dev member` — set which Discord role is Member',
          '`/dev builder` — set the Builder role',
          '`/dev customer` — set the Customer role',
          '`/dev addowner` — give extra owner bot access to one user',
          '`/dev removeowner` — remove extra owner bot access',
          '`/dev view` — see the saved roles',
          '`/dev help` — this list',
          '',
          'Members who try these commands are blocked.'
        ].join('\n')
      )]
    });
    return true;
  }

  if (sub === 'view') {
    await interaction.reply({
      ephemeral: true,
      embeds: [base('Dev role settings', THEME.pink).addFields(
        { name: 'Admin', value: roleLine(cfg.admin_role_ids), inline: true },
        { name: 'Staff', value: roleLine(cfg.staff_role_ids), inline: true },
        { name: 'Member', value: cfg.member_role_id ? '<@&' + cfg.member_role_id + '>' : 'Not set', inline: true },
        { name: 'Builder', value: cfg.builder_role_id ? '<@&' + cfg.builder_role_id + '>' : 'Not set', inline: true },
        { name: 'Customer', value: cfg.customer_role_id ? '<@&' + cfg.customer_role_id + '>' : 'Not set', inline: true },
        {
          name: 'Extra owners',
          value: (cfg.owner_user_ids || []).length ? cfg.owner_user_ids.map((id) => '<@' + id + '>').join(' ') : 'None',
          inline: false
        }
      )]
    });
    return true;
  }

  if (sub === 'admin' || sub === 'staff' || sub === 'member' || sub === 'builder' || sub === 'customer') {
    const role = interaction.options.getRole('role', true);
    if (isEveryoneRole(role, interaction.guild)) {
      await reply(interaction, '', 'You cannot use @everyone as a staff / admin / member role.', true);
      return true;
    }
    const patch = {};
    if (sub === 'admin') patch.admin_role_ids = [role.id];
    if (sub === 'staff') patch.staff_role_ids = [role.id];
    if (sub === 'member') patch.member_role_id = role.id;
    if (sub === 'builder') patch.builder_role_id = role.id;
    if (sub === 'customer') patch.customer_role_id = role.id;
    updateConfig(interaction.guildId, patch);
    logEvent({
      guildId: interaction.guildId,
      category: 'config',
      message: 'Dev set ' + sub + ' role to ' + role.id,
      actorId: interaction.user.id
    });
    await reply(interaction, sub.charAt(0).toUpperCase() + sub.slice(1) + ' role set', 'Saved ' + String(role) + '.');
    return true;
  }

  if (sub === 'addowner' || sub === 'removeowner') {
    const user = interaction.options.getUser('user', true);
    const current = Array.isArray(cfg.owner_user_ids) ? cfg.owner_user_ids.map(String) : [];
    let next;
    if (sub === 'addowner') next = Array.from(new Set(current.concat([user.id])));
    else next = current.filter((id) => id !== user.id);
    updateConfig(interaction.guildId, { owner_user_ids: next });
    logEvent({
      guildId: interaction.guildId,
      category: 'config',
      message: (sub === 'addowner' ? 'Added' : 'Removed') + ' extra owner ' + user.id,
      actorId: interaction.user.id
    });
    await reply(
      interaction,
      sub === 'addowner' ? 'Extra owner added' : 'Extra owner removed',
      String(user) + (sub === 'addowner' ? ' can now use owner-level bot commands.' : ' no longer has extra owner access.')
    );
    return true;
  }

  await reply(interaction, '', 'Unknown /dev subcommand.', true);
  return true;
}

module.exports = { handleRoleConfig };
