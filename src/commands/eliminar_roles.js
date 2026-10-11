const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eliminar_roles')
    .setDescription('Elimina todos los roles del servidor que el bot pueda borrar')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.roles.fetch();

    const candidatos = [...guild.roles.cache.values()].filter((r) => {
      if (r.id === guild.id) return false;
      if (r.managed) return false;
      if (!r.editable) return false;
      return true;
    });

    if (!candidatos.length) {
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: 'Eliminar roles',
          descripcion: 'No hay roles que el bot pueda eliminar. (@everyone, roles de bots y roles por encima del bot se omiten.)',
          footer: 'Administracion',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const preview = candidatos
      .sort((a, b) => b.position - a.position)
      .slice(0, 30)
      .map((r) => `· ${r.name}`)
      .join('\n');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`eliminar_todos:ejecutar:${interaction.user.id}`)
        .setLabel(`Eliminar ${candidatos.length} roles`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`eliminar_todos:cancelar:${interaction.user.id}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Eliminar TODOS los roles',
        descripcion: [
          `Se eliminaran **${candidatos.length}** roles.`,
          '',
          '**No se eliminan:**',
          '· @everyone',
          '· Roles de bots / integraciones',
          '· Roles por encima del bot (no editables)',
          '',
          '**Vista previa:**',
          preview,
          candidatos.length > 30 ? `… +${candidatos.length - 30}` : '',
          '',
          'Esta accion no se puede deshacer.',
          'Al confirmar, los botones desaparecen para evitar duplicacion.',
        ].filter(Boolean).join('\n'),
        footer: 'Confirmacion requerida',
      })],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
