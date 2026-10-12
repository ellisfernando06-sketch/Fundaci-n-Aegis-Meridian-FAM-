/**
 * Finanzas institucionales · Fundación Aegis-Meridian
 * Moneda interna: créditos Aegis (₡)
 * Control exclusivo del Fundador para operaciones de caja.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const { getTodosCargos, getCargoPorKey } = require('../data/organigrama');
const { embedBase, COLORES, MARCA, logoUrl } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const auditoria = require('./auditoria');
const { actorTexto } = require('./solicitudes');

const MONEDA = '₡';
const INTERVALOS = [
  { value: '7', label: 'Cada 7 dias' },
  { value: '14', label: 'Cada 14 dias' },
  { value: '30', label: 'Cada 30 dias' },
  { value: '0', label: 'Solo manual (sin automatico)' },
];

/** Discord permite max 25 opciones por select. */
const OPCIONES_POR_PAGINA = 25;

/**
 * Cargos elegibles para escala salarial:
 * toda la Fundación + staff (moderación, soporte, cúpula, direcciones, facciones).
 * Excluye solo Insurgencia del Caos (facción enemiga).
 */
function listarCargosParaSalario() {
  return getTodosCargos()
    .filter((c) => {
      const key = String(c.key || '');
      const rama = String(c.rama || '');
      if (key.startsWith('CAOS.') || rama === 'insurgencia') return false;
      return true;
    })
    .sort((a, b) => (a.orden || 999) - (b.orden || 999));
}

