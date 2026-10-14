// Ciudad de la nota según la ubicación del equipo (GPS). Funciona sin conexión: busca el pueblo o ciudad más
// cercano en una lista incluida en la app (ciudades-ve.js). Solo se guarda el nombre de la ciudad, nunca las coordenadas.
import { CIUDADES_VE } from './ciudades-ve.js';

const CLAVE = 'vm-ciudad';            // última ciudad detectada en este equipo
const MAX_KM = 60;                    // más lejos que esto no se asume ninguna ciudad

function masCercana(lat, lng) {
  let mejor = null, dMin = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const [nombre, la, lo] of CIUDADES_VE) {
    const d = Math.hypot(la - lat, (lo - lng) * k) * 111.2;   // km aproximados
    if (d < dMin) { dMin = d; mejor = nombre; }
  }
  return dMin <= MAX_KM ? mejor : null;
}

export function ultimaCiudad() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null')?.nombre || null; } catch { return null; }
}

let enCurso = null;
/** Pide la ubicación (una vez cada pocos minutos) y devuelve la ciudad más cercana, o null si no se pudo. */
export function ciudadActual({ espera = 10000 } = {}) {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  enCurso ||= new Promise((ok) => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const nombre = masCercana(pos.coords.latitude, pos.coords.longitude);
      if (nombre) try { localStorage.setItem(CLAVE, JSON.stringify({ nombre, t: Date.now() })); } catch { /* sin memoria del equipo */ }
      ok(nombre);
    }, () => ok(null), { enableHighAccuracy: false, timeout: espera, maximumAge: 15 * 60 * 1000 });
  }).finally(() => { setTimeout(() => { enCurso = null; }, 60 * 1000); });
  return enCurso;
}
