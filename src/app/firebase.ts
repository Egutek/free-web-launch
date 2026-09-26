import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// These values come from the registered Freeai web app.
const firebaseConfig = {
  projectId: "freeai-ff700",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAxotchbIEirm165a5i64FOA4SBFUtj0_s",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:802136563532:web:22c640be67fb80c99eb9e9",
  authDomain: "freeai-ff700.firebaseapp.com",
  messagingSenderId: "802136563532",
  storageBucket: "freeai-ff700.firebasestorage.app",
  measurementId: "G-RVV2JG5TD8",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
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
