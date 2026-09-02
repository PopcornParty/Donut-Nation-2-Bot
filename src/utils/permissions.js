const { getConfig } = require('../db');

function memberRoleIds(member) {
  if (!member) return [];
  if (member.roles?.cache) return [...member.roles.cache.keys()];
  return member.roles || [];
}

function hasConfiguredRole(member, roleIds) {
  if (!roleIds?.length) return false;
  const owned = new Set(memberRoleIds(member));
  return roleIds.some((id) => owned.has(id));
}

function isServerOwner(member) {
  if (!member?.guild) return false;
  return member.id === member.guild.ownerId;
}

function isConfiguredOwner(member, cfg) {
  return Boolean(member && cfg.owner_user_ids?.includes(member.id));
}

function getAccess(member, guildId) {
  const cfg = getConfig(guildId);
  const owner = isServerOwner(member) || isConfiguredOwner(member, cfg);
  const admin = owner || hasConfiguredRole(member, cfg.admin_role_ids);
  const staff = admin || hasConfiguredRole(member, cfg.staff_role_ids);
  const builder = staff || (cfg.builder_role_id && memberRoleIds(member).includes(cfg.builder_role_id));
  const customer = staff || (cfg.customer_role_id && memberRoleIds(member).includes(cfg.customer_role_id));
  return { owner, admin, staff, builder, customer, config: cfg };
}

function requireAccess(interaction, level) {
  const access = getAccess(interaction.member, interaction.guildId);
  if (level === 'owner' && !access.owner) {
    return { ok: false, access, message: 'Only the server owner or an extra owner can do that.' };
  }
  if (level === 'admin' && !access.admin) {
    return { ok: false, access, message: 'The server owner must set an Admin role before you can use this.' };
  }
  if (level === 'staff' && !access.staff) {
    return { ok: false, access, message: 'This command is limited to staff.' };
  }
  if (level === 'builder' && !access.builder) {
    return { ok: false, access, message: 'This command is limited to builders and staff.' };
  }
  return { ok: true, access };
}

module.exports = {
  getAccess,
  requireAccess,
  isServerOwner,
  hasConfiguredRole
};
