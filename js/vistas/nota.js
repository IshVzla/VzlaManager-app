// Detalle de una nota y sus pasos: imprimir/enviar, programar la entrega, ENTREGAR (con ajuste de lo entregado:
// la nota mantiene su número y queda marcado lo pedido vs. lo entregado), REGISTRAR EL PAGO (cuando el cliente pague)
// y anular. Editar (anula y crea otra nota) solo se usa antes de entregar y sin pagar.
import { $, $$, esc, barra, icono, aviso, ir, dinero, bs, num2, r2, leerNumero, fechaHora, numeroNota, diaVe } from '../ui.js';
import * as datos from '../datos.js';
import { ultimaCiudad } from '../ubicacion.js';
import { seguimiento, chipEstado, textoEntrega } from '../estado.js';
import { notaPdf, nombreArchivo } from '../nota-pdf.js';
import { enviarPdfWhatsApp, guardarPdf, imprimirPdf } from '../pdf.js';
import { esEscritorio } from '../escritorio.js';
import { esApp, imprimirTermica, config as impresora } from '../impresora.js';

// Datos de la nota para el PDF y la térmica (los mismos del talonario).
async function paraNota(p) {
  const c = p.datosCliente?.nombre ? p.datosCliente : await datos.cliente(p.cliente_id).catch(() => ({ nombre: p.cliente }));
  // Notas sin ciudad guardada: la del negocio o, si no hay, la última detectada por el GPS de este equipo
  return { ...p, ciudad: p.ciudad || datos.negocio()?.ciudad || ultimaCiudad() || '', cliente: { nombre: c.nombre, razon_social: c.razon_social, rif: c.rif, domicilio_fiscal: c.domicilio_fiscal },
    reemplazada_por: p.reemplazado_por?.numero, telefono: c.telefono };
}

// Botones de salida de la nota: térmica (app), impresora normal (original y copia), WhatsApp y guardar.
export function botonesNota({ conWhatsApp = true } = {}) {
  return `
    ${esApp ? `<button type="button" class="btn sec" data-accion="termica">${icono('impresora')} Imprimir en la térmica</button>` : ''}
    <button type="button" class="btn sec" data-accion="normal">${icono('impresora')} Imprimir en hoja (original y copia)</button>
    ${conWhatsApp ? `<button type="button" class="btn sec" data-accion="whatsapp">${icono('whatsapp')} Enviar por WhatsApp</button>` : ''}
    <button type="button" class="btn sec" data-accion="guardar">${icono('descargar')} Guardar PDF</button>`;
}
export function activarBotonesNota(v, p) {
  let cache = null;
  const preparar = async () => (cache ||= await (async () => { const neg = await datos.configuracion(); const n = await paraNota(p); return { n, neg }; })());
  $$('[data-accion]', v).forEach((b) => b.addEventListener('click', async () => {
    const html = b.innerHTML; b.disabled = true; b.textContent = b.dataset.accion === 'termica' ? 'Imprimiendo…' : 'Preparando…';
    try {
      const { n, neg } = await preparar();
      const acc = b.dataset.accion;
      if (acc === 'termica') { await imprimirTermica(n, neg); aviso(`Nota impresa${impresora.copias > 1 ? ' (original y copia)' : ''}`); }
      else if (acc === 'normal') {
        const pdf = notaPdf(n, neg, { formato: 'doble' });
        if (esEscritorio() && !esApp) imprimirPdf(pdf);
        else aviso(`Ábrelo e imprímelo desde ahí. Guardado en ${await guardarPdf(pdf, nombreArchivo(n).replace('.pdf', '-original-y-copia.pdf'))}`);
      } else if (acc === 'whatsapp') await enviarPdfWhatsApp(notaPdf(n, neg), nombreArchivo(n), { telefono: n.telefono,
        texto: `Nota N° ${numeroNota(p.numero)}${neg.nombre ? ` · ${neg.nombre}` : ''} · Total ${dinero(p.total)}` });
      else aviso(`PDF guardado en ${await guardarPdf(notaPdf(n, neg), nombreArchivo(n))}`);
    } catch (e) { aviso(e.message || 'No se pudo preparar la nota.', 'error'); }
    b.disabled = false; b.innerHTML = html;
  }));
}

