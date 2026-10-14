/**
 * Control de acceso por nivel de autorizacion y llaves (KEYS).
 * Administrator de Discord siempre pasa.
 */

const { PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../db');
const { accesoDenegado } = require('../utils/plantillas');
const auditoria = require('./auditoria');

/**
 * Requisitos por comando slash.
 * nivelMin: nivel_auth minimo en ficha
 * keys: al menos una de estas llaves activas (o Admin)
 * soloAdmin: solo Administrator de Discord
 * allowPublic: cualquiera puede usar (consulta basica)
 */
const REQUISITOS = {
  // Fase 1
  perfil: { allowPublic: true },
  config: { soloAdmin: true },
  config_roles: { soloAdmin: true },
  eliminar_roles: { soloAdmin: true },

  // Fase 2
  organigrama: { allowPublic: true },
  personal: {
    nivelMin: 1,
    keys: ['KEY-CUP-01', 'KEY-CUP-02', 'KEY-SI-03'],
    cargos: ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA', 'DIR.GENERAL', 'ST.ADMIN_JEFE'],
  },
  autorizacion: {
    nivelMin: 2,
    keys: ['KEY-CUP-01', 'KEY-SI-03'],
    cargos: ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA', 'DIR.GENERAL'],
  },
  area: {
    nivelMin: 1,
    keys: ['KEY-CUP-01', 'KEY-SI-03'],
    cargos: ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA', 'DIR.GENERAL', 'ST.ADMIN_JEFE'],
  },
  llaves: {
    // catalogo/mias publicos; otorgar/revocar se filtran en el comando
    allowPublic: true,
  },
  config_llaves: { soloAdmin: true },

  // Fase 3
  anomalia: {
    nivelMin: 2,
    keys: ['KEY-INV-01', 'KEY-INV-02', 'KEY-INV-03', 'KEY-ESP-01', 'KEY-ESP-07'],
    cargos: ['INV.DIRECTOR', 'INV.JEFE', 'DIR.GENERAL', 'ST.FUNDADOR'],
  },
  incidente: {
    nivelMin: 2,
    keys: ['KEY-SEG-01', 'KEY-SEG-02', 'KEY-SEG-03', 'KEY-SEG-04', 'KEY-SI-01'],
    cargos: ['SEG.COMANDANTE', 'SI.GERENTE', 'SI.JEFE', 'DIR.GENERAL'],
  },
  alerta: {
    nivelMin: 3,
    keys: ['KEY-ESP-06', 'KEY-SEG-03', 'KEY-SEG-04', 'KEY-CUP-01'],
    cargos: ['SEG.COMANDANTE', 'DIR.GENERAL', 'ST.FUNDADOR', 'ST.CO_CALIDAD'],
  },
  mision: {
    nivelMin: 2,
    keys: ['KEY-SEG-02', 'KEY-SEG-03', 'KEY-SEG-04', 'KEY-FTM-02', 'KEY-ERR-02'],
    cargos: ['SEG.COMANDANTE', 'DIR.GENERAL', 'SI.GERENTE'],
  },

  // Fase 4
  sancion: {
    nivelMin: 2,
    keys: ['KEY-SI-01', 'KEY-SI-02', 'KEY-SI-03', 'KEY-CUP-01'],
    cargos: ['SI.GERENTE', 'SI.JEFE', 'DIR.GENERAL', 'ST.FUNDADOR', 'ST.ADMIN_JEFE'],
  },
  interna: {
    nivelMin: 3,
    keys: ['KEY-SI-02', 'KEY-SI-03', 'KEY-INT-02', 'KEY-INT-03', 'KEY-ESP-09'],
    cargos: ['SI.GERENTE', 'SI.JEFE', 'INT.GERENTE', 'DIR.GENERAL', 'ST.FUNDADOR'],
  },

  // Seguridad Interna · operativo
  si: {
    nivelMin: 1,
    keys: ['KEY-SI-01', 'KEY-SI-02', 'KEY-SI-03'],
    cargos: [
      'SI.GERENTE',
      'SI.JEFE',
      'SI.SUPERVISOR',
      'SI.INTERROGATORIO',
      'SI.AGENTE_CAMPO',
      'SI.AGENTE',
      'SI.INGRESO',
      'DIR.GENERAL',
      'ST.FUNDADOR',
      'ST.CO_CALIDAD',
      'ST.CO_ESTRATEGIA',
    ],
  },
};

function esAdminDiscord(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function perfilDe(discordId) {
  return getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(discordId) || null;
}

function llavesActivas(discordId) {
  return getDb().prepare(`
    SELECT llave_id FROM llaves_titulares
    WHERE discord_id = ? AND activa = 1
  `).all(discordId).map((r) => r.llave_id);
}

function cargosMapeados(member) {
  if (!member) return [];
  const map = getDb().prepare('SELECT cargo_key, role_id FROM roles_map').all();
  const keys = [];
  for (const row of map) {
    if (member.roles.cache.has(row.role_id)) keys.push(row.cargo_key);
  }
  return keys;
}

/**
 * @returns {{ ok: boolean, motivo?: string, nivel?: number, embed?: object }}
 */
function verificarAcceso(interaction, commandName = null) {
  const name = commandName || interaction.commandName;
  const req = REQUISITOS[name];

  if (!req || req.allowPublic) return { ok: true };

  if (esAdminDiscord(interaction)) return { ok: true, admin: true };

  if (req.soloAdmin) {
    auditoria.registrar(interaction.user.id, 'ACCESO.DENEGADO', { comando: name, motivo: 'soloAdmin' });
    return {
      ok: false,
      motivo: 'Se requiere Administrator.',
      embed: accesoDenegado({
        recurso: `/${name}`,
        nivelRequerido: 'Administrator',
        nivelActual: '—',
      }),
    };
  }

  const perfil = perfilDe(interaction.user.id);
  const nivel = perfil?.nivel_auth ?? 0;
  const keysUser = new Set(llavesActivas(interaction.user.id));
  const cargosUser = new Set(cargosMapeados(interaction.member));

  const nivelOk = req.nivelMin == null || nivel >= req.nivelMin;
  const keyOk = !req.keys?.length || req.keys.some((k) => keysUser.has(k));
  const cargoOk = !req.cargos?.length || req.cargos.some((c) => cargosUser.has(c));

  // Pasa si (nivel suficiente Y (tiene key O cargo de mando))
  // Si no hay keys ni cargos definidos, basta el nivel
  const credencialOk =
    (!req.keys?.length && !req.cargos?.length) || keyOk || cargoOk;

  if (nivelOk && credencialOk) return { ok: true, nivel };

  auditoria.registrar(interaction.user.id, 'ACCESO.DENEGADO', {
    comando: name,
    nivel,
    nivelMin: req.nivelMin,
    keys: [...keysUser],
  });

  return {
    ok: false,
    nivel,
    motivo: 'Nivel de autorizacion o llave insuficiente.',
    embed: accesoDenegado({
      recurso: `/${name}`,
      nivelRequerido: req.nivelMin ?? '—',
      nivelActual: nivel,
    }),
  };
}

/** Para subcomandos sensibles de /llaves (otorgar/revocar) */
function puedeGestionarLlaves(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const check = verificarAcceso(interaction, 'autorizacion');
  return check.ok;
}

module.exports = {
  REQUISITOS,
  verificarAcceso,
  puedeGestionarLlaves,
  esAdminDiscord,
  perfilDe,
  llavesActivas,
  cargosMapeados,
};
