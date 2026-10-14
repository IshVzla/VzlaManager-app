// Capa de datos: Supabase cuando hay sesión; datos de ejemplo (modo demostración) si no.
// Flujo del negocio: se toma el pedido (queda "por entregar"), se consolida para comprarle al proveedor,
// se despacha con la nota impresa (el stock baja al entregar) y el cliente paga cuando quiere: la nota queda
// "por cobrar" hasta registrar el pago (tasa BCV del día, dato manual).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { demo } from './demo.js';
import * as local from './local.js';
import { fijarMoneda, r2, diaVe } from './ui.js';

// Con señal débil una consulta puede quedar colgada: después de 20 s se da por perdida y la app sigue con lo
// guardado en el equipo. Un fallo de red se informa como "AbortError" para que la librería no reintente 3 veces.
function fetchConLimite(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  opts.signal?.addEventListener('abort', () => ctl.abort());
  return fetch(url, { ...opts, signal: ctl.signal })
    .catch((e) => { throw e?.name === 'AbortError' ? e : new DOMException(`Failed to fetch (${e?.message || 'sin red'})`, 'AbortError'); })
    .finally(() => clearTimeout(t));
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vm-sesion' },
  global: { fetch: fetchConLimite },
});

let modoDemo = false;
let yo = null; // { id, nombre, rol }

export const enDemo = () => modoDemo;
export const usuario = () => yo;
export const esAdmin = () => yo?.rol === 'admin';

function chk({ data, error }) {
  if (error) {
    const e = new Error(traducir(error.message));
    e.sinRed = esSinRed(error);
    throw e;
  }
  return data;
}
function esSinRed(error) {
  if (navigator.onLine === false) return true;
  const m = `${error?.message || ''} ${error?.name || ''} ${error?.details || ''}`;
  return /Failed to fetch|NetworkError|Network request failed|Load failed|AbortError|aborted|ERR_INTERNET|ERR_NAME|timeout/i.test(m);
}
function traducir(m) {
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/rate limit|too many requests|over_request_rate_limit|for security purposes/i.test(m)) return 'Demasiados intentos seguidos. Por seguridad, espera unos minutos y vuelve a intentar.';
  if (/Email not confirmed/i.test(m)) return 'Este correo aún no está confirmado. Revisa tu usuario en Supabase.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión a internet. Revisa la señal e intenta de nuevo.';
  if (/sin permiso|permission|row-level security|Unauthorized/i.test(m)) return 'Tu usuario no tiene permiso para esta acción.';
  if (/Payload too large|exceeded/i.test(m)) return 'La foto es demasiado pesada. Prueba con otra.';
  if (/duplicate key.*productos_codigo/i.test(m)) return 'Ya existe un producto con ese código.';
  if (/duplicate key.*categorias_nombre/i.test(m)) return 'Ya existe una categoría con ese nombre.';
  if (/out of range|numeric field overflow/i.test(m)) return 'Hay un número demasiado grande (cantidad, precio o monto). Revisa lo que escribiste.';
  if (/JWT expired|invalid JWT|refresh token|session.*(missing|expired)/i.test(m)) return 'Tu sesión venció. Cierra la app, vuelve a abrirla con señal e intenta de nuevo.';
  if (/violates check constraint/i.test(m)) return 'Hay un dato que no es válido (por ejemplo, un número negativo). Revisa el formulario.';
  if (/invalid input syntax|malformed|value too long/i.test(m)) return 'Hay un dato con un formato que no es válido. Revisa lo que escribiste.';
  if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
  if (/^[\x00-\x7F]+$/.test(m) && !/[áéíóúñ¿¡]/i.test(m) && /\b(the|of|not|is|for|to|failed|error|invalid)\b/i.test(m))
    return `No se pudo completar la acción. Intenta de nuevo; si sigue, envía a Francisco este mensaje: ${m}`;
  return m;
}
const mismo = (a, b) => String(a) === String(b);
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = (x) => (x == null ? x : Number(x));

// ---------------- Señal ----------------
let conRed = navigator.onLine !== false;
export const hayRed = () => conRed;
function marcarRed(v) {
  if (conRed === v) return;
  conRed = v;
  window.dispatchEvent(new CustomEvent('vm:red', { detail: v }));
  if (v) sincronizar();
}
window.addEventListener('online', () => revisarRed());
window.addEventListener('offline', () => marcarRed(false));
async function probarRed() {
  if (navigator.onLine === false) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY }, signal: ctl.signal, cache: 'no-store' });
    return r.status < 500;
  } catch (_) { return false; } finally { clearTimeout(t); }
}
export async function revisarRed() { const hay = await probarRed(); marcarRed(hay); return hay; }
setInterval(() => { if (!conRed && yo && !modoDemo) revisarRed(); }, 30000);

