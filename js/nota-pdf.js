// Nota en PDF con los campos del talonario del negocio (Cliente, RIF, Dirección, Forma de pago…).
// Es el mismo archivo que se guarda, se envía por WhatsApp y se imprime en la impresora normal.
// Formatos:
//   'media' – una nota por hoja media carta (para ver y enviar).
//   'doble' – hoja carta vertical con ORIGINAL (cliente) arriba y COPIA (negocio) abajo, para imprimir y cortar con un
//             solo corte horizontal. Si la nota no cabe en media hoja, sale en dos hojas media carta.
// Si al despachar se ajustaron cantidades, cada línea indica lo pedido y lo entregado.
// Se usa en la app y en la copia pública (n.html), por eso no depende de la sesión ni de la base de datos.
//
// n = { id, numero, fecha, ciudad, estado, entrega_programada, condiciones_pago, notas, modificado_en_entrega, total_pedido,
//       cliente: { nombre, razon_social, rif, domicilio_fiscal },
//       items: [{ nombre, presentacion, cantidad, cantidad_pedida, precio, subtotal }], subtotal, iva_pct, iva, total,
//       entregado_en, pagado_en, forma_pago, tasa_bcv, monto_bs, referencia_pago, reemplazada_por }
import { WEB_URL } from '../config.js';

const VERDE = [23, 122, 43], OSCURO = [21, 57, 14], ROJO = [184, 0, 22], TEXTO = [24, 35, 26], SUAVE = [85, 96, 90];
const BORDE = [190, 204, 192], FONDO = [244, 247, 243], AMARILLO = [235, 191, 16], AMBAR = [138, 83, 0];
const MEDIA = { w: 139.7, h: 215.9 };   // media carta vertical
const FRANJA = { w: 215.9, h: 139.7 };  // media carta horizontal (mitad de una hoja carta vertical)
const M = 8;
const F2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n2 = (x) => F2.format(Number(x) || 0);
const dia = (f) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(f))
  .reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
const fechaCorta = (d) => { if (!d) return ''; const x = String(d).length === 10 ? { day: d.slice(8, 10), month: d.slice(5, 7), year: d.slice(0, 4) } : dia(d); return `${x.day}-${x.month}-${x.year}`; };
export const nombreArchivo = (n) => `Nota-${String(n.numero ?? 'sin-numero').padStart(6, '0')}.pdf`;
export const enlaceNota = (id) => `${WEB_URL}n.html#${id}`;
const lineasVisibles = (n) => (n.items || []).filter((i) => i.cantidad > 0 || (n.modificado_en_entrega && i.cantidad_pedida > 0));

/** Devuelve el PDF en base64. */
export function notaPdf(n, negocio = {}, { formato = 'media' } = {}) {
  const { jsPDF } = window.jspdf;
  // Hoja doble: original arriba y copia abajo (un solo corte). Primero se prueba si la nota cabe en media hoja.
  if (formato === 'doble' && cabeEnFranja(n, negocio)) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
    dibujarFranja(doc, n, negocio, { oy: 0, etiqueta: 'ORIGINAL · CLIENTE' });
    dibujarFranja(doc, n, negocio, { oy: FRANJA.h, etiqueta: 'COPIA · NEGOCIO' });
    doc.setDrawColor(...SUAVE); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 2], 0);
    doc.line(4, FRANJA.h, FRANJA.w - 4, FRANJA.h); doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...SUAVE);
    doc.setFillColor(255, 255, 255); doc.rect(FRANJA.w / 2 - 9, FRANJA.h - 1.6, 18, 3.2, 'F');
    doc.text('cortar aquí', FRANJA.w / 2, FRANJA.h + 0.9, { align: 'center' });
    return doc.output('datauristring').split(',')[1];
  }
  const doc = new jsPDF({ unit: 'mm', format: [MEDIA.w, MEDIA.h] });
  dibujar(doc, n, negocio, { ox: 0, etiqueta: formato === 'doble' ? 'ORIGINAL · CLIENTE' : '' });
  if (formato === 'doble') { doc.addPage([MEDIA.w, MEDIA.h]); dibujar(doc, n, negocio, { ox: 0, etiqueta: 'COPIA · NEGOCIO' }); }
  return doc.output('datauristring').split(',')[1];
}

