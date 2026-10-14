// Estado de un pedido: entrega (por entregar / entregada) y pago (por cobrar / pagada), por separado.
import { icono, fecha, diaVe } from './ui.js';

// "hoy", "mañana" o la fecha (dd-mm-aaaa) de la entrega programada
export function textoEntrega(d) {
  if (!d) return '';
  const hoy = diaVe(), manana = diaVe(new Date(Date.now() + 864e5));
  return d === hoy ? 'hoy' : d === manana ? 'mañana' : fecha(d);
}
export const atrasado = (p) => p.estado === 'pendiente' && p.entrega_programada && p.entrega_programada < diaVe();
export const porCobrar = (p) => p.estado !== 'anulado' && !p.pagado_en;

// Etiquetas de estado (una o dos: entrega y pago)
export function chipEstado(p) {
  if (p.estado === 'anulado') return `<span class="chip alerta">${icono('cerrar', 'ico-s')} Anulada</span>`;
  const entrega = p.estado === 'entregado'
    ? `<span class="chip ok">${icono('check', 'ico-s')} Entregada</span>`
    : atrasado(p) ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Entrega atrasada · ${fecha(p.entrega_programada)}</span>`
      : `<span class="chip pendiente">${icono('camion', 'ico-s')} Por entregar${p.entrega_programada ? ` · ${textoEntrega(p.entrega_programada)}` : ''}</span>`;
  const pago = p.pagado_en ? `<span class="chip ok">${icono('dinero', 'ico-s')} Pagada</span>`
    : p.estado === 'entregado' ? `<span class="chip cobrar">${icono('dinero', 'ico-s')} Por cobrar</span>` : '';
  return entrega + pago + (p.porSubir ? `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>` : '');
}

// Seguimiento de la nota (como el rastreo de un envío): pedido → entregado → pagado.
// Cada paso dice su estado en texto; los puntos y la línea solo lo refuerzan.
export function seguimiento(p) {
  if (p.estado === 'anulado') return '';
  const entregado = p.estado === 'entregado', pagado = !!p.pagado_en;
  const pasos = [
    { t: 'Pedido', s: fecha(p.fecha), hecho: true, ico: 'pedidos' },
    { t: 'Entregado', s: entregado ? fecha(p.entregado_en) : p.entrega_programada ? `Programado ${textoEntrega(p.entrega_programada)}` : 'Pendiente', hecho: entregado, ico: 'camion' },
    { t: 'Pagado', s: pagado ? fecha(p.pagado_en) : entregado ? 'Por cobrar' : 'Pendiente', hecho: pagado, ico: 'dinero' },
  ];
  const actual = pasos.findIndex((x) => !x.hecho);
  return `<ol class="seguimiento" aria-label="Seguimiento de la nota">${pasos.map((x, i) => `
    <li class="seg-paso ${x.hecho ? 'hecho' : i === actual ? 'actual' : ''}">
      <span class="seg-punto">${icono(x.hecho ? 'check' : x.ico, 'ico-s')}</span>
      <span class="seg-t">${x.t}</span><span class="seg-s">${x.s}</span></li>`).join('')}</ol>`;
}
// Versión mini para las listas: tres puntos (pedido, entregado, pagado). Decorativa: el estado va en las etiquetas.
export function seguimientoMini(p) {
  if (p.estado === 'anulado') return '';
  const e = p.estado === 'entregado', g = !!p.pagado_en;
  return `<span class="seg-mini" aria-hidden="true"><i class="on"></i><b class="${e ? 'on' : ''}"></b><i class="${e ? 'on' : ''}"></i><b class="${g ? 'on' : ''}"></b><i class="${g ? 'on' : ''}"></i></span>`;
}
