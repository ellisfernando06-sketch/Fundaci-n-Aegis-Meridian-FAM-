const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const {
  ALERTAS,
  sitiosDisponibles,
  embedAlertaActual,
  declararAlerta,
  emojiAlerta,
} = require('../services/operaciones');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

const NIVELES = ALERTAS.map((a) => ({
  name: `${a.emoji} ${a.codigo}`,
  value: a.codigo,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alerta')
    .setDescription('Estado de alerta del sitio')
    .addSubcommand((s) =>
      s.setName('estado')
        .setDescription('Consulta el nivel de alerta actual')
    )
    .addSubcommand((s) =>
      s.setName('declarar')
        .setDescription('Declara un nuevo nivel de alerta')
        .addStringOption((o) =>
          o.setName('nivel').setDescription('Nivel de alerta').setRequired(true).addChoices(...NIVELES)
        )
        .addStringOption((o) => o.setName('mensaje').setDescription('Mensaje operativo').setRequired(false))
        .addStringOption((o) =>
          o.setName('sitio').setDescription('Sitio afectado').setRequired(false).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('historial')
        .setDescription('Historial reciente de alertas')
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'sitio') return interaction.respond([]);
    const q = String(focused.value || '').toLowerCase();
    const sitios = sitiosDisponibles();
    return interaction.respond(
      sitios
        .filter((s) => !q || String(s).toLowerCase().includes(q))
        .slice(0, 25)
        .map((s) => ({ name: String(s).slice(0, 100), value: String(s).slice(0, 100) }))
    );
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'estado') {
      await interaction.reply({
        embeds: [embedAlertaActual()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'historial') {
      const rows = getDb().prepare(
        'SELECT * FROM alertas ORDER BY creado_en DESC LIMIT 15'
      ).all();
      const desc = rows.length
        ? rows.map((r) =>
          `${emojiAlerta(r.nivel)} **${r.nivel}**` +
          (r.nivel_anterior ? ` (antes ${r.nivel_anterior})` : '') +
          ` · ${r.creado_en}` +
          (r.sitio ? ` · ${r.sitio}` : '') +
          `\n${r.mensaje || ''}`
        ).join('\n\n')
        : 'Sin historial de alertas.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: 'Historial de alertas',
          descripcion: truncar(desc, 4000),
          footer: 'Estado del sitio',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'declarar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para declarar alertas.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const r = declararAlerta({
          nivel: interaction.options.getString('nivel'),
          mensaje: interaction.options.getString('mensaje'),
          sitio: interaction.options.getString('sitio'),
          declaradaPor: interaction.user.id,
        });
        await interaction.editReply({
          embeds: [
            embedBase({
              color: COLORES.neutral,
              titulo: 'Alerta actualizada',
              campos: [
                { name: 'Nivel nuevo', value: `${emojiAlerta(r.nivel)} ${r.nivel}`, inline: true },
                { name: 'Nivel anterior', value: r.anterior || '—', inline: true },
                { name: 'Sitio', value: r.sitio || '—', inline: true },
                { name: 'Mensaje', value: r.mensaje, inline: false },
              ],
              footer: 'Estado del sitio',
            }),
            embedAlertaActual(),
          ],
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo declarar',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Estado del sitio',
          })],
        });
      }
    }
  },
};
