/**
 * Solicitudes de ingreso / area · se envian a logs de cofundadores.
 * Siempre registra y muestra quien reviso/otorgo.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb, nextId, getConfig } = require('../db');
const { ORGANIGRAMA } = require('../data/organigrama');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const auditoria = require('./auditoria');

function actorTexto(user) {
  if (!user) return '—';
  const tag = user.tag || user.username || user.id;
  return `<@${user.id}> (${tag})`;
}

function nombreArea(key) {
  return ORGANIGRAMA[key]?.nombre || key || '—';
}

function embedSolicitud(sol, extras = {}) {
  const campos = [
    { name: 'Solicitante', value: `<@${sol.solicitante_id}>`, inline: true },
    { name: 'Area solicitada', value: nombreArea(sol.area), inline: true },
    { name: 'Estado', value: sol.estado || 'Pendiente', inline: true },
    { name: 'ID', value: sol.id, inline: true },
  ];
  if (extras.roblox) campos.push({ name: 'Roblox', value: extras.roblox, inline: true });
  if (extras.personaje) campos.push({ name: 'Personaje', value: extras.personaje, inline: true });
  if (extras.motivo) campos.push({ name: 'Motivo', value: truncar(extras.motivo, 500), inline: false });
  if (sol.revisado_por) {
    campos.push({ name: 'Revisado por', value: sol.revisado_por, inline: false });
  }
  if (extras.motivoRevision) {
    campos.push({ name: 'Motivo de revision', value: truncar(extras.motivoRevision, 500), inline: false });
  }
  return embedBase({
    color: sol.estado === 'Aprobada' ? COLORES.medicina
      : sol.estado === 'Denegada' ? COLORES.denegado
      : COLORES.cupula,
    titulo: `Solicitud de ingreso · ${sol.id}`,
    campos,
    footer: 'Solicitudes · Cofundadores',
  });
}

function botonesSolicitud(solId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`solicitudes:aprobar:${solId}`)
      .setLabel('Aprobar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`solicitudes:denegar:${solId}`)
      .setLabel('Denegar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`solicitudes:reasignar:${solId}`)
      .setLabel('Reasignar area')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Crea solicitud tras verificacion Roblox y publica en canal de logs.
 */
async function crearTrasVerificacion({ guild, member, area, personaje, robloxUsuario, robloxId }) {
  const db = getDb();
  const id = nextId('SOL');

  db.prepare(`
    INSERT INTO solicitudes_area (id, solicitante_id, area, rango_propuesto, motivo, estado)
    VALUES (?, ?, ?, NULL, ?, 'Pendiente')
  `).run(
    id,
    member.id,
    area,
    sanitizar(`Verificacion Roblox @${robloxUsuario || robloxId} · personaje ${personaje || '—'}`)
  );

  // Perfil queda verificado pero en cuarentena hasta aprobacion
  db.prepare(`
    UPDATE perfiles SET
      verificado = 1,
      estado = 'Cuarentena',
      area = ?,
      actualizado_en = datetime('now')
    WHERE discord_id = ?
  `).run(nombreArea(area), member.id);

  auditoria.registrar(member.id, 'SOLICITUD.CREAR', {
    id,
    area,
    robloxId,
  });

  const sol = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(id);
  const embed = embedSolicitud(sol, {
    roblox: robloxUsuario ? `@${robloxUsuario}` : String(robloxId),
    personaje: personaje || '—',
  });

  const canalId = getConfig('canal_solicitudes') || getConfig('canal_logs_cofundadores');
  let msgId = null;
  if (canalId && guild) {
    const ch = await guild.channels.fetch(canalId).catch(() => null);
    if (ch && ch.isTextBased()) {
      const msg = await ch.send({
        content: 'Nueva solicitud de ingreso pendiente de revision.',
        embeds: [embed],
        components: [botonesSolicitud(id)],
      }).catch(() => null);
      if (msg) {
        msgId = msg.id;
        db.prepare('UPDATE solicitudes_area SET msg_id = ? WHERE id = ?').run(msgId, id);
      }
    }
  }

  return { sol, msgId, canalId: canalId || null };
}

module.exports = {
  actorTexto,
  nombreArea,
  embedSolicitud,
  botonesSolicitud,
  crearTrasVerificacion,
};
