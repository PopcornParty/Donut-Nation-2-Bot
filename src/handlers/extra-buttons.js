const { getAccess } = require('../utils/permissions');
const { success, error } = require('../utils/embeds');
const payments = require('../systems/payments');
const giveaways = require('../systems/giveaways');
const { markPrizePaid } = require('../systems/gw-paid');

async function handleExtraButton(interaction) {
  const [action, id] = interaction.customId.split(':');
  const access = getAccess(interaction.member, interaction.guildId);
  if (action === 'pay_paid') {
    if (!access.staff && !access.dev) return interaction.reply({ ephemeral: true, embeds: [error('Not allowed', 'Staff only.')] });
    const pay = payments.getPayment(id);
    if (!pay) return interaction.reply({ ephemeral: true, embeds: [error('Oops', 'Payment not found.')] });
    const updated = payments.setPaymentStatus(pay.id, 'paid');
    return interaction.reply({ embeds: [payments.paymentEmbed(updated, 'Payment completed')] });
  }
  if (action === 'gw_paid') {
    if (!access.staff && !access.dev) return interaction.reply({ ephemeral: true, embeds: [error('Not allowed', 'Staff only.')] });
    const row = giveaways.getGiveaway(id);
    if (!row) return interaction.reply({ ephemeral: true, embeds: [error('Oops', 'Giveaway not found.')] });
    const updated = markPrizePaid(row, interaction.user.id);
    const winners = giveaways.parseWinners(updated);
    return interaction.reply({ embeds: [success('Giveaway marked paid', '`' + updated.id + '` is paid.\nWinner: ' + (winners.map((w) => '<@' + w + '>').join(', ') || 'None'))] });
  }
  return null;
}

module.exports = { handleExtraButton };
