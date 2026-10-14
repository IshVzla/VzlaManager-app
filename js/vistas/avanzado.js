// Ajustes > Avanzado: formas de pago (administrador, se guardan en la base) y tema claro u oscuro (en este equipo).
import { $, esc, barra, aviso } from '../ui.js';
import * as datos from '../datos.js';

const CLAVE = 'vm.tema';

export function temaActual() {
  return document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
}

function aplicarTema(tema) {
  if (tema === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
  else document.documentElement.removeAttribute('data-tema');
  try { localStorage.setItem(CLAVE, tema); } catch { /* se aplica igual, solo que no se recordará */ }
}

export async function vistaAvanzado(v) {
  barra({ titulo: 'Avanzado', atras: '#/ajustes' });
  const actual = temaActual();
  const admin = datos.esAdmin();
  const n = admin ? await datos.configuracion() : {};
  const lineas = (l) => esc((l || []).join('\n'));
  const opcion = (valor, titulo, detalle) => `
    <label class="opcion">
      <input type="radio" name="tema" value="${valor}" ${actual === valor ? 'checked' : ''}>
      <span class="opcion-txt">${titulo}<small>${detalle}</small></span>
    </label>`;
  v.innerHTML = `
    ${admin ? `<form id="pagos" class="form pad" novalidate>
      <h2 class="sec-t">Formas de pago</h2>
      <label class="campo"><span>Formas de pago (una por línea)</span>
        <textarea name="formas_pago" rows="5" placeholder="Pago móvil&#10;Transferencia en Bs&#10;Efectivo en dólares&#10;Zelle">${lineas(n.formas_pago)}</textarea></label>
      <p class="ayuda">Son las opciones al registrar un pago. Las que dicen "Bs", "bolívares", "pago móvil" o "punto" piden la tasa BCV.</p>
      <label class="campo"><span>Forma de pago que sale en la nota (por defecto)</span>
        <input name="condiciones_pago" value="${esc(n.condiciones_pago || '')}" placeholder="Ej.: Contado, Crédito 7 días…"></label>
      <label class="campo"><span>Datos para pagar (salen al pie de la nota, una por línea, opcional)</span>
        <textarea name="datos_pago" rows="3" placeholder="Pago móvil: banco · RIF · teléfono">${lineas(n.datos_pago)}</textarea></label>
      <p id="err" class="error" role="alert"></p>
      <button class="btn sec" type="submit">Guardar formas de pago</button>
    </form>` : ''}
    <div class="form pad">
      <h2 class="sec-t">Tema</h2>
      <fieldset class="opciones">
        <legend class="sr">Tema de la app</legend>
        ${opcion('claro', 'Claro', 'Fondo blanco. Se lee mejor a pleno sol.')}
        ${opcion('oscuro', 'Oscuro', 'Fondo oscuro. Cansa menos la vista de noche y puede ahorrar batería.')}
      </fieldset>
      <p class="ayuda">El tema se guarda solo en este equipo. Las notas y los PDF no cambian.</p>
    </div>`;
  v.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', () => {
    aplicarTema(r.value);
    aviso(r.value === 'oscuro' ? 'Modo oscuro activado' : 'Modo claro activado');
  }));
  const f = $('#pagos', v);
  f?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sep = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);
    const d = { formas_pago: sep(f.formas_pago.value), datos_pago: sep(f.datos_pago.value), condiciones_pago: f.condiciones_pago.value.trim() };
    if (!d.formas_pago.length) { $('#err', v).textContent = 'Agrega al menos una forma de pago (ej.: Pago móvil).'; return; }
    try { await datos.guardarConfiguracion({ ...(await datos.configuracion()), ...d }); aviso('Formas de pago guardadas'); $('#err', v).textContent = ''; }
    catch (x) { $('#err', v).textContent = x.message; }
  });
}
