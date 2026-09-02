const { getConfig } = require('../db');

// Only this Discord user ID is always treated as bot Dev.
// Right-click your name in Discord -> Copy User ID.
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
  return values;
}

function userIdOf(memberOrUser) {
  if (!memberOrUser) return '';
  return String(memberOrUser.id || (memberOrUser.user && memberOrUser.user.id) || '');
}

function memberRoleIds(member) {
  if (!member) return [];
  if (member.roles && member.roles.cache) return Array.from(member.roles.cache.keys());
  return member.roles || [];
}

function hasConfiguredRole(member, roleIds) {
  if (!roleIds || !roleIds.length) return false;
  const owned = new Set(memberRoleIds(member));
  return roleIds.some((id) => owned.has(String(id)));
}

function isHardcodedDev(id) {
  const value = String(id || '');
  if (!value) return false;
  if (HARDCODED_DEVS.includes(value)) return true;
  return envIdList().includes(value);
}

function isServerOwner(member) {
  return Boolean(member && member.guild && String(member.id) === String(member.guild.ownerId));
}

// Root = your Discord ID (or DEV_USER_IDS) OR the person who owns the Discord server.
// Nobody else can become Dev through a command.
function isRoot(member, user) {
  const id = userIdOf(member) || userIdOf(user);
  if (isHardcodedDev(id)) return true;
  return isServerOwner(member);
}

function isDev(member, cfg, user) {
  return isRoot(member, user);
}

function getAccess(member, guildId, user) {
  const cfg = getConfig(guildId);
  const root = isRoot(member, user);
  const extraOwner = Boolean(
    member && cfg && Array.isArray(cfg.owner_user_ids) && cfg.owner_user_ids.map(String).includes(String(member.id))
  );
  const owner = root || extraOwner;
  const admin = owner || hasConfiguredRole(member, cfg.admin_role_ids);
  const staff = admin || hasConfiguredRole(member, cfg.staff_role_ids);
  const builder = staff || (cfg.builder_role_id && memberRoleIds(member).includes(cfg.builder_role_id));
  const customer = staff || (cfg.customer_role_id && memberRoleIds(member).includes(cfg.customer_role_id));
  return { dev: root, owner, admin, staff, builder, customer, root, config: cfg };
}

function requireAccess(interaction, level) {
  const access = getAccess(interaction.member, interaction.guildId, interaction.user);
  if (isHardcodedDev(interaction.user && interaction.user.id)) return { ok: true, access };
  if (level === 'dev' && !access.dev) {
    return { ok: false, access, message: 'Only the bot Dev or the server owner can use this command.' };
  }
  if (level === 'owner' && !access.owner) {
    return { ok: false, access, message: 'Only the server owner or the bot Dev can do that.' };
  }
  if (level === 'admin' && !access.admin) {
    return { ok: false, access, message: 'Ask the Dev or server owner to set Admin with /dev admin.' };
  }
  if (level === 'staff' && !access.staff) {
    return { ok: false, access, message: 'This command is limited to staff.' };
  }
  if (level === 'builder' && !access.builder) {
    return { ok: false, access, message: 'This command is limited to builders and staff.' };
  }
  return { ok: true, access };
}

function isEveryoneRole(role, guild) {
  if (!role) return false;
  if (role.id === (guild && guild.id)) return true;
  if (role.name === '@everyone') return true;
  return false;
}

module.exports = {
  getAccess,
  requireAccess,
  isServerOwner,
  isDev,
  isRoot,
  isHardcodedDev,
  hasConfiguredRole,
  isEveryoneRole,
  HARDCODED_DEVS
};
