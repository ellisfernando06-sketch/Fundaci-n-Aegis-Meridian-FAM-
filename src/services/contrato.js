/**
 * Genera Contrato de Ingreso F.A.M. en formato .docx editable.
 * Contenido alineado al documento oficial (politicas, servicio, silencio, sanciones).
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} = require('docx');

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '1A1A2E' };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDES_FINOS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const SIN_BORDES = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function celda(texto, opts = {}) {
  const {
    bold = false,
    width = 2340,
    fill = null,
    align = AlignmentType.LEFT,
    size = 18,
    color = '1A1A2E',
    borders = BORDES_FINOS,
  } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(texto || ''),
            bold,
            size,
            font: 'Times New Roman',
            color,
          }),
        ],
      }),
    ],
  });
}

function tituloSeccion(romano, titulo) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [900, 8460],
    rows: [
      new TableRow({
        children: [
          celda(romano, { bold: true, width: 900, fill: '1A1A2E', color: 'C9A227', align: AlignmentType.CENTER, size: 20 }),
          celda(titulo, { bold: true, width: 8460, fill: 'F5F0E6', size: 20 }),
        ],
      }),
    ],
  });
}

function parrafo(texto, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, before: 60 },
    children: [
      new TextRun({
        text: texto,
        size: opts.size || 18,
        font: 'Times New Roman',
        bold: !!opts.bold,
        color: opts.color || '1A1A2E',
      }),
    ],
  });
}

function linea() {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9A227', space: 1 },
    },
    spacing: { after: 200 },
    children: [],
  });
}

/**
 * @param {object} datos
 * @param {string} datos.miembro - nombre del personaje / miembro
 * @param {string} datos.discord - tag o mencion legible
 * @param {string} datos.rango - rango / direccion
 * @param {string} datos.fecha - fecha de ingreso
 * @param {string} [datos.fundador] - nombre del firmante fundacion
 */
