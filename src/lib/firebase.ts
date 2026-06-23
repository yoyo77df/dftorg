import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAATAg3aACl87jocNZMlc7pc5Ebxmr2r54",
  authDomain: "dft-tournament-27a59.firebaseapp.com",
  projectId: "dft-tournament-27a59",
  storageBucket: "dft-tournament-27a59.firebasestorage.app",
  messagingSenderId: "854378680113",
  appId: "1:854378680113:web:650b7e66acb3782cf9ea10",
  measurementId: "G-00JPCQ9W8Q",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _storage = getStorage(_app);
  }
  return _app;
}

export const getFirebaseApp = () => ensure();
export const getFirebaseAuth = (): Auth => {
  ensure();
  return _auth as Auth;
};
export const getDb = (): Firestore => {
  ensure();
  return _db as Firestore;
};
export const getFbStorage = (): FirebaseStorage => {
  ensure();
  return _storage as FirebaseStorage;
};
export const googleProvider = new GoogleAuthProvider();