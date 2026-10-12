/**
 * Despliegue: borra plantilla Aegis anterior y crea de nuevo con emojis actualizados.
 */

const {
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, setConfig, getConfig } = require('../db');
const { ESTRUCTURA, esCanalPlantillaAegis } = require('../data/canales');
const auditoria = require('./auditoria');

async function borrarPlantillaAnterior(guild) {
  await guild.channels.fetch().catch(() => {});
  let borrados = 0;

  const noCat = [...guild.channels.cache.values()].filter(
    (ch) => ch.type !== ChannelType.GuildCategory
  );

  for (const ch of noCat) {
    if (!esCanalPlantillaAegis(ch.name)) continue;
    try {
      await ch.delete('Aegis · redespliegue de plantilla');
      borrados += 1;
    } catch (err) {
      console.error('[Canales] No se pudo borrar', ch.name, err.message);
    }
  }

  await guild.channels.fetch().catch(() => {});
  const cats = [...guild.channels.cache.values()].filter(
    (ch) => ch.type === ChannelType.GuildCategory && esCanalPlantillaAegis(ch.name)
  );

  for (const cat of cats) {
    try {
      const hijos = guild.channels.cache.filter((c) => c.parentId === cat.id);
      for (const h of hijos.values()) {
        await h.delete('Aegis · redespliegue').catch(() => {});
        borrados += 1;
      }
      await cat.delete('Aegis · redespliegue de plantilla');
      borrados += 1;
    } catch (err) {
      console.error('[Canales] No se pudo borrar categoria', cat.name, err.message);
    }
  }

  const db = getDb();
  try {
    db.prepare("DELETE FROM roles_map WHERE cargo_key LIKE 'CHMAP.%'").run();
  } catch (_) {}
  try {
    db.prepare("UPDATE llaves SET canales_json = '[]'").run();
  } catch (_) {}

  return borrados;
}

async function asegurarCategoria(guild, nombre, existingByName) {
  const found = existingByName.get(nombre.toLowerCase());
  if (found && found.type === ChannelType.GuildCategory) return found;
  return guild.channels.create({
    name: nombre,
    type: ChannelType.GuildCategory,
    reason: 'Aegis · despliegue de estructura',
  });
}

async function asegurarTexto(guild, parent, def, existingByName) {
  const found = existingByName.get(def.nombre.toLowerCase());
  if (found && found.type === ChannelType.GuildText) {
    if (found.parentId !== parent.id) {
      await found.setParent(parent.id, { reason: 'Aegis · reordenar' }).catch(() => {});
    }
    return found;
  }

  const overwrites = [
    {
      id: guild.id,
      deny: def.publico
        ? (def.writePublic ? [] : [PermissionFlagsBits.SendMessages])
        : [PermissionFlagsBits.ViewChannel],
      allow: def.publico
        ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        : [],
    },
  ];

  if (def.publico && def.writePublic) {
    overwrites[0].allow.push(PermissionFlagsBits.SendMessages);
  }

  return guild.channels.create({
    name: def.nombre,
    type: ChannelType.GuildText,
    parent: parent.id,
    permissionOverwrites: overwrites,
    reason: 'Aegis · despliegue de canales',
  });
}

async function asegurarVoz(guild, parent, def, existingByName) {
  const found = existingByName.get(def.nombre.toLowerCase());
  if (found && found.type === ChannelType.GuildVoice) {
    if (found.parentId !== parent.id) {
      await found.setParent(parent.id, { reason: 'Aegis · reordenar voz' }).catch(() => {});
    }
    return found;
  }
  return guild.channels.create({
    name: def.nombre,
    type: ChannelType.GuildVoice,
    parent: parent.id,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
    ],
    reason: 'Aegis · oficina de voz',
  });
}

function mapearCanalEnDb(canalKey, channelId) {
  const db = getDb();
  db.prepare(`
    INSERT INTO roles_map (cargo_key, role_id)
    VALUES (?, ?)
    ON CONFLICT(cargo_key) DO UPDATE SET role_id = excluded.role_id
  `).run(`CHMAP.${canalKey}`, channelId);
}

function enlazarKeysACanal(channelId, keyIds) {
  if (!keyIds?.length) return;
  const db = getDb();
  for (const keyId of keyIds) {
    const llave = db.prepare('SELECT id, canales_json FROM llaves WHERE id = ?').get(keyId);
    if (!llave) continue;
    let canales = [];
    try { canales = JSON.parse(llave.canales_json || '[]'); } catch (_) { canales = []; }
    if (!canales.includes(channelId)) {
      canales.push(channelId);
      db.prepare('UPDATE llaves SET canales_json = ? WHERE id = ?').run(JSON.stringify(canales), keyId);
    }
  }
}

async function desplegarEstructura(guild, actorTag) {
  const resumen = {
    borrados: 0,
    categorias: 0,
    textos: 0,
    voces: 0,
    keysEnlazadas: 0,
    errores: [],
  };

  resumen.borrados = await borrarPlantillaAnterior(guild);

  await guild.channels.fetch().catch(() => {});
  const existingByName = new Map();
  for (const ch of guild.channels.cache.values()) {
    existingByName.set(ch.name.toLowerCase(), ch);
  }

  for (const cat of ESTRUCTURA) {
    let categoria;
    try {
      categoria = await asegurarCategoria(guild, cat.nombre, existingByName);
      existingByName.set(categoria.name.toLowerCase(), categoria);
      resumen.categorias += 1;
    } catch (err) {
      resumen.errores.push(`Categoria ${cat.nombre}: ${err.message}`);
      continue;
    }

    for (const def of cat.canales || []) {
      try {
        const ch = await asegurarTexto(guild, categoria, def, existingByName);
        existingByName.set(ch.name.toLowerCase(), ch);
        mapearCanalEnDb(def.key, ch.id);
        if (def.configKey) setConfig(def.configKey, ch.id);
        if (def.keys?.length) {
          enlazarKeysACanal(ch.id, def.keys);
          resumen.keysEnlazadas += def.keys.length;
        }
        resumen.textos += 1;
      } catch (err) {
        resumen.errores.push(`${def.nombre}: ${err.message}`);
      }
    }

    for (const def of cat.voz || []) {
      try {
        const ch = await asegurarVoz(guild, categoria, def, existingByName);
        existingByName.set(ch.name.toLowerCase(), ch);
        mapearCanalEnDb(def.key, ch.id);
        resumen.voces += 1;
      } catch (err) {
        resumen.errores.push(`${def.nombre}: ${err.message}`);
      }
    }
  }

  const sol = getConfig('canal_solicitudes');
  if (sol) setConfig('canal_logs_cofundadores', sol);

  auditoria.registrar('system', 'CANALES.DESPLEGAR', {
    actor: actorTag,
    ...resumen,
  });

  return resumen;
}

module.exports = {
  desplegarEstructura,
  borrarPlantillaAnterior,
  ESTRUCTURA,
};
