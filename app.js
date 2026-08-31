import express from "express";
import cors from "cors";  //Para que el frontend pueda llamar
import infoRoutes from "./routes/info.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";

const app = express();

// Middlewares
app.use(cors());  //Permite peticiones desde cualquier origen
app.use(express.json());

// Rutas
app.use(infoRoutes);
app.use(usuariosRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no registrada." });
});

export default app;