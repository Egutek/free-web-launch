import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let anonymousAuthPromise: Promise<void> | null = null;

/**
 * Keeps the app login-free while still giving Firestore a real Firebase
 * Authentication identity. Anonymous auth must be enabled in the Firebase
 * console for the project.
 */
export function ensureFirebaseAuth(): Promise<void> {
  if (auth.currentUser) return Promise.resolve();

  if (!anonymousAuthPromise) {
    anonymousAuthPromise = signInAnonymously(auth)
      .then(() => undefined)
      .catch((error) => {
        anonymousAuthPromise = null;
        throw error;
      });
  }

  return anonymousAuthPromise;
}
