// Capa de datos. TODO funciona sin señal (luz y señal inestables en Venezuela):
//  - Lecturas: siempre de la copia del equipo (motor local con las mismas reglas que el servidor).
//  - Escrituras: se validan y aplican en la copia, se guardan en la cola y se suben en orden al servidor
//    (de inmediato si hay señal; si no, solas cuando vuelva). Si el servidor rechaza algo con señal, se deshace.
//  - La copia se renueva desde el servidor al abrir, tras subir cambios y cada 10 minutos con señal
//    (descarga solo las notas que cambiaron, para ahorrar datos).
// Modo demostración: datos de ejemplo en memoria con el mismo motor.
// Flujo del negocio: se toma el pedido (queda "por entregar"), se consolida para comprarle al proveedor,
// se despacha con la nota impresa (el stock baja al entregar) y el cliente paga cuando quiere: la nota queda
// "por cobrar" hasta registrar el pago (tasa BCV del día, dato manual).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { demo } from './demo.js';
import { crearMotor } from './motor.js';
import * as local from './local.js';
import { fijarMoneda, diaVe } from './ui.js';

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



// ---------------- Copia local + motor ----------------
const uuid = () => crypto.randomUUID();
const esTmp = (x) => typeof x === 'string' && x.startsWith('tmp:');
const resolver = (x) => (esTmp(x) ? local.ids()[x] ?? x : x);
let replica = null;          // copia del servidor + operaciones en cola aplicadas encima
let motor = null;
const ctxLocal = { usuario: () => yo, resolver, nuevoId: () => `tmp:${uuid()}` };
const VACIO = () => ({ cats: [], prods: [], clis: [], peds: [], precios: [], provs: [], compras: [], abonos: [], negocio: null });
const clonar = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

// Arma la copia de trabajo: lo último del servidor + lo que falta por subir (en orden). Lo que el servidor
// rechazó ("con problema") no se aplica: se ve en Ajustes → Trabajo sin señal para reintentar o descartar.
function reconstruir() {
  const c = local.copia();
  replica = c?.datos ? clonar(c.datos) : null;
  motor = replica ? crearMotor(replica, ctxLocal) : null;
  if (!motor) return;
  for (const op of local.cola()) if (op.estado !== 'error') { try { aplicar(op); } catch (_) { /* el servidor decidirá */ } }
}
function aplicar(op) {
  const [a0, a1, a2] = op.args;
  let r;
  if (op.tipo === 'subirFoto') r = a0 === 'clientes' ? motor.guardarCliente({ id: a1, imagen_url: local.urlFoto(a2) }) : motor.guardarProducto({ id: a1, imagen_url: local.urlFoto(a2) });
  else r = motor[op.tipo](...op.args);
  // Marca lo que todavía no está en el servidor
  const idPed = op.tipo === 'crearPedido' ? a0.id : op.tipo === 'reemplazarPedido' ? a2.id
    : ['anularPedido', 'programarEntrega', 'registrarEntrega', 'registrarPago'].includes(op.tipo) ? a0 : null;
  if (idPed) { const p = replica.peds.find((x) => x.id === idPed); if (p) p.porSubir = true; }
  if (op.tipo === 'registrarCompra' || op.tipo === 'anularCompra') { const c = replica.compras.find((x) => x.id === (a0.id || a0)); if (c) c.porSubir = true; }
  if (op.tipo === 'registrarAbonoProveedor' || op.tipo === 'anularAbonoProveedor') { const x = replica.abonos.find((k) => k.id === (a0.id || a0)); if (x) x.porSubir = true; }
  return r;
}
function exigirCopia() {
  if (!motor) throw new Error('Este equipo todavía no tiene los datos guardados. Ábrelo una vez con señal para descargarlos; después funciona sin señal.');
}
// Lectura: demostración o copia local.
function leer(nombre, ...args) {
  if (modoDemo) return demo[nombre](...args);
  exigirCopia();
  return motor[nombre](...args);
}
// Escritura: se valida y aplica en el equipo, va a la cola y se sube (de inmediato si hay señal).
async function escribir(tipo, args, texto) {
  if (modoDemo) return demo[tipo](...args);
  exigirCopia();
  const op = { id: uuid(), tipo, args: clonar(args), texto };
  const r = aplicar(op);                      // si no cumple las reglas, falla aquí y no se guarda nada
  local.encolar(op);
  if (conRed && navigator.onLine !== false) {
    const tope = new Promise((ok) => setTimeout(ok, 15000));
    // Si ya había una subida en marcha (que no incluye este cambio), se espera y se sube de nuevo.
    await Promise.race([sincronizar().then(() => (local.cola().some((x) => x.id === op.id && x.estado !== 'error') && conRed ? sincronizar() : null)), tope]);
    const quedo = local.cola().find((x) => x.id === op.id);
    if (quedo?.estado === 'error') {           // el servidor lo rechazó con señal: se deshace y se avisa
      local.quitarDeCola(op.id);
      reconstruir();
      throw new Error(quedo.error);
    }
    if (!quedo) {                               // ya está en el servidor: devolver lo más reciente
      const actual = refrescarResultado(op, r);
      return actual;
    }
  }
  return { ...r, porSubir: true };
}
function refrescarResultado(op, r) {
  try {
    if (r?.id && /Pedido|Entrega|Pago/.test(op.tipo)) return motor.pedido(op.tipo === 'reemplazarPedido' ? op.args[2].id : r.id);
    if (r?.id && op.tipo === 'guardarCliente') return motor.cliente(resolver(r.id));
    if (r?.id && op.tipo === 'guardarProducto') return motor.producto(resolver(r.id));
    if (r?.id && op.tipo === 'guardarProveedor') return { ...r, id: resolver(r.id) };
  } catch (_) { /* se queda con lo local */ }
  return r;
}

