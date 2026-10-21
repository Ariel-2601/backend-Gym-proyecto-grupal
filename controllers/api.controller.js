
import db from "../firebase.js";
import { FieldValue } from "firebase-admin/firestore";

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

// Convierte los Timestamp de Firestore a fechas ISO.
// También procesa objetos y arreglos anidados.
function limpiar(valor) {
  if (valor && typeof valor.toDate === "function") {
    return valor.toDate().toISOString();
  }

  if (Array.isArray(valor)) {
    return valor.map(limpiar);
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, limpiar(v)])
    );
  }

  return valor;
}

const conId = (doc) => ({
  ...limpiar(doc.data()),
  _id: doc.id,
});

const aFecha = (valor) => {
  const fecha = valor instanceof Date ? valor : new Date(limpiar(valor));
  return fecha;
};

// Normaliza los roles conocidos.
// No asigna automáticamente el rol de cliente.
function normalizarRol(rol) {
  const valor = String(rol || "").trim().toLowerCase();

  const equivalencias = {
    admin: "admin",
    administrador: "admin",
    entrenador: "entrenador",
    cliente: "cliente",
  };

  return equivalencias[valor] || null;
}

function esCliente(data) {
  return normalizarRol(data?.rol) === "cliente";
}

function fechaValida(valor) {
  return valor instanceof Date && !Number.isNaN(valor.getTime());
}

// =====================================================
// GET /api/usuarios/perfil
// Devuelve el perfil del usuario autenticado.
// =====================================================

export const perfilUsuarioAutenticado = async (req, res) => {
  try {
    const snap = await db.collection("usuarios").doc(req.user.uid).get();

    if (!snap.exists) {
      return res.status(404).json({
        message: "Perfil no encontrado para este usuario.",
      });
    }

    const data = limpiar(snap.data());

    const rol = normalizarRol(data.rol);

    if (!rol) {
      return res.status(409).json({
        message: "El perfil no tiene un rol válido.",
        rolRecibido: data.rol ?? null,
      });
    }

    // No exponer contraseñas antiguas.
    delete data.contraseña;
    delete data.password;

    return res.json({
      ...data,
      _id: snap.id,
      uid: snap.id,
      rol,
    });
  } catch (error) {
    console.error("Error al obtener el perfil:", error);

    return res.status(500).json({
      message: "No se pudo obtener el perfil del usuario.",
    });
  }
};

// =====================================================
// GET /api/clientes
// Lista clientes para administradores y entrenadores.
// =====================================================

export const listarClientes = async (req, res) => {
  const snap = await db.collection("usuarios").get();

  const items = snap.docs
    .filter((doc) => esCliente(doc.data()))
    .map((doc) => {
      const data = doc.data();

      return {
        _id: doc.id,
        uid: doc.id,
        nombre: data.nombre || data.name || null,
        email: data.email || data.correo || null,
        correo: data.correo || data.email || null,
        telefono: data.telefono || null,
        edad: data.edad ?? null,
        rol: normalizarRol(data.rol),
        membresia: limpiar(data.membresia || null),
      };
    })
    .sort((a, b) =>
      String(a.nombre || "").localeCompare(
        String(b.nombre || ""),
        "es"
      )
    )
    .slice(0, 500);

  res.json(items);
};

// =====================================================
// GET /api/clientes/:clienteId
// Obtiene el perfil de un cliente.
// =====================================================

