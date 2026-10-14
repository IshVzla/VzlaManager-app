// Pantallas del control de acceso:
//  - "App bloqueada": el administrador bloqueó la app, el usuario o este equipo. Los datos del equipo ya se borraron.
//  - "Conéctate a internet": el equipo pasó 15 días sin conectarse. No se borró nada; vuelve al tener señal.
import { $, esc, icono } from '../ui.js';
import * as datos from '../datos.js';

export function vistaBloqueo(v, b) {
  document.querySelector('#barra').innerHTML = '';
  const bloqueada = b.tipo === 'bloqueado';
  const titulo = bloqueada ? 'App bloqueada' : 'Conéctate a internet';
  const texto = bloqueada
    ? (b.motivo === 'app' ? 'El administrador bloqueó la app por seguridad.' : 'El administrador bloqueó este equipo o este usuario por seguridad.')
      + ' Los datos guardados en este equipo se borraron.'
    : `Este equipo lleva más de ${datos.DIAS_SIN_SENAL} días sin conectarse. Por seguridad, la app se bloquea hasta que tenga señal. No se borró nada: tus cambios se suben apenas te conectes.`;
  v.innerHTML = `
    <div class="login bloqueo">
      <span class="bloqueo-ico">${icono(bloqueada ? 'candado' : 'sinNube')}</span>
      <h1 class="bloqueo-t">${titulo}</h1>
      <p class="login-sub">${esc(texto)}</p>
      ${bloqueada ? '<p class="login-sub">Si crees que es un error, comunícate con el administrador.</p>' : ''}
      <p id="err" class="error" role="alert"></p>
      <button id="reintentar" class="btn prin" type="button">${bloqueada ? 'Revisar de nuevo' : 'Ya tengo señal, reintentar'}</button>
      <p class="bloqueo-cod">Código de este equipo: <strong>${esc(datos.codigoEquipo())}</strong></p>
    </div>`;
  $('#reintentar', v).addEventListener('click', async (e) => {
    const btn = e.currentTarget, antes = btn.textContent;
    btn.disabled = true; btn.textContent = 'Revisando…'; $('#err', v).textContent = '';
    try {
      const ok = bloqueada ? await datos.revisarBloqueo() : await datos.reintentarConexion();
      if (!ok) $('#err', v).textContent = bloqueada ? 'Sigue bloqueada. Comunícate con el administrador.' : 'Sigue bloqueada.';
    } catch (err) { $('#err', v).textContent = err.message; }
    if (btn.isConnected) { btn.disabled = false; btn.textContent = antes; }
  });
}
