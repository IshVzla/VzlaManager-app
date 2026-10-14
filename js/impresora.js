// Impresión de la nota.
//  - Térmica por Bluetooth (solo en la app Android): la nota se dibuja como imagen del ancho del papel (58 u 80 mm)
//    y se envía en comandos ESC/POS. La impresora debe estar vinculada en el Bluetooth del equipo.
//  - Impresora normal: la nota en PDF media carta (original y copia); en la app Android se abre el PDF y se imprime
//    desde el visor; en el iPhone, desde el menú Compartir; en el PC, con el diálogo de impresión.
import { dibujarTira } from './tira.js';

const cap = window.Capacitor;
export const esApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const Printer = esApp ? ((cap.Plugins && cap.Plugins.BtPrinter) || cap.registerPlugin('BtPrinter')) : null;

const leer = (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };

// Configuración de este equipo (Ajustes → Impresoras)
export const config = {
  get termica() { return leer('vm-termica'); }, set termica(v) { guardar('vm-termica', v); },               // dirección Bluetooth
  get termicaNombre() { return leer('vm-termica-nombre', ''); }, set termicaNombre(v) { guardar('vm-termica-nombre', v); },
  get ancho() { return leer('vm-termica-ancho', '58'); }, set ancho(v) { guardar('vm-termica-ancho', v); },   // '58' | '80'
  get copias() { return Number(leer('vm-termica-copias', '2')); }, set copias(v) { guardar('vm-termica-copias', String(v)); },
};
export const hayTermica = () => esApp && !!config.termica;

export async function buscarImpresoras() {
  if (!esApp) return [];
  const { devices } = await Printer.listPaired();
  return devices;
}

// Imprime la nota en la térmica: original (cliente) y copia (negocio, para la firma), según config.copias.
export async function imprimirTermica(n, negocio) {
  if (!esApp) throw new Error('La impresora térmica se usa desde la app Android.');
  if (!config.termica) throw new Error('Primero elige la impresora térmica en Ajustes → Impresoras.');
  const puntos = config.ancho === '80' ? 576 : 384;
  const copias = Math.max(1, Math.min(3, config.copias || 1));
  let bytes = [0x1B, 0x40];
  for (let i = 0; i < copias; i++) {
    const canvas = await dibujarTira(n, negocio, { ancho: puntos, etiqueta: copias > 1 ? (i === 0 ? 'ORIGINAL · CLIENTE' : 'COPIA · NEGOCIO') : '' });
    bytes = bytes.concat(aEscPos(canvas), [0x1B, 0x64, 5]);   // imagen + avance para cortar
  }
  let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.slice(i, i + 8192));
  await Printer.print({ address: config.termica, data: btoa(bin) });
}

// Imagen (canvas en blanco y negro) → comandos ESC/POS "GS v 0" en franjas.
function aEscPos(canvas, umbral = 170) {
  const { width, height } = canvas;
  const px = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const bytesFila = width / 8, FRANJA = 255, out = [];
  for (let y0 = 0; y0 < height; y0 += FRANJA) {
    const h = Math.min(FRANJA, height - y0);
    out.push(0x1D, 0x76, 0x30, 0x00, bytesFila & 0xFF, bytesFila >> 8, h & 0xFF, h >> 8);
    for (let y = y0; y < y0 + h; y++) {
      for (let bx = 0; bx < bytesFila; bx++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = (y * width + bx * 8 + bit) * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum < umbral) b |= 0x80 >> bit;
        }
        out.push(b);
      }
    }
  }
  return out;
}
