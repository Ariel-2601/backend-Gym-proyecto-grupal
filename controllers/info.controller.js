import db from "../firebase.js";
import supabase from "../supabase.js";

// Controlador de prueba del backend grupal
export const informacion = (req, res) => {
    res.json({
        mensaje: "Esta es una función de prueba del backend grupal."
    });
};
