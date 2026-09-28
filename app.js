import express from "express";
import cors from "cors";  //Para que el frontend pueda llamar
import infoRoutes from "./routes/info.routes.js";
import apiRoutes from "./routes/api.routes.js";

const app = express();

// Middlewares
app.use(cors());  //Permite peticiones desde cualquier origen
app.use(express.json());

// Rutas
app.use(infoRoutes);          // GET /info (pública, útil para probar la conexión)
app.use("/api", apiRoutes);   // Rutas que consume la app móvil (requieren token)

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no registrada." });
});

// Manejador de errores (el frontend lee el campo "message")
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: status < 500 ? "Solicitud inválida." : "Error interno del servidor.",
  });
});

export default app;