export async function vistaNota(v, id) {
  const p = await datos.pedido(id);
  const nueva = /[?&]nueva=1/.test(location.hash);
  const titulo = `Nota N° ${numeroNota(p.numero)}`;
  barra({ titulo, sub: p.cliente, atras: '#/pedidos' });
  const anulada = p.estado === 'anulado', entregada = p.estado === 'entregado', pendiente = p.estado === 'pendiente';
  const pagada = !!p.pagado_en;
  const puedeEditar = datos.puedeCorregir(p), puedeAnular = datos.puedeAnular(p);
  const dato = (et, val) => (val ? `<div class="dato"><dt>${et}</dt><dd>${val}</dd></div>` : '');
  const cambio = (i) => p.modificado_en_entrega && i.cantidad !== i.cantidad_pedida;
  const lineas = p.items.filter((i) => i.cantidad > 0 || cambio(i));
  // Acción principal según el paso: entregar; si ya se entregó, cobrar.
  const principal = !p.porSubir && !anulada ? (pendiente ? 'entregar' : !pagada ? 'cobrar' : null) : null;

  v.innerHTML = `
    <div class="nota-cab pad"><div class="fila-chip">${chipEstado(p)}</div><p class="fila-s">${fechaHora(p.fecha)}</p></div>
    ${!p.porSubir ? seguimiento(p) : ''}
    ${nueva && !anulada ? `<div class="nota-lista">
      <p class="fila-t">${icono('check', 'ico-s')} Nota lista</p>
      <p class="fila-s">Envíasela al cliente por WhatsApp. Cuando llegue la mercancía, despáchala con "Entregar".</p></div>` : ''}
    ${anulada ? `<div class="nota-anulada">
      <p class="fila-t">Nota anulada${p.anulado_en ? ' el ' + esc(fechaHora(p.anulado_en)) : ''}</p>
      ${p.anulado_motivo ? `<p class="fila-s">Motivo: ${esc(p.anulado_motivo)}</p>` : ''}
      ${p.reemplazado_por ? `<a class="nota-enlace" href="#/notas/${p.reemplazado_por.id}">Reemplazada por la nota N° ${numeroNota(p.reemplazado_por.numero)} ${icono('derecha', 'ico-s')}</a>` : ''}
      <p class="fila-s">No cuenta en ventas, en lo por entregar ni en lo por cobrar.</p></div>` : ''}
    ${p.reemplaza ? `<a class="nota-enlace pad-x" href="#/notas/${p.reemplaza.id}">Corrige a la nota N° ${numeroNota(p.reemplaza.numero)} ${icono('derecha', 'ico-s')}</a>` : ''}
    ${p.porSubir ? `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Esta nota está guardada en el equipo. Se sube sola cuando haya señal; después podrás entregarla, cobrarla, editarla o anularla.</p>` : ''}
    ${p.modificado_en_entrega ? `<div class="nota-modificada"><p class="fila-t">${icono('editar', 'ico-s')} Modificada al entregar</p>
      <p class="fila-s">Lo entregado no es igual a lo pedido. Total del pedido: ${dinero(p.total_pedido)} · total entregado: ${dinero(p.total)}.</p></div>` : ''}

    <h2 class="sec-t">Cliente</h2>
    <div class="lista"><a class="fila" href="#/clientes/${p.cliente_id}"><div class="fila-txt"><p class="fila-t">${esc(p.cliente)}</p>
      ${p.datosCliente?.rif ? `<p class="fila-s">RIF ${esc(p.datosCliente.rif)}</p>` : ''}</div>${icono('derecha', 'ico-chev')}</a></div>

    <h2 class="sec-t">Productos</h2>
    <div class="lista">${lineas.map((i) => `
      <div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p>
        <p class="fila-s">${i.cantidad} × ${dinero(i.precio)}${i.presentacion ? ` · ${esc(i.presentacion)}` : ''}${i.precio_base != null && i.precio !== i.precio_base ? ` · <span class="txt-ambar">base ${dinero(i.precio_base)}</span>` : ''}</p>
        ${cambio(i) ? `<p class="fila-s txt-ambar">${icono('editar', 'ico-s')} ${i.cantidad_pedida ? `Pedido: ${i.cantidad_pedida} · entregado: ${i.cantidad}` : 'Agregado al entregar'}</p>` : ''}</div>
        <span class="monto">${dinero(i.subtotal)}</span></div>`).join('')}</div>
    <dl class="totales">
      <div><dt>Subtotal</dt><dd class="monto">${dinero(p.subtotal)}</dd></div>
      ${p.iva_pct ? `<div><dt>IVA ${num2(p.iva_pct).replace(',00', '')} %</dt><dd class="monto">${dinero(p.iva)}</dd></div>` : ''}
      <div class="total"><dt>Total</dt><dd class="monto">${dinero(p.total)}</dd></div>
    </dl>

    <h2 class="sec-t">Entrega y pago</h2>
    <dl class="datos">
      ${dato('Forma de pago', esc(p.condiciones_pago))}
      ${pendiente ? dato('Entrega', p.entrega_programada ? `Programada ${esc(textoEntrega(p.entrega_programada))}` : 'Sin fecha') : ''}
      ${entregada ? dato('Entregada', fechaHora(p.entregado_en)) : ''}
      ${pagada ? dato('Pagada', `${fechaHora(p.pagado_en)} · ${esc(p.forma_pago)}`)
        + (p.tasa_bcv ? dato('Tasa BCV', `${num2(p.tasa_bcv)} Bs por dólar`) + dato('Recibido en bolívares', bs(p.monto_bs)) : '')
        + dato('Referencia', esc(p.referencia_pago)) : !anulada ? dato('Pago', '<span class="txt-ambar">Por cobrar</span>') : ''}
      ${dato('Notas', esc(p.notas))}
    </dl>

    ${pendiente && !p.porSubir ? `<form id="form-programar" class="form pad caja-programar">
      <label class="campo"><span>${p.entrega_programada ? 'Cambiar fecha de entrega' : 'Programar la entrega'}</span>
        <input id="fecha-entrega" type="date" min="${diaVe()}" value="${esc(p.entrega_programada || '')}"></label>
      <div class="fila-botones">${p.entrega_programada ? '<button type="button" id="quitar-fecha" class="btn sec">Quitar fecha</button>' : ''}
        <button type="submit" class="btn sec">Guardar fecha</button></div>
    </form>` : ''}

    <h2 class="sec-t">Nota</h2>
    <div class="pad nota-acciones">
      ${botonesNota()}
      ${pendiente && !pagada && !p.porSubir ? `<a class="btn sec" href="#/notas/${p.id}/pago">${icono('dinero')} Registrar pago adelantado</a>` : ''}
      ${puedeEditar ? `<a class="btn link izq" href="#/clientes/${p.cliente_id}/pedido?editar=${p.id}">${icono('editar')} Editar el pedido (genera otra nota)</a>` : ''}
      ${puedeAnular ? `<button type="button" id="abrir-anular" class="btn peligro">Anular nota</button>
      <form id="form-anular" class="form anular" hidden>
        <label class="campo"><span>Motivo de la anulación</span>
          <input id="motivo" type="text" maxlength="120" placeholder="Ej.: el cliente canceló el pedido" required></label>
        <p class="ayuda">${entregada ? 'El stock vuelve a bodega y la venta deja de contar. ' : 'El pedido deja de estar por entregar. '}No se puede deshacer.</p>
        <p id="err-anular" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-anular" class="btn sec">Cancelar</button>
          <button type="submit" class="btn peligro sin-margen">Sí, anular</button></div>
      </form>` : ''}
    </div>
    ${principal ? `<div class="pie-fijo">${principal === 'entregar'
      ? `<a class="btn prin" href="#/notas/${p.id}/entrega">${icono('camion')} Entregar</a>`
      : `<a class="btn prin" href="#/notas/${p.id}/pago">${icono('dinero')} Registrar pago</a>`}</div>` : ''}`;

  activarBotonesNota(v, p);
  const guardarFecha = async (f) => {
    try { await datos.programarEntrega(p.id, f); aviso(f ? `Entrega programada para ${textoEntrega(f)}` : 'Fecha de entrega quitada'); vistaNota(v, id); }
    catch (e) { aviso(e.message, 'error'); }
  };
  $('#form-programar', v)?.addEventListener('submit', (e) => { e.preventDefault(); const f = $('#fecha-entrega', v).value; if (!f) return aviso('Elige la fecha de entrega.', 'error'); guardarFecha(f); });
  $('#quitar-fecha', v)?.addEventListener('click', () => guardarFecha(null));
  const form = $('#form-anular', v), pie = $('.pie-fijo', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true; form.hidden = false; if (pie) pie.hidden = true;
    $('#motivo', v).focus(); form.scrollIntoView({ block: 'center' });
  });
  $('#cancelar-anular', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; if (pie) pie.hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = $('#motivo', v).value.trim();
    if (!motivo) { $('#err-anular', v).textContent = 'Escribe el motivo de la anulación.'; return; }
    const b = form.querySelector('[type="submit"]'); b.disabled = true; b.textContent = 'Anulando…';
    try { await datos.anularPedido(p.id, motivo); aviso(`${titulo} anulada`); vistaNota(v, id); }
    catch (err) { $('#err-anular', v).textContent = err.message; b.disabled = false; b.textContent = 'Sí, anular'; }
  });
}

