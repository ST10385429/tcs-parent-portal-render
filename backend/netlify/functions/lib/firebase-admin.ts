import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import {
  getAuth,
  type Auth,
} from "firebase-admin/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

function requireEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function createFirebaseAdminApp(): App {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const projectId =
    requireEnvironmentVariable(
      "FIREBASE_PROJECT_ID",
    );

  const clientEmail =
    requireEnvironmentVariable(
      "FIREBASE_CLIENT_EMAIL",
    );

  const privateKey =
    requireEnvironmentVariable(
      "FIREBASE_PRIVATE_KEY",
    ).replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const firebaseAdminApp =
  createFirebaseAdminApp();

export const adminAuth: Auth =
  getAuth(firebaseAdminApp);

export const adminFirestore: Firestore =
  getFirestore(firebaseAdminApp);