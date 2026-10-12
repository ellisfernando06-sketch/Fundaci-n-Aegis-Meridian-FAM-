const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { getTodosCargos, getCargoPorKey } = require('../data/organigrama');
const { asignarCargo } = require('../services/roles');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('personal')
    .setDescription('Gestion de personal: cargos, historial y fichas')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('asignar')
        .setDescription('Asigna un cargo del organigrama a un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
        .addStringOption((o) =>
          o.setName('cargo')
            .setDescription('Cargo del organigrama')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((o) =>
          o.setName('motivo').setDescription('Motivo de la asignacion').setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName('historial')
        .setDescription('Consulta el historial de personal de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Consulta la ficha de personal de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Miembro').setRequired(true))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'cargo') return interaction.respond([]);
    const q = String(focused.value || '').toLowerCase();
    const cargos = getTodosCargos()
      .filter((c) =>
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q) ||
        (c.prefijo || '').toLowerCase().includes(q)
      )
      .slice(0, 25)
      .map((c) => ({
        name: `${c.prefijo} · ${c.nombre}`.slice(0, 100),
        value: c.key,
      }));
    await interaction.respond(cargos);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'asignar') {
      const user = interaction.options.getUser('miembro');
      const cargoKey = interaction.options.getString('cargo');
      const motivo = sanitizar(interaction.options.getString('motivo') || '');

      const cargo = getCargoPorKey(cargoKey);
      if (!cargo) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Cargo no valido',
            descripcion: 'El cargo indicado no existe en el organigrama.',
            footer: 'Personal',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Miembro no encontrado',
            descripcion: 'El usuario no pertenece a este servidor.',
            footer: 'Personal',
          })],
        });
        return;
      }

      try {
        const result = await asignarCargo(
          interaction.guild,
          member,
          cargoKey,
          interaction.user.tag,
          motivo || null
        );
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.medicina,
            titulo: 'Cargo asignado',
            campos: [
              { name: 'Miembro', value: `<@${member.id}>`, inline: true },
              { name: 'Cargo', value: result.cargo.nombreRol || result.cargo.nombre, inline: true },
              { name: 'Anterior', value: result.rangoAnterior || '—', inline: true },
              { name: 'Motivo', value: motivo || '—', inline: false },
            ],
            footer: 'Personal',
          })],
        });
      } catch (err) {
        console.error('[personal asignar]', err);
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo asignar',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Personal',
          })],
        });
      }
      return;
    }

    if (sub === 'historial') {
      const user = interaction.options.getUser('miembro');
      const rows = getDb().prepare(
        'SELECT * FROM historial_personal WHERE discord_id = ? ORDER BY fecha DESC LIMIT 20'
      ).all(user.id);

      const desc = rows.length
        ? rows.map((r) =>
          `**${r.numero}** · ${r.tipo} · ${r.rango_anterior || '—'} → **${r.rango_nuevo || '—'}**\n` +
          `por ${r.autorizado_por || '—'} · ${r.fecha || ''}${r.motivo ? ` · ${sanitizar(r.motivo)}` : ''}`
        ).join('\n\n')
        : 'Sin registros de historial.';

      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: `Historial · ${user.tag}`,
          descripcion: truncar(desc, 4000),
          footer: 'Personal',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'ver') {
      const user = interaction.options.getUser('miembro');
      const p = getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(user.id);
      if (!p) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Sin ficha',
            descripcion: 'Este miembro no tiene ficha de personal registrada.',
            footer: 'Personal',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: `Ficha · ${p.numero || user.tag}`,
          campos: [
            { name: 'Discord', value: `<@${user.id}>`, inline: true },
            { name: 'Personaje', value: p.personaje || '—', inline: true },
            { name: 'Roblox', value: p.roblox_usuario || '—', inline: true },
            { name: 'Area', value: p.area || '—', inline: true },
            { name: 'Cargo', value: p.cargo || '—', inline: true },
            { name: 'Autorizacion', value: `Nivel ${p.nivel_auth ?? 0}`, inline: true },
            { name: 'Estado', value: p.estado || '—', inline: true },
            { name: 'Verificado', value: p.verificado ? 'Si' : 'No', inline: true },
          ],
          footer: 'Personal',
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
