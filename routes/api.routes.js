    import { Router } from "express";
    import { verificarToken, propioOStaff, soloStaff } from "../middleware/auth.js";
    import * as c from "../controllers/api.controller.js";

    const router = Router();

    // Express 4 no captura errores de funciones async; este wrapper los manda al manejador de errores
    const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

    // Todo lo que está bajo /api exige sesión de Firebase
    router.use(verificarToken);

<<<<<<< HEAD
    router.get("/clientes", soloStaff, h(c.listarClientes));
  
    router.get("/asistencias/hoy", soloStaff, h(c.asistenciasHoy));
=======
router.get("/clientes", soloStaff, h(c.listarClientes));
router.get("/asistencias/hoy", soloStaff, h(c.asistenciasHoy));
router.get("/clientes/:clienteId", propioOStaff, h(c.perfil));
router.get("/historial_asistencias", propioOStaff, h(c.asistencias));
router.post("/historial_asistencias", h(c.registrarAsistencia));
router.get("/rutinas/:clienteId", propioOStaff, h(c.rutina));
router.post("/rutinas/:clienteId", soloStaff, h(c.crearRutina));
router.get("/membresias/:clienteId", propioOStaff, h(c.membresia));
router.get("/productos", h(c.productos));
router.get("/dashboard/kpis", soloStaff, h(c.kpis));
router.get("/registro_progreso", propioOStaff, h(c.progreso));
router.post("/registro_progreso", h(c.registrarProgreso));
>>>>>>> 11bdf2d (Entrenador editar)

    router.get("/clientes/:clienteId", propioOStaff, h(c.perfil));
    router.get("/historial_asistencias", propioOStaff, h(c.asistencias));
    router.post("/historial_asistencias", h(c.registrarAsistencia));
    router.get("/rutinas/:clienteId", propioOStaff, h(c.rutina));
    router.get("/membresias/:clienteId", propioOStaff, h(c.membresia));
    router.get("/productos", h(c.productos));
    router.get("/dashboard/kpis", soloStaff, h(c.kpis));
    router.get("/registro_progreso", propioOStaff, h(c.progreso));
    router.post("/registro_progreso", h(c.registrarProgreso));

    export default router;