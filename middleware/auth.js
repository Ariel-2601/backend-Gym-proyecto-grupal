import { getAuth } from "firebase-admin/auth";
import db from "../firebase.js"; // asegura que Firebase Admin esté inicializado

// 1) Verifica el idToken de Firebase que manda la app en "Authorization: Bearer <token>"
export async function verificarToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Falta el token de sesión." });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (e) {
    res
      .status(401)
      .json({ message: "Sesión inválida o expirada. Inicia sesión de nuevo." });
  }
}

// Lee el rol del usuario desde la colección "clientes" (campo "rol")
async function obtenerRol(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  return snap.exists ? snap.data().rol || "cliente" : "cliente";
}

// 2) Un cliente solo puede ver SUS datos; admin/entrenador pueden ver los de cualquiera.
//    Deja el id resultante en req.clienteId
export async function propioOStaff(req, res, next) {
  try {
    const pedido = req.params.clienteId || req.query.clienteId || req.user.uid;
    if (pedido !== req.user.uid) {
      const rol = await obtenerRol(req.user.uid);
      if (rol !== "admin" && rol !== "entrenador") {
        return res
          .status(403)
          .json({ message: "Solo puedes consultar tus propios datos." });
      }
    }
    req.clienteId = pedido;
    next();
  } catch (e) {
    next(e);
  }
}

// 3) Solo admin / entrenador
export async function soloStaff(req, res, next) {
  try {
    const rol = await obtenerRol(req.user.uid);
    if (rol !== "admin" && rol !== "entrenador") {
      return res.status(403).json({ message: "No tienes permiso para ver esto." });
    }
    next();
  } catch (e) {
    next(e);
  }
}
