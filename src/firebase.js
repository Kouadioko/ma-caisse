import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

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
export const auth = getAuth(app);

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

const RESTAURANT_ID = "montmorency";

export async function saveData(data) {
  await setDoc(doc(db, "restaurants", RESTAURANT_ID), data);
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