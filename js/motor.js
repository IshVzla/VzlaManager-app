// Motor local: las mismas reglas del negocio que el servidor, aplicadas sobre los datos guardados en el equipo.
// Lo usan el modo demostración (datos de ejemplo) y el trabajo sin señal (copia descargada + operaciones en cola).
// Las funciones de lectura devuelven copias; las de escritura cambian la copia (store) y devuelven el resultado.
//
// store = { cats, prods, clis, peds (con items), precios (últimos precios del servidor), provs, compras (con items),
//           abonos, negocio }
// ctx   = { usuario(): { id, rol }, resolver(id): id real si era temporal, nuevoId(tipo): id para algo nuevo, ahora(): ISO }
import { r2, diaVe } from './ui.js';

const mismo = (a, b) => a != null && b != null && String(a) === String(b);
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const copiar = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const n = (x) => (x == null || x === '' ? null : Number(x));
const falla = (m) => { throw new Error(m); };

export function crearMotor(store, ctx) {
  const yo = () => ctx.usuario() || {};
  const esAdmin = () => yo().rol === 'admin';
  const ahora = () => (ctx.ahora ? ctx.ahora() : new Date().toISOString());
  const id = (x) => (ctx.resolver ? ctx.resolver(x) : x);
  const buscar = (lista, x) => lista.find((k) => mismo(k.id, x) || mismo(k.id, id(x)));
  const cli = (x) => buscar(store.clis, x);
  const prod = (x) => buscar(store.prods, x);
  const ped = (x) => store.peds.find((k) => k.id === x);
  const ivaNegocio = () => (store.negocio?.iva_activo ? Number(store.negocio.iva_pct) || 0 : 0);
  const totales = (p) => {
    p.subtotal = r2(p.items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0));
    p.iva = r2(p.subtotal * (Number(p.iva_pct) || 0) / 100);
    p.total = r2(p.subtotal + p.iva);
  };
  const porEntregar = () => {
    const m = new Map();
    for (const p of store.peds) if (p.estado === 'pendiente') for (const i of p.items) m.set(String(i.producto_id), (m.get(String(i.producto_id)) || 0) + Number(i.cantidad));
    return m;
  };
  const conCliente = (p) => ({ ...p, cliente: cli(p.cliente_id)?.nombre || p.cliente || '—' });
  const lista = (p) => { const { items, ...r } = conCliente(p); return copiar(r); };
  // El precio cobrado pasa a ser el precio base si es mayor y la nota no es más vieja que el último cambio (0009).
  const subirBase = (pid, precio, fecha) => {
    const p = prod(pid); if (!p) return;
    if (!(Number(precio) > (Number(p.precio) || 0))) return;
    if (p.precio_actualizado_en && fecha < p.precio_actualizado_en) return;
    p.precio = r2(precio); p.precio_actualizado_en = fecha;
  };
  const moverStock = (pid, cant) => { const p = prod(pid); if (p) p.stock = (Number(p.stock) || 0) + cant; };
  const linea = (p, cantidad, precio, pedida = cantidad) => ({
    producto_id: p.id, nombre: p.nombre, presentacion: p.presentacion || null, cantidad, cantidad_pedida: pedida,
    precio: r2(precio), precio_base: n(p.precio), costo: n(p.costo), subtotal: r2(cantidad * precio),
  });

  const m = {
    // ---------------- Negocio ----------------
    configuracion: () => copiar(store.negocio || {}),
    guardarConfiguracion(neg) { store.negocio = copiar(neg); return copiar(neg); },

    // ---------------- Clientes ----------------
    clientes({ busqueda = '', inactivos = false } = {}) {
      const b = normal(busqueda);
      return store.clis.filter((c) => (inactivos || c.activo !== false) && (!b || normal([c.nombre, c.razon_social, c.rif, c.ciudad].join(' ')).includes(b)))
        .map((c) => {
          const suyos = store.peds.filter((p) => mismo(p.cliente_id, c.id) && p.estado !== 'anulado');
          const ultimo = suyos.map((p) => p.fecha).sort().pop() || store.precios?.filter((x) => mismo(x.cliente_id, c.id)).map((x) => x.fecha).sort().pop() || null;
          return copiar({ ...c, pedidos_pendientes: suyos.filter((p) => p.estado === 'pendiente').length,
            por_cobrar: r2(suyos.filter((p) => !p.pagado_en).reduce((s, p) => s + Number(p.total || 0), 0)), ultimo_pedido: ultimo });
        })
        .sort((a, z) => a.nombre.localeCompare(z.nombre, 'es'));
    },
    cliente(x) {
      const c = m.clientes({ inactivos: true }).find((k) => mismo(k.id, x) || mismo(k.id, id(x)));
      if (!c) falla('No se encontró este cliente en el equipo.');
      return c;
    },
    guardarCliente(c) {
      if (!String(c.nombre || '').trim() && !buscar(store.clis, c.id)) falla('Escribe el nombre del cliente.');
      const x = c.id != null ? cli(c.id) : null;
      if (x) {
        if (x.anonimizado_en) falla('Este cliente tiene sus datos eliminados: no se puede cambiar.');
        const { id: _i, uid: _u, ...campos } = c; Object.assign(x, campos); return copiar(x);
      }
      const nuevo = { correo: null, contacto: null, condiciones_pago: null, notas: null, imagen_url: null, anonimizado_en: null, activo: true,
        ...c, id: c.id ?? ctx.nuevoId('cliente'), creado_en: ahora() };
      store.clis.push(nuevo); return copiar(nuevo);
    },
    anonimizarCliente(x) {
      if (!esAdmin()) falla('Solo un administrador puede eliminar los datos de un cliente.');
      const c = cli(x); if (!c) falla('El cliente no existe.');
      Object.assign(c, { nombre: `Cliente eliminado N° ${c.id}`, razon_social: null, rif: null, domicilio_fiscal: null, ciudad: null, contacto: null,
        telefono: null, correo: null, notas: null, imagen_url: null, activo: false, anonimizado_en: c.anonimizado_en || ahora() });
    },

    // ---------------- Productos ----------------
    categorias: () => copiar([...(store.cats || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))),
    productos({ busqueda = '', soloActivos = true } = {}) {
      const b = normal(busqueda), pe = porEntregar();
      return store.prods.filter((p) => (!soloActivos || p.activo !== false) && (!b || normal(`${p.nombre} ${p.codigo || ''} ${p.presentacion || ''}`).includes(b)))
        .map((p) => {
          const comp = pe.get(String(p.id)) || 0;
          return copiar({ ...p, costo: n(p.costo), precio: n(p.precio), categoria: store.cats?.find((c) => mismo(c.id, p.categoria_id))?.nombre || null,
            porEntregar: comp, disponible: (Number(p.stock) || 0) - comp });
        })
        .sort((a, z) => (a.orden ?? 0) - (z.orden ?? 0) || a.nombre.localeCompare(z.nombre, 'es'));
    },
    producto(x) {
      const p = m.productos({ soloActivos: false }).find((k) => mismo(k.id, x) || mismo(k.id, id(x)));
      if (!p) falla('No se encontró este producto.');
      return p;
    },
    guardarProducto(p) {
      if (p.costo != null && Number(p.costo) < 0) falla('El costo no puede ser negativo.');
      if (p.precio != null && Number(p.precio) < 0) falla('El precio no puede ser negativo.');
      const { stock_inicial, mov_uid, ...campos } = p;
      const x = p.id != null ? prod(p.id) : null;
      if (x) {
        if (campos.codigo && store.prods.some((k) => k !== x && k.codigo && normal(k.codigo) === normal(campos.codigo))) falla('Ya existe un producto con ese código.');
        const { id: _i, uid: _u, ...resto } = campos;
        if (resto.precio != null && Number(resto.precio) !== Number(x.precio)) resto.precio_actualizado_en = ahora();   // cambio a mano
        Object.assign(x, resto, { actualizado_en: ahora() }); return copiar(x);
      }
      if (!String(campos.nombre || '').trim()) falla('Escribe el nombre del producto.');
      if (campos.codigo && store.prods.some((k) => k.codigo && normal(k.codigo) === normal(campos.codigo))) falla('Ya existe un producto con ese código.');
      const nuevo = { codigo: null, presentacion: null, categoria_id: null, costo: 0, precio: 0, stock_minimo: null, orden: 0, activo: true, imagen_url: null,
        ...campos, id: campos.id ?? ctx.nuevoId('producto'), stock: Number(stock_inicial) || 0, actualizado_en: ahora(), precio_actualizado_en: ahora() };
      store.prods.push(nuevo); return copiar(nuevo);
    },
    ajustarStock(pid, cantidad) {
      if (!esAdmin()) falla('Solo el administrador ajusta el stock.');
      if (!prod(pid)) falla('No se encontró este producto.');
      moverStock(pid, Number(cantidad));
    },
    ultimosPrecios(clienteId) {
      const r = new Map();
      for (const x of (store.precios || []).filter((k) => mismo(k.cliente_id, clienteId) || mismo(k.cliente_id, id(clienteId))))
        r.set(x.producto_id, { precio: n(x.precio), fecha: x.fecha });
      for (const p of store.peds.filter((k) => (mismo(k.cliente_id, clienteId) || mismo(k.cliente_id, id(clienteId))) && k.estado !== 'anulado').sort((a, b) => a.fecha.localeCompare(b.fecha)))
        for (const i of p.items) if (i.cantidad > 0) { const ant = r.get(i.producto_id); if (!ant || ant.fecha <= p.fecha) r.set(i.producto_id, { precio: n(i.precio), fecha: p.fecha }); }
      // Se sugiere el precio más nuevo: el del cliente solo si es posterior al último cambio del precio base
      for (const [pid, x] of r) { const pr = prod(pid); if (pr && Number(pr.precio) > 0 && pr.precio_actualizado_en && x.fecha < pr.precio_actualizado_en) r.delete(pid); }
      return r;
    },

    // ---------------- Pedidos ----------------
    pedidos({ estado = '', clienteId = null } = {}) {
      return store.peds.filter((p) => (!estado || p.estado === estado) && (!clienteId || mismo(p.cliente_id, clienteId) || mismo(p.cliente_id, id(clienteId))))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).map(lista);
    },
    pedido(x) {
      const p = ped(x);
      if (!p) falla('No se encontró esta nota en el equipo.');
      const c = cli(p.cliente_id) || {};
      const r = store.peds.find((k) => k.reemplaza_a === p.id);
      return copiar({ ...conCliente(p), datosCliente: c,
        reemplazado_por: r ? { id: r.id, numero: r.numero } : null,
        reemplaza: p.reemplaza_a ? { id: p.reemplaza_a, numero: ped(p.reemplaza_a)?.numero ?? null } : null });
    },
    crearPedido(p) {
      const ya = ped(p.id); if (ya) return copiar(ya);
      if (!p.items?.length) falla('El pedido no tiene productos');
      const c = cli(p.cliente_id);
      if (!c) falla('El cliente no existe');
      if (c.anonimizado_en) falla('Este cliente tiene sus datos eliminados: créalo como cliente nuevo.');
      const items = p.items.map((i) => {
        const pr = prod(i.producto_id); if (!pr) falla(`El producto ${i.nombre || ''} no existe`);
        const cant = Number(i.cantidad); if (!(cant > 0) || !Number.isInteger(cant)) falla(`Cantidad no válida para ${pr.nombre}`);
        const precio = r2(i.precio ?? pr.precio); if (precio < 0) falla(`Precio no válido para ${pr.nombre}`);
        return linea(pr, cant, precio);
      });
      const nuevo = { id: p.id, numero: p.numero ?? null, cliente_id: c.id, usuario_id: yo().id, fecha: p.fecha || ahora(),
        ciudad: p.ciudad || store.negocio?.ciudad || null, condiciones_pago: p.condiciones_pago || c.condiciones_pago || store.negocio?.condiciones_pago || null,
        notas: p.notas?.trim() || null, entrega_programada: p.entrega_programada || null, estado: 'pendiente', iva_pct: ivaNegocio(), items,
        modificado_en_entrega: false, entregado_en: null, pagado_en: null, forma_pago: null, tasa_bcv: null, monto_bs: null, referencia_pago: null, reemplaza_a: null };
      totales(nuevo); nuevo.total_pedido = nuevo.total;
      store.peds.push(nuevo);
      for (const i of items) subirBase(i.producto_id, i.precio, nuevo.fecha);
      return copiar(nuevo);
    },
    reemplazarPedido(x, motivo, p) {
      const ya = ped(p.id); if (ya) return copiar(ya);
      const o = ped(x); if (!o) falla('El pedido no existe');
      if (o.estado !== 'pendiente' || o.pagado_en) falla('Solo se puede editar un pedido por entregar y sin pagar.');
      if (!mismo(p.cliente_id, o.cliente_id) && !mismo(id(p.cliente_id), id(o.cliente_id))) falla('El pedido corregido debe ser del mismo cliente.');
      m.anularPedido(x, motivo);
      const nuevo = m.crearPedido({ ...p, entrega_programada: p.entrega_programada || o.entrega_programada });
      ped(nuevo.id).reemplaza_a = x;
      return copiar(ped(nuevo.id));
    },
    anularPedido(x, motivo) {
      if (!String(motivo || '').trim()) falla('Escribe el motivo de la anulación.');
      const p = ped(x); if (!p) falla('El pedido no existe');
      if (p.estado === 'anulado') return copiar(p);
      if (!mismo(p.usuario_id, yo().id) && !esAdmin()) falla('Solo puedes anular tus propios pedidos. Pide a un administrador que lo anule.');
      if ((p.estado === 'entregado' || p.pagado_en) && !esAdmin()) falla('Solo un administrador puede anular una nota entregada o pagada.');
      if (p.estado === 'entregado') for (const i of p.items) if (i.cantidad > 0) moverStock(i.producto_id, Number(i.cantidad));
      Object.assign(p, { estado: 'anulado', anulado_motivo: motivo.trim(), anulado_en: ahora() });
      return copiar(p);
    },
    programarEntrega(x, fecha) {
      const p = ped(x);
      if (!p || p.estado !== 'pendiente') falla('Solo se puede programar la entrega de un pedido por entregar.');
      p.entrega_programada = fecha || null; return copiar(p);
    },
    // items (opcional): lo que de verdad se entrega [{ producto_id, cantidad, precio }]
    registrarEntrega(x, items = null, fecha = null) {
      const p = ped(x); if (!p) falla('El pedido no existe');
      if (p.estado === 'entregado') return copiar(p);
      if (p.estado === 'anulado') falla('Este pedido está anulado: no se puede entregar.');
      if (items) {
        if (p.pagado_en) falla('Esta nota ya está pagada: no se pueden cambiar sus cantidades al entregar.');
        if (!items.some((i) => Number(i.cantidad) > 0)) falla('La entrega no tiene productos. Si no se entrega nada, anula la nota.');
        let mod = false;
        for (const i of p.items) if (i.cantidad > 0 && !items.some((k) => mismo(k.producto_id, i.producto_id))) { i.cantidad = 0; i.subtotal = 0; mod = true; }
        for (const k of items) {
          const cant = Number(k.cantidad); if (!Number.isInteger(cant) || cant < 0) falla('Cantidad no válida');
          const pr = prod(k.producto_id); if (!pr) falla(`El producto ${k.nombre || ''} no existe`);
          const i = p.items.find((l) => mismo(l.producto_id, k.producto_id));
          const precio = r2(k.precio ?? i?.precio ?? pr.precio); if (precio < 0) falla(`Precio no válido para ${pr.nombre}`);
          if (i) { if (i.cantidad !== cant || Number(i.precio) !== precio) { Object.assign(i, { cantidad: cant, precio, subtotal: r2(cant * precio) }); mod = true; } }
          else if (cant > 0) { p.items.push(linea(pr, cant, precio, 0)); mod = true; }
        }
        if (mod) { totales(p); p.modificado_en_entrega = true; }
      }
      for (const i of p.items) if (i.cantidad > 0) moverStock(i.producto_id, -Number(i.cantidad));
      Object.assign(p, { estado: 'entregado', entregado_en: fecha || ahora() });
      for (const i of p.items) if (i.cantidad > 0) subirBase(i.producto_id, i.precio, p.entregado_en);
      return copiar(p);
    },
    registrarPago(x, pago) {
      const p = ped(x); if (!p) falla('El pedido no existe');
      if (p.pagado_en) return copiar(p);
      if (p.estado === 'anulado') falla('Este pedido está anulado: no se puede cobrar.');
      if (!String(pago.forma_pago || '').trim()) falla('Indica la forma de pago.');
      if (pago.tasa_bcv != null && !(Number(pago.tasa_bcv) > 0)) falla('La tasa BCV debe ser mayor que cero.');
      if (pago.monto_bs != null && Number(pago.monto_bs) < 0) falla('El monto en bolívares no puede ser negativo.');
      Object.assign(p, { pagado_en: pago.fecha || ahora(), forma_pago: pago.forma_pago.trim(), tasa_bcv: n(pago.tasa_bcv),
        monto_bs: pago.monto_bs != null ? r2(pago.monto_bs) : pago.tasa_bcv ? r2(p.total * pago.tasa_bcv) : null, referencia_pago: pago.referencia?.trim() || null });
      return copiar(p);
    },

    // ---------------- Cotizaciones ----------------
    // No son notas: no tienen número, no mueven stock ni cuentan en ventas, ni cambian el precio base.
    cotizaciones({ clienteId = null } = {}) {
      return (store.cots || []).filter((k) => !k.eliminada_en && (!clienteId || mismo(k.cliente_id, clienteId) || mismo(k.cliente_id, id(clienteId))))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).map((k) => { const { items, ...r } = conCliente(k); return copiar({ ...r, productos: items.length }); });
    },
    cotizacion(x) {
      const k = (store.cots || []).find((c) => c.id === x);
      if (!k || k.eliminada_en) falla('No se encontró esta cotización (puede que la hayan eliminado).');
      const c = cli(k.cliente_id);
      const ped0 = k.pedido_id ? ped(k.pedido_id) : null;
      return copiar({ ...conCliente(k), datosCliente: c, pedido: k.pedido_id ? { id: k.pedido_id, numero: ped0?.numero ?? null } : null });
    },
    crearCotizacion(p) {
      store.cots ||= [];
      const ya = store.cots.find((k) => k.id === p.id); if (ya) return copiar(ya);
      if (!p.items?.length) falla('La cotización no tiene productos');
      const c = cli(p.cliente_id);
      if (!c) falla('El cliente no existe');
      if (c.anonimizado_en) falla('Este cliente tiene sus datos eliminados: créalo como cliente nuevo.');
      const items = p.items.map((i) => {
        const pr = prod(i.producto_id); if (!pr) falla(`El producto ${i.nombre || ''} no existe`);
        const cant = Number(i.cantidad); if (!(cant > 0) || !Number.isInteger(cant)) falla(`Cantidad no válida para ${pr.nombre}`);
        const precio = r2(i.precio ?? pr.precio); if (precio < 0) falla(`Precio no válido para ${pr.nombre}`);
        return { producto_id: pr.id, nombre: pr.nombre, presentacion: pr.presentacion || null, cantidad: cant, precio, subtotal: r2(cant * precio) };
      });
      const nueva = { id: p.id, cliente_id: c.id, usuario_id: yo().id, fecha: p.fecha || ahora(), valida_hasta: p.valida_hasta || null,
        ciudad: p.ciudad || store.negocio?.ciudad || null, condiciones_pago: p.condiciones_pago || c.condiciones_pago || store.negocio?.condiciones_pago || null,
        notas: p.notas?.trim() || null, items, iva_pct: ivaNegocio(), pedido_id: null, eliminada_en: null };
      totales(nueva);
      store.cots.push(nueva); return copiar(nueva);
    },
    eliminarCotizacion(x) {
      const k = (store.cots || []).find((c) => c.id === x); if (!k) falla('La cotización no existe');
      if (!mismo(k.usuario_id, yo().id) && !esAdmin()) falla('Solo puedes eliminar tus propias cotizaciones.');
      k.eliminada_en ||= ahora(); return copiar(k);
    },
    cotizacionAPedido(x, pedidoId) {
      const k = (store.cots || []).find((c) => c.id === x); if (!k) falla('La cotización no existe');
      k.pedido_id = pedidoId; return copiar(k);
    },

    // ---------------- Reportes ----------------
    notasEntre(campo, desde, hasta) {
      return store.peds.filter((p) => p.estado !== 'anulado' && p[campo] && diaVe(p[campo]) >= desde && diaVe(p[campo]) <= hasta)
        .sort((a, b) => a[campo].localeCompare(b[campo])).map((p) => copiar(conCliente(p)));
    },
    porCobrar() { return store.peds.filter((p) => p.estado !== 'anulado' && !p.pagado_en).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(lista); },
    pendientesConDetalle() { return store.peds.filter((p) => p.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => copiar(conCliente(p))); },

    // ---------------- Proveedores ----------------
    proveedores() { return store.provs.map(deudaDe).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); },
    proveedor(x) {
      if (!esAdmin()) falla('Solo el administrador ve a los proveedores.');
      const pr = buscar(store.provs, x); if (!pr) falla('No se encontró este proveedor.');
      const orden = (a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creado_en || '').localeCompare(String(a.creado_en || ''));
      return copiar({ ...deudaDe(pr),
        compras: store.compras.filter((c) => mismo(c.proveedor_id, pr.id)).sort(orden).map((c) => ({ ...c, productos: c.items.length })),
        abonos: store.abonos.filter((a) => mismo(a.proveedor_id, pr.id)).sort(orden) });
    },
    guardarProveedor(p) {
      const x = p.id != null ? buscar(store.provs, p.id) : null;
      if (x) { const { id: _i, uid: _u, ...campos } = p; Object.assign(x, campos); return copiar(x); }
      if (!String(p.nombre || '').trim()) falla('Escribe el nombre del proveedor.');
      if (store.provs.some((k) => normal(k.nombre) === normal(p.nombre))) falla('Ya existe un proveedor con ese nombre.');
      const nuevo = { rif: null, telefono: null, notas: null, saldo_inicial: 0, activo: true, ...p, id: p.id ?? ctx.nuevoId('proveedor'), creado_en: ahora() };
      store.provs.push(nuevo); return copiar(nuevo);
    },
    compra(x) {
      const c = store.compras.find((k) => k.id === x); if (!c) falla('No se encontró esta compra.');
      return copiar({ ...c, proveedor: buscar(store.provs, c.proveedor_id)?.nombre || '—' });
    },
    registrarCompra(c) {
      if (!esAdmin()) falla('Solo el administrador registra compras.');
      const ya = store.compras.find((k) => k.id === c.id); if (ya) return copiar(ya);
      if (!c.items?.length) falla('La compra no tiene productos.');
      const pr = buscar(store.provs, c.proveedor_id); if (!pr) falla('El proveedor no existe.');
      const vistos = new Set();
      const items = c.items.map((i, k) => {
        const p = prod(i.producto_id); if (!p) falla(`El producto ${i.nombre || ''} no existe`);
        const cant = Number(i.cantidad), costo = r2(i.costo);
        if (!Number.isInteger(cant) || cant <= 0) falla(`Cantidad no válida para ${p.nombre}`);
        if (!(costo >= 0)) falla(`Costo no válido para ${p.nombre}`);
        if (vistos.has(String(p.id))) falla(`${p.nombre} está repetido en la compra.`); vistos.add(String(p.id));
        return { id: k + 1, producto_id: p.id, nombre: p.nombre, cantidad: cant, costo, subtotal: r2(cant * costo) };
      });
      const nueva = { id: c.id, proveedor_id: pr.id, fecha: c.fecha || diaVe(), documento: c.documento?.trim() || null, notas: c.notas?.trim() || null,
        estado: 'vigente', items, total: r2(items.reduce((s, i) => s + i.subtotal, 0)), creado_en: ahora() };
      for (const i of items) { moverStock(i.producto_id, i.cantidad); if (c.actualizar_costo !== false) prod(i.producto_id).costo = i.costo; }
      store.compras.push(nueva); return copiar(nueva);
    },
    anularCompra(x, motivo) {
      if (!esAdmin()) falla('Solo el administrador anula compras.');
      if (!String(motivo || '').trim()) falla('Escribe el motivo de la anulación.');
      const c = store.compras.find((k) => k.id === x); if (!c) falla('La compra no existe');
      if (c.estado === 'anulada') return copiar(c);
      for (const i of c.items) moverStock(i.producto_id, -i.cantidad);
      Object.assign(c, { estado: 'anulada', anulado_motivo: motivo.trim() }); return copiar(c);
    },
    registrarAbonoProveedor(a) {
      if (!esAdmin()) falla('Solo el administrador registra abonos.');
      const ya = store.abonos.find((k) => k.id === a.id); if (ya) return copiar(ya);
      const monto = r2(a.monto);
      if (!(monto > 0)) falla('El monto del abono debe ser mayor que cero.');
      if (a.tasa_bcv != null && !(Number(a.tasa_bcv) > 0)) falla('La tasa BCV debe ser mayor que cero.');
      const pr = buscar(store.provs, a.proveedor_id); if (!pr) falla('El proveedor no existe.');
      const nuevo = { id: a.id, proveedor_id: pr.id, fecha: a.fecha || diaVe(), monto, forma_pago: a.forma_pago?.trim() || null, tasa_bcv: n(a.tasa_bcv),
        monto_bs: a.monto_bs != null ? r2(a.monto_bs) : a.tasa_bcv ? r2(monto * a.tasa_bcv) : null, referencia: a.referencia?.trim() || null,
        estado: 'vigente', creado_en: ahora() };
      store.abonos.push(nuevo); return copiar(nuevo);
    },
    anularAbonoProveedor(x, motivo) {
      if (!esAdmin()) falla('Solo el administrador anula abonos.');
      if (!String(motivo || '').trim()) falla('Escribe el motivo de la anulación.');
      const a = store.abonos.find((k) => k.id === x); if (!a) falla('El abono no existe');
      if (a.estado === 'vigente') Object.assign(a, { estado: 'anulado', anulado_motivo: motivo.trim() });
      return copiar(a);
    },
  };

  function deudaDe(pr) {
    const comprado = r2(store.compras.filter((c) => mismo(c.proveedor_id, pr.id) && c.estado === 'vigente').reduce((s, c) => s + Number(c.total), 0));
    const abonado = r2(store.abonos.filter((a) => mismo(a.proveedor_id, pr.id) && a.estado === 'vigente').reduce((s, a) => s + Number(a.monto), 0));
    return copiar({ ...pr, saldo_inicial: Number(pr.saldo_inicial) || 0, comprado, abonado, deuda: r2((Number(pr.saldo_inicial) || 0) + comprado - abonado) });
  }
  return m;
}
