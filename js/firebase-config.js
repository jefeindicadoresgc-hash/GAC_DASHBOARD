import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzbZkLhqMj5rVizRyGK-Gm5h4eN5mtEkc",
  authDomain: "gac-motor-f5ab1.firebaseapp.com",
  databaseURL: "https://gac-motor-f5ab1-default-rtdb.firebaseio.com",
  projectId: "gac-motor-f5ab1",
  storageBucket: "gac-motor-f5ab1.firebasestorage.app",
  messagingSenderId: "934765637412",
  appId: "1:934765637412:web:3b0d638a8da55fd2eb4db1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Aquí exponemos limit y orderBy para que app.js pueda usarlos
export { db, collection, addDoc, getDocs, query, where, orderBy, limit };