// ---------- Entregar: confirmar lo que se despacha (se puede ajustar) ----------
export async function vistaEntrega(v, id) {
  const [p, prods] = await Promise.all([datos.pedido(id), datos.productos()]);
  if (p.estado !== 'pendiente' || p.porSubir) { ir(`#/notas/${id}`); return; }
  barra({ titulo: 'Entregar', sub: `N° ${numeroNota(p.numero)} · ${p.cliente}`, atras: `#/notas/${id}` });
  const pagada = !!p.pagado_en;
  const lineas = new Map(p.items.map((i) => [i.producto_id, { producto_id: i.producto_id, nombre: i.nombre, presentacion: i.presentacion, pedida: i.cantidad, cantidad: i.cantidad, precio: i.precio }]));
  const total = () => r2([...lineas.values()].reduce((s, l) => s + l.cantidad * l.precio, 0) * (1 + (p.iva_pct || 0) / 100));
  const hayCambio = () => [...lineas.values()].some((l) => l.cantidad !== l.pedida);
  const disp = (pid) => prods.find((x) => x.id === pid);
  const pintar = () => {
    const ls = [...lineas.values()];
    v.innerHTML = `
      <p class="ayuda pad-x mt">Revisa lo que vas a despachar. Si entregas más, menos u otro producto, ajústalo aquí: la nota mantiene su número y queda anotado lo pedido y lo entregado.${pagada ? ' <b>Esta nota ya está pagada: no se pueden cambiar sus cantidades.</b>' : ''}</p>
      <div class="lista">${ls.map((l) => {
        const pr = disp(l.producto_id);
        return `<div class="fila prod entrega ${l.cantidad !== l.pedida ? 'sel' : ''}" data-id="${l.producto_id}">
          <div class="fila-txt"><p class="fila-t">${esc(l.nombre)}</p>
            <p class="fila-s">${l.pedida ? `Pedido: ${l.pedida}` : '<b class="txt-ambar">Agregado al entregar</b>'} · ${dinero(l.precio)} c/u${pr ? ` · bodega ${pr.stock}` : ''}</p>
            ${l.cantidad !== l.pedida && l.pedida ? `<p class="fila-s txt-ambar">${l.cantidad > l.pedida ? `+${l.cantidad - l.pedida}` : l.cantidad - l.pedida} respecto a lo pedido</p>` : ''}</div>
          <div class="cantidad" role="group" aria-label="Cantidad a entregar de ${esc(l.nombre)}">
            <button class="cant-btn" data-d="-1" aria-label="Quitar uno" ${l.cantidad && !pagada ? '' : 'disabled'}>${icono('menos')}</button>
            <input class="cant-n" type="number" inputmode="numeric" min="0" value="${l.cantidad}" aria-label="Cantidad" ${pagada ? 'disabled' : ''}>
            <button class="cant-btn" data-d="1" aria-label="Agregar uno" ${pagada ? 'disabled' : ''}>${icono('mas')}</button>
          </div></div>`;
      }).join('')}</div>
      ${pagada ? '' : `<div class="form pad"><label class="campo"><span>Agregar otro producto</span>
        <select id="agregar"><option value="">Elige un producto…</option>
          ${prods.filter((x) => !lineas.has(x.id)).map((x) => `<option value="${x.id}">${esc(x.nombre)}${x.presentacion ? ` · ${esc(x.presentacion)}` : ''} (bodega ${x.stock})</option>`).join('')}
        </select></label></div>`}
      <dl class="totales">
        ${hayCambio() ? `<div><dt>Total del pedido</dt><dd class="monto tachado">${dinero(p.total)}</dd></div>` : ''}
        <div class="total"><dt>Total a entregar</dt><dd class="monto">${dinero(total())}</dd></div>
      </dl>
      <p id="err" class="error pad-x" role="alert"></p>
      <div class="pie-fijo"><button id="confirmar" class="btn prin">${icono('camion')} Confirmar entrega</button></div>`;
    $$('.fila.entrega', v).forEach((f) => {
      const l = lineas.get(Number(f.dataset.id));
      const set = (q) => { l.cantidad = Math.max(0, Math.min(9999, Math.floor(q) || 0)); const y = v.scrollTop; pintar(); v.scrollTop = y; };
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set(l.cantidad + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => set(Number(e.target.value)));
    });
    $('#agregar', v)?.addEventListener('change', (e) => {
      const pr = disp(Number(e.target.value)); if (!pr) return;
      lineas.set(pr.id, { producto_id: pr.id, nombre: pr.nombre, presentacion: pr.presentacion, pedida: 0, cantidad: 1, precio: pr.precio });
      if (!(pr.precio > 0)) aviso(`${pr.nombre} no tiene precio base: ponle precio en Inventario.`, 'error');
      pintar();
    });
    $('#confirmar', v).addEventListener('click', confirmar);
  };
  async function confirmar(e) {
    const b = e.currentTarget, err = $('#err', v);
    const ls = [...lineas.values()];
    if (!ls.some((l) => l.cantidad > 0)) { err.textContent = 'No hay nada para entregar. Si el cliente no recibe nada, anula la nota.'; return; }
    if (ls.some((l) => l.cantidad > 0 && !(l.precio > 0))) { err.textContent = 'Hay un producto sin precio. Ponle precio base en Inventario.'; return; }
    if (hayCambio() && !confirm(`Lo entregado no es igual a lo pedido. La nota N° ${numeroNota(p.numero)} quedará con el nuevo total (${dinero(total())}) y marcada como modificada. ¿Confirmar?`)) return;
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await datos.registrarEntrega(p.id, hayCambio() ? ls.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio: l.precio })) : null);
      aviso(`Nota N° ${numeroNota(p.numero)} entregada${p.pagado_en ? '' : ' · queda por cobrar'}`);
      ir(`#/notas/${p.id}`);
    } catch (x) { err.textContent = x.message; b.disabled = false; b.innerHTML = `${icono('camion')} Confirmar entrega`; }
  }
  pintar();
}

