import express from "express";
import { obtenerKpis } from "../controllers/dashboard.controller.js";
import { verificarToken, soloAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard/kpis", verificarToken, soloAdmin, obtenerKpis);

export default router;
