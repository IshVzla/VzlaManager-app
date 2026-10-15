// "Más" (celular): agrupa Proveedores, Reportes, Impresoras, Trabajo sin señal y los ajustes.
// En la tablet horizontal estas secciones están en la barra superior.
import { esc, barra, icono, dinero } from '../ui.js';
import * as datos from '../datos.js';

export async function vistaMas(v) {
  barra({ titulo: 'Más' });
  const admin = datos.esAdmin();
  const provs = admin ? await datos.proveedores().catch(() => []) : [];
  const deuda = provs.filter((p) => p.activo !== false).reduce((s, p) => s + (p.deuda || 0), 0);
  const cola = datos.colaCompleta(), errores = cola.filter((x) => x.estado === 'error').length;
  const mosaico = (href, ico, t, s, clase = '', claseS = '') => `<a class="tarjeta reporte" href="${href}"><span class="ruta-ico ${clase}">${icono(ico)}</span>
    <p class="tarjeta-t">${t}</p><p class="tarjeta-s ${claseS}">${s}</p></a>`;
  const fila = (href, t, s) => `<a class="fila" href="${href}"><div class="fila-txt"><p class="fila-t">${t}</p>${s ? `<p class="fila-s">${s}</p>` : ''}</div>${icono('derecha', 'ico-chev')}</a>`;
  v.innerHTML = `
    <div class="grilla reportes-menu">
      ${admin ? mosaico('#/proveedores', 'camion', 'Proveedores', provs.length ? `Debes ${dinero(deuda)}` : 'Agrega tu proveedor', '', deuda > 0 ? 'txt-alerta' : '') : ''}
      ${mosaico('#/cotizaciones', 'dinero', 'Cotizaciones', 'Precios para enviar, sin generar notas')}
      ${mosaico('#/reportes', 'reportes', 'Reportes', 'Por cobrar, ventas y pedido al proveedor')}
      ${mosaico('#/ajustes/impresoras', 'impresora', 'Impresoras', 'Térmica y hoja')}
      ${mosaico('#/pendientes', errores ? 'alerta' : 'sinNube', 'Sin señal', cola.length ? `${cola.length} cambio${cola.length === 1 ? '' : 's'} por subir` : 'Todo al día', cola.length ? 'ambar' : '', errores ? 'txt-alerta' : cola.length ? 'txt-ambar' : '')}
    </div>
    <div class="lista">
      ${admin ? fila('#/negocio', 'Datos del negocio y la nota', 'Razón social, RIF, moneda e IVA') : ''}
      ${fila('#/ajustes/avanzado', 'Avanzado', `${admin ? 'Formas de pago y datos para pagar · ' : ''}tema claro u oscuro`)}
      ${fila('#/ajustes', 'Usuario y versión', esc(datos.usuario()?.nombre || ''))}
    </div>`;
}
