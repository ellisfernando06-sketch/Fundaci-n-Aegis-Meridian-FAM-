const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configuración general de la Fundación')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config:menu:${interaction.user.id}`)
      .setPlaceholder('¿Qué deseas hacer?')
      .addOptions([
        { label: 'Canales', value: 'canales', description: 'Configurar canales de logs y publicaciones', emoji: '📢' },
        { label: 'Registros (logs)', value: 'logs', description: 'Ver o limpiar registros de auditoría', emoji: '📜' },
        { label: 'Sitios', value: 'sitios', description: 'Gestionar sitios de la Fundación', emoji: '🏢' },
        { label: 'Clases de contención', value: 'clases', description: 'Gestionar clases de contención', emoji: '🧬' },
        { label: 'Reiniciar contadores', value: 'reiniciar', description: 'Reiniciar contadores de identificadores', emoji: '🔄' },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: '⚙️ Configuración',
      descripcion: 'Selecciona el ajuste que deseas modificar.',
      footer: 'Administración',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