// ---------------- Sesión ----------------
export async function iniciar() {
  if (local.bloqueado()) {   // este equipo fue bloqueado: no muestra nada hasta que lo desbloqueen
    fijarBloqueo({ tipo: 'bloqueado', motivo: local.bloqueado().motivo });
    revisarBloqueo().catch(() => {});
    return false;
  }
  if (localStorage.getItem('vm-demo') === '1') { modoDemo = true; yo = demo.yo; await aplicarNegocio(); return true; }
  await local.cargar().catch(() => {});
  const guardado = local.perfil();
  const lenta = Symbol('lenta');
  let sesion = null;
  const r = await Promise.race([sb.auth.getSession().catch(() => null), new Promise((ok) => setTimeout(() => ok(lenta), 3000))]);
  if (r === lenta) {
    if (guardado && localStorage.getItem('vm-sesion')) return entrarSinRed(guardado);
    sesion = (await sb.auth.getSession().catch(() => null))?.data?.session || null;
  } else sesion = r?.data?.session || null;
  if (!sesion) {
    if (!guardado || !localStorage.getItem('vm-sesion')) { verificarAcceso().catch(() => {}); return false; }
    if (await probarRed()) { verificarAcceso().catch(() => {}); return false; }
    return entrarSinRed(guardado);
  }
  try { return await cargarPerfil(sesion.user.id); }
  catch (e) {
    if (e.sinRed && guardado?.id === sesion.user.id) return entrarSinRed(guardado);
    throw e;
  }
}
async function entrarSinRed(p) { yo = p; reconstruir(); marcarRed(false); revisarVencimiento(); await aplicarNegocio(); return true; }
async function cargarPerfil(id) {
  if ((await verificarAcceso())?.bloqueado) throw new Error('Esta app fue bloqueada por el administrador.');
  const u = chk(await sb.from('usuarios').select('id,nombre,rol,activo').eq('id', id).maybeSingle());
  if (!u || !u.activo) { await sb.auth.signOut(); throw new Error('Tu usuario no está activo. Pide al administrador que lo active.'); }
  if (local.perfil()?.id && local.perfil().id !== u.id && !local.cola().length) await local.borrarCopia();   // otro usuario en este equipo
  yo = { id: u.id, nombre: u.nombre, rol: u.rol };
  local.guardarPerfil(yo);
  reconstruir();
  marcarRed(true);
  // Sin copia (primera vez en este equipo): hay que descargarla antes de seguir.
  if (!motor) await sincronizar({ completa: true });
  else setTimeout(() => sincronizar(), 300);
  await aplicarNegocio();
  return true;
}
export async function entrar(correo, clave) {
  await local.cargar().catch(() => {});
  const d = chk(await sb.auth.signInWithPassword({ email: correo, password: clave }));
  return cargarPerfil(d.user.id);
}
export async function entrarDemo() { localStorage.setItem('vm-demo', '1'); modoDemo = true; yo = demo.yo; await aplicarNegocio(); }
export async function salir() {
  localStorage.removeItem('vm-demo');
  if (!modoDemo) {
    const n = local.cola().length;
    if (n) throw new Error(`Hay ${n} cambio${n === 1 ? '' : 's'} sin subir. Súbelos (con señal) antes de cerrar sesión.`);
    await sb.auth.signOut();
    await local.borrarCopia();   // los datos del negocio no quedan en el equipo al cerrar sesión
    replica = null; motor = null;
  }
  modoDemo = false; yo = null;
}

