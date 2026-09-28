import express from "express";
import { obtenerKpis } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/dashboard/kpis", obtenerKpis);

export default router;