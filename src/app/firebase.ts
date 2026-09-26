import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// These values must come from the *new* Firebase project's registered web app.
// Never reuse the previous project's apiKey or appId with freeai-ff700.
const firebaseConfig = {
  projectId: "freeai-ff700",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: "freeai-ff700.firebaseapp.com",
  messagingSenderId: "802136563532",
};
if (!firebaseConfig.apiKey || !firebaseConfig.appId) {
  throw new Error("Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_APP_ID for freeai-ff700");
}
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "freeai-ff700");
export const auth = getAuth(app);
let anonymousAuthPromise: Promise<void> | null = null;
export function ensureFirebaseAuth(): Promise<void> {
  if (auth.currentUser) return Promise.resolve();
  if (!anonymousAuthPromise) {
    anonymousAuthPromise = signInAnonymously(auth).then(() => undefined).catch((error) => {
      anonymousAuthPromise = null;
      throw error;
    });
  }
  return anonymousAuthPromise;
}
