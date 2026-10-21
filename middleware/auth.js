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

  if (!snap.exists) {
    throw Object.assign(
      new Error("No existe el perfil del usuario en Firestore."),
      { status: 404 }
    );
  }

  const rol = String(snap.data().rol || "").trim().toLowerCase();
  const rolesPermitidos = ["admin", "entrenador", "cliente"];

  if (!rolesPermitidos.includes(rol)) {
    throw Object.assign(
      new Error("El perfil no tiene un rol válido."),
      { status: 409 }
    );
  }

  return rol;
}



// 2) Un cliente solo puede ver SUS datos; admin/entrenador pueden ver los de cualquiera.
//    Deja el id resultante en req.clienteId
export async function propioOStaff(req, res, next) {
  try {
    const pedido = req.params.clienteId || req.query.clienteId || req.user.uid;
    if (pedido !== req.user.uid) {
      const rol = String(await obtenerRol(req.user.uid)).trim().toLowerCase();
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
    const rol = String(await obtenerRol(req.user.uid)).trim().toLowerCase();
    if (rol !== "admin" && rol !== "entrenador") {
      return res.status(403).json({ message: "No tienes permiso para ver esto." });
    }
    next();
  } catch (e) {
    next(e);
  }
}


// Solo el administrador puede consultar los KPI del gimnasio.
export async function soloAdmin(req, res, next) {
  try {
    const rol = String(await obtenerRol(req.user.uid)).trim().toLowerCase();
    if (rol !== "admin") {
      return res.status(403).json({ message: "Solo el administrador puede acceder a los KPI." });
    }
    next();
  } catch (e) {
    next(e);
  }
}
