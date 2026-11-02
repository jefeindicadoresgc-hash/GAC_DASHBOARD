// js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tu configuración de Firebase para GAC Motor / GWM
const firebaseConfig = {
  apiKey: "AIzaSyBzbZkLhqMj5rVizRyGK-Gm5h4eN5mtEkc",
  authDomain: "gac-motor-f5ab1.firebaseapp.com",
  databaseURL: "https://gac-motor-f5ab1-default-rtdb.firebaseio.com",
  projectId: "gac-motor-f5ab1",
  storageBucket: "gac-motor-f5ab1.firebasestorage.app",
  messagingSenderId: "934765637412",
  appId: "1:934765637412:web:3b0d638a8da55fd2eb4db1"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportamos TODAS las herramientas para que los demás archivos (app_citas, app_asesor, app_tecnico) puedan usarlas sin chocar
export {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  setDoc,
  getDoc
};