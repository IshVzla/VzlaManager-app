// Tomar un pedido en dos pasos:
//  1) elegir productos y cantidades (precio sugerido: el más nuevo entre el último cobrado a este cliente y el precio base);
//  2) pre-verificación: revisar y, si hace falta, cambiar el precio de cada línea; fecha de entrega y notas; generar la nota.
// El pedido queda "por entregar". El stock no baja hasta la entrega.
// Modo COTIZACIÓN (#/clientes/:id/cotizacion): los mismos dos pasos, pero se guarda una cotización con fecha de validez
// (no es una nota: sin número, sin stock, sin ventas). Un pedido abierto con ?cotizacion=<id> trae sus productos y
// precios (si sigue vigente) y, al generarse la nota, la cotización queda marcada como convertida.
import { $, $$, esc, barra, icono, vacio, aviso, ir, dinero, num2, r2, leerNumero, numeroNota, fecha, diaVe, simbolo, idDe } from '../ui.js';
import * as datos from '../datos.js';
import { ciudadActual, ultimaCiudad } from '../ubicacion.js';

const MAX_CANT = 9999;
const DIAS_COT = () => { try { return Math.max(1, Number(localStorage.getItem('vm-cot-dias')) || 3); } catch (_) { return 3; } };   // tope por producto: evita totales imposibles por un error de tipeo

