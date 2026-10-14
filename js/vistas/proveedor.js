// Proveedor: deuda al día, compras (suben el stock y la deuda) y abonos (bajan la deuda). Solo administrador.
// Deuda = saldo inicial + compras − abonos.
import { $, $$, esc, barra, icono, vacio, aviso, ir, dinero, bs, num2, r2, leerNumero, fecha, diaVe, simbolo } from '../ui.js';
import * as datos from '../datos.js';

const soloAdmin = (v) => { if (datos.esAdmin()) return false; v.innerHTML = vacio('Solo el administrador ve al proveedor'); return true; };

export async function vistaProveedores(v) {
  barra({ titulo: 'Proveedor', accion: datos.esAdmin() ? { href: '#/proveedores/nuevo', icono: 'mas', etiqueta: 'Nuevo proveedor' } : null });
  if (soloAdmin(v)) return;
  const ps = (await datos.proveedores()).filter((p) => p.activo !== false);
  if (ps.length === 1) return vistaProveedor(v, ps[0].id, { inicio: true });   // lo normal: un solo proveedor
  v.innerHTML = ps.length ? `
    <div class="resumen"><div class="alerta"><p class="resumen-n monto">${dinero(ps.reduce((s, p) => s + p.deuda, 0))}</p><p>debes en total</p></div></div>
    <div class="lista">${ps.map((p) => `<a class="fila" href="#/proveedores/${p.id}"><div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
      <p class="fila-s">${esc(p.rif || 'Sin RIF')}</p></div><span class="monto ${p.deuda > 0 ? 'txt-alerta' : ''}">${dinero(p.deuda)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
    : vacio('Aún no hay proveedor', 'Créalo con el botón + y anota cuánto le debes hoy.', '<a class="btn prin" href="#/proveedores/nuevo">Crear proveedor</a>');
}

export async function vistaProveedor(v, id, { inicio = false } = {}) {
  if (soloAdmin(v)) return;
  const p = await datos.proveedor(id);
  barra({ titulo: inicio ? 'Proveedor' : p.nombre, sub: inicio ? p.nombre : p.rif || '', atras: inicio ? null : '#/proveedores',
    accion: { href: `#/proveedores/${id}/editar`, icono: 'editar', etiqueta: 'Editar proveedor' } });
  // Historial: compras (+) y abonos (−), del más reciente al más antiguo
  const mov = [
    ...p.compras.map((c) => ({ tipo: 'compra', fecha: c.fecha, orden: c.creado_en || c.fecha, x: c })),
    ...p.abonos.map((a) => ({ tipo: 'abono', fecha: a.fecha, orden: a.creado_en || a.fecha, x: a })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.orden).localeCompare(String(a.orden)));
  v.innerHTML = `
    <div class="deuda-cab ${p.deuda > 0 ? 'debe' : ''}"><p>Le debes</p><p class="monto grande">${dinero(p.deuda)}</p>
      <p class="fila-s">Saldo inicial ${dinero(p.saldo_inicial)} + compras ${dinero(p.comprado)} − abonos ${dinero(p.abonado)}</p></div>
    <div class="pad nota-acciones">
      <a class="btn sec" href="#/proveedores/${id}/abono">${icono('dinero')} Registrar abono</a>
      <a class="btn link izq" href="#/reportes/pedido-proveedor">${icono('reportes')} Ver qué pedirle (lo que falta para entregar)</a>
    </div>
    <h2 class="sec-t">Movimientos</h2>
    ${mov.length ? `<div class="lista">${mov.map((m) => m.tipo === 'compra' ? `
      <a class="fila" href="#/compras/${m.x.id}"><span class="ruta-ico">${icono('inventario')}</span><div class="fila-txt"><p class="fila-t">Compra${m.x.documento ? ` · ${esc(m.x.documento)}` : ''}</p>
        <p class="fila-s">${fecha(m.fecha)} · ${m.x.productos} producto${m.x.productos === 1 ? '' : 's'}${m.x.estado === 'anulada' ? ' · <span class="txt-alerta">Anulada</span>' : ''}</p></div>
        <span class="monto ${m.x.estado === 'anulada' ? 'tachado' : ''}">+${dinero(m.x.total)}</span>${icono('derecha', 'ico-chev')}</a>` : `
      <div class="fila"><span class="ruta-ico ok">${icono('dinero')}</span><div class="fila-txt"><p class="fila-t">Abono${m.x.forma_pago ? ` · ${esc(m.x.forma_pago)}` : ''}</p>
        <p class="fila-s">${fecha(m.fecha)}${m.x.tasa_bcv ? ` · tasa ${num2(m.x.tasa_bcv)} · ${bs(m.x.monto_bs)}` : ''}${m.x.referencia ? ` · ref. ${esc(m.x.referencia)}` : ''}${m.x.estado === 'anulado' ? ' · <span class="txt-alerta">Anulado</span>' : ''}</p></div>
        <div class="cola-der"><span class="monto ${m.x.estado === 'anulado' ? 'tachado' : ''}">−${dinero(m.x.monto)}</span>
        ${m.x.estado === 'vigente' ? `<button type="button" class="btn link mini-link" data-anular-abono="${m.x.id}">Anular</button>` : ''}</div></div>`).join('')}</div>`
      : '<p class="texto-suave pad-x">Aún no hay compras ni abonos.</p>'}
    <div class="pie-fijo"><a class="btn prin" href="#/proveedores/${id}/compra">${icono('mas')} Registrar compra</a></div>`;
  $$('[data-anular-abono]', v).forEach((b) => b.addEventListener('click', async () => {
    const motivo = prompt('Motivo para anular este abono (la deuda vuelve a subir):');
    if (!motivo?.trim()) return;
    try { await datos.anularAbonoProveedor(b.dataset.anularAbono, motivo.trim()); aviso('Abono anulado'); vistaProveedor(v, id, { inicio }); }
    catch (e) { aviso(e.message, 'error'); }
  }));
}

export async function vistaProveedorForm(v, id) {
  if (soloAdmin(v)) return;
  const p = id ? await datos.proveedor(id) : { saldo_inicial: 0 };
  barra({ titulo: id ? 'Editar proveedor' : 'Nuevo proveedor', atras: id ? `#/proveedores/${id}` : '#/proveedores' });
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      <label class="campo"><span>Nombre o razón social</span><input name="nombre" value="${esc(p.nombre || '')}" placeholder="Ej.: Distribuidora del proveedor, C.A."></label>
      <label class="campo"><span>RIF</span><input name="rif" value="${esc(p.rif || '')}" autocapitalize="characters" placeholder="J-12345678-9"></label>
      <label class="campo"><span>Teléfono / WhatsApp</span><input name="telefono" type="tel" inputmode="tel" value="${esc(p.telefono || '')}"></label>
      <label class="campo"><span>Lo que le debías al empezar a usar la app (${simbolo()})</span>
        <input name="saldo_inicial" type="text" inputmode="decimal" value="${num2(p.saldo_inicial || 0)}"></label>
      <p class="ayuda">Desde aquí la deuda se calcula sola: suben las compras y bajan los abonos.</p>
      <label class="campo"><span>Notas</span><textarea name="notas" rows="2">${esc(p.notas || '')}</textarea></label>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear proveedor'}</button></div>
    </form>`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#err', v);
    const d = { nombre: f.nombre.value.trim(), rif: f.rif.value.trim().toUpperCase() || null, telefono: f.telefono.value.trim() || null, notas: f.notas.value.trim() || null, saldo_inicial: leerNumero(f.saldo_inicial.value) ?? 0 };
    if (!d.nombre) { err.textContent = 'Escribe el nombre del proveedor.'; return; }
    if (Number.isNaN(d.saldo_inicial)) { err.textContent = 'El saldo inicial no es un número válido.'; return; }
    try { const g = await datos.guardarProveedor(id ? { ...d, id: Number(id) } : d); aviso(id ? 'Proveedor guardado' : 'Proveedor creado'); ir(`#/proveedores/${g.id}`); }
    catch (x) { err.textContent = x.message; }
  });
}

