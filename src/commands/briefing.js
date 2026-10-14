const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { crearBriefing, publicarLog, asegurarTablas } = require('../services/roleplay');
const { embedBase, COLORES } = require('../utils/plantillas');
const { getDb } = require('../db');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('briefing')
    .setDescription('Briefing operativo previo a mision · Uso: mando / seguridad')
    .addSubcommand((s) =>
      s
        .setName('crear')
        .setDescription('Publica un briefing')
        .addStringOption((o) => o.setName('titulo').setDescription('Titulo').setRequired(true).setMaxLength(120))
        .addStringOption((o) =>
          o.setName('contenido').setDescription('Objetivos, amenazas, equipo').setRequired(true).setMaxLength(2000)
        )
        .addStringOption((o) => o.setName('mision').setDescription('ID de mision (MIS-xxxx)').setRequired(false))
        .addBooleanOption((o) =>
          o.setName('publico').setDescription('Publicar en este canal (default si)').setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('ver')
        .setDescription('Consulta un briefing')
        .addStringOption((o) => o.setName('id').setDescription('ID BRF-xxxx').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'crear') {
      const titulo = interaction.options.getString('titulo');
      const contenido = interaction.options.getString('contenido');
      const mision = interaction.options.getString('mision');
      const publico = interaction.options.getBoolean('publico');
      const row = crearBriefing(interaction.user.id, titulo, contenido, mision);

      const embed = embedBase({
        color: COLORES.cupula,
        author: true,
        titulo: `Briefing · ${row.id}`,
        descripcion: truncar(contenido, 3500),
        campos: [
          { name: 'Titulo', value: titulo, inline: false },
          { name: 'Mision', value: mision || '—', inline: true },
          { name: 'Autor', value: `<@${interaction.user.id}>`, inline: true },
        ],
        footer: 'Briefings',
      });

      if (publico !== false) {
        const msg = await interaction.channel.send({ embeds: [embed] }).catch(() => null);
        if (msg) {
          getDb()
            .prepare('UPDATE briefings SET canal_id = ?, msg_id = ? WHERE id = ?')
            .run(interaction.channelId, msg.id, row.id);
        }
      }
      await publicarLog(interaction.guild, 'canal_operaciones', { embeds: [embed] });
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Briefing registrado',
            descripcion: `**${row.id}** publicado.`,
            footer: 'Briefings',
          }),
        ],
      });
      return;
    }

    if (sub === 'ver') {
      const id = interaction.options.getString('id').trim().toUpperCase();
      const row = getDb().prepare('SELECT * FROM briefings WHERE id = ?').get(id);
      if (!row) {
        await interaction.editReply({ content: 'Briefing no encontrado.' });
        return;
      }
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.cupula,
            author: true,
            titulo: `Briefing · ${row.id}`,
            descripcion: truncar(row.contenido, 3500),
            campos: [
              { name: 'Titulo', value: row.titulo, inline: false },
              { name: 'Mision', value: row.mision_id || '—', inline: true },
              { name: 'Autor', value: `<@${row.autor_id}>`, inline: true },
            ],
            footer: 'Briefings',
          }),
        ],
      });
    }
  },
};
