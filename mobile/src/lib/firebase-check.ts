import { firebaseApp, firestore } from "@/lib/firebase";
import { auth } from "@/lib/firebase-auth";

export type FirebaseCheckResult = {
  appName: string;
  projectId: string;
  authReady: boolean;
  firestoreReady: boolean;
};

export function checkFirebaseConfiguration(): FirebaseCheckResult {
  return {
    appName: firebaseApp.name,
    projectId: firebaseApp.options.projectId ?? "Missing project ID",
    authReady: Boolean(auth),
    firestoreReady: Boolean(firestore),
  };
}