// Con señal consulta el servidor; sin señal (o si falla por la red) responde con la copia del equipo.
async function conCopia(enLinea, sinLinea) {
  if ((navigator.onLine === false || !conRed) && local.hayCopia()) { marcarRed(false); return sinLinea(local.copia()); }
  try { const r = await enLinea(); marcarRed(true); return r; }
  catch (e) {
    if (e.sinRed && local.hayCopia()) { marcarRed(false); return sinLinea(local.copia()); }
    throw e;
  }
}
function exigirSenal(accion, para = 'quede registrado') {
  if (navigator.onLine === false || !conRed) throw new Error(`${accion} necesita señal, para que ${para}. Intenta cuando tengas internet.`);
}

// ---------------- Sesión ----------------
export async function iniciar() {
  if (localStorage.getItem('vm-demo') === '1') { modoDemo = true; yo = demo.yo; await aplicarNegocio(); return true; }
  const guardado = local.perfil();
  const lenta = Symbol('lenta');
  let sesion = null;
  const r = await Promise.race([sb.auth.getSession().catch(() => null), new Promise((ok) => setTimeout(() => ok(lenta), 3000))]);
  if (r === lenta) {
    if (guardado && localStorage.getItem('vm-sesion')) return entrarSinRed(guardado);
    sesion = (await sb.auth.getSession().catch(() => null))?.data?.session || null;
  } else sesion = r?.data?.session || null;
  if (!sesion) {
    if (!guardado || !localStorage.getItem('vm-sesion')) return false;
    return (await probarRed()) ? false : entrarSinRed(guardado);
  }
  try { return await cargarPerfil(sesion.user.id); }
  catch (e) {
    if (e.sinRed && guardado?.id === sesion.user.id) return entrarSinRed(guardado);
    throw e;
  }
}
async function entrarSinRed(p) { yo = p; marcarRed(false); await aplicarNegocio(); return true; }
async function cargarPerfil(id) {
  const u = chk(await sb.from('usuarios').select('id,nombre,rol,activo').eq('id', id).maybeSingle());
  if (!u || !u.activo) { await sb.auth.signOut(); throw new Error('Tu usuario no está activo. Pide al administrador que lo active.'); }
  yo = { id: u.id, nombre: u.nombre, rol: u.rol };
  local.guardarPerfil(yo);
  marcarRed(true);
  await aplicarNegocio();
  setTimeout(sincronizar, 500);   // sube lo pendiente, reserva números y renueva la copia
  return true;
}
export async function entrar(correo, clave) {
  const d = chk(await sb.auth.signInWithPassword({ email: correo, password: clave }));
  return cargarPerfil(d.user.id);
}
export async function entrarDemo() { localStorage.setItem('vm-demo', '1'); modoDemo = true; yo = demo.yo; await aplicarNegocio(); }
export async function salir() {
  localStorage.removeItem('vm-demo');
  if (!modoDemo) {
    const n = local.cola().length;
    if (n) throw new Error(`Hay ${n} pedido${n === 1 ? '' : 's'} sin subir. Súbelos (con señal) antes de cerrar sesión.`);
    await sb.auth.signOut();
    local.borrarCopia();   // los datos del negocio no quedan en el equipo al cerrar sesión
  }
  modoDemo = false; yo = null;
}

// ---------------- Datos del negocio (nota, moneda, IVA, formas de pago) ----------------
export const NEGOCIO_DEFECTO = {
  nombre: '', razon_social: '', rif: '', domicilio_fiscal: '', domicilio_social: '', telefonos: '', ciudad: '', distribuidor: '',
  leyenda: 'Este documento no tiene valor fiscal. Es una nota de pedido y entrega.',
  condiciones_pago: '', moneda: 'USD', iva_activo: false, iva_pct: 16,
  formas_pago: ['Pago móvil', 'Transferencia en Bs', 'Efectivo en dólares', 'Zelle'], datos_pago: [],
};
let negocioActual = { ...NEGOCIO_DEFECTO };
export const negocio = () => negocioActual;
async function aplicarNegocio() {
  try { negocioActual = await configuracion(); } catch (_) { /* se queda con lo último */ }
  fijarMoneda(negocioActual.moneda);
}
export async function configuracion() {
  if (modoDemo) return { ...NEGOCIO_DEFECTO, ...demo.negocio };
  return conCopia(async () => {
    const filas = chk(await sb.from('configuracion').select('valor').eq('clave', 'negocio'));
    return { ...NEGOCIO_DEFECTO, ...(filas[0]?.valor || {}) };
  }, (c) => ({ ...NEGOCIO_DEFECTO, ...(c.negocio || {}) }));
}
export async function guardarConfiguracion(n) {
  if (modoDemo) { Object.assign(demo.negocio, n); }
  else { exigirSenal('Guardar los datos del negocio', 'el cambio quede guardado'); chk(await sb.from('configuracion').upsert({ clave: 'negocio', valor: n })); actualizarCopia().catch(() => {}); }
  negocioActual = { ...NEGOCIO_DEFECTO, ...n };
  fijarMoneda(negocioActual.moneda);
  return negocioActual;
}
// Formas de pago en bolívares (piden tasa BCV): las que nombran "Bs", "bolívar", "pago móvil" o "punto".
export const pagoEnBs = (forma) => /bs\b|bol[ií]var|pago m[oó]vil|punto/i.test(forma || '');

