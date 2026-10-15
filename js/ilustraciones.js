// Ilustraciones propias (decorativas) para las pantallas de confirmación. Usan los colores del tema.
const base = (cuerpo) => `<svg class="ilu" viewBox="0 0 280 170" aria-hidden="true">
  <ellipse cx="140" cy="160" rx="126" ry="9" fill="var(--hoja-suave)"/>${cuerpo}
  <circle cx="34" cy="34" r="4" fill="var(--amarillo)"/><circle cx="262" cy="92" r="3" fill="var(--amarillo)"/></svg>`;
const visto = (x, y) => `<circle cx="${x}" cy="${y}" r="19" fill="var(--hoja)"/><path d="M${x - 9} ${y}l6 6 12-13" fill="none" stroke="var(--sobre-hoja)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

export const ILU = {
  // Nota lista: hoja de la nota con líneas y el visto
  nota: base(`<rect x="92" y="18" width="96" height="132" rx="10" fill="var(--superficie)" stroke="var(--oscuro)" stroke-width="3"/>
    <rect x="92" y="18" width="96" height="22" rx="10" fill="var(--hoja)"/><rect x="92" y="30" width="96" height="10" fill="var(--hoja)"/>
    <path d="M108 60h64M108 76h64M108 92h44M108 118h30" stroke="var(--hoja-borde)" stroke-width="6" stroke-linecap="round"/>
    <path d="M150 118h22" stroke="var(--oscuro)" stroke-width="6" stroke-linecap="round"/>${visto(196, 36)}`),
  // Entrega confirmada: camión con cajas frente a la bodega
  entrega: base(`<rect x="150" y="58" width="110" height="98" rx="6" fill="var(--superficie)"/>
    <path d="M142 46h126l-6 22H148z" fill="var(--hoja)"/>
    <path d="M160 46l-3 22M184 46l-2 22M208 46v22M232 46l2 22" stroke="var(--superficie)" stroke-width="7" opacity=".85"/>
    <rect x="166" y="90" width="34" height="66" rx="3" fill="var(--hoja-suave)"/>
    <rect x="18" y="92" width="86" height="50" rx="6" fill="var(--oscuro)"/><path d="M104 104h22l14 18v20h-36z" fill="var(--acento)"/>
    <rect x="112" y="108" width="14" height="12" rx="2" fill="var(--hoja-suave)"/>
    <circle cx="44" cy="146" r="11" fill="var(--texto)"/><circle cx="44" cy="146" r="4" fill="var(--hoja-suave)"/>
    <circle cx="120" cy="146" r="11" fill="var(--texto)"/><circle cx="120" cy="146" r="4" fill="var(--hoja-suave)"/>
    <rect x="30" y="72" width="30" height="24" rx="3" fill="#F2CF68"/><rect x="62" y="78" width="26" height="18" rx="3" fill="#E9BE45"/>${visto(232, 24)}`),
  // Pago registrado: billetes y monedas
  pago: base(`<rect x="62" y="56" width="132" height="76" rx="10" fill="var(--acento)" transform="rotate(-8 128 94)"/>
    <rect x="80" y="64" width="132" height="76" rx="10" fill="var(--hoja)" stroke="var(--oscuro)" stroke-width="3"/>
    <circle cx="146" cy="102" r="20" fill="var(--superficie)" stroke="var(--oscuro)" stroke-width="3"/>
    <path d="M146 92v20M140 97h9a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9" fill="none" stroke="var(--oscuro)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="226" cy="140" rx="20" ry="7" fill="#E9BE45"/><rect x="206" y="124" width="40" height="16" fill="#E9BE45"/><ellipse cx="226" cy="124" rx="20" ry="7" fill="#F2CF68"/>${visto(214, 40)}`),
};

export const celebra = (tipo, titulo, texto) => `<div class="celebra">${ILU[tipo]}<h2 class="celebra-t">${titulo}</h2><p class="celebra-s">${texto}</p></div>`;