// Registrar una compra: productos, cantidades y costo por bulto. Sube el stock y la deuda.
export async function vistaCompraNueva(v, provId) {
  if (soloAdmin(v)) return;
  const [p, prods, pend] = await Promise.all([datos.proveedor(provId), datos.productos(), datos.pendientesConDetalle()]);
  barra({ titulo: 'Registrar compra', sub: p.nombre, atras: `#/proveedores/${provId}` });
  const idCompra = crypto.randomUUID();
  const lineas = new Map();   // producto_id → { cantidad, costo }
  // Lo que falta para entregar (por entregar − bodega), para cargar la compra de un toque
  const falta = new Map();
  for (const x of pend) for (const i of x.items) falta.set(i.producto_id, (falta.get(i.producto_id) || 0) + i.cantidad);
  for (const pr of prods) { const f = (falta.get(pr.id) || 0) - Math.max(pr.stock, 0); if (f > 0) falta.set(pr.id, f); else falta.delete(pr.id); }
  const total = () => r2([...lineas.values()].reduce((s, l) => s + l.cantidad * (l.costo || 0), 0));
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      <div class="dos">
        <label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${diaVe()}" max="${diaVe()}"></label>
        <label class="campo"><span>N° de factura o nota</span><input name="documento" autocomplete="off"></label>
      </div>
      ${falta.size ? `<button type="button" id="cargar-falta" class="btn sec">${icono('camion')} Cargar lo que falta para entregar (${[...falta.values()].reduce((s, x) => s + x, 0)} bultos)</button>` : ''}
      <label class="campo"><span>Agregar producto</span><select id="agregar"><option value="">Elige un producto…</option>
        ${prods.map((x) => `<option value="${x.id}">${esc(x.nombre)}${x.presentacion ? ` · ${esc(x.presentacion)}` : ''}</option>`).join('')}</select></label>
      <div id="lineas"></div>
      <label class="check"><input name="actualizar_costo" type="checkbox" checked> Dejar el costo de cada producto con el de esta compra</label>
      <dl class="totales"><div class="total"><dt>Total de la compra</dt><dd id="tot" class="monto">${dinero(0)}</dd></div></dl>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">Registrar compra</button></div>
    </form>`;
  const pintar = () => {
    $('#lineas', v).innerHTML = [...lineas].map(([pid, l]) => {
      const pr = prods.find((x) => x.id === pid);
      return `<div class="compra-linea" data-id="${pid}">
        <div class="compra-linea-cab"><div class="fila-txt"><p class="fila-t">${esc(pr.nombre)}</p><p class="fila-s">${esc(pr.presentacion || '')} · bodega ${pr.stock}${falta.get(pid) ? ` · faltan ${falta.get(pid)} para entregar` : ''}</p></div>
          <button type="button" class="btn link quitar" aria-label="Quitar ${esc(pr.nombre)}">${icono('cerrar')}</button></div>
        <div class="dos">
          <label class="campo"><span>Bultos</span><input class="c-cant" type="number" inputmode="numeric" min="1" value="${l.cantidad || ''}"></label>
          <label class="campo"><span>Costo por bulto (${simbolo()})</span><input class="c-costo" type="text" inputmode="decimal" value="${l.costo != null ? num2(l.costo) : ''}"></label>
        </div>
        <p class="fila-s c-sub der">${dinero(r2(l.cantidad * (l.costo || 0)))}</p></div>`;
    }).join('') || '<p class="ayuda">Agrega los productos de la factura del proveedor.</p>';
    $$('.compra-linea', v).forEach((d) => {
      const pid = Number(d.dataset.id), l = lineas.get(pid);
      d.querySelector('.quitar').addEventListener('click', () => { lineas.delete(pid); pintar(); });
      const upd = () => { l.cantidad = Math.max(0, Math.floor(Number(d.querySelector('.c-cant').value)) || 0); l.costo = leerNumero(d.querySelector('.c-costo').value);
        d.querySelector('.c-sub').textContent = dinero(r2(l.cantidad * (l.costo || 0))); $('#tot', v).textContent = dinero(total()); };
      d.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
    });
    $('#tot', v).textContent = dinero(total());
  };
  const agregar = (pid, cant = 1) => { const pr = prods.find((x) => x.id === pid); if (!pr || lineas.has(pid)) return; lineas.set(pid, { cantidad: cant, costo: pr.costo > 0 ? pr.costo : null }); };
  $('#agregar', v).addEventListener('change', (e) => { agregar(Number(e.target.value)); e.target.value = ''; pintar(); });
  $('#cargar-falta', v)?.addEventListener('click', () => { for (const [pid, n] of falta) agregar(pid, n); pintar(); });
  pintar();
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#err', v), b = e.submitter || $('[type="submit"]', v);
    const items = [...lineas].map(([pid, l]) => ({ producto_id: pid, cantidad: l.cantidad, costo: l.costo }));
    if (!items.length) { err.textContent = 'Agrega al menos un producto.'; return; }
    if (items.some((i) => !(i.cantidad > 0))) { err.textContent = 'Revisa las cantidades: cada producto debe tener al menos 1 bulto.'; return; }
    if (items.some((i) => i.costo == null || Number.isNaN(i.costo) || i.costo < 0)) { err.textContent = 'Escribe el costo por bulto de cada producto (ej.: 22,50).'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await datos.registrarCompra({ id: idCompra, proveedor_id: Number(provId), fecha: f.fecha.value, documento: f.documento.value.trim() || null, actualizar_costo: f.actualizar_costo.checked, items });
      aviso(`Compra registrada · deuda +${dinero(total())} · stock al día`);
      ir(`#/proveedores/${provId}`);
    } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = 'Registrar compra'; }
  });
}