// ---------------- Clientes ----------------
export async function clientes({ busqueda = '', inactivos = false } = {}) {
  if (modoDemo) return demo.clientes({ busqueda, inactivos });
  const filtrar = (lista) => {
    const b = normal(busqueda);
    return conPendientes(lista.filter((x) => (inactivos || x.activo)
      && (!b || normal([x.nombre, x.razon_social, x.rif, x.ciudad].join(' ')).includes(b))))
      .sort((a, z) => a.nombre.localeCompare(z.nombre, 'es'));
  };
  return conCopia(async () => filtrar(chk(await sb.from('clientes_estado').select('*'))), (c) => filtrar(c.clientes));
}
export async function cliente(id) {
  if (modoDemo) return demo.cliente(id);
  return conCopia(async () => conPendientes([chk(await sb.from('clientes_estado').select('*').eq('id', id).single())])[0],
    (c) => {
      const x = c.clientes.find((k) => mismo(k.id, id));
      if (!x) throw new Error('Este cliente no está guardado en el equipo. Ábrelo cuando tengas señal.');
      return conPendientes([x])[0];
    });
}
export async function guardarCliente(c) {
  if (modoDemo) return demo.guardarCliente(c);
  exigirSenal('Guardar el cliente', 'quede guardado');
  const { id, ...campos } = c;
  const r = id ? chk(await sb.from('clientes').update(campos).eq('id', id).select().single())
    : chk(await sb.from('clientes').insert(campos).select().single());
  actualizarCopia().catch(() => {});
  return r;
}
const MAX_FOTO = 1024 * 1024;
async function subirFoto(carpeta, ruta, blob) {
  const malo = 'La foto no se pudo subir: debe ser una imagen de menos de 1 MB. Prueba con otra foto.';
  if (!blob || !/^image\//.test(blob.type || 'image/jpeg') || blob.size > MAX_FOTO) throw new Error(malo);
  const { error } = await sb.storage.from(carpeta).upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) { if (/size|mime|type|payload/i.test(error.message || '')) throw new Error(malo); chk({ error }); }
  return sb.storage.from(carpeta).getPublicUrl(ruta).data.publicUrl;
}
export async function subirFotoCliente(id, blob) {
  if (modoDemo) return demo.guardarCliente({ id, imagen_url: URL.createObjectURL(blob) });
  exigirSenal('Subir la foto', 'quede guardada');
  const url = await subirFoto('clientes', `${id}/${Date.now()}.jpg`, blob);
  return guardarCliente({ id, imagen_url: url });
}
export async function quitarFotoCliente(id) { return modoDemo ? demo.guardarCliente({ id, imagen_url: null }) : guardarCliente({ id, imagen_url: null }); }
export async function eliminarDatosCliente(id) {
  if (modoDemo) return demo.anonimizarCliente(id);
  exigirSenal('Eliminar los datos de un cliente', 'el cambio quede registrado');
  const carpeta = String(Number(id));
  const { data: fotos } = await sb.storage.from('clientes').list(carpeta, { limit: 100 });
  if (fotos?.length) chk(await sb.storage.from('clientes').remove(fotos.map((f) => `${carpeta}/${f.name}`)));
  chk(await sb.rpc('anonimizar_cliente', { p_id: Number(id) }));
  actualizarCopia().catch(() => {});
}
// Un cliente con pedidos en cola cuenta como "con pedido por entregar".
function conPendientes(cs) {
  const cola = local.cola();
  if (!cola.length) return cs;
  return cs.map((c) => {
    const n = cola.filter((x) => mismo(x.pedido.cliente_id, c.id)).length;
    return n ? { ...c, pedidos_pendientes: (c.pedidos_pendientes || 0) + n } : c;
  });
}

