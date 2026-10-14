const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb, getConfig, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postulacion')
    .setDescription('Envia tu postulacion / hoja de vida RP para trabajar en la Fundacion · Uso: cualquiera'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`postulacion:enviar:${interaction.user.id}`)
      .setTitle('Postulacion · F.A.M.');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('personaje')
          .setLabel('Nombre del personaje')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(60),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('area')
          .setLabel('Area o direccion a la que aspiras')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
          .setPlaceholder('Ej. Seguridad Interna, Investigacion, Guardia...'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('experiencia')
          .setLabel('Experiencia RP / historial relevante')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(800),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('motivacion')
          .setLabel('Por que quieres ingresar a F.A.M.')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('disponibilidad')
          .setLabel('Disponibilidad (dias / horario)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100),
      ),
    );

    await interaction.showModal(modal);
  },
};