// ---------------- Control de acceso (kill switch) ----------------
// Francisco puede bloquear desde GitHub toda la app, un usuario o un equipo (migración 0005). La app pregunta al
// servidor al abrir y cada vez que se sincroniza; si está bloqueada, BORRA todo lo guardado en el equipo y queda
// en la pantalla "App bloqueada". Además, si el equipo pasa 7 días sin conectarse, se bloquea hasta que tenga señal
// (no borra nada: los cambios por subir se suben apenas vuelve la señal).
export const DIAS_SIN_SENAL = 7;
const DIA = 86400000;
let bloqueoActual = null;   // null | { tipo: 'bloqueado', motivo } | { tipo: 'vencido' }
export const bloqueo = () => bloqueoActual;
export const codigoEquipo = () => local.codigoEquipo();
function fijarBloqueo(b) {
  if (JSON.stringify(b) === JSON.stringify(bloqueoActual)) return;
  bloqueoActual = b;
  window.dispatchEvent(new CustomEvent('vm:bloqueo', { detail: b }));
}
function descripcionEquipo() {
  const ua = navigator.userAgent || '';
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Equipo';
  const app = window.Capacitor?.isNativePlatform?.() ? 'app' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  const tam = `${Math.round(Math.min(screen.width, screen.height))}×${Math.round(Math.max(screen.width, screen.height))}`;
  return `${so} · ${app} · pantalla ${tam}`;
}
// Pregunta al servidor si este equipo puede seguir. null = sin respuesta (sin señal u otro error: no se bloquea).
export async function verificarAcceso() {
  if (modoDemo && !local.bloqueado()) return { bloqueado: false };
  const { data, error } = await sb.rpc('estado_acceso', { p_equipo: local.equipo(), p_descripcion: descripcionEquipo() })
    .then((r) => r, (e) => ({ error: e }));
  if (error || !data) return null;
  if (data.bloqueado) { await bloquearEsteEquipo(data.motivo); return data; }
  local.marcarContacto();
  if (bloqueoActual?.tipo === 'vencido') fijarBloqueo(null);
  return data;
}
// Bloqueado: se borra todo lo del equipo (también los cambios sin subir) y se cierra la sesión.
async function bloquearEsteEquipo(motivo) {
  try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
  await local.borrarTodo();
  local.marcarBloqueado(motivo);
  replica = null; motor = null; yo = null; modoDemo = false;
  fijarBloqueo({ tipo: 'bloqueado', motivo });
}
// Desde la pantalla de bloqueo: si ya lo desbloquearon, vuelve a la pantalla de ingreso.
export async function revisarBloqueo() {
  const { data, error } = await sb.rpc('estado_acceso', { p_equipo: local.equipo() }).then((r) => r, (e) => ({ error: e }));
  if (error || !data) throw new Error('No hay conexión con el servidor. Revisa la señal e intenta de nuevo.');
  if (data.bloqueado) return false;
  local.quitarBloqueo();
  local.marcarContacto();
  fijarBloqueo(null);
  return true;
}
// 7 días sin conectarse (o el reloj del equipo atrasado) → bloqueado hasta que haya señal.
export function revisarVencimiento() {
  if (modoDemo || !yo || bloqueoActual?.tipo === 'bloqueado') return false;
  const c = local.contacto(), ahora = Date.now();
  if (!c) { local.marcarContacto(); return false; }   // equipos que ya tenían la app antes de esta versión
  const vencido = ahora - c > DIAS_SIN_SENAL * DIA || ahora < (local.visto() || c) - DIA;
  if (vencido) fijarBloqueo({ tipo: 'vencido' });
  else local.marcarVisto();
  return vencido;
}
// Pantalla "Conéctate a internet": reintenta (sube lo pendiente y pregunta al servidor).
export async function reintentarConexion() {
  if (!(await revisarRed())) throw new Error('Este equipo sigue sin conexión. Conéctate a internet (wifi o datos) e intenta de nuevo.');
  const r = await verificarAcceso();
  if (!r) throw new Error('No se pudo comprobar con el servidor. Intenta de nuevo en un momento.');
  if (!r.bloqueado) sincronizar();
  return !r.bloqueado;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && yo && !conRed) revisarVencimiento(); });

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
  if (modoDemo) return { ...NEGOCIO_DEFECTO, ...demo.configuracion() };
  if (!motor) return { ...negocioActual };
  return { ...NEGOCIO_DEFECTO, ...(motor.configuracion() || {}) };
}
export async function guardarConfiguracion(n) {
  if (modoDemo) demo.guardarConfiguracion(n);
  else await escribir('guardarConfiguracion', [n], 'Datos del negocio');
  negocioActual = { ...NEGOCIO_DEFECTO, ...n };
  fijarMoneda(negocioActual.moneda);
  return negocioActual;
}
// Formas de pago en bolívares (piden tasa BCV): las que nombran "Bs", "bolívar", "pago móvil" o "punto".
export const pagoEnBs = (forma) => /bs\b|bol[ií]var|pago m[oó]vil|punto/i.test(forma || '');

