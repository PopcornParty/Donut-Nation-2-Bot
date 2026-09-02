const { getConfig } = require('../db');

function envIdList(name) {
  return String(process.env[name] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

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

function isDev(member, cfg) {
  if (!member) return false;
  if (envIdList('DEV_USER_IDS').includes(member.id)) return true;
  return Boolean(cfg?.dev_user_ids?.includes(member.id));
}

function getAccess(member, guildId) {
  const cfg = getConfig(guildId);
  const dev = isDev(member, cfg);
  const owner = dev || isServerOwner(member) || isConfiguredOwner(member, cfg);
  const admin = owner || hasConfiguredRole(member, cfg.admin_role_ids);
  const staff = admin || hasConfiguredRole(member, cfg.staff_role_ids);
  const builder = staff || (cfg.builder_role_id && memberRoleIds(member).includes(cfg.builder_role_id));
  const customer = staff || (cfg.customer_role_id && memberRoleIds(member).includes(cfg.customer_role_id));
  const memberRole = !cfg.member_role_id || memberRoleIds(member).includes(cfg.member_role_id) || staff;
  return { dev, owner, admin, staff, builder, customer, member: memberRole, config: cfg };
}

function requireAccess(interaction, level) {
  const access = getAccess(interaction.member, interaction.guildId);
  if (access.dev) return { ok: true, access };
  if (level === 'dev' && !access.dev) return { ok: false, access, message: 'Only a Dev can do that.' };
  if (level === 'owner' && !access.owner) return { ok: false, access, message: 'Only the server owner, extra owner, or Dev can do that.' };
  if (level === 'admin' && !access.admin) return { ok: false, access, message: 'The server owner must set an Admin role first.' };
  if (level === 'staff' && !access.staff) return { ok: false, access, message: 'This command is limited to staff.' };
  if (level === 'builder' && !access.builder) return { ok: false, access, message: 'This command is limited to builders and staff.' };
  return { ok: true, access };
}

module.exports = { getAccess, requireAccess, isServerOwner, isDev, hasConfiguredRole };
