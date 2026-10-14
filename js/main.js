// Arranque y enrutador de la app (rutas con #/...).
import { $, $$, barra, ir, esc, desviarBarra, icono } from './ui.js';
import * as datos from './datos.js';
import { vistaLogin } from './vistas/login.js';
import { vistaPedidos, vistaElegirCliente } from './vistas/pedidos.js';
import { vistaPedido } from './vistas/pedido.js';
import { vistaNota, vistaEntrega, vistaPago } from './vistas/nota.js';
import { vistaProveedores, vistaProveedor, vistaProveedorForm, vistaCompraNueva, vistaCompra, vistaAbonoProveedor } from './vistas/proveedor.js';
import { vistaClientes, vistaCliente, vistaClienteForm } from './vistas/clientes.js';
import { vistaInventario, vistaProductoForm } from './vistas/inventario.js';
import { vistaReportes, vistaPorEntregar, vistaVentas, vistaCobros, vistaPorCobrar, vistaPedidoProveedor } from './vistas/reportes.js';
import { vistaImpresoras } from './vistas/impresoras.js';
import { vistaAjustes } from './vistas/ajustes.js';
import { vistaNegocio } from './vistas/negocio.js';
import { vistaAvanzado } from './vistas/avanzado.js';
import { vistaPendientes } from './vistas/pendientes.js';
import { revisarActualizacion } from './actualizacion.js';
import { puedeDividir, marcarActual } from './escritorio.js';
import './externo.js';
import { invitarApp } from './abrir-app.js';
import './atras.js';

export const INICIO = '#/pedidos';
const RUTAS = [
  [/^\/login$/, vistaLogin, null],
  [/^\/pedidos$/, vistaPedidos, 'pedidos'],
  [/^\/pedidos\/nuevo$/, vistaElegirCliente, 'pedidos'],
  [/^\/notas\/([\w-]+)\/entrega$/, vistaEntrega, 'pedidos'],
  [/^\/notas\/([\w-]+)\/pago$/, vistaPago, 'pedidos'],
  [/^\/notas\/([\w-]+)$/, vistaNota, 'pedidos'],
  [/^\/clientes$/, vistaClientes, 'clientes'],
  [/^\/clientes\/nuevo$/, (v) => vistaClienteForm(v, null), 'clientes'],
  [/^\/clientes\/(\d+)\/editar$/, (v, id) => vistaClienteForm(v, id), 'clientes'],
  [/^\/clientes\/(\d+)\/pedido$/, vistaPedido, 'pedidos'],
  [/^\/clientes\/(\d+)$/, vistaCliente, 'clientes'],
  [/^\/inventario$/, vistaInventario, 'inventario'],
  [/^\/inventario\/nuevo$/, (v) => vistaProductoForm(v, null), 'inventario'],
  [/^\/inventario\/(\d+)$/, (v, id) => vistaProductoForm(v, id), 'inventario'],
  [/^\/proveedores$/, vistaProveedores, 'proveedor'],
  [/^\/proveedores\/nuevo$/, (v) => vistaProveedorForm(v, null), 'proveedor'],
  [/^\/proveedores\/(\d+)\/editar$/, (v, id) => vistaProveedorForm(v, id), 'proveedor'],
  [/^\/proveedores\/(\d+)\/compra$/, vistaCompraNueva, 'proveedor'],
  [/^\/proveedores\/(\d+)\/abono$/, vistaAbonoProveedor, 'proveedor'],
  [/^\/proveedores\/(\d+)$/, (v, id) => vistaProveedor(v, id), 'proveedor'],
  [/^\/compras\/([\w-]+)$/, vistaCompra, 'proveedor'],
  [/^\/reportes$/, vistaReportes, 'reportes'],
  [/^\/reportes\/por-cobrar$/, vistaPorCobrar, 'reportes'],
  [/^\/reportes\/pedido-proveedor$/, vistaPedidoProveedor, 'reportes'],
  [/^\/reportes\/por-entregar$/, vistaPorEntregar, 'reportes'],
  [/^\/reportes\/ventas$/, vistaVentas, 'reportes'],
  [/^\/reportes\/cobros$/, vistaCobros, 'reportes'],
  [/^\/ajustes$/, vistaAjustes, 'ajustes'],
  [/^\/negocio$/, vistaNegocio, 'ajustes'],
  [/^\/ajustes\/avanzado$/, vistaAvanzado, 'ajustes'],
  [/^\/ajustes\/impresoras$/, vistaImpresoras, 'ajustes'],
  [/^\/pendientes$/, vistaPendientes, 'ajustes'],
];

