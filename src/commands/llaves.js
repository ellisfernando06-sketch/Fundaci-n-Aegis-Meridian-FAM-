const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { otorgarLlave, revocarLlave } = require('../services/roles');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('llaves')
    .setDescription('Catalogo y gestion de llaves de acceso')
    .addSubcommand((s) =>
      s.setName('catalogo')
        .setDescription('Lista el catalogo de llaves activas')
    )
    .addSubcommand((s) =>
      s.setName('mias')
        .setDescription('Muestra las llaves que posees')
    )
    .addSubcommand((s) =>
      s.setName('otorgar')
        .setDescription('Otorga una llave a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID o nombre de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((o) =>
          o.setName('motivo').setDescription('Motivo').setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName('revocar')
        .setDescription('Revoca una llave a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID o nombre de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'llave') return interaction.respond([]);
    const q = String(focused.value || '').toLowerCase();
    const rows = getDb().prepare(
      'SELECT id, nombre FROM llaves WHERE activa = 1 ORDER BY id LIMIT 50'
    ).all();
    const filtered = rows
      .filter((r) =>
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q)
      )
      .slice(0, 25)
      .map((r) => ({
        name: `${r.id} · ${r.nombre}`.slice(0, 100),
        value: r.id,
      }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'catalogo') {
      const rows = db.prepare(
        'SELECT id, nombre, tipo, alcance, nivel_min FROM llaves WHERE activa = 1 ORDER BY tipo, id'
      ).all();
      const desc = rows.length
        ? rows.map((r) =>
          `**${r.id}** · ${r.nombre}\n` +
          `tipo \\`${r.tipo}\\` · alcance ${r.alcance || '—'} · min N${r.nivel_min ?? 0}`
        ).join('\n\n')
        : 'Catalogo vacio.';

      const chunks = [];
      let cur = '';
      for (const block of desc.split('\n\n')) {
        if ((cur + '\n\n' + block).length > 3800) {
          chunks.push(cur);
          cur = block;
        } else cur = cur ? cur + '\n\n' + block : block;
      }
      if (cur) chunks.push(cur);

      const embeds = chunks.slice(0, 5).map((d, i) => embedBase({
        color: COLORES.llave,
        titulo: i === 0 ? 'Catalogo de llaves' : `Catalogo (cont. ${i + 1})`,
        descripcion: d,
        footer: 'Llaves',
        timestamp: i === 0,
      }));

      await interaction.reply({
        embeds,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'mias') {
      const rows = db.prepare(`
        SELECT t.*, l.nombre, l.funcion
        FROM llaves_titulares t
        JOIN llaves l ON l.id = t.llave_id
        WHERE t.discord_id = ? AND t.activa = 1
        ORDER BY t.otorgada_en DESC
      `).all(interaction.user.id);

      const desc = rows.length
        ? rows.map((r) =>
          `**${r.llave_id}** · ${r.nombre}\n${r.funcion || ''}`
        ).join('\n\n')
        : 'No posees llaves activas.';

      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.llave,
          titulo: 'Tus llaves',
          descripcion: truncar(desc, 4000),
          footer: 'Llaves',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // otorgar / revocar requieren ManageRoles
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: 'No tienes autorizacion para otorgar o revocar llaves.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const user = interaction.options.getUser('miembro');
    const llaveId = interaction.options.getString('llave');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Miembro no encontrado',
          descripcion: 'El usuario no pertenece a este servidor.',
          footer: 'Llaves',
        })],
      });
      return;
    }

    try {
      if (sub === 'otorgar') {
        const motivo = sanitizar(interaction.options.getString('motivo') || '');
        const llave = await otorgarLlave(
          interaction.guild,
          member,
          llaveId,
          interaction.user.tag,
          motivo || null
        );
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.llave,
            titulo: 'Llave otorgada',
            campos: [
              { name: 'Miembro', value: `<@${member.id}>`, inline: true },
              { name: 'Llave', value: `${llave.id} · ${llave.nombre}`, inline: true },
              { name: 'Motivo', value: motivo || '—', inline: false },
            ],
            footer: 'Llaves',
          })],
        });
      } else if (sub === 'revocar') {
        const llave = await revocarLlave(
          interaction.guild,
          member,
          llaveId,
          interaction.user.tag
        );
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.llave,
            titulo: 'Llave revocada',
            campos: [
              { name: 'Miembro', value: `<@${member.id}>`, inline: true },
              { name: 'Llave', value: `${llave.id} · ${llave.nombre}`, inline: true },
            ],
            footer: 'Llaves',
          })],
        });
      }
    } catch (err) {
      console.error('[llaves]', err);
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Operacion no completada',
          descripcion: String(err.message || err).slice(0, 500),
          footer: 'Llaves',
        })],
      });
    }
  },
};
