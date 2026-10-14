// Diseño de pantalla grande (tablet horizontal o PC): se activa solo según el tamaño de la pantalla.
// Menú lateral, contenido centrado y, en Clientes e Inventario, lista y ficha lado a lado.
// En el celular no cambia nada: todo depende de la clase `escritorio` del <body>.
import { esc } from './ui.js';

// Cuál diseño usar:
// - Con mouse (PC o notebook, aunque tenga zoom o pantalla chica): pantalla grande desde 768 px.
// - Pantalla táctil (celular, tablet; también la app Android): pantalla grande desde 1024 px (tablet horizontal).
const cap = window.Capacitor;
export const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const conMouse = matchMedia('(pointer: fine) and (hover: hover) and (min-width: 768px)');
const ancho = matchMedia('(min-width: 1024px)');
let actual = null;
export const esEscritorio = () => conMouse.matches || ancho.matches;
// Lista y ficha lado a lado solo con espacio suficiente (1024 px); más angosto, la ficha abre en su propia pantalla.
export const puedeDividir = () => esEscritorio() && ancho.matches;
const aplicar = () => {
  const e = `${esEscritorio()}|${puedeDividir()}`;
  document.body.classList.toggle('escritorio', esEscritorio());
  if (actual !== null && e !== actual) window.dispatchEvent(new Event('vm:escritorio'));
  actual = e;
};
aplicar();
conMouse.addEventListener('change', aplicar);
ancho.addEventListener('change', aplicar);

// Avisa que cambió un dato de la lista (producto o cliente guardado) para refrescarla.
export const listaCambio = () => window.dispatchEvent(new Event('vm:lista'));

// Tabla ordenable. Cada columna: { k, t (título), html(fila), val(fila) para ordenar, num (alinear a la derecha),
// opc (se oculta cuando hay una ficha abierta al lado) }. La primera columna lleva el enlace a la ficha.
// estado: { k, dir } se guarda en la vista que llama, para recordar el orden.
export function tabla(cont, { cols, filas, href, estado, etiqueta }) {
  const col = cols.find((c) => c.k === estado.k) || cols[0];
  const val = (f) => { const x = (col.val || col.html)(f); return x == null ? '' : x; };
  const orden = [...filas].sort((a, b) => {
    const x = val(a), y = val(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
    return estado.dir === 'desc' ? -r : r;
  });
  const flecha = (c) => (c.k === col.k ? `<span class="orden" aria-hidden="true">${estado.dir === 'desc' ? '▼' : '▲'}</span>` : '');
  const sort = (c) => (c.k === col.k ? (estado.dir === 'desc' ? 'descending' : 'ascending') : 'none');
  const clase = (c) => [c.num && 'num', c.opc && 'opc', c.prio2 && 'opc2', c.prio3 && 'opc3'].filter(Boolean).join(' ');
  cont.className = 'tabla-caja';
  cont.innerHTML = `<table class="tabla" aria-label="${esc(etiqueta)}">
    <thead><tr>${cols.map((c) => `<th class="${clase(c)}" aria-sort="${sort(c)}" scope="col"><button type="button" data-k="${c.k}">${esc(c.t)}${flecha(c)}</button></th>`).join('')}</tr></thead>
    <tbody>${orden.map((f) => `<tr data-href="${esc(href(f))}">${cols.map((c, i) => `<td class="${clase(c)}${i === 0 ? ' celda-prin' : ''}">${i === 0 ? `<a href="${esc(href(f))}">${c.html(f)}</a>` : c.html(f)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
  cont.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
    if (estado.k === b.dataset.k) estado.dir = estado.dir === 'desc' ? 'asc' : 'desc';
    else { estado.k = b.dataset.k; estado.dir = (cols.find((c) => c.k === b.dataset.k).num ? 'desc' : 'asc'); }
    tabla(cont, { cols, filas, href, estado, etiqueta });
    marcarActual(cont);
  }));
  // Toda la fila abre la ficha (la primera celda es el enlace, para teclado y lectores de pantalla)
  cont.querySelector('tbody').addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, select')) return;
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.hash = tr.dataset.href;
  });
  marcarActual(cont);
}

// Resalta en la lista el elemento cuya ficha está abierta.
export function marcarActual(raiz) {
  const actual = '#' + (location.hash.slice(1).split('?')[0].match(/^\/\w+\/(\d+|nuevo)/)?.[0] || '');
  raiz.querySelectorAll('tr[data-href], a.fila, a.tarjeta').forEach((x) => {
    const h = x.dataset.href || x.getAttribute('href');
    if (h === actual) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
  });
}
