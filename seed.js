// Carga datos de prueba en Firestore para que la app tenga qué mostrar.
// Uso:  node seed.js <UID_de_Firebase> [--admin]
// El UID lo ves en Firebase Console > Authentication > Users (columna "User UID").
import "dotenv/config";
import db from "./firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const uid = process.argv[2];
const esAdmin = process.argv.includes("--admin");

if (!uid) {
  console.error("Uso: node seed.js <UID_de_Firebase> [--admin]");
  process.exit(1);
}

const enDias = (n, hora = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hora, 30, 0, 0);
  return Timestamp.fromDate(d);
};

const batch = db.batch();

batch.set(db.collection("clientes").doc(uid), {
  nombre: "Cliente de prueba",
  rol: esAdmin ? "admin" : "cliente",
});

batch.set(db.collection("membresias").doc(uid), {
  tipo: "Mensual",
  fechaInicio: enDias(-10),
  fechaFin: enDias(20),
});

batch.set(db.collection("rutinas").doc(uid), {
  dias: [
    {
      dia: "Lunes",
      ejercicios: [
        { nombre: "Press de banca", series: 4, repeticiones: 10 },
        { nombre: "Aperturas con mancuernas", series: 3, repeticiones: 12 },
      ],
    },
    {
      dia: "Miércoles",
      ejercicios: [
        { nombre: "Sentadillas", series: 4, repeticiones: 12 },
        { nombre: "Prensa de piernas", series: 3, repeticiones: 15 },
      ],
    },
    {
      dia: "Viernes",
      ejercicios: [
        { nombre: "Dominadas", series: 3, repeticiones: 8 },
        { nombre: "Remo con barra", series: 4, repeticiones: 10 },
      ],
    },
  ],
});

[0, -1, -3, -4, -6].forEach((n, i) => {
  batch.set(db.collection("historial_asistencias").doc(`${uid}_${i}`), {
    clienteId: uid,
    fecha: enDias(n, 6 + i),
  });
});

[
  ["prod-proteina", "Proteína Whey 1 lb", 850],
  ["prod-creatina", "Creatina 300 g", 620],
  ["prod-agua", "Agua 600 ml", 25],
  ["prod-energetica", "Bebida energética", 45],
].forEach(([id, nombre, precio]) => {
  batch.set(db.collection("productos").doc(id), { nombre, precio });
});

batch.set(db.collection("ventas").doc("venta-1"), {
  fecha: enDias(-2),
  total: 875,
  items: [{ nombre: "Proteína Whey 1 lb", cantidad: 1 }, { nombre: "Agua 600 ml", cantidad: 1 }],
});
batch.set(db.collection("ventas").doc("venta-2"), {
  fecha: enDias(-1),
  total: 90,
  items: [{ nombre: "Bebida energética", cantidad: 2 }],
});

await batch.commit();
console.log(`Datos de prueba cargados para ${uid}${esAdmin ? " (rol: admin)" : ""}.`);
process.exit(0);
