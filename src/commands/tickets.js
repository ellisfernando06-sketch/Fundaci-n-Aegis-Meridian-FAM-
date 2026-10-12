const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  panelEmbed,
  panelBotones,
  asegurarTabla,
  iconoInstitucional,
} = require('../services/tickets');
const { setConfig } = require('../db');
const { embedBase, COLORES, MARCA } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Mesa de Asistencia · panel y configuracion')
    .addSubcommand((s) =>
      s.setName('panel')
        .setDescription('Publica el panel institucional de tickets en este canal')
    )
    .addSubcommand((s) =>
      s.setName('config_logs')
        .setDescription('Canal de archivo de transcripciones')
        .addChannelOption((o) =>
          o.setName('canal')
            .setDescription('Canal de logs de tickets')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    asegurarTabla();
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: 'Se requiere Administrator para publicar el panel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const ctx = { client: interaction.client, guild: interaction.guild };
      await interaction.channel.send({
        embeds: [panelEmbed(ctx)],
        components: panelBotones(),
      });

      const icon = iconoInstitucional(interaction.client, interaction.guild);
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.institucional,
          author: { name: MARCA.nombre, iconURL: icon || undefined },
          titulo: 'Panel publicado',
          descripcion:
            `La **Mesa de Asistencia** quedó activa en <#${interaction.channel.id}>.\n\n` +
            `**Publicado por:** ${actorTexto(interaction.user)}`,
          footer: MARCA.division,
          footerIcon: icon || undefined,
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'config_logs') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: 'Se requiere Administrator.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const canal = interaction.options.getChannel('canal');
      setConfig('canal_log_tickets', canal.id);
      const icon = iconoInstitucional(interaction.client, interaction.guild);
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.institucional,
          author: { name: MARCA.nombre, iconURL: icon || undefined },
          titulo: 'Archivo de tickets configurado',
          campos: [
            { name: 'Canal', value: `<#${canal.id}>`, inline: true },
            { name: 'Configurado por', value: actorTexto(interaction.user), inline: true },
          ],
          footer: MARCA.division,
          footerIcon: icon || undefined,
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
