const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  abrirTurno,
  cerrarTurno,
  turnoActivo,
  embedTurno,
  publicarLog,
  asegurarTablas,
} = require('../services/roleplay');
const { embedBase, COLORES } = require('../utils/plantillas');
const { getDb } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('turno')
    .setDescription('Control de turno de servicio · Uso: personal activo')
    .addSubcommand((s) =>
      s
        .setName('iniciar')
        .setDescription('Inicia tu turno de servicio')
        .addStringOption((o) => o.setName('area').setDescription('Area o puesto').setRequired(false))
        .addStringOption((o) => o.setName('personaje').setDescription('Nombre del personaje').setRequired(false))
        .addStringOption((o) => o.setName('notas').setDescription('Notas de turno').setRequired(false))
    )
    .addSubcommand((s) => s.setName('cerrar').setDescription('Cierra tu turno activo'))
    .addSubcommand((s) => s.setName('estado').setDescription('Consulta tu turno actual'))
    .addSubcommand((s) =>
      s
        .setName('activos')
        .setDescription('Lista personal en turno (mando)')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'iniciar') {
      const res = abrirTurno(
        interaction.user.id,
        interaction.options.getString('personaje'),
        interaction.options.getString('area'),
        interaction.options.getString('notas')
      );
      if (!res.ok) {
        await interaction.editReply({ content: res.motivo });
        return;
      }
      const embed = embedTurno(res.turno, 'inicio');
      await publicarLog(interaction.guild, 'canal_turnos', { embeds: [embed] });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'cerrar') {
      const res = cerrarTurno(interaction.user.id);
      if (!res.ok) {
        await interaction.editReply({ content: res.motivo });
        return;
      }
      const embed = embedTurno(res.turno, 'fin');
      await publicarLog(interaction.guild, 'canal_turnos', { embeds: [embed] });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'estado') {
      const t = turnoActivo(interaction.user.id);
      if (!t) {
        await interaction.editReply({
          embeds: [
            embedBase({
              color: COLORES.neutral,
              titulo: 'Sin turno activo',
              descripcion: 'Usa `/turno iniciar` para comenzar servicio.',
              footer: 'Turnos',
            }),
          ],
        });
        return;
      }
      await interaction.editReply({ embeds: [embedTurno(t, 'inicio')] });
      return;
    }

    if (sub === 'activos') {
      const rows = getDb()
        .prepare("SELECT * FROM turnos WHERE estado = 'activo' ORDER BY inicio DESC LIMIT 25")
        .all();
      const texto = rows.length
        ? rows.map((r) => `**${r.id}** · <@${r.discord_id}> · ${r.area || '—'} · desde ${r.inicio}`).join('\n')
        : 'Nadie en turno.';
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.seguridad,
            author: true,
            titulo: 'Personal en turno',
            descripcion: texto,
            footer: 'Turnos',
          }),
        ],
      });
    }
  },
};
