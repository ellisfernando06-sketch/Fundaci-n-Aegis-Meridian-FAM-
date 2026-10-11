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
    .setDescription('Análisis, renombrado y organización de roles del organigrama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Que deseas hacer?')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Detecta solo por nombre',
        },
        {
          label: 'Renombrar al formato oficial',
          value: 'renombrar',
          description: 'Mismo rol, nuevo nombre XX · no se pierde nada',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Solo los que no existen por nombre',
        },
        {
          label: 'Organizar jerarquia',
          value: 'organizar',
          description: 'Ordena secciones · SI encima de Director General',
        },
        {
          label: 'Eliminar roles Aegis del bot',
          value: 'eliminar_bot',
          description: 'Borra formato organigrama del bot',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: 'Configuracion de roles',
      descripcion: 'Deteccion **solo por nombre**. Si el rol ya existe, se **renombra** al formato oficial y se conserva (miembros, permisos, ID).',
      footer: 'Administracion',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