// ---------------- Clientes ----------------
export async function clientes({ busqueda = '', inactivos = false } = {}) { return leer('clientes', { busqueda, inactivos }); }
export async function cliente(id) { return leer('cliente', id); }
export async function guardarCliente(c) {
  const nuevo = c.id == null;
  const d = nuevo ? { ...c, id: `tmp:${uuid()}` } : c;
  return escribir('guardarCliente', [d], nuevo ? `Cliente nuevo · ${d.nombre}` : `Cambios del cliente ${leerNombre('clis', d.id)}`);
}
const leerNombre = (tabla, id) => { try { return (modoDemo ? '' : replica?.[tabla]?.find((x) => String(x.id) === String(id) || String(x.id) === String(resolver(id)))?.nombre) || ''; } catch (_) { return ''; } };
const aDataUrl = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(blob); });
const MAX_FOTO = 1024 * 1024;
async function subirFotoLocal(carpeta, id, blob) {
  if (!blob || !/^image\//.test(blob.type || 'image/jpeg') || blob.size > MAX_FOTO) throw new Error('La foto no se pudo guardar: debe ser una imagen de menos de 1 MB. Prueba con otra foto.');
  if (modoDemo) return demo.subirFoto(carpeta, id, blob);
  exigirCopia();
  const clave = uuid();
  await local.guardarFoto(clave, blob, await aDataUrl(blob));
  return escribir('subirFoto', [carpeta, id, clave], `Foto de ${carpeta === 'clientes' ? 'cliente' : 'producto'} · ${leerNombre(carpeta === 'clientes' ? 'clis' : 'prods', id)}`);
}
export const subirFotoCliente = (id, blob) => subirFotoLocal('clientes', id, blob);
export const quitarFotoCliente = (id) => guardarCliente({ id, imagen_url: null });
export async function eliminarDatosCliente(id) {
  if (modoDemo) return demo.anonimizarCliente(id);
  return escribir('anonimizarCliente', [id], `Eliminar datos del cliente ${leerNombre('clis', id)}`);
}

// ---------------- Productos ----------------
export async function categorias() { return leer('categorias'); }
export async function productos({ busqueda = '', soloActivos = true } = {}) { return leer('productos', { busqueda, soloActivos }); }
export async function producto(id) { return leer('producto', id); }
export async function guardarProducto(p) {
  const nuevo = p.id == null;
  const d = nuevo ? { ...p, id: `tmp:${uuid()}`, mov_uid: p.stock_inicial ? uuid() : undefined } : p;
  return escribir('guardarProducto', [d], nuevo ? `Producto nuevo · ${d.nombre}` : `Cambios del producto ${leerNombre('prods', d.id)}`);
}
export const subirFotoProducto = (id, blob) => subirFotoLocal('productos', id, blob);
export const quitarFotoProducto = (id) => guardarProducto({ id, imagen_url: null });
// Entrada de mercancía o corrección de inventario (solo administrador).
export async function ajustarStock(productoId, cantidad, motivo = 'ajuste') {
  return escribir('ajustarStock', [productoId, cantidad, motivo, uuid()], `Stock ${cantidad > 0 ? '+' : ''}${cantidad} · ${leerNombre('prods', productoId)}`);
}
// Último precio cobrado a un cliente por cada producto (Map producto_id → { precio, fecha }).
export async function ultimosPrecios(clienteId) { return leer('ultimosPrecios', clienteId); }

// ---------------- Pedidos ----------------
export async function pedidos({ estado = '', clienteId = null } = {}) { return leer('pedidos', { estado, clienteId }); }
export async function pedido(id) { return leer('pedido', id); }
export const puedeCorregir = (p) => p.estado === 'pendiente' && !p.pagado_en && (esAdmin() || p.usuario_id === yo?.id);
export const puedeAnular = (p) => p.estado !== 'anulado' && (p.estado === 'pendiente' && !p.pagado_en ? (esAdmin() || p.usuario_id === yo?.id) : esAdmin());
const nota = (n) => (n ? `N° ${String(n).padStart(6, '0')}` : '');
const deNota = (id) => { const p = !modoDemo && replica?.peds.find((x) => x.id === id); return p ? `${nota(p.numero)} · ${leerNombre('clis', p.cliente_id) || p.cliente || ''}` : ''; };

// Crea el pedido. El número sale del bloque reservado en el equipo, así la nota lleva su número definitivo
// aunque no haya señal.
export async function crearPedido(p) {
  if (modoDemo) return demo.crearPedido(p);
  exigirCopia();
  const ya = replica.peds.find((x) => x.id === p.id);
  if (ya) return motor.pedido(p.id);
  const numero = local.tomarNumero(yo.id);
  const ped = { ...p, numero, fecha: p.fecha || new Date().toISOString(), sin_senal: !conRed };
  try { return await escribir('crearPedido', [ped], `Pedido ${nota(numero)} · ${leerNombre('clis', p.cliente_id)}`); }
  catch (e) { if (!replica.peds.some((x) => x.id === p.id)) local.devolverNumero(yo.id, numero); throw e; }
}
// Editar un pedido por entregar = anular la nota y crear otra que la reemplaza (otro número), en una sola operación.
export async function reemplazarPedido(id, motivo, p) {
  if (modoDemo) return demo.reemplazarPedido(id, motivo, p);
  exigirCopia();
  const numero = local.tomarNumero(yo.id);
  const nuevo = { ...p, numero, fecha: new Date().toISOString() };
  try { return await escribir('reemplazarPedido', [id, motivo, nuevo], `Corrección de la nota ${deNota(id)}`); }
  catch (e) { if (!replica.peds.some((x) => x.id === p.id)) local.devolverNumero(yo.id, numero); throw e; }
}
export async function anularPedido(id, motivo) { return escribir('anularPedido', [id, motivo], `Anular nota ${deNota(id)}`); }
export async function programarEntrega(id, fecha) { return escribir('programarEntrega', [id, fecha || null], `Fecha de entrega · nota ${deNota(id)}`); }
// Entrega (despacho): baja el stock. items (opcional) = lo que de verdad se entrega [{ producto_id, cantidad, precio }].
export async function registrarEntrega(id, items = null) {
  return escribir('registrarEntrega', [id, items, new Date().toISOString()], `Entrega · nota ${deNota(id)}`);
}
// Pago: { forma_pago, tasa_bcv?, monto_bs?, referencia? }.
export async function registrarPago(id, pago) {
  return escribir('registrarPago', [id, { ...pago, fecha: pago.fecha || new Date().toISOString() }], `Pago · nota ${deNota(id)}`);
}

// ---------------- Reportes ----------------
export async function entregados(desdeDia, hastaDia) { return leer('notasEntre', 'entregado_en', desdeDia, hastaDia); }
export async function cobros(desdeDia, hastaDia) { return leer('notasEntre', 'pagado_en', desdeDia, hastaDia); }
export async function porCobrar() { return leer('porCobrar'); }
export async function pendientesConDetalle() { return leer('pendientesConDetalle'); }

// ---------------- Proveedor: compras, abonos y deuda (solo administrador) ----------------
export async function proveedores() { return leer('proveedores'); }
export async function proveedor(id) { return leer('proveedor', id); }
export async function guardarProveedor(p) {
  const nuevo = p.id == null;
  const d = nuevo ? { ...p, id: `tmp:${uuid()}` } : p;
  return escribir('guardarProveedor', [d], nuevo ? `Proveedor nuevo · ${d.nombre}` : `Cambios del proveedor ${leerNombre('provs', d.id)}`);
}
export async function compra(id) { return leer('compra', id); }
export async function registrarCompra(c) { return escribir('registrarCompra', [c], `Compra${c.documento ? ` ${c.documento}` : ''} · ${leerNombre('provs', c.proveedor_id)}`); }
export async function anularCompra(id, motivo) { return escribir('anularCompra', [id, motivo], 'Anular compra'); }
export async function registrarAbonoProveedor(a) { return escribir('registrarAbonoProveedor', [a], `Abono ${a.monto} · ${leerNombre('provs', a.proveedor_id)}`); }
export async function anularAbonoProveedor(id, motivo) { return escribir('anularAbonoProveedor', [id, motivo], 'Anular abono'); }

// ---------------- Sincronización ----------------
// Sube la cola en orden y renueva la copia. Devuelve cuando termina (o al perder la señal).
let enCurso = null;
export function sincronizar({ completa = false } = {}) {
  if (modoDemo || !yo) return Promise.resolve();
  if (!enCurso) enCurso = sincronizarAhora(completa).finally(() => { enCurso = null; window.dispatchEvent(new Event('vm:cola')); });
  return enCurso;
}
async function sincronizarAhora(completa) {
  if (!(await probarRed())) { marcarRed(false); revisarVencimiento(); return; }
  if ((await verificarAcceso())?.bloqueado) return;   // bloqueado: ya se borró todo
  let subidos = 0;
  for (const op of local.cola()) {
    if (op.estado === 'error') continue;
    try { await ejecutar(op); local.quitarDeCola(op.id); subidos++; }
    catch (e) {
      if (e.sinRed) { marcarRed(false); return; }
      if (/jwt|token|sesi[oó]n/i.test(e.message)) return;    // sesión vencida: se reintenta al volver a ingresar
      local.marcarError(op.id, e.message);
    }
  }
  marcarRed(true);
  try {
    if (local.numerosLibres(yo.id) < 25) local.agregarNumeros(yo.id, chk(await sb.rpc('reservar_numeros', { p_cantidad: 50 })));
    if (completa || subidos || local.edadCopia() > 10 || !local.hayCopia()) await descargar(completa);
  } catch (e) { if (e.sinRed) marcarRed(false); else console.error(e); }
  reconstruir();
}
export const colaCompleta = () => local.cola();
export const reintentarCola = () => { local.reintentarErrores(); return sincronizar({ completa: true }); };
// Descarta un cambio que el servidor rechazó (queda como si nunca se hubiera hecho).
export function descartarCambio(id) { local.quitarDeCola(id); reconstruir(); }
export const edadCopia = () => local.edadCopia();
export const numerosLibres = () => (yo ? local.numerosLibres(yo.id) : 0);

// Reemplaza los ids temporales por los reales; si falta alguno, la operación depende de algo que no subió.
function conIdsReales(x) {
  if (esTmp(x)) { const r = local.ids()[x]; if (r == null) throw new Error('Depende de un registro creado sin señal que todavía no se pudo subir (revisa el cambio anterior con problema).'); return r; }
  if (Array.isArray(x)) return x.map(conIdsReales);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, conIdsReales(v)]));
  return x;
}
const DERIVADOS = ['pedidos_pendientes', 'por_cobrar', 'ultimo_pedido', 'porSubir', 'creado_en', 'porEntregar', 'disponible', 'categoria', 'stock',
  'comprado', 'abonado', 'deuda', 'compras', 'abonos', 'mov_uid', 'stock_inicial', 'anonimizado_en'];
