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
    .setDescription('Analisis, renombrado y organizacion de roles del organigrama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Que deseas hacer?')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Lee todos los roles y los empareja por nombre',
          emoji: '🔍',
        },
        {
          label: 'Renombrar al formato oficial',
          value: 'renombrar',
          description: 'Solo cambia el nombre · mismo rol, mismos miembros',
          emoji: '✏️',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Crea solo los que no existen por nombre',
          emoji: '🛠️',
        },
        {
          label: 'Organizar jerarquia',
          value: 'organizar',
          description: 'Coloca cada rol en su seccion',
          emoji: '📐',
        },
        {
          label: 'Eliminar roles creados por el bot',
          value: 'eliminar_bot',
          description: 'Borra solo los que el bot creo (no los renombrados)',
          emoji: '🗑️',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Configuracion de roles',
      descripcion: [
        'El bot **lee todos los roles** del servidor y los empareja **solo por nombre**.',
        '',
        '• **Renombrar** → añade el prefijo oficial (`XX ●┇`) sin crear roles nuevos',
        '• **Crear** → solo faltantes reales',
        '• **Organizar** → cada rol en su lugar de la jerarquia',
        '',
        'Los miembros y permisos de cada rol se conservan.',
      ].join('\n'),
      footer: 'Administracion · Fundacion Aegis-Meridian',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
