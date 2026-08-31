import express from "express";
import { registrarUsuario, loginUsuario } from "../controllers/usuarios.controller.js";

const router = express.Router();

router.post("/usuarios/registro", registrarUsuario);
router.post("/usuarios/login", loginUsuario);

export default router;
