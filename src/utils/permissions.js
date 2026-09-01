const { PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../db');

function memberRoleIds(member) {
  if (!member) return [];
  if (member.roles?.cache) return [...member.roles.cache.keys()];
  return member.roles || [];
}

function isGuildAdmin(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  return false;
}

function hasConfiguredRole(member, roleIds) {
  if (!roleIds?.length) return false;
  const owned = new Set(memberRoleIds(member));
  return roleIds.some((id) => owned.has(id));
}

function getAccess(member, guildId) {
  const cfg = getConfig(guildId);
  const admin = isGuildAdmin(member) || hasConfiguredRole(member, cfg.admin_role_ids);
  const staff = admin || hasConfiguredRole(member, cfg.staff_role_ids);
  const builder = admin || staff || (cfg.builder_role_id && memberRoleIds(member).includes(cfg.builder_role_id));
  const customer = admin || staff || (cfg.customer_role_id && memberRoleIds(member).includes(cfg.customer_role_id));
  return { admin, staff, builder, customer, config: cfg };
}

function requireAccess(interaction, level) {
  const access = getAccess(interaction.member, interaction.guildId);
  if (level === 'admin' && !access.admin) {
    return { ok: false, access, message: 'This command is limited to administrators.' };
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
  isGuildAdmin,
  hasConfiguredRole
};
