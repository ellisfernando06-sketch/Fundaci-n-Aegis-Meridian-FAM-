const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES, configuracion } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config_llaves')
    .setDescription('Configura el catalogo de llaves y sus canales')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista llaves con canales y estado')
    )
    .addSubcommand((s) =>
      s.setName('vincular_canal')
        .setDescription('Asocia un canal a una llave')
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((o) =>
          o.setName('canal')
            .setDescription('Canal a vincular')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory)
        )
    )
    .addSubcommand((s) =>
      s.setName('desvincular_canal')
        .setDescription('Quita un canal de una llave')
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((o) =>
          o.setName('canal')
            .setDescription('Canal a desvincular')
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('activar')
        .setDescription('Activa o desactiva una llave')
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addBooleanOption((o) =>
          o.setName('activa').setDescription('true = activa').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('crear_rol')
        .setDescription('Crea el rol Discord de una llave (solo View en canales vinculados al otorgar)')
        .addStringOption((o) =>
          o.setName('llave')
            .setDescription('ID de la llave')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'llave') return interaction.respond([]);
    const q = String(focused.value || '').toLowerCase();
    const rows = getDb().prepare('SELECT id, nombre FROM llaves ORDER BY id LIMIT 50').all();
    await interaction.respond(
      rows
        .filter((r) => !q || r.id.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))
        .slice(0, 25)
        .map((r) => ({ name: `${r.id} · ${r.nombre}`.slice(0, 100), value: r.id }))
    );
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'listar') {
      const rows = db.prepare('SELECT * FROM llaves ORDER BY tipo, id').all();
      const desc = rows.map((r) => {
        let canales = [];
        try { canales = JSON.parse(r.canales_json || '[]'); } catch (_) {}
        return (
          `**${r.id}** · ${r.nombre} · ${r.activa ? 'activa' : 'inactiva'}\n` +
          `canales: ${canales.length ? canales.map((id) => `<#${id}>`).join(', ') : 'ninguno'}`
        );
      }).join('\n\n') || 'Sin llaves.';

      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.llave,
          titulo: 'Configuracion de llaves',
          descripcion: truncar(desc, 4000),
          footer: 'Administracion',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const llaveId = interaction.options.getString('llave');
    const llave = db.prepare('SELECT * FROM llaves WHERE id = ?').get(llaveId);
    if (!llave) {
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Llave no encontrada',
          descripcion: `No existe la llave \`${llaveId}\`.`,
          footer: 'Administracion',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'vincular_canal' || sub === 'desvincular_canal') {
      const canal = interaction.options.getChannel('canal');
      let canales = [];
      try { canales = JSON.parse(llave.canales_json || '[]'); } catch (_) { canales = []; }

      if (sub === 'vincular_canal') {
        if (!canales.includes(canal.id)) canales.push(canal.id);
      } else {
        canales = canales.filter((id) => id !== canal.id);
      }

      db.prepare(
        `UPDATE llaves SET canales_json = ?, actualizado_en = datetime('now') WHERE id = ?`
      ).run(JSON.stringify(canales), llaveId);

      auditoria.registrar(interaction.user.id, 'CONFIG_LLAVES.CANALES', {
        llaveId, accion: sub, canal: canal.id,
      });

      await interaction.reply({
        embeds: [configuracion({
          ajuste: `Llave ${llaveId} · canales`,
          valorAnterior: String((JSON.parse(llave.canales_json || '[]') || []).length),
          valorNuevo: String(canales.length),
          cambiadoPor: interaction.user.tag,
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'activar') {
      const activa = interaction.options.getBoolean('activa') ? 1 : 0;
      db.prepare(
        `UPDATE llaves SET activa = ?, actualizado_en = datetime('now') WHERE id = ?`
      ).run(activa, llaveId);
      auditoria.registrar(interaction.user.id, 'CONFIG_LLAVES.ACTIVAR', { llaveId, activa });
      await interaction.reply({
        embeds: [configuracion({
          ajuste: `Llave ${llaveId}`,
          valorAnterior: llave.activa ? 'activa' : 'inactiva',
          valorNuevo: activa ? 'activa' : 'inactiva',
          cambiadoPor: interaction.user.tag,
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'crear_rol') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Sin permiso',
            descripcion: 'El bot necesita **Manage Roles**.',
            footer: 'Administracion',
          })],
        });
        return;
      }

      if (llave.role_id && interaction.guild.roles.cache.get(llave.role_id)) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.neutral,
            titulo: 'Rol ya vinculado',
            descripcion: `La llave ya tiene rol: <@&${llave.role_id}>`,
            footer: 'Administracion',
          })],
        });
        return;
      }

      try {
        const nombre = String(llave.nombre_rol || `[KEY] ${llave.nombre}`).slice(0, 100);
        const rol = await interaction.guild.roles.create({
          name: nombre,
          color: 0xd4a017,
          hoist: false,
          mentionable: false,
          reason: `Aegis · rol de llave ${llaveId}`,
        });
        db.prepare(
          `UPDATE llaves SET role_id = ?, actualizado_en = datetime('now') WHERE id = ?`
        ).run(rol.id, llaveId);
        auditoria.registrar(interaction.user.id, 'CONFIG_LLAVES.CREAR_ROL', {
          llaveId, roleId: rol.id,
        });
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.llave,
            titulo: 'Rol de llave creado',
            descripcion: `Llave **${llaveId}** → <@&${rol.id}>`,
            footer: 'Administracion',
          })],
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo crear el rol',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Administracion',
          })],
        });
      }
    }
  },
};
