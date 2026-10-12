const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getOrganigramaTexto } = require('../data/organigrama');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('organigrama')
    .setDescription('Muestra el organigrama oficial de la Fundacion')
    .addBooleanOption((o) =>
      o.setName('publico')
        .setDescription('Si es verdadero, el mensaje es visible en el canal')
        .setRequired(false)
    ),

  async execute(interaction) {
    const publico = interaction.options.getBoolean('publico') || false;
    const texto = getOrganigramaTexto();
    const chunks = [];
    let actual = '';
    for (const linea of texto.split('\n')) {
      if ((actual + '\n' + linea).length > 3800) {
        chunks.push(actual);
        actual = linea;
      } else {
        actual = actual ? actual + '\n' + linea : linea;
      }
    }
    if (actual) chunks.push(actual);

    const embeds = chunks.slice(0, 8).map((desc, i) => embedBase({
      color: COLORES.cupula,
      titulo: i === 0
        ? 'Organigrama · Fundacion Aegis-Meridian'
        : `Organigrama (cont. ${i + 1})`,
      descripcion: desc,
      footer: 'Custodes Veritatis',
      timestamp: i === 0,
    }));

    await interaction.reply({
      embeds,
      flags: publico ? undefined : MessageFlags.Ephemeral,
    });
  },
};
