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
} = require('../services/tickets');
const { setConfig, getConfig } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Panel de tickets y configuracion')
    .addSubcommand((s) =>
      s.setName('panel')
        .setDescription('Publica el panel de tickets en este canal')
    )
    .addSubcommand((s) =>
      s.setName('config_logs')
        .setDescription('Define el canal donde se envian las transcripciones')
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

      await interaction.channel.send({
        embeds: [panelEmbed()],
        components: [panelBotones()],
      });

      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Panel publicado',
          descripcion: `Panel de tickets en <#${interaction.channel.id}>.\n\n**Publicado por:** ${actorTexto(interaction.user)}`,
          footer: 'Tickets',
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
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Logs de tickets configurados',
          campos: [
            { name: 'Canal', value: `<#${canal.id}>`, inline: true },
            { name: 'Configurado por', value: actorTexto(interaction.user), inline: true },
          ],
          footer: 'Tickets',
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
