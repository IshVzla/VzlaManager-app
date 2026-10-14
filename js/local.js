// Lo que el equipo guarda para trabajar sin señal:
//  - copia: clientes, productos, precios y configuración (se renueva con señal);
//  - cola: pedidos tomados sin señal, en orden, hasta que el servidor los recibe;
//  - números: bloque de números de nota reservados para este usuario.
// Todo vive en localStorage (pocos KB para unos cientos de clientes y productos).

const K = { copia: 'vm-copia', cola: 'vm-cola', numeros: 'vm-numeros', perfil: 'vm-perfil' };

function leer(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
function guardar(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (_) { return false; } // sin espacio: la app sigue, solo sin copia nueva
}
const avisar = () => window.dispatchEvent(new Event('vm:cola'));

// ---------- Perfil del usuario (para abrir la app sin señal) ----------
export const perfil = () => leer(K.perfil);
export const guardarPerfil = (p) => guardar(K.perfil, p);

// ---------- Copia de datos ----------
export const copia = () => leer(K.copia);
export const hayCopia = () => !!copia();
export function guardarCopia(c) { guardar(K.copia, { ...c, guardada: new Date().toISOString() }); }
export const borrarCopia = () => { try { localStorage.removeItem(K.copia); localStorage.removeItem(K.numeros); } catch (_) {} };
// Edad de la copia en minutos (Infinity si no hay)
export function edadCopia() {
  const c = copia();
  return c?.guardada ? (Date.now() - new Date(c.guardada).getTime()) / 60000 : Infinity;
}

// ---------- Cola de pedidos tomados sin señal ----------
// { pedido (lo que se envía a crear_pedido), resumen: { cliente, total }, estado: 'pendiente'|'error', error }
export const cola = () => leer(K.cola, []);
export function encolar(pedido, resumen) {
  // Un mismo pedido (mismo id) nunca queda dos veces en la cola: se reemplaza.
  const c = cola().filter((x) => x.pedido.id !== pedido.id);
  c.push({ pedido, resumen, estado: 'pendiente', error: null, en: new Date().toISOString() });
  if (!guardar(K.cola, c)) throw new Error('El equipo no tiene espacio para guardar esto. Libera espacio e intenta de nuevo.');
  avisar();
}
export function quitarDeCola(id) { guardar(K.cola, cola().filter((x) => x.pedido.id !== id)); avisar(); }
export function marcarError(id, error) {
  guardar(K.cola, cola().map((x) => (x.pedido.id === id ? { ...x, estado: 'error', error } : x))); avisar();
}
export function reintentarErrores() {
  guardar(K.cola, cola().map((x) => ({ ...x, estado: 'pendiente', error: null }))); avisar();
}

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
// Si el servidor rechazó el pedido por otra razón, el número vuelve al bloque.
export function devolverNumero(usuario, n) { if (n != null) agregarNumeros(usuario, [n]); }
