// Modo demostración: datos de ejemplo en memoria (no se guardan ni tocan el servidor). Usa el mismo motor local
// que el trabajo sin señal (motor.js), así lo que se ve en la demostración se comporta igual que la app real.
// Sirve para mostrar la app y para las capturas automáticas de diseño (scripts/capturas.mjs).
import { r2, diaVe } from './ui.js';
import { crearMotor } from './motor.js';

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

const provs = [{ id: 1, nombre: 'Proveedor de ejemplo', rif: 'J-00000001-1', telefono: '0414-000-0001', notas: null, saldo_inicial: 1500, activo: true }];
const compras = [
  { id: 'demo-compra-1', proveedor_id: 1, fecha: enDias(-8), documento: 'F-1180', notas: null, estado: 'vigente', items: [{ id: 1, producto_id: 3, nombre: 'Tostones 80 g ajo', cantidad: 30, costo: 22, subtotal: 660 }, { id: 2, producto_id: 6, nombre: 'Tostones 140 g ajo', cantidad: 20, costo: 27.2, subtotal: 544 }] },
  { id: 'demo-compra-2', proveedor_id: 1, fecha: enDias(-2), documento: 'F-1204', notas: null, estado: 'vigente', items: [{ id: 3, producto_id: 9, nombre: 'Tostones 270 g ajo', cantidad: 10, costo: 33.6, subtotal: 336 }] },
];
for (const c of compras) c.total = r2(c.items.reduce((s, i) => s + i.subtotal, 0));
const abonos = [{ id: 'demo-abono-1', proveedor_id: 1, fecha: enDias(-5), monto: 800, forma_pago: 'Pago móvil', tasa_bcv: 182.4, monto_bs: 145920, referencia: '0091', estado: 'vigente' }];

const yo = { id: 'demo', nombre: 'Usuario de ejemplo', rol: 'admin' };
const negocio = {

    nombre: 'Distribuidora de Ejemplo', razon_social: 'Distribuidora de Ejemplo, C.A.', rif: 'J-00000000-0',
    domicilio_fiscal: 'Av. Principal, local 1, Valencia, Edo. Carabobo', domicilio_social: '', telefonos: '(0414) 000.00.00',
    ciudad: 'Valencia', distribuidor: 'Distribuidor autorizado', datos_pago: ['Pago móvil: 0102 · J-00000000-0 · 0414-0000000'],
  };
// Cotizaciones de ejemplo: una vigente y una vencida
const K = (id, cliente_id, dias, validez, lineas) => {
  const items = lineas.map(([pid, cantidad]) => { const p = prods.find((x) => x.id === pid); return { producto_id: pid, nombre: p.nombre, presentacion: p.presentacion, cantidad, precio: p.precio, subtotal: r2(cantidad * p.precio) }; });
  const subtotal = r2(items.reduce((t, i) => t + i.subtotal, 0));
  return { id, cliente_id, usuario_id: 'demo', fecha: haceDias(dias, 11), valida_hasta: enDias(validez), ciudad: 'Valencia', condiciones_pago: null, notas: null,
    items, subtotal, iva_pct: 0, iva: 0, total: subtotal, pedido_id: null, eliminada_en: null };
};
const cots = [K('demo-cot-1', 3, 0, 3, [[3, 10], [6, 6], [13, 2]]), K('demo-cot-2', 1, 6, -2, [[9, 4], [14, 5]])];
const store = { cats, prods, clis, peds, precios: [], provs, compras, abonos, cots, negocio };
const ultimos = { cliente: Math.max(...clis.map((x) => x.id)), producto: Math.max(...prods.map((x) => x.id)), proveedor: provs.length };
const motor = crearMotor(store, { usuario: () => yo, nuevoId: (tipo) => ++ultimos[tipo] });

export const demo = {
  ...motor,
  yo,
  negocio,
  configuracion: () => store.negocio,
  guardarConfiguracion(n) { Object.assign(store.negocio, n); return store.negocio; },
  crearPedido: (p) => motor.crearPedido({ ...p, numero: p.numero ?? num++ }),
  reemplazarPedido: (id, motivo, p) => motor.reemplazarPedido(id, motivo, { ...p, numero: p.numero ?? num++ }),
  subirFoto(tipo, id, blob) { const url = URL.createObjectURL(blob); return tipo === 'clientes' ? motor.guardarCliente({ id, imagen_url: url }) : motor.guardarProducto({ id, imagen_url: url }); },
};