let sesion = false;
let rutaAnterior = null, tabAnterior = null;

function direccion(ruta, tab) {
  if (rutaAnterior === null) return 'inicio';
  if (tab !== tabAnterior) return 'tab';
  const prof = (r) => r.split('/').filter(Boolean).length;
  return prof(ruta) > prof(rutaAnterior) ? 'adelante' : prof(ruta) < prof(rutaAnterior) ? 'atras' : 'tab';
}
function animar(vista, dir) {
  vista.classList.remove('anim-adelante', 'anim-atras', 'anim-tab', 'anim-inicio', 'animando');
  void vista.offsetWidth;
  vista.classList.add('anim-' + dir, 'animando');
  clearTimeout(vista._anim);
  vista._anim = setTimeout(() => vista.classList.remove('animando'), 700);
}

// Cada pantalla tiene su turno: si se abre otra antes de que termine de cargar, la anterior se descarta.
let turno = 0;
async function mostrar() {
  const mio = ++turno;
  const ruta = (location.hash || INICIO).slice(1).split('?')[0];
  if (!sesion && ruta !== '/login') return ir('#/login');
  if (sesion && ruta === '/login') return ir(INICIO);
  const ok = RUTAS.find(([re]) => re.test(ruta));
  if (!ok) return ir(INICIO);
  const [re, fn, tab] = ok;
  const params = ruta.match(re).slice(1);
  document.body.dataset.tab = tab || '';
  const u = sesion ? datos.usuario() : null;
  $('#tabs-usuario').textContent = u ? u.nombre : '';
  $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  let vista = $('#vista');
  const fam = puedeDividir() ? FAMILIAS.find((f) => f.lista.test(ruta) || f.ficha.test(ruta)) : null;
  if (fam) {
    rutaAnterior = ruta; tabAnterior = tab;
    try { await mostrarDividida(vista, fam, ruta, fn, params); }
    catch (e) { if (mio !== turno) return; console.error(e); $('#panel-ficha')?.replaceChildren(); vista.innerHTML = errorHtml(e); }
    return;
  }
  const nueva = vista.cloneNode(false);
  nueva.className = 'vista';
  vista.replaceWith(nueva);
  vista = nueva;
  vista.innerHTML = '<div class="cargando" aria-label="Cargando"></div>';
  const dir = direccion(ruta, tab);
  rutaAnterior = ruta; tabAnterior = tab;
  try {
    await fn(vista, ...params);
    if (mio === turno) animar(vista, dir);
  } catch (e) {
    if (mio !== turno) return;
    console.error(e);
    barra({ titulo: 'Algo salió mal', atras: INICIO });
    vista.innerHTML = errorHtml(e);
  }
}
const errorHtml = (e) => `<div class="vacio"><p class="vacio-t">No se pudo cargar esta pantalla</p><p>${esc(e.message)}</p>
  <button class="btn sec" onclick="location.reload()">Reintentar</button></div>`;

// ---------- Pantalla grande: lista y ficha lado a lado (Clientes e Inventario) ----------
const FAMILIAS = [
  { nombre: 'inventario', lista: /^\/inventario$/, ficha: /^\/inventario\/(nuevo|\d+)$/, fnLista: vistaInventario },
  { nombre: 'clientes', lista: /^\/clientes$/, ficha: /^\/clientes\/(nuevo|\d+)(\/editar)?$/, fnLista: vistaClientes },
];
async function pintarLista(div) {
  const fam = FAMILIAS.find((f) => f.nombre === div.dataset.fam);
  const pl = $('#panel-lista', div), sc = pl.scrollTop, caja = document.createElement('div');
  desviarBarra(caja);
  const listo = fam.fnLista(pl);
  desviarBarra(null);
  await listo;
  pl.scrollTop = sc;
  pl._barra = caja.innerHTML;
  marcarActual(pl);
}
window.addEventListener('vm:lista', () => { const div = document.querySelector('.dividida'); if (div) pintarLista(div).catch(console.error); });

