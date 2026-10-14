/**
 * Prefijo ! — solo Fundador
 * !say texto   → el bot envía exactamente ese texto
 * !hablar texto (alias)
 */

const { ChannelType } = require('discord.js');
const { cargosMapeados } = require('../services/acceso');
const auditoria = require('../services/auditoria');

const PREFIX = '!';

function esFundador(message) {
  if (!message.member) return false;
  const cargos = new Set(cargosMapeados(message.member));
  return cargos.has('ST.FUNDADOR');
}

function parseCanalYTexto(message, resto) {
  let canal = message.channel;
  let texto = resto;

  // Opcional: !say #canal resto  (el resto se conserva tal cual, incluido espacios)
  const mention = resto.match(/^(<#(\d+)>)\s/);
  if (mention) {
    const ch = message.guild?.channels.cache.get(mention[2]);
    if (ch?.isTextBased()) {
      canal = ch;
      texto = resto.slice(mention[0].length);
    }
  } else {
    const idMatch = resto.match(/^(\d{17,20})\s/);
    if (idMatch) {
      const ch = message.guild?.channels.cache.get(idMatch[1]);
      if (ch?.isTextBased()) {
        canal = ch;
        texto = resto.slice(idMatch[0].length);
      }
    }
  }

  return { canal, texto };
}

async function manejarPrefijo(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Quitar solo el prefijo; conservar el resto del string original
  const afterPrefix = message.content.slice(PREFIX.length);
  // Primer token = comando (sin importar mayúsculas)
  const match = afterPrefix.match(/^(\S+)(?:\s([\s\S]*))?$/);
  if (!match) return;

  const cmd = match[1].toLowerCase();
  // Todo lo que sigue al comando, sin trim agresivo del contenido (solo un espacio de separación ya consumido)
  const resto = match[2] != null ? match[2] : '';

  if (!['say', 'hablar', 'decir'].includes(cmd)) return;

  if (!esFundador(message)) {
    await message.reply({ content: 'Solo el **Fundador** puede usar este comando.' }).catch(() => {});
    return;
  }

  const { canal, texto } = parseCanalYTexto(message, resto);

  if (!texto || !texto.length) {
    await message.reply({ content: 'Uso: `!say` seguido del mensaje exacto que debe enviar el bot.' }).catch(() => {});
    return;
  }

  try {
    // Envío literal (máx. 2000 chars de Discord)
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