export const perfil = async (req, res) => {
  const snap = await db.collection("usuarios").doc(req.clienteId).get();

  if (!snap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  res.json(conId(snap));
};

// =====================================================
// GET /api/asistencias/hoy
// Lista las asistencias de hoy.
// =====================================================

export const asistenciasHoy = async (req, res) => {
  // Hora local de Nicaragua: UTC-6.
  const hoy = new Date(Date.now() - 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [asistenciasSnap, usuariosSnap] = await Promise.all([
    db.collection("historial_asistencias").get(),
    db.collection("usuarios").get(),
  ]);

  const nombres = new Map();

  usuariosSnap.docs.forEach((doc) => {
    const data = doc.data();

    if (esCliente(data)) {
      nombres.set(
        doc.id,
        data.nombre || data.name || "Cliente sin nombre"
      );
    }
  });

  const items = asistenciasSnap.docs
    .filter((doc) => doc.id.endsWith(`_${hoy}`))
    .map((doc) => {
      const data = limpiar(doc.data());

      return {
        _id: doc.id,
        clienteId: data.clienteId,
        nombre:
          nombres.get(data.clienteId) || "Cliente sin nombre",
        fecha: data.fecha || null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.fecha || 0) - new Date(a.fecha || 0)
    );

  res.json(items);
};

// =====================================================
// GET /api/historial_asistencias?clienteId=...
// Consulta el historial del usuario autorizado.
// =====================================================

export const asistencias = async (req, res) => {
  const snap = await db
    .collection("historial_asistencias")
    .where("clienteId", "==", req.clienteId)
    .get();

  const items = snap.docs
    .map(conId)
    .sort(
      (a, b) =>
        new Date(b.fecha || 0) - new Date(a.fecha || 0)
    );

  res.json(items.slice(0, 100));
};

// =====================================================
// POST /api/historial_asistencias
// Registra una asistencia por día y usuario.
// =====================================================

export const registrarAsistencia = async (req, res) => {
  const hoy = new Date(Date.now() - 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const ref = db
    .collection("historial_asistencias")
    .doc(`${req.user.uid}_${hoy}`);

  try {
    await ref.create({
      clienteId: req.user.uid,
      fecha: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error.code === 6 || error.code === "already-exists") {
      return res.status(409).json({
        message: "Ya registraste tu asistencia de hoy.",
      });
    }

    throw error;
  }

  res.status(201).json({
    _id: ref.id,
    message: "Asistencia registrada correctamente.",
  });
};

// =====================================================
// GET /api/rutinas/:clienteId
// Consulta la rutina del cliente.
// =====================================================

export const rutina = async (req, res) => {
  const snap = await db
    .collection("rutinas")
    .doc(req.clienteId)
    .get();

  if (!snap.exists) {
    return res.json({
      _id: req.clienteId,
      dias: [],
    });
  }

  res.json(conId(snap));
};

// =====================================================
// AUXILIAR: valida y limpia los días de una rutina.
// =====================================================

function validarDiasRutina(dias) {
  if (!Array.isArray(dias) || dias.length === 0) {
    return {
      error: "La rutina debe tener al menos un día.",
    };
  }

  if (dias.length > 7) {
    return {
      error: "La rutina no puede tener más de 7 días.",
    };
  }

  const diasLimpios = dias
    .map((dia) => ({
      dia: String(dia?.dia || "").trim(),
      ejercicios: Array.isArray(dia?.ejercicios)
        ? dia.ejercicios
            .map((ej) => ({
              nombre: String(ej?.nombre || "").trim(),
              series: Number(ej?.series),
              repeticiones: Number(ej?.repeticiones),
            }))
            .filter(
              (ej) =>
                ej.nombre &&
                Number.isInteger(ej.series) &&
                ej.series >= 1 &&
                ej.series <= 50 &&
                Number.isInteger(ej.repeticiones) &&
                ej.repeticiones >= 1 &&
                ej.repeticiones <= 200
            )
        : [],
    }))
    .filter((dia) => dia.dia && dia.ejercicios.length > 0);

  if (diasLimpios.length === 0) {
    return {
      error: "Agrega al menos un ejercicio válido.",
    };
  }

  return { dias: diasLimpios };
}

// =====================================================
// POST /api/rutinas/:clienteId
// Crea o reemplaza la rutina del cliente.
// =====================================================

export const crearRutina = async (req, res) => {
  const { clienteId } = req.params;

  const clienteSnap = await db
    .collection("usuarios")
    .doc(clienteId)
    .get();

  if (!clienteSnap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  const resultado = validarDiasRutina(req.body?.dias);

  if (resultado.error) {
    return res.status(400).json({
      message: resultado.error,
    });
  }

  const ref = db.collection("rutinas").doc(clienteId);

  await ref.set({
    dias: resultado.dias,
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  res.status(201).json({
    _id: ref.id,
    dias: resultado.dias,
    message: "Rutina guardada correctamente.",
  });
};

// =====================================================
// PUT /api/rutinas/:clienteId
// Edita una rutina existente.
// =====================================================

export const editarRutina = async (req, res) => {
  const { clienteId } = req.params;

  const clienteSnap = await db
    .collection("usuarios")
    .doc(clienteId)
    .get();

  if (!clienteSnap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  const ref = db.collection("rutinas").doc(clienteId);
  const actual = await ref.get();

  if (!actual.exists) {
    return res.status(404).json({
      message: "El cliente todavía no tiene una rutina para editar.",
    });
  }

  const resultado = validarDiasRutina(req.body?.dias);

  if (resultado.error) {
    return res.status(400).json({
      message: resultado.error,
    });
  }

  await ref.set({
    dias: resultado.dias,
    actualizadoEn: FieldValue.serverTimestamp(),
  });

  res.json({
    _id: ref.id,
    dias: resultado.dias,
    message: "Rutina actualizada correctamente.",
  });
};

// =====================================================
// DELETE /api/rutinas/:clienteId
// Elimina la rutina del cliente.
// =====================================================

export const eliminarRutina = async (req, res) => {
  const { clienteId } = req.params;

  const clienteSnap = await db
    .collection("usuarios")
    .doc(clienteId)
    .get();

  if (!clienteSnap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  const ref = db.collection("rutinas").doc(clienteId);
  const actual = await ref.get();

  if (!actual.exists) {
    return res.status(404).json({
      message: "El cliente no tiene una rutina para eliminar.",
    });
  }

  await ref.delete();

  res.json({
    message: "Rutina eliminada correctamente.",
  });
};

// =====================================================
// GET /api/membresias
// Lista las membresías guardadas dentro de cada usuario.
// =====================================================

export const listarMembresias = async (req, res) => {
  const snap = await db.collection("usuarios").get();
  const hoy = new Date();

  const items = snap.docs
    .filter((doc) => esCliente(doc.data()))
    .map((doc) => {
      const data = doc.data();
      const membresiaOriginal = data.membresia || null;
      const membresia = membresiaOriginal
        ? limpiar(membresiaOriginal)
        : null;

      let activa = false;

      if (membresia?.fechaFin) {
        const fechaFin = aFecha(membresia.fechaFin);

        activa =
          fechaValida(fechaFin) &&
          fechaFin >= hoy &&
          membresia.activa !== false;
      }

      return {
        _id: doc.id,
        uid: doc.id,
        nombre: data.nombre || data.name || null,
        email: data.email || data.correo || null,
        membresia: membresia
          ? {
              ...membresia,
              activa,
            }
          : null,
      };
    })
    .sort((a, b) =>
      String(a.nombre || "").localeCompare(
        String(b.nombre || ""),
        "es"
      )
    )
    .slice(0, 500);

  res.json(items);
};

// =====================================================
// GET /api/membresias/:clienteId
// Consulta la membresía guardada en el usuario.
// =====================================================

export const membresia = async (req, res) => {
  const snap = await db
    .collection("usuarios")
    .doc(req.clienteId)
    .get();

  if (!snap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  const data = snap.data();
  const membresiaData = data.membresia;

  if (!membresiaData) {
    return res.status(404).json({
      message: "Aún no tienes una membresía registrada.",
    });
  }

  res.json({
    _id: snap.id,
    clienteId: snap.id,
    ...limpiar(membresiaData),
  });
};

// =====================================================
// PUT /api/membresias/:clienteId
// Crea o renueva la membresía dentro del usuario.
// Body: { tipo, fechaInicio, fechaFin, duracionDias?, precio? }
// =====================================================

export const guardarMembresia = async (req, res) => {
  const { clienteId } = req.params;

  const ref = db.collection("usuarios").doc(clienteId);
  const clienteSnap = await ref.get();

  if (!clienteSnap.exists) {
    return res.status(404).json({
      message: "Cliente no encontrado.",
    });
  }

  if (!esCliente(clienteSnap.data())) {
    return res.status(400).json({
      message: "Solo puedes asignar membresías a usuarios con rol cliente.",
    });
  }

  const tipo = String(req.body?.tipo || "").trim();
  const fechaInicio = String(req.body?.fechaInicio || "").trim();
  const fechaFin = String(req.body?.fechaFin || "").trim();

  if (!tipo) {
    return res.status(400).json({
      message: "Indica el tipo de membresía.",
    });
  }

  const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;

  if (!formatoFecha.test(fechaInicio) || !formatoFecha.test(fechaFin)) {
    return res.status(400).json({
      message: "Las fechas deben tener formato AAAA-MM-DD.",
    });
  }

  const inicio = new Date(`${fechaInicio}T00:00:00.000Z`);
  const fin = new Date(`${fechaFin}T23:59:59.999Z`);

  if (!fechaValida(inicio) || !fechaValida(fin)) {
    return res.status(400).json({
      message: "Las fechas proporcionadas no son válidas.",
    });
  }

  if (
    inicio.toISOString().slice(0, 10) !== fechaInicio ||
    fin.toISOString().slice(0, 10) !== fechaFin
  ) {
    return res.status(400).json({
      message: "Las fechas proporcionadas no son válidas.",
    });
  }

  if (fin < inicio) {
    return res.status(400).json({
      message: "La fecha de vencimiento no puede ser anterior al inicio.",
    });
  }

  const dataActual = clienteSnap.data();
  const membresiaActual = dataActual.membresia || {};

  const duracionCalculada =
    Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1;

  const duracionSolicitada = Number(req.body?.duracionDias);
  const precioSolicitado =
    req.body?.precio === undefined || req.body?.precio === null
      ? membresiaActual.precio
      : Number(req.body.precio);

  if (
    precioSolicitado !== undefined &&
    precioSolicitado !== null &&
    (!Number.isFinite(Number(precioSolicitado)) ||
      Number(precioSolicitado) < 0)
  ) {
    return res.status(400).json({
      message: "El precio debe ser un número válido mayor o igual a cero.",
    });
  }

  const membresiaNueva = {
    ...membresiaActual,
    tipo,
    fechaInicio: inicio.toISOString(),
    fechaFin: fin.toISOString(),
    duracionDias:
      Number.isInteger(duracionSolicitada) && duracionSolicitada > 0
        ? duracionSolicitada
        : duracionCalculada,
    activa: fin >= new Date(),
    actualizadoEn: FieldValue.serverTimestamp(),
  };

  if (precioSolicitado !== undefined && precioSolicitado !== null) {
    membresiaNueva.precio = Number(precioSolicitado);
  }

  await ref.update({
    membresia: membresiaNueva,
  });

  const actualizado = await ref.get();
  const resultado = limpiar(actualizado.data().membresia);

  res.json({
    _id: actualizado.id,
    clienteId: actualizado.id,
    ...resultado,
  });
};

// =====================================================
// GET /api/productos
// Devuelve los productos de Firestore.
// =====================================================

export const productos = async (req, res) => {
  const snap = await db.collection("productos").get();

  res.json(snap.docs.map(conId));
};

// =====================================================
// GET /api/dashboard/kpis
// Devuelve indicadores del gimnasio.
// =====================================================

export const kpis = async (req, res) => {
  const ahora = new Date();
  const inicioMes = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    1
  );

  const [asistenciasSnap, ventasSnap, usuariosSnap] =
    await Promise.all([
      db.collection("historial_asistencias").get(),
      db.collection("ventas").get(),
      db.collection("usuarios").get(),
    ]);

  const asistenciasMes = asistenciasSnap.docs.filter((doc) => {
    const fecha = aFecha(doc.get("fecha"));

    return fechaValida(fecha) && fecha >= inicioMes;
  }).length;

  const ventasDelMes = ventasSnap.docs.filter((doc) => {
    const fecha = aFecha(doc.get("fecha"));

    return fechaValida(fecha) && fecha >= inicioMes;
  });

  const ventasMes = ventasDelMes.reduce(
    (suma, doc) => suma + (Number(doc.get("total")) || 0),
    0
  );

  // Cuenta los productos vendidos a partir de los artículos de cada venta.
  const conteo = {};

  for (const doc of ventasSnap.docs) {
    const items = doc.get("items") || [];

    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const nombre = String(item?.nombre || "").trim();
      const cantidad = Number(item?.cantidad) || 0;

      if (!nombre || cantidad <= 0) continue;

      conteo[nombre] = (conteo[nombre] || 0) + cantidad;
    }
  }

  const productoTop =
    Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  // Calcula la retención con las membresías embebidas en usuarios.
  const membresias = usuariosSnap.docs
    .filter((doc) => esCliente(doc.data()))
    .map((doc) => doc.data().membresia)
    .filter(Boolean);

  const vigentes = membresias.filter((membresiaData) => {
    if (membresiaData.activa === false || !membresiaData.fechaFin) {
      return false;
    }

    const fechaFin = aFecha(membresiaData.fechaFin);

    return fechaValida(fechaFin) && fechaFin >= ahora;
  }).length;

  const retencion =
    membresias.length > 0
      ? Math.round((vigentes / membresias.length) * 100)
      : 0;

  res.json({
    asistenciasMes,
    ventasMes,
    retencion,
    productoTop,
  });
};

// =====================================================
// GET /api/registro_progreso?clienteId=...
// Consulta el progreso del usuario autorizado.
// =====================================================

export const progreso = async (req, res) => {
  const snap = await db
    .collection("registro_progreso")
    .where("clienteId", "==", req.clienteId)
    .get();

  const items = snap.docs
    .map(conId)
    .sort(
      (a, b) =>
        new Date(a.fecha || 0) - new Date(b.fecha || 0)
    );

  res.json(items.slice(-500));
};

// =====================================================
// POST /api/registro_progreso
// Body: { ejercicioId, nombreEjercicio, pesoKg, repeticiones }
// =====================================================

export const registrarProgreso = async (req, res) => {
  const {
    ejercicioId,
    nombreEjercicio,
    pesoKg,
    repeticiones,
  } = req.body || {};

  const peso = Number(pesoKg);
  const reps = Number(repeticiones);

  if (
    !Number.isFinite(peso) ||
    peso <= 0 ||
    !Number.isFinite(reps) ||
    !Number.isInteger(reps) ||
    reps <= 0
  ) {
    return res.status(400).json({
      message: "Peso y repeticiones deben ser números válidos mayores a 0.",
    });
  }

  const ref = await db.collection("registro_progreso").add({
    clienteId: req.user.uid,
    ejercicioId: ejercicioId ?? null,
    nombreEjercicio: nombreEjercicio ?? null,
    pesoKg: peso,
    repeticiones: reps,
    fecha: FieldValue.serverTimestamp(),
  });

  res.status(201).json({
    _id: ref.id,
    message: "Progreso registrado correctamente.",
  });
};
