// Clientes: lista, ficha (datos, pedidos y foto) y formulario. Los datos fiscales salen en la nota (talonario).
import { $, esc, barra, icono, vacio, leerForm, aviso, ir, dinero, r2, fecha, numeroNota, selectorVista, activarSelector, idDe, num2, bs } from '../ui.js';
import * as datos from '../datos.js';
import { prepararFoto } from '../fotos.js';
import { listaCambio, esEscritorio, tabla } from '../escritorio.js';
import { chipEstado } from '../estado.js';
import { iniciales } from './pedidos.js';

let ultimaBusqueda = '';
const ordenTabla = { k: 'debe', dir: 'desc' };
let filtro = 'activos';          // 'activos' (los que deben, primero) | 'debe' | 'desactivados'
const pestanaDe = new Map();      // pestaña abierta en la ficha de cada cliente
const haceDias = (f) => { if (!f) return null; const d = Math.round((Date.now() - Date.parse(f)) / 864e5); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };

const avatar = (c, cls = '') => (c.imagen_url
  ? `<img class="avatar foto ${cls}" src="${esc(c.imagen_url)}" alt="" loading="lazy">`
  : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>`);

export async function vistaClientes(v) {
  barra({ titulo: 'Clientes', accion: datos.esAdmin() ? { href: '#/clientes/nuevo', icono: 'mas', etiqueta: 'Nuevo cliente' } : null });
  v.innerHTML = `
    <div class="inv-cab">
      <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, razón social, RIF o ciudad" value="${esc(ultimaBusqueda)}" aria-label="Buscar cliente"></div>
      ${selectorVista()}
    </div>
    <div id="cuentas"></div>
    <div class="filtros" role="tablist">
      <button class="filtro" data-f="activos" role="tab">Todos <span class="n"></span></button>
      <button class="filtro" data-f="debe" role="tab">Me deben <span class="n"></span></button>
      <button class="filtro" data-f="desactivados" role="tab">Desactivados <span class="n"></span></button>
    </div>
    <p id="cuenta" class="cuenta"></p>
    <div id="lista"></div>`;
  const pintar = async () => {
    const todos = await datos.clientes({ busqueda: ultimaBusqueda, inactivos: true });
    const inact = todos.filter((c) => c.activo === false), act = todos.filter((c) => c.activo !== false);
    const deudores = act.filter((c) => Number(c.por_cobrar) > 0);
    const totalDeben = r2(deudores.reduce((s2, c) => s2 + Number(c.por_cobrar), 0));
    const n = { activos: act.length, debe: deudores.length, desactivados: inact.length };
    v.querySelectorAll('.filtro').forEach((b) => { b.querySelector('.n').textContent = n[b.dataset.f]; b.setAttribute('aria-selected', b.dataset.f === filtro); });
    $('#cuentas', v).innerHTML = ultimaBusqueda ? '' : `<div class="resumen">
      <div class="${totalDeben > 0 ? 'alerta' : ''}"><p class="resumen-n monto">${dinero(totalDeben)}</p><p>${deudores.length ? `te deben ${deudores.length} cliente${deudores.length === 1 ? '' : 's'}` : 'nadie te debe'}</p></div>
      <div><p class="resumen-n">${act.length}</p><p>clientes activos</p></div></div>`;
    // Primero los que deben (de mayor a menor), luego el resto por nombre
    const cs = (filtro === 'desactivados' ? inact : filtro === 'debe' ? deudores : act)
      .sort((a, z) => (Number(z.por_cobrar) || 0) - (Number(a.por_cobrar) || 0) || a.nombre.localeCompare(z.nombre, 'es'));
    $('#cuenta', v).textContent = `${cs.length} cliente${cs.length === 1 ? '' : 's'}`;
    const cont = $('#lista', v);
    const debe = (c) => (Number(c.por_cobrar) > 0 ? `<span class="chip cobrar">${icono('dinero', 'ico-s')} Debe ${dinero(c.por_cobrar)}</span>` : '');
    const pend = (c) => (c.pedidos_pendientes ? `<span class="chip pendiente">${icono('camion', 'ico-s')} ${c.pedidos_pendientes} por entregar</span>` : '') + debe(c);
    if (!cs.length) {
      cont.className = '';
      cont.innerHTML = vacio(filtro === 'desactivados' ? 'No hay clientes desactivados' : filtro === 'debe' ? 'Nadie te debe' : ultimaBusqueda ? 'No hay clientes con esa búsqueda' : 'Aún no hay clientes',
        filtro === 'activos' && !ultimaBusqueda && datos.esAdmin() ? 'Crea el primero con el botón +.' : '');
      return;
    }
    if (esEscritorio()) {
      return tabla(cont, { etiqueta: 'Clientes', filas: cs, href: (c) => `#/clientes/${c.id}`, estado: ordenTabla, cols: [
        { k: 'nombre', t: 'Cliente', val: (c) => c.nombre,
          html: (c) => `${avatar(c)}<span class="celda-txt">${esc(c.nombre)}${c.razon_social && c.razon_social !== c.nombre ? `<small>${esc(c.razon_social)}</small>` : ''}</span>` },
        { k: 'rif', t: 'RIF', opc: true, prio2: true, val: (c) => c.rif || '', html: (c) => esc(c.rif || '—') },
        { k: 'ciudad', t: 'Ciudad', opc: true, val: (c) => c.ciudad || '', html: (c) => esc(c.ciudad || '—') },
        { k: 'telefono', t: 'Teléfono', opc: true, prio2: true, val: (c) => c.telefono || '', html: (c) => esc(c.telefono || '—') },
        { k: 'pend', t: 'Por entregar', num: true, prio3: true, val: (c) => c.pedidos_pendientes || 0, html: (c) => (c.pedidos_pendientes ? `${c.pedidos_pendientes}` : '—') },
        { k: 'debe', t: 'Por cobrar', num: true, prio2: true, val: (c) => Number(c.por_cobrar) || 0, html: (c) => (Number(c.por_cobrar) > 0 ? `<span class="monto">${dinero(c.por_cobrar)}</span>` : '—') },
      ] });
    }
    if (vista() === 'iconos') {
      cont.className = 'grilla';
      cont.innerHTML = cs.map((c) => `
        <a class="tarjeta cliente" href="#/clientes/${c.id}">${avatar(c, 'grande')}
          <p class="tarjeta-t">${esc(c.nombre)}</p><p class="tarjeta-s">${esc(c.ciudad || c.rif || '')}</p>${pend(c)}</a>`).join('');
    } else {
      cont.className = 'lista';
      cont.innerHTML = cs.map((c) => {
        const d = Number(c.por_cobrar) || 0, compra = haceDias(c.ultimo_pedido);
        return `<a class="fila cliente-cuenta" href="#/clientes/${c.id}">${avatar(c)}
          <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
            <p class="fila-s">${compra ? `Última compra: ${compra}` : esc([c.rif, c.ciudad].filter(Boolean).join(' · ') || 'Sin compras todavía')}</p>
            ${c.pedidos_pendientes ? `<div class="fila-chip"><span class="chip pendiente">${icono('camion', 'ico-s')} ${c.pedidos_pendientes} por entregar</span></div>` : ''}</div>
          <div class="cola-der">${d > 0 ? `<span class="monto txt-alerta">${dinero(d)}</span><span class="fila-s">debe</span>` : `<span class="monto txt-ok">${dinero(0)}</span><span class="fila-s">al día</span>`}</div></a>`;
      }).join('');
    }
  };
  const vista = activarSelector(v, 'clientes', pintar, 'lista');
  v.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));
  let t;
  $('#q', v).addEventListener('input', (e) => { ultimaBusqueda = e.target.value.trim(); clearTimeout(t); t = setTimeout(pintar, 250); });
  await pintar();
}

