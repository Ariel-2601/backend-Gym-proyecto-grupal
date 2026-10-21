import db from "../firebase.js";

function comoFecha(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export const obtenerKpis = async (req, res) => {
  try {
    const ahora = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const [asistenciasSnap, ventasSnap, usuariosSnap] = await Promise.all([
      db.collection("historial_asistencias").get(),
      db.collection("ventas").get(),
      db.collection("usuarios").get(),
    ]);
    const asistenciasMes = asistenciasSnap.docs.filter((doc) => {
      const fecha = comoFecha(doc.get("fecha"));
      return fecha && fecha >= inicio && fecha <= ahora;
    }).length;
    let ventasMes = 0;
    const conteo = {};
    ventasSnap.docs.forEach((doc) => {
      const data = doc.data();
      const fecha = comoFecha(data.fecha);
      if (fecha && fecha >= inicio && fecha <= ahora) ventasMes += Number(data.total) || 0;
      for (const item of (Array.isArray(data.items) ? data.items : [])) {
        if (!item?.nombre) continue;
        conteo[item.nombre] = (conteo[item.nombre] || 0) + (Number(item.cantidad) || 1);
      }
    });
    const productoTop = Object.entries(conteo).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
    const clientes = usuariosSnap.docs.filter((doc) => doc.data().rol === "cliente");
    const vigentes = clientes.filter((doc) => {
      const fechaFin = comoFecha(doc.get("membresia.fechaFin"));
      return fechaFin && fechaFin >= ahora;
    }).length;
    const retencion = clientes.length ? Math.round((vigentes / clientes.length) * 100) : 0;
    res.json({ asistenciasMes, ventasMes, retencion, productoTop });
  } catch (error) {
    console.error("Error obteniendo KPIs:", error);
    res.status(500).json({ message: "Error al obtener los indicadores." });
  }
};
