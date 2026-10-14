/**
 * Comandos con prefijo !
 * Requiere Message Content Intent activado en el Developer Portal.
 *
 *  !say [canal?] mensaje
 *  !hablar [canal?] mensaje
 *  !embed titulo | descripcion   (opcional)
 */

const { PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const auditoria = require('../services/auditoria');
const { COLORES, MARCA, logoUrl } = require('../utils/plantillas');

const PREFIX = '!';

const CARGOS_HABLAR = [
  'ST.FUNDADOR',
  'ST.CO_CALIDAD',
  'ST.CO_ESTRATEGIA',
  'DIR.GENERAL',
  'ST.ADMIN_JEFE',
];

function puedeHablar(message) {
  if (!message.member) return false;
  if (esAdminDiscord({ member: message.member, memberPermissions: message.member.permissions })) {
    return true;
  }
  if (message.member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  const cargos = new Set(cargosMapeados(message.member));
  return CARGOS_HABLAR.some((c) => cargos.has(c));
}

function parseCanalYTexto(message, resto) {
  let canal = message.channel;
  let texto = resto.trim();

  // Mencion de canal al inicio: !say #canal hola
  const mention = texto.match(/^<#(\d+)>$\s*|^<#(\d+)>\s+/);
  if (mention) {
    const id = mention[1] || mention[2];
    const ch = message.guild?.channels.cache.get(id);
    if (ch?.isTextBased()) {
      canal = ch;
      texto = texto.replace(/^<#\d+>\s*/, '').trim();
    }
  } else {
    // ID numérico al inicio
    const idMatch = texto.match(/^(\d{17,20})\s+/);
    if (idMatch) {
      const ch = message.guild?.channels.cache.get(idMatch[1]);
      if (ch?.isTextBased()) {
        canal = ch;
        texto = texto.slice(idMatch[0].length).trim();
      }
    }
  }

  return { canal, texto };
}

async function manejarPrefijo(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const sinPrefijo = message.content.slice(PREFIX.length).trim();
  if (!sinPrefijo) return;

  const [cmdRaw, ...restParts] = sinPrefijo.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const resto = restParts.join(' ');

  if (!['say', 'hablar', 'decir', 'embed'].includes(cmd)) return;

  if (!puedeHablar(message)) {
    await message.reply({ content: 'No tienes autorización para hablar por el bot.' }).catch(() => {});
    return;
  }

  try {
    if (cmd === 'embed') {
      const { canal, texto } = parseCanalYTexto(message, resto);
      if (!texto) {
        await message.reply({ content: 'Uso: `!embed titulo | descripcion` (opcional canal al inicio).' });
        return;
      }
      const [titulo, ...descParts] = texto.split('|');
      const descripcion = descParts.join('|').trim() || null;
      const embed = new EmbedBuilder()
        .setColor(COLORES.institucional)
        .setAuthor({
          name: MARCA.nombre,
          iconURL: logoUrl(message.client, message.guild) || undefined,
        })
        .setTitle((titulo || 'Aviso').trim().slice(0, 256))
        .setFooter({
          text: MARCA.nombre,
          iconURL: logoUrl(message.client, message.guild) || undefined,
        })
        .setTimestamp();
      if (descripcion) embed.setDescription(descripcion.slice(0, 4000));

      await canal.send({ embeds: [embed] });
      await message.delete().catch(() => {});
      auditoria.registrar(message.author.id, 'BOT.HABLAR_EMBED', {
        canal: canal.id,
        titulo: (titulo || '').slice(0, 80),
      });
      return;
    }

    // say / hablar / decir
    const { canal, texto } = parseCanalYTexto(message, resto);
    if (!texto) {
      await message.reply({
        content:
          'Uso: `!say mensaje` o `!hablar #canal mensaje`\n' +
          'También: `!embed titulo | descripcion`',
      });
      return;
    }

    if (canal.type === ChannelType.GuildAnnouncement) {
      // ok
    }

    await canal.send({ content: texto.slice(0, 2000) });
    await message.delete().catch(() => {});
    auditoria.registrar(message.author.id, 'BOT.HABLAR', {
      canal: canal.id,
      chars: texto.length,
    });
  } catch (err) {
    console.error('[prefix]', err);
    await message.reply({ content: 'No se pudo enviar el mensaje.' }).catch(() => {});
  }
}

module.exports = { PREFIX, manejarPrefijo };