async function mostrarDividida(vista, fam, ruta, fn, params) {
  let div = vista.querySelector(':scope > .dividida');
  const nueva = !div || div.dataset.fam !== fam.nombre;
  const esFicha = fam.ficha.test(ruta);
  if (nueva) {
    vista.innerHTML = `<div class="dividida" data-fam="${fam.nombre}">
      <section id="panel-lista" class="panel-lista" aria-label="Lista"><div class="cargando" aria-label="Cargando"></div></section>
      <section id="panel-ficha" class="panel-ficha" aria-label="Ficha"></section></div>`;
    div = vista.firstElementChild;
  }
  const pl = $('#panel-lista', div);
  let pf = $('#panel-ficha', div);
  if (esFicha) { const n = pf.cloneNode(false); n.className = 'panel-ficha'; pf.replaceWith(n); pf = n; }
  div.classList.toggle('con-ficha', esFicha);
  if (nueva || !esFicha) await pintarLista(div);
  marcarActual(pl);
  if (esFicha) {
    pf.innerHTML = '<div class="cargando" aria-label="Cargando"></div>';
    pf.scrollTop = 0;
    await fn(pf, ...params);
    pf.classList.remove('entra'); void pf.offsetWidth; pf.classList.add('entra');
    if (/\/nuevo$/.test(ruta)) pf.querySelector('input[name="nombre"]')?.focus();
  } else {
    pf.replaceChildren();
    $('#barra').innerHTML = pl._barra || '';
  }
}

// Tecla "/" lleva al buscador; Esc cierra la ficha abierta al lado.
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const q = document.querySelector('#vista .buscador input, #panel-lista .buscador input');
  if (q && q.offsetParent !== null) { e.preventDefault(); q.focus(); q.select(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const div = document.querySelector('.dividida.con-ficha');
  if (div) location.hash = '#/' + div.dataset.fam;
});
window.addEventListener('vm:escritorio', () => { $('#vista').replaceChildren(); mostrar(); });
window.addEventListener('hashchange', mostrar);
window.addEventListener('vm:sesion', (e) => { sesion = e.detail; ir(sesion ? INICIO : '#/login'); });

(async () => {
  try { sesion = await datos.iniciar(); } catch (e) { sesion = false; }
  document.body.classList.toggle('demo', datos.enDemo());
  pintarCinta();
  mostrar();
  revisarActualizacion();
  invitarApp();
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  revisarActualizacion(); if (sesion) datos.sincronizar();
});
window.addEventListener('online', revisarActualizacion);

// Cinta de estado bajo la barra: sin señal y/o pedidos por subir. Toca para ver el detalle.
function pintarCinta() {
  const c = $('#cinta-red');
  const cola = sesion ? datos.colaCompleta() : [];
  const errores = cola.filter((x) => x.estado === 'error').length;
  const sinRed = sesion && !datos.hayRed();
  const n = cola.length;
  c.hidden = !sinRed && !n;
  if (c.hidden) return;
  const pedidos = n ? `${n} pedido${n === 1 ? '' : 's'} por subir` : '';
  c.classList.toggle('problema', !!errores);
  c.innerHTML = `${icono(errores ? 'alerta' : 'sinNube', 'ico-s')}<span>${errores ? `${errores} ${errores === 1 ? 'pedido' : 'pedidos'} con problema · toca para revisar`
    : sinRed ? `Sin señal${n ? ' · ' + pedidos : ' · puedes seguir tomando pedidos'}` : `${pedidos} · toca para subir`}</span>`;
}
window.addEventListener('vm:red', pintarCinta);
window.addEventListener('vm:cola', pintarCinta);
window.addEventListener('vm:sesion', pintarCinta);
window.addEventListener('hashchange', pintarCinta);
setInterval(() => { if (sesion && datos.colaCompleta().length) datos.sincronizar(); }, 60000);
