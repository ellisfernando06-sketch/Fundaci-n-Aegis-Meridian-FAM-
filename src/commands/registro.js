const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  ZONAS,
  registrarSitio,
  publicarLog,
  asegurarTablas,
} = require('../services/roleplay');
const { embedBase, COLORES } = require('../utils/plantillas');
const { getDb } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registro')
    .setDescription('Registro de entrada/salida y movimientos en el sitio')
    .addSubcommand((s) =>
      s
        .setName('entrada')
        .setDescription('Registra entrada al sitio o zona')
        .addStringOption((o) =>
          o
            .setName('zona')
            .setDescription('Zona')
            .setRequired(false)
            .addChoices(...ZONAS.slice(0, 25).map((z) => ({ name: z, value: z })))
        )
        .addStringOption((o) => o.setName('detalle').setDescription('Detalle').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('salida')
        .setDescription('Registra salida')
        .addStringOption((o) =>
          o
            .setName('zona')
            .setDescription('Zona')
            .setRequired(false)
            .addChoices(...ZONAS.slice(0, 25).map((z) => ({ name: z, value: z })))
        )
        .addStringOption((o) => o.setName('detalle').setDescription('Detalle').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('movimiento')
        .setDescription('Registra traslado entre zonas')
        .addStringOption((o) =>
          o
            .setName('zona')
            .setDescription('Zona destino')
            .setRequired(true)
            .addChoices(...ZONAS.slice(0, 25).map((z) => ({ name: z, value: z })))
        )
        .addStringOption((o) => o.setName('detalle').setDescription('Detalle').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('historial')
        .setDescription('Ultimos registros propios o de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Consultar a otro (mando)').setRequired(false))
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'historial') {
      const user = interaction.options.getUser('miembro') || interaction.user;
      const rows = getDb()
        .prepare('SELECT * FROM registros_sitio WHERE discord_id = ? ORDER BY creado_en DESC LIMIT 15')
        .all(user.id);
      const texto = rows.length
        ? rows.map((r) => `**${r.id}** · ${r.tipo} · ${r.zona || '—'} · ${r.creado_en}`).join('\n')
        : 'Sin registros.';
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.neutral,
            titulo: `Historial · ${user.username}`,
            descripcion: texto,
            footer: 'Registro de sitio',
          }),
        ],
      });
      return;
    }

    const tipo = sub === 'entrada' ? 'ENTRADA' : sub === 'salida' ? 'SALIDA' : 'MOVIMIENTO';
    const zona = interaction.options.getString('zona');
    const detalle = interaction.options.getString('detalle');
    const row = registrarSitio(interaction.user.id, tipo, zona, detalle);

    const embed = embedBase({
      color:
        tipo === 'ENTRADA' ? COLORES.medicina : tipo === 'SALIDA' ? COLORES.oro : COLORES.seguridad,
      author: true,
      titulo: `Registro · ${row.id}`,
      campos: [
        { name: 'Personal', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Tipo', value: tipo, inline: true },
        { name: 'Zona', value: zona || '—', inline: true },
        { name: 'Detalle', value: detalle || '—', inline: false },
        { name: 'Hora', value: row.creado_en || '—', inline: true },
      ],
      footer: 'Registro de sitio',
    });

    await publicarLog(interaction.guild, 'canal_registros', { embeds: [embed] });
    await interaction.editReply({ embeds: [embed] });
  },
};