async function generarContrato(datos) {
  const miembro = datos.miembro || '________________';
  const discord = datos.discord || '________________';
  const rango = datos.rango || '________________';
  const fecha = datos.fecha || new Date().toLocaleDateString('es-PA');
  const fundador = datos.fundador || 'Ing. F. Ellis';

  const doc = new Document({
    styles: {
      default: {
        document: {
          styles: [
            {
              id: 'Normal',
              name: 'Normal',
              run: { font: 'Times New Roman', size: 18 },
            },
          ],
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'FUNDACIÓN AEGIS MERIDIAN',
                    bold: true,
                    size: 28,
                    font: 'Times New Roman',
                    color: '1A1A2E',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: 'ESCUDO DE VERDAD  ·  PRIVADA E INDEPENDIENTE  ·  EST. 1991',
                    size: 14,
                    font: 'Times New Roman',
                    color: '6B6B6B',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'FUNDACIÓN AEGIS MERIDIAN  ·  PRIVADA E INDEPENDIENTE  ·  EST. 1991  ·  DOCUMENTO DE USO INTERNO  ·  ',
                    size: 12,
                    font: 'Times New Roman',
                    color: '6B6B6B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 12,
                    font: 'Times New Roman',
                    color: '6B6B6B',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'CONTRATO DE INGRESO Y SERVICIO',
                bold: true,
                size: 32,
                font: 'Times New Roman',
                color: '1A1A2E',
              }),
            ],
          }),
          linea(),
          parrafo(
            'La Fundación Aegis Meridian (F.A.M.), representada por su Fundador, y el Miembro identificado abajo acuerdan las siguientes condiciones de ingreso.'
          ),

          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2340, 2340, 2340, 2340],
            rows: [
              new TableRow({
                children: [
                  celda('MIEMBRO', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 2340 }),
                  celda(miembro, { width: 2340 }),
                  celda('USUARIO DE DISCORD', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 2340 }),
                  celda(discord, { width: 2340 }),
                ],
              }),
              new TableRow({
                children: [
                  celda('RANGO / DIRECCIÓN', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 2340 }),
                  celda(rango, { width: 2340 }),
                  celda('FECHA DE INGRESO', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 2340 }),
                  celda(fecha, { width: 2340 }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 240 }, children: [] }),
          tituloSeccion('I', 'POLÍTICAS DE LA FUNDACIÓN'),
          parrafo('1. Respeto. No se permite el acoso, la discriminación ni las amenazas, dentro o fuera del rol.'),
          parrafo('2. Cadena de mando. Obedece a tu superior directo según el organigrama oficial.'),
          parrafo('3. Rol y realidad. Lo que ocurre en el rol se queda en el rol.'),
          parrafo('4. Una sola cuenta. Las cuentas alternas se sancionan con expulsión.'),
          parrafo('5. Uso de rangos. Los rangos y permisos se usan solo para su función. Abusar de ellos es falta grave.'),

          new Paragraph({ spacing: { before: 200 }, children: [] }),
          tituloSeccion('II', 'CONDICIONES DE SERVICIO'),
          parrafo('1. Periodo de prueba. 14 días desde el ingreso.'),
          parrafo('2. Actividad mínima. 3 sesiones cada 14 días. Si vas a faltar, avisa con anticipación.'),
          parrafo('3. Capacitación. Completa la inducción de tu dirección antes de operar sin supervisión.'),
          parrafo('4. Ascensos y descensos. Los ascensos dependen del desempeño y la actividad. Los descensos, de una falta comprobada o de inactividad.'),
          parrafo('5. Renuncia. Puedes renunciar avisando a tu superior. El reglamento de silencio sigue vigente.'),

          new Paragraph({ spacing: { before: 200 }, children: [] }),
          tituloSeccion('III', 'REGLAMENTO DE SILENCIO (CONFIDENCIALIDAD)'),
          parrafo('1. Qué es confidencial. Todo lo que sepas por tu rol: expedientes, operativos, interrogatorios, investigaciones, finanzas y decisiones de mando.'),
          parrafo('2. Prohibido revelar. No compartas información interna con quien no tenga autorización, dentro ni fuera del servidor.'),
          parrafo('3. Sin capturas. No saques capturas, grabaciones ni copias de canales restringidos.'),
          parrafo('4. Deber de reportar. Si conoces una filtración, avisa de inmediato a Seguridad Interna.'),
          parrafo('5. Duración. El silencio dura mientras estés en la Fundación y 12 meses después de salir.'),

          new Paragraph({ spacing: { before: 200 }, children: [] }),
          tituloSeccion('IV', 'SANCIONES POR ROMPER EL SILENCIO'),

          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
              new TableRow({
                children: [
                  celda('FALTA', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 4680, align: AlignmentType.CENTER }),
                  celda('SANCIÓN', { bold: true, fill: '1A1A2E', color: 'C9A227', width: 4680, align: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  celda('Comentar información interna sin autorización', { width: 4680, size: 16 }),
                  celda('Amonestación escrita y suspensión de 3 días', { width: 4680, size: 16 }),
                ],
              }),
              new TableRow({
                children: [
                  celda('Compartir capturas o contenido de canales restringidos', { width: 4680, size: 16 }),
                  celda('Suspensión de 7 a 15 días y descenso de rango', { width: 4680, size: 16 }),
                ],
              }),
              new TableRow({
                children: [
                  celda('Filtrar información a externos o a otro servidor', { width: 4680, size: 16 }),
                  celda('Expulsión', { width: 4680, size: 16 }),
                ],
              }),
              new TableRow({
                children: [
                  celda('Filtración intencional o reincidente', { width: 4680, size: 16 }),
                  celda('Veto permanente', { width: 4680, size: 16 }),
                ],
              }),
              new TableRow({
                children: [
                  celda('No reportar una filtración que conocías', { width: 4680, size: 16 }),
                  celda('Amonestación escrita', { width: 4680, size: 16 }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 160 }, children: [] }),
          parrafo(
            'La reincidencia sube un escalón de sanción. Toda sanción pasa por una investigación de Seguridad Interna; el acusado puede defenderse y apelar ante el Cofundador de Calidad y Cumplimiento en 7 días. Las expulsiones y vetos los aprueba la Fundación.'
          ),
          parrafo(
            'Con mi firma acepto cumplir este contrato y el reglamento de silencio de la Fundación.',
            { bold: true }
          ),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4680, type: WidthType.DXA },
                    borders: SIN_BORDES,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_______________________________', size: 18, font: 'Times New Roman' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: fundador, bold: true, size: 18, font: 'Times New Roman' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Fundador de F.A.M.', size: 16, font: 'Times New Roman', color: '6B6B6B' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4680, type: WidthType.DXA },
                    borders: SIN_BORDES,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_______________________________', size: 18, font: 'Times New Roman' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Firma del Miembro', bold: true, size: 18, font: 'Times New Roman' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `[${miembro} · ${rango}]`,
                            size: 16,
                            font: 'Times New Roman',
                            color: '6B6B6B',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

module.exports = { generarContrato };
