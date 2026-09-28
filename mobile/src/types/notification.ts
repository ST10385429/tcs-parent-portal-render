export type NotificationCategory =
  | "announcements"
  | "calendar"
  | "reports"
  | "fees"
  | "requests";

export type NotificationPreferences = Record<
  NotificationCategory,
  boolean
>;

export const defaultNotificationPreferences: NotificationPreferences = {
  announcements: true,
  calendar: true,
  reports: true,
  fees: true,
  requests: true,
};

export type NotificationPermissionState =
  | "undetermined"
  | "granted"
  | "denied"
  | "unsupported";

export type NotificationDestination =
  | "/parent/news"
  | "/parent/calendar"
  | "/parent/reports"
  | "/parent/fees"
  | "/parent/chat";

export type AppNotificationData = {
  category?: NotificationCategory;
  route?: NotificationDestination;
  resourceId?: string;
};

export type PushDeviceRegistration = {
  enabled: boolean;
  permission: NotificationPermissionState;
  preferences: NotificationPreferences;
};

/*
 * Roles that may receive notifications.
 *
 * These values match the roles stored in
 * authenticated user profiles.
 */
export type NotificationRecipientRole =
  | "parent"
  | "teacher"
  | "admin";

/*
 * Identifies the application resource that
 * caused a notification to be generated.
 */
export type NotificationSourceType =
  | "announcement"
  | "schoolEvent"
  | "termReport"
  | "feeAccount"
  | "feeStatement"
  | "payment"
  | "parentRequest"
  | "requestReply";

/*
 * Firestore notification document used by
 * the in-app notification inbox.
 */
export type InboxNotification = {
  id: string;

  recipientUid: string;
  recipientRole: NotificationRecipientRole;

  category: NotificationCategory;

  title: string;
  body: string;

  sourceType: NotificationSourceType;
  sourceId: string;

  route: string | null;

  read: boolean;
  readAt: Date | null;
  createdAt: Date;
};