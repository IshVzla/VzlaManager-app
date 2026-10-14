// Datos del negocio: lo que sale en la nota (como el talonario), la moneda y el IVA. Las formas de pago están en Ajustes → Avanzado.
// Solo administrador; necesita señal. Es la configuración que cambia de un negocio a otro (base white label).
import { $, esc, barra, aviso, icono, leerNumero } from '../ui.js';
import * as datos from '../datos.js';
import { notaPdf } from '../nota-pdf.js';
import { guardarPdf, imprimirPdf } from '../pdf.js';
import { esEscritorio } from '../escritorio.js';

export async function vistaNegocio(v) {
  barra({ titulo: 'Datos del negocio', sub: 'Salen en cada nota', atras: '#/ajustes' });
  const n = await datos.configuracion();
  const admin = datos.esAdmin();
  const campo = (k, et, ph = '', extra = '') => `<label class="campo"><span>${et}</span><input name="${k}" value="${esc(n[k] || '')}" placeholder="${esc(ph)}" ${extra}></label>`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Encabezado de la nota</h2>
      ${campo('razon_social', 'Razón social', 'Ej.: Distribuidora Ejemplo, C.A.')}
      ${campo('nombre', 'Nombre comercial (para mensajes y reportes)', 'Ej.: Distribuidora Ejemplo')}
      ${campo('rif', 'RIF', 'J-12345678-9', 'autocapitalize="characters"')}
      ${campo('domicilio_fiscal', 'Domicilio fiscal')}
      ${campo('domicilio_social', 'Domicilio social (opcional)')}
      ${campo('telefonos', 'Teléfonos', 'Ej.: (0424) 000.00.00 - (0414) 000.00.00')}
      ${campo('ciudad', 'Ciudad de la nota', 'Ej.: Valencia')}
      ${campo('distribuidor', 'Recuadro arriba a la derecha (opcional)', 'Ej.: Distribuidor autorizado')}

      <h2 class="sec-t">Moneda e IVA</h2>
      <fieldset class="opciones"><legend class="sr">Moneda</legend>
        <label class="opcion"><input type="radio" name="moneda" value="USD" ${n.moneda !== 'VES' ? 'checked' : ''}><span class="opcion-txt">Dólares ($)<small>Precios y notas en dólares; el pago en bolívares se registra con la tasa BCV del día</small></span></label>
        <label class="opcion"><input type="radio" name="moneda" value="VES" ${n.moneda === 'VES' ? 'checked' : ''}><span class="opcion-txt">Bolívares (Bs)<small>Precios y notas en bolívares, sin tasa</small></span></label>
      </fieldset>
      <p class="ayuda" id="aviso-moneda" hidden>${icono('alerta', 'ico-s')} Cambiar la moneda no convierte los precios ya guardados: revisa los precios base en Inventario.</p>
      <label class="check"><input name="iva_activo" type="checkbox" ${n.iva_activo ? 'checked' : ''}> Cobrar IVA en las notas</label>
      <label class="campo"><span>IVA (%)</span><input name="iva_pct" type="text" inputmode="decimal" value="${esc(String(n.iva_pct ?? 16).replace('.', ','))}"></label>

      <h2 class="sec-t">Pie de la nota</h2>
      <label class="campo"><span>Leyenda</span><textarea name="leyenda" rows="2">${esc(n.leyenda || '')}</textarea></label>
      <button type="button" id="vista-previa" class="btn sec">${icono('descargar')} Ver nota de prueba en PDF</button>
      <p id="err" class="error" role="alert"></p>
      ${admin ? '<div class="pie-fijo"><button class="btn prin" type="submit">Guardar</button></div>' : ''}
    </form>`;
  const f = $('#f', v);
  const leer = () => {
    const d = Object.fromEntries(['razon_social', 'nombre', 'rif', 'domicilio_fiscal', 'domicilio_social', 'telefonos', 'ciudad', 'distribuidor', 'leyenda']
      .map((k) => [k, (f[k].value || '').trim()]));
    d.rif = d.rif.toUpperCase().replace(/\s+/g, '');
    d.moneda = f.querySelector('input[name="moneda"]:checked').value;
    d.iva_activo = f.iva_activo.checked;
    d.iva_pct = leerNumero(f.iva_pct.value);
    return { ...n, ...d };
  };
  f.querySelectorAll('input[name="moneda"]').forEach((r) => r.addEventListener('change', () => { $('#aviso-moneda', v).hidden = r.value === (n.moneda || 'USD'); }));
  $('#vista-previa', v).addEventListener('click', async () => {
    const neg = leer();
    const iva = neg.iva_activo ? Number(neg.iva_pct) || 0 : 0;
    const items = [{ nombre: 'Producto de ejemplo', presentacion: 'Bulto 4x8', cantidad: 15, precio: 27.5 }, { nombre: 'Otro producto', presentacion: 'Bulto x18', cantidad: 5, precio: 42 }]
      .map((i) => ({ ...i, subtotal: i.cantidad * i.precio }));
    const sub = items.reduce((s, i) => s + i.subtotal, 0);
    const pdf = notaPdf({ numero: 0, fecha: new Date().toISOString(), estado: 'pendiente', condiciones_pago: neg.condiciones_pago,
      cliente: { nombre: 'Cliente de prueba', razon_social: 'Cliente de Prueba, C.A.', rif: 'J-00000000-0', domicilio_fiscal: 'Av. Principal, local 2' },
      items, subtotal: sub, iva_pct: iva, iva: Math.round(sub * iva) / 100, total: sub + Math.round(sub * iva) / 100 }, neg);
    if (esEscritorio()) imprimirPdf(pdf); else aviso(`Nota de prueba guardada en ${await guardarPdf(pdf, 'Nota-de-prueba.pdf')}`);
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leer(), err = $('#err', v);
    if (!d.razon_social && !d.nombre) { err.textContent = 'Escribe al menos la razón social o el nombre comercial.'; return; }
    if (d.iva_activo && !(d.iva_pct > 0 && d.iva_pct < 100)) { err.textContent = 'El IVA debe ser un porcentaje entre 0 y 100 (ej.: 16).'; return; }
    if (d.iva_pct == null || Number.isNaN(d.iva_pct)) d.iva_pct = 16;
    try { await datos.guardarConfiguracion(d); aviso('Datos del negocio guardados'); location.hash = '#/ajustes'; }
    catch (x) { err.textContent = x.message; }
  });
}
