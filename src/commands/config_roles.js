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
    .setDescription('Crear, analizar y organizar el organigrama de roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Selecciona una accion')
      .addOptions([
        {
          label: 'Desplegar organigrama',
          value: 'desplegar',
          description: 'Crea los faltantes y los ordena',
          emoji: '🛠️',
        },
        {
          label: 'Ver organigrama',
          value: 'organigrama',
          description: 'Jerarquia oficial completa',
          emoji: '📋',
        },
        {
          label: 'Analizar roles',
          value: 'analizar',
          description: 'Detecta existentes y faltantes',
          emoji: '🔍',
        },
        {
          label: 'Organizar jerarquia',
          value: 'organizar',
          description: 'Solo reordena los ya creados',
          emoji: '📐',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: 'Configuracion de roles',
      descripcion: [
        '**Desplegar organigrama** — crea roles faltantes (Fundacion, Direcciones, Moderacion, facciones, permisos) y los ordena.',
        '**Ver organigrama** — lista oficial.',
        '**Analizar** — cuantos faltan.',
        '**Organizar** — solo mueve posiciones.',
        '',
        'El rol del bot debe estar **por encima** de todos los roles que vaya a crear.',
        'Borrar todos: `/eliminar_roles`',
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