// ---------------- Productos ----------------
export async function categorias() {
  if (modoDemo) return demo.categorias();
  return conCopia(async () => chk(await sb.from('categorias').select('*').order('orden').order('nombre')), (c) => c.categorias || []);
}
const CAMPOS_PRODUCTO = 'id,codigo,nombre,presentacion,categoria_id,costo,precio,stock,stock_minimo,orden,activo,imagen_url,categorias(nombre)';
const conNombres = (p) => ({ ...p, costo: num(p.costo), precio: num(p.precio), categoria: p.categorias?.nombre || null, categorias: undefined });
// Productos con lo comprometido en pedidos por entregar (incluye lo guardado sin subir) y lo disponible.
export async function productos({ busqueda = '', soloActivos = true } = {}) {
  if (modoDemo) return demo.productos({ busqueda, soloActivos });
  const armar = (ps, pe) => {
    const b = normal(busqueda);
    const comp = new Map(pe.map((x) => [x.producto_id, x.cantidad]));
    for (const x of local.cola()) for (const i of x.pedido.items) comp.set(i.producto_id, (comp.get(i.producto_id) || 0) + i.cantidad);
    return ps.filter((p) => (!soloActivos || p.activo) && (!b || normal(`${p.nombre} ${p.codigo || ''} ${p.presentacion || ''}`).includes(b)))
      .map((p) => { const porEntregar = comp.get(p.id) || 0; return { ...p, porEntregar, disponible: p.stock - porEntregar }; })
      .sort((a, z) => (a.orden ?? 0) - (z.orden ?? 0) || a.nombre.localeCompare(z.nombre, 'es'));
  };
  return conCopia(async () => {
    const [ps, pe] = await Promise.all([sb.from('productos').select(CAMPOS_PRODUCTO).then(chk), sb.from('por_entregar').select('*').then(chk)]);
    return armar(ps.map(conNombres), pe);
  }, (c) => armar(c.productos, c.porEntregar || []));
}
export async function producto(id) {
  if (modoDemo) return demo.producto(id);
  const ps = await productos({ soloActivos: false });
  const p = ps.find((x) => mismo(x.id, id));
  if (!p) throw new Error('No se encontró este producto.');
  return p;
}
export async function guardarProducto(p) {
  if (modoDemo) return demo.guardarProducto(p);
  exigirSenal('Guardar el producto', 'quede guardado');
  const { id, stock_inicial, ...campos } = p;
  campos.actualizado_en = new Date().toISOString();
  const r = id ? chk(await sb.from('productos').update(campos).eq('id', id).select().single())
    : chk(await sb.from('productos').insert(campos).select().single());
  if (!id && stock_inicial) await ajustarStock(r.id, stock_inicial, 'inicial');
  actualizarCopia().catch(() => {});
  return r;
}
export async function subirFotoProducto(id, blob) {
  if (modoDemo) return demo.guardarProducto({ id, imagen_url: URL.createObjectURL(blob) });
  exigirSenal('Subir la foto', 'quede guardada');
  const url = await subirFoto('productos', `${id}/${Date.now()}.jpg`, blob);
  return guardarProducto({ id, imagen_url: url });
}
export async function quitarFotoProducto(id) { return modoDemo ? demo.guardarProducto({ id, imagen_url: null }) : guardarProducto({ id, imagen_url: null }); }
// Entrada de mercadería o corrección de inventario (solo administrador).
export async function ajustarStock(productoId, cantidad, motivo = 'ajuste') {
  if (modoDemo) return demo.ajustarStock(productoId, cantidad);
  exigirSenal('Ajustar el stock', 'el cambio quede registrado');
  chk(await sb.from('movimientos_stock').insert({ producto_id: productoId, cantidad, motivo }));
  actualizarCopia().catch(() => {});
}

// Último precio cobrado a un cliente por cada producto (Map producto_id → { precio, fecha }).
// Se usa para sugerir el precio en el próximo pedido; si nunca lo compró, se sugiere el precio base.
export async function ultimosPrecios(clienteId) {
  if (modoDemo) return demo.ultimosPrecios(clienteId);
  const filas = await conCopia(async () => chk(await sb.from('ultimos_precios').select('producto_id,precio,fecha').eq('cliente_id', clienteId)),
    (c) => (c.precios || []).filter((x) => mismo(x.cliente_id, clienteId)));
  const m = new Map(filas.map((x) => [x.producto_id, { precio: num(x.precio), fecha: x.fecha }]));
  // Lo guardado sin subir también cuenta (es lo más reciente)
  for (const x of local.cola().filter((y) => mismo(y.pedido.cliente_id, clienteId)))
    for (const i of x.pedido.items) m.set(i.producto_id, { precio: num(i.precio), fecha: x.pedido.fecha });
  return m;
}

