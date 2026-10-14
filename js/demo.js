// Modo demostración: datos de ejemplo en memoria (no se guardan ni tocan el servidor).
// Sirve para mostrar la app y para las capturas automáticas de diseño (scripts/capturas.mjs).
import { r2, diaVe } from './ui.js';

const hoy = new Date();
const haceDias = (n, h = 10) => { const d = new Date(hoy); d.setDate(d.getDate() - n); d.setHours(h, 15, 0, 0); return d.toISOString(); };
const enDias = (n) => diaVe(new Date(hoy.getTime() + n * 864e5));
const mismo = (a, b) => String(a) === String(b);
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'd-' + Math.random().toString(16).slice(2));

const cats = [{ id: 1, nombre: 'Tostones', orden: 1 }, { id: 2, nombre: 'Bocadillos', orden: 2 }, { id: 3, nombre: 'Palitos de maíz', orden: 3 }, { id: 4, nombre: 'Aros de papa', orden: 4 }];
const P = (id, nombre, presentacion, categoria_id, precio, stock) => ({ id, codigo: null, nombre, presentacion, categoria_id, costo: r2(precio * 0.8), precio, stock, stock_minimo: 5, orden: id, activo: true, imagen_url: null });
const prods = [
  P(1, 'Tostones 28 g ajo', 'Bulto 8x12', 1, 30, 12), P(2, 'Tostones 28 g natural', 'Bulto 8x12', 1, 30, 4),
  P(3, 'Tostones 80 g ajo', 'Bulto 4x8', 1, 27.5, 20), P(4, 'Tostones 80 g natural', 'Bulto 4x8', 1, 27.5, 6), P(5, 'Tostones 80 g picante', 'Bulto 4x8', 1, 27.5, 0),
  P(6, 'Tostones 140 g ajo', 'Bulto 4x6', 1, 34, 15), P(7, 'Tostones 140 g natural', 'Bulto 4x6', 1, 34, 8), P(8, 'Tostones 140 g picante', 'Bulto 4x6', 1, 34, 2),
  P(9, 'Tostones 270 g ajo', 'Bulto x18', 1, 42, 9), P(10, 'Tostones 270 g natural', 'Bulto x18', 1, 42, 3), P(11, 'Tostones 270 g picante', 'Bulto x18', 1, 42.5, 0),
  P(12, 'Bocadillos de plátano', 'Bulto 28x20', 2, 51, 5), P(13, 'Bocadillos de guayaba', 'Bulto 28x20', 2, 51, 7),
  P(14, 'Palitos de maíz 20 g', 'Bulto 5x10', 3, 15, 10), P(15, 'Palitos de maíz 60 g', 'Bulto 3x8', 3, 17.5, 4),
  P(16, 'Aros de papa 20 g', 'Bulto 5x10', 4, 16, 6), P(17, 'Aros de papa 50 g', 'Bulto 3x8', 4, 18, 11),
];
const C = (id, nombre, razon_social, rif, domicilio_fiscal, ciudad, telefono, contacto = null) =>
  ({ id, nombre, razon_social, rif, domicilio_fiscal, ciudad, telefono, contacto, correo: null, condiciones_pago: null, notas: null, activo: true, imagen_url: null, anonimizado_en: null });