// Dibuja una nota completa en la franja [ox, ox + media carta]. Puede seguir en otra hoja si es larga (salvo unaHoja).
function dibujar(doc, n, negocio, { ox = 0, etiqueta = '', unaHoja = false }) {
  const W = MEDIA.w, H = MEDIA.h, ancho = W - 2 * M, L = ox + M, R = ox + W - M;
  const pag0 = doc.getNumberOfPages();
  const sim = negocio.moneda === 'VES' ? 'Bs' : '$';
  const font = (t, estilo = 'normal', color = TEXTO) => { doc.setFont('helvetica', estilo); doc.setFontSize(t); doc.setTextColor(...color); };
  const caja = (x, y, w, h, relleno = null) => { doc.setDrawColor(...BORDE); doc.setLineWidth(0.25); if (relleno) doc.setFillColor(...relleno); doc.roundedRect(x, y, w, h, 1.2, 1.2, relleno ? 'FD' : 'S'); };
  const recortar = (t, w) => doc.splitTextToSize(String(t || ''), w)[0] || '';

  // ---------- Encabezado del negocio ----------
  doc.setFillColor(...VERDE); doc.rect(ox, 0, W, 3, 'F');
  doc.setFillColor(...AMARILLO); doc.rect(ox, 3, 26, 0.9, 'F');
  let y = 11;
  const izqW = negocio.distribuidor ? ancho - 36 : ancho;
  font(13, 'bold', OSCURO);
  const titulo = doc.splitTextToSize(negocio.razon_social || negocio.nombre || 'Nombre del negocio', izqW).slice(0, 2);
  doc.text(titulo, L, y); y += titulo.length * 5;
  font(8, 'bold', TEXTO);
  if (negocio.rif) { doc.text(`RIF: ${negocio.rif}`, L, y); y += 3.8; }
  font(7, 'normal', SUAVE);
  const lineasNeg = [negocio.domicilio_fiscal, negocio.domicilio_social, negocio.telefonos && `Telf: ${negocio.telefonos}`]
    .filter(Boolean).flatMap((l) => doc.splitTextToSize(l, izqW).slice(0, 2));
  doc.text(lineasNeg, L, y); y += lineasNeg.length * 3.2;
  if (negocio.distribuidor) {
    caja(R - 33, 8, 33, 11, FONDO);
    font(6.5, 'bold', VERDE);
    doc.text(doc.splitTextToSize(negocio.distribuidor.toUpperCase(), 30).slice(0, 3), R - 16.5, 12, { align: 'center' });
  }
  y = Math.max(y + 1, 24);

  // ---------- Ciudad, fecha y número ----------
  const f = dia(n.fecha);
  let x = L;
  for (const [et, val, w] of [['CIUDAD', n.ciudad || negocio.ciudad || '', 30], ['DÍA', f.day, 11], ['MES', f.month, 11], ['AÑO', f.year, 14]]) {
    caja(x, y, w, 10);
    font(5.5, 'bold', SUAVE); doc.text(et, x + 1.5, y + 3);
    font(8.5, 'normal', TEXTO); doc.text(recortar(val, w - 2.5), x + 1.5, y + 8);
    x += w;
  }
  font(10, 'bold', OSCURO); doc.text('NOTA', x + 5, y + 7);
  font(13, 'bold', ROJO); doc.text(`N° ${String(n.numero ?? '').padStart(6, '0')}`, R, y + 7.4, { align: 'right' });
  if (etiqueta) { font(6, 'bold', VERDE); doc.text(etiqueta, R, y + 11.6, { align: 'right' }); }
  y += 14;

  // ---------- Cliente (como el talonario: Cliente | RIF / Dirección | Forma de pago) ----------
  const c = n.cliente || {};
  caja(L, y, ancho, 14);
  const campo = (et, val, x0, x1, yy, negrita = false) => {
    font(6, 'bold', SUAVE); doc.text(et, x0 + 1.5, yy);
    const xv = x0 + 1.5 + doc.getTextWidth(et) + 1.5;
    font(8.5, negrita ? 'bold' : 'normal', TEXTO); doc.text(recortar(val, x1 - xv - 1.5), xv, yy);
  };
  const xm = L + ancho * 0.66;
  doc.setDrawColor(...BORDE); doc.line(xm, y, xm, y + 14); doc.line(L, y + 7, R, y + 7);
  campo('CLIENTE:', c.razon_social || c.nombre, L, xm, y + 4.8, true);
  campo('RIF:', c.rif, xm, R, y + 4.8);
  campo('DIRECCIÓN:', c.domicilio_fiscal, L, xm, y + 11.8);
  campo('FORMA DE PAGO:', n.condiciones_pago || negocio.condiciones_pago, xm, R, y + 11.8);
  y += 17;

  // ---------- Detalle ----------
  const lineas = lineasVisibles(n);
  doc.autoTable({
    startY: y,
    margin: { left: L, right: doc.internal.pageSize.getWidth() - R, top: 12, bottom: unaHoja ? 4 : 14 },
    head: [['CANT.', 'DESCRIPCIÓN', 'UNITARIO', 'VALOR TOTAL']],
    body: lineas.map((i) => {
      const cambio = n.modificado_en_entrega && i.cantidad !== i.cantidad_pedida;
      const desc = [i.nombre, i.presentacion].filter(Boolean).join(' · ')
        + (cambio ? (i.cantidad_pedida ? `\n(pedido: ${i.cantidad_pedida}${i.cantidad ? '' : ' · no se entregó'})` : '\n(agregado al entregar)') : '');
      return [String(i.cantidad), desc, n2(i.precio), n2(i.subtotal ?? i.cantidad * i.precio)];
    }),
    theme: 'grid', rowPageBreak: 'avoid', showHead: 'everyPage', pageBreak: unaHoja ? 'avoid' : 'auto',
    styles: { font: 'helvetica', fontSize: 8, textColor: TEXTO, cellPadding: { top: 1.25, bottom: 1.25, left: 1.6, right: 1.6 }, lineColor: BORDE, lineWidth: 0.2 },
    headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    columnStyles: { 0: { halign: 'center', cellWidth: 13 }, 2: { halign: 'right', cellWidth: 22 }, 3: { halign: 'right', cellWidth: 24 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const i = lineas[d.row.index];
      if (n.modificado_en_entrega && i.cantidad !== i.cantidad_pedida) { d.cell.styles.textColor = AMBAR; if (d.column.index === 0) d.cell.styles.fontStyle = 'bold'; }
    },
  });
  y = doc.lastAutoTable.finalY;
  if (!unaHoja && y > H - 56) { doc.addPage([MEDIA.w, MEDIA.h]); y = 14; }

  // ---------- Totales y aprobado por ----------
  const xt = R - 50;
  [[`SUB-TOTAL ${sim}`, n2(n.subtotal)], [`I.V.A. ${Number(n.iva_pct) ? n2(n.iva_pct).replace(',00', '') + ' %' : ''}`, Number(n.iva_pct) ? n2(n.iva) : '—'], [`TOTAL ${sim}`, n2(n.total)]]
    .forEach(([et, val], i) => {
      const yy = y + i * 6.5, total = i === 2;
      doc.setDrawColor(...BORDE); doc.setLineWidth(0.2);
      if (total) { doc.setFillColor(...VERDE); doc.rect(xt, yy, 50, 6.5, 'FD'); } else doc.rect(xt, yy, 50, 6.5);
      font(total ? 8 : 7, 'bold', total ? [255, 255, 255] : SUAVE); doc.text(et, xt + 1.6, yy + 4.4);
      font(total ? 9.5 : 8.5, total ? 'bold' : 'normal', total ? [255, 255, 255] : TEXTO); doc.text(val, R - 1.6, yy + 4.4, { align: 'right' });
    });
  doc.setDrawColor(...SUAVE); doc.line(L + 2, y + 16, xt - 8, y + 16);
  font(6.5, 'bold', SUAVE); doc.text('APROBADO POR', L + 2, y + 19.5);
  y += 24;

  // ---------- Estado de la entrega y el pago ----------
  const estado = lineasEstado(n, sim);
  const ok = n.pagado_en;
  if (estado.length && n.estado !== 'anulado') {
    const ls = estado.flatMap((l) => doc.splitTextToSize(l, ancho - 4));
    if (!unaHoja && y + ls.length * 3.4 + 4 > H - 30) { doc.addPage([MEDIA.w, MEDIA.h]); y = 14; }
    caja(L, y, ancho, ls.length * 3.4 + 3.2, ok ? [230, 242, 231] : [252, 244, 210]);
    font(7.2, 'bold', ok ? [27, 94, 32] : AMBAR); doc.text(ls, L + 2, y + 4.1);
    y += ls.length * 3.4 + 6;
  }

  // ---------- Pie: QR a la copia digital, datos de pago y leyenda ----------
  const qrTam = 18;
  if (!unaHoja && y > H - qrTam - 10) doc.addPage([MEDIA.w, MEDIA.h]);
  const yq = H - qrTam - 7;
  const conQr = n.id && /^[0-9a-f-]{36}$/i.test(n.id);
  if (conQr) dibujarQr(doc, enlaceNota(n.id), L, yq, qrTam);
  const xq = conQr ? L + qrTam + 3 : L;
  const pie = [];
  if (conQr) pie.push(['bold', 'Escanea el código para ver o descargar esta nota.']);
  for (const l of negocio.datos_pago || []) if (l) pie.push(['normal', l]);
  pie.push(['italic', negocio.leyenda || 'Este documento no tiene valor fiscal.']);
  let yl = yq + 3;
  for (const [estilo, t] of pie) {
    font(6.5, estilo, estilo === 'bold' ? VERDE : SUAVE);
    const ls = doc.splitTextToSize(t, R - xq);
    doc.text(ls, xq, yl); yl += ls.length * 2.9 + 0.6;
  }

  // ---------- Nota anulada: marca de agua; varias hojas: numeración ----------
  const pags = doc.getNumberOfPages();
  for (let i = pag0; i <= pags; i++) {
    doc.setPage(i);
    if (n.estado === 'anulado') {
      font(40, 'bold', ROJO); doc.text('ANULADA', ox + W / 2, H / 2, { align: 'center', angle: 25 });
      if (n.reemplazada_por) { font(10, 'bold', ROJO); doc.text(`Reemplazada por la nota N° ${String(n.reemplazada_por).padStart(6, '0')}`, ox + W / 2, H / 2 + 14, { align: 'center' }); }
    }
    if (pags > pag0) { font(6.5, 'normal', SUAVE); doc.text(`Página ${i - pag0 + 1} de ${pags - pag0 + 1}`, R, H - 3, { align: 'right' }); }
  }
}

// Textos del recuadro de estado (modificada, entrega, pago, notas)
function lineasEstado(n, sim) {
  const estado = [];
  if (n.modificado_en_entrega) estado.push(`Modificada al entregar: lo entregado no es igual a lo pedido${n.total_pedido != null ? ` (total del pedido: ${sim} ${n2(n.total_pedido)})` : ''}.`);
  if (n.estado === 'entregado') estado.push(`Entregada el ${fechaCorta(n.entregado_en)}.`);
  else if (n.estado === 'pendiente') estado.push(n.entrega_programada ? `Por entregar · entrega programada para el ${fechaCorta(n.entrega_programada)}.` : 'Por entregar.');
  if (n.pagado_en) {
    estado.push(`Pagada el ${fechaCorta(n.pagado_en)} con ${n.forma_pago || '—'}${n.tasa_bcv ? ` · tasa BCV ${n2(n.tasa_bcv)} · Bs ${n2(n.monto_bs)}` : ''}${n.referencia_pago ? ` · ref. ${n.referencia_pago}` : ''}.`);
  } else if (n.estado === 'entregado') estado.push('Por cobrar.');
  if (n.notas) estado.push(`Notas: ${n.notas}`);
  return estado;
}

// ¿La nota cabe en media hoja horizontal? Se dibuja de prueba en un documento aparte.
function cabeEnFranja(n, negocio) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  return dibujarFranja(doc, n, negocio, { oy: 0, etiqueta: 'ORIGINAL · CLIENTE', prueba: true });
}