// ---------------- Pedidos ----------------
const CAMPOS_LISTA = 'id,numero,fecha,estado,entrega_programada,entregado_en,pagado_en,total,forma_pago,cliente_id,clientes(nombre)';
const deCola = (x) => ({ id: x.pedido.id, numero: x.pedido.numero, fecha: x.pedido.fecha, estado: 'pendiente', porSubir: true,
  entrega_programada: x.pedido.entrega_programada || null, total: x.resumen.total, cliente_id: x.pedido.cliente_id, cliente: x.resumen.cliente });
// Lista de pedidos. estado: 'pendiente' | 'entregado' | 'anulado' | '' (todos). Incluye los guardados sin subir.
export async function pedidos({ estado = '', clienteId = null, desde = null, hasta = null, limite = 300 } = {}) {
  if (modoDemo) return demo.pedidos({ estado, clienteId, desde, hasta });
  const cola = local.cola().map(deCola).filter((p) => (!estado || estado === 'pendiente') && (!clienteId || mismo(p.cliente_id, clienteId)));
  const delServidor = await conCopia(async () => {
    let q = sb.from('pedidos').select(CAMPOS_LISTA);
    if (estado) q = q.eq('estado', estado);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    if (desde) q = q.gte('fecha', new Date(desde).toISOString());
    if (hasta) q = q.lt('fecha', new Date(hasta).toISOString());
    return chk(await q.order('fecha', { ascending: false }).limit(limite)).map((p) => ({ ...p, total: num(p.total), cliente: p.clientes?.nombre || '—' }));
  }, (c) => (c.pedidos || []).filter((p) => (!estado || p.estado === estado) && (!clienteId || mismo(p.cliente_id, clienteId))));
  return [...cola.reverse(), ...delServidor.filter((p) => !cola.some((q) => q.id === p.id))];
}
// Detalle de una nota con sus productos.
export async function pedido(id) {
  if (modoDemo) return demo.pedido(id);
  const enCola = local.cola().find((x) => x.pedido.id === id);
  if (enCola) {
    const p = enCola.pedido;
    return { ...p, cliente: enCola.resumen.cliente, estado: 'pendiente', porSubir: true, usuario_id: yo?.id,
      subtotal: enCola.resumen.subtotal ?? enCola.resumen.total, iva_pct: enCola.resumen.iva_pct || 0, iva: enCola.resumen.iva || 0, total: enCola.resumen.total,
      ciudad: p.ciudad, condiciones_pago: p.condiciones_pago,
      items: p.items.map((i) => ({ ...i, cantidad_pedida: i.cantidad, subtotal: r2(i.cantidad * i.precio) })) };
  }
  const p = chk(await sb.from('pedidos').select('*,clientes(*),pedido_items(id,producto_id,nombre,presentacion,cantidad,cantidad_pedida,precio,precio_base,subtotal)').eq('id', id).maybeSingle());
  if (!p) throw new Error('No se encontró esta nota.');
  const [reemplazo, original] = await Promise.all([
    sb.from('pedidos').select('id,numero').eq('reemplaza_a', id).maybeSingle().then(chk),
    p.reemplaza_a ? sb.from('pedidos').select('id,numero').eq('id', p.reemplaza_a).maybeSingle().then(chk) : null,
  ]);
  return { ...p, subtotal: num(p.subtotal), iva: num(p.iva), iva_pct: num(p.iva_pct), total: num(p.total), total_pedido: num(p.total_pedido), tasa_bcv: num(p.tasa_bcv), monto_bs: num(p.monto_bs),
    cliente: p.clientes?.nombre || '—', datosCliente: p.clientes || {}, clientes: undefined,
    items: (p.pedido_items || []).sort((a, b) => a.id - b.id).map((i) => ({ ...i, precio: num(i.precio), precio_base: num(i.precio_base), subtotal: num(i.subtotal) })),
    reemplazado_por: reemplazo, reemplaza: original };
}
export const puedeCorregir = (p) => p.estado === 'pendiente' && !p.pagado_en && !p.porSubir && (esAdmin() || p.usuario_id === yo?.id);
export const puedeAnular = (p) => p.estado !== 'anulado' && !p.porSubir && (p.estado === 'pendiente' && !p.pagado_en ? (esAdmin() || p.usuario_id === yo?.id) : esAdmin());

