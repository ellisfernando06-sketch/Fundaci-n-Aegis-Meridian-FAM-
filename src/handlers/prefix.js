/**
 * Prefijo ! — solo Fundador
 * Detecta el rol por mapa interno Y por nombre en Discord.
 * !say texto → el bot envía exactamente ese texto
 */

const { cargosMapeados } = require('../services/acceso');
const auditoria = require('../services/auditoria');
const { getDb } = require('../db');

const PREFIX = '!';

function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * ¿Es Fundador?
 * 1) cargo mapeado ST.FUNDADOR
 * 2) rol Discord cuyo nombre contenga "fundador" (sin ser cofundador)
 * 3) roles_map: el role_id de ST.FUNDADOR está en el miembro
 */
function esFundador(message) {
  const member = message.member;
  if (!member) return false;

  // 1) Mapa de cargos ya resuelto
  try {
    const cargos = new Set(cargosMapeados(member));
    if (cargos.has('ST.FUNDADOR')) return true;
  } catch (_) {}

  // 2) roles_map directo
  try {
    const row = getDb().prepare("SELECT role_id FROM roles_map WHERE cargo_key = 'ST.FUNDADOR'").get();
    if (row?.role_id && member.roles.cache.has(row.role_id)) return true;
  } catch (_) {}

  // 3) Por nombre del rol en Discord
  for (const [, rol] of member.roles.cache) {
    if (rol.managed || rol.id === message.guild?.id) continue;
    const n = normalizar(rol.name);
    // "fundador" pero no "cofundador" / "co fundador"
    if (
      (n === 'fundador' || n.includes(' fundador') || n.startsWith('fundador') || n.endsWith(' fundador')) &&
      !n.includes('cofundador') &&
      !n.includes('co fundador') &&
      !/^co\s/.test(n)
    ) {
      return true;
    }
    // Prefijo del organigrama: "ST ●┇Fundador" o similar
    if (n.includes('fundador') && !n.includes('cofundador') && !n.includes('co fundador')) {
      return true;
    }
  }

  return false;
}

function parseCanalYTexto(message, resto) {
  let canal = message.channel;
  let texto = resto;

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

  const afterPrefix = message.content.slice(PREFIX.length);
  const match = afterPrefix.match(/^(\S+)(?:\s([\s\S]*))?$/);
  if (!match) return;

  const cmd = match[1].toLowerCase();
  const resto = match[2] != null ? match[2] : '';

  if (!['say', 'hablar', 'decir'].includes(cmd)) return;

  // Asegurar cache de roles del miembro
  try {
    await message.member.fetch(true);
  } catch (_) {}

  if (!esFundador(message)) {
    await message
      .reply({
        content:
          'Solo el **Fundador** puede usar este comando.\n' +
          'El bot no detecto el rol de Fundador en tu cuenta. ' +
          'Comprueba que tengas el rol cuyo nombre incluya «Fundador» (no Cofundador).',
      })
      .catch(() => {});
    return;
  }

  const { canal, texto } = parseCanalYTexto(message, resto);

  if (!texto || !texto.length) {
    await message
      .reply({ content: 'Uso: `!say` seguido del mensaje exacto.' })
      .catch(() => {});
    return;
  }

  try {
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

module.exports = { PREFIX, manejarPrefijo, esFundador };
