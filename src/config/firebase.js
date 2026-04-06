// ============================================================
// Firebase App Initialization — csrl-store project
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyB32-9iWotJFwBaBZsv7rnbo_bO9CPwzwE",
  authDomain:        "csrl-store.firebaseapp.com",
  projectId:         "csrl-store",
  storageBucket:     "csrl-store.firebasestorage.app",
  messagingSenderId: "945822862196",
  appId:             "1:945822862196:web:181b40403523debd0fba21",
  measurementId:     "G-WCV9GW8EZY",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