const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !DERIVADOS.includes(k) && v !== undefined));
// Crea o actualiza un cliente/producto/proveedor. Lo creado sin señal lleva uid: si se repite, no se duplica.
async function guardarFila(tabla, d) {
  if (!esTmp(d.id)) {
    const { id, ...campos } = limpiar(conIdsReales(d));
    if (tabla === 'productos') campos.actualizado_en = new Date().toISOString();
    return chk(await sb.from(tabla).update(campos).eq('id', id).select('id').single());
  }
  const uid = d.id.slice(4);
  const { id, ...campos } = limpiar(conIdsReales({ ...d, id: null }));
  let fila;
  try { fila = chk(await sb.from(tabla).insert({ ...campos, uid }).select('id').single()); }
  catch (e) {
    if (!/ya existe|duplicate/i.test(e.message)) throw e;
    fila = chk(await sb.from(tabla).select('id').eq('uid', uid).maybeSingle());
    if (!fila) throw e;
  }
  local.guardarId(d.id, fila.id);
  return fila;
}
async function insertarMovimiento(producto_id, cantidad, motivo, uid) {
  const { error } = await sb.from('movimientos_stock').insert({ producto_id, cantidad, motivo, uid });
  if (error && !/duplicate|unique/i.test(error.message)) chk({ error });
}
// Ejecuta en el servidor una operación de la cola (todas se pueden repetir sin duplicar).
async function ejecutar(op) {
  const fila = ['guardarCliente', 'guardarProducto', 'guardarProveedor', 'subirFoto', 'anonimizarCliente'].includes(op.tipo);
  const a = fila ? op.args : conIdsReales(op.args);
  switch (op.tipo) {
    case 'crearPedido': return chk(await sb.rpc('crear_pedido', { p: a[0] }));
    case 'reemplazarPedido': return chk(await sb.rpc('reemplazar_pedido', { p_id: a[0], p_motivo: a[1], p: a[2] }));
    case 'anularPedido': return chk(await sb.rpc('anular_pedido', { p_id: a[0], p_motivo: a[1] }));
    case 'programarEntrega': return chk(await sb.rpc('programar_entrega', { p_id: a[0], p_fecha: a[1] }));
    case 'registrarEntrega': return chk(await sb.rpc('registrar_entrega', { p_id: a[0], p: { ...(a[1] ? { items: a[1] } : {}), fecha: a[2] } }));
    case 'registrarPago': return chk(await sb.rpc('registrar_pago', { p_id: a[0], p: a[1] }));
    case 'guardarCliente': return guardarFila('clientes', op.args[0]);
    case 'guardarProveedor': return guardarFila('proveedores', op.args[0]);
    case 'guardarProducto': {
      const d = op.args[0], fila = await guardarFila('productos', d);
      if (d.stock_inicial && d.mov_uid) await insertarMovimiento(fila.id, Number(d.stock_inicial), 'inicial', d.mov_uid);
      return fila;
    }
    case 'ajustarStock': return insertarMovimiento(a[0], a[1], a[2], a[3]);
    case 'registrarCompra': return chk(await sb.rpc('registrar_compra', { p: a[0] }));
    case 'anularCompra': return chk(await sb.rpc('anular_compra', { p_id: a[0], p_motivo: a[1] }));
    case 'registrarAbonoProveedor': return chk(await sb.rpc('registrar_abono_proveedor', { p: a[0] }));
    case 'anularAbonoProveedor': return chk(await sb.rpc('anular_abono_proveedor', { p_id: a[0], p_motivo: a[1] }));
    case 'guardarConfiguracion': return chk(await sb.from('configuracion').upsert({ clave: 'negocio', valor: a[0] }));
    case 'anonimizarCliente': {
      const id = conIdsReales(op.args[0]), carpeta = String(id);
      const { data: fotos } = await sb.storage.from('clientes').list(carpeta, { limit: 100 });
      if (fotos?.length) chk(await sb.storage.from('clientes').remove(fotos.map((f) => `${carpeta}/${f.name}`)));
      return chk(await sb.rpc('anonimizar_cliente', { p_id: Number(id) }));
    }
    case 'subirFoto': {
      const [carpeta, idLocal, clave] = op.args, id = conIdsReales(idLocal);
      const blob = await local.leerFoto(clave);
      if (blob) {
        const ruta = `${id}/${clave}.jpg`;
        const { error } = await sb.storage.from(carpeta).upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) { if (/size|mime|type|payload/i.test(error.message || '')) throw new Error('La foto no se pudo subir: debe ser una imagen de menos de 1 MB.'); chk({ error }); }
        const url = sb.storage.from(carpeta).getPublicUrl(ruta).data.publicUrl;
        chk(await sb.from(carpeta).update({ imagen_url: url }).eq('id', id));
        await local.borrarFoto(clave);
      }
      return null;
    }
    default: throw new Error(`Operación desconocida: ${op.tipo}`);
  }
}