// Nota en media hoja horizontal (franja [oy, oy + 139,7 mm] de una hoja carta vertical). Devuelve false si no cupo.
function dibujarFranja(doc, n, negocio, { oy = 0, etiqueta = '', prueba = false }) {
  const W = FRANJA.w, H = FRANJA.h, MF = 8, ancho = W - 2 * MF, L = MF, R = W - MF;
  const sim = negocio.moneda === 'VES' ? 'Bs' : '$';
  const font = (t, estilo = 'normal', color = TEXTO) => { doc.setFont('helvetica', estilo); doc.setFontSize(t); doc.setTextColor(...color); };
  const caja = (x, y, w, h, relleno = null) => { doc.setDrawColor(...BORDE); doc.setLineWidth(0.25); if (relleno) doc.setFillColor(...relleno); doc.roundedRect(x, y, w, h, 1.2, 1.2, relleno ? 'FD' : 'S'); };
  const recortar = (t, w) => doc.splitTextToSize(String(t || ''), w)[0] || '';
  const PIE = 33;                                  // alto de la zona de totales, firma y pie

  // ---------- Encabezado: negocio a la izquierda; N°, ciudad y fecha a la derecha ----------
  doc.setFillColor(...VERDE); doc.rect(0, oy, W, 2.5, 'F');
  doc.setFillColor(...AMARILLO); doc.rect(0, oy + 2.5, 30, 0.8, 'F');
  const derW = 72, izqW = ancho - derW - 6;
  let y = oy + 10;
  font(12, 'bold', OSCURO);
  const titulo = doc.splitTextToSize(negocio.razon_social || negocio.nombre || 'Nombre del negocio', izqW).slice(0, 1);
  doc.text(titulo, L, y); y += 4.4;
  font(7.5, 'bold', TEXTO);
  if (negocio.rif) { doc.text(`RIF: ${negocio.rif}${negocio.distribuidor ? `   ·   ${negocio.distribuidor}` : ''}`, L, y); y += 3.6; }
  font(6.8, 'normal', SUAVE);
  const lineasNeg = [negocio.domicilio_fiscal, negocio.domicilio_social, negocio.telefonos && `Telf: ${negocio.telefonos}`]
    .filter(Boolean).flatMap((l) => doc.splitTextToSize(l, izqW).slice(0, 1)).slice(0, 3);
  doc.text(lineasNeg, L, y);

  font(10, 'bold', OSCURO); doc.text('NOTA', R - derW, oy + 10.5);
  font(13, 'bold', ROJO); doc.text(`N° ${String(n.numero ?? '').padStart(6, '0')}`, R, oy + 10.8, { align: 'right' });
  const f = dia(n.fecha);
  let x = R - derW;
  for (const [et, val, w] of [['CIUDAD', n.ciudad || negocio.ciudad || '', 37], ['DÍA', f.day, 10], ['MES', f.month, 10], ['AÑO', f.year, 15]]) {
    caja(x, oy + 13.5, w, 9.5);
    font(5.5, 'bold', SUAVE); doc.text(et, x + 1.4, oy + 16.3);
    font(8.5, 'normal', TEXTO); doc.text(recortar(val, w - 2.5), x + 1.4, oy + 21.3);
    x += w;
  }
  if (etiqueta) { font(6, 'bold', VERDE); doc.text(etiqueta, R, oy + 26.2, { align: 'right' }); }

  // ---------- Cliente ----------
  const c = n.cliente || {};
  y = oy + 28;
  caja(L, y, ancho, 13);
  const campo = (et, val, x0, x1, yy, negrita = false) => {
    font(6, 'bold', SUAVE); doc.text(et, x0 + 1.5, yy);
    const xv = x0 + 1.5 + doc.getTextWidth(et) + 1.5;
    font(8.5, negrita ? 'bold' : 'normal', TEXTO); doc.text(recortar(val, x1 - xv - 1.5), xv, yy);
  };
  const xm = L + ancho * 0.64;
  doc.setDrawColor(...BORDE); doc.line(xm, y, xm, y + 13); doc.line(L, y + 6.5, R, y + 6.5);
  campo('CLIENTE:', c.razon_social || c.nombre, L, xm, y + 4.5, true);
  campo('RIF:', c.rif, xm, R, y + 4.5);
  campo('DIRECCIÓN:', c.domicilio_fiscal, L, xm, y + 11);
  campo('FORMA DE PAGO:', n.condiciones_pago || negocio.condiciones_pago, xm, R, y + 11);
  y += 15;

  // ---------- Detalle ----------
  const lineas = lineasVisibles(n);
  const limite = oy + H - PIE - 2;
  const pagIni = doc.getNumberOfPages();
  doc.autoTable({
    startY: y,
    margin: { left: L, right: MF, top: 6, bottom: doc.internal.pageSize.getHeight() - limite },
    head: [['CANT.', 'DESCRIPCIÓN', 'UNITARIO', 'VALOR TOTAL']],
    body: lineas.map((i) => {
      const cambio = n.modificado_en_entrega && i.cantidad !== i.cantidad_pedida;
      const desc = [i.nombre, i.presentacion].filter(Boolean).join(' · ')
        + (cambio ? (i.cantidad_pedida ? `  (pedido: ${i.cantidad_pedida}${i.cantidad ? '' : ' · no se entregó'})` : '  (agregado al entregar)') : '');
      return [String(i.cantidad), desc, n2(i.precio), n2(i.subtotal ?? i.cantidad * i.precio)];
    }),
    theme: 'grid', rowPageBreak: 'avoid', pageBreak: 'auto', showHead: 'firstPage',
    styles: { font: 'helvetica', fontSize: 8, textColor: TEXTO, cellPadding: { top: 0.75, bottom: 0.75, left: 1.6, right: 1.6 }, lineColor: BORDE, lineWidth: 0.2 },
    headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 28 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const i = lineas[d.row.index];
      if (n.modificado_en_entrega && i.cantidad !== i.cantidad_pedida) { d.cell.styles.textColor = AMBAR; if (d.column.index === 0) d.cell.styles.fontStyle = 'bold'; }
    },
  });
  if (doc.getNumberOfPages() > pagIni || doc.lastAutoTable.finalY > limite + 0.5) return false;
  if (prueba) return true;

  // ---------- Pie: estado y totales; QR, datos de pago y aprobado por ----------
  const y0 = oy + H - PIE, xt = R - 52;
  [[`SUB-TOTAL ${sim}`, n2(n.subtotal)], [`I.V.A. ${Number(n.iva_pct) ? n2(n.iva_pct).replace(',00', '') + ' %' : ''}`, Number(n.iva_pct) ? n2(n.iva) : '—'], [`TOTAL ${sim}`, n2(n.total)]]
    .forEach(([et, val], i) => {
      const yy = y0 + i * 6, total = i === 2;
      doc.setDrawColor(...BORDE); doc.setLineWidth(0.2);
      if (total) { doc.setFillColor(...VERDE); doc.rect(xt, yy, 52, 6, 'FD'); } else doc.rect(xt, yy, 52, 6);
      font(total ? 8 : 7, 'bold', total ? [255, 255, 255] : SUAVE); doc.text(et, xt + 1.6, yy + 4.1);
      font(total ? 9.5 : 8.5, total ? 'bold' : 'normal', total ? [255, 255, 255] : TEXTO); doc.text(val, R - 1.6, yy + 4.1, { align: 'right' });
    });
  const estado = n.estado === 'anulado' ? [] : lineasEstado(n, sim);
  if (estado.length) {
    const wE = xt - L - 6;
    font(7, 'bold');
    const ls = estado.flatMap((l) => doc.splitTextToSize(l, wE - 4)).slice(0, 4);
    const ok = n.pagado_en;
    caja(L, y0, wE, ls.length * 3.2 + 2.6, ok ? [230, 242, 231] : [252, 244, 210]);
    font(7, 'bold', ok ? [27, 94, 32] : AMBAR); doc.text(ls, L + 2, y0 + 3.8);
  }
  const yb = y0 + 20, qrTam = 13;
  const conQr = n.id && /^[0-9a-f-]{36}$/i.test(n.id);
  if (conQr) dibujarQr(doc, enlaceNota(n.id), L, yb, qrTam);
  const xq = conQr ? L + qrTam + 3 : L, wq = xt - 8 - xq;
  const pie = [];
  if (conQr) pie.push(['bold', 'Escanea el código para ver o descargar esta nota.']);
  for (const l of negocio.datos_pago || []) if (l) pie.push(['normal', l]);
  pie.push(['italic', negocio.leyenda || 'Este documento no tiene valor fiscal.']);
  let yl = yb + 2.6;
  for (const [estilo, t] of pie) {
    font(6.3, estilo, estilo === 'bold' ? VERDE : SUAVE);
    const ls = doc.splitTextToSize(t, wq).slice(0, 2);
    if (yl + (ls.length - 1) * 2.7 > oy + H - 2) break;
    doc.text(ls, xq, yl); yl += ls.length * 2.7 + 0.4;
  }
  doc.setDrawColor(...SUAVE); doc.setLineWidth(0.25); doc.line(xt, yb + 8.5, R, yb + 8.5);
  font(6.5, 'bold', SUAVE); doc.text('APROBADO POR', xt, yb + 11.5);
  if (n.estado === 'anulado') {
    font(36, 'bold', ROJO); doc.text('ANULADA', W / 2, oy + H / 2 + 6, { align: 'center', angle: 12 });
    if (n.reemplazada_por) { font(9, 'bold', ROJO); doc.text(`Reemplazada por la nota N° ${String(n.reemplazada_por).padStart(6, '0')}`, W / 2, oy + H / 2 + 16, { align: 'center' }); }
  }
  return true;
}

// QR vectorial (cuadros verde oscuro): se lee bien impreso o en pantalla.
function dibujarQr(doc, texto, x, y, tam) {
  const qr = window.qrcode(0, 'M');
  qr.addData(texto, 'Byte'); qr.make();
  const n = qr.getModuleCount(), k = tam / (n + 2);
  doc.setFillColor(255, 255, 255); doc.rect(x, y, tam, tam, 'F');
  doc.setFillColor(...OSCURO);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(x + (c + 1) * k, y + (r + 1) * k, k + 0.02, k + 0.02, 'F');
}
