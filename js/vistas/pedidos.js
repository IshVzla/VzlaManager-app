// Pedidos: pantalla de inicio. Lo por entregar primero; también lo por cobrar, lo pagado, lo anulado y todo.
// "Nuevo pedido" lleva a elegir el cliente y de ahí a tomar el pedido.
import { $, esc, barra, icono, vacio, dinero, fecha, numeroNota } from '../ui.js';
import * as datos from '../datos.js';
import { chipEstado, atrasado, porCobrar } from '../estado.js';

const FILTROS = [['pendiente', 'Por entregar'], ['cobrar', 'Por cobrar'], ['pagado', 'Pagadas'], ['anulado', 'Anuladas'], ['', 'Todas']];
const enFiltro = (p, k) => (!k ? true : k === 'cobrar' ? p.estado === 'entregado' && porCobrar(p) : k === 'pagado' ? !!p.pagado_en && p.estado !== 'anulado' : p.estado === k);
let estado = { filtro: 'pendiente', q: '' };
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function vistaPedidos(v) {
  barra({ titulo: 'Pedidos', accion: { href: '#/pedidos/nuevo', icono: 'mas', etiqueta: 'Nuevo pedido' } });
  const todos = await datos.pedidos();
  v.innerHTML = `
    <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Cliente o número de nota" value="${esc(estado.q)}" aria-label="Buscar pedido"></div>
    <div class="filtros" role="tablist">${FILTROS.map(([k, t]) => `<button class="filtro" data-f="${k}" role="tab">${t} <span class="n"></span></button>`).join('')}</div>
    <div id="resumen"></div>
    <div id="lista"></div>
    <div class="pie-fijo"><a class="btn prin" href="#/pedidos/nuevo">${icono('mas')} Nuevo pedido</a></div>`;
  const pintar = () => {
    const b = normal(estado.q);
    const buscados = todos.filter((p) => !b || normal(`${p.cliente} ${numeroNota(p.numero)} ${p.numero}`).includes(b));
    v.querySelectorAll('.filtro').forEach((x) => {
      const k = x.dataset.f;
      x.querySelector('.n').textContent = buscados.filter((p) => enFiltro(p, k)).length;
      x.setAttribute('aria-selected', estado.filtro === k);
    });
    const vis = buscados.filter((p) => enFiltro(p, estado.filtro))
      // Por entregar: primero los atrasados y los de entrega más próxima; luego por fecha del pedido
      .sort(estado.filtro === 'pendiente'
        ? (a, z) => (a.entrega_programada || '9999').localeCompare(z.entrega_programada || '9999') || a.fecha.localeCompare(z.fecha)
        : (a, z) => z.fecha.localeCompare(a.fecha));
    const pend = buscados.filter((p) => p.estado === 'pendiente'), cob = buscados.filter((p) => enFiltro(p, 'cobrar'));
    $('#resumen', v).innerHTML = estado.filtro === 'pendiente' && pend.length ? `<div class="resumen">
      <div><p class="resumen-n">${pend.length}</p><p>por entregar</p></div>
      <div><p class="resumen-n monto">${dinero(pend.reduce((s, p) => s + (p.total || 0), 0))}</p><p>en pedidos</p></div>
      ${pend.some(atrasado) ? `<div class="alerta"><p class="resumen-n">${pend.filter(atrasado).length}</p><p>atrasados</p></div>` : ''}</div>`
      : estado.filtro === 'cobrar' && cob.length ? `<div class="resumen">
      <div><p class="resumen-n">${cob.length}</p><p>notas por cobrar</p></div>
      <div><p class="resumen-n monto">${dinero(cob.reduce((s, p) => s + (p.total || 0), 0))}</p><p>por cobrar</p></div></div>` : '';
    $('#lista', v).innerHTML = vis.length ? `<div class="lista">${vis.map((p) => `
      <a class="fila pedido" href="#/notas/${p.id}">
        <div class="fila-txt"><p class="fila-t">${esc(p.cliente)}</p>
          <p class="fila-s">N° ${numeroNota(p.numero)} · ${fecha(p.fecha)}</p>
          <div class="fila-chip">${chipEstado(p)}</div></div>
        <span class="monto ${p.estado === 'anulado' ? 'tachado' : ''}">${dinero(p.total)}</span>${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio(estado.filtro === 'pendiente' && !b ? 'No hay pedidos por entregar' : estado.filtro === 'cobrar' && !b ? 'No hay notas por cobrar' : 'No hay pedidos en este filtro',
        estado.filtro === 'pendiente' && !b ? 'Toma un pedido nuevo con el botón de abajo.' : '');
  };
  $('#q', v).addEventListener('input', (e) => { estado.q = e.target.value.trim(); pintar(); });
  v.querySelectorAll('.filtro').forEach((x) => x.addEventListener('click', () => { estado.filtro = x.dataset.f; pintar(); }));
  pintar();
}

// Paso previo a tomar un pedido: elegir el cliente (o crear uno nuevo).
export async function vistaElegirCliente(v) {
  barra({ titulo: 'Nuevo pedido', sub: 'Elige el cliente', atras: '#/pedidos' });
  const cs = await datos.clientes();
  v.innerHTML = `
    <div class="buscador">${icono('buscar')}<input id="q" type="search" placeholder="Nombre, razón social o RIF" aria-label="Buscar cliente" autofocus></div>
    <div id="lista"></div>
    ${datos.esAdmin() ? `<div class="pie-fijo"><a class="btn sec" href="#/clientes/nuevo?pedido=1">${icono('mas')} Cliente nuevo</a></div>` : ''}`;
  const pintar = (q = '') => {
    const b = normal(q);
    const vis = cs.filter((c) => !b || normal(`${c.nombre} ${c.razon_social || ''} ${c.rif || ''}`).includes(b));
    $('#lista', v).innerHTML = vis.length ? `<div class="lista">${vis.map((c) => `
      <a class="fila" href="#/clientes/${c.id}/pedido">
        <span class="avatar" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
        <div class="fila-txt"><p class="fila-t">${esc(c.nombre)}</p>
          <p class="fila-s">${esc([c.rif, c.ciudad].filter(Boolean).join(' · ') || 'Sin RIF')}${c.pedidos_pendientes ? ` · <span class="txt-ambar">${c.pedidos_pendientes} por entregar</span>` : ''}${c.por_cobrar > 0 ? ` · <span class="txt-alerta">debe ${dinero(c.por_cobrar)}</span>` : ''}</p></div>
        ${icono('derecha', 'ico-chev')}</a>`).join('')}</div>`
      : vacio(cs.length ? 'No hay clientes con esa búsqueda' : 'Aún no hay clientes', datos.esAdmin() ? 'Crea el cliente con el botón de abajo.' : '');
  };
  $('#q', v).addEventListener('input', (e) => pintar(e.target.value.trim()));
  pintar();
}
export const iniciales = (n) => String(n || '').split(/\s+/).filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
