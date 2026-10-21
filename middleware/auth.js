
import { getAuth } from "firebase-admin/auth";
import db from "../firebase.js";

export async function verificarToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Falta el token de sesión.",
    });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    console.error("Error verificando token:", error.message);

    return res.status(401).json({
      message: "Sesión inválida o expirada. Inicia sesión de nuevo.",
    });
  }
}

// Convierte los nombres de rol a un formato uniforme.
function normalizarRol(valor) {
  const rol = String(valor || "").trim().toLowerCase();

  const equivalencias = {
    admin: "admin",
    administrador: "admin",
    entrenador: "entrenador",
    cliente: "cliente",
  };

  return equivalencias[rol] || null;
}

async function obtenerRol(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();

  if (!snap.exists) {
    throw new Error("USUARIO_SIN_PERFIL");
  }

  const rol = normalizarRol(snap.data().rol);

  if (!rol) {
    throw new Error("USUARIO_SIN_ROL_VALIDO");
  }

  return rol;
}

export async function propioOStaff(req, res, next) {
  try {
    const pedido =
      req.params.clienteId ||
      req.query.clienteId ||
      req.user.uid;

    if (pedido !== req.user.uid) {
      const rol = await obtenerRol(req.user.uid);

      if (rol !== "admin" && rol !== "entrenador") {
        return res.status(403).json({
          message: "Solo puedes consultar tus propios datos.",
        });
      }
    }

    req.clienteId = pedido;
    return next();
  } catch (error) {
    console.error("Error verificando permisos:", error.message);

    return res.status(
      error.message === "USUARIO_SIN_PERFIL" ||
      error.message === "USUARIO_SIN_ROL_VALIDO"
        ? 403
        : 500
    ).json({
      message: "No se pudieron verificar los permisos del usuario.",
    });
  }
}

export async function soloStaff(req, res, next) {
  try {
    const rol = await obtenerRol(req.user.uid);

    if (rol !== "admin" && rol !== "entrenador") {
      return res.status(403).json({
        message: "No tienes permiso para ver esto.",
      });
    }

    return next();
  } catch (error) {
    console.error("Error verificando permisos de staff:", error.message);

    return res.status(
      error.message === "USUARIO_SIN_PERFIL" ||
      error.message === "USUARIO_SIN_ROL_VALIDO"
        ? 403
        : 500
    ).json({
      message: "No se pudieron verificar los permisos del usuario.",
    });
  }
}

export async function soloAdmin(req, res, next) {
  try {
    const rol = await obtenerRol(req.user.uid);

    if (rol !== "admin") {
      return res.status(403).json({
        message: "Solo el administrador puede acceder a esta función.",
      });
    }

    return next();
  } catch (error) {
    console.error("Error verificando permisos de administrador:", error.message);

    return res.status(
      error.message === "USUARIO_SIN_PERFIL" ||
      error.message === "USUARIO_SIN_ROL_VALIDO"
        ? 403
        : 500
    ).json({
      message: "No se pudieron verificar los permisos del administrador.",
    });
  }
}
