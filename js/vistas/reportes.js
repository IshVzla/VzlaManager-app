// Reportes: por entregar (bodega), pedido al proveedor, por cobrar, cobros de un día y ventas de un período. Todos salen en PDF y por WhatsApp.
import { $, esc, barra, icono, vacio, aviso, dinero, bs, num2, r2, fecha, numeroNota, diaVe } from '../ui.js';
import * as datos from '../datos.js';
import { nuevoReporte, guardarPdf, enviarPdfWhatsApp, imprimirPdf } from '../pdf.js';
import { esEscritorio } from '../escritorio.js';
import { textoEntrega } from '../estado.js';

export function vistaReportes(v) {
  barra({ titulo: 'Reportes' });
  const tarjeta = (href, ico, t, s) => `<a class="tarjeta reporte" href="${href}"><span class="ruta-ico">${icono(ico)}</span>
    <p class="tarjeta-t">${t}</p><p class="tarjeta-s">${s}</p></a>`;
  v.innerHTML = `<div class="grilla reportes-menu">
    ${tarjeta('#/reportes/por-entregar', 'camion', 'Por entregar', 'Qué tiene que entregar bodega, por producto y por cliente')}
    ${tarjeta('#/reportes/pedido-proveedor', 'pedidos', 'Pedido al proveedor', 'Total por producto de lo vendido, menos lo que hay en bodega')}
    ${tarjeta('#/reportes/por-cobrar', 'alerta', 'Por cobrar', 'Notas sin pago registrado, agrupadas por cliente')}
    ${tarjeta('#/reportes/cobros', 'dinero', 'Cobros del día', 'Pagos registrados en un día, por forma de pago, en dólares y bolívares')}
    ${tarjeta('#/reportes/ventas', 'reportes', 'Ventas', 'Lo entregado en un período: por producto y por cliente')}
  </div>`;
}

