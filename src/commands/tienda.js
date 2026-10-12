const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  asegurarTienda,
  listarItems,
  embedCatalogo,
  botonesCatalogo,
  esFundador,
  getImpuestoPct,
  formatear,
  obtenerSaldo,
} = require('../services/tienda');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tienda')
    .setDescription('Economato interno de la Fundacion')
    .addSubcommand((s) =>
      s.setName('catalogo')
        .setDescription('Ver articulos y comprar con creditos Aegis')
    )
    .addSubcommand((s) =>
      s.setName('gestion')
        .setDescription('Fundador: alta de articulos e impuesto')
    ),

  async execute(interaction) {
    asegurarTienda();
    const sub = interaction.options.getSubcommand();

    if (sub === 'catalogo') {
      const items = listarItems(true);
      const saldo = obtenerSaldo(interaction.user.id);
      await interaction.reply({
        embeds: [
          embedCatalogo(items),
          embedBase({
            color: 0x1a1a2e,
            titulo: 'Tu cuenta',
            campos: [
              { name: 'Saldo', value: formatear(saldo), inline: true },
              { name: 'Recargo multas', value: `${getImpuestoPct()}%`, inline: true },
            ],
            footer: 'Economato',
          }),
        ],
        components: botonesCatalogo(items),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'gestion') {
      if (!esFundador(interaction.member)) {
        await interaction.reply({
          content: 'Solo el Fundador gestiona el economato.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('tienda:nuevo_item')
          .setLabel('Nuevo articulo')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('tienda:impuesto')
          .setLabel('Ajustar impuesto/recargo')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        embeds: [embedBase({
          color: 0x1a1a2e,
          titulo: 'Gestion del economato',
          descripcion:
            `Recargo actual sobre multas: **${getImpuestoPct()}%**.\n\n` +
            'Da de alta articulos o ajusta el recargo institucional.',
          campos: [
            { name: 'Operador', value: actorTexto(interaction.user), inline: false },
          ],
          footer: 'Economato',
        })],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
