import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/context/auth-context";
import {
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  subscribeToNotifications,
} from "@/services/notification-service";
import {
  type InboxNotification,
} from "@/types/notification";

type NotificationContextValue = {
  notifications: InboxNotification[];
  unreadCount: number;
  isLoadingNotifications: boolean;
  error: string | null;

  markAsRead: (
    notificationId: string,
  ) => Promise<void>;

  markAsUnread: (
    notificationId: string,
  ) => Promise<void>;
};

type NotificationProviderProps = {
  children: ReactNode;
};

const NotificationContext =
  createContext<
    NotificationContextValue | undefined
  >(undefined);

export function NotificationProvider({
  children,
}: NotificationProviderProps) {
  const {
    user,
    isLoading: isAuthLoading,
  } = useAuth();

  const [
    notifications,
    setNotifications,
  ] = useState<InboxNotification[]>([]);

  const [
    loadedUserId,
    setLoadedUserId,
  ] = useState<string | null>(null);

  const [
    notificationError,
    setNotificationError,
  ] = useState<{
    userId: string;
    message: string;
  } | null>(null);

  /*
   * A notification subscription should only
   * exist for a fully authenticated user.
   */
  const notificationUserId =
    !isAuthLoading &&
    user &&
    !user.mustChangePassword
      ? user.uid
      : null;

  useEffect(() => {
    if (!notificationUserId) {
      return;
    }

    const subscribedUserId =
      notificationUserId;

    /*
     * Listen in real time for this user's
     * notification documents.
     */
    const unsubscribe =
      subscribeToNotifications(
        subscribedUserId,

        (incomingNotifications) => {
          setNotifications(
            incomingNotifications,
          );

          setLoadedUserId(
            subscribedUserId,
          );

          setNotificationError(null);
        },

        (subscriptionError) => {
          console.error(
            "Notification subscription failed:",
            subscriptionError,
          );

          setNotifications([]);

          setLoadedUserId(
            subscribedUserId,
          );

          setNotificationError({
            userId: subscribedUserId,
            message:
              "Unable to load notifications.",
          });
        },
      );

    /*
     * Firestore listener is removed when
     * the authenticated account changes,
     * logs out, or the provider unmounts.
     */
    return unsubscribe;
  }, [
    notificationUserId,
  ]);

  /*
   * Never expose notifications belonging
   * to a previously authenticated account.
   *
   * This also means logout immediately
   * exposes an empty inbox without needing
   * synchronous state updates in an effect.
   */
  const visibleNotifications =
    useMemo(
      () => {
        if (!notificationUserId) {
          return [];
        }

        if (
          loadedUserId !==
          notificationUserId
        ) {
          return [];
        }

        return notifications.filter(
          (notification) =>
            notification.recipientUid ===
            notificationUserId,
        );
      },
      [
        loadedUserId,
        notificationUserId,
        notifications,
      ],
    );

  /*
   * The inbox is loading when a valid user
   * exists but the first Firestore snapshot
   * for that user has not arrived yet.
   */
  const isLoadingNotifications =
    notificationUserId !== null &&
    loadedUserId !==
      notificationUserId;

  const error =
    notificationUserId &&
    notificationError?.userId ===
      notificationUserId
      ? notificationError.message
      : null;

  const markAsRead =
    useCallback(
      async (
        notificationId: string,
      ) => {
        try {
          await markNotificationAsRead(
            notificationId,
          );
        } catch (markError) {
          console.error(
            "Unable to mark notification as read:",
            markError,
          );

          throw markError;
        }
      },
      [],
    );

  const markAsUnread =
    useCallback(
      async (
        notificationId: string,
      ) => {
        try {
          await markNotificationAsUnread(
            notificationId,
          );
        } catch (markError) {
          console.error(
            "Unable to mark notification as unread:",
            markError,
          );

          throw markError;
        }
      },
      [],
    );

  const unreadCount =
    useMemo(
      () =>
        getUnreadNotificationCount(
          visibleNotifications,
        ),
      [visibleNotifications],
    );

  const contextValue =
    useMemo<NotificationContextValue>(
      () => ({
        notifications:
          visibleNotifications,

        unreadCount,

        isLoadingNotifications,

        error,

        markAsRead,

        markAsUnread,
      }),
      [
        visibleNotifications,
        unreadCount,
        isLoadingNotifications,
        error,
        markAsRead,
        markAsUnread,
      ],
    );

  return (
    <NotificationContext.Provider
      value={contextValue}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications():
  NotificationContextValue {
  const context =
    useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications must be used inside a NotificationProvider.",
    );
  }

  return context;
}