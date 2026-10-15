// Prepara una foto para subirla: la recorta cuadrada al centro y la reduce (≈600 px, JPEG),
// para que pese poco y cargue rápido con mala señal.
export async function prepararFoto(archivo, lado = 600) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la imagen. Prueba con otra foto.')); i.src = url; });
    const corte = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = Math.min(lado, corte);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}

// Foto de un documento (factura, guía): sin recortar, lado largo ≤ 1600 px para que se lea la letra chica,
// y bajo 1 MB (límite del servidor) bajando la calidad si hace falta.
export async function prepararDocumento(archivo, largo = 1600) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la imagen. Prueba con otra foto.')); i.src = url; });
    const k = Math.min(1, largo / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.78, 0.65, 0.5, 0.38]) {
      const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
      if (b && b.size < 1000000) return b;
    }
    throw new Error('La foto quedó muy pesada. Tómala de nuevo con buena luz.');
  } finally { URL.revokeObjectURL(url); }
}