export async function vistaCliente(v, id) {
  const [c, peds] = await Promise.all([datos.cliente(id), datos.pedidos({ clienteId: id })]);
  const admin = datos.esAdmin();
  if (c.anonimizado_en) {
    barra({ titulo: c.nombre, sub: 'Datos eliminados', atras: '#/clientes' });
    v.innerHTML = `<div class="nota-falta aviso-inactivo">${icono('alerta', 'ico-s')} Los datos personales de este cliente se eliminaron el ${fecha(c.anonimizado_en)} a su pedido. Sus notas se conservan, sin datos personales. Si vuelve a comprar, créalo como cliente nuevo.</div>
      ${listaPedidos(peds)}`;
    return;
  }
  barra({ titulo: c.nombre, sub: c.ciudad || '', atras: '#/clientes', accion: admin ? { href: `#/clientes/${id}/editar`, icono: 'editar', etiqueta: 'Editar cliente' } : null });
  const dato = (et, val) => (val ? `<div class="dato"><dt>${et}</dt><dd>${val}</dd></div>` : '');
  const tel = (c.telefono || '').replace(/[^\d+]/g, '');
  const wa = tel ? (tel.replace(/^\+/, '').startsWith('58') ? tel.replace(/^\+/, '') : '58' + tel.replace(/^0+/, '')) : '';
  const faltan = [['rif', 'RIF'], ['domicilio_fiscal', 'domicilio fiscal'], ['telefono', 'teléfono']].filter(([k]) => !c[k]).map(([, t]) => t);
  const inactivo = c.activo === false;
  const pendientes = peds.filter((p) => p.estado === 'pendiente');
  const porCobrar = peds.filter((p) => p.estado !== 'anulado' && !p.pagado_en);
  const debe = r2(porCobrar.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const entregadasSinPago = porCobrar.filter((p) => p.estado === 'entregado');
  const pagos = peds.filter((p) => p.pagado_en && p.estado !== 'anulado').sort((a, b) => b.pagado_en.localeCompare(a.pagado_en));
  const pestana = pestanaDe.get(String(id)) || 'resumen';
  // Cobrar: si hay una sola nota por cobrar, va directo a su pago; si hay varias, a la pestaña Notas
  const cobrar = porCobrar.length === 1 ? `#/notas/${porCobrar[0].id}/pago` : null;
  v.innerHTML = `
    ${inactivo ? `<div class="nota-falta aviso-inactivo">${icono('alerta', 'ico-s')} Cliente desactivado: no se le pueden tomar pedidos.</div>` : ''}
    <div class="perfil-cab">
      ${c.imagen_url || !admin ? `<div class="perfil-foto con-foto">${avatar(c, 'grande')}</div>`
        : `<label class="perfil-foto" aria-label="Agregar foto del cliente">${avatar(c, 'grande')}
        <span class="foto-insignia" aria-hidden="true">${icono('camara')}</span><input class="foto-in" type="file" accept="image/*" hidden></label>`}
      <div><p class="fila-t">${esc(c.razon_social || c.nombre)}</p>
        <p class="perfil-s">${esc(c.rif || 'Sin RIF')}${c.ultimo_pedido ? ` · Último pedido ${fecha(c.ultimo_pedido)}` : ''}</p>
        ${pendientes.length ? `<div class="perfil-chips"><span class="chip pendiente">${icono('camion', 'ico-s')} ${pendientes.length} por entregar</span></div>` : ''}</div>
    </div>
    ${c.imagen_url && admin ? '<button type="button" id="quitar-foto" class="btn link quitar">Quitar foto</button>' : ''}
    <div class="cuenta-cab ${debe > 0 ? 'debe' : ''}">
      <div class="fila-txt"><p class="fila-s">${debe > 0 ? 'Te debe' : 'Su cuenta'}</p>
        <p class="monto grande">${debe > 0 ? dinero(debe) : 'Al día'}</p>
        ${debe > 0 ? `<p class="fila-s">${porCobrar.length} nota${porCobrar.length === 1 ? '' : 's'} por cobrar${entregadasSinPago.length ? ` · ${entregadasSinPago.length} ya entregada${entregadasSinPago.length === 1 ? '' : 's'}` : ''}</p>` : ''}</div>
      ${debe > 0 ? (cobrar ? `<a class="btn sec cuenta-btn" href="${cobrar}">${icono('dinero')} Cobrar</a>` : `<button type="button" class="btn sec cuenta-btn" data-ir="notas">${icono('dinero')} Cobrar</button>`) : ''}
    </div>
    <div class="pestanas" role="tablist" aria-label="Secciones del cliente">
      <button type="button" role="tab" data-p="resumen">Resumen</button>
      <button type="button" role="tab" data-p="notas">Notas <span class="n">${peds.length}</span></button>
      <button type="button" role="tab" data-p="pagos">Pagos <span class="n">${pagos.length}</span></button>
    </div>
    <section data-pestana="resumen">
    ${tel ? `<div class="acciones-rap"><a class="btn sec" href="tel:${esc(tel)}">${icono('telefono')} Llamar</a>
      <a class="btn sec" data-externo href="https://wa.me/${esc(wa)}">${icono('whatsapp')} WhatsApp</a></div>` : ''}
    ${faltan.length && admin ? `<a class="nota-falta" href="#/clientes/${id}/editar">Faltan datos para la nota: ${faltan.join(', ')}. Toca para completar.</a>` : ''}

    <h2 class="sec-t">Datos para la nota</h2>
    <dl class="datos">
      ${dato('Nombre o razón social', esc(c.razon_social || c.nombre))}
      ${dato('RIF', esc(c.rif))}
      ${dato('Domicilio fiscal', esc(c.domicilio_fiscal))}
      ${dato('Ciudad', esc(c.ciudad))}
      ${dato('Condiciones de pago', esc(c.condiciones_pago || datos.negocio().condiciones_pago))}
    </dl>
    <h2 class="sec-t">Contacto</h2>
    <dl class="datos">
      ${dato('Persona de contacto', esc(c.contacto))}
      ${dato('Teléfono', esc(c.telefono))}
      ${dato('Correo', esc(c.correo))}
      ${dato('Notas', esc(c.notas))}
      ${!c.contacto && !c.telefono && !c.correo && !c.notas ? '<div class="dato"><dd class="txt-suave">Sin datos de contacto</dd></div>' : ''}
    </dl>
    ${admin ? `<h2 class="sec-t">Datos personales</h2>
    <div class="pad eliminar-datos">
      <button type="button" id="abrir-eliminar" class="btn peligro">Eliminar datos del cliente</button>
      <div id="caja-eliminar" class="form anular" hidden>
        <p class="fila-t">¿Eliminar los datos de ${esc(c.nombre)}?</p>
        <p class="ayuda">Úsalo solo si el cliente lo pide. Se borran su nombre, RIF, domicilio, contacto, teléfono, correo, foto y notas, y queda desactivado. Sus notas y montos se conservan, sin datos personales. <b>No se puede deshacer.</b></p>
        <label class="campo"><span>Para confirmar, escribe <b>eliminar cliente</b></span>
          <input id="frase-eliminar" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="eliminar cliente"></label>
        <p id="err-eliminar" class="error" role="alert"></p>
        <div class="fila-botones"><button type="button" id="cancelar-eliminar" class="btn sec">Cancelar</button>
          <button type="button" id="confirmar-eliminar" class="btn peligro sin-margen" disabled>Eliminar datos</button></div>
      </div>
    </div>` : ''}
    </section>
    <section data-pestana="notas">${listaPedidos(peds)}</section>
    <section data-pestana="pagos">${pagos.length ? `<div class="lista lista-pestana">${pagos.map((p) => `
      <a class="fila" href="#/notas/${p.id}"><div class="fila-txt"><p class="fila-t">${esc(p.forma_pago || 'Pago')} · nota N° ${numeroNota(p.numero)}</p>
        <p class="fila-s">${fecha(p.pagado_en)}${p.tasa_bcv ? ` · tasa ${num2(p.tasa_bcv)} · ${bs(p.monto_bs)}` : ''}${p.referencia_pago ? ` · ref. ${esc(p.referencia_pago)}` : ''}</p></div>
        <span class="monto">${dinero(p.total)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio('Todavía no hay pagos', 'Los pagos aparecen aquí al registrarlos en cada nota.')}</section>
    ${inactivo ? (admin ? '<div class="pie-fijo"><button id="reactivar" class="btn prin">Reactivar cliente</button></div>' : '')
      : `<div class="pie-fijo"><a class="btn prin" href="#/clientes/${id}/pedido">${icono('mas')} Nuevo pedido</a></div>`}`;

  const verPestana = (k) => {
    pestanaDe.set(String(id), k);
    v.querySelectorAll('.pestanas [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.p === k)));
    v.querySelectorAll('section[data-pestana]').forEach((x) => { x.hidden = x.dataset.pestana !== k; });
  };
  v.querySelectorAll('.pestanas [role="tab"]').forEach((b) => b.addEventListener('click', () => verPestana(b.dataset.p)));
  v.querySelector('[data-ir="notas"]')?.addEventListener('click', () => verPestana('notas'));
  verPestana(pestana);
  $('#reactivar', v)?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await datos.guardarCliente({ id: idDe(id), activo: true }); aviso('Cliente reactivado'); listaCambio(); vistaCliente(v, id); }
    catch (err) { e.target.disabled = false; aviso(err.message, 'error'); }
  });
  const caja = $('#caja-eliminar', v), pie = $('.pie-fijo', v);
  $('#abrir-eliminar', v)?.addEventListener('click', (e) => {
    e.currentTarget.hidden = true; caja.hidden = false; if (pie) pie.hidden = true;
    caja.scrollIntoView({ block: 'center' }); $('#frase-eliminar', v).focus();
  });
  const fraseOk = () => ($('#frase-eliminar', v)?.value || '').trim().replace(/\s+/g, ' ').toLowerCase() === 'eliminar cliente';
  $('#frase-eliminar', v)?.addEventListener('input', () => { $('#confirmar-eliminar', v).disabled = !fraseOk(); });
  $('#cancelar-eliminar', v)?.addEventListener('click', () => {
    caja.hidden = true; $('#abrir-eliminar', v).hidden = false; if (pie) pie.hidden = false;
    $('#frase-eliminar', v).value = ''; $('#confirmar-eliminar', v).disabled = true;
  });
  $('#confirmar-eliminar', v)?.addEventListener('click', async (e) => {
    if (!fraseOk()) return;
    e.currentTarget.disabled = true;
    try { await datos.eliminarDatosCliente(id); aviso('Datos del cliente eliminados'); listaCambio(); vistaCliente(v, id); }
    catch (err) { e.currentTarget.disabled = false; $('#err-eliminar', v).textContent = err.message; }
  });
  activarFoto(v, id, () => vistaCliente(v, id));
}

function listaPedidos(peds) {
  return `${peds.length ? `<div class="lista lista-pestana">${peds.slice(0, 30).map((p) => `
      <a class="fila" href="#/notas/${p.id}"><div class="fila-txt"><p class="fila-t">Nota N° ${numeroNota(p.numero)}</p>
        <p class="fila-s">${fecha(p.fecha)}</p><div class="fila-chip">${chipEstado(p, { corto: true })}</div></div>
        <span class="monto ${p.estado === 'anulado' ? 'tachado' : ''}">${dinero(p.total)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : '<p class="texto-suave pad-x">Aún sin pedidos.</p>'}`;
}

function activarFoto(v, id, alTerminar) {
  v.querySelectorAll('.foto-in').forEach((inp) => inp.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const caja = $('.perfil-foto', v);
    caja?.classList.add('subiendo');
    try { await datos.subirFotoCliente(idDe(id), await prepararFoto(archivo)); aviso('Foto guardada'); listaCambio(); alTerminar(); }
    catch (err) { caja?.classList.remove('subiendo'); aviso(err.message, 'error'); }
  }));
  $('#quitar-foto', v)?.addEventListener('click', async () => {
    if (!confirm('¿Quitar la foto de este cliente?')) return;
    try { await datos.quitarFotoCliente(idDe(id)); aviso('Foto quitada'); listaCambio(); alTerminar(); }
    catch (err) { aviso(err.message, 'error'); }
  });
}

export async function vistaClienteForm(v, id) {
  const c = id ? await datos.cliente(id) : { activo: true };
  const paraCotizacion = !id && /[?&]cotizacion=1/.test(location.hash);
  const paraPedido = !id && (paraCotizacion || /[?&]pedido=1/.test(location.hash));
  barra({ titulo: id ? 'Editar cliente' : 'Nuevo cliente', atras: id ? `#/clientes/${id}` : paraCotizacion ? '#/cotizaciones/nueva' : paraPedido ? '#/pedidos/nuevo' : '#/clientes' });
  const neg = datos.negocio();
  const campo = (name, et, opt = {}) => `<label class="campo"><span>${et}</span>
    <input name="${name}" value="${esc(c[name] ?? '')}" ${opt.tipo ? `type="${opt.tipo}"` : ''} ${opt.im ? `inputmode="${opt.im}"` : ''} ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ''} ${opt.auto ? `autocapitalize="${opt.auto}"` : ''}></label>`;
  v.innerHTML = `
    <form id="f" class="form pad" novalidate>
      <h2 class="sec-t">Cliente</h2>
      ${campo('nombre', 'Nombre comercial', { ph: 'Ej.: Abasto La Esquina' })}
      <h2 class="sec-t">Datos para la nota</h2>
      ${campo('razon_social', 'Nombre o razón social', { ph: 'Ej.: Inversiones La Esquina, C.A.' })}
      ${campo('rif', 'RIF', { ph: 'J-12345678-9', auto: 'characters' })}
      ${campo('domicilio_fiscal', 'Domicilio fiscal')}
      ${campo('ciudad', 'Ciudad', { ph: neg.ciudad || 'Ej.: Valencia' })}
      ${campo('condiciones_pago', 'Condiciones de pago', { ph: `Vacío = ${neg.condiciones_pago || 'las del negocio'}` })}
      <h2 class="sec-t">Contacto</h2>
      ${campo('contacto', 'Persona de contacto')}
      ${campo('telefono', 'Teléfono / WhatsApp', { tipo: 'tel', im: 'tel', ph: '0414-1234567' })}
      ${campo('correo', 'Correo', { tipo: 'email', im: 'email' })}
      <label class="campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Horario de recepción, referencias…">${esc(c.notas || '')}</textarea></label>
      ${id ? `<label class="check"><input name="activo" type="checkbox" ${c.activo !== false ? 'checked' : ''}> Cliente activo</label>
      <p class="ayuda">Si lo desactivas no se le pueden tomar pedidos, pero queda guardado en Clientes → Desactivados.</p>` : ''}
      <p id="err" class="error" role="alert"></p>
      <div class="pie-fijo ${!id && esEscritorio() && !paraPedido ? 'pie-doble' : ''}">${!id && esEscritorio() && !paraPedido ? '<button class="btn sec" type="submit" name="otro">Crear y agregar otro</button>' : ''}<button class="btn prin" type="submit">${id ? 'Guardar cambios' : paraCotizacion ? 'Crear y hacer cotización' : paraPedido ? 'Crear y tomar pedido' : 'Crear cliente'}</button></div>
    </form>`;
  $('#f', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = leerForm(e.target);
    if (!d.nombre) { $('#err', v).textContent = 'El nombre comercial es obligatorio.'; $('[name="nombre"]', v).focus(); return; }
    if (d.rif) d.rif = d.rif.toUpperCase().replace(/\s+/g, '');
    if (!id) d.activo = true;
    try {
      const g = await datos.guardarCliente(id ? { ...d, id: idDe(id) } : d);
      aviso(id ? 'Cliente guardado' : 'Cliente creado'); listaCambio();
      if (e.submitter?.name === 'otro') { await vistaClienteForm(v, null); $('[name="nombre"]', v)?.focus(); return; }
      ir(paraPedido ? `#/clientes/${g.id}/${paraCotizacion ? 'cotizacion' : 'pedido'}` : `#/clientes/${g.id}`);
    } catch (err) { $('#err', v).textContent = err.message; }
  });
}
