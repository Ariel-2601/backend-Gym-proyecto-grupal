import bcrypt from "bcryptjs";
import db from "../firebase.js";

const COLECCION = "usuarios";

// POST /usuarios/registro
export const registrarUsuario = async (req, res) => {
  try {
    const { nombre, correo, contraseña } = req.body;

    if (!nombre || !correo || !contraseña) {
      return res.status(400).json({
        mensaje: "Los campos nombre, correo y contraseña son obligatorios.",
      });
    }

    const usuariosRef = db.collection(COLECCION);

    // Verificar que el correo no exista ya
    const existente = await usuariosRef.where("correo", "==", correo).limit(1).get();

    if (!existente.empty) {
      return res.status(409).json({ mensaje: "Ya existe una cuenta con ese correo." });
    }

    // Hashear la contraseña antes de guardarla
    const contraseñaHasheada = await bcrypt.hash(contraseña, 10);

    const nuevoDoc = await usuariosRef.add({
      nombre,
      correo,
      contraseña: contraseñaHasheada,
      creado_en: new Date(),
    });

    return res.status(201).json({
      mensaje: "Usuario registrado correctamente.",
      usuario: { id: nuevoDoc.id, nombre, correo },
    });
  } catch (err) {
    return res.status(500).json({ mensaje: "Error al crear el usuario.", error: err.message });
  }
};

// POST /usuarios/login
export const loginUsuario = async (req, res) => {
  try {
    const { correo, contraseña } = req.body;

    if (!correo || !contraseña) {
      return res.status(400).json({
        mensaje: "Los campos correo y contraseña son obligatorios.",
      });
    }

    const usuariosRef = db.collection(COLECCION);
    const snapshot = await usuariosRef.where("correo", "==", correo).limit(1).get();

    if (snapshot.empty) {
      return res.status(401).json({ mensaje: "Correo o contraseña incorrectos." });
    }

    const usuarioDoc = snapshot.docs[0];
    const usuario = usuarioDoc.data();

    const coincide = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!coincide) {
      return res.status(401).json({ mensaje: "Correo o contraseña incorrectos." });
    }

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso.",
      usuario: { id: usuarioDoc.id, nombre: usuario.nombre, correo: usuario.correo },
    });
  } catch (err) {
    return res.status(500).json({ mensaje: "Error interno del servidor.", error: err.message });
  }
};