function asegurarTablas() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS finanzas_saldos (
      discord_id TEXT PRIMARY KEY,
      saldo REAL DEFAULT 0,
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS finanzas_salarios (
      cargo_key TEXT PRIMARY KEY,
      monto REAL NOT NULL DEFAULT 0,
      intervalo_dias INTEGER NOT NULL DEFAULT 7,
      activo INTEGER DEFAULT 1,
      actualizado_por TEXT,
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS finanzas_movimientos (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      saldo_despues REAL,
      concepto TEXT,
      autorizado_por TEXT,
      firma_estado TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS finanzas_pendientes (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      monto REAL NOT NULL,
      concepto TEXT,
      autorizado_por TEXT,
      estado TEXT DEFAULT 'pendiente',
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);
}

function esFundador(member) {
  if (!member) return false;
  const db = getDb();
  const row = db.prepare("SELECT role_id FROM roles_map WHERE cargo_key = 'ST.FUNDADOR'").get();
  if (row?.role_id && member.roles?.cache?.has(row.role_id)) return true;
  return member.roles?.cache?.some((r) =>
    /fundador/i.test(r.name) && !/co\s*fundador/i.test(r.name)
  ) || false;
}

function formatear(monto) {
  const n = Number(monto) || 0;
  return `${MONEDA}${n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function obtenerSaldo(discordId) {
  asegurarTablas();
  const db = getDb();
  let row = db.prepare('SELECT saldo FROM finanzas_saldos WHERE discord_id = ?').get(discordId);
  if (!row) {
    db.prepare('INSERT INTO finanzas_saldos (discord_id, saldo) VALUES (?, 0)').run(discordId);
    return 0;
  }
  return Number(row.saldo) || 0;
}

function ajustarSaldo(discordId, delta) {
  asegurarTablas();
  const db = getDb();
  obtenerSaldo(discordId);
  db.prepare(`
    UPDATE finanzas_saldos
    SET saldo = saldo + ?, actualizado_en = datetime('now')
    WHERE discord_id = ?
  `).run(delta, discordId);
  return obtenerSaldo(discordId);
}

function registrarMovimiento({ discordId, tipo, monto, concepto, autorizadoPor, firmaEstado = 'n/a' }) {
  asegurarTablas();
  const id = nextId('FIN');
  const saldoDespues = obtenerSaldo(discordId);
  getDb().prepare(`
    INSERT INTO finanzas_movimientos
      (id, discord_id, tipo, monto, saldo_despues, concepto, autorizado_por, firma_estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, discordId, tipo, monto, saldoDespues, concepto, autorizadoPor, firmaEstado);
  return id;
}

function listarSalarios() {
  asegurarTablas();
  const rows = getDb().prepare('SELECT * FROM finanzas_salarios ORDER BY cargo_key').all();
  const cargos = getTodosCargos();
  const byKey = new Map(cargos.map((c) => [c.key, c]));
  return rows.map((r) => ({
    ...r,
    cargo: byKey.get(r.cargo_key) || { key: r.cargo_key, nombre: r.cargo_key, nombreRol: r.cargo_key },
  }));
}

function upsertSalario(cargoKey, monto, intervaloDias, actorTag) {
  asegurarTablas();
  getDb().prepare(`
    INSERT INTO finanzas_salarios (cargo_key, monto, intervalo_dias, activo, actualizado_por, actualizado_en)
    VALUES (?, ?, ?, 1, ?, datetime('now'))
    ON CONFLICT(cargo_key) DO UPDATE SET
      monto = excluded.monto,
      intervalo_dias = excluded.intervalo_dias,
      activo = 1,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = datetime('now')
  `).run(cargoKey, monto, intervaloDias, actorTag);
}

function embedPanelControl(ctx = {}) {
  const icon = logoUrl(ctx.client, ctx.guild);
  const salarios = listarSalarios().filter((s) => s.activo && s.monto > 0);
  const totalCargos = listarCargosParaSalario().length;
  const lineas = salarios.length
    ? salarios.slice(0, 25).map((s) => {
      const nombre = s.cargo.nombre || s.cargo_key;
      const rama = s.cargo.nombreRama ? ` · ${s.cargo.nombreRama}` : '';
      const intv = s.intervalo_dias > 0 ? `cada ${s.intervalo_dias}d` : 'manual';
      return `· **${nombre}**${rama} — ${formatear(s.monto)} · ${intv}`;
    }).join('\n')
    : '_Sin salarios configurados._';

  const db = getDb();
  const caja = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(saldo),0) AS total FROM finanzas_saldos').get();
  const pend = db.prepare("SELECT COUNT(*) AS n FROM finanzas_pendientes WHERE estado = 'pendiente'").get();

  return embedBase({
    color: COLORES.finanzas,
    author: { name: `${MARCA.nombre} · ${MARCA.corto}`, iconURL: icon || undefined },
    titulo: `▣ ${MARCA.finanzas}`,
    descripcion:
      `*${MARCA.lema}*\n\n` +
      'Control institucional de **créditos Aegis**.\n' +
      'Solo el **Fundador** autoriza movimientos de caja y nóminas manuales.\n\n' +
      `Cargos disponibles en escala: **${totalCargos}** (Fundación, staff, direcciones y facciones).\n` +
      '─────────────────────────────',
    campos: [
      {
        name: '╭─  Resumen de caja',
        value:
          `Cuentas activas: **${caja?.n ?? 0}**\n` +
          `Circulante registrado: **${formatear(caja?.total ?? 0)}**\n` +
          `Transferencias pendientes de firma: **${pend?.n ?? 0}**`,
        inline: false,
      },
      {
        name: `╭─  Escala salarial (${salarios.length} configurados)`,
        value: truncar(lineas, 1000),
        inline: false,
      },
      {
        name: '╭─  Operaciones disponibles',
        value:
          '**Configurar salario** — todos los cargos (páginas)\n' +
          '**Pago manual** — transferencia individual con firma en DM\n' +
          '**Procesar nómina** — genera pendientes según escala\n' +
          '**Libro mayor** — últimos movimientos',
        inline: false,
      },
    ],
    thumbnail: icon || undefined,
    footer: `${MARCA.finanzas} · Confidencial`,
    footerIcon: icon || undefined,
  });
}

function botonesPanel() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('finanzas:cfg_salario').setLabel('Configurar salario').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('finanzas:pago_manual').setLabel('Pago manual').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('finanzas:nomina').setLabel('Procesar nómina').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('finanzas:libro').setLabel('Libro mayor').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('finanzas:refrescar').setLabel('Actualizar panel').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/**
 * Menú de cargos con paginación (25 por página = límite Discord).
 * Incluye Fundación, Moderación, Soporte, Cúpula, Direcciones y facciones.
 */
function menuCargosSalario(pagina = 0) {
  const todos = listarCargosParaSalario();
  const totalPaginas = Math.max(1, Math.ceil(todos.length / OPCIONES_POR_PAGINA));
  const p = Math.min(Math.max(0, Number(pagina) || 0), totalPaginas - 1);
  const slice = todos.slice(p * OPCIONES_POR_PAGINA, (p + 1) * OPCIONES_POR_PAGINA);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`finanzas:sel_cargo:${p}`)
    .setPlaceholder(`Cargos · página ${p + 1}/${totalPaginas} (${todos.length} total)`)
    .addOptions(
      slice.map((c) => ({
        label: String(c.nombre).slice(0, 100),
        value: c.key,
        description: String(c.nombreRama || c.rama || c.key).slice(0, 100),
      }))
    );

  const rows = [new ActionRowBuilder().addComponents(select)];

  if (totalPaginas > 1) {
    const nav = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`finanzas:cfg_pagina:${p - 1}`)
        .setLabel('◀ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p <= 0),
      new ButtonBuilder()
        .setCustomId('finanzas:cfg_pagina_info')
        .setLabel(`${p + 1} / ${totalPaginas}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`finanzas:cfg_pagina:${p + 1}`)
        .setLabel('Siguiente ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p >= totalPaginas - 1),
    );
    rows.push(nav);
  }

  return rows;
}

function embedCfgSalario(pagina = 0) {
  const todos = listarCargosParaSalario();
  const totalPaginas = Math.max(1, Math.ceil(todos.length / OPCIONES_POR_PAGINA));
  const p = Math.min(Math.max(0, Number(pagina) || 0), totalPaginas - 1);

  const porRama = {};
  for (const c of todos) {
    const r = c.nombreRama || c.rama || 'Otros';
    porRama[r] = (porRama[r] || 0) + 1;
  }
  const resumenRamas = Object.entries(porRama)
    .map(([k, v]) => `· ${k}: **${v}**`)
    .join('\n');

  return embedBase({
    color: COLORES.finanzas,
    titulo: 'Configurar salario por cargo',
    descripcion:
      'Selecciona el cargo de la **Fundación** o del **staff**.\n' +
      'Luego indicarás **monto** e **intervalo en días**.\n\n' +
      `Total cargos: **${todos.length}** · Página **${p + 1}/${totalPaginas}**`,
    campos: [
      {
        name: 'Ramas incluidas',
        value: truncar(resumenRamas || '—', 900),
        inline: false,
      },
    ],
    footer: 'Finanzas · Escala salarial',
  });
}

function modalSalario(cargoKey) {
  const cargo = getCargoPorKey(cargoKey);
  const actual = getDb().prepare('SELECT * FROM finanzas_salarios WHERE cargo_key = ?').get(cargoKey);
  const modal = new ModalBuilder()
    .setCustomId(`finanzas:modal_salario:${cargoKey}`)
    .setTitle(`Salario · ${(cargo?.nombre || cargoKey).slice(0, 30)}`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('monto')
        .setLabel('Monto por periodo (numeros)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(actual ? String(actual.monto) : '100')
        .setMaxLength(12),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('intervalo')
        .setLabel('Intervalo en dias (0 = solo manual)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(actual ? String(actual.intervalo_dias) : '7')
        .setMaxLength(3),
    ),
  );
  return modal;
}

function modalPagoManual() {
  const modal = new ModalBuilder()
    .setCustomId('finanzas:modal_pago')
    .setTitle('Pago manual · autorizacion');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('discord_id')
        .setLabel('ID de Discord del beneficiario')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(25),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('monto')
        .setLabel('Monto a transferir')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(12),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('concepto')
        .setLabel('Concepto / referencia')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(200),
    ),
  );
  return modal;
}

async function emitirTransferencia({ client, guild, beneficiarioId, monto, concepto, autorizadoPor }) {
  asegurarTablas();
  const id = nextId('TRF');
  const db = getDb();
  db.prepare(`
    INSERT INTO finanzas_pendientes (id, discord_id, monto, concepto, autorizado_por, estado)
    VALUES (?, ?, ?, ?, ?, 'pendiente')
  `).run(id, beneficiarioId, monto, sanitizar(concepto), autorizadoPor);

  auditoria.registrar(autorizadoPor, 'FIN.EMITIR', {
    id, beneficiarioId, monto, concepto,
  });

  const user = await client.users.fetch(beneficiarioId).catch(() => null);
  if (!user) return { id, dm: false };

  const icon = logoUrl(client, guild);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`finanzas:firmar:${id}`)
      .setLabel('Firmar y aceptar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`finanzas:rechazar:${id}`)
      .setLabel('Rechazar transferencia')
      .setStyle(ButtonStyle.Danger),
  );

  try {
    await user.send({
      embeds: [
        embedBase({
          color: COLORES.oro,
          author: { name: `${MARCA.nombre} · ${MARCA.corto}`, iconURL: icon || undefined },
          titulo: `Notificación de transferencia · ${MARCA.finanzas}`,
          descripcion:
            `*${MARCA.lema}*\n\n` +
            'La **Oficina de Finanzas** ha autorizado un movimiento a tu favor.\n' +
            'Para completar el depósito debes **firmar** esta notificación.',
          campos: [
            { name: 'Referencia', value: `\`${id}\``, inline: true },
            { name: 'Importe', value: formatear(monto), inline: true },
            { name: 'Concepto', value: truncar(sanitizar(concepto), 200), inline: false },
            {
              name: 'Condición',
              value: 'Al firmar confirmas haber sido notificado y aceptas el crédito en tu cuenta interna.',
              inline: false,
            },
          ],
          footer: `${MARCA.finanzas} · Firma electrónica`,
          footerIcon: icon || undefined,
        }),
      ],
      components: [row],
    });
    return { id, dm: true };
  } catch (_) {
    return { id, dm: false };
  }
}

