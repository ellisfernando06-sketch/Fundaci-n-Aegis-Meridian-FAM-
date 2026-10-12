const { MessageFlags } = require('discord.js');
const { getDb, nextId } = require('../db');
const roblox = require('./roblox');
const auditoria = require('./auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');

async function onConfirmarSi(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular puede responder.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  const db = getDb();
  const verif = db.prepare(
    'SELECT * FROM verificaciones WHERE discord_id = ? AND codigo = ? AND usado = 0 ORDER BY id DESC LIMIT 1'
  ).get(ownerId, codigo);

  if (!verif) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: 'Codigo invalido',
          descripcion: 'El codigo no existe o ya fue utilizado.',
          footer: 'Verificacion',
        }),
      ],
      components: [],
    });
    return;
  }

  db.prepare('UPDATE verificaciones SET usado = 1 WHERE id = ?').run(verif.id);

  const area = verif.area_solicitada || null;
  const numero = nextId('PER');
  const { ORGANIGRAMA: ORG } = require('../data/organigrama');

  db.prepare(`
    INSERT INTO perfiles (discord_id, numero, personaje, roblox_id, roblox_usuario, verificado, area, estado, ingreso, nivel_auth)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'Cuarentena', datetime('now'), 0)
    ON CONFLICT(discord_id) DO UPDATE SET
      numero = excluded.numero,
      personaje = excluded.personaje,
      roblox_id = excluded.roblox_id,
      roblox_usuario = excluded.roblox_usuario,
      verificado = 1,
      area = excluded.area,
      estado = 'Cuarentena',
      actualizado_en = datetime('now')
  `).run(
    ownerId,
    numero,
    verif.personaje || null,
    String(robloxId),
    verif.roblox_usuario || null,
    area ? (ORG[area]?.nombre || area) : null
  );

  try {
    if (interaction.guild) {
      const member = await interaction.guild.members.fetch(ownerId).catch(() => null);
      if (member) {
        const rolesSvc = require('./roles');
        await rolesSvc.marcarVerificado(interaction.guild, member);
        await rolesSvc.addRoleByKey(interaction.guild, member, rolesSvc.ESTADO.VISITANTE, 'Aegis · verificacion · cuarentena');
      }
    }
  } catch (err) {
    console.error('[Roles verificacion]', err);
  }

  let solInfo = null;
  try {
    const { crearTrasVerificacion } = require('./solicitudes');
    const member = interaction.guild
      ? await interaction.guild.members.fetch(ownerId).catch(() => null)
      : null;
    if (member && interaction.guild) {
      solInfo = await crearTrasVerificacion({
        guild: interaction.guild,
        member,
        area,
        personaje: verif.personaje,
        robloxUsuario: verif.roblox_usuario,
        robloxId,
      });
    }
  } catch (err) {
    console.error('[Solicitud]', err);
  }

  auditoria.registrar(ownerId, 'PERFIL.VERIFICADO', {
    numero,
    robloxId,
    area,
    solicitud: solInfo?.sol?.id || null,
  });

  let avatar = null;
  try {
    avatar = await roblox.obtenerAvatar(robloxId);
  } catch (_) {}

  const ficha = embedBase({
    color: COLORES.cupula,
    titulo: `Ficha registrada · ${numero}`,
    campos: [
      { name: 'Nombre del personaje', value: verif.personaje || '—', inline: false },
      { name: 'Roblox', value: `@${verif.roblox_usuario || robloxId} · Verificado`, inline: true },
      { name: 'Estado', value: 'Cuarentena (pendiente de aprobacion)', inline: true },
      { name: 'Area solicitada', value: ORG[area]?.nombre || area || '—', inline: true },
      { name: 'Solicitud', value: solInfo?.sol?.id || 'Pendiente de envio a logs', inline: true },
      { name: 'Autorizacion', value: 'Nivel 0 · Publico', inline: true },
    ],
    thumbnail: avatar,
    footer: 'Personal',
  });

  await interaction.editReply({
    embeds: [ficha],
    components: [],
  });

  await interaction.followUp({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: 'Verificacion completada',
      descripcion:
        'Tu cuenta de Roblox quedo vinculada.\n\n' +
        'La solicitud de ingreso fue enviada a **Cofundadores** para aprobacion. ' +
        'Permaneces como **Visitante** en cuarentena hasta que sea aprobada.\n\n' +
        (solInfo?.canalId
          ? 'Los revisores veran botones para **Aprobar**, **Denegar** o **Reasignar area**.'
          : '**Aviso:** configura el canal de solicitudes (`canal_solicitudes`) para que lleguen a los cofundadores.'),
      footer: 'Verificacion',
    })],
    flags: MessageFlags.Ephemeral,
  }).catch(() => {});
}

module.exports = { onConfirmarSi };
