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
  if (p.porSubir) return `<span class="chip">${icono('sinNube', 'ico-s')} Por subir</span>`;
  const entrega = p.estado === 'entregado'
    ? `<span class="chip ok">${icono('check', 'ico-s')} Entregada</span>`
    : atrasado(p) ? `<span class="chip alerta">${icono('alerta', 'ico-s')} Entrega atrasada · ${fecha(p.entrega_programada)}</span>`
      : `<span class="chip pendiente">${icono('camion', 'ico-s')} Por entregar${p.entrega_programada ? ` · ${textoEntrega(p.entrega_programada)}` : ''}</span>`;
  const pago = p.pagado_en ? `<span class="chip ok">${icono('dinero', 'ico-s')} Pagada</span>`
    : p.estado === 'entregado' ? `<span class="chip cobrar">${icono('dinero', 'ico-s')} Por cobrar</span>` : '';
  return entrega + pago;
}