// Botones de salida comunes: PDF, WhatsApp e imprimir (en pantalla grande).
function botonesSalida(v, armar, nombre, texto) {
  const caja = document.createElement('div');
  caja.className = 'pad reporte-acc nota-acciones';
  caja.innerHTML = `<button type="button" class="btn sec" data-s="whatsapp">${icono('whatsapp')} Enviar por WhatsApp</button>
    <button type="button" class="btn sec" data-s="pdf">${icono('descargar')} Guardar PDF</button>
    ${esEscritorio() ? `<button type="button" class="btn sec" data-s="imprimir">${icono('impresora')} Imprimir</button>` : ''}`;
  caja.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    const html = b.innerHTML; b.disabled = true; b.textContent = 'Preparando…';
    try {
      const pdf = await armar();
      if (b.dataset.s === 'whatsapp') await enviarPdfWhatsApp(pdf, nombre(), { texto: texto() });
      else if (b.dataset.s === 'pdf') aviso(`PDF guardado en ${await guardarPdf(pdf, nombre())}`);
      else imprimirPdf(pdf);
    } catch (e) { aviso(e.message || 'No se pudo preparar el PDF.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  }));
  return caja;
}

// ---------- Por entregar ----------
export async function vistaPorEntregar(v) {
  barra({ titulo: 'Por entregar', atras: '#/reportes' });
  const [peds, prods] = await Promise.all([datos.pendientesConDetalle(), datos.productos({ soloActivos: false })]);
  const porProd = new Map();
  for (const p of peds) for (const i of p.items) {
    const x = porProd.get(i.producto_id) || { id: i.producto_id, nombre: i.nombre, presentacion: i.presentacion, cantidad: 0, pedidos: 0 };
    x.cantidad += i.cantidad; x.pedidos++; porProd.set(i.producto_id, x);
  }
  const filas = [...porProd.values()].map((x) => { const pr = prods.find((p) => p.id === x.id); return { ...x, orden: pr?.orden ?? 999, stock: pr?.stock ?? 0, falta: Math.max(0, x.cantidad - Math.max(pr?.stock ?? 0, 0)) }; })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  const bultos = filas.reduce((s, x) => s + x.cantidad, 0), faltan = filas.reduce((s, x) => s + x.falta, 0);
  const total = r2(peds.reduce((s, p) => s + (p.total || 0), 0));
  const ordenados = [...peds].sort((a, b) => (a.entrega_programada || '9999').localeCompare(b.entrega_programada || '9999') || a.fecha.localeCompare(b.fecha));
  if (!peds.length) { v.innerHTML = vacio('No hay pedidos por entregar', 'Cuando tomes pedidos, aquí verás lo que tiene que entregar bodega.'); return; }
  v.innerHTML = `
    <div class="resumen">
      <div><p class="resumen-n">${peds.length}</p><p>pedidos</p></div>
      <div><p class="resumen-n">${bultos}</p><p>bultos</p></div>
      <div class="${faltan ? 'alerta' : ''}"><p class="resumen-n">${faltan}</p><p>faltan en bodega</p></div>
    </div>
    <p class="cuenta">Monto de estos pedidos: <b class="monto">${dinero(total)}</b></p>
    <h2 class="sec-t">Por producto</h2>
    <div class="lista">${filas.map((x) => `
      <div class="fila carga"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p>
        <p class="fila-s">${esc(x.presentacion || '')}${x.presentacion ? ' · ' : ''}${x.pedidos} pedido${x.pedidos === 1 ? '' : 's'} · bodega ${x.stock}</p>
        ${x.falta ? `<p class="aviso-bodega">${icono('alerta', 'ico-s')} Faltan ${x.falta} en bodega</p>` : ''}</div>
        <div class="carga-n"><span class="monto">${x.cantidad}</span><span class="carga-u">bultos</span></div></div>`).join('')}</div>
    <h2 class="sec-t">Por cliente</h2>
    <div class="lista">${ordenados.map((p) => `
      <a class="fila" href="#/notas/${p.id}"><div class="fila-txt"><p class="fila-t">${esc(p.cliente)}</p>
        <p class="fila-s">N° ${numeroNota(p.numero)} · ${p.entrega_programada ? `entrega ${esc(textoEntrega(p.entrega_programada))}` : 'sin fecha de entrega'}</p>
        <p class="fila-s">${esc(p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(' · '))}</p></div>
        <span class="monto">${dinero(p.total)}</span></a>`).join('')}</div>`;
  v.append(botonesSalida(v, async () => {
    const r = await nuevoReporte({ titulo: 'Por entregar', subtitulo: `${peds.length} pedidos · ${bultos} bultos` });
    r.resumen([{ valor: peds.length, etiqueta: 'Pedidos por entregar' }, { valor: bultos, etiqueta: 'Bultos' }, { valor: faltan, etiqueta: 'Faltan en bodega', color: faltan ? [184, 0, 22] : undefined }, { valor: dinero(total), etiqueta: 'Monto', grande: true }]);
    r.seccion('Por producto', 'Columna "Cargado" para marcar a mano al preparar la entrega.');
    r.tabla([{ titulo: 'Producto' }, { titulo: 'Presentación', ancho: 30 }, { titulo: 'Bultos', ancho: 18, alinear: 'right' }, { titulo: 'Bodega', ancho: 18, alinear: 'right' }, { titulo: 'Faltan', ancho: 18, alinear: 'right' }, { titulo: 'Cargado', ancho: 20, alinear: 'center' }],
      filas.map((x) => [x.nombre, x.presentacion || '', String(x.cantidad), String(x.stock), x.falta ? String(x.falta) : '—', '']),
      { pie: ['Total', '', String(bultos), '', String(faltan || '—'), ''], colorFila: (f, col) => (col === 4 && filas[f].falta ? [184, 0, 22] : null) });
    r.seccion('Por cliente');
    r.tabla([{ titulo: 'N°', ancho: 18 }, { titulo: 'Cliente', ancho: 46 }, { titulo: 'Entrega', ancho: 22 }, { titulo: 'Productos' }, { titulo: 'Total', ancho: 24, alinear: 'right' }],
      ordenados.map((p) => [numeroNota(p.numero), p.cliente, p.entrega_programada ? fecha(p.entrega_programada) : '—', p.items.map((i) => `${i.cantidad} ${i.nombre}`).join('\n'), dinero(p.total)]));
    return r.terminar();
  }, () => `Por-entregar-${diaVe()}.pdf`, () => `Por entregar · ${peds.length} pedidos · ${bultos} bultos`));
}

// ---------- Pedido al proveedor ----------
// Total por producto de lo que hay por entregar, menos lo que ya está en bodega = lo que hay que pedir.
export async function vistaPedidoProveedor(v) {
  barra({ titulo: 'Pedido al proveedor', atras: '#/reportes' });
  const [peds, prods, provs] = await Promise.all([datos.pendientesConDetalle(), datos.productos({ soloActivos: false }), datos.proveedores().catch(() => [])]);
  const prov = provs.find((p) => p.activo !== false) || null;
  const vendido = new Map();
  for (const p of peds) for (const i of p.items) vendido.set(i.producto_id, (vendido.get(i.producto_id) || 0) + i.cantidad);
  const filas = prods.filter((p) => vendido.has(p.id)).map((p) => {
    const v2 = vendido.get(p.id), stock = Math.max(p.stock || 0, 0);
    return { id: p.id, nombre: p.nombre, presentacion: p.presentacion || '', vendido: v2, stock: p.stock || 0, pedir: Math.max(0, v2 - stock), costo: p.costo || 0, orden: p.orden ?? 999 };
  }).sort((a, b) => (b.pedir > 0) - (a.pedir > 0) || a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  const aPedir = filas.filter((x) => x.pedir > 0);
  const totPedir = aPedir.reduce((s, x) => s + x.pedir, 0), costo = r2(aPedir.reduce((s, x) => s + x.pedir * x.costo, 0));
  if (!peds.length) { v.innerHTML = vacio('No hay pedidos por entregar', 'El pedido al proveedor se arma con lo que vendiste y falta por entregar.'); return; }
  v.innerHTML = `
    <div class="resumen">
      <div><p class="resumen-n">${peds.length}</p><p>pedidos de clientes</p></div>
      <div class="${totPedir ? 'alerta' : ''}"><p class="resumen-n">${totPedir}</p><p>bultos a pedir</p></div>
      ${costo ? `<div><p class="resumen-n monto">${dinero(costo)}</p><p>costo estimado</p></div>` : ''}
    </div>
    <p class="ayuda pad-x">A pedir = vendido por entregar − lo que hay en bodega. Puedes ajustar las cantidades al cargar la compra.</p>
    ${totPedir ? '' : `<p class="cuenta">${icono('check', 'ico-s')} Con lo que hay en bodega alcanza para todo lo vendido.</p>`}
    <div class="lista">${filas.map((x) => `
      <div class="fila carga"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p>
        <p class="fila-s">${esc(x.presentacion)}${x.presentacion ? ' · ' : ''}vendido ${x.vendido} · bodega ${x.stock}</p></div>
        <div class="carga-n"><span class="monto">${x.pedir || '—'}</span><span class="carga-u">${x.pedir ? 'a pedir' : 'alcanza'}</span></div></div>`).join('')}</div>
    ${prov ? `<div class="pad"><a class="btn sec" href="#/proveedores/${prov.id}/compra">${icono('camion')} Cargar la compra cuando llegue</a></div>` : ''}`;
  const texto = () => `Pedido ${fecha(diaVe())}:\n` + aPedir.map((x) => `• ${x.pedir} ${x.nombre}${x.presentacion ? ` (${x.presentacion})` : ''}`).join('\n');
  if (!aPedir.length) return;
  const salida = botonesSalida(v, async () => {
    const r = await nuevoReporte({ titulo: 'Pedido al proveedor', subtitulo: `${fecha(diaVe())}${prov ? ' · ' + prov.nombre : ''}` });
    r.resumen([{ valor: totPedir, etiqueta: 'Bultos a pedir', grande: true }, { valor: aPedir.length, etiqueta: 'Productos' }]);
    r.tabla([{ titulo: 'Producto' }, { titulo: 'Presentación', ancho: 34 }, { titulo: 'Cantidad', ancho: 24, alinear: 'right' }],
      aPedir.map((x) => [x.nombre, x.presentacion, String(x.pedir)]), { pie: ['Total', '', String(totPedir)] });
    return r.terminar();
  }, () => `Pedido-proveedor-${diaVe()}.pdf`, texto);
  // Enviar por WhatsApp al teléfono del proveedor si lo tiene
  if (prov?.telefono) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec';
    b.innerHTML = `${icono('whatsapp')} Enviar como texto a ${esc(prov.nombre)}`;
    b.addEventListener('click', () => { const t = String(prov.telefono).replace(/\D/g, '').replace(/^0/, '58'); window.open(`https://wa.me/${t}?text=${encodeURIComponent(texto())}`, '_blank'); });
    salida.prepend(b);
  }
  v.append(salida);
}

// ---------- Por cobrar ----------
export async function vistaPorCobrar(v) {
  barra({ titulo: 'Por cobrar', atras: '#/reportes' });
  const peds = await datos.porCobrar();
  if (!peds.length) { v.innerHTML = vacio('No hay notas por cobrar', 'Todas las notas tienen su pago registrado.'); return; }
  const porCli = new Map();
  for (const p of peds) {
    const c = porCli.get(p.cliente_id) || { id: p.cliente_id, nombre: p.cliente, notas: [], total: 0, entregado: 0 };
    c.notas.push(p); c.total = r2(c.total + p.total); if (p.estado === 'entregado') c.entregado = r2(c.entregado + p.total);
    porCli.set(p.cliente_id, c);
  }
  const clis = [...porCli.values()].sort((a, b) => b.total - a.total);
  const total = r2(peds.reduce((s, p) => s + p.total, 0)), entregado = r2(clis.reduce((s, c) => s + c.entregado, 0));
  const dias = (p) => Math.max(0, Math.round((Date.parse(diaVe() + 'T12:00:00Z') - Date.parse(diaVe(p.entregado_en || p.fecha) + 'T12:00:00Z')) / 864e5));
  v.innerHTML = `
    <div class="resumen">
      <div><p class="resumen-n monto">${dinero(entregado)}</p><p>entregado sin pagar</p></div>
      <div><p class="resumen-n monto">${dinero(r2(total - entregado))}</p><p>pedidos por entregar</p></div>
      <div><p class="resumen-n">${clis.length}</p><p>clientes</p></div>
    </div>
    ${clis.map((c) => `
    <h2 class="sec-t cola-der"><a href="#/clientes/${c.id}">${esc(c.nombre)}</a><span class="monto">${dinero(c.total)}</span></h2>
    <div class="lista">${c.notas.map((p) => `<a class="fila" href="#/notas/${p.id}"><div class="fila-txt"><p class="fila-t">N° ${numeroNota(p.numero)}</p>
      <p class="fila-s">${p.estado === 'entregado' ? `Entregada ${fecha(p.entregado_en)} · hace ${dias(p)} día${dias(p) === 1 ? '' : 's'}` : 'Por entregar'}</p></div>
      <span class="monto">${dinero(p.total)}</span></a>`).join('')}</div>`).join('')}`;
  v.append(botonesSalida(v, async () => {
    const r = await nuevoReporte({ titulo: 'Por cobrar', subtitulo: fecha(diaVe()) });
    r.resumen([{ valor: dinero(entregado), etiqueta: 'Entregado sin pagar', grande: true }, { valor: dinero(r2(total - entregado)), etiqueta: 'Por entregar' }, { valor: clis.length, etiqueta: 'Clientes' }]);
    r.seccion('Por cliente');
    r.tabla([{ titulo: 'Cliente' }, { titulo: 'Notas', ancho: 18, alinear: 'right' }, { titulo: 'Entregado', ancho: 32, alinear: 'right' }, { titulo: 'Total', ancho: 32, alinear: 'right' }],
      clis.map((c) => [c.nombre, String(c.notas.length), dinero(c.entregado), dinero(c.total)]), { pie: ['Total', String(peds.length), dinero(entregado), dinero(total)] });
    r.seccion('Detalle');
    r.tabla([{ titulo: 'N°', ancho: 18 }, { titulo: 'Cliente' }, { titulo: 'Estado', ancho: 40 }, { titulo: 'Total', ancho: 28, alinear: 'right' }],
      peds.map((p) => [numeroNota(p.numero), p.cliente, p.estado === 'entregado' ? `Entregada ${fecha(p.entregado_en)}` : 'Por entregar', dinero(p.total)]));
    return r.terminar();
  }, () => `Por-cobrar-${diaVe()}.pdf`, () => `Por cobrar al ${fecha(diaVe())} · ${dinero(total)}`));
}

// ---------- Cobros de un día ----------
export async function vistaCobros(v) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get('dia') || '') ? q.get('dia') : diaVe();
  barra({ titulo: 'Cobros del día', sub: fecha(dia), atras: '#/reportes' });
  const peds = await datos.cobros(dia, dia);
  const porForma = new Map();
  for (const p of peds) {
    const x = porForma.get(p.forma_pago) || { forma: p.forma_pago, n: 0, total: 0, bs: 0 };
    x.n++; x.total = r2(x.total + p.total); x.bs = r2(x.bs + (p.monto_bs || 0)); porForma.set(p.forma_pago, x);
  }
  const formas = [...porForma.values()].sort((a, b) => b.total - a.total);
  const total = r2(peds.reduce((s, p) => s + p.total, 0)), totalBs = r2(peds.reduce((s, p) => s + (p.monto_bs || 0), 0));
  v.innerHTML = `
    <form id="dia" class="form pad"><label class="campo"><span>Día</span><input type="date" name="dia" value="${dia}" max="${diaVe()}"></label></form>
    ${peds.length ? `<div class="resumen">
      <div><p class="resumen-n">${peds.length}</p><p>pagos</p></div>
      <div><p class="resumen-n monto">${dinero(total)}</p><p>total</p></div></div>
      ${totalBs ? `<p class="cuenta">Recibido en bolívares: <b class="monto">${bs(totalBs)}</b></p>` : ''}
    <h2 class="sec-t">Por forma de pago</h2>
    <div class="lista">${formas.map((f) => `<div class="fila rep"><div class="fila-txt"><p class="fila-t">${esc(f.forma)}</p>
      <p class="fila-s">${f.n} nota${f.n === 1 ? '' : 's'}${f.bs ? ` · ${bs(f.bs)}` : ''}</p></div><span class="monto">${dinero(f.total)}</span></div>`).join('')}</div>
    <h2 class="sec-t">Detalle</h2>
    <div class="lista">${peds.map((p) => `<a class="fila" href="#/notas/${p.id}"><div class="fila-txt"><p class="fila-t">${esc(p.cliente)}</p>
      <p class="fila-s">N° ${numeroNota(p.numero)} · ${esc(p.forma_pago)}${p.tasa_bcv ? ` · tasa ${num2(p.tasa_bcv)} · ${bs(p.monto_bs)}` : ''}${p.referencia_pago ? ` · ref. ${esc(p.referencia_pago)}` : ''}</p></div>
      <span class="monto">${dinero(p.total)}</span></a>`).join('')}</div>` : vacio('No hay cobros registrados este día', 'Los pagos se registran en cada nota con "Registrar pago".')}`;
  $('[name="dia"]', v).addEventListener('change', (e) => { if (e.target.value) location.hash = `#/reportes/cobros?dia=${e.target.value}`; });
  if (!peds.length) return;
  v.append(botonesSalida(v, async () => {
    const r = await nuevoReporte({ titulo: 'Cobros del día', subtitulo: fecha(dia) });
    r.resumen([{ valor: peds.length, etiqueta: 'Pagos' }, { valor: dinero(total), etiqueta: 'Total', grande: true }, ...(totalBs ? [{ valor: bs(totalBs), etiqueta: 'Recibido en bolívares', grande: true }] : [])]);
    r.seccion('Por forma de pago');
    r.tabla([{ titulo: 'Forma de pago' }, { titulo: 'Notas', ancho: 18, alinear: 'right' }, { titulo: 'Total', ancho: 32, alinear: 'right' }, { titulo: 'Bolívares', ancho: 40, alinear: 'right' }],
      formas.map((f) => [f.forma, String(f.n), dinero(f.total), f.bs ? bs(f.bs) : '—']), { pie: ['Total', String(peds.length), dinero(total), totalBs ? bs(totalBs) : '—'] });
    r.seccion('Detalle');
    r.tabla([{ titulo: 'N°', ancho: 18 }, { titulo: 'Cliente' }, { titulo: 'Forma de pago', ancho: 34 }, { titulo: 'Tasa', ancho: 20, alinear: 'right' }, { titulo: 'Bolívares', ancho: 30, alinear: 'right' }, { titulo: 'Total', ancho: 26, alinear: 'right' }],
      peds.map((p) => [numeroNota(p.numero), p.cliente, p.forma_pago + (p.referencia_pago ? `\nRef. ${p.referencia_pago}` : ''), p.tasa_bcv ? num2(p.tasa_bcv) : '—', p.monto_bs ? bs(p.monto_bs) : '—', dinero(p.total)]));
    return r.terminar();
  }, () => `Cobros-${dia}.pdf`, () => `Cobros del ${fecha(dia)} · ${dinero(total)}`));
}