export async function vistaCompra(v, id) {
  if (soloAdmin(v)) return;
  const c = await datos.compra(id);
  barra({ titulo: `Compra${c.documento ? ` ${c.documento}` : ''}`, sub: c.proveedor, atras: `#/proveedores/${c.proveedor_id}` });
  v.innerHTML = `
    <div class="nota-cab pad">${c.estado === 'anulada' ? `<span class="chip alerta">${icono('cerrar', 'ico-s')} Anulada</span>` : `<span class="chip ok">${icono('check', 'ico-s')} Vigente</span>`}<p class="fila-s">${fecha(c.fecha)}</p></div>
    ${c.estado === 'anulada' ? `<div class="nota-anulada"><p class="fila-t">Compra anulada</p><p class="fila-s">Motivo: ${esc(c.anulado_motivo || '')}. El stock y la deuda se devolvieron.</p></div>` : ''}
    <h2 class="sec-t">Productos</h2>
    <div class="lista">${c.items.map((i) => `<div class="fila"><div class="fila-txt"><p class="fila-t">${esc(i.nombre)}</p><p class="fila-s">${i.cantidad} × ${dinero(i.costo)}</p></div><span class="monto">${dinero(i.subtotal)}</span></div>`).join('')}</div>
    <dl class="totales"><div class="total"><dt>Total</dt><dd class="monto">${dinero(c.total)}</dd></div></dl>
    ${c.estado === 'vigente' ? `<div class="pad"><button type="button" id="abrir-anular" class="btn peligro">Anular compra</button>
      <form id="form-anular" class="form anular" hidden>
        <label class="campo"><span>Motivo</span><input id="motivo" type="text" maxlength="120" placeholder="Ej.: factura cargada dos veces"></label>
        <p class="ayuda">El stock baja y la deuda con el proveedor baja en ${dinero(c.total)}.</p>
        <p id="err" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar" class="btn sec">Cancelar</button><button type="submit" class="btn peligro sin-margen">Sí, anular</button></div>
      </form></div>` : ''}`;
  const form = $('#form-anular', v);
  $('#abrir-anular', v)?.addEventListener('click', (e) => { e.currentTarget.hidden = true; form.hidden = false; $('#motivo', v).focus(); });
  $('#cancelar', v)?.addEventListener('click', () => { form.hidden = true; $('#abrir-anular', v).hidden = false; });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#motivo', v).value.trim();
    if (!m) { $('#err', v).textContent = 'Escribe el motivo.'; return; }
    try { await datos.anularCompra(c.id, m); aviso('Compra anulada'); vistaCompra(v, id); } catch (x) { $('#err', v).textContent = x.message; }
  });
}

