import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import {
  Platform,
} from "react-native";

import {
  type NotificationPermissionState,
} from "@/types/notification";

/**
 * Result returned after checking/registering
 * this device for push notifications.
 */
export type PushRegistrationResult = {
  permission: NotificationPermissionState;
  expoPushToken: string | null;
  isPhysicalDevice: boolean;
};

/**
 * Controls how notifications behave while
 * the application is already open.
 */
Notifications.setNotificationHandler({
  handleNotification:
    async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

/**
 * Android requires a notification channel.
 *
 * This channel is used for the normal
 * TCS Parent Portal notifications.
 */
async function configureAndroidChannel():
  Promise<void> {
  if (
    Platform.OS !==
    "android"
  ) {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    "default",
    {
      name:
        "TCS Notifications",

      importance:
        Notifications.AndroidImportance.HIGH,

      vibrationPattern: [
        0,
        250,
        250,
        250,
      ],

      lightColor:
        "#172B4D",

      sound:
        "default",
    },
  );
}

/**
 * Converts Expo's permission response into
 * the application's own permission type.
 */
function mapPermissionStatus(
  status: Notifications.PermissionStatus,
): NotificationPermissionState {
  switch (status) {
    case Notifications.PermissionStatus.GRANTED:
      return "granted";

    case Notifications.PermissionStatus.DENIED:
      return "denied";

    default:
      return "undetermined";
  }
}

/**
 * Retrieves the EAS project ID already
 * configured inside app.json.
 */
function getProjectId():
  string | null {
  const projectId =
    Constants.expoConfig?.extra?.eas
      ?.projectId ??
    Constants.easConfig?.projectId;

  if (
    typeof projectId !==
      "string" ||
    projectId.trim().length ===
      0
  ) {
    return null;
  }

  return projectId.trim();
}

/**
 * Returns the current notification
 * registration without requesting permission.
 *
 * This is useful during logout because logout
 * must never display a new operating-system
 * permission prompt.
 */
export async function getPushNotificationRegistration():
  Promise<PushRegistrationResult> {
  /**
   * Push notifications are only supported
   * by this service on native Android/iOS.
   */
  if (
    Platform.OS ===
    "web"
  ) {
    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        false,
    };
  }

  await configureAndroidChannel();

  /**
   * Expo push tokens should be obtained
   * using a physical device.
   */
  if (
    !Device.isDevice
  ) {
    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        false,
    };
  }

  /**
   * Read the existing permission state only.
   *
   * Unlike registerForPushNotifications(),
   * this function does NOT request permission.
   */
  const existingPermissions =
    await Notifications.getPermissionsAsync();

  const permission =
    mapPermissionStatus(
      existingPermissions.status,
    );

  if (
    permission !==
    "granted"
  ) {
    return {
      permission,

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }

  const projectId =
    getProjectId();

  if (!projectId) {
    console.error(
      "Push notification registration lookup failed: EAS project ID is missing.",
    );

    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }

  try {
    const token =
      await Notifications.getExpoPushTokenAsync(
        {
          projectId,
        },
      );

    return {
      permission:
        "granted",

      expoPushToken:
        token.data,

      isPhysicalDevice:
        true,
    };
  } catch (error) {
    console.error(
      "Unable to obtain the current Expo push token:",
      error,
    );

    return {
      permission:
        "granted",

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }
}

/**
 * Requests permission and creates an Expo
 * push token for the current physical device.
 *
 * The returned token can then be registered
 * against the authenticated user's Firestore
 * notification-device record.
 */
export async function registerForPushNotifications():
  Promise<PushRegistrationResult> {
  /**
   * Push notifications are intended for
   * native Android/iOS devices.
   */
  if (
    Platform.OS ===
    "web"
  ) {
    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        false,
    };
  }

  await configureAndroidChannel();

  /**
   * Expo push tokens should be obtained
   * using a physical device.
   */
  if (
    !Device.isDevice
  ) {
    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        false,
    };
  }

  const existingPermissions =
    await Notifications.getPermissionsAsync();

  let finalStatus =
    existingPermissions.status;

  /**
   * Only show the operating-system
   * permission prompt when permission has
   * not already been granted.
   */
  if (
    finalStatus !==
    Notifications.PermissionStatus.GRANTED
  ) {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();

    finalStatus =
      requestedPermissions.status;
  }

  const permission =
    mapPermissionStatus(
      finalStatus,
    );

  /**
   * A denied user must still be allowed to
   * use the rest of the application.
   */
  if (
    permission !==
    "granted"
  ) {
    return {
      permission,

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }

  const projectId =
    getProjectId();

  if (!projectId) {
    console.error(
      "Push notification registration failed: EAS project ID is missing.",
    );

    return {
      permission:
        "unsupported",

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }

  try {
    const token =
      await Notifications.getExpoPushTokenAsync(
        {
          projectId,
        },
      );

    return {
      permission:
        "granted",

      expoPushToken:
        token.data,

      isPhysicalDevice:
        true,
    };
  } catch (error) {
    console.error(
      "Unable to obtain Expo push token:",
      error,
    );

    return {
      permission:
        "granted",

      expoPushToken:
        null,

      isPhysicalDevice:
        true,
    };
  }
}