// ---------------- Descarga de la copia ----------------
const DIAS = 120;   // notas de los últimos 120 días, más todas las por entregar o por cobrar
const NUM = { pedidos: ['subtotal', 'iva', 'iva_pct', 'total', 'total_pedido', 'tasa_bcv', 'monto_bs'], items: ['precio', 'precio_base', 'costo', 'subtotal'],
  prods: ['costo', 'precio'], provs: ['saldo_inicial'], compras: ['total'], citems: ['costo', 'subtotal'], abonos: ['monto', 'tasa_bcv', 'monto_bs'], precios: ['precio'] };
const nums = (o, ks) => { for (const k of ks) if (o[k] != null) o[k] = Number(o[k]); return o; };
async function todo(armar) {   // el servidor entrega de a 1000 filas
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const parte = chk(await armar().range(desde, desde + 999));
    filas.push(...parte);
    if (parte.length < 1000) return filas;
  }
}
const SEL_PED = '*,pedido_items(id,producto_id,nombre,presentacion,cantidad,cantidad_pedida,precio,precio_base,costo,subtotal)';
const dePedido = (p) => {
  const { pedido_items, clientes: _c, ...r } = p;
  return nums({ ...r, items: (pedido_items || []).sort((a, b) => a.id - b.id).map((i) => nums({ ...i }, NUM.items)) }, NUM.pedidos);
};
async function descargar(completa) {
  const previa = local.copia();
  const total = completa || !previa?.datos || !previa.completa_en || Date.now() - Date.parse(previa.completa_en) > 6 * 3600e3;
  const desde = new Date(Date.now() - DIAS * 864e5).toISOString();
  const admin = esAdmin();
  const [cats, prods, clis, config, provs, compras, abonos] = await Promise.all([
    todo(() => sb.from('categorias').select('*').order('id')),
    todo(() => sb.from('productos').select('id,codigo,nombre,presentacion,categoria_id,costo,precio,stock,stock_minimo,orden,activo,imagen_url,actualizado_en').order('id')),
    todo(() => sb.from('clientes').select('*').order('id')),
    sb.from('configuracion').select('clave,valor').eq('clave', 'negocio').then(chk),
    admin ? todo(() => sb.from('proveedores').select('*').order('id')) : [],
    admin ? todo(() => sb.from('compras').select('*,compra_items(*)').order('fecha')) : [],
    admin ? todo(() => sb.from('abonos_proveedor').select('*').order('fecha')) : [],
  ]);
  let peds, precios, cursor;
  if (total) {
    const filtro = `fecha.gte.${desde},estado.eq.pendiente,and(pagado_en.is.null,estado.neq.anulado)`;
    peds = (await todo(() => sb.from('pedidos').select(SEL_PED).or(filtro).order('fecha'))).map(dePedido);
    precios = (await todo(() => sb.from('ultimos_precios').select('cliente_id,producto_id,precio,fecha'))).map((x) => nums(x, NUM.precios));
  } else {
    const cambios = (await todo(() => sb.from('pedidos').select(SEL_PED).gte('actualizado_en', new Date(Date.parse(previa.cursor) - 120e3).toISOString()).order('actualizado_en'))).map(dePedido);
    const m = new Map(previa.datos.peds.map((p) => [p.id, p]));
    for (const p of cambios) m.set(p.id, p);
    peds = [...m.values()].filter((p) => p.fecha >= desde || p.estado === 'pendiente' || (!p.pagado_en && p.estado !== 'anulado'));
    precios = previa.datos.precios || [];
  }
  cursor = peds.reduce((mx, p) => (p.actualizado_en && p.actualizado_en > mx ? p.actualizado_en : mx), previa?.cursor || '1970-01-01T00:00:00Z');
  await local.guardarCopia({
    datos: {
      cats, prods: prods.map((p) => nums(p, NUM.prods)), clis, peds, precios, negocio: config[0]?.valor || null,
      provs: provs.map((p) => nums(p, NUM.provs)),
      compras: compras.map((c) => { const { compra_items, ...r } = c; return nums({ ...r, items: (compra_items || []).sort((a, b) => a.id - b.id).map((i) => nums(i, NUM.citems)) }, NUM.compras); }),
      abonos: abonos.map((a) => nums(a, NUM.abonos)),
    },
    completa_en: total ? new Date().toISOString() : previa.completa_en, cursor,
  });
}
// Con señal: sube lo pendiente y renueva la copia cada 10 minutos; al volver a la app, si pasaron más de 5.
setInterval(() => {
  if (!yo || modoDemo) return;
  if (!conRed) { revisarRed(); revisarVencimiento(); }
  else if (local.cola().length || local.edadCopia() > 10) sincronizar();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && yo && !modoDemo && (local.cola().length || local.edadCopia() > 5)) sincronizar();
});

// Versión vigente publicada (la escribe GitHub al compilar). Funciona sin sesión.
export async function versionVigente() {
  const { data, error } = await sb.rpc('version_app');
  if (error) throw new Error(error.message);
  return data;
}