// Abono al proveedor (baja la deuda). Si paga en bolívares, se anota la tasa BCV del día.
export async function vistaAbonoProveedor(v, provId) {
  if (soloAdmin(v)) return;
  const [p, neg] = await Promise.all([datos.proveedor(provId), datos.configuracion()]);
  barra({ titulo: 'Registrar abono', sub: p.nombre, atras: `#/proveedores/${provId}` });
  const formas = (neg.formas_pago || []).filter(Boolean);
  let forma = '';
  v.innerHTML = `
    <div class="deuda-cab debe"><p>Le debes</p><p class="monto grande">${dinero(p.deuda)}</p></div>
    <form id="f" class="form pad" novalidate>
      <label class="campo"><span>Monto del abono (${simbolo()})</span><input id="monto" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></label>
      <label class="campo"><span>Fecha</span><input id="fecha" type="date" value="${diaVe()}" max="${diaVe()}"></label>
      <fieldset class="opciones"><legend>Forma de pago</legend>
        ${formas.map((f) => `<label class="opcion"><input type="radio" name="forma" value="${esc(f)}"> ${esc(f)}</label>`).join('')}
      </fieldset>
      <div id="caja-bs" class="caja-bs" hidden>
        <label class="campo"><span>Tasa BCV del día (Bs por dólar)</span><input id="tasa" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej.: 182,40"></label>
        <p class="ayuda" id="calc-bs"></p>
      </div>
      <label class="campo"><span>Referencia (opcional)</span><input id="ref" type="text" maxlength="60" autocomplete="off"></label>
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo"><button class="btn prin" type="submit">${icono('check')} Registrar abono</button></div>
    </form>`;
  const necesitaTasa = () => neg.moneda !== 'VES' && datos.pagoEnBs(forma);
  const calc = () => { const t = leerNumero($('#tasa', v).value), m = leerNumero($('#monto', v).value); $('#calc-bs', v).textContent = t > 0 && m > 0 ? `${dinero(m)} × ${num2(t)} = ${bs(r2(m * t))}` : ''; };
  $$('input[name="forma"]', v).forEach((r) => r.addEventListener('change', () => { forma = r.value; $('#caja-bs', v).hidden = !necesitaTasa(); }));
  $('#tasa', v).addEventListener('input', calc); $('#monto', v).addEventListener('input', calc);
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err', v), monto = leerNumero($('#monto', v).value);
    if (!(monto > 0)) { err.textContent = 'Escribe el monto del abono.'; $('#monto', v).focus(); return; }
    if (monto > p.deuda && !confirm(`El abono (${dinero(monto)}) es mayor que la deuda (${dinero(p.deuda)}). ¿Registrar igual?`)) return;
    const a = { id: crypto.randomUUID(), proveedor_id: Number(provId), monto: r2(monto), fecha: $('#fecha', v).value, forma_pago: forma || null, referencia: $('#ref', v).value.trim() || null };
    if (necesitaTasa()) { const t = leerNumero($('#tasa', v).value); if (!(t > 0)) { err.textContent = 'Escribe la tasa BCV del día.'; return; } a.tasa_bcv = t; a.monto_bs = r2(monto * t); }
    try { await datos.registrarAbonoProveedor(a); aviso(`Abono registrado · deuda −${dinero(monto)}`); ir(`#/proveedores/${provId}`); }
    catch (x) { err.textContent = x.message; }
  });
}