const clis = [
  C(1, 'Abasto La Esquina', 'Inversiones La Esquina, C.A.', 'J-40123456-7', 'Av. Bolívar Norte, local 4', 'Valencia', '0414-555-1201', 'Carmen'),
  C(2, 'Bodegón El Trigal', 'Bodegón El Trigal, C.A.', 'J-41234567-8', 'Urb. El Trigal, calle 3', 'Valencia', '0424-555-3302', 'Luis'),
  C(3, 'Supermercado Las Acacias', 'Comercial Las Acacias, C.A.', 'J-50234567-1', 'Av. Las Acacias con calle 120', 'Valencia', '0412-555-8890'),
  C(4, 'Charcutería Don Pepe', null, 'V-12345678', 'Calle Colombia, Naguanagua', 'Naguanagua', '0416-555-4410', 'José'),
  C(5, 'Minimarket San Diego', 'Minimarket San Diego, C.A.', 'J-31456789-0', 'C.C. San Diego, nivel 1', 'San Diego', '0414-555-7741'),
];
let num = 6;
const L = (pid, cantidad, precio, pedida = cantidad) => { const p = prods.find((x) => x.id === pid); return { producto_id: pid, nombre: p.nombre, presentacion: p.presentacion, cantidad, cantidad_pedida: pedida, precio, precio_base: p.precio, subtotal: r2(cantidad * precio) }; };
const PED = (numero, cliente_id, dias, items, extra = {}) => {
  const subtotal = r2(items.reduce((s, i) => s + i.subtotal, 0));
  return { id: `demo-${numero}`, numero, cliente_id, usuario_id: 'demo', fecha: haceDias(dias), ciudad: 'Valencia', condiciones_pago: 'Contado', notas: null,
    estado: 'pendiente', entrega_programada: null, subtotal, iva_pct: 0, iva: 0, total: subtotal,
    total_pedido: r2(items.reduce((s, i) => s + i.cantidad_pedida * i.precio, 0)), modificado_en_entrega: items.some((i) => i.cantidad !== i.cantidad_pedida), items, ...extra };
};
const peds = [
  PED(1, 1, 9, [L(3, 15, 26.5), L(6, 10, 34), L(12, 2, 51)], { estado: 'entregado', entregado_en: haceDias(6, 15), pagado_en: haceDias(0, 9), forma_pago: 'Pago móvil', tasa_bcv: 182.4, referencia_pago: '004512' }),
  PED(2, 3, 7, [L(9, 5, 42, 4), L(10, 3, 42), L(17, 4, 18), L(16, 2, 16, 0)], { estado: 'entregado', entregado_en: haceDias(3, 11) }),
  PED(3, 2, 5, [L(3, 8, 27.5), L(4, 8, 27.5), L(5, 8, 27.5)], { estado: 'anulado', anulado_motivo: 'El cliente canceló', anulado_en: haceDias(4) }),
  PED(4, 2, 4, [L(3, 8, 27.5), L(4, 6, 27.5), L(13, 2, 51)], { entrega_programada: enDias(1) }),
  PED(5, 4, 1, [L(1, 3, 30), L(14, 4, 15), L(16, 2, 16)]),
  PED(6, 5, 0, [L(6, 6, 33.5), L(7, 4, 33.5), L(8, 4, 33.5), L(11, 5, 42.5)], { entrega_programada: enDias(2) }),
];
for (const p of peds) if (p.tasa_bcv) p.monto_bs = r2(p.total * p.tasa_bcv);

const conCliente = (p) => ({ ...p, cliente: clis.find((c) => c.id === p.cliente_id)?.nombre || '—' });
const porEntregar = () => {
  const m = new Map();
  for (const p of peds.filter((x) => x.estado === 'pendiente')) for (const i of p.items) m.set(i.producto_id, (m.get(i.producto_id) || 0) + i.cantidad);
  return m;
};
const lista = (p) => { const { items, ...r } = conCliente(p); return r; };

const provs = [{ id: 1, nombre: 'Proveedor de ejemplo', rif: 'J-00000001-1', telefono: '0414-000-0001', notas: null, saldo_inicial: 1500, activo: true }];
const compras = [
  { id: 'demo-compra-1', proveedor_id: 1, fecha: enDias(-8), documento: 'F-1180', notas: null, estado: 'vigente', items: [{ id: 1, producto_id: 3, nombre: 'Tostones 80 g ajo', cantidad: 30, costo: 22, subtotal: 660 }, { id: 2, producto_id: 6, nombre: 'Tostones 140 g ajo', cantidad: 20, costo: 27.2, subtotal: 544 }] },
  { id: 'demo-compra-2', proveedor_id: 1, fecha: enDias(-2), documento: 'F-1204', notas: null, estado: 'vigente', items: [{ id: 3, producto_id: 9, nombre: 'Tostones 270 g ajo', cantidad: 10, costo: 33.6, subtotal: 336 }] },
];
for (const c of compras) c.total = r2(c.items.reduce((s, i) => s + i.subtotal, 0));
const abonos = [{ id: 'demo-abono-1', proveedor_id: 1, fecha: enDias(-5), monto: 800, forma_pago: 'Pago móvil', tasa_bcv: 182.4, monto_bs: 145920, referencia: '0091', estado: 'vigente' }];
const deudaDe = (pr) => {
  const comprado = r2(compras.filter((c) => c.proveedor_id === pr.id && c.estado === 'vigente').reduce((s, c) => s + c.total, 0));
  const abonado = r2(abonos.filter((a) => a.proveedor_id === pr.id && a.estado === 'vigente').reduce((s, a) => s + a.monto, 0));
  return { ...pr, comprado, abonado, deuda: r2(pr.saldo_inicial + comprado - abonado) };
};