// Crea el pedido. El número sale del bloque reservado en el equipo, así la nota lleva su número definitivo
// aunque no haya señal. Sin señal, el pedido queda en la cola y se sube solo al volver la señal.
// resumen = { cliente, subtotal, iva_pct, iva, total } para mostrarlo mientras está en cola.
export async function crearPedido(p, resumen = {}) {
  if (modoDemo) return demo.crearPedido(p);
  const yaEnCola = local.cola().find((x) => x.pedido.id === p.id);
  if (yaEnCola) return { ...yaEnCola.pedido, total: yaEnCola.resumen.total, porSubir: true };
  const numero = local.tomarNumero(yo.id);
  const ped = { ...p, numero, fecha: p.fecha || new Date().toISOString() };
  if (navigator.onLine !== false && conRed) {
    try {
      const r = chk(await sb.rpc('crear_pedido', { p: ped }));
      marcarRed(true); sincronizar(true);
      return { ...r, total: num(r.total) };
    } catch (e) { if (!e.sinRed) { local.devolverNumero(yo.id, numero); throw e; } }
  }
  marcarRed(false);
  ped.sin_senal = true;
  local.encolar(ped, resumen);
  return { ...ped, total: resumen.total, porSubir: true };
}
// Editar un pedido por entregar = anular la nota y crear otra que la reemplaza (otro número), en una sola operación.
export async function reemplazarPedido(id, motivo, p) {
  if (modoDemo) return demo.reemplazarPedido(id, motivo, p);
  exigirSenal('Editar un pedido');
  const numero = local.tomarNumero(yo.id);
  const nuevo = { ...p, numero, fecha: new Date().toISOString() };
  try { const r = chk(await sb.rpc('reemplazar_pedido', { p_id: id, p_motivo: motivo, p: nuevo })); sincronizar(true); return r; }
  catch (e) {
    if (!e.sinRed) local.devolverNumero(yo.id, numero); else marcarRed(false);
    throw e.sinRed ? new Error('Se perdió la señal y no se pudo confirmar el cambio. Intenta de nuevo cuando tengas señal: no se duplicará.') : e;
  }
}
export async function anularPedido(id, motivo) {
  if (modoDemo) return demo.anularPedido(id, motivo);
  exigirSenal('Anular un pedido');
  const r = chk(await sb.rpc('anular_pedido', { p_id: id, p_motivo: motivo }));
  actualizarCopia().catch(() => {});
  return r;
}
export async function programarEntrega(id, fecha) {
  if (modoDemo) return demo.programarEntrega(id, fecha);
  exigirSenal('Programar la entrega');
  return chk(await sb.rpc('programar_entrega', { p_id: id, p_fecha: fecha || null }));
}
// Entrega (despacho): baja el stock. La nota queda por cobrar hasta registrar el pago.
// items (opcional) = lo que de verdad se entrega [{ producto_id, cantidad, precio }]: la nota mantiene su número
// y queda marcada con lo pedido y lo entregado.
export async function registrarEntrega(id, items = null) {
  if (modoDemo) return demo.registrarEntrega(id, items);
  exigirSenal('Registrar la entrega');
  const r = chk(await sb.rpc('registrar_entrega', { p_id: id, p: items ? { items } : {} }));
  actualizarCopia().catch(() => {});
  return r;
}
// Pago: { forma_pago, tasa_bcv?, monto_bs?, referencia? }.
export async function registrarPago(id, pago) {
  if (modoDemo) return demo.registrarPago(id, pago);
  exigirSenal('Registrar el pago');
  const r = chk(await sb.rpc('registrar_pago', { p_id: id, p: pago }));
  actualizarCopia().catch(() => {});
  return r;
}

