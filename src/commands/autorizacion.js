const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { setAutorizacion } = require('../services/roles');
const { embedBase, COLORES, accesoDenegado } = require('../utils/plantillas');
const { sanitizar } = require('../utils/helpers');

const NIVELES = [
  { name: 'Nivel 0 · Publico', value: '0' },
  { name: 'Nivel 1 · Confidencial', value: '1' },
  { name: 'Nivel 2 · Restringido', value: '2' },
  { name: 'Nivel 3 · Secreto', value: '3' },
  { name: 'Nivel 4 · Alto Secreto', value: '4' },
  { name: 'Nivel 5 · Meridiano', value: '5' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorizacion')
    .setDescription('Gestion de niveles de autorizacion de acceso')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('otorgar')
        .setDescription('Asigna un nivel de autorizacion a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
        .addStringOption((o) =>
          o.setName('nivel').setDescription('Nivel 0–5').setRequired(true).addChoices(...NIVELES)
        )
        .addStringOption((o) =>
          o.setName('motivo').setDescription('Motivo').setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName('consultar')
        .setDescription('Consulta el nivel de autorizacion de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'consultar') {
      const user = interaction.options.getUser('miembro');
      const p = getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(user.id);
      const nivel = p?.nivel_auth ?? 0;
      const etiqueta = NIVELES.find((n) => n.value === String(nivel))?.name || `Nivel ${nivel}`;

      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.inteligencia,
          titulo: 'Autorizacion',
          campos: [
            { name: 'Miembro', value: `<@${user.id}>`, inline: true },
            { name: 'Nivel', value: etiqueta, inline: true },
            { name: 'Ficha', value: p ? (p.numero || 'Registrada') : 'Sin ficha', inline: true },
          ],
          footer: 'Control de acceso',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'otorgar') {
      const user = interaction.options.getUser('miembro');
      const nivel = interaction.options.getString('nivel');
      const motivo = sanitizar(interaction.options.getString('motivo') || '');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Miembro no encontrado',
            descripcion: 'El usuario no pertenece a este servidor.',
            footer: 'Control de acceso',
          })],
        });
        return;
      }

      // Requiere ficha
      const p = getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(member.id);
      if (!p) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Sin ficha',
            descripcion: 'El miembro debe tener ficha de personal (`/perfil`) antes de recibir autorizacion.',
            footer: 'Control de acceso',
          })],
        });
        return;
      }

      try {
        const r = await setAutorizacion(
          interaction.guild,
          member,
          nivel,
          interaction.user.tag,
          motivo || null
        );
        const etiqueta = NIVELES.find((n) => n.value === String(r.nivel))?.name || `Nivel ${r.nivel}`;
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.inteligencia,
            titulo: 'Autorizacion actualizada',
            campos: [
              { name: 'Miembro', value: `<@${member.id}>`, inline: true },
              { name: 'Nivel nuevo', value: etiqueta, inline: true },
              { name: 'Nivel anterior', value: String(r.anterior), inline: true },
              { name: 'Motivo', value: motivo || '—', inline: false },
            ],
            footer: 'Control de acceso',
          })],
        });
      } catch (err) {
        console.error('[autorizacion]', err);
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo actualizar',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Control de acceso',
          })],
        });
      }
    }
  },
};