export async function vistaPedido(v, clienteId, modo = 'pedido') {
  const esCot = modo === 'cotizacion';
  const c = await datos.cliente(clienteId);
  if (c.anonimizado_en || c.activo === false) throw new Error(`Este cliente está desactivado: no se le pueden ${esCot ? 'hacer cotizaciones' : 'tomar pedidos'}.`);
  const [prodsTodos, ultimos, negocio] = await Promise.all([datos.productos(), datos.ultimosPrecios(clienteId), datos.configuracion()]);
  let prods = prodsTodos;
  // Editar: ?editar=<id> abre el pedido original. Al generar, la nota original queda anulada y se crea otra que la reemplaza.
  const editarId = new URLSearchParams(location.hash.split('?')[1] || '').get('editar');
  const orig = editarId ? await datos.pedido(editarId) : null;
  if (orig && (!datos.puedeCorregir(orig) || String(orig.cliente_id) !== String(clienteId))) throw new Error('Esta nota no se puede editar.');
  // Pedido a partir de una cotización: ?cotizacion=<id>
  const cotId = esCot || orig ? null : new URLSearchParams(location.hash.split('?')[1] || '').get('cotizacion');
  const cot = cotId ? await datos.cotizacion(cotId) : null;
  if (cot && String(cot.cliente_id) !== String(clienteId)) throw new Error('Esta cotización es de otro cliente.');
  const cotVigente = cot && (!cot.valida_hasta || cot.valida_hasta >= diaVe());
  const base = orig?.items || cot?.items || [];
  for (const i of base) if (!prods.some((p) => p.id === i.producto_id)) prods = [...prods, { id: i.producto_id, nombre: i.nombre, presentacion: i.presentacion, precio: i.precio_base ?? i.precio, stock: 0, disponible: 0, porEntregar: 0 }];

  const idPedido = crypto.randomUUID();   // fijo por pantalla: reintentar no duplica el pedido
  const carro = new Map(base.filter((i) => i.cantidad > 0).map((i) => [i.producto_id, i.cantidad]));    // producto_id → cantidad
  // Precio elegido por línea (pre-verificación). Sugerido: el de la nota original al editar; si no, el más nuevo entre el
  // último cobrado a este cliente y el precio base (ultimosPrecios ya descarta los cobrados antes del último cambio de la base).
  const precioSug = (p) => {
    const o = orig?.items.find((i) => i.producto_id === p.id);
    if (o) return { precio: o.precio, origen: 'nota' };
    const k = cotVigente ? cot.items.find((i) => i.producto_id === p.id) : null;
    if (k) return { precio: k.precio, origen: 'cotizacion' };
    const u = ultimos.get(p.id);
    if (u?.precio > 0) return { precio: u.precio, origen: 'ultimo', fecha: u.fecha };
    return p.precio > 0 ? { precio: p.precio, origen: 'base' } : { precio: null, origen: 'sin' };
  };
  const precios = new Map();   // producto_id → precio elegido (si se cambió en la pre-verificación)
  const precioDe = (p) => (precios.has(p.id) ? precios.get(p.id) : precioSug(p).precio);
  let filtro = '', entrega = orig?.entrega_programada || '', notas = orig?.notas || '', motivo = '';
  let validaHasta = diaVe(new Date(Date.now() + DIAS_COT() * 864e5));
  const titulo = esCot ? 'Nueva cotización' : orig ? `Editar nota N° ${numeroNota(orig.numero)}` : cot ? 'Pedido de la cotización' : 'Nuevo pedido';
  const ivaPct = negocio.iva_activo ? Number(negocio.iva_pct) || 0 : 0;
  const condiciones = c.condiciones_pago || negocio.condiciones_pago;
  // Ciudad de la nota: la del GPS del equipo (se pide al abrir el pedido); si no hay, la última detectada o la del negocio.
  let ciudad = orig?.ciudad || ultimaCiudad() || negocio.ciudad || '', ciudadTocada = !!orig?.ciudad;
  if (!orig?.ciudad) ciudadActual().then((x) => { if (x && !ciudadTocada) { ciudad = x; const i = v.querySelector('#ciudad'); if (i) i.value = x; } });

  const subtotal = () => r2([...carro].reduce((s, [id, n]) => s + n * (precioDe(prods.find((p) => p.id === id)) || 0), 0));
  const iva = () => r2(subtotal() * ivaPct / 100);

  // Salir con productos elegidos (atrás de Android o flecha ←) pide confirmar.
  let guardado = null;
  const confirmarSalida = () => !carro.size || guardado || confirm(`¿Descartar ${esCot ? 'esta cotización' : 'este pedido'}? Se perderán los productos que elegiste.`);
  window.vmConfirmarSalida = { hash: location.hash, fn: confirmarSalida };

  // ---------- Paso 1: productos y cantidades ----------
  function pasoProductos() {
    v.scrollTop = 0;
    barra({ titulo, sub: c.nombre, atras: orig ? `#/notas/${orig.id}` : esCot ? '#/cotizaciones/nueva' : cot ? `#/cotizaciones/${cot.id}` : '#/pedidos/nuevo' });
    v.innerHTML = `
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Buscar producto" value="${esc(filtro)}" aria-label="Buscar producto"></div>
      <div id="lista" class="lista prod"></div>
      <div class="pie-fijo pedido-pie">
        <div class="pedido-total"><p id="unid"></p><p id="tot" class="monto grande"></p></div>
        <button id="sig" class="btn prin">Revisar precios</button>
      </div>`;
    $('#q', v).addEventListener('input', (e) => { filtro = e.target.value.trim(); pintarLista(); });
    $('#sig', v).addEventListener('click', () => { if (carro.size) pasoRevisar(); });
    document.querySelector('#barra a.barra-btn[aria-label="Volver"]')?.addEventListener('click', (e) => { if (!confirmarSalida()) e.preventDefault(); });
    pintarLista();
  }

  function etiquetaPrecio(p) {
    const s = precioSug(p), pr = precioDe(p);
    if (pr == null) return `<span class="txt-ambar">${icono('alerta', 'ico-s')} Sin precio: lo escribes al revisar</span>`;
    const de = s.origen === 'ultimo' ? ' · último a este cliente' : s.origen === 'nota' ? ' · de la nota' : s.origen === 'cotizacion' ? ' · de la cotización' : '';
    return `<span class="monto">${dinero(pr)}</span>${de}`;
  }
  function pintarLista() {
    const n = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const vis = prods.filter((p) => !filtro || n(`${p.nombre} ${p.presentacion || ''}`).includes(n(filtro)));
    $('#lista', v).innerHTML = vis.length ? vis.map((p) => {
      const q = carro.get(p.id) || 0;
      return `<div class="fila prod ${q ? 'sel' : ''}" data-id="${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
          <p class="fila-s">${p.presentacion ? `${esc(p.presentacion)} · ` : ''}${etiquetaPrecio(p)}</p>
          <p class="fila-s">${dispTexto(p)}</p></div>
        <div class="cantidad" role="group" aria-label="Cantidad de ${esc(p.nombre)}">
          <button class="cant-btn" data-d="-1" aria-label="Quitar uno" ${q ? '' : 'disabled'}>${icono('menos')}</button>
          <input class="cant-n" type="number" inputmode="numeric" min="0" value="${q || ''}" placeholder="0" aria-label="Cantidad">
          <button class="cant-btn" data-d="1" aria-label="Agregar uno">${icono('mas')}</button>
        </div></div>`;
    }).join('') : vacio('No hay productos con esa búsqueda');
    $$('.fila.prod', v).forEach((f) => {
      const id = idDe(f.dataset.id);
      const set = (q) => {
        q = Math.max(0, Math.floor(q) || 0);
        const antes = carro.get(id) || 0, p = prods.find((x) => x.id === id);
        if (q > MAX_CANT) { aviso(`Máximo ${MAX_CANT.toLocaleString('es-VE')} por producto. Revisa la cantidad.`, 'error'); q = antes; }
        else if (q > 999 && antes <= 999 && !confirm(`¿Seguro? Estás pidiendo ${q.toLocaleString('es-VE')} de ${p.nombre}.`)) q = antes;
        q ? carro.set(id, q) : carro.delete(id);
        f.classList.toggle('sel', q > 0);
        f.querySelector('.cant-n').value = q || '';
        f.querySelector('[data-d="-1"]').disabled = !q;
        actualizarPie();
      };
      f.querySelectorAll('.cant-btn').forEach((b) => b.addEventListener('click', () => set((carro.get(id) || 0) + Number(b.dataset.d))));
      f.querySelector('.cant-n').addEventListener('change', (e) => set(Number(e.target.value)));
    });
    actualizarPie();
  }
  // Inventario flexible: se informa, nunca bloquea.
  const dispTexto = (p) => (p.disponible > 0 ? `Disponible ${p.disponible}` : `<span class="txt-ambar">Sin disponible${p.porEntregar ? ` · ${p.porEntregar} ya comprometidos` : ''}</span>`);
  function actualizarPie() {
    $('#unid', v).textContent = carro.size ? `${carro.size} producto${carro.size === 1 ? '' : 's'}` : 'Agrega productos';
    $('#tot', v).textContent = dinero(subtotal());
    $('#sig', v).disabled = !carro.size;
  }

  // ---------- Paso 2: pre-verificación de precios ----------
  function pasoRevisar() {
    v.scrollTop = 0;
    barra({ titulo: esCot ? 'Revisar cotización' : orig ? 'Revisar cambios' : 'Revisar precios', sub: c.nombre, atras: null });
    const items = [...carro].map(([id, n]) => ({ p: prods.find((x) => x.id === id), n }));
    v.innerHTML = `
      <button id="volver" class="btn link izq">${icono('atras')} Seguir agregando productos</button>
      <p class="ayuda pad-x">Revisa el precio de cada producto. Puedes cambiarlo: el precio varía según el cliente.</p>
      ${cot && !cotVigente ? `<p class="nota-sin-senal pad-x">${icono('alerta', 'ico-s')} La cotización venció el ${esc(fecha(cot.valida_hasta + 'T12:00:00'))}: se sugieren los precios de hoy.</p>` : ''}
      <div class="lista">${items.map(({ p, n }) => {
        const s = precioSug(p);
        const ref = s.origen === 'ultimo' ? `Último cobrado a este cliente: ${dinero(s.precio)} (${fecha(s.fecha)})`
          : s.origen === 'nota' ? `Precio de la nota original: ${dinero(s.precio)}`
          : s.origen === 'cotizacion' ? `Precio de la cotización: ${dinero(s.precio)}`
          : s.origen === 'base' ? `Precio base: ${dinero(s.precio)}` : 'Este producto no tiene precio base';
        const pr = precioDe(p);
        return `<div class="fila linea-precio" data-id="${p.id}">
          <div class="fila-txt"><p class="fila-t">${esc(p.nombre)}</p>
            <p class="fila-s">${n} × ${esc(p.presentacion || 'unidad')}</p>
            <p class="fila-s ref-precio">${ref}</p>
            <p class="fila-s cambio" hidden></p></div>
          <div class="precio-caja">
            <label class="precio-in"><span class="sr">Precio unitario de ${esc(p.nombre)}</span><span aria-hidden="true">${simbolo()}</span>
              <input type="text" inputmode="decimal" autocomplete="off" value="${pr != null ? num2(pr) : ''}" placeholder="0,00"></label>
            <span class="monto sub">${pr != null ? dinero(r2(n * pr)) : '—'}</span>
          </div></div>`;
      }).join('')}</div>
      ${datos.hayRed() ? '' : `<p class="nota-sin-senal pad-x">${icono('sinNube', 'ico-s')} Sin señal: ${esCot ? 'la cotización' : 'el pedido'} se guarda en el equipo y se sube solo cuando vuelva la señal.</p>`}
      <div class="form pad">
        <label class="campo"><span>${esCot ? 'Ciudad' : 'Ciudad de la nota'}</span>
          <input id="ciudad" type="text" maxlength="60" value="${esc(ciudad)}" placeholder="Ej.: Valencia"></label>
        <p class="ayuda">Se toma de la ubicación del equipo. Puedes cambiarla.</p>
        ${esCot ? `<label class="campo"><span>Válida hasta</span>
          <input id="valida" type="date" min="${diaVe()}" value="${esc(validaHasta)}" required></label>
        <p class="ayuda">Los precios se respetan hasta esta fecha. No se genera ninguna nota ni se toca el inventario.</p>` : `<label class="campo"><span>Fecha de entrega (opcional)</span>
          <input id="entrega" type="date" min="${diaVe()}" value="${esc(entrega)}"></label>`}
        <label class="campo"><span>${esCot ? 'Notas (opcional)' : 'Notas para la entrega (opcional)'}</span>
          <input id="notas" type="text" maxlength="200" value="${esc(notas)}" placeholder="${esCot ? 'Ej.: sujeto a disponibilidad' : 'Ej.: entregar después de las 2 pm'}"></label>
        ${orig ? `<label class="campo"><span>Motivo del cambio</span>
          <input id="motivo" type="text" maxlength="120" value="${esc(motivo)}" placeholder="Ej.: el cliente agregó productos"></label>
          <p class="ayuda">La nota N° ${numeroNota(orig.numero)} quedará anulada y se generará una nota nueva con otro número.</p>` : ''}
        <p class="ayuda">Condiciones de pago: <b>${esc(condiciones)}</b></p>
      </div>
      <dl class="totales">
        <div><dt>Subtotal</dt><dd id="t-sub" class="monto"></dd></div>
        ${ivaPct ? `<div><dt>IVA ${num2(ivaPct).replace(',00', '')} %</dt><dd id="t-iva" class="monto"></dd></div>` : ''}
        <div class="total"><dt>Total</dt><dd id="t-total" class="monto"></dd></div>
      </dl>
      <p id="err" class="error pad-x" role="alert"></p>
      <div class="pie-fijo"><button id="generar" class="btn prin">${esCot ? 'Guardar cotización' : orig ? 'Generar nota corregida' : 'Generar nota'}</button></div>`;
    const pintarTotales = () => {
      $('#t-sub', v).textContent = dinero(subtotal());
      if (ivaPct) $('#t-iva', v).textContent = dinero(iva());
      $('#t-total', v).textContent = dinero(r2(subtotal() + iva()));
    };
    $$('.linea-precio', v).forEach((f) => {
      const id = idDe(f.dataset.id), p = prods.find((x) => x.id === id), n = carro.get(id);
      const inp = f.querySelector('input');
      inp.addEventListener('input', () => {
        const x = leerNumero(inp.value);
        if (x == null || Number.isNaN(x) || x < 0) { precios.set(id, null); f.querySelector('.sub').textContent = '—'; }
        else { precios.set(id, r2(x)); f.querySelector('.sub').textContent = dinero(r2(n * x)); }
        const s = precioSug(p).precio, pr = precios.get(id);
        const ch = f.querySelector('.cambio');
        ch.hidden = !(pr != null && s != null && pr !== s);
        if (!ch.hidden) ch.innerHTML = `${icono('editar', 'ico-s')} Cambiado: ${pr > s ? 'sube' : 'baja'} ${dinero(Math.abs(r2(pr - s)))} c/u`;
        f.classList.toggle('falta', pr == null);
        pintarTotales();
      });
      inp.addEventListener('blur', () => { const pr = precioDe(p); if (pr != null) inp.value = num2(pr); });
      inp.addEventListener('focus', () => inp.select());
    });
    $('#ciudad', v).addEventListener('input', (e) => { ciudad = e.target.value; ciudadTocada = true; });
    $('#volver', v).addEventListener('click', pasoProductos);
    $('#entrega', v)?.addEventListener('change', (e) => { entrega = e.target.value; });
    $('#valida', v)?.addEventListener('change', (e) => { validaHasta = e.target.value; });
    $('#notas', v).addEventListener('input', (e) => { notas = e.target.value; });
    $('#motivo', v)?.addEventListener('input', (e) => { motivo = e.target.value; });
    $('#generar', v).addEventListener('click', generar);
    pintarTotales();
  }

  // El pedido se guarda una sola vez: si algo falla después, no se repite (se va a la nota).
  async function generar() {
    if (guardado) return;
    const err = $('#err', v), b = $('#generar', v);
    const sinPrecio = [...carro.keys()].map((id) => prods.find((p) => p.id === id)).filter((p) => !(precioDe(p) > 0));
    if (sinPrecio.length) {
      err.textContent = `Escribe el precio de: ${sinPrecio.map((p) => p.nombre).join(', ')}.`;
      v.querySelector(`.linea-precio[data-id="${sinPrecio[0].id}"] input`)?.focus();
      return;
    }
    if (orig && !motivo.trim()) { err.textContent = 'Escribe el motivo del cambio.'; $('#motivo', v).focus(); return; }
    if (esCot && (!validaHasta || validaHasta < diaVe())) { err.textContent = 'Elige hasta qué fecha es válida la cotización (hoy o después).'; $('#valida', v).focus(); return; }
    const texto = b.textContent;
    b.disabled = true; b.textContent = esCot ? 'Guardando…' : 'Generando…';
    const bloqueo = $$('#volver, .linea-precio input, #ciudad, #entrega, #valida, #notas, #motivo', v);
    bloqueo.forEach((x) => { x.disabled = true; });
    const items = [...carro].map(([id, n]) => { const p = prods.find((x) => x.id === id); return { producto_id: id, cantidad: n, precio: precioDe(p), nombre: p.nombre, presentacion: p.presentacion || null }; });
    const datosPedido = { id: idPedido, cliente_id: idDe(clienteId), items, entrega_programada: entrega || null, notas: notas.trim() || null,
      condiciones_pago: c.condiciones_pago || null, ciudad: ciudad.trim() || negocio.ciudad || null };
    const resumen = { cliente: c.nombre, subtotal: subtotal(), iva_pct: ivaPct, iva: iva(), total: r2(subtotal() + iva()) };
    try {
      if (esCot) {
        const { entrega_programada: _e, ...resto } = datosPedido;
        guardado = await datos.crearCotizacion({ ...resto, valida_hasta: validaHasta });
        try { localStorage.setItem('vm-cot-dias', String(Math.max(1, Math.round((Date.parse(validaHasta) - Date.parse(diaVe())) / 864e5)))); } catch (_) {}
      } else guardado = orig ? await datos.reemplazarPedido(orig.id, motivo.trim(), datosPedido) : await datos.crearPedido(datosPedido, resumen);
    } catch (e) {
      err.textContent = e.message;
      b.disabled = false; b.textContent = texto;
      bloqueo.forEach((x) => { x.disabled = false; });
      return;
    }
    if (esCot) { aviso(guardado.porSubir ? 'Cotización guardada en el equipo · se sube al volver la señal' : 'Cotización guardada'); ir(`#/cotizaciones/${guardado.id}?nueva=1`); return; }
    if (cot) await datos.cotizacionAPedido(cot.id, guardado.id).catch(() => {});
    aviso(orig ? `Nota N° ${numeroNota(guardado.numero)} generada · reemplaza a la N° ${numeroNota(orig.numero)}`
      : guardado.porSubir ? 'Pedido guardado en el equipo · se sube al volver la señal' : `Nota N° ${numeroNota(guardado.numero)} generada`);
    ir(`#/notas/${guardado.id}?nueva=1`);
  }

  pasoProductos();
}
