const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function paymentButtons(row) {
  if (!row || row.status === 'paid' || row.status === 'cancelled') return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pay_paid:' + row.id).setLabel('Mark Payment Completed').setStyle(ButtonStyle.Success)
  )];
}

module.exports = { paymentButtons };