// ---------- Ventas de un período ----------
const PERIODOS = [['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes-ant', 'Mes anterior'], ['30', 'Últimos 30 días']];
function rango(k) {
  const hoy = diaVe(), d = new Date(hoy + 'T12:00:00Z');
  const iso = (x) => x.toISOString().slice(0, 10);
  if (k === 'mes') return [hoy.slice(0, 8) + '01', hoy];
  if (k === 'mes-ant') { const a = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); const b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); return [iso(a), iso(b)]; }
  if (k === '30') return [iso(new Date(d.getTime() - 29 * 864e5)), hoy];
  const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5); return [iso(lunes), hoy];
}
export async function vistaVentas(v) {
  const k = new URLSearchParams(location.hash.split('?')[1] || '').get('p') || 'semana';
  const [desde, hasta] = rango(k);
  barra({ titulo: 'Ventas', sub: `${fecha(desde)} al ${fecha(hasta)}`, atras: '#/reportes' });
  const peds = await datos.entregados(desde, hasta);
  const porProd = new Map(), porCli = new Map();
  for (const p of peds) {
    const c = porCli.get(p.cliente_id) || { nombre: p.cliente, n: 0, total: 0 };
    c.n++; c.total = r2(c.total + p.total); porCli.set(p.cliente_id, c);
    for (const i of p.items) {
      const x = porProd.get(i.producto_id) || { nombre: i.nombre, cantidad: 0, total: 0 };
      x.cantidad += i.cantidad; x.total = r2(x.total + i.subtotal); porProd.set(i.producto_id, x);
    }
  }
  const prods = [...porProd.values()].sort((a, b) => b.total - a.total), clis = [...porCli.values()].sort((a, b) => b.total - a.total);
  const total = r2(peds.reduce((s, p) => s + p.total, 0)), bultos = prods.reduce((s, x) => s + x.cantidad, 0);
  v.innerHTML = `
    <div class="filtros" role="tablist">${PERIODOS.map(([p, t]) => `<a class="filtro" role="tab" href="#/reportes/ventas?p=${p}" aria-selected="${p === k}">${t}</a>`).join('')}</div>
    <p class="ayuda pad-x">Cuenta lo entregado en el período, pagado o por cobrar (los pedidos por entregar no suman todavía).</p>
    ${peds.length ? `<div class="resumen">
      <div><p class="resumen-n">${peds.length}</p><p>notas</p></div>
      <div><p class="resumen-n">${bultos}</p><p>bultos</p></div>
      <div><p class="resumen-n monto">${dinero(total)}</p><p>vendido</p></div></div>
    <h2 class="sec-t">Por producto</h2>
    <div class="lista">${prods.map((x) => `<div class="fila rep"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p><p class="fila-s">${x.cantidad} bulto${x.cantidad === 1 ? '' : 's'}</p></div><span class="monto">${dinero(x.total)}</span></div>`).join('')}</div>
    <h2 class="sec-t">Por cliente</h2>
    <div class="lista">${clis.map((x) => `<div class="fila rep"><div class="fila-txt"><p class="fila-t">${esc(x.nombre)}</p><p class="fila-s">${x.n} nota${x.n === 1 ? '' : 's'}</p></div><span class="monto">${dinero(x.total)}</span></div>`).join('')}</div>`
    : vacio('No hay ventas entregadas en este período')}`;
  if (!peds.length) return;
  v.append(botonesSalida(v, async () => {
    const r = await nuevoReporte({ titulo: 'Ventas', subtitulo: `Del ${fecha(desde)} al ${fecha(hasta)}` });
    r.resumen([{ valor: peds.length, etiqueta: 'Notas entregadas' }, { valor: bultos, etiqueta: 'Bultos' }, { valor: dinero(total), etiqueta: 'Vendido', grande: true }]);
    r.seccion('Por producto');
    r.tabla([{ titulo: 'Producto' }, { titulo: 'Bultos', ancho: 22, alinear: 'right' }, { titulo: 'Total', ancho: 34, alinear: 'right' }], prods.map((x) => [x.nombre, String(x.cantidad), dinero(x.total)]), { pie: ['Total', String(bultos), dinero(total)] });
    r.seccion('Por cliente');
    r.tabla([{ titulo: 'Cliente' }, { titulo: 'Notas', ancho: 22, alinear: 'right' }, { titulo: 'Total', ancho: 34, alinear: 'right' }], clis.map((x) => [x.nombre, String(x.n), dinero(x.total)]));
    return r.terminar();
  }, () => `Ventas-${desde}-al-${hasta}.pdf`, () => `Ventas del ${fecha(desde)} al ${fecha(hasta)} · ${dinero(total)}`));
}
