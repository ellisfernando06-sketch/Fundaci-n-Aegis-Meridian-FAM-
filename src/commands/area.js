const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { ORGANIGRAMA } = require('../data/organigrama');
const { setArea } = require('../services/roles');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

const AREAS = Object.entries(ORGANIGRAMA).map(([key, rama]) => ({
  name: rama.nombre.slice(0, 100),
  value: rama.nombre.slice(0, 100),
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('area')
    .setDescription('Asignacion y consulta de areas / departamentos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('asignar')
        .setDescription('Asigna un area a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
        .addStringOption((o) =>
          o.setName('area')
            .setDescription('Area o departamento')
            .setRequired(true)
            .addChoices(...AREAS.slice(0, 25))
        )
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista miembros de un area')
        .addStringOption((o) =>
          o.setName('area')
            .setDescription('Area')
            .setRequired(true)
            .addChoices(...AREAS.slice(0, 25))
        )
    )
    .addSubcommand((s) =>
      s.setName('consultar')
        .setDescription('Consulta el area de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'consultar') {
      const user = interaction.options.getUser('miembro');
      const p = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(user.id);
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.seguridad,
          titulo: 'Area',
          campos: [
            { name: 'Miembro', value: `<@${user.id}>`, inline: true },
            { name: 'Area', value: p?.area || 'Sin asignar', inline: true },
            { name: 'Cargo', value: p?.cargo || '—', inline: true },
          ],
          footer: 'Areas',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'listar') {
      const area = interaction.options.getString('area');
      const rows = db.prepare(
        'SELECT discord_id, personaje, cargo, numero FROM perfiles WHERE area = ? ORDER BY cargo LIMIT 40'
      ).all(area);
      const desc = rows.length
        ? rows.map((r) =>
          `· <@${r.discord_id}> · ${r.cargo || '—'} · ${r.personaje || r.numero || ''}`
        ).join('\n')
        : 'Sin miembros registrados en esta area.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.seguridad,
          titulo: `Area · ${area}`,
          descripcion: truncar(desc, 4000),
          footer: 'Areas',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'asignar') {
      const user = interaction.options.getUser('miembro');
      const area = interaction.options.getString('area');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Miembro no encontrado',
            descripcion: 'El usuario no pertenece a este servidor.',
            footer: 'Areas',
          })],
        });
        return;
      }

      const p = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(member.id);
      if (!p) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Sin ficha',
            descripcion: 'El miembro debe tener ficha (`/perfil`) antes de asignar area.',
            footer: 'Areas',
          })],
        });
        return;
      }

      try {
        await setArea(interaction.guild, member, area, interaction.user.tag);
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.seguridad,
            titulo: 'Area asignada',
            campos: [
              { name: 'Miembro', value: `<@${member.id}>`, inline: true },
              { name: 'Area', value: area, inline: true },
            ],
            footer: 'Areas',
          })],
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo asignar',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Areas',
          })],
        });
      }
    }
  },
};