// ---------------- Reportes ----------------
// Notas entre dos días de Venezuela [desde, hasta] según una fecha ('entregado_en' = ventas; 'pagado_en' = cobros), con detalle.
async function notasEntre(campo, desdeDia, hastaDia) {
  // Margen de un día a cada lado por la diferencia horaria; se filtra exacto por día de Venezuela.
  const desde = new Date(Date.parse(desdeDia + 'T00:00:00Z') - 864e5).toISOString();
  const hasta = new Date(Date.parse(hastaDia + 'T00:00:00Z') + 2 * 864e5).toISOString();
  const filas = chk(await sb.from('pedidos').select('id,numero,fecha,estado,entregado_en,pagado_en,total,forma_pago,tasa_bcv,monto_bs,referencia_pago,cliente_id,clientes(nombre),pedido_items(producto_id,nombre,cantidad,precio,subtotal)')
    .neq('estado', 'anulado').gte(campo, desde).lt(campo, hasta).order(campo));
  return filas.map((p) => ({ ...p, total: num(p.total), tasa_bcv: num(p.tasa_bcv), monto_bs: num(p.monto_bs), cliente: p.clientes?.nombre || '—',
    items: (p.pedido_items || []).map((i) => ({ ...i, precio: num(i.precio), subtotal: num(i.subtotal) })) }))
    .filter((p) => { const d = diaVe(p[campo]); return d >= desdeDia && d <= hastaDia; });
}
// Ventas = lo entregado en el período (pagado o por cobrar).
export async function entregados(desdeDia, hastaDia) {
  if (modoDemo) return demo.notasEntre('entregado_en', desdeDia, hastaDia);
  return notasEntre('entregado_en', desdeDia, hastaDia);
}
// Cobros = pagos registrados en el período.
export async function cobros(desdeDia, hastaDia) {
  if (modoDemo) return demo.notasEntre('pagado_en', desdeDia, hastaDia);
  return notasEntre('pagado_en', desdeDia, hastaDia);
}
// Notas por cobrar: entregadas o por entregar, sin pago registrado (no anuladas).
export async function porCobrar() {
  if (modoDemo) return demo.porCobrar();
  return conCopia(async () => chk(await sb.from('pedidos').select(CAMPOS_LISTA).is('pagado_en', null).neq('estado', 'anulado').order('fecha'))
    .map((p) => ({ ...p, total: num(p.total), cliente: p.clientes?.nombre || '—' })),
  (c) => (c.pedidos || []).filter((p) => !p.pagado_en && p.estado !== 'anulado'));
}
// Pedidos por entregar con su detalle (para bodega).
export async function pendientesConDetalle() {
  if (modoDemo) return demo.pendientesConDetalle();
  const cola = local.cola().map((x) => ({ ...deCola(x), items: x.pedido.items }));
  const filas = await conCopia(async () => chk(await sb.from('pedidos').select('id,numero,fecha,entrega_programada,total,cliente_id,clientes(nombre),pedido_items(producto_id,nombre,presentacion,cantidad)')
    .eq('estado', 'pendiente').order('fecha'))
    .map((p) => ({ ...p, total: num(p.total), cliente: p.clientes?.nombre || '—', items: p.pedido_items || [] })),
  (c) => (c.pendientes || []));
  return [...filas, ...cola.filter((x) => !filas.some((p) => p.id === x.id))];
}

// ---------------- Sincronización ----------------
let enCurso = null;
export function sincronizar(forzarCopia = false) {
  if (modoDemo || !yo) return Promise.resolve();
  if (!enCurso) enCurso = subirCola(forzarCopia).finally(() => { enCurso = null; window.dispatchEvent(new Event('vm:cola')); });
  return enCurso;
}
async function subirCola(forzarCopia) {
  if (!(await probarRed())) { marcarRed(false); return; }
  let subidos = 0;
  for (const x of local.cola()) {
    if (x.estado === 'error') continue;
    try { chk(await sb.rpc('crear_pedido', { p: x.pedido })); local.quitarDeCola(x.pedido.id); subidos++; }
    catch (e) {
      if (e.sinRed) { marcarRed(false); return; }
      if (/jwt|token|sesi[oó]n/i.test(e.message)) return;   // sesión vencida: se reintenta al volver a ingresar
      local.marcarError(x.pedido.id, e.message);
    }
  }
  marcarRed(true);
  try {
    if (local.numerosLibres(yo.id) < 10) local.agregarNumeros(yo.id, chk(await sb.rpc('reservar_numeros', { p_cantidad: 30 })));
    if (subidos || forzarCopia || local.edadCopia() > 10) await actualizarCopia();
  } catch (e) { if (e.sinRed) marcarRed(false); else console.error(e); }
}
export const colaCompleta = () => local.cola();
export const reintentarCola = () => { local.reintentarErrores(); return sincronizar(true); };
export const edadCopia = () => local.edadCopia();
export const numerosLibres = () => (yo ? local.numerosLibres(yo.id) : 0);