export const demo = {
  yo: { id: 'demo', nombre: 'Usuario de ejemplo', rol: 'admin' },
  negocio: {
    nombre: 'Distribuidora de Ejemplo', razon_social: 'Distribuidora de Ejemplo, C.A.', rif: 'J-00000000-0',
    domicilio_fiscal: 'Av. Principal, local 1, Valencia, Edo. Carabobo', domicilio_social: '', telefonos: '(0414) 000.00.00',
    ciudad: 'Valencia', distribuidor: 'Distribuidor autorizado', datos_pago: ['Pago móvil: 0102 · J-00000000-0 · 0414-0000000'],
  },

  clientes({ busqueda, inactivos }) {
    const b = normal(busqueda), pe = peds.filter((p) => p.estado === 'pendiente');
    return clis.filter((c) => (inactivos || c.activo) && (!b || normal([c.nombre, c.razon_social, c.rif, c.ciudad].join(' ')).includes(b)))
      .map((c) => ({ ...c, pedidos_pendientes: pe.filter((p) => p.cliente_id === c.id).length,
        por_cobrar: r2(peds.filter((p) => p.cliente_id === c.id && p.estado !== 'anulado' && !p.pagado_en).reduce((s, p) => s + p.total, 0)),
        ultimo_pedido: peds.filter((p) => p.cliente_id === c.id && p.estado !== 'anulado').map((p) => p.fecha).sort().pop() || null }))
      .sort((a, z) => a.nombre.localeCompare(z.nombre, 'es'));
  },
  cliente(id) { const c = this.clientes({ inactivos: true }).find((x) => mismo(x.id, id)); if (!c) throw new Error('No se encontró este cliente.'); return c; },
  guardarCliente(c) {
    if (c.id) { const x = clis.find((k) => mismo(k.id, c.id)); Object.assign(x, c, { id: x.id }); return x; }
    const n = { ...C(Math.max(...clis.map((x) => x.id)) + 1), ...c, activo: c.activo !== false }; clis.push(n); return n;
  },
  anonimizarCliente(id) {
    const c = clis.find((k) => mismo(k.id, id));
    Object.assign(c, { nombre: `Cliente eliminado N° ${c.id}`, razon_social: null, rif: null, domicilio_fiscal: null, ciudad: null, contacto: null, telefono: null, correo: null, notas: null, imagen_url: null, activo: false, anonimizado_en: new Date().toISOString() });
  },

  categorias: () => cats,
  productos({ busqueda = '', soloActivos = true } = {}) {
    const b = normal(busqueda), pe = porEntregar();
    return prods.filter((p) => (!soloActivos || p.activo) && (!b || normal(`${p.nombre} ${p.presentacion}`).includes(b)))
      .map((p) => ({ ...p, categoria: cats.find((c) => c.id === p.categoria_id)?.nombre || null, porEntregar: pe.get(p.id) || 0, disponible: p.stock - (pe.get(p.id) || 0) }));
  },
  producto(id) { const p = this.productos({ soloActivos: false }).find((x) => mismo(x.id, id)); if (!p) throw new Error('No se encontró este producto.'); return p; },
  guardarProducto(p) {
    if (p.id) { const x = prods.find((k) => mismo(k.id, p.id)); const { stock_inicial, ...r } = p; Object.assign(x, r, { id: x.id }); return x; }
    const n = { ...P(Math.max(...prods.map((x) => x.id)) + 1, '', '', null, 0, 0), ...p, stock: p.stock_inicial || 0 }; delete n.stock_inicial; prods.push(n); return n;
  },
  ajustarStock(id, cantidad) { prods.find((k) => mismo(k.id, id)).stock += cantidad; },
  ultimosPrecios(clienteId) {
    const m = new Map();
    for (const p of peds.filter((x) => mismo(x.cliente_id, clienteId) && x.estado !== 'anulado').sort((a, b) => a.fecha.localeCompare(b.fecha)))
      for (const i of p.items) m.set(i.producto_id, { precio: i.precio, fecha: p.fecha });
    return m;
  },

  pedidos({ estado, clienteId }) {
    return peds.filter((p) => (!estado || p.estado === estado) && (!clienteId || mismo(p.cliente_id, clienteId)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)).map(lista);
  },
  pedido(id) {
    const p = peds.find((x) => x.id === id);
    if (!p) throw new Error('No se encontró esta nota.');
    const c = clis.find((k) => k.id === p.cliente_id) || {};
    return { ...conCliente(p), datosCliente: c, items: p.items.map((i) => ({ ...i })),
      reemplazado_por: peds.filter((x) => x.reemplaza_a === p.id).map((x) => ({ id: x.id, numero: x.numero }))[0] || null,
      reemplaza: p.reemplaza_a ? { id: p.reemplaza_a, numero: peds.find((x) => x.id === p.reemplaza_a)?.numero } : null };
  },
  crearPedido(p) {
    const ya = peds.find((x) => x.id === p.id); if (ya) return ya;
    const items = p.items.map((i) => L(i.producto_id, i.cantidad, i.precio));
    const n = { ...PED(num++, Number(p.cliente_id), 0, items), id: p.id, fecha: new Date().toISOString(), notas: p.notas || null,
      condiciones_pago: p.condiciones_pago || 'Contado', entrega_programada: p.entrega_programada || null };
    const iva = this.negocio.iva_activo ? Number(this.negocio.iva_pct) || 0 : 0;
    n.iva_pct = iva; n.iva = r2(n.subtotal * iva / 100); n.total = r2(n.subtotal + n.iva);
    peds.push(n); return n;
  },
  reemplazarPedido(id, motivo, p) {
    const o = peds.find((x) => x.id === id);
    if (o.estado !== 'pendiente' || o.pagado_en) throw new Error('Solo se puede editar un pedido por entregar y sin pagar.');
    this.anularPedido(id, motivo);
    const n = this.crearPedido({ ...p, entrega_programada: p.entrega_programada || o.entrega_programada });
    n.reemplaza_a = id; return n;
  },
  anularPedido(id, motivo) {
    const p = peds.find((x) => x.id === id);
    if (p.estado === 'entregado') for (const i of p.items) prods.find((k) => k.id === i.producto_id).stock += i.cantidad;
    Object.assign(p, { estado: 'anulado', anulado_motivo: motivo, anulado_en: new Date().toISOString() }); return p;
  },
  programarEntrega(id, fecha) { const p = peds.find((x) => x.id === id); p.entrega_programada = fecha || null; return p; },
  registrarEntrega(id, items = null) {
    const p = peds.find((x) => x.id === id);
    if (p.estado === 'entregado') return p;
    if (items) {
      const antes = JSON.stringify(p.items.map((i) => [i.producto_id, i.cantidad, i.precio]));
      for (const i of p.items) if (!items.some((x) => x.producto_id === i.producto_id)) { i.cantidad = 0; i.subtotal = 0; }
      for (const x of items) {
        const i = p.items.find((k) => k.producto_id === x.producto_id);
        if (i) { i.cantidad = x.cantidad; i.precio = x.precio; i.subtotal = r2(x.cantidad * x.precio); }
        else if (x.cantidad > 0) p.items.push(L(x.producto_id, x.cantidad, x.precio, 0));
      }
      if (JSON.stringify(p.items.map((i) => [i.producto_id, i.cantidad, i.precio])) !== antes) {
        p.subtotal = r2(p.items.reduce((s, i) => s + i.subtotal, 0)); p.iva = r2(p.subtotal * p.iva_pct / 100); p.total = r2(p.subtotal + p.iva);
        p.modificado_en_entrega = true;
      }
    }
    for (const i of p.items) if (i.cantidad > 0) prods.find((k) => k.id === i.producto_id).stock -= i.cantidad;
    Object.assign(p, { estado: 'entregado', entregado_en: new Date().toISOString() });
    return p;
  },
  registrarPago(id, pago) {
    const p = peds.find((x) => x.id === id);
    if (!pago.forma_pago) throw new Error('Indica la forma de pago.');
    Object.assign(p, { pagado_en: new Date().toISOString(), forma_pago: pago.forma_pago, tasa_bcv: pago.tasa_bcv ?? null,
      monto_bs: pago.monto_bs ?? (pago.tasa_bcv ? r2(p.total * pago.tasa_bcv) : null), referencia_pago: pago.referencia || null });
    return p;
  },
  notasEntre(campo, desde, hasta) {
    return peds.filter((p) => p.estado !== 'anulado' && p[campo] && diaVe(p[campo]) >= desde && diaVe(p[campo]) <= hasta)
      .sort((a, b) => a[campo].localeCompare(b[campo])).map((p) => ({ ...conCliente(p), items: p.items }));
  },
  porCobrar() { return peds.filter((p) => p.estado !== 'anulado' && !p.pagado_en).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(lista); },
  proveedores() { return provs.map(deudaDe); },
  proveedor(id) {
    const pr = provs.find((x) => mismo(x.id, id)); if (!pr) throw new Error('No se encontró este proveedor.');
    return { ...deudaDe(pr), compras: compras.filter((c) => c.proveedor_id === pr.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).map((c) => ({ ...c, productos: c.items.length })),
      abonos: abonos.filter((a) => a.proveedor_id === pr.id).sort((a, b) => b.fecha.localeCompare(a.fecha)) };
  },
  guardarProveedor(p) {
    if (p.id) { const x = provs.find((k) => mismo(k.id, p.id)); Object.assign(x, p, { id: x.id }); return x; }
    const n = { id: provs.length + 1, saldo_inicial: 0, activo: true, ...p }; provs.push(n); return n;
  },
  compra(id) { const c = compras.find((x) => x.id === id); if (!c) throw new Error('No se encontró esta compra.'); return { ...c, proveedor: provs.find((p) => p.id === c.proveedor_id)?.nombre }; },
  registrarCompra(c) {
    const ya = compras.find((x) => x.id === c.id); if (ya) return ya;
    const items = c.items.map((i, k) => ({ id: k + 1, producto_id: i.producto_id, nombre: prods.find((p) => p.id === i.producto_id).nombre, cantidad: i.cantidad, costo: i.costo, subtotal: r2(i.cantidad * i.costo) }));
    const n = { id: c.id, proveedor_id: Number(c.proveedor_id), fecha: c.fecha || diaVe(), documento: c.documento || null, notas: c.notas || null, estado: 'vigente', items, total: r2(items.reduce((s, i) => s + i.subtotal, 0)) };
    for (const i of items) { const p = prods.find((k) => k.id === i.producto_id); p.stock += i.cantidad; if (c.actualizar_costo !== false) p.costo = i.costo; }
    compras.push(n); return n;
  },
  anularCompra(id, motivo) {
    const c = compras.find((x) => x.id === id); if (c.estado === 'anulada') return c;
    for (const i of c.items) prods.find((k) => k.id === i.producto_id).stock -= i.cantidad;
    Object.assign(c, { estado: 'anulada', anulado_motivo: motivo }); return c;
  },
  registrarAbonoProveedor(a) {
    const ya = abonos.find((x) => x.id === a.id); if (ya) return ya;
    const n = { estado: 'vigente', fecha: diaVe(), ...a, proveedor_id: Number(a.proveedor_id), monto_bs: a.monto_bs ?? (a.tasa_bcv ? r2(a.monto * a.tasa_bcv) : null) };
    abonos.push(n); return n;
  },
  anularAbonoProveedor(id, motivo) { const a = abonos.find((x) => x.id === id); Object.assign(a, { estado: 'anulado', anulado_motivo: motivo }); return a; },
  pendientesConDetalle() { return peds.filter((p) => p.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => ({ ...conCliente(p), items: p.items })); },
};
