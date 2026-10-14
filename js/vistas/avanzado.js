// Ajustes > Apariencia: tema claro u oscuro, guardado en este equipo.
import { barra, aviso } from '../ui.js';

const CLAVE = 'vm.tema';

export function temaActual() {
  return document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
}

function aplicarTema(tema) {
  if (tema === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
  else document.documentElement.removeAttribute('data-tema');
  try { localStorage.setItem(CLAVE, tema); } catch { /* se aplica igual, solo que no se recordará */ }
}

export function vistaAvanzado(v) {
  barra({ titulo: 'Apariencia', atras: '#/ajustes' });
  const actual = temaActual();
  const opcion = (valor, titulo, detalle) => `
    <label class="opcion">
      <input type="radio" name="tema" value="${valor}" ${actual === valor ? 'checked' : ''}>
      <span class="opcion-txt">${titulo}<small>${detalle}</small></span>
    </label>`;
  v.innerHTML = `
    <div class="form pad">
      <h2 class="sec-t">Tema</h2>
      <fieldset class="opciones">
        <legend class="sr">Tema de la app</legend>
        ${opcion('claro', 'Claro', 'Fondo blanco. Se lee mejor a pleno sol.')}
        ${opcion('oscuro', 'Oscuro', 'Fondo oscuro. Cansa menos la vista de noche y puede ahorrar batería.')}
      </fieldset>
      <p class="ayuda">Se guarda solo en este equipo. Las notas y los PDF no cambian.</p>
    </div>`;
  v.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
    aplicarTema(r.value);
    aviso(r.value === 'oscuro' ? 'Modo oscuro activado' : 'Modo claro activado');
  }));
}
