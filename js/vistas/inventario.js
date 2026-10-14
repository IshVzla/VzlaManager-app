// Inventario flexible: stock en bodega, lo comprometido en pedidos por entregar y lo disponible.
// Nunca bloquea una venta: lo importante es concretar el pedido y que bodega sepa qué entregar.
import { $, esc, barra, icono, vacio, leerForm, aviso, ir, dinero, num2, pct, margen, precioConMargen, leerNumero, r2, selectorVista, activarSelector, idDe } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';
import { listaCambio, esEscritorio, tabla } from '../escritorio.js';

const FILTROS = [['todos', 'Todos'], ['disponible', 'Disponible'], ['falta', 'Falta para entregar'], ['sin', 'Sin stock']];
let estado = { filtro: 'todos', q: '', orden: { k: 'orden', dir: 'asc' } };
// falta = lo comprometido supera lo que hay en bodega
const clase = (p) => (p.disponible < 0 ? 'falta' : p.stock <= 0 ? 'sin' : p.stock_minimo && p.disponible <= p.stock_minimo ? 'bajo' : 'disponible');
const ESTADO = { disponible: 'Disponible', bajo: 'Poco disponible', sin: 'Sin stock', falta: 'Falta para entregar' };
const CHIP = { disponible: 'stock-disponible', bajo: 'stock-bajo', sin: 'stock-sin', falta: 'stock-negativo' };
// Iniciales de la primera y la última palabra con letras ("Tostones 80 g ajo" → TA; "Aros de papa 50 g" → AP)
const iniciales = (n) => { const w = n.split(/\s+/).filter((x) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(x) && !/^(de|del|la|el|con|y)$/i.test(x)); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
export const miniatura = (p, cls = '') => (p.imagen_url
  ? `<img class="mini ${cls}" src="${esc(p.imagen_url)}" alt="" loading="lazy">`
  : `<span class="mini sin-foto ${cls}" aria-hidden="true">${esc(iniciales(p.nombre))}</span>`);
const chip = (p) => { const k = clase(p); return `<span class="chip ${CHIP[k]}">${k === 'falta' ? `Faltan ${-p.disponible}` : k === 'sin' ? 'Sin stock' : `${p.disponible} disp.`}</span>`; };
const detalle = (p) => `Bodega ${p.stock}${p.porEntregar ? ` · Por entregar ${p.porEntregar}` : ''}`;

const COLS = [
  { k: 'orden', t: 'Producto', val: (p) => p.orden * 1e4 + p.id,
    html: (p) => `${miniatura(p, 'chica')}<span class="celda-txt">${esc(p.nombre)}${p.activo ? '' : ' <span class="txt-suave">(inactivo)</span>'}<small>${esc(p.presentacion || '')}</small></span>` },
  { k: 'categoria', t: 'Categoría', opc: true, prio2: true, val: (p) => p.categoria || '', html: (p) => esc(p.categoria || '—') },
  { k: 'precio', t: 'Precio base', num: true, val: (p) => p.precio ?? 0, html: (p) => (p.precio > 0 ? `<span class="monto">${dinero(p.precio)}</span>` : '<span class="txt-ambar">Sin precio</span>') },
  { k: 'stock', t: 'Bodega', num: true, opc: true, val: (p) => p.stock, html: (p) => String(p.stock) },
  { k: 'porEntregar', t: 'Por entregar', num: true, opc: true, val: (p) => p.porEntregar, html: (p) => String(p.porEntregar || 0) },
  { k: 'disponible', t: 'Disponible', num: true, val: (p) => p.disponible, html: chip },
];

export async function vistaInventario(v) {
  barra({ titulo: 'Inventario', accion: datos.esAdmin() ? { href: '#/inventario/nuevo', icono: 'mas', etiqueta: 'Nuevo producto' } : null });
  const todos = await datos.productos({ soloActivos: false });
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto" value="${esc(estado.q)}" aria-label="Buscar producto"></div>
      ${selectorVista()}
    </div>
    <div class="filtros" role="tablist">${FILTROS.map(([k, t]) => `<button class="filtro" data-f="${k}" role="tab">${t} <span class="n"></span></button>`).join('')}</div>
    <div id="lista"></div>`;
  const n = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const enFiltro = (p, k) => k === 'todos' || (k === 'disponible' ? ['disponible', 'bajo'].includes(clase(p)) : clase(p) === k);
  const pintar = () => {
    const buscados = todos.filter((p) => !estado.q || n(`${p.nombre} ${p.presentacion || ''} ${p.codigo || ''}`).includes(n(estado.q)));
    v.querySelectorAll('.filtro').forEach((b) => {
      b.querySelector('.n').textContent = buscados.filter((p) => enFiltro(p, b.dataset.f)).length;
      b.setAttribute('aria-selected', estado.filtro === b.dataset.f);
    });
    const vis = buscados.filter((p) => enFiltro(p, estado.filtro));
    const cont = $('#lista', v);
    if (!vis.length) { cont.className = ''; cont.innerHTML = vacio('No hay productos en este filtro'); return; }
    if (esEscritorio()) return tabla(cont, { cols: COLS, filas: vis, href: (p) => `#/inventario/${p.id}`, estado: estado.orden, etiqueta: 'Productos' });
    if (vista() === 'iconos') {
      cont.className = 'grilla';
      cont.innerHTML = vis.map((p) => `<a class="tarjeta ${p.activo ? '' : 'inactivo'}" href="#/inventario/${p.id}">
          <div class="tarjeta-foto">${miniatura(p)}<span class="flotante">${chip(p)}</span></div>
          <p class="tarjeta-t">${esc(p.nombre)}</p>
          <p class="tarjeta-p monto">${p.precio > 0 ? dinero(p.precio) : 'Sin precio'}</p></a>`).join('');
    } else {
      cont.className = 'lista';
      cont.innerHTML = vis.map((p) => `<a class="fila" href="#/inventario/${p.id}">${miniatura(p, 'chica')}
          <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}${p.activo ? '' : ' <span class="txt-suave">(inactivo)</span>'}</p>
            <p class="fila-s">${esc(p.presentacion || '')}${p.presentacion ? ' · ' : ''}${p.precio > 0 ? `<span class="monto">${dinero(p.precio)}</span>` : '<span class="txt-ambar">Sin precio</span>'}</p>
            <p class="fila-s">${detalle(p)}</p></div>
          ${chip(p)}</a>`).join('');
    }
  };
  $('#q', v).addEventListener('input', (e) => { estado.q = e.target.value.trim(); pintar(); });
  v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => { estado.filtro = b.dataset.f; pintar(); }));
  const vista = activarSelector(v, 'inventario', pintar, 'lista');
  pintar();
}

