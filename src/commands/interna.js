const {
  SlashCommandBuilder,
  MessageFlags,
  ChannelType,
} = require('discord.js');
const { getDb, nextId, getConfig, setConfig } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

/**
 * /interna solo puede usarse en MD con el bot o en el canal oculto configurado.
 */
function canalPermitido(interaction) {
  // DM
  if (!interaction.guildId || interaction.channel?.type === ChannelType.DM) {
    return { ok: true, modo: 'dm' };
  }
  const canalCfg = getConfig('canal_interna');
  if (canalCfg && interaction.channelId === canalCfg) {
    return { ok: true, modo: 'oculto' };
  }
  return { ok: false };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('interna')
    .setDescription('Investigaciones internas (solo MD o canal oculto)')
    .addSubcommand((s) =>
      s.setName('abrir')
        .setDescription('Abre un caso interno')
        .addUserOption((o) => o.setName('investigado').setDescription('Persona investigada').setRequired(true))
        .addStringOption((o) => o.setName('resumen').setDescription('Resumen inicial').setRequired(true))
        .addStringOption((o) =>
          o.setName('clasificacion')
            .setDescription('Clasificacion')
            .setRequired(false)
            .addChoices(
              { name: 'Confidencial', value: 'Confidencial' },
              { name: 'Secreto', value: 'Secreto' },
              { name: 'Alto secreto', value: 'Alto secreto' },
            )
        )
        .addUserOption((o) => o.setName('agente').setDescription('Agente asignado').setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName('evidencia')
        .setDescription('Anade evidencia a un caso')
        .addStringOption((o) =>
          o.setName('caso').setDescription('ID CAS-xxxx').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((o) => o.setName('contenido').setDescription('Contenido de la evidencia').setRequired(true))
        .addStringOption((o) =>
          o.setName('tipo').setDescription('Tipo').setRequired(false)
            .addChoices(
              { name: 'Nota', value: 'Nota' },
              { name: 'Testimonio', value: 'Testimonio' },
              { name: 'Documento', value: 'Documento' },
              { name: 'Otro', value: 'Otro' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Consulta un caso (solo aqui)')
        .addStringOption((o) =>
          o.setName('caso').setDescription('ID CAS-xxxx').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('cerrar')
        .setDescription('Cierra un caso interno')
        .addStringOption((o) =>
          o.setName('caso').setDescription('ID CAS-xxxx').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('config_canal')
        .setDescription('Define el canal oculto permitido para /interna')
        .addChannelOption((o) =>
          o.setName('canal').setDescription('Canal oculto').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'caso') return interaction.respond([]);
    const q = String(focused.value || '').toLowerCase();
    const rows = getDb().prepare(
      'SELECT id, estado FROM casos_internos ORDER BY creado_en DESC LIMIT 40'
    ).all();
    return interaction.respond(
      rows
        .filter((r) => !q || r.id.toLowerCase().includes(q))
        .slice(0, 25)
        .map((r) => ({ name: `${r.id} · ${r.estado}`.slice(0, 100), value: r.id }))
    );
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // config_canal solo admin path already gated; allow in guild
    if (sub === 'config_canal') {
      const canal = interaction.options.getChannel('canal');
      setConfig('canal_interna', canal.id);
      auditoria.registrar(interaction.user.id, 'INTERNA.CONFIG_CANAL', { canal: canal.id });
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.inteligencia,
          titulo: 'Canal interno configurado',
          descripcion: `Las consultas de /interna se permiten en ${canal} y en mensajes privados con el bot.`,
          footer: 'Investigacion interna',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const permisoCanal = canalPermitido(interaction);
    if (!permisoCanal.ok) {
      auditoria.registrar(interaction.user.id, 'INTERNA.DENEGADO_CANAL', {
        canal: interaction.channelId,
      });
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Canal no autorizado',
          descripcion:
            'Los datos de investigacion interna **no** pueden mostrarse en canales publicos.\n\n' +
            'Usa este comando en un **mensaje privado** con el bot o en el canal oculto configurado (`/interna config_canal`).',
          footer: 'Investigacion interna',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const db = getDb();

    if (sub === 'abrir') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const investigado = interaction.options.getUser('investigado');
      const resumen = sanitizar(interaction.options.getString('resumen'));
      const clasificacion = interaction.options.getString('clasificacion') || 'Confidencial';
      const agente = interaction.options.getUser('agente') || interaction.user;

      const id = nextId('CAS');
      db.prepare(`
        INSERT INTO casos_internos (id, clasificacion, estado, investigado_id, agente_id, resumen)
        VALUES (?, ?, 'Abierto', ?, ?, ?)
      `).run(id, clasificacion, investigado.id, agente.id, resumen);

      auditoria.registrar(interaction.user.id, 'INTERNA.ABRIR', {
        id, investigado: investigado.id, agente: agente.id,
      });

      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.inteligencia,
          titulo: `${id} · Caso abierto`,
          campos: [
            { name: 'Investigado', value: `<@${investigado.id}>`, inline: true },
            { name: 'Agente', value: `<@${agente.id}>`, inline: true },
            { name: 'Clasificacion', value: clasificacion, inline: true },
            { name: 'Resumen', value: truncar(resumen, 800), inline: false },
          ],
          footer: 'Investigacion interna · Confidencial',
        })],
      });
      return;
    }

    if (sub === 'evidencia') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const casoId = interaction.options.getString('caso');
      const caso = db.prepare('SELECT * FROM casos_internos WHERE id = ?').get(casoId);
      if (!caso) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Caso no encontrado',
            descripcion: `No existe \`${casoId}\`.`,
            footer: 'Investigacion interna',
          })],
        });
        return;
      }
      const tipo = interaction.options.getString('tipo') || 'Nota';
      const contenido = sanitizar(interaction.options.getString('contenido'));
      db.prepare(`
        INSERT INTO evidencias (caso_id, tipo, contenido, agregado_por)
        VALUES (?, ?, ?, ?)
      `).run(casoId, tipo, contenido, interaction.user.id);
      auditoria.registrar(interaction.user.id, 'INTERNA.EVIDENCIA', { casoId, tipo });
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.inteligencia,
          titulo: `Evidencia · ${casoId}`,
          campos: [
            { name: 'Tipo', value: tipo, inline: true },
            { name: 'Contenido', value: truncar(contenido, 1000), inline: false },
          ],
          footer: 'Investigacion interna · Confidencial',
        })],
      });
      return;
    }

    if (sub === 'ver') {
      const casoId = interaction.options.getString('caso');
      const caso = db.prepare('SELECT * FROM casos_internos WHERE id = ?').get(casoId);
      if (!caso) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Caso no encontrado',
            descripcion: `No existe \`${casoId}\`.`,
            footer: 'Investigacion interna',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const evidencias = db.prepare(
        'SELECT * FROM evidencias WHERE caso_id = ? ORDER BY creado_en DESC LIMIT 15'
      ).all(casoId);
      const evTxt = evidencias.length
        ? evidencias.map((e) =>
          `· **${e.tipo || 'Nota'}** (${e.creado_en})\n${sanitizar(e.contenido || '')}`
        ).join('\n\n')
        : 'Sin evidencias.';

      auditoria.registrar(interaction.user.id, 'INTERNA.VER', { casoId });
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.inteligencia,
          titulo: `${caso.id} · ${caso.estado}`,
          campos: [
            { name: 'Investigado', value: caso.investigado_id ? `<@${caso.investigado_id}>` : '—', inline: true },
            { name: 'Agente', value: caso.agente_id ? `<@${caso.agente_id}>` : '—', inline: true },
            { name: 'Clasificacion', value: caso.clasificacion || '—', inline: true },
            { name: 'Resumen', value: truncar(caso.resumen || '—', 800), inline: false },
            { name: 'Evidencias', value: truncar(evTxt, 1000), inline: false },
          ],
          footer: 'Investigacion interna · Confidencial',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'cerrar') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const casoId = interaction.options.getString('caso');
      const caso = db.prepare('SELECT * FROM casos_internos WHERE id = ?').get(casoId);
      if (!caso) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Caso no encontrado',
            descripcion: `No existe \`${casoId}\`.`,
            footer: 'Investigacion interna',
          })],
        });
        return;
      }
      db.prepare(`
        UPDATE casos_internos SET estado = 'Cerrado', cerrado_en = datetime('now') WHERE id = ?
      `).run(casoId);
      auditoria.registrar(interaction.user.id, 'INTERNA.CERRAR', { casoId });
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Caso cerrado',
          descripcion: `**${casoId}** ha sido archivado.`,
          footer: 'Investigacion interna',
        })],
      });
    }
  },
};
