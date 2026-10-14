const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  FRECUENCIAS,
  emitirRadio,
  embedRadio,
  publicarLog,
  asegurarTablas,
} = require('../services/roleplay');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Comunicaciones por radio del sitio · Uso: personal en turno / miembros')
    .addSubcommand((s) =>
      s
        .setName('emitir')
        .setDescription('Emite un mensaje por frecuencia')
        .addStringOption((o) =>
          o
            .setName('frecuencia')
            .setDescription('Canal de radio')
            .setRequired(true)
            .addChoices(...FRECUENCIAS.map((f) => ({ name: `${f.nombre} [${f.id}]`, value: f.id })))
        )
        .addStringOption((o) =>
          o.setName('mensaje').setDescription('Contenido de la transmision').setRequired(true).setMaxLength(500)
        )
    )
    .addSubcommand((s) =>
      s.setName('frecuencias').setDescription('Lista las frecuencias disponibles')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'frecuencias') {
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.seguridad,
            author: true,
            titulo: 'Frecuencias de radio',
            descripcion: FRECUENCIAS.map((f) => `**${f.id}** · ${f.nombre}`).join('\n'),
            footer: 'Comunicaciones',
          }),
        ],
      });
      return;
    }

    const frecuencia = interaction.options.getString('frecuencia');
    const mensaje = interaction.options.getString('mensaje');
    const tx = emitirRadio(interaction.user.id, frecuencia, mensaje, interaction.channelId);
    const embed = embedRadio(frecuencia, `<@${interaction.user.id}>`, tx.mensaje, tx.id);

    await interaction.channel.send({ embeds: [embed] }).catch(() => {});
    await publicarLog(interaction.guild, 'canal_radio', { embeds: [embed] });

    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Transmision enviada',
          descripcion: `**${tx.id}** · Frecuencia **${frecuencia}**`,
          footer: 'Comunicaciones',
        }),
      ],
    });
  },
};
