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
          description: 'Detecta existentes, parciales y faltantes',
          emoji: '🔍',
        },
        {
          label: 'Crear solo faltantes',
          value: 'crear',
          description: 'Crea con el mismo estilo de los roles ya detectados',
          emoji: '🛠️',
        },
        {
          label: 'Eliminar roles creados por el bot',
          value: 'eliminar_bot',
          description: 'Borra solo los que creó Aegis; conserva los originales',
          emoji: '🗑️',
        },
        {
          label: 'Vincular roles existentes',
          value: 'vincular',
          description: 'Asocia roles del servidor al organigrama',
          emoji: '🔗',
        },
        {
          label: 'Sincronizar colores',
          value: 'sincronizar',
          description: 'Ajusta color de roles vinculados',
          emoji: '🎨',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Configuración de roles',
      descripcion: 'Los roles que ya estaban en el servidor se conservan. El bot solo crea los faltantes y puede eliminar únicamente los que él generó.',
      footer: 'Administración',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