// Descarga lo necesario para trabajar sin señal.
async function actualizarCopia() {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  const [clientes, productos, categorias, config, precios, porEntregar, pedidos, pendientes] = await Promise.all([
    sb.from('clientes_estado').select('*').then(chk),
    sb.from('productos').select(CAMPOS_PRODUCTO).then(chk),
    sb.from('categorias').select('*').order('orden').then(chk),
    sb.from('configuracion').select('clave,valor').eq('clave', 'negocio').then(chk),
    sb.from('ultimos_precios').select('cliente_id,producto_id,precio,fecha').then(chk),
    sb.from('por_entregar').select('*').then(chk),
    sb.from('pedidos').select(CAMPOS_LISTA).gte('fecha', desde).order('fecha', { ascending: false }).then(chk),
    sb.from('pedidos').select('id,numero,fecha,entrega_programada,total,cliente_id,clientes(nombre),pedido_items(producto_id,nombre,presentacion,cantidad)').eq('estado', 'pendiente').then(chk),
  ]);
  local.guardarCopia({
    clientes, productos: productos.map(conNombres), categorias, precios, porEntregar,
    negocio: config[0]?.valor || null,
    pedidos: pedidos.map((p) => ({ ...p, total: num(p.total), cliente: p.clientes?.nombre || '—', clientes: undefined })),
    pendientes: pendientes.map((p) => ({ ...p, total: num(p.total), cliente: p.clientes?.nombre || '—', clientes: undefined, items: p.pedido_items || [], pedido_items: undefined })),
  });
}

// ---------------- Proveedor: compras, abonos y deuda (solo administrador, con señal) ----------------
const n2 = (o, ks) => { for (const k of ks) if (o[k] != null) o[k] = Number(o[k]); return o; };
export async function proveedores() {
  if (modoDemo) return demo.proveedores();
  return chk(await sb.from('proveedores_deuda').select('*').order('nombre')).map((x) => n2(x, ['saldo_inicial', 'comprado', 'abonado', 'deuda']));
}
export async function proveedor(id) {
  if (modoDemo) return demo.proveedor(id);
  const [p, compras, abonos] = await Promise.all([
    sb.from('proveedores_deuda').select('*').eq('id', id).single().then(chk),
    sb.from('compras').select('id,fecha,documento,total,estado,creado_en,compra_items(count)').eq('proveedor_id', id).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(100).then(chk),
    sb.from('abonos_proveedor').select('*').eq('proveedor_id', id).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(100).then(chk),
  ]);
  return { ...n2(p, ['saldo_inicial', 'comprado', 'abonado', 'deuda']),
    compras: compras.map((c) => ({ ...n2(c, ['total']), productos: c.compra_items?.[0]?.count ?? 0 })),
    abonos: abonos.map((a) => n2(a, ['monto', 'tasa_bcv', 'monto_bs'])) };
}
export async function guardarProveedor(p) {
  if (modoDemo) return demo.guardarProveedor(p);
  exigirSenal('Guardar el proveedor', 'quede guardado');
  const { id, ...campos } = p;
  return id ? chk(await sb.from('proveedores').update(campos).eq('id', id).select().single())
    : chk(await sb.from('proveedores').insert(campos).select().single());
}
export async function compra(id) {
  if (modoDemo) return demo.compra(id);
  const c = chk(await sb.from('compras').select('*, proveedores(nombre), compra_items(*)').eq('id', id).single());
  return { ...n2(c, ['total']), proveedor: c.proveedores?.nombre || '—', items: (c.compra_items || []).sort((a, b) => a.id - b.id).map((i) => n2(i, ['costo', 'subtotal'])) };
}
export async function registrarCompra(c) {
  if (modoDemo) return demo.registrarCompra(c);
  exigirSenal('Registrar la compra', 'quede registrada');
  const r = chk(await sb.rpc('registrar_compra', { p: c }));
  actualizarCopia().catch(() => {});
  return r;
}
export async function anularCompra(id, motivo) {
  if (modoDemo) return demo.anularCompra(id, motivo);
  exigirSenal('Anular la compra', 'el cambio quede registrado');
  const r = chk(await sb.rpc('anular_compra', { p_id: id, p_motivo: motivo }));
  actualizarCopia().catch(() => {});
  return r;
}
export async function registrarAbonoProveedor(a) {
  if (modoDemo) return demo.registrarAbonoProveedor(a);
  exigirSenal('Registrar el abono', 'quede registrado');
  return chk(await sb.rpc('registrar_abono_proveedor', { p: a }));
}
export async function anularAbonoProveedor(id, motivo) {
  if (modoDemo) return demo.anularAbonoProveedor(id, motivo);
  exigirSenal('Anular el abono', 'el cambio quede registrado');
  return chk(await sb.rpc('anular_abono_proveedor', { p_id: id, p_motivo: motivo }));
}

// Versión vigente publicada (la escribe GitHub al compilar). Funciona sin sesión.
export async function versionVigente() {
  const { data, error } = await sb.rpc('version_app');
  if (error) throw new Error(error.message);
  return data;
}
