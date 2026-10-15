// Tema claro/oscuro. Se elige solo en Ajustes > Avanzado y se guarda en este celular.
// Se carga antes que los estilos para que la app no aparezca en blanco un instante.
(function () {
  var t = null;
  try { t = localStorage.getItem('vm.tema'); } catch (e) { /* sin almacenamiento: queda claro */ }
  if (t === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
})();

// iPhone con la web agregada a la pantalla de inicio (modo app, barra de estado translúcida): Safari calcula el alto
// "100%" restando la barra de estado y deja una franja vacía bajo el menú. En ese modo la app ocupa toda la pantalla,
// así que se fija el alto real (--alto, usado por html y body en app.css). En el navegador y en Android no se toca.
(function () {
  if (!window.navigator.standalone) return;
  var raiz = document.documentElement;
  function ajustar() {
    var vertical = window.matchMedia('(orientation: portrait)').matches;
    var pantalla = vertical ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    raiz.style.setProperty('--alto', Math.max(window.innerHeight, pantalla) + 'px');
  }
  ajustar();
  window.addEventListener('resize', ajustar);
  window.addEventListener('orientationchange', function () { setTimeout(ajustar, 300); });
})();
