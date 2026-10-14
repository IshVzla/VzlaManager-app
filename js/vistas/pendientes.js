import { $, esc, barra, icono, aviso } from '../ui.js';
import * as datos from '../datos.js';

// Trabajo sin señal: cambios guardados en el equipo que faltan por subir y estado de la copia de datos.
const hace = (min) => (!isFinite(min) ? 'nunca' : min < 1 ? 'hace un momento' : min < 60 ? `hace ${Math.round(min)} min`
  : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} día${Math.round(min / 1440) === 1 ? '' : 's'}`);
const hora = (f) => new Date(f).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }).replace(/\//g, '-');

export async function vistaPendientes(v) {
  barra({ titulo: 'Trabajo sin señal', atras: '#/ajustes' });
  const pintar = () => {
    if (!v.isConnected || location.hash !== '#/pendientes') return;
    const cola = datos.colaCompleta();
    const errores = cola.filter((x) => x.estado === 'error').length;
    const red = datos.hayRed();
    v.innerHTML = `
      <div class="estado-red-ficha ${red ? 'con' : 'sin'}">${icono(red ? 'nube' : 'sinNube')}
        <div class="fila-txt"><p class="fila-t">${red ? 'Con señal' : 'Sin señal'}</p>
        <p class="fila-s">${red ? 'Los cambios se suben en cuanto se hacen.' : 'Todo sigue funcionando: pedidos, entregas, pagos, compras, abonos, clientes y productos quedan guardados en el equipo y se suben solos, en orden, cuando vuelva la señal.'}</p></div></div>

      <h2 class="sec-t">Por subir al servidor (${cola.length})</h2>
      ${cola.length ? `<div class="lista">${cola.map((x) => `
        <div class="fila"><div class="fila-txt">
          <p class="fila-t">${esc(x.texto || x.tipo)}</p>
          <p class="fila-s">${hora(x.en)}</p>
          ${x.estado === 'error' ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} El servidor no lo aceptó: ${esc(x.error)}</p>` : ''}</div>
          <div class="cola-der"><span class="chip ${x.estado === 'error' ? 'alerta' : ''}">${x.estado === 'error' ? 'Con problema' : 'Por subir'}</span>
          ${x.estado === 'error' ? `<button type="button" class="btn link mini-link" data-descartar="${esc(x.id)}">Descartar</button>` : ''}</div></div>`).join('')}</div>
        ${errores ? `<p class="ayuda pad">Un cambio "con problema" no se aplica en el equipo hasta reintentarlo. Si sigue con problema, "Descartar" lo borra (por ejemplo, si otro equipo ya hizo lo mismo).</p>` : ''}`
        : `<p class="texto-suave pad-x">${icono('check', 'ico-s')} No hay nada pendiente: todo está en el servidor.</p>`}

      <h2 class="sec-t">Datos guardados en el equipo</h2>
      <dl class="datos">
        <div class="dato"><dt>Clientes, productos, notas y proveedores</dt><dd>Actualizados ${hace(datos.edadCopia())}</dd></div>
        <div class="dato"><dt>Números de nota reservados</dt><dd>${datos.numerosLibres()} disponibles</dd></div>
      </dl>
      <p class="ayuda pad">Con señal, la app renueva estos datos sola (solo descarga lo que cambió). Si se acaban los números reservados sin señal, las notas nuevas reciben su número al subirse.</p>
      <div class="pie-fijo"><button id="subir" class="btn prin">${icono('nube')} ${cola.length ? (errores ? 'Reintentar y subir ahora' : 'Subir ahora') : 'Actualizar datos ahora'}</button></div>`;

    v.querySelectorAll('[data-descartar]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('¿Descartar este cambio? Se borra del equipo y no se subirá.')) return;
      datos.descartarCambio(b.dataset.descartar); aviso('Cambio descartado'); pintar();
    }));
    $('#subir', v).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (!navigator.onLine) { aviso('Sin señal. Intenta cuando el equipo tenga internet.', 'error'); return; }
      b.disabled = true; b.textContent = 'Subiendo…';
      const antes = datos.colaCompleta().length;
      await datos.reintentarCola();
      const quedan = datos.colaCompleta();
      if (!datos.hayRed()) aviso('No hay señal suficiente. Intenta de nuevo en un momento.', 'error');
      else if (quedan.some((x) => x.estado === 'error')) aviso('Algunos cambios no se pudieron subir. Revisa el mensaje.', 'error');
      else aviso(antes ? 'Cambios subidos' : 'Datos actualizados');
      pintar();
    });
  };
  repintar = pintar;
  pintar();
}
// Una sola suscripción: repinta la pantalla abierta cuando cambia la cola o la señal.
let repintar = () => {};
window.addEventListener('vm:cola', () => repintar());
window.addEventListener('vm:red', () => repintar());
