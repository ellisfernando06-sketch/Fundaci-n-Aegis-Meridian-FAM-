const { MessageFlags } = require('discord.js');
const {
  asegurarTienda,
  listarItems,
  comprarItem,
  crearItem,
  embedCatalogo,
  botonesCatalogo,
  modalNuevoItem,
  modalImpuesto,
  setImpuestoPct,
  getImpuestoPct,
  esFundador,
  formatear,
  obtenerSaldo,
} = require('../services/tienda');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');
const { sanitizar } = require('../utils/helpers');

const prefix = 'tienda';

async function handle(interaction, accion, args) {
  asegurarTienda();

  switch (accion) {
    case 'comprar':
      return onComprar(interaction);
    case 'refrescar':
      return onRefrescar(interaction);
    case 'nuevo_item':
      return onNuevoItemBtn(interaction);
    case 'modal_item':
      return onModalItem(interaction);
    case 'impuesto':
      return onImpuestoBtn(interaction);
    case 'modal_impuesto':
      return onModalImpuesto(interaction);
    default:
      await interaction.reply({
        content: 'Accion de economato no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onComprar(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const itemId = interaction.values[0];
  try {
    const r = await comprarItem(interaction.user.id, itemId);
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Compra registrada',
        campos: [
          { name: 'Articulo', value: r.item.nombre, inline: true },
          { name: 'Precio', value: formatear(r.item.precio), inline: true },
          { name: 'Saldo restante', value: formatear(r.saldo), inline: true },
          { name: 'Comprobante', value: r.compraId, inline: true },
        ],
        footer: 'Economato',
      })],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Compra no completada',
        descripcion: String(err.message || err).slice(0, 400),
        footer: 'Economato',
      })],
    });
  }
}

async function onRefrescar(interaction) {
  const items = listarItems(true);
  await interaction.update({
    embeds: [embedCatalogo(items)],
    components: botonesCatalogo(items),
  }).catch(async () => {
    await interaction.reply({
      embeds: [embedCatalogo(items)],
      components: botonesCatalogo(items),
      flags: MessageFlags.Ephemeral,
    });
  });
}

async function onNuevoItemBtn(interaction) {
  if (!esFundador(interaction.member)) {
    await interaction.reply({
      content: 'Solo el Fundador gestiona el catalogo.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.showModal(modalNuevoItem());
}

async function onModalItem(interaction) {
  if (!esFundador(interaction.member)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  const nombre = sanitizar(interaction.fields.getTextInputValue('nombre'));
  const precio = Number(String(interaction.fields.getTextInputValue('precio')).replace(',', '.'));
  const stock = parseInt(interaction.fields.getTextInputValue('stock'), 10);
  const descripcion = sanitizar(interaction.fields.getTextInputValue('descripcion') || '');

  if (!nombre || Number.isNaN(precio) || precio < 0 || Number.isNaN(stock)) {
    await interaction.reply({ content: 'Datos invalidos.', flags: MessageFlags.Ephemeral });
    return;
  }

  const id = crearItem(
    { nombre, descripcion, precio, stock },
    actorTexto(interaction.user)
  );

  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Articulo dado de alta',
      campos: [
        { name: 'ID', value: id, inline: true },
        { name: 'Nombre', value: nombre, inline: true },
        { name: 'Precio', value: formatear(precio), inline: true },
        { name: 'Stock', value: stock < 0 ? 'Ilimitado' : String(stock), inline: true },
        { name: 'Registrado por', value: actorTexto(interaction.user), inline: false },
      ],
      footer: 'Economato',
    })],
    flags: MessageFlags.Ephemeral,
  });
}

async function onImpuestoBtn(interaction) {
  if (!esFundador(interaction.member)) {
    await interaction.reply({
      content: 'Solo el Fundador ajusta el recargo institucional.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.showModal(modalImpuesto());
}

async function onModalImpuesto(interaction) {
  if (!esFundador(interaction.member)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  const pct = Number(interaction.fields.getTextInputValue('pct'));
  if (Number.isNaN(pct) || pct < 0 || pct > 50) {
    await interaction.reply({ content: 'Porcentaje invalido (0-50).', flags: MessageFlags.Ephemeral });
    return;
  }
  setImpuestoPct(pct, actorTexto(interaction.user));
  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Recargo institucional actualizado',
      descripcion: `Nuevo porcentaje aplicado sobre multas disciplinarias: **${pct}%**.\n\n**Registrado por:** ${actorTexto(interaction.user)}`,
      footer: 'Finanzas',
    })],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { prefix, handle };
