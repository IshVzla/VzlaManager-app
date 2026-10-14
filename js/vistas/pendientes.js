import { $, esc, barra, icono, aviso, dinero, numeroNota } from '../ui.js';
import * as datos from '../datos.js';

// Trabajo sin señal: pedidos guardados en el equipo que faltan por subir y estado de la copia de datos.
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
        <p class="fila-s">${red ? 'Los pedidos se suben en cuanto se generan.' : 'Puedes seguir tomando pedidos: quedan guardados en el equipo y se suben solos al volver la señal. Entregar, cobrar y editar necesitan señal.'}</p></div></div>

      <h2 class="sec-t">Por subir al servidor</h2>
      ${cola.length ? `<div class="lista">${cola.map((x) => `
        <div class="fila"><div class="fila-txt">
          <p class="fila-t">${x.pedido.numero ? `Nota N° ${numeroNota(x.pedido.numero)}` : 'Nota sin número'} · ${esc(x.resumen.cliente || 'Cliente')}</p>
          <p class="fila-s">${hora(x.pedido.fecha)}</p>
          ${x.estado === 'error' ? `<p class="fila-s txt-alerta">${icono('alerta', 'ico-s')} No se pudo subir: ${esc(x.error)}</p>` : ''}</div>
          <div class="cola-der"><span class="monto">${dinero(x.resumen.total)}</span>
          <span class="chip ${x.estado === 'error' ? 'alerta' : ''}">${x.estado === 'error' ? 'Con problema' : 'Por subir'}</span></div></div>`).join('')}</div>
        ${errores ? `<p class="ayuda pad">Si un pedido sigue con problema después de reintentar, envía una captura de esta pantalla a quien administra la app.</p>` : ''}`
        : `<p class="texto-suave pad-x">${icono('check', 'ico-s')} No hay nada pendiente: todo está en el servidor.</p>`}

      <h2 class="sec-t">Datos guardados en el equipo</h2>
      <dl class="datos">
        <div class="dato"><dt>Clientes, productos y precios</dt><dd>Actualizados ${hace(datos.edadCopia())}</dd></div>
        <div class="dato"><dt>Números de nota reservados</dt><dd>${datos.numerosLibres()} disponibles</dd></div>
      </dl>
      <p class="ayuda pad">Con señal, la app renueva estos datos sola. Antes de ir a una zona sin señal, abre la app con señal para llevar todo al día.</p>
      <div class="pie-fijo"><button id="subir" class="btn prin">${icono('nube')} ${cola.length ? (errores ? 'Reintentar y subir ahora' : 'Subir ahora') : 'Actualizar datos ahora'}</button></div>`;

    $('#subir', v).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (!navigator.onLine) { aviso('Sin señal. Intenta cuando el equipo tenga internet.', 'error'); return; }
      b.disabled = true; b.textContent = 'Subiendo…';
      const antes = datos.colaCompleta().length;
      await datos.reintentarCola();
      const quedan = datos.colaCompleta();
      if (!datos.hayRed()) aviso('No hay señal suficiente. Intenta de nuevo en un momento.', 'error');
      else if (quedan.some((x) => x.estado === 'error')) aviso('Algunos pedidos no se pudieron subir. Revisa el mensaje.', 'error');
      else aviso(antes ? 'Pedidos subidos' : 'Datos actualizados');
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
