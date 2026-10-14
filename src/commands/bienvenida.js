const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { embedBienvenida } = require('../services/bienvenida');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');

const CANAL_BIENVENIDA = '1559071663155323022';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bienvenida')
    .setDescription('Publica el panel de bienvenida con todos los separadores · Admin')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('publicar')
        .setDescription('Publica o actualiza el mensaje de bienvenida en el canal oficial')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const ch = await interaction.guild.channels.fetch(CANAL_BIENVENIDA).catch(() => null);
    if (!ch?.isTextBased()) {
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.denegado,
            titulo: 'Canal no encontrado',
            descripcion: `No se pudo acceder al canal \`${CANAL_BIENVENIDA}\`.`,
            footer: 'Bienvenida',
          }),
        ],
      });
      return;
    }

    const embeds = embedBienvenida(interaction.client, interaction.guild);
    await ch.send({ embeds });

    auditoria.registrar(interaction.user.id, 'BIENVENIDA.PUBLICAR', { canal: CANAL_BIENVENIDA });

    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Bienvenida publicada',
          descripcion: `Panel enviado a <#${CANAL_BIENVENIDA}> con todos los separadores del organigrama.`,
          footer: 'Bienvenida',
        }),
      ],
    });
  },
};

module.exports.CANAL_BIENVENIDA = CANAL_BIENVENIDA;
