// Revisa si hay una versión nueva de la app y, si la hay, pide actualizar.
// Sin señal no bloquea: la app debe seguir funcionando en ruta.
// "Más tarde" la pospone 12 horas: una actualización nunca deja al usuario sin poder trabajar frente a un cliente.
import { versionVigente } from './datos.js';
import { esc } from './ui.js';

const cap = window.Capacitor;
const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Compartir = esApp ? ((cap.Plugins && cap.Plugins.Compartir) || cap.registerPlugin('Compartir')) : null;
const APK = 'https://github.com/IshVzla/VzlaManager-app/releases/latest/download/vzlamanager.apk';

export const versionLocal = () => window.VM_VERSION || { codigo: 0, nombre: 'desarrollo' };

export async function revisarActualizacion() {
  const local = versionLocal();
  if (!esApp || !local.codigo) return;       // la versión web siempre está al día; copia de desarrollo
  let vigente;
  try { vigente = await versionVigente(); } catch (_) { return; } // sin señal: no bloquear
  if (!vigente || !vigente.codigo || vigente.codigo <= local.codigo) { quitarBloqueo(); return; }
  if (pospuesta() > Date.now()) return;
  mostrarBloqueo(local, vigente);
}

// Desde Ajustes → Versión: abre el aviso aunque se haya elegido "Más tarde".
export function abrirActualizacion(vigente) {
  try { localStorage.removeItem('vm-act-pospuesta'); } catch (_) {}
  mostrarBloqueo(versionLocal(), vigente);
}

const POSPONER_MS = 12 * 3600 * 1000;
const pospuesta = () => { try { return Number(localStorage.getItem('vm-act-pospuesta')) || 0; } catch (_) { return 0; } };
function posponer() { try { localStorage.setItem('vm-act-pospuesta', String(Date.now() + POSPONER_MS)); } catch (_) {} quitarBloqueo(); }

function quitarBloqueo() { document.querySelector('.act-capa')?.remove(); }

function mostrarBloqueo(local, vigente) {
  if (document.querySelector('.act-capa')) return;
  const capa = document.createElement('div');
  capa.className = 'act-capa';
  capa.setAttribute('role', 'alertdialog');
  capa.setAttribute('aria-labelledby', 'act-t');
  capa.innerHTML = `
    <div class="act-caja">
      <img class="act-logo logo-claro" src="marca/vm-color.svg" alt="VzlaManager"><img class="act-logo logo-oscuro" src="marca/vm-negativo.svg" alt="VzlaManager">
      <h2 id="act-t">Hay una versión nueva</h2>
      <p>Instala la versión <b>${esc(vigente.nombre)}</b>. Tienes la ${esc(local.nombre)}.</p>
      ${novedadesHtml(vigente)}
      <button class="btn prin" id="act-bajar">Descargar e instalar</button>
      <ol class="act-pasos">
        <li>Se descarga el archivo <b>vzlamanager.apk</b>.</li>
        <li>Ábrelo desde la notificación de descarga.</li>
        <li>Toca <b>Actualizar</b>. Tus datos se mantienen.</li>
      </ol>
      <button class="btn sec" id="act-tarde">Más tarde</button>
      <p class="ayuda">Si estás con un cliente o con mala señal, actualiza después. Se te volverá a pedir en 12 horas.</p>
    </div>`;
  document.body.appendChild(capa);
  capa.querySelector('#act-tarde').addEventListener('click', posponer);
  capa.querySelector('#act-bajar').addEventListener('click', async () => {
    const url = vigente.url || APK;
    try { esApp ? await Compartir.abrirUrl({ url }) : window.open(url, '_blank'); }
    catch (_) { window.location.href = url; }
  });
}

// Lo nuevo de la versión, en lenguaje simple (www/novedades.json → lo registra la compilación en GitHub).
function novedadesHtml(vigente) {
  const n = vigente.novedades;
  if (n && Array.isArray(n.puntos) && n.puntos.length) {
    return `<div class="act-notas"><p class="act-nov-t">Qué trae esta versión${n.titulo ? `: ${esc(n.titulo)}` : ''}</p>
      <ul class="act-nov">${n.puntos.slice(0, 8).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  }
  return vigente.notas ? `<p class="act-notas">${esc(vigente.notas)}</p>` : '';
}
