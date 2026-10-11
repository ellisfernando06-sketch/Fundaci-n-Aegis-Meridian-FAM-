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
    .setName('config_roles')
    .setDescription('Análisis, creación y organización de roles del organigrama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('¿Qué deseas hacer?')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Detecta existentes, parciales y faltantes',
          emoji: '🔍',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Formato XX ●┇Nombre · no toca los que ya están',
          emoji: '🛠️',
        },
        {
          label: 'Organizar jerarquía',
          value: 'organizar',
          description: 'Ordena por sección · SI encima de Director General',
          emoji: '📐',
        },
        {
          label: 'Eliminar roles Aegis del bot',
          value: 'eliminar_bot',
          description: 'Borra formato organigrama creados por el bot',
          emoji: '🗑️',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Configuración de roles',
      descripcion: 'Formato oficial: **XX ●┇Nombre** (ej. `MED ●┇Director Médico`).\nDetecta por nombre los roles que ya tienes, crea solo faltantes y organiza con separadores.',
      footer: 'Administración',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
