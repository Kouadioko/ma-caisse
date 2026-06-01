import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDn0DCRyFiQUvYRamd-MCqvTbAAAgEK6hI",
  authDomain: "montmorency-caisse.firebaseapp.com",
  projectId: "montmorency-caisse",
  storageBucket: "montmorency-caisse.firebasestorage.app",
  messagingSenderId: "853641240088",
  appId: "1:853641240088:web:4f140205482a0b0f6ead6d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const RESTAURANT_ID = "montmorency";

export async function saveData(data) {
  try {
    await setDoc(doc(db, "restaurants", RESTAURANT_ID), data);
  } catch (err) {
    console.error("Erreur Firebase :", err);
  }
}

export async function loadData() {
  try {
    const snap = await getDoc(doc(db, "restaurants", RESTAURANT_ID));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Erreur Firebase :", err);
    return null;
  }
}

export function listenData(callback) {
  return onSnapshot(doc(db, "restaurants", RESTAURANT_ID), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}