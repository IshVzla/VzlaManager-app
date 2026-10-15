// Nota para la impresora térmica: se dibuja en blanco y negro, del ancho del papel (384 puntos = 58 mm; 576 = 80 mm),
// con los mismos datos del talonario. Si al despachar se ajustaron cantidades, cada línea lo indica.
import { enlaceNota } from './nota-pdf.js';

const F2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n2 = (x) => F2.format(Number(x) || 0);
const FUENTE = 'system-ui, Roboto, "Noto Sans", Arial, sans-serif';
const fechaVe = (d) => new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Caracas' }).replace(/\//g, '-');

export async function dibujarTira(n, neg = {}, { ancho = 384, etiqueta = '' } = {}) {
  const k = ancho / 384, M = Math.round(6 * k), W = ancho - 2 * M;
  const c = document.createElement('canvas');
  c.width = ancho; c.height = 6000;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ancho, c.height);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
  let y = 0;
  const f = (t, peso = 400) => { ctx.font = `${peso} ${Math.round(t * k)}px ${FUENTE}`; };
  const lineasDe = (texto, max) => {
    const out = []; let act = '';
    for (const p of String(texto || '').split(/\s+/)) {
      const prueba = act ? act + ' ' + p : p;
      if (ctx.measureText(prueba).width <= max || !act) act = prueba; else { out.push(act); act = p; }
    }
    if (act) out.push(act);
    return out;
  };
  const texto = (t, { tam = 20, peso = 400, align = 'left', x = null, max = W, alto = 1.25 } = {}) => {
    f(tam, peso); ctx.textAlign = align;
    const xx = x ?? (align === 'center' ? ancho / 2 : align === 'right' ? ancho - M : M);
    for (const l of lineasDe(t, max)) { y += Math.round(tam * k * alto); ctx.fillText(l, xx, y); }
  };
  const par = (izq, der, { tam = 20, peso = 400 } = {}) => {
    f(tam, peso); const wd = ctx.measureText(der).width;
    const ls = lineasDe(izq, W - wd - 10 * k);
    ls.forEach((l, i) => { y += Math.round(tam * k * 1.25); ctx.textAlign = 'left'; ctx.fillText(l, M, y); if (i === 0) { ctx.textAlign = 'right'; ctx.fillText(der, ancho - M, y); } });
  };
  const raya = (grueso = 2, gap = 8) => { y += Math.round(gap * k); ctx.fillRect(M, y, W, Math.max(1, Math.round(grueso * k))); y += Math.round(2 * k); };
  const sim = neg.moneda === 'VES' ? 'Bs' : '$';

  // Encabezado del negocio
  y += Math.round(4 * k);
  texto(neg.razon_social || neg.nombre || '', { tam: 26, peso: 800, align: 'center' });
  if (neg.rif) texto(`RIF ${neg.rif}`, { tam: 19, peso: 700, align: 'center' });
  if (neg.domicilio_fiscal) texto(neg.domicilio_fiscal, { tam: 17, align: 'center' });
  if (neg.telefonos) texto(`Telf: ${neg.telefonos}`, { tam: 17, align: 'center' });
  if (neg.distribuidor) texto(neg.distribuidor, { tam: 17, peso: 700, align: 'center' });
  raya();
  const cot = n.tipo === 'cotizacion';
  texto(cot ? 'COTIZACIÓN' : `NOTA N° ${String(n.numero ?? '').padStart(6, '0')}`, { tam: 30, peso: 800, align: 'center' });
  if (cot && n.valida_hasta) texto(`Válida hasta el ${fechaVe(n.valida_hasta + 'T12:00:00')}`, { tam: 20, peso: 800, align: 'center' });
  texto(`${n.ciudad || neg.ciudad || ''}${n.ciudad || neg.ciudad ? ' · ' : ''}${fechaVe(n.fecha)}`, { tam: 19, align: 'center' });
  if (etiqueta) texto(etiqueta, { tam: 18, peso: 800, align: 'center' });
  if (n.estado === 'anulado') texto('*** NOTA ANULADA ***', { tam: 24, peso: 800, align: 'center' });
  raya();

  // Cliente
  const cl = n.cliente || {};
  texto(`Cliente: ${cl.razon_social || cl.nombre || ''}`, { tam: 20, peso: 700 });
  if (cl.rif) texto(`RIF: ${cl.rif}`, { tam: 19 });
  if (cl.domicilio_fiscal) texto(`Dirección: ${cl.domicilio_fiscal}`, { tam: 19 });
  if (n.condiciones_pago) texto(`Forma de pago: ${n.condiciones_pago}`, { tam: 19 });
  raya();

  // Productos
  par('CANT. DESCRIPCIÓN', 'TOTAL', { tam: 17, peso: 800 });
  for (const i of n.items || []) {
    const cambio = n.modificado_en_entrega && i.cantidad_pedida !== i.cantidad;
    if (!i.cantidad && !cambio) continue;
    y += Math.round(4 * k);
    par(`${i.cantidad} × ${i.nombre}`, n2(i.subtotal ?? i.cantidad * i.precio), { tam: 20, peso: i.cantidad ? 600 : 400 });
    texto(`${i.presentacion ? i.presentacion + ' · ' : ''}${n2(i.precio)} c/u`, { tam: 17 });
    if (cambio) texto(i.cantidad_pedida ? `Pedido: ${i.cantidad_pedida} · entregado: ${i.cantidad}` : 'Agregado al entregar', { tam: 17, peso: 700 });
  }
  raya();
  par(`Subtotal ${sim}`, n2(n.subtotal), { tam: 20 });
  if (Number(n.iva_pct)) par(`IVA ${n2(n.iva_pct).replace(',00', '')} %`, n2(n.iva), { tam: 20 });
  par(`TOTAL ${sim}`, n2(n.total), { tam: 28, peso: 800 });
  if (n.modificado_en_entrega && n.total_pedido != null) texto(`Modificada al entregar (total del pedido: ${sim} ${n2(n.total_pedido)})`, { tam: 17, peso: 700 });
  if (cot) { if (n.notas) texto(`Notas: ${n.notas}`, { tam: 17 }); }
  else if (n.pagado_en) {
    texto(`Pagada el ${fechaVe(n.pagado_en)} · ${n.forma_pago || ''}`, { tam: 18, peso: 700 });
    if (n.tasa_bcv) texto(`Tasa ${n2(n.tasa_bcv)} · Bs ${n2(n.monto_bs)}`, { tam: 18 });
  } else if (n.estado !== 'anulado') texto('Por cobrar', { tam: 18, peso: 700 });

  // Firma (la cotización no se firma)
  if (!cot) {
    y += Math.round(54 * k);
    ctx.fillRect(M + Math.round(20 * k), y, W - Math.round(40 * k), Math.max(1, Math.round(2 * k)));
    texto('Recibí conforme (firma y cédula)', { tam: 17, align: 'center' });
  } else y += Math.round(12 * k);

  // QR a la copia digital y leyenda
  if (!cot && n.id && /^[0-9a-f-]{36}$/i.test(n.id) && window.qrcode) {
    const qr = window.qrcode(0, 'M'); qr.addData(enlaceNota(n.id), 'Byte'); qr.make();
    const m = qr.getModuleCount(), lado = Math.round(150 * k), cel = Math.floor(lado / m), x0 = Math.round((ancho - cel * m) / 2);
    y += Math.round(16 * k);
    for (let r = 0; r < m; r++) for (let col = 0; col < m; col++) if (qr.isDark(r, col)) ctx.fillRect(x0 + col * cel, y + r * cel, cel, cel);
    y += cel * m;
    texto('Escanea para ver o descargar la nota', { tam: 16, align: 'center' });
  }
  for (const l of neg.datos_pago || []) if (l) texto(l, { tam: 16, align: 'center' });
  texto(cot ? 'Esta cotización no es una nota de venta. Precios sujetos a cambio después de la fecha de validez.' : neg.leyenda || 'Documento sin valor fiscal.', { tam: 15, align: 'center' });
  y += Math.round(10 * k);

  // Recorta al alto usado (múltiplo de 8 no hace falta: el ancho ya lo es)
  const out = document.createElement('canvas');
  out.width = ancho; out.height = y;
  out.getContext('2d').drawImage(c, 0, 0);
  return out;
}
