// Ajustes → Impresoras: la térmica por Bluetooth (en la app Android) y la impresora normal (hoja).
// Se guarda en este equipo.
import { $, esc, barra, aviso, icono } from '../ui.js';
import * as datos from '../datos.js';
import { esApp, config, buscarImpresoras, imprimirTermica } from '../impresora.js';
import { notaPdf } from '../nota-pdf.js';
import { guardarPdf, imprimirPdf } from '../pdf.js';
import { esEscritorio } from '../escritorio.js';

// Nota de ejemplo para probar la impresión
const PRUEBA = () => ({ numero: 0, fecha: new Date().toISOString(), estado: 'entregado', entregado_en: new Date().toISOString(), condiciones_pago: 'Contado',
  cliente: { nombre: 'Cliente de prueba', razon_social: 'Cliente de Prueba, C.A.', rif: 'J-00000000-0', domicilio_fiscal: 'Av. Principal, local 2' },
  modificado_en_entrega: true, total_pedido: 412.5,
  items: [{ nombre: 'Producto de ejemplo', presentacion: 'Bulto 4x8', cantidad: 16, cantidad_pedida: 15, precio: 27.5, subtotal: 440 },
    { nombre: 'Otro producto', presentacion: 'Bulto x18', cantidad: 2, cantidad_pedida: 2, precio: 42, subtotal: 84 }],
  subtotal: 524, iva_pct: 0, iva: 0, total: 524 });

export async function vistaImpresoras(v) {
  barra({ titulo: 'Impresoras', atras: '#/ajustes' });
  v.innerHTML = `
    <div class="form pad">
      <h2 class="sec-t">Térmica portátil (Bluetooth)</h2>
      ${esApp ? `
      <p class="ayuda">Primero vincula la impresora en el Bluetooth de la tablet (Ajustes del equipo → Bluetooth). Luego elígela aquí.</p>
      <label class="campo"><span>Impresora</span><select id="termica"><option value="">Presiona "Buscar impresoras"</option></select></label>
      <button id="buscar" type="button" class="btn sec">Buscar impresoras vinculadas</button>
      <fieldset class="opciones"><legend>Ancho del papel</legend>
        <label class="opcion"><input type="radio" name="ancho" value="58" ${config.ancho !== '80' ? 'checked' : ''}><span class="opcion-txt">58 mm<small>La más común en las portátiles</small></span></label>
        <label class="opcion"><input type="radio" name="ancho" value="80" ${config.ancho === '80' ? 'checked' : ''}><span class="opcion-txt">80 mm<small>Tira más ancha: se lee mejor</small></span></label>
      </fieldset>
      <fieldset class="opciones"><legend>Copias de cada nota</legend>
        <label class="opcion"><input type="radio" name="copias" value="2" ${config.copias !== 1 ? 'checked' : ''}><span class="opcion-txt">Original y copia<small>Una para el cliente y otra firmada para el negocio</small></span></label>
        <label class="opcion"><input type="radio" name="copias" value="1" ${config.copias === 1 ? 'checked' : ''}><span class="opcion-txt">Solo una</span></label>
      </fieldset>
      <button id="prueba-termica" type="button" class="btn sec">${icono('impresora')} Imprimir nota de prueba</button>`
      : '<p class="ayuda">La térmica se usa desde la app Android de la tablet. En este equipo, la nota se imprime en hoja o se comparte en PDF.</p>'}
      <h2 class="sec-t">Impresora normal (hoja)</h2>
      <p class="ayuda">Sale la nota en media carta con <b>original y copia</b> en una hoja carta, para cortar: el cliente firma la copia y te la quedas.
        ${esApp ? 'En la tablet se abre el PDF y se imprime desde el visor (menú ⋮ → Imprimir).' : esEscritorio() ? 'En el PC se abre el diálogo de impresión.' : 'En el iPhone se abre el menú Compartir → Imprimir.'}</p>
      <button id="prueba-hoja" type="button" class="btn sec">${icono('impresora')} Nota de prueba en hoja</button>
    </div>`;
  if (esApp) {
    const sel = $('#termica', v);
    const llenar = (lista) => {
      if (!lista.length) return;
      sel.innerHTML = lista.map((d) => `<option value="${esc(d.address)}" ${d.address === config.termica ? 'selected' : ''}>${esc(d.name)} (${esc(d.address)})</option>`).join('');
      if (!config.termica) { const d = lista.find((x) => /print|pos|rpp|mtp|pt-?2|58|80/i.test(x.name)) || lista[0]; sel.value = d.address; config.termica = d.address; config.termicaNombre = d.name; }
    };
    if (config.termica) sel.innerHTML = `<option value="${esc(config.termica)}">${esc(config.termicaNombre || config.termica)}</option>`;
    sel.addEventListener('change', () => { config.termica = sel.value; config.termicaNombre = sel.selectedOptions[0]?.textContent || ''; aviso('Impresora elegida'); });
    $('#buscar', v).addEventListener('click', async () => {
      try { const l = await buscarImpresoras(); l.length ? llenar(l) : aviso('No hay impresoras vinculadas. Vincúlala en el Bluetooth del equipo.', 'error'); }
      catch (e) { aviso(e.message, 'error'); }
    });
    buscarImpresoras().then(llenar).catch(() => {});
    v.querySelectorAll('input[name="ancho"]').forEach((r) => r.addEventListener('change', () => { config.ancho = r.value; aviso(`Papel de ${r.value} mm`); }));
    v.querySelectorAll('input[name="copias"]').forEach((r) => r.addEventListener('change', () => { config.copias = Number(r.value); }));
    $('#prueba-termica', v).addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await imprimirTermica(PRUEBA(), await datos.configuracion()); aviso('Nota de prueba enviada'); } catch (x) { aviso(x.message, 'error'); }
      b.disabled = false;
    });
  }
  $('#prueba-hoja', v).addEventListener('click', async () => {
    try {
      const pdf = notaPdf(PRUEBA(), await datos.configuracion(), { formato: 'doble' });
      if (esEscritorio() && !esApp) imprimirPdf(pdf); else aviso(`Guardada en ${await guardarPdf(pdf, 'Nota-de-prueba-original-y-copia.pdf')}`);
    } catch (x) { aviso(x.message, 'error'); }
  });
}