async function firmarTransferencia(pendienteId, userId, aceptar) {
  asegurarTablas();
  const db = getDb();
  const p = db.prepare('SELECT * FROM finanzas_pendientes WHERE id = ?').get(pendienteId);
  if (!p || p.estado !== 'pendiente') throw new Error('Transferencia no disponible o ya resuelta');
  if (p.discord_id !== userId) throw new Error('Esta firma no te corresponde');

  if (!aceptar) {
    db.prepare("UPDATE finanzas_pendientes SET estado = 'rechazada' WHERE id = ?").run(pendienteId);
    auditoria.registrar(userId, 'FIN.RECHAZAR', { id: pendienteId });
    return { p, aceptada: false };
  }

  const saldo = ajustarSaldo(userId, Number(p.monto));
  const movId = registrarMovimiento({
    discordId: userId,
    tipo: 'credito',
    monto: Number(p.monto),
    concepto: p.concepto,
    autorizadoPor: p.autorizado_por,
    firmaEstado: 'firmada',
  });
  db.prepare("UPDATE finanzas_pendientes SET estado = 'firmada' WHERE id = ?").run(pendienteId);
  db.prepare('UPDATE finanzas_movimientos SET saldo_despues = ? WHERE id = ?').run(saldo, movId);

  auditoria.registrar(userId, 'FIN.FIRMAR', { id: pendienteId, movId, monto: p.monto });
  return { p, aceptada: true, saldo, movId };
}

