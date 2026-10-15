// Lo que el equipo guarda para trabajar sin señal (todo funciona sin señal: tomar pedidos, entregar, cobrar,
// editar, anular, compras, abonos, clientes, productos, stock y fotos).
//  - copia: los datos del servidor (clientes, productos, notas, proveedores, compras, abonos, configuración).
//    Vive en IndexedDB (cabe mucho más que en localStorage) y en memoria mientras la app está abierta.
//  - cola: cada operación hecha en el equipo, en orden, hasta que el servidor la recibe (localStorage: pocas KB).
//  - ids: para lo creado sin señal (cliente, producto, proveedor) el id temporal "tmp:…" y el id real del servidor.
//  - fotos: las fotos tomadas sin señal esperan en IndexedDB hasta subirse.
//  - números: bloque de números de nota reservados para este usuario.

const K = { cola: 'vm-cola', numeros: 'vm-numeros', perfil: 'vm-perfil', ids: 'vm-ids', copiaVieja: 'vm-copia',
  equipo: 'vm-equipo', contacto: 'vm-contacto', visto: 'vm-visto', bloqueado: 'vm-bloqueado', reinicio: 'vm-reinicio' };

function leer(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
function guardar(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (_) { return false; }
}
const avisar = () => window.dispatchEvent(new Event('vm:cola'));

// ---------- IndexedDB (clave → valor) ----------
let db = null;
function abrir() {
  if (db) return db;
  db = new Promise((ok, mal) => {
    if (!('indexedDB' in window)) { mal(new Error('sin IndexedDB')); return; }
    const r = indexedDB.open('vzlamanager', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return db;
}
async function idb(modo, fn) {
  const d = await abrir();
  return new Promise((ok, mal) => {
    const t = d.transaction('kv', modo), s = t.objectStore('kv');
    const r = fn(s);
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error || new Error('abortado'));
  });
}
const idbLeer = (k) => idb('readonly', (s) => s.get(k)).catch(() => null);
const idbGuardar = (k, v) => idb('readwrite', (s) => s.put(v, k));
const idbBorrar = (k) => idb('readwrite', (s) => s.delete(k)).catch(() => {});

// ---------- Perfil del usuario (para abrir la app sin señal) ----------
export const perfil = () => leer(K.perfil);
export const guardarPerfil = (p) => guardar(K.perfil, p);

// ---------- Copia de datos ----------
// { datos: { cats, prods, clis, peds, precios, provs, compras, abonos, negocio }, guardada, completa_en, cursor }
let copiaMem = null;
const fotosMem = new Map();   // clave → dataURL de las fotos que esperan subirse
export async function cargar() {
  copiaMem = await idbLeer('copia');
  try { localStorage.removeItem(K.copiaVieja); } catch (_) {}   // formato anterior (ya no se usa)
  for (const op of cola()) if (op.tipo === 'subirFoto') {
    const f = await idbLeer(`foto:${op.args[2]}`);
    if (f?.url) fotosMem.set(op.args[2], f.url);
  }
}
export const copia = () => copiaMem;
export const hayCopia = () => !!copiaMem?.datos;
export async function guardarCopia(c) {
  copiaMem = { ...c, guardada: new Date().toISOString() };
  try { await idbGuardar('copia', copiaMem); }
  catch (_) { /* sin espacio: queda en memoria mientras la app esté abierta */ }
}
export async function borrarCopia() {
  copiaMem = null; fotosMem.clear();
  try { localStorage.removeItem(K.numeros); localStorage.removeItem(K.ids); } catch (_) {}
  await idbBorrar('copia');
}
// Edad de la copia en minutos (Infinity si no hay)
export function edadCopia() {
  return copiaMem?.guardada ? (Date.now() - new Date(copiaMem.guardada).getTime()) / 60000 : Infinity;
}

// ---------- Cola de operaciones ----------
// { id, tipo, args, texto, en, estado: 'pendiente'|'error', error }
// Formato anterior (solo pedidos): { pedido, resumen } → se convierte.
export function cola() {
  return leer(K.cola, []).map((x) => (x.tipo ? x : {
    id: x.pedido.id, tipo: 'crearPedido', args: [x.pedido], en: x.en || x.pedido.fecha, estado: x.estado || 'pendiente', error: x.error || null,
    texto: `Pedido${x.pedido.numero ? ` N° ${String(x.pedido.numero).padStart(6, '0')}` : ''} · ${x.resumen?.cliente || 'cliente'}`,
  }));
}
export function encolar(op) {
  const c = cola().filter((x) => x.id !== op.id);
  c.push({ estado: 'pendiente', error: null, en: new Date().toISOString(), ...op });
  if (!guardar(K.cola, c)) throw new Error('El equipo no tiene espacio para guardar esto. Libera espacio e intenta de nuevo.');
  avisar();
}
export function vaciarCola() { guardar(K.cola, []); avisar(); }
// Último reinicio de datos del servidor que este equipo ya aplicó
export const reinicio = () => leer(K.reinicio);
export const marcarReinicio = (m) => guardar(K.reinicio, m);
export function quitarDeCola(id) { guardar(K.cola, cola().filter((x) => x.id !== id)); avisar(); }
export function marcarError(id, error) { guardar(K.cola, cola().map((x) => (x.id === id ? { ...x, estado: 'error', error } : x))); avisar(); }
export function reintentarErrores() { guardar(K.cola, cola().map((x) => ({ ...x, estado: 'pendiente', error: null }))); avisar(); }

// ---------- Ids temporales (creado sin señal) → id real ----------
export const ids = () => leer(K.ids, {});
export function guardarId(tmp, real) { const m = ids(); m[tmp] = real; guardar(K.ids, m); }

// ---------- Fotos que esperan subirse ----------
export async function guardarFoto(clave, blob, url) {
  fotosMem.set(clave, url);
  await idbGuardar(`foto:${clave}`, { blob, url });
}
export const urlFoto = (clave) => fotosMem.get(clave) || null;
export async function leerFoto(clave) { return (await idbLeer(`foto:${clave}`))?.blob || null; }
export async function borrarFoto(clave) { fotosMem.delete(clave); await idbBorrar(`foto:${clave}`); }

// ---------- Números de nota reservados (por usuario) ----------
function numeros(usuario) {
  const n = leer(K.numeros);
  return n && n.usuario === usuario ? n.lista : [];
}
export const numerosLibres = (usuario) => numeros(usuario).length;
export function agregarNumeros(usuario, lista) {
  const todos = [...new Set([...numeros(usuario), ...lista])].sort((a, b) => a - b);
  guardar(K.numeros, { usuario, lista: todos });
}
// Toma el menor número libre; null si no quedan (el servidor asigna uno al subir).
export function tomarNumero(usuario) {
  const l = numeros(usuario);
  if (!l.length) return null;
  const [n, ...resto] = l;
  guardar(K.numeros, { usuario, lista: resto });
  return n;
}
export function devolverNumero(usuario, n) { if (n != null) agregarNumeros(usuario, [n]); }

// ---------- Control de acceso (kill switch) ----------
// Código de este equipo: se genera una vez y no se borra (así un equipo bloqueado sigue bloqueado).
export function equipo() {
  let id = leer(K.equipo);
  if (!id) { id = crypto.randomUUID(); guardar(K.equipo, id); }
  return id;
}
export const codigoEquipo = () => { const h = equipo().replace(/-/g, '').toUpperCase(); return `${h.slice(0, 4)}-${h.slice(4, 8)}`; };
// Última vez que el servidor respondió (para bloquear tras muchos días sin señal) y la hora más alta vista en el
// equipo (si alguien atrasa el reloj para no llegar al límite, se nota).
export const contacto = () => leer(K.contacto);
export function marcarContacto() { const t = Date.now(); guardar(K.contacto, t); guardar(K.visto, t); }
export function marcarVisto() { const t = Date.now(); if (t > (leer(K.visto) || 0)) guardar(K.visto, t); }
export const visto = () => leer(K.visto);
export const bloqueado = () => leer(K.bloqueado);
export const marcarBloqueado = (motivo) => guardar(K.bloqueado, { motivo, en: new Date().toISOString() });
export const quitarBloqueo = () => { try { localStorage.removeItem(K.bloqueado); } catch (_) {} };
// Borra TODO lo que la app guarda en el equipo (copia, cambios por subir, fotos, números, perfil, sesión).
// Solo quedan el código del equipo y la marca de bloqueo.
export async function borrarTodo() {
  copiaMem = null; fotosMem.clear();
  try {
    const quedan = new Set([K.equipo, K.bloqueado]);
    Object.keys(localStorage).filter((k) => !quedan.has(k)).forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (_) {}
  try { (await db)?.close(); } catch (_) {}
  db = null;
  await new Promise((ok) => {
    try { const r = indexedDB.deleteDatabase('vzlamanager'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }
    catch (_) { ok(); }
  });
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (_) {}
}
