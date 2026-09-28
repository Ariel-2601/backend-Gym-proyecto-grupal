import db from "../firebase.js";

// Ajusta estos nombres si tus colecciones en Firestore se llaman distinto.
const COL_ASISTENCIAS = "asistencias";
const COL_VENTAS = "ventas";
const COL_CLIENTES = "clientes";
const COL_PRODUCTOS = "productos";

function inicioYFinDeMesActual() {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return { inicio, fin };
}

export const obtenerKpis = async (req, res) => {
  try {
    const { inicio, fin } = inicioYFinDeMesActual();

    // --- Asistencias del mes ---
    // Asume que cada documento de "asistencias" tiene un campo "fecha"
    // guardado como Firestore Timestamp.
    const asistenciasSnap = await db
      .collection(COL_ASISTENCIAS)
      .where("fecha", ">=", inicio)
      .where("fecha", "<", fin)
      .get();
    const asistenciasMes = asistenciasSnap.size;

    // --- Ventas del mes ---
    // Asume que cada documento de "ventas" tiene "fecha" (Timestamp)
    // y "monto" (número).
    const ventasSnap = await db
      .collection(COL_VENTAS)
      .where("fecha", ">=", inicio)
      .where("fecha", "<", fin)
      .get();
    let ventasMes = 0;
    const conteoProductos = {};
    ventasSnap.forEach((doc) => {
      const data = doc.data();
      ventasMes += Number(data.monto) || 0;

      // Para "producto más vendido": asume "productoNombre" en cada venta,
      // o "productoId" + "cantidad".
      const nombre = data.productoNombre;
      const cantidad = Number(data.cantidad) || 1;
      if (nombre) {
        conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cantidad;
      }
    });

    let productoTop = null;
    let maxVendido = 0;
    for (const [nombre, cantidad] of Object.entries(conteoProductos)) {
      if (cantidad > maxVendido) {
        maxVendido = cantidad;
        productoTop = nombre;
      }
    }

    // --- Retención de clientes ---
    // Cálculo simple: % de clientes con membresía activa sobre el total.
    // Asume que "clientes" tiene un campo "membresiaActiva" (boolean)
    // o "estado" === "activo". Ajusta según tu esquema real.
    const clientesSnap = await db.collection(COL_CLIENTES).get();
    const totalClientes = clientesSnap.size;
    let clientesActivos = 0;
    clientesSnap.forEach((doc) => {
      const data = doc.data();
      if (data.membresiaActiva === true || data.estado === "activo") {
        clientesActivos++;
      }
    });
    const retencion =
      totalClientes > 0
        ? Math.round((clientesActivos / totalClientes) * 100)
        : 0;

    res.json({
      asistenciasMes,
      ventasMes,
      retencion,
      productoTop,
    });
  } catch (error) {
    console.error("Error obteniendo KPIs:", error);
    res.status(500).json({ mensaje: "Error al obtener los indicadores." });
  }
};