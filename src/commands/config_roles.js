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
    .setDescription('Análisis y sincronización de roles del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('¿Qué deseas hacer?')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Modo solo lectura · detecta faltantes y coincidencias',
          emoji: '🔍',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Crea roles del organigrama que no existan',
          emoji: '🛠️',
        },
        {
          label: 'Vincular roles existentes',
          value: 'vincular',
          description: 'Asocia roles del servidor a cargos del organigrama',
          emoji: '🔗',
        },
        {
          label: 'Sincronizar colores y orden',
          value: 'sincronizar',
          description: 'Ajusta color y posición de roles vinculados',
          emoji: '🎨',
        },
        {
          label: 'Exportar informe',
          value: 'exportar',
          description: 'Genera un informe completo del estado de roles',
          emoji: '📄',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Configuración de roles',
      descripcion: 'Selecciona una acción. El análisis no modifica nada del servidor.',
      footer: 'Administración',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
