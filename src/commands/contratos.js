const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contratos')
    .setDescription('Registro de contratos de ingreso · Uso: Fundador, Cofundadores, Dir. General')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista los ultimos contratos')
        .addStringOption((o) =>
          o.setName('estado')
            .setDescription('Filtrar por estado')
            .setRequired(false)
            .addChoices(
              { name: 'Pendiente', value: 'Pendiente' },
              { name: 'Completo', value: 'Completo' },
              { name: 'Todos', value: 'Todos' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Detalle de un contrato')
        .addStringOption((o) =>
          o.setName('id').setDescription('ID del contrato (CTR-0001)').setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS contratos (
        id TEXT PRIMARY KEY,
        miembro_id TEXT NOT NULL,
        personaje TEXT NOT NULL,
        rango TEXT NOT NULL,
        fecha_ingreso TEXT,
        discord_tag TEXT,
        canal_id TEXT,
        msg_id TEXT,
        emitido_por TEXT,
        firma_fundacion_json TEXT,
        firma_miembro_json TEXT,
        estado TEXT DEFAULT 'Pendiente',
        roles_aplicados INTEGER DEFAULT 0,
        creado_en TEXT DEFAULT (datetime('now'))
      )
    `);
    try { db.exec('ALTER TABLE contratos ADD COLUMN roles_aplicados INTEGER DEFAULT 0'); } catch (_) {}

    const sub = interaction.options.getSubcommand();

    if (sub === 'listar') {
      const estado = interaction.options.getString('estado') || 'Todos';
      let rows;
      if (estado === 'Todos') {
        rows = db.prepare('SELECT * FROM contratos ORDER BY creado_en DESC LIMIT 20').all();
      } else {
        rows = db
          .prepare('SELECT * FROM contratos WHERE estado = ? ORDER BY creado_en DESC LIMIT 20')
          .all(estado);
      }

      const texto = rows.length
        ? rows
            .map(
              (r) =>
                `**${r.id}** · ${r.estado} · <@${r.miembro_id}>\n` +
                `${r.personaje} · ${r.rango}` +
                (r.roles_aplicados ? ' · roles aplicados' : '')
            )
            .join('\n\n')
        : 'Sin contratos registrados.';

      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.oro,
            author: true,
            titulo: 'Registro de contratos',
            descripcion: truncar(texto, 4000),
            footer: 'Contratos',
          }),
        ],
      });
      return;
    }

    if (sub === 'ver') {
      const id = interaction.options.getString('id').trim().toUpperCase();
      const r = db.prepare('SELECT * FROM contratos WHERE id = ?').get(id);
      if (!r) {
        await interaction.editReply({ content: 'Contrato no encontrado.' });
        return;
      }
      const ff = r.firma_fundacion_json ? JSON.parse(r.firma_fundacion_json) : null;
      const fm = r.firma_miembro_json ? JSON.parse(r.firma_miembro_json) : null;

      await interaction.editReply({
        embeds: [
          embedBase({
            color: r.estado === 'Completo' ? COLORES.medicina : COLORES.oro,
            author: true,
            titulo: `Contrato · ${r.id}`,
            campos: [
              { name: 'Miembro', value: `<@${r.miembro_id}>`, inline: true },
              { name: 'Personaje', value: r.personaje, inline: true },
              { name: 'Rango contratado', value: r.rango, inline: true },
              { name: 'Estado', value: r.estado, inline: true },
              { name: 'Roles aplicados', value: r.roles_aplicados ? 'Si' : 'No', inline: true },
              { name: 'Emitido por', value: r.emitido_por || '—', inline: true },
              {
                name: 'Firma Fundacion',
                value: ff ? `Si · <@${ff.discordId}> · ${ff.fecha}` : 'No',
                inline: true,
              },
              {
                name: 'Firma Miembro',
                value: fm ? `Si · <@${fm.discordId}> · ${fm.fecha}` : 'No',
                inline: true,
              },
            ],
            footer: 'Contratos',
          }),
        ],
      });
    }
  },
};
