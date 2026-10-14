// Abre un enlace fuera de la app (Google Maps, navegador). En el celular usa el plugin nativo.
const cap = window.Capacitor;
const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Compartir = esApp ? ((cap.Plugins && cap.Plugins.Compartir) || cap.registerPlugin('Compartir')) : null;
export async function abrirExterno(url) {
  try { esApp ? await Compartir.abrirUrl({ url }) : window.open(url, '_blank', 'noopener'); }
  catch (_) { window.location.href = url; }
}
// Cualquier <a data-externo> se abre fuera de la app.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-externo]');
  if (a) { e.preventDefault(); abrirExterno(a.href); }
});
