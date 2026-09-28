import db from "../firebase.js";
import { FieldValue } from "firebase-admin/firestore";

// Firestore devuelve las fechas como Timestamp; la app espera strings ISO
// y usa "_id" como identificador. Esto adapta los documentos a ese formato.
function limpiar(valor) {
  if (valor && typeof valor.toDate === "function") return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, limpiar(v)]));
  }
  return valor;
}
const conId = (doc) => ({ _id: doc.id, ...limpiar(doc.data()) });
const aFecha = (v) => new Date(limpiar(v));

// GET /api/clientes/:clienteId
export const perfil = async (req, res) => {
  const snap = await db.collection("clientes").doc(req.clienteId).get();
  if (!snap.exists) return res.status(404).json({ message: "Cliente no encontrado." });
  res.json(conId(snap));
};

// GET /api/historial_asistencias?clienteId=...
export const asistencias = async (req, res) => {
  const snap = await db
    .collection("historial_asistencias")
    .where("clienteId", "==", req.clienteId)
    .get();
  // Se ordena en memoria para no obligarte a crear un índice compuesto en Firestore
  const items = snap.docs.map(conId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(items.slice(0, 100));
};

// GET /api/rutinas/:clienteId  ->  { dias: [{ dia, ejercicios: [...] }] }
export const rutina = async (req, res) => {
  const snap = await db.collection("rutinas").doc(req.clienteId).get();
  if (!snap.exists) return res.json({ dias: [] });
  res.json(conId(snap));
};

// GET /api/membresias/:clienteId  ->  { tipo, fechaInicio, fechaFin }
export const membresia = async (req, res) => {
  const snap = await db.collection("membresias").doc(req.clienteId).get();
  if (!snap.exists) {
    return res.status(404).json({ message: "Aún no tienes una membresía registrada." });
  }
  res.json(conId(snap));
};

// GET /api/productos
export const productos = async (req, res) => {
  const snap = await db.collection("productos").get();
  res.json(snap.docs.map(conId));
};

// GET /api/dashboard/kpis  (solo admin / entrenador)
export const kpis = async (req, res) => {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [asist, ventas, membresias] = await Promise.all([
    db.collection("historial_asistencias").get(),
    db.collection("ventas").get(),
    db.collection("membresias").get(),
  ]);

  const asistenciasMes = asist.docs.filter((d) => aFecha(d.get("fecha")) >= inicioMes).length;

  const ventasDelMes = ventas.docs.filter((d) => aFecha(d.get("fecha")) >= inicioMes);
  const ventasMes = ventasDelMes.reduce((suma, d) => suma + (Number(d.get("total")) || 0), 0);

  // Producto más vendido: suma "cantidad" de cada item de las ventas
  const conteo = {};
  for (const d of ventas.docs) {
    for (const it of d.get("items") || []) {
      conteo[it.nombre] = (conteo[it.nombre] || 0) + (Number(it.cantidad) || 1);
    }
  }
  const productoTop = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Retención (simplificada): % de membresías que siguen vigentes
  const vigentes = membresias.docs.filter((d) => aFecha(d.get("fechaFin")) >= ahora).length;
  const retencion = membresias.size ? Math.round((vigentes / membresias.size) * 100) : 0;

  res.json({ asistenciasMes, ventasMes, retencion, productoTop });
};

// GET /api/registro_progreso?clienteId=...  ->  [{ _id, ejercicioId, nombreEjercicio, pesoKg, repeticiones, fecha }]
export const progreso = async (req, res) => {
  const snap = await db
    .collection("registro_progreso")
    .where("clienteId", "==", req.clienteId)
    .get();
  // Se ordena en memoria (de más antiguo a más reciente) para no requerir un índice compuesto
  const items = snap.docs.map(conId).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  res.json(items.slice(-500));
};

// POST /api/registro_progreso  { ejercicioId, nombreEjercicio, pesoKg, repeticiones }
export const registrarProgreso = async (req, res) => {
  const { ejercicioId, nombreEjercicio, pesoKg, repeticiones } = req.body || {};

  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || !Number.isFinite(repeticiones) || repeticiones <= 0) {
    return res.status(400).json({ message: "Peso y repeticiones deben ser números mayores a 0." });
  }

  const ref = await db.collection("registro_progreso").add({
    clienteId: req.user.uid, // siempre el del token, nunca el que mande el cliente
    ejercicioId: ejercicioId ?? null,
    nombreEjercicio: nombreEjercicio ?? null,
    pesoKg,
    repeticiones,
    fecha: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ _id: ref.id });
};
