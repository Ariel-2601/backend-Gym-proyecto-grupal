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

// GET /api/clientes  (solo admin / entrenador)
export const listarClientes = async (req, res) => {
  const snap = await db.collection("clientes").get();
  const items = snap.docs
    .filter((doc) => {
      const rol = doc.data().rol;
      return !rol || rol === "cliente";
    })
    .map((doc) => {
      const data = doc.data();
      return {
        _id: doc.id,
        nombre: data.nombre || data.name || null,
        email: data.email || data.correo || null,
      };
    })
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"))
    .slice(0, 500);
  res.json(items);
};

<<<<<<< HEAD

=======
>>>>>>> 11bdf2d (Entrenador editar)
// GET /api/asistencias/hoy  (solo admin / entrenador)
export const asistenciasHoy = async (req, res) => {
  const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
  const snap = await db.collection("historial_asistencias").get();
  const docs = snap.docs.filter((doc) => doc.id.endsWith(`_${hoy}`));

  const clientesSnap = await db.collection("clientes").get();
  const nombres = new Map();
  clientesSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.rol || data.rol === "cliente") {
      nombres.set(doc.id, data.nombre || data.name || null);
    }
  });

  const items = docs.map((doc) => {
    const data = limpiar(doc.data());
    return {
      _id: doc.id,
      clienteId: data.clienteId,
      nombre: nombres.get(data.clienteId) || "Cliente sin nombre",
      fecha: data.fecha,
    };
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  res.json(items);
};

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

// POST /api/historial_asistencias  (sin body)
// Registra la asistencia de HOY para el usuario del token. Una por día.
// El id del documento es "<uid>_<AAAA-MM-DD>" (día en hora de Nicaragua, UTC-6),
// así que un segundo intento el mismo día falla solo, sin índices ni consultas extra.
export const registrarAsistencia = async (req, res) => {
  const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = db.collection("historial_asistencias").doc(`${req.user.uid}_${hoy}`);
  try {
    await ref.create({
      clienteId: req.user.uid, // siempre el del token
      fecha: FieldValue.serverTimestamp(), // hora del servidor
    });
  } catch (e) {
    if (e.code === 6) {
      // 6 = ALREADY_EXISTS
      return res.status(409).json({ message: "Ya registraste tu asistencia de hoy." });
    }
    throw e;
  }
  res.status(201).json({ _id: ref.id });
};

// GET /api/rutinas/:clienteId  ->  { dias: [{ dia, ejercicios: [...] }] }
export const rutina = async (req, res) => {
  const snap = await db.collection("rutinas").doc(req.clienteId).get();
  if (!snap.exists) return res.json({ dias: [] });
  res.json(conId(snap));
};

// POST /api/rutinas/:clienteId  -> crea/reemplaza la rutina del cliente
export const crearRutina = async (req, res) => {
  const { clienteId } = req.params;
  const clienteSnap = await db.collection("clientes").doc(clienteId).get();
  if (!clienteSnap.exists) return res.status(404).json({ message: "Cliente no encontrado." });

  const dias = Array.isArray(req.body?.dias) ? req.body.dias : [];
  if (!dias.length) return res.status(400).json({ message: "La rutina debe tener al menos un día." });
  if (dias.length > 7) return res.status(400).json({ message: "La rutina no puede tener más de 7 días." });

  const diasLimpios = dias.map((dia) => ({
    dia: String(dia?.dia || "").trim(),
    ejercicios: Array.isArray(dia?.ejercicios)
      ? dia.ejercicios.map((ej) => ({
          nombre: String(ej?.nombre || "").trim(),
          series: Number(ej?.series),
          repeticiones: Number(ej?.repeticiones),
        })).filter((ej) => ej.nombre && Number.isInteger(ej.series) && ej.series >= 1 && ej.series <= 50 && Number.isInteger(ej.repeticiones) && ej.repeticiones >= 1 && ej.repeticiones <= 200)
      : [],
  })).filter((dia) => dia.dia && dia.ejercicios.length);

  if (!diasLimpios.length) return res.status(400).json({ message: "Agrega al menos un ejercicio válido." });

  const ref = db.collection("rutinas").doc(clienteId);
  await ref.set({ dias: diasLimpios });
  res.status(201).json({ _id: ref.id, dias: diasLimpios });
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