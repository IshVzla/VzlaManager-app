// Botón "atrás" de Android: hace lo mismo que la flecha ← de la barra superior.
// MainActivity.java llama a window.vmAtras(); si devuelve false, la app se minimiza (no se cierra).
window.vmAtras = () => {
  // 1) Aviso de versión nueva: atrás no lo salta (sale de la app)
  if (document.querySelector('.act-capa')) return false;
  // 2) Paso "Revisar precios": vuelve a la lista de productos sin perder lo elegido
  const volver = document.querySelector('#vista #volver');
  if (volver) { volver.click(); return true; }
  // 3) Flecha ← de la barra superior (en la lista de productos de un pedido, pide confirmar si hay productos elegidos)
  const flecha = document.querySelector('#barra a.barra-btn[aria-label="Volver"]');
  const conf = window.vmConfirmarSalida;
  if (flecha && conf && conf.hash === location.hash && !conf.fn()) return true;
  if (flecha) { location.hash = flecha.getAttribute('href'); return true; }
  // 4) En otra pestaña principal (Clientes, Inventario…): vuelve a Pedidos
  const ruta = (location.hash || '#/pedidos').split('?')[0];
  if (!/^#\/(pedidos|login)?$/.test(ruta) && document.querySelector('#tabs')?.offsetParent) { location.hash = '#/pedidos'; return true; }
  // 5) Inicio (Pedidos) o ingreso: el equipo minimiza la app
  return false;
};
