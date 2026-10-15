// Cotizaciones: precios para imprimir o enviar por WhatsApp sin generar notas (pedido de Francisco, 15-10-2026).
// No son notas: no tienen número, no mueven stock, no cuentan en ventas ni cambian el precio base.
//  - #/nuevo              el «+» pregunta: pedido nuevo o cotización
//  - #/cotizaciones       lista (vigentes, vencidas y convertidas en pedido)
//  - #/cotizaciones/nueva elegir el cliente → #/clientes/:id/cotizacion (pantalla del pedido en modo cotización)
//  - #/cotizaciones/:id   detalle: imprimir, WhatsApp, guardar PDF, convertir en pedido, eliminar
import { $, $$, esc, barra, icono, vacio, aviso, ir, dinero, num2, fecha, fechaHora, numeroNota, diaVe } from '../ui.js';
import * as datos from '../datos.js';
import { celebra } from '../ilustraciones.js';
import { notaPdf, nombreArchivo } from '../nota-pdf.js';
import { enviarPdfWhatsApp, guardarPdf, imprimirPdf } from '../pdf.js';
import { esEscritorio } from '../escritorio.js';
import { esApp, imprimirTermica } from '../impresora.js';
import { ultimaCiudad } from '../ubicacion.js';

const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const vencida = (k) => !!k.valida_hasta && k.valida_hasta < diaVe();
export function chipCotizacion(k) {
  if (k.pedido_id) return `<span class="chip ok">${icono('check', 'ico-s')} Convertida en pedido</span>`;
  const base = vencida(k) ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Vencida · ${fecha(k.valida_hasta)}</span>`
    : `<span class="chip pendiente">${icono('calendario', 'ico-s')} ${k.valida_hasta ? `Válida hasta ${fecha(k.valida_hasta)}` : 'Vigente'}</span>`;
  return base + (k.porSubir ? `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>` : '');
}

// ---------- El «+»: ¿pedido o cotización? ----------
export async function vistaNuevo(v) {
  barra({ titulo: 'Nuevo', sub: '¿Qué vas a hacer?', atras: '#/pedidos' });
  v.innerHTML = `
    <div class="elegir-tipo">
      <a class="tipo-opcion" href="#/pedidos/nuevo">
        <span class="tipo-ico">${icono('pedidos')}</span>
        <span class="tipo-txt"><span class="tipo-t">Pedido nuevo</span>
          <span class="tipo-s">Genera una nota con número para entregar y cobrar.</span></span>${icono('derecha', 'ico-chev')}</a>
      <a class="tipo-opcion" href="#/cotizaciones/nueva">
        <span class="tipo-ico cot">${icono('dinero')}</span>
        <span class="tipo-txt"><span class="tipo-t">Cotización</span>
          <span class="tipo-s">Precios para imprimir o enviar por WhatsApp. No genera nota ni toca el inventario.</span></span>${icono('derecha', 'ico-chev')}</a>
    </div>
    <a class="btn link" href="#/cotizaciones">${icono('lista')} Ver cotizaciones guardadas</a>`;
}

// ---------- Lista ----------
let filtroQ = '';
export async function vistaCotizaciones(v) {
  barra({ titulo: 'Cotizaciones', atras: esEscritorio() ? null : '#/mas' });
  const todas = await datos.cotizaciones();
  v.innerHTML = `
    <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar cliente" value="${esc(filtroQ)}" aria-label="Buscar cotización"></div>
    <p class="ayuda pad-x">Las cotizaciones no son notas: no tienen número, no tocan el inventario y no cuentan en ventas.</p>
    <div id="lista"></div>
    <div class="pie-fijo"><a class="btn prin" href="#/cotizaciones/nueva">${icono('mas')} Nueva cotización</a></div>`;
  const pintar = () => {
    const b = normal(filtroQ);
    const vis = todas.filter((k) => !b || normal(k.cliente).includes(b));
    $('#lista', v).innerHTML = vis.length ? `<div class="lista">${vis.map((k) => `
      <a class="fila" href="#/cotizaciones/${k.id}">
        <div class="fila-txt"><p class="fila-t">${esc(k.cliente)}</p>
          <p class="fila-s">${fecha(k.fecha)} · ${k.productos} producto${k.productos === 1 ? '' : 's'}</p>
          <div class="fila-chip">${chipCotizacion(k)}</div></div>
        <div class="cola-der"><span class="monto">${dinero(k.total)}</span></div>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio(todas.length ? 'No hay cotizaciones de ese cliente' : 'Aún no hay cotizaciones', todas.length ? '' : 'Crea una con el botón de abajo o con el «+».');
  };
  $('#q', v).addEventListener('input', (e) => { filtroQ = e.target.value.trim(); pintar(); });
  pintar();
}

// ---------- Detalle ----------
async function paraDocumento(k) {
  const c = k.datosCliente || await datos.cliente(k.cliente_id).catch(() => ({ nombre: k.cliente }));
  return { ...k, tipo: 'cotizacion', ciudad: k.ciudad || datos.negocio()?.ciudad || ultimaCiudad() || '', telefono: c?.telefono,
    cliente: { nombre: c?.nombre || k.cliente, razon_social: c?.razon_social, rif: c?.rif, domicilio_fiscal: c?.domicilio_fiscal } };
}

export async function vistaCotizacion(v, id) {
  const k = await datos.cotizacion(id);
  const nueva = /[?&]nueva=1/.test(location.hash);
  barra({ titulo: 'Cotización', sub: k.cliente, atras: '#/cotizaciones' });
  const c = k.datosCliente || {};
  const puedeConvertir = !k.pedido_id && c.activo !== false && !c.anonimizado_en;
  v.innerHTML = `
    <div class="nota-cab pad"><div class="fila-chip">${chipCotizacion(k)}</div><p class="fila-s">${fechaHora(k.fecha)}</p></div>
    ${nueva ? celebra('nota', '¡Cotización lista!', 'Imprímela o envíasela al cliente por WhatsApp. Si confirma, conviértela en pedido.') : ''}
    ${k.pedido ? `<a class="nota-enlace pad-x" href="#/notas/${k.pedido.id}">Se convirtió en la nota${k.pedido.numero ? ` N° ${numeroNota(k.pedido.numero)}` : ''} ${icono('derecha', 'ico-s')}</a>` : ''}
    ${k.porSubir ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Guardada en el equipo: se sube sola cuando haya señal. Ya la puedes imprimir y enviar.</p>` : ''}

    <h2 class="sec-t">Cliente</h2>
    <div class="lista"><a class="fila" href="#/clientes/${k.cliente_id}"><div class="fila-txt"><p class="fila-t">${esc(k.cliente)}</p>
      ${c.rif ? `<p class="fila-s">RIF ${esc(c.rif)}</p>` : ''}</div>${icono('derecha', 'ico-chev')}</a></div>

    <h2 class="sec-t">Productos</h2>
    <div class="lista">${k.items.map((i) => `
      <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
        <p class="fila-s">${i.cantidad} × ${dinero(i.precio)}${i.presentacion ? ` · ${esc(i.presentacion)}` : ''}</p></div>
        <span class="monto">${dinero(i.subtotal)}</span></div>`).join('')}</div>
    <dl class="totales">
      <div><dt>Subtotal</dt><dd class="monto">${dinero(k.subtotal)}</dd></div>
      ${k.iva_pct ? `<div><dt>IVA ${num2(k.iva_pct).replace(',00', '')} %</dt><dd class="monto">${dinero(k.iva)}</dd></div>` : ''}
      <div class="total"><dt>Total</dt><dd class="monto">${dinero(k.total)}</dd></div>
    </dl>
    <dl class="datos">
      <div class="dato"><dt>Válida hasta</dt><dd>${k.valida_hasta ? `${fecha(k.valida_hasta)}${vencida(k) ? ' · <span class="txt-alerta">vencida</span>' : ''}` : '—'}</dd></div>
      ${k.condiciones_pago ? `<div class="dato"><dt>Forma de pago</dt><dd>${esc(k.condiciones_pago)}</dd></div>` : ''}
      ${k.notas ? `<div class="dato"><dt>Notas</dt><dd>${esc(k.notas)}</dd></div>` : ''}
    </dl>

    <h2 class="sec-t">Cotización</h2>
    <div class="pad nota-acciones">
      ${esApp ? `<button type="button" class="btn sec" data-accion="termica">${icono('impresora')} Imprimir en la térmica</button>` : ''}
      <button type="button" class="btn sec" data-accion="normal">${icono('impresora')} Imprimir en hoja</button>
      <button type="button" class="btn sec" data-accion="whatsapp">${icono('whatsapp')} Enviar por WhatsApp</button>
      <button type="button" class="btn sec" data-accion="guardar">${icono('descargar')} Guardar PDF</button>
      <button type="button" id="eliminar" class="btn peligro">Eliminar cotización</button>
    </div>
    ${puedeConvertir ? `<div class="pie-fijo"><a class="btn prin" href="#/clientes/${k.cliente_id}/pedido?cotizacion=${k.id}">${icono('pedidos')} Convertir en pedido</a></div>` : ''}`;

  let cache = null;
  const preparar = async () => (cache ||= { n: await paraDocumento(k), neg: await datos.configuracion() });
  $$('[data-accion]', v).forEach((b) => b.addEventListener('click', async () => {
    const html = b.innerHTML; b.disabled = true; b.textContent = b.dataset.accion === 'termica' ? 'Imprimiendo…' : 'Preparando…';
    try {
      const { n, neg } = await preparar();
      const acc = b.dataset.accion;
      if (acc === 'termica') { await imprimirTermica(n, neg, { copias: 1 }); aviso('Cotización impresa'); }
      else if (acc === 'normal') {
        const pdf = notaPdf(n, neg);
        if (esEscritorio() && !esApp) imprimirPdf(pdf);
        else aviso(`Ábrelo e imprímelo desde ahí. Guardado en ${await guardarPdf(pdf, nombreArchivo(n))}`);
      } else if (acc === 'whatsapp') await enviarPdfWhatsApp(notaPdf(n, neg), nombreArchivo(n), { telefono: n.telefono,
        texto: `Cotización${neg.nombre ? ` · ${neg.nombre}` : ''} · Total ${dinero(k.total)}${k.valida_hasta ? ` · válida hasta el ${fecha(k.valida_hasta)}` : ''}` });
      else aviso(`PDF guardado en ${await guardarPdf(notaPdf(n, neg), nombreArchivo(n))}`);
    } catch (e) { aviso(e.message || 'No se pudo preparar la cotización.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  }));
  $('#eliminar', v).addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta cotización? Ya no aparecerá en la lista.')) return;
    try { await datos.eliminarCotizacion(k.id); aviso('Cotización eliminada'); ir('#/cotizaciones'); }
    catch (e) { aviso(e.message, 'error'); }
  });
}
