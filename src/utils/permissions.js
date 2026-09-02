const { getConfig } = require('../db');

const HARDCODED_DEVS = ['1438172505423478916'];

function envIdList() {
  const names = ['DEV_USER_IDS', 'DEV_USER_ID', 'DEV_ID', 'OWNER_ID'];
  const values = [];
  for (const name of names) {
    const raw = String(process.env[name] || '').replace(/["']/g, '').replace(/\n/g, ',');
    for (const part of raw.split(/[,\s]+/)) {
      if (part) values.push(part.trim());
    }
  }
  return values.concat(HARDCODED_DEVS);
}

function memberRoleIds(member) {
  if (!member) return [];
  if (member.roles && member.roles.cache) return Array.from(member.roles.cache.keys());
  return member.roles || [];
}

function hasConfiguredRole(member, roleIds) {
  if (!roleIds || !roleIds.length) return false;
  const owned = new Set(memberRoleIds(member));
  return roleIds.some((id) => owned.has(id));
}

function isServerOwner(member) {
  return Boolean(member && member.guild && member.id === member.guild.ownerId);
}

function isDev(member, cfg) {
  if (!member) return false;
  if (HARDCODED_DEVS.includes(String(member.id))) return true;
  if (envIdList().includes(String(member.id))) return true;
  return Boolean(cfg && cfg.dev_user_ids && cfg.dev_user_ids.includes(member.id));
}

function getAccess(member, guildId) {
  const cfg = getConfig(guildId);
  const dev = isDev(member, cfg);
  const owner = dev || isServerOwner(member) || Boolean(member && cfg.owner_user_ids && cfg.owner_user_ids.includes(member.id));
  const admin = owner || hasConfiguredRole(member, cfg.admin_role_ids);
  const staff = admin || hasConfiguredRole(member, cfg.staff_role_ids);
  const builder = staff || (cfg.builder_role_id && memberRoleIds(member).includes(cfg.builder_role_id));
  const customer = staff || (cfg.customer_role_id && memberRoleIds(member).includes(cfg.customer_role_id));
  return { dev, owner, admin, staff, builder, customer, config: cfg };
}

function requireAccess(interaction, level) {
  const access = getAccess(interaction.member, interaction.guildId);
  if (access.dev) return { ok: true, access };
  if (level === 'dev' && !access.dev) return { ok: false, access, message: 'Only a Dev can do that.' };
  if (level === 'owner' && !access.owner) return { ok: false, access, message: 'Only the server owner or a Dev can do that.' };
  if (level === 'admin' && !access.admin) return { ok: false, access, message: 'Set an Admin role first with /setup admin.' };
  if (level === 'staff' && !access.staff) return { ok: false, access, message: 'This command is limited to staff.' };
  if (level === 'builder' && !access.builder) return { ok: false, access, message: 'This command is limited to builders and staff.' };
  return { ok: true, access };
}

module.exports = { getAccess, requireAccess, isServerOwner, isDev, hasConfiguredRole, HARDCODED_DEVS };
