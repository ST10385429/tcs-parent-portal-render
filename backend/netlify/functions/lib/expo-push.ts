import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminFirestore,
} from "./firebase-admin";

type PushNotificationData = {
  recipientUid: string;
  title: string;
  body: string;
  category: string;
  route?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  resourceId?: string | null;
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  priority: "high";
  channelId?: string;
  data: {
    category: string;
    route: string | null;
    sourceType: string | null;
    sourceId: string | null;
    resourceId: string | null;
  };
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
};

const EXPO_PUSH_URL =
  "https://exp.host/--/api/v2/push/send";

/**
 * Expo push tokens normally have one of
 * these two forms.
 */
function isExpoPushToken(
  value: string,
): boolean {
  return (
    value.startsWith(
      "ExponentPushToken[",
    ) ||
    value.startsWith(
      "ExpoPushToken[",
    )
  );
}

/**
 * Disables a device registration when Expo
 * reports that the application is no longer
 * registered on that device.
 */
async function disableInvalidDevice(
  recipientUid: string,
  deviceDocumentId: string,
): Promise<void> {
  try {
    await adminFirestore
      .collection(
        "notificationDevices",
      )
      .doc(
        recipientUid,
      )
      .collection(
        "devices",
      )
      .doc(
        deviceDocumentId,
      )
      .set(
        {
          enabled:
            false,

          disabledReason:
            "DeviceNotRegistered",

          disabledAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
  } catch (error) {
    console.error(
      "Unable to disable an invalid notification device:",
      error,
    );
  }
}

/**
 * Sends one notification to every enabled
 * native device registered to the recipient.
 *
 * Firestore remains the source of truth for
 * the notification inbox. Push delivery is
 * supplementary, so a failed push does not
 * delete or alter the inbox notification.
 */
export async function sendExpoPushNotification({
  recipientUid,
  title,
  body,
  category,
  route = null,
  sourceType = null,
  sourceId = null,
  resourceId = null,
}: PushNotificationData): Promise<void> {
  const cleanedRecipientUid =
    recipientUid.trim();

  if (!cleanedRecipientUid) {
    return;
  }

  const deviceSnapshot =
    await adminFirestore
      .collection(
        "notificationDevices",
      )
      .doc(
        cleanedRecipientUid,
      )
      .collection(
        "devices",
      )
      .where(
        "enabled",
        "==",
        true,
      )
      .get();

  if (deviceSnapshot.empty) {
    console.info(
      "No enabled notification devices were found for the recipient.",
    );

    return;
  }

  const messages: ExpoPushMessage[] = [];
  const deviceDocumentIds: string[] = [];

  for (
    const deviceDocument
    of deviceSnapshot.docs
  ) {
    const deviceData =
      deviceDocument.data();

    const expoPushToken =
      typeof deviceData.expoPushToken ===
      "string"
        ? deviceData.expoPushToken.trim()
        : "";

    if (
      !expoPushToken ||
      !isExpoPushToken(
        expoPushToken,
      )
    ) {
      console.warn(
        "An invalid Expo push token was ignored.",
      );

      continue;
    }

    const message: ExpoPushMessage = {
      to:
        expoPushToken,

      sound:
        "default",

      title,

      body,

      priority:
        "high",

      data: {
        category,

        route:
          route ?? null,

        sourceType:
          sourceType ?? null,

        sourceId:
          sourceId ?? null,

        resourceId:
          resourceId ?? null,
      },
    };

    /**
     * Android uses the notification channel
     * configured by the mobile application.
     */
    if (
      deviceData.platform ===
      "android"
    ) {
      message.channelId =
        "default";
    }

    messages.push(
      message,
    );

    deviceDocumentIds.push(
      deviceDocument.id,
    );
  }

  if (
    messages.length ===
    0
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        EXPO_PUSH_URL,
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Accept-Encoding":
              "gzip, deflate",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              messages,
            ),
        },
      );

    if (!response.ok) {
      const responseText =
        await response.text();

      console.error(
        "Expo push service rejected the request:",
        response.status,
        responseText,
      );

      return;
    }

    const result =
      (
        await response.json()
      ) as ExpoPushResponse;

    const tickets =
      Array.isArray(
        result.data,
      )
        ? result.data
        : [];

    for (
      let index = 0;
      index < tickets.length;
      index += 1
    ) {
      const ticket =
        tickets[index];

      if (
        ticket?.status ===
        "ok"
      ) {
        continue;
      }

      const errorCode =
        ticket?.details?.error;

      if (
        errorCode ===
        "DeviceNotRegistered"
      ) {
        const deviceDocumentId =
          deviceDocumentIds[
            index
          ];

        if (
          deviceDocumentId
        ) {
          await disableInvalidDevice(
            cleanedRecipientUid,
            deviceDocumentId,
          );
        }

        continue;
      }

      console.error(
        "Expo could not deliver a push notification:",
        ticket?.message ??
          errorCode ??
          "Unknown Expo push error.",
      );
    }
  } catch (error) {
    /**
     * Push failure must not cause the main
     * school operation to fail.
     *
     * The notification remains available in
     * the Firestore inbox.
     */
    console.error(
      "Unable to send Expo push notification:",
      error,
    );
  }
}