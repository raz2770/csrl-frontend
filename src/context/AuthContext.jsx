// ============================================================
// AuthContext — Firebase Auth version
//
// * Keeps the same external API: { user, login, logout }
// * user shape: { uid, role, name, id, centerCode?, token? }
//   - role:       'ADMIN' | 'CENTRE' | 'STUDENT'
//   - id:         admin username / centreCode / rollKey
//   - centerCode: only for CENTRE & STUDENT
//   - token:      kept as null (no longer needed — Firestore rules
//                 use Firebase Auth UID, not a JWT)
//
// Login UX is UNCHANGED (role selector + ID + password).
// Internally we map:
//   ADMIN   → admin@csrl.internal
//   CENTRE  → {centreCode}@csrl.internal   e.g. gail@csrl.internal
//   STUDENT → {rollKey}@csrl.internal      e.g. gail001@csrl.internal
// ============================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const AuthContext = createContext(null);

// ── helpers ─────────────────────────────────────────────────────────────────

/** Build the internal Firebase Auth email from role + id */
function buildEmail(role, id) {
  const normalised = String(id).toLowerCase().replace(/\s+/g, "");
  switch (role) {
    case "admin":   return "admin@csrl.internal";
    case "centre":  return `${normalised}@csrl.internal`;
    case "student": return `${normalised}@csrl.internal`;
    default:        return `${normalised}@csrl.internal`;
  }
}

/** Read user profile from Firestore users/{uid} */
async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found in Firestore");
  return snap.data(); // { role, name, centerCode?, rollKey? }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  /* Restore session on app start / refresh */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          setUser(buildUserState(firebaseUser.uid, profile));
        } catch {
          // Profile missing — sign out cleanly
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  /**
   * login({ role, id, password })
   *   role     – 'admin' | 'centre' | 'student'
   *   id       – username / centreCode / rollKey
   *   password – plain text password
   */
  const login = async ({ role, id, password }) => {
    // Students login with their roll number as password too (configurable)
    const email    = buildEmail(role, id);
    const pwd      = password || id; // student has no separate password field

    const cred    = await signInWithEmailAndPassword(auth, email, pwd);
    const profile = await fetchUserProfile(cred.user.uid);
    const userState = buildUserState(cred.user.uid, profile);
    setUser(userState);
    return userState;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) return null; // or a global spinner

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// ── shape builder ────────────────────────────────────────────────────────────

function buildUserState(uid, profile) {
  return {
    uid,
    role:       (profile.role || "student").toUpperCase(),
    name:       profile.name  || "",
    id:         profile.rollKey || profile.centreCode || "admin",
    centerCode: profile.centreCode || null,
    // token is null — Firestore security rules use Firebase Auth UID directly
    token: null,
  };
}
