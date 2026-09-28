import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
  type InboxNotification,
  type NotificationCategory,
  type NotificationRecipientRole,
  type NotificationSourceType,
} from "@/types/notification";

/*
 * Converts a Firestore timestamp into a
 * JavaScript Date without making the rest
 * of the application depend on Firestore's
 * Timestamp type.
 */
function timestampToDate(
  value: unknown,
): Date | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    ).toDate();
  }

  return null;
}

/*
 * Convert a Firestore notification document
 * into the strongly typed model used by the
 * application.
 */
function mapNotification(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): InboxNotification {
  const data = snapshot.data();

  const createdAt =
    timestampToDate(data.createdAt);

  const readAt =
    timestampToDate(data.readAt);

  return {
    id: snapshot.id,

    recipientUid:
      data.recipientUid as string,

    recipientRole:
      data.recipientRole as
        NotificationRecipientRole,

    category:
      data.category as
        NotificationCategory,

    title:
      data.title as string,

    body:
      data.body as string,

    sourceType:
      data.sourceType as
        NotificationSourceType,

    sourceId:
      data.sourceId as string,

    route:
      typeof data.route === "string"
        ? data.route
        : null,

    read:
      data.read === true,

    readAt,

    /*
     * A backend-created notification should
     * always contain createdAt. The fallback
     * prevents an incomplete document from
     * crashing the client while loading.
     */
    createdAt:
      createdAt ?? new Date(0),
  };
}

/*
 * Listen in real time to notifications belonging
 * to one authenticated user.
 *
 * Firestore security rules independently enforce
 * that users may only read their own notifications.
 */
export function subscribeToNotifications(
  userId: string,
  onNotifications: (
    notifications: InboxNotification[],
  ) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!userId.trim()) {
    throw new Error(
      "A user ID is required to subscribe to notifications.",
    );
  }

  const notificationsReference =
    collection(
      firestore,
      "notifications",
    );

  const notificationsQuery = query(
    notificationsReference,
    where(
      "recipientUid",
      "==",
      userId,
    ),
    orderBy(
      "createdAt",
      "desc",
    ),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications =
        snapshot.docs.map(
          mapNotification,
        );

      onNotifications(
        notifications,
      );
    },
    (error) => {
      console.error(
        "Unable to load notifications:",
        error,
      );

      onError?.(error);
    },
  );
}

/*
 * Mark one notification as read.
 *
 * The security rules allow the authenticated
 * recipient to modify only read and readAt.
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  if (!notificationId.trim()) {
    throw new Error(
      "A notification ID is required.",
    );
  }

  const notificationReference = doc(
    firestore,
    "notifications",
    notificationId,
  );

  await updateDoc(
    notificationReference,
    {
      read: true,
      readAt: serverTimestamp(),
    },
  );
}

/*
 * Mark one notification as unread.
 */
export async function markNotificationAsUnread(
  notificationId: string,
): Promise<void> {
  if (!notificationId.trim()) {
    throw new Error(
      "A notification ID is required.",
    );
  }

  const notificationReference = doc(
    firestore,
    "notifications",
    notificationId,
  );

  await updateDoc(
    notificationReference,
    {
      read: false,
      readAt: null,
    },
  );
}

/*
 * Convenience helper used later for notification
 * badges on Parent, Teacher and Admin screens.
 */
export function getUnreadNotificationCount(
  notifications: InboxNotification[],
): number {
  return notifications.reduce(
    (total, notification) =>
      notification.read
        ? total
        : total + 1,
    0,
  );
}