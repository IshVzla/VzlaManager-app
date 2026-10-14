import { $, esc, barra, aviso, icono } from '../ui.js';
import { temaActual } from './avanzado.js';
import * as datos from '../datos.js';
import { versionLocal, revisarActualizacion, abrirActualizacion } from '../actualizacion.js';
import { esApp, esEscritorio } from '../escritorio.js';

export async function vistaAjustes(v) {
  barra({ titulo: 'Ajustes', atras: esEscritorio() ? null : '#/mas' });
  const yo = datos.usuario();
  const fila = (href, t, s) => `<a class="fila" href="${href}"><div class="fila-txt"><p class="fila-t">${t}</p><p class="fila-s">${s}</p></div>${icono('derecha', 'ico-chev')}</a>`;
  const neg = datos.negocio();
  v.innerHTML = `
    <h2 class="sec-t">Usuario</h2>
    <dl class="datos">
      <div class="dato"><dt>Nombre</dt><dd>${esc(yo.nombre)}</dd></div>
      <div class="dato"><dt>Rol</dt><dd>${yo.rol === 'admin' ? 'Administrador' : 'Vendedor'}</dd></div>
      ${datos.enDemo() ? '' : `<div class="dato"><dt>Código de este equipo</dt><dd>${esc(datos.codigoEquipo())}</dd></div>`}
    </dl>
    ${datos.esAdmin() ? `<h2 class="sec-t">Administración</h2>
    <div class="lista">${fila('#/negocio', 'Datos del negocio y la nota', `Razón social, RIF, moneda (${neg.moneda === 'VES' ? 'bolívares' : 'dólares'}) e IVA`)}</div>
    ${!neg.razon_social && !neg.nombre ? `<a class="nota-falta" href="#/negocio">${icono('alerta', 'ico-s')} Completa los datos del negocio: salen en cada nota.</a>` : ''}` : ''}
    <h2 class="sec-t">Otras opciones</h2>
    <div class="lista">
      ${fila('#/ajustes/impresoras', 'Impresoras', esApp ? 'Térmica Bluetooth (58 u 80 mm) y hoja con original y copia' : 'Nota en hoja con original y copia')}
      ${fila('#/pendientes', 'Trabajo sin señal', 'Cambios por subir y datos guardados en el equipo')}
      ${fila('#/ajustes/avanzado', 'Avanzado', `${datos.esAdmin() ? 'Formas de pago y datos para pagar · ' : ''}modo ${temaActual() === 'oscuro' ? 'oscuro' : 'claro'}`)}
    </div>
    <h2 class="sec-t">Versión</h2>
    <dl class="datos">
      <div class="dato"><dt>Instalada</dt><dd>${esc(versionLocal().nombre)}</dd></div>
      <div class="dato"><dt>Vigente</dt><dd id="v-vigente">Revisando…</dd></div>
    </dl>
    <div id="actualizar"></div>
    <div id="novedades"></div>
    <p class="version">VzlaManager${versionLocal().commit ? ' · ' + esc(versionLocal().commit) : ''}</p>
    <div class="pad"><button id="salir" class="btn peligro">Cerrar sesión</button></div>`;
  datos.versionVigente().then((vv) => {
    const local = versionLocal();
    $('#v-vigente', v).textContent = vv?.nombre ? `${vv.nombre}${vv.codigo > local.codigo && local.codigo ? ' (hay que actualizar)' : local.codigo ? ' ✓ al día' : ''}` : '—';
    if (esApp && local.codigo && vv?.codigo > local.codigo) {
      $('#actualizar', v).innerHTML = `<div class="pad"><button id="btn-actualizar" class="btn prin">Actualizar a la versión ${esc(vv.nombre)}</button></div>`;
      $('#btn-actualizar', v).addEventListener('click', () => abrirActualizacion(vv));
    }
    revisarActualizacion();
  }).catch(() => { $('#v-vigente', v).textContent = datos.enDemo() ? '—' : 'Sin conexión para revisar'; });
  fetch('novedades.json').then((r) => r.json()).then((l) => {
    const n = l?.[0]; if (!n?.puntos?.length) return;
    $('#novedades', v).innerHTML = `<details class="elegir-caja"><summary><span>Novedades de esta versión</span></summary>
      <p class="fila-t">${esc(n.titulo || '')}</p><ul class="act-nov">${n.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>`;
  }).catch(() => {});
  $('#salir', v).addEventListener('click', async () => {
    try { await datos.salir(); } catch (e) { aviso(e.message, 'error'); return; }
    document.body.classList.remove('demo');
    window.dispatchEvent(new CustomEvent('vm:sesion', { detail: false }));
  });
}
