import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { Platform } from "react-native";

import { firestore } from "@/lib/firebase";

import { type UserRole } from "@/types/auth";

type RegisterNotificationDeviceParams = {
  userId: string;
  role: UserRole;
  expoPushToken: string;
};

type DisableNotificationDeviceParams = {
  userId: string;
  expoPushToken: string;
};

/**
 * Creates a Firestore-safe identifier from an
 * Expo push token.
 *
 * The token itself remains stored in the document
 * so that the trusted notification backend can
 * use it later.
 */
function createDeviceDocumentId(
  expoPushToken: string,
): string {
  return expoPushToken
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )
    .slice(
      0,
      500,
    );
}

/**
 * Registers the current physical device against
 * the authenticated user's Firebase UID.
 */
export async function registerNotificationDevice({
  userId,
  role,
  expoPushToken,
}: RegisterNotificationDeviceParams): Promise<void> {
  if (
    Platform.OS !== "ios" &&
    Platform.OS !== "android"
  ) {
    return;
  }

  const trimmedUserId =
    userId.trim();

  const trimmedToken =
    expoPushToken.trim();

  if (!trimmedToken) {
    throw new Error(
      "Cannot register an empty Expo push token.",
    );
  }

  if (!trimmedUserId) {
    throw new Error(
      "Cannot register a notification device without a user ID.",
    );
  }

  const deviceId =
    createDeviceDocumentId(
      trimmedToken,
    );

  const deviceReference =
    doc(
      firestore,
      "notificationDevices",
      trimmedUserId,
      "devices",
      deviceId,
    );

  /**
   * Check whether this particular token is already
   * registered to the current user.
   */
  const devicesReference =
    collection(
      firestore,
      "notificationDevices",
      trimmedUserId,
      "devices",
    );

  const existingTokenQuery =
    query(
      devicesReference,
      where(
        "expoPushToken",
        "==",
        trimmedToken,
      ),
    );

  const existingTokenSnapshot =
    await getDocs(
      existingTokenQuery,
    );

  if (
    !existingTokenSnapshot.empty
  ) {
    const existingDocument =
      existingTokenSnapshot.docs[0];

    await setDoc(
      existingDocument.ref,
      {
        expoPushToken:
          trimmedToken,

        platform:
          Platform.OS,

        role,

        enabled:
          true,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );

    return;
  }

  /**
   * First registration for this device.
   */
  await setDoc(
    deviceReference,
    {
      expoPushToken:
        trimmedToken,

      platform:
        Platform.OS,

      role,

      enabled:
        true,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );
}

/**
 * Disables the current device's push registration
 * for the authenticated user.
 *
 * The document is retained so that the same device
 * can be enabled again if the user signs in later.
 *
 * Logout only updates existing registrations.
 * It never creates a new device document.
 */
export async function disableNotificationDevice({
  userId,
  expoPushToken,
}: DisableNotificationDeviceParams): Promise<void> {
  if (
    Platform.OS !== "ios" &&
    Platform.OS !== "android"
  ) {
    return;
  }

  const trimmedUserId =
    userId.trim();

  const trimmedToken =
    expoPushToken.trim();

  if (
    !trimmedUserId ||
    !trimmedToken
  ) {
    return;
  }

  /**
   * Find every registration belonging to the
   * current user that contains this Expo token.
   *
   * This also safely handles any older duplicate
   * registration that may have been stored under
   * another document identifier.
   */
  const devicesReference =
    collection(
      firestore,
      "notificationDevices",
      trimmedUserId,
      "devices",
    );

  const matchingTokenQuery =
    query(
      devicesReference,
      where(
        "expoPushToken",
        "==",
        trimmedToken,
      ),
    );

  const matchingTokenSnapshot =
    await getDocs(
      matchingTokenQuery,
    );

  if (
    matchingTokenSnapshot.empty
  ) {
    return;
  }

  /**
   * Firestore rules allow enabled and updatedAt
   * to change while platform, role and createdAt
   * remain unchanged.
   *
   * No disabledAt field is written because it is
   * deliberately not permitted by the current
   * strict device-registration rules.
   */
  const updates =
    matchingTokenSnapshot.docs.map(
      (deviceDocument) =>
        updateDoc(
          deviceDocument.ref,
          {
            enabled:
              false,

            updatedAt:
              serverTimestamp(),
          },
        ),
    );

  await Promise.all(
    updates,
  );
}