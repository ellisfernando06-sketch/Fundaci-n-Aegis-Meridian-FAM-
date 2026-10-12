const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

const TIPOS = [
  { name: 'Amonestacion verbal', value: 'Amonestacion verbal' },
  { name: 'Amonestacion escrita', value: 'Amonestacion escrita' },
  { name: 'Suspension temporal', value: 'Suspension temporal' },
  { name: 'Degradacion', value: 'Degradacion' },
  { name: 'Expulsion de area', value: 'Expulsion de area' },
  { name: 'Expulsion de la Fundacion', value: 'Expulsion de la Fundacion' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sancion')
    .setDescription('Registro y consulta de sanciones disciplinarias')
    .addSubcommand((s) =>
      s.setName('aplicar')
        .setDescription('Aplica una sancion a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Sancionado').setRequired(true))
        .addStringOption((o) =>
          o.setName('tipo').setDescription('Tipo de sancion').setRequired(true).addChoices(...TIPOS)
        )
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('dias').setDescription('Dias (si aplica suspension)').setRequired(false).setMinValue(1)
        )
        .addStringOption((o) =>
          o.setName('incidente').setDescription('Incidente vinculado INC-xxxx').setRequired(false).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('consultar')
        .setDescription('Consulta sanciones de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista sanciones recientes')
    )
    .addSubcommand((s) =>
      s.setName('levantar')
        .setDescription('Levanta una sancion activa')
        .addStringOption((o) =>
          o.setName('id').setDescription('ID SAN-xxxx').setRequired(true).setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const q = String(focused.value || '').toLowerCase();
    if (focused.name === 'incidente') {
      const rows = getDb().prepare(
        'SELECT id, gravedad FROM incidentes ORDER BY creado_en DESC LIMIT 40'
      ).all();
      return interaction.respond(
        rows
          .filter((r) => !q || r.id.toLowerCase().includes(q))
          .slice(0, 25)
          .map((r) => ({ name: `${r.id} · ${r.gravedad}`.slice(0, 100), value: r.id }))
      );
    }
    if (focused.name === 'id') {
      const rows = getDb().prepare(
        "SELECT id, tipo, estado FROM sanciones WHERE estado = 'Activa' ORDER BY creado_en DESC LIMIT 40"
      ).all();
      return interaction.respond(
        rows
          .filter((r) => !q || r.id.toLowerCase().includes(q))
          .slice(0, 25)
          .map((r) => ({ name: `${r.id} · ${r.tipo}`.slice(0, 100), value: r.id }))
      );
    }
    return interaction.respond([]);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'aplicar') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const user = interaction.options.getUser('miembro');
      const tipo = interaction.options.getString('tipo');
      const motivo = sanitizar(interaction.options.getString('motivo'));
      const dias = interaction.options.getInteger('dias');
      const incidenteId = interaction.options.getString('incidente');

      if (incidenteId) {
        const inc = db.prepare('SELECT id FROM incidentes WHERE id = ?').get(incidenteId);
        if (!inc) {
          await interaction.editReply({
            embeds: [embedBase({
              color: COLORES.denegado,
              titulo: 'Incidente no encontrado',
              descripcion: `No existe \`${incidenteId}\`.`,
              footer: 'Sanciones',
            })],
          });
          return;
        }
      }

      const id = nextId('SAN');
      let vence = null;
      if (dias) {
        const d = new Date();
        d.setDate(d.getDate() + dias);
        vence = d.toISOString();
      }

      db.prepare(`
        INSERT INTO sanciones (id, sancionado_id, tipo, dias, emitida_por, motivo, incidente_id, estado, vence_en)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Activa', ?)
      `).run(id, user.id, tipo, dias || null, interaction.user.id, motivo, incidenteId || null, vence);

      // Suspendido si tipo lo implica
      if (/suspension|expulsion/i.test(tipo)) {
        db.prepare(
          `UPDATE perfiles SET estado = 'Suspendido', actualizado_en = datetime('now') WHERE discord_id = ?`
        ).run(user.id);
      }

      auditoria.registrar(interaction.user.id, 'SANCION.APLICAR', {
        id, sancionado: user.id, tipo, incidenteId,
      });

      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.sancion,
          titulo: `${id} · Sancion aplicada`,
          campos: [
            { name: 'Miembro', value: `<@${user.id}>`, inline: true },
            { name: 'Tipo', value: tipo, inline: true },
            { name: 'Dias', value: dias ? String(dias) : '—', inline: true },
            { name: 'Incidente', value: incidenteId || '—', inline: true },
            { name: 'Emitida por', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Motivo', value: truncar(motivo, 500), inline: false },
          ],
          footer: 'Sanciones',
        })],
      });
      return;
    }

    if (sub === 'consultar') {
      const user = interaction.options.getUser('miembro');
      const rows = db.prepare(
        'SELECT * FROM sanciones WHERE sancionado_id = ? ORDER BY creado_en DESC LIMIT 20'
      ).all(user.id);
      const desc = rows.length
        ? rows.map((r) =>
          `**${r.id}** · ${r.tipo} · ${r.estado}\n${sanitizar(r.motivo || '')}` +
          (r.incidente_id ? ` · ${r.incidente_id}` : '')
        ).join('\n\n')
        : 'Sin sanciones registradas.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.sancion,
          titulo: `Sanciones · ${user.tag}`,
          descripcion: truncar(desc, 4000),
          footer: 'Sanciones',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'listar') {
      const rows = db.prepare(
        'SELECT * FROM sanciones ORDER BY creado_en DESC LIMIT 25'
      ).all();
      const desc = rows.length
        ? rows.map((r) => `**${r.id}** · <@${r.sancionado_id}> · ${r.tipo} · ${r.estado}`).join('\n')
        : 'Sin sanciones.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.sancion,
          titulo: 'Sanciones recientes',
          descripcion: truncar(desc, 4000),
          footer: 'Sanciones',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'levantar') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const id = interaction.options.getString('id');
      const row = db.prepare('SELECT * FROM sanciones WHERE id = ?').get(id);
      if (!row) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No encontrada',
            descripcion: `No existe \`${id}\`.`,
            footer: 'Sanciones',
          })],
        });
        return;
      }
      db.prepare("UPDATE sanciones SET estado = 'Levantada' WHERE id = ?").run(id);
      auditoria.registrar(interaction.user.id, 'SANCION.LEVANTAR', { id, sancionado: row.sancionado_id });
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Sancion levantada',
          descripcion: `**${id}** de <@${row.sancionado_id}> ha sido levantada.`,
          footer: 'Sanciones',
        })],
      });
    }
  },
};
