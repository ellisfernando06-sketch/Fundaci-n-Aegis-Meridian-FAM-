const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');

function asegurarTabla() {
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
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contratos')
    .setDescription('Registro de contratos · menu desplegable · Fundador / Cofundadores')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('registro')
        .setDescription('Abre el registro con menu desplegable')
        .addStringOption((o) =>
          o.setName('filtro')
            .setDescription('Filtrar por estado')
            .setRequired(false)
            .addChoices(
              { name: 'Todos', value: 'Todos' },
              { name: 'Pendiente', value: 'Pendiente' },
              { name: 'Completo', value: 'Completo' },
            )
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTabla();

    const filtro = interaction.options.getString('filtro') || 'Todos';
    const db = getDb();
    let rows;
    if (filtro === 'Todos') {
      rows = db.prepare('SELECT * FROM contratos ORDER BY creado_en DESC LIMIT 25').all();
    } else {
      rows = db
        .prepare('SELECT * FROM contratos WHERE estado = ? ORDER BY creado_en DESC LIMIT 25')
        .all(filtro);
    }

    if (!rows.length) {
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.neutral,
            titulo: 'Registro de contratos',
            descripcion: 'No hay contratos con ese filtro.',
            footer: 'Contratos',
          }),
        ],
      });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`contratos:ver:${interaction.user.id}`)
      .setPlaceholder('Selecciona un contrato')
      .addOptions(
        rows.map((r) => ({
          label: `${r.id} · ${r.estado}`.slice(0, 100),
          description: `${r.personaje} · ${r.rango}`.slice(0, 100),
          value: r.id,
        }))
      );

    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.oro,
          author: true,
          titulo: 'Registro de contratos',
          descripcion:
            `**${rows.length}** contrato(s) · filtro: **${filtro}**\n` +
            'Selecciona uno en el menu para ver el detalle.',
          footer: 'Contratos',
        }),
      ],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  },
};