async function procesarNomina(guild, client, actorTag) {
  asegurarTablas();
  const salarios = listarSalarios().filter((s) => s.activo && s.monto > 0);
  const resultados = { emitidos: 0, omitidos: 0, errores: [] };

  for (const sal of salarios) {
    const map = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(sal.cargo_key);
    if (!map?.role_id) {
      resultados.omitidos += 1;
      continue;
    }
    const role = guild.roles.cache.get(map.role_id);
    if (!role) {
      resultados.omitidos += 1;
      continue;
    }
    for (const [, member] of role.members) {
      if (member.user.bot) continue;
      try {
        await emitirTransferencia({
          client,
          guild,
          beneficiarioId: member.id,
          monto: sal.monto,
          concepto: `Nómina · ${sal.cargo.nombre || sal.cargo_key} · intervalo ${sal.intervalo_dias}d`,
          autorizadoPor: actorTag,
        });
        resultados.emitidos += 1;
      } catch (err) {
        resultados.errores.push(`${member.user.tag}: ${err.message}`);
      }
    }
  }
  return resultados;
}

function ultimosMovimientos(limit = 15) {
  asegurarTablas();
  return getDb().prepare(
    'SELECT * FROM finanzas_movimientos ORDER BY creado_en DESC LIMIT ?'
  ).all(limit);
}

module.exports = {
  MONEDA,
  INTERVALOS,
  asegurarTablas,
  esFundador,
  formatear,
  obtenerSaldo,
  ajustarSaldo,
  registrarMovimiento,
  listarSalarios,
  listarCargosParaSalario,
  upsertSalario,
  embedPanelControl,
  botonesPanel,
  menuCargosSalario,
  embedCfgSalario,
  modalSalario,
  modalPagoManual,
  emitirTransferencia,
  firmarTransferencia,
  procesarNomina,
  ultimosMovimientos,
};
