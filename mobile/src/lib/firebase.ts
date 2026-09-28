import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

const missingVariables = [
  !apiKey ? "EXPO_PUBLIC_FIREBASE_API_KEY" : null,
  !authDomain ? "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN" : null,
  !projectId ? "EXPO_PUBLIC_FIREBASE_PROJECT_ID" : null,
  !storageBucket ? "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET" : null,
  !messagingSenderId ? "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" : null,
  !appId ? "EXPO_PUBLIC_FIREBASE_APP_ID" : null,
].filter((variable): variable is string => variable !== null);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingVariables.join(", ")}`,
  );
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firestore: Firestore = getFirestore(firebaseApp);

export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);
