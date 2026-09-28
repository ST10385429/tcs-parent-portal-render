import { FirebaseError } from "firebase/app";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import { auth } from "@/lib/firebase-auth";

import {
  disableNotificationDevice,
} from "@/services/notification-device-service";

import {
  getPushNotificationRegistration,
} from "@/services/push-notification-service";

import {
  type AppUser,
  type UserRole,
  type UserStatus,
} from "@/types/auth";

const validRoles: UserRole[] = [
  "parent",
  "teacher",
  "admin",
];

const validStatuses: UserStatus[] = [
  "active",
  "inactive",
  "suspended",
];

function isUserRole(
  value: unknown,
): value is UserRole {
  return (
    typeof value === "string" &&
    validRoles.includes(
      value as UserRole,
    )
  );
}

function isUserStatus(
  value: unknown,
): value is UserStatus {
  return (
    typeof value === "string" &&
    validStatuses.includes(
      value as UserStatus,
    )
  );
}

export async function getUserProfile(
  firebaseUser: User,
): Promise<AppUser> {
  const profileReference =
    doc(
      firestore,
      "users",
      firebaseUser.uid,
    );

  const profileSnapshot =
    await getDoc(
      profileReference,
    );

  if (
    !profileSnapshot.exists()
  ) {
    throw new Error(
      "Your account profile has not been configured. Please contact the school administrator.",
    );
  }

  const profile =
    profileSnapshot.data();

  if (
    !isUserRole(
      profile.role,
    )
  ) {
    throw new Error(
      "Your account has an invalid role. Please contact the school administrator.",
    );
  }

  if (
    !isUserStatus(
      profile.status,
    )
  ) {
    throw new Error(
      "Your account status is invalid. Please contact the school administrator.",
    );
  }

  if (
    profile.status !==
    "active"
  ) {
    throw new Error(
      "Your account is not active. Please contact the school administrator.",
    );
  }

  return {
    uid:
      firebaseUser.uid,

    email:
      firebaseUser.email ??
      "",

    firstName:
      typeof profile.firstName ===
      "string"
        ? profile.firstName
        : "",

    lastName:
      typeof profile.lastName ===
      "string"
        ? profile.lastName
        : "",

    role:
      profile.role,

    status:
      profile.status,

    mustChangePassword:
      profile.mustChangePassword ===
      true,
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AppUser> {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const credential =
    await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );

  try {
    return await getUserProfile(
      credential.user,
    );
  } catch (error) {
    await signOut(
      auth,
    );

    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  const firebaseUser =
    auth.currentUser;

  if (!firebaseUser) {
    return;
  }

  /**
   * Disable this physical device for the current
   * account before Firebase destroys the user's
   * authenticated session.
   *
   * Notification cleanup is deliberately treated
   * as best-effort. A temporary notification or
   * network failure must never trap a user inside
   * their account and prevent logout.
   */
  try {
    const registration =
      await getPushNotificationRegistration();

    if (
      registration.expoPushToken
    ) {
      await disableNotificationDevice({
        userId:
          firebaseUser.uid,

        expoPushToken:
          registration.expoPushToken,
      });
    }
  } catch (error) {
    console.error(
      "The notification device could not be disabled during logout:",
      error,
    );
  }

  await signOut(
    auth,
  );
}

export function validateNewPassword(
  password: string,
): string | null {
  if (
    password.length < 8
  ) {
    return "Your new password must contain at least 8 characters.";
  }

  if (
    !/[a-z]/.test(
      password,
    )
  ) {
    return "Your new password must contain a lowercase letter.";
  }

  if (
    !/[A-Z]/.test(
      password,
    )
  ) {
    return "Your new password must contain an uppercase letter.";
  }

  if (
    !/[0-9]/.test(
      password,
    )
  ) {
    return "Your new password must contain a number.";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      password,
    )
  ) {
    return "Your new password must contain a special character.";
  }

  return null;
}

export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const firebaseUser =
    auth.currentUser;

  if (
    !firebaseUser ||
    !firebaseUser.email
  ) {
    throw new Error(
      "Your login session has expired. Please sign in again.",
    );
  }

  if (!currentPassword) {
    throw new Error(
      "Enter your temporary password.",
    );
  }

  const passwordError =
    validateNewPassword(
      newPassword,
    );

  if (passwordError) {
    throw new Error(
      passwordError,
    );
  }

  if (
    currentPassword ===
    newPassword
  ) {
    throw new Error(
      "Your new password must be different from your temporary password.",
    );
  }

  const credential =
    EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword,
    );

  await reauthenticateWithCredential(
    firebaseUser,
    credential,
  );

  await updatePassword(
    firebaseUser,
    newPassword,
  );

  await updateDoc(
    doc(
      firestore,
      "users",
      firebaseUser.uid,
    ),
    {
      mustChangePassword:
        false,

      passwordChangedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );
}

export function getLoginErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof FirebaseError
  ) {
    switch (
      error.code
    ) {
      case "auth/invalid-email":
        return "Please enter a valid email address.";

      case "auth/missing-password":
        return "Please enter your password.";

      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "The email address or password is incorrect.";

      case "auth/user-disabled":
        return "This account has been disabled. Please contact the school administrator.";

      case "auth/too-many-requests":
        return "Too many unsuccessful attempts. Please wait before trying again.";

      case "auth/network-request-failed":
        return "Unable to connect. Check your internet connection and try again.";

      default:
        return "Login could not be completed. Please try again.";
    }
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export function getPasswordChangeErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof FirebaseError
  ) {
    switch (
      error.code
    ) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "The temporary password you entered is incorrect.";

      case "auth/weak-password":
        return "The new password is not strong enough.";

      case "auth/requires-recent-login":
        return "Please sign out and sign in again before changing your password.";

      case "auth/too-many-requests":
        return "Too many attempts were made. Please wait before trying again.";

      case "auth/network-request-failed":
        return "Unable to connect. Check your internet connection and try again.";

      case "permission-denied":
        return "Your password was changed, but your account profile could not be updated. Please contact the administrator.";

      default:
        return "Your password could not be changed. Please try again.";
    }
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}