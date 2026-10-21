
import express from "express";
import {
  registrarUsuario,
  loginUsuario,
  obtenerPerfil
} from "../controllers/usuarios.controller.js";
import verificarToken from "../middlewares/verificarToken.js";

const router = express.Router();

router.post("/usuarios/registro", registrarUsuario);
router.post("/usuarios/login", loginUsuario);

// Consultar el perfil del usuario autenticado
router.get("/usuarios/perfil", verificarToken, obtenerPerfil);

export default router;