// ---------- Registrar pago (cuando el cliente pague) ----------
export async function vistaPago(v, id) {
  const [p, neg] = await Promise.all([datos.pedido(id), datos.configuracion()]);
  if (p.estado === 'anulado' || p.pagado_en || p.porSubir) { ir(`#/notas/${id}`); return; }
  barra({ titulo: 'Registrar pago', sub: `N° ${numeroNota(p.numero)} · ${p.cliente}`, atras: `#/notas/${id}` });
  const formas = (neg.formas_pago || []).filter(Boolean);
  const enDolares = neg.moneda !== 'VES';
  let forma = formas.length === 1 ? formas[0] : '';
  v.innerHTML = `
    <div class="total-entrega"><p>Total a cobrar</p><p class="monto grande">${dinero(p.total)}</p>
      <p class="fila-s">${p.estado === 'entregado' ? `Entregada ${fechaHora(p.entregado_en)}` : 'Aún por entregar (pago adelantado)'}</p></div>
    <form id="f" class="form pad" novalidate>
      <fieldset class="opciones"><legend>Forma de pago</legend>
        ${formas.map((f) => `<label class="opcion"><input type="radio" name="forma" value="${esc(f)}" ${forma === f ? 'checked' : ''}> ${esc(f)}</label>`).join('')}
      </fieldset>
      ${formas.length ? '' : '<p class="nota-falta">No hay formas de pago configuradas. Agrégalas en Ajustes → Datos del negocio.</p>'}
      <div id="caja-bs" class="caja-bs" hidden>
        <label class="campo"><span>Tasa BCV del día (Bs por dólar)</span>
          <input id="tasa" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej.: 182,40"></label>
        <label class="campo"><span>Monto recibido en bolívares</span>
          <input id="monto-bs" type="text" inputmode="decimal" autocomplete="off" placeholder="Se calcula con la tasa"></label>
        <p class="ayuda" id="calc-bs"></p>
      </div>
      <label class="campo"><span>Referencia del pago (opcional)</span>
        <input id="ref" type="text" maxlength="60" autocomplete="off" placeholder="Ej.: últimos dígitos de la operación"></label>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button type="submit" class="btn prin">${icono('check')} Confirmar pago</button></div>
    </form>`;
  const cajaBs = $('#caja-bs', v), tasa = $('#tasa', v), montoBs = $('#monto-bs', v);
  let montoEditado = false;
  const necesitaTasa = () => enDolares && datos.pagoEnBs(forma);
  const calcular = () => {
    const t = leerNumero(tasa.value);
    if (!montoEditado) montoBs.value = t > 0 ? num2(r2(p.total * t)) : '';
    $('#calc-bs', v).textContent = t > 0 ? `${dinero(p.total)} × ${num2(t)} = ${bs(r2(p.total * t))}` : '';
  };
  const pintarBs = () => { cajaBs.hidden = !necesitaTasa(); };
  $$('input[name="forma"]', v).forEach((r) => r.addEventListener('change', () => { forma = r.value; pintarBs(); if (necesitaTasa()) tasa.focus(); }));
  tasa.addEventListener('input', calcular);
  montoBs.addEventListener('input', () => { montoEditado = montoBs.value.trim() !== ''; });
  pintarBs();
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err', v);
    if (!forma) { err.textContent = 'Elige la forma de pago.'; return; }
    const pago = { forma_pago: forma, referencia: $('#ref', v).value.trim() || null };
    if (necesitaTasa()) {
      const t = leerNumero(tasa.value), m = leerNumero(montoBs.value);
      if (!(t > 0)) { err.textContent = 'Escribe la tasa BCV del día (por ejemplo 182,40).'; tasa.focus(); return; }
      if (m != null && (Number.isNaN(m) || m < 0)) { err.textContent = 'El monto en bolívares no es válido.'; montoBs.focus(); return; }
      pago.tasa_bcv = t; pago.monto_bs = m ?? r2(p.total * t);
    }
    const b = $('[type="submit"]', v); b.disabled = true; b.textContent = 'Guardando…';
    try { await datos.registrarPago(p.id, pago); aviso(`Pago de la nota N° ${numeroNota(p.numero)} registrado`); ir(`#/notas/${p.id}`); }
    catch (x) { err.textContent = x.message; b.disabled = false; b.innerHTML = `${icono('check')} Confirmar pago`; }
  });
}
