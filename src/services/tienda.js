/**
 * Tienda interna · impuestos · multas
 * Moneda: creditos Aegis (₡)
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
const { getDb, nextId, getConfig, setConfig } = require('../db');
const {
  asegurarTablas,
  obtenerSaldo,
  ajustarSaldo,
  registrarMovimiento,
  formatear,
  esFundador,
} = require('./finanzas');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const auditoria = require('./auditoria');
const { actorTexto } = require('./solicitudes');

/** Multas sugeridas por tipo de sancion */
const MULTAS_POR_TIPO = {
  'Amonestacion verbal': 25,
  'Amonestacion escrita': 75,
  'Suspension temporal': 200,
  'Degradacion': 350,
  'Expulsion de area': 500,
  'Expulsion de la Fundacion': 1000,
};

function asegurarTienda() {
  asegurarTablas();
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tienda_items (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      stock INTEGER DEFAULT -1,
      activo INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tienda_compras (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      precio REAL NOT NULL,
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);
  // Impuesto por defecto 5% si no existe
  if (getConfig('fin_impuesto_pct') == null) setConfig('fin_impuesto_pct', '5');
}

function getImpuestoPct() {
  const v = Number(getConfig('fin_impuesto_pct'));
  if (Number.isNaN(v) || v < 0) return 5;
  return Math.min(v, 50);
}

function setImpuestoPct(pct, actorTag) {
  setConfig('fin_impuesto_pct', String(pct));
  auditoria.registrar('system', 'FIN.IMPUESTO', { pct, actor: actorTag });
}

/**
 * Debito inmediato (multa / compra / impuesto).
 * Si saldo insuficiente, deja saldo en 0 y registra deuda parcial en concepto.
 */
function debitar(discordId, monto, concepto, autorizadoPor) {
  asegurarTienda();
  const m = Math.abs(Number(monto) || 0);
  if (m <= 0) return { cobrado: 0, saldo: obtenerSaldo(discordId) };

  const saldoAntes = obtenerSaldo(discordId);
  const cobrado = Math.min(saldoAntes, m);
  const faltante = m - cobrado;
  const saldo = ajustarSaldo(discordId, -cobrado);

  const id = registrarMovimiento({
    discordId,
    tipo: 'debito',
    monto: -cobrado,
    concepto: faltante > 0
      ? `${concepto} (parcial; pendiente ${formatear(faltante)})`
      : concepto,
    autorizadoPor,
    firmaEstado: 'n/a',
  });

  // Corregir saldo_despues
  getDb().prepare('UPDATE finanzas_movimientos SET saldo_despues = ? WHERE id = ?').run(saldo, id);

  return { cobrado, faltante, saldo, movId: id };
}

function aplicarMultaPorSancion(discordId, tipoSancion, sancionId, actorTag) {
  asegurarTienda();
  const base = MULTAS_POR_TIPO[tipoSancion] ?? 50;
  const pct = getImpuestoPct();
  // La multa es fija; el "impuesto" institucional se suma como recargo de tramitacion
  const recargo = Math.round((base * pct) / 100 * 100) / 100;
  const total = base + recargo;

  const r = debitar(
    discordId,
    total,
    `Multa disciplinaria · ${tipoSancion} · ${sancionId} (base ${formatear(base)} + recargo ${formatear(recargo)})`,
    actorTag
  );

  auditoria.registrar(discordId, 'FIN.MULTA', {
    sancionId, tipoSancion, total, ...r, actor: actorTag,
  });

  return { base, recargo, total, ...r };
}

function listarItems(soloActivos = true) {
  asegurarTienda();
  if (soloActivos) {
    return getDb().prepare(
      'SELECT * FROM tienda_items WHERE activo = 1 ORDER BY precio ASC'
    ).all();
  }
  return getDb().prepare('SELECT * FROM tienda_items ORDER BY nombre').all();
}

function crearItem({ nombre, descripcion, precio, stock }, actorTag) {
  asegurarTienda();
  const id = nextId('ITM');
  getDb().prepare(`
    INSERT INTO tienda_items (id, nombre, descripcion, precio, stock, activo)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, sanitizar(nombre), sanitizar(descripcion || ''), Number(precio), stock == null ? -1 : Number(stock));
  auditoria.registrar('system', 'TIENDA.CREAR', { id, nombre, precio, actor: actorTag });
  return id;
}

function comprarItem(discordId, itemId) {
  asegurarTienda();
  const db = getDb();
  const item = db.prepare('SELECT * FROM tienda_items WHERE id = ? AND activo = 1').get(itemId);
  if (!item) throw new Error('Articulo no disponible');
  if (item.stock === 0) throw new Error('Sin stock');

  const saldo = obtenerSaldo(discordId);
  if (saldo < item.precio) {
    throw new Error(`Saldo insuficiente. Necesitas ${formatear(item.precio)}; tienes ${formatear(saldo)}.`);
  }

  const r = debitar(discordId, item.precio, `Compra tienda · ${item.nombre} (${item.id})`, 'tienda');
  if (item.stock > 0) {
    db.prepare('UPDATE tienda_items SET stock = stock - 1 WHERE id = ?').run(itemId);
  }
  const compraId = nextId('CMP');
  db.prepare(`
    INSERT INTO tienda_compras (id, item_id, discord_id, precio) VALUES (?, ?, ?, ?)
  `).run(compraId, itemId, discordId, item.precio);

  auditoria.registrar(discordId, 'TIENDA.COMPRA', { compraId, itemId, precio: item.precio });
  return { item, compraId, ...r };
}

function embedCatalogo(items) {
  const desc = items.length
    ? items.map((i) => {
      const stock = i.stock < 0 ? '∞' : String(i.stock);
      return `**${i.id}** · ${i.nombre} — **${formatear(i.precio)}** · stock ${stock}\n_${truncar(i.descripcion || '—', 80)}_`;
    }).join('\n\n')
    : '_Catalogo vacio._';

  return embedBase({
    color: 0xc9a227,
    titulo: '▣ Economato · Tienda interna F.A.M.',
    descripcion:
      'Adquiere articulos con **creditos Aegis**.\n' +
      `Impuesto/recargo institucional vigente: **${getImpuestoPct()}%** (aplicado en multas).\n\n` +
      truncar(desc, 3500),
    footer: 'Economato',
  });
}

function botonesCatalogo(items) {
  const rows = [];
  if (items.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('tienda:comprar')
          .setPlaceholder('Selecciona un articulo para comprar')
          .addOptions(
            items.slice(0, 25).map((i) => ({
              label: `${i.nombre}`.slice(0, 100),
              value: i.id,
              description: `${formatear(i.precio)}`.slice(0, 100),
            }))
          )
      )
    );
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tienda:refrescar').setLabel('Actualizar catalogo').setStyle(ButtonStyle.Secondary)
    )
  );
  return rows;
}

function modalNuevoItem() {
  const modal = new ModalBuilder().setCustomId('tienda:modal_item').setTitle('Nuevo articulo');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nombre').setLabel('Nombre').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('precio').setLabel('Precio (₡)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('stock').setLabel('Stock (-1 = ilimitado)').setStyle(TextInputStyle.Short).setRequired(true).setValue('-1').setMaxLength(6)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('descripcion').setLabel('Descripcion').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200)
    ),
  );
  return modal;
}

function modalImpuesto() {
  const modal = new ModalBuilder().setCustomId('tienda:modal_impuesto').setTitle('Impuesto institucional');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('pct')
        .setLabel('Porcentaje de recargo en multas (0-50)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(getImpuestoPct()))
        .setMaxLength(4)
    )
  );
  return modal;
}

module.exports = {
  MULTAS_POR_TIPO,
  asegurarTienda,
  getImpuestoPct,
  setImpuestoPct,
  debitar,
  aplicarMultaPorSancion,
  listarItems,
  crearItem,
  comprarItem,
  embedCatalogo,
  botonesCatalogo,
  modalNuevoItem,
  modalImpuesto,
  esFundador,
  formatear,
  obtenerSaldo,
};