export async function vistaProductoForm(v, id) {
  const p = id ? await datos.producto(id) : { activo: true, costo: null, precio: null, orden: 0 };
  const cats = await datos.categorias();
  const admin = datos.esAdmin();
  barra({ titulo: id ? p.nombre : 'Nuevo producto', sub: id ? p.presentacion || '' : '', atras: '#/inventario' });
  const m0 = margen(p.costo || 0, p.precio || 0);
  const dec = (x) => (x == null ? '' : num2(x));
  v.innerHTML = `
    ${id ? `<div class="prod-cab">
      <div class="prod-foto">${miniatura(p, 'grande')}</div>
      <div class="stock-cab stock-${clase(p) === 'falta' ? 'negativo' : clase(p) === 'sin' ? 'sin' : clase(p)}">
        <p class="resumen-n">${p.disponible}</p><p>disponible</p>
        <p class="fila-s">${detalle(p)}</p>
        <span class="chip ${CHIP[clase(p)]}">${ESTADO[clase(p)]}</span></div>
    </div>
    ${admin ? (p.imagen_url ? '<button id="quitar-foto" class="btn link quitar">Quitar foto</button>' : `<div class="foto-acciones">
      <label class="btn sec">${icono('camara')} Tomar foto<input class="foto-in" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn sec">${icono('cuadricula')} Galería<input class="foto-in" type="file" accept="image/*" hidden></label>
    </div>`) : ''}` : ''}
    <form id="f" class="form pad" novalidate ${admin ? '' : 'inert'}>
      <h2 class="sec-t">Producto</h2>
      <label class="campo"><span>Nombre</span><input name="nombre" required value="${esc(p.nombre || '')}" placeholder="Ej.: Tostones 80 g ajo"></label>
      <label class="campo"><span>Presentación</span><input name="presentacion" value="${esc(p.presentacion || '')}" placeholder="Ej.: Bulto 4x8, Caja x12, Kilo"></label>
      <label class="campo"><span>Categoría</span>
        <select name="categoria_id" data-num><option value="">Sin categoría</option>
          ${cats.map((c) => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select></label>
      <div class="dos">
        <label class="campo"><span>Código (opcional)</span><input name="codigo" value="${esc(p.codigo || '')}"></label>
        <label class="campo"><span>Orden en la lista</span><input name="orden" type="number" inputmode="numeric" value="${p.orden ?? 0}"></label>
      </div>
      <h2 class="sec-t">Precio</h2>
      <div class="dos">
        <label class="campo"><span>Costo (${datos.negocio().moneda === 'VES' ? 'Bs' : '$'})</span><input id="costo" type="text" inputmode="decimal" value="${dec(p.costo)}" placeholder="0,00"></label>
        <label class="campo"><span>Margen (%)</span><input id="margen" type="text" inputmode="decimal" value="${m0 != null ? (m0 * 100).toFixed(1).replace('.', ',') : ''}"></label>
      </div>
      <label class="campo"><span>Precio base (${datos.negocio().moneda === 'VES' ? 'Bs' : '$'})</span><input id="precio" type="text" inputmode="decimal" value="${dec(p.precio)}" placeholder="0,00"></label>
      <p class="ayuda">El precio base se sugiere cuando el cliente nunca ha comprado el producto; si ya lo compró, se sugiere el último precio que se le cobró. En cada pedido se puede cambiar. <span id="ganancia"></span></p>
      <h2 class="sec-t">Stock</h2>
      ${id ? '' : '<label class="campo"><span>Stock inicial en bodega</span><input name="stock_inicial" type="number" inputmode="numeric" placeholder="0"></label>'}
      <label class="campo"><span>Avisar cuando queden disponibles</span><input name="stock_minimo" type="number" inputmode="numeric" min="0" value="${p.stock_minimo ?? ''}" placeholder="Ej.: 5"></label>
      <label class="check"><input name="activo" type="checkbox" ${p.activo !== false ? 'checked' : ''}> Disponible para pedidos</label>
      <p id="err" class="error" role="alert"></p>
      ${admin ? `<div class="pie-fijo ${!id && esEscritorio() ? 'pie-doble' : ''}">${!id && esEscritorio() ? '<button class="btn sec" type="submit" name="otro">Crear y agregar otro</button>' : ''}<button class="btn prin" type="submit">${id ? 'Guardar cambios' : 'Crear producto'}</button></div>` : ''}
    </form>
    ${id && admin ? `
    <form id="ajuste" class="form pad caja">
      <h2 class="sec-t">Mover stock</h2>
      <p class="ayuda">Bodega tiene ${p.stock}. Al registrar una entrega, el stock baja solo.</p>
      <div class="dos">
        <label class="campo"><span>Movimiento</span><select name="tipo"><option value="entrada">Entrada (llegó mercancía)</option><option value="ajuste">Corrección (+/−)</option><option value="conteo">Dejar en una cantidad exacta</option></select></label>
        <label class="campo"><span>Cantidad</span><input name="cant" type="number" inputmode="numeric" required></label>
      </div>
      <button class="btn sec" type="submit">Aplicar</button>
    </form>` : ''}`;

  if (id && admin) {
    v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const caja = $('.prod-foto', v); caja.classList.add('subiendo');
      try { await datos.subirFotoProducto(idDe(id), await prepararFoto(archivo)); aviso('Foto guardada'); listaCambio(); vistaProductoForm(v, id); }
      catch (err) { caja.classList.remove('subiendo'); aviso(err.message, 'error'); }
    }));
    $('#quitar-foto', v)?.addEventListener('click', async () => {
      if (!confirm('¿Quitar la foto de este producto?')) return;
      try { await datos.quitarFotoProducto(idDe(id)); aviso('Foto quitada'); listaCambio(); vistaProductoForm(v, id); }
      catch (err) { aviso(err.message, 'error'); }
    });
  }

  const costo = $('#costo', v), mg = $('#margen', v), precio = $('#precio', v);
  const gan = () => { const c = leerNumero(costo.value) || 0, pr = leerNumero(precio.value); $('#ganancia', v).textContent = pr > 0 ? `Ganancia por cada uno: ${dinero(r2(pr - c))}.` : ''; };
  mg.addEventListener('input', () => {
    const m = (leerNumero(mg.value) || 0) / 100, c = leerNumero(costo.value);
    if (c != null && !Number.isNaN(c) && m < 1) precio.value = num2(precioConMargen(c, m));
    gan();
  });
  const recalc = () => { const m = margen(leerNumero(costo.value) || 0, leerNumero(precio.value) || 0); mg.value = m != null ? (m * 100).toFixed(1).replace('.', ',') : ''; gan(); };
  precio.addEventListener('input', recalc); costo.addEventListener('input', recalc);
  gan();

  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    const err = $('#err', v);
    if (!d.nombre) { err.textContent = 'El nombre es obligatorio.'; return; }
    const c = leerNumero(costo.value), pr = leerNumero(precio.value);
    if (Number.isNaN(c) || Number.isNaN(pr) || (c ?? 0) < 0 || (pr ?? 0) < 0) { err.textContent = 'Revisa el costo y el precio: deben ser números (ej.: 27,50).'; return; }
    d.costo = r2(c ?? 0); d.precio = r2(pr ?? 0); d.orden = d.orden ?? 0;
    if (Number.isNaN(d.categoria_id)) d.categoria_id = null;
    if (d.precio > 0 && d.costo > d.precio && !confirm(`El precio (${dinero(d.precio)}) es menor que el costo (${dinero(d.costo)}). ¿Guardar igual?`)) return;
    try {
      const g = await datos.guardarProducto(id ? { ...d, id: idDe(id) } : d);
      aviso(id ? 'Producto guardado' : 'Producto creado'); listaCambio();
      if (e.submitter?.name === 'otro') { await vistaProductoForm(v, null); $('[name="nombre"]', v)?.focus(); return; }
      ir(id ? '#/inventario' : `#/inventario/${g.id}`);
    } catch (x) { err.textContent = x.message; }
  });

  if (id && admin) $('#ajuste', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = e.target.tipo.value, cant = Math.floor(Number(e.target.cant.value));
    if (!Number.isFinite(cant) || (tipo !== 'conteo' && !cant)) return;
    const delta = tipo === 'conteo' ? cant - p.stock : tipo === 'entrada' ? Math.abs(cant) : cant;
    if (!delta) return aviso('El stock ya está en esa cantidad');
    try { await datos.ajustarStock(idDe(id), delta, tipo === 'entrada' ? 'entrada' : 'ajuste'); aviso(`Stock ${delta > 0 ? '+' : ''}${delta}`); listaCambio(); vistaProductoForm(v, id); }
    catch (x) { aviso(x.message, 'error'); }
  });
}
