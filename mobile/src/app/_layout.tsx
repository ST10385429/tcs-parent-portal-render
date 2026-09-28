import {
  type Href,
  Stack,
  useRouter,
  useSegments,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import {
  useEffect,
  useRef,
} from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AuthProvider,
  useAuth,
} from "@/context/auth-context";
import {
  NotificationProvider,
} from "@/context/notification-context";
import {
  registerNotificationDevice,
} from "@/services/notification-device-service";
import {
  registerForPushNotifications,
} from "@/services/push-notification-service";
import { colors } from "@/theme/colors";
import { type UserRole } from "@/types/auth";

const dashboardRoutes: Record<
  UserRole,
  Href
> = {
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

const protectedSections: UserRole[] = [
  "parent",
  "teacher",
  "admin",
];

type NotificationRouteData = {
  route?: unknown;
};

/*
 * Extract an internal application route
 * from an Expo notification response.
 */
function getNotificationRoute(
  response: Notifications.NotificationResponse,
): Href | null {
  const data =
    response.notification.request
      .content.data as NotificationRouteData;

  if (
    typeof data.route !== "string" ||
    !data.route.trim()
  ) {
    return null;
  }

  const route =
    data.route.trim();

  /*
   * Only allow internal application
   * routes supplied by our backend.
   */
  if (!route.startsWith("/")) {
    return null;
  }

  return route as Href;
}

/*
 * Prevent a notification from navigating
 * a signed-in user into another role's
 * protected section.
 */
function routeMatchesUserRole(
  route: Href,
  role: UserRole,
): boolean {
  const routeValue =
    String(route);

  return (
    routeValue === `/${role}` ||
    routeValue.startsWith(
      `/${role}/`,
    )
  );
}

function ProtectedNavigator() {
  const router =
    useRouter();

  const segments =
    useSegments();

  const {
    user,
    isLoading,
  } = useAuth();

  /*
   * Tracks which authenticated user has
   * already completed notification
   * registration during the current
   * application session.
   */
  const registeredUserUidRef =
    useRef<string | null>(
      null,
    );

  /*
   * Stores a notification destination
   * while authentication is still being
   * restored.
   */
  const pendingNotificationRouteRef =
    useRef<Href | null>(
      null,
    );

  /*
   * Prevent the same notification
   * response from being handled twice.
   */
  const handledNotificationIdRef =
    useRef<string | null>(
      null,
    );

  const currentSection =
    segments[0] as
      | string
      | undefined;

  /*
   * Authentication and role-based
   * navigation.
   */
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isProtectedSection =
      currentSection !== undefined &&
      protectedSections.includes(
        currentSection as UserRole,
      );

    const isPasswordChangeScreen =
      currentSection ===
      "change-password";

    if (!user) {
      if (
        isProtectedSection ||
        isPasswordChangeScreen
      ) {
        router.replace(
          "/login" as Href,
        );
      }

      return;
    }

    /*
     * Users with a temporary password
     * cannot access any other screen.
     */
    if (user.mustChangePassword) {
      if (
        !isPasswordChangeScreen
      ) {
        router.replace(
          "/change-password" as Href,
        );
      }

      return;
    }

    /*
     * Once the password has been
     * changed, prevent returning to
     * the password change screen.
     */
    if (isPasswordChangeScreen) {
      router.replace(
        dashboardRoutes[
          user.role
        ],
      );

      return;
    }

    /*
     * Signed-in users should not
     * return to the login screen.
     */
    if (
      currentSection ===
      "login"
    ) {
      router.replace(
        dashboardRoutes[
          user.role
        ],
      );

      return;
    }

    /*
     * Prevent users from opening a
     * dashboard belonging to another
     * role.
     */
    if (
      isProtectedSection &&
      currentSection !==
        user.role
    ) {
      router.replace(
        dashboardRoutes[
          user.role
        ],
      );
    }
  }, [
    currentSection,
    isLoading,
    router,
    user,
  ]);

  /*
   * Register the authenticated user's
   * physical device for push
   * notifications.
   */
  useEffect(() => {
    if (
      isLoading ||
      !user ||
      user.mustChangePassword
    ) {
      /*
       * Reset the registration marker
       * after logout so a different
       * account can register on the
       * same physical device.
       */
      if (!user) {
        registeredUserUidRef.current =
          null;
      }

      return;
    }

    /*
     * Capture the authenticated user
     * so TypeScript can safely use it
     * inside the asynchronous function.
     */
    const authenticatedUser =
      user;

    /*
     * Avoid repeating notification
     * registration whenever navigation
     * causes a re-render.
     */
    if (
      registeredUserUidRef.current ===
      authenticatedUser.uid
    ) {
      return;
    }

    registeredUserUidRef.current =
      authenticatedUser.uid;

    let isMounted =
      true;

    async function registerDevice() {
      try {
        /*
         * Request notification permission
         * and obtain the Expo push token.
         */
        const result =
          await registerForPushNotifications();

        if (!isMounted) {
          return;
        }

        if (
          result.permission ===
          "granted"
        ) {
          if (
            result.expoPushToken
          ) {
            /*
             * Associate this physical
             * device with the
             * authenticated Firebase
             * user in Firestore.
             */
            await registerNotificationDevice(
              {
                userId:
                  authenticatedUser.uid,

                role:
                  authenticatedUser.role,

                expoPushToken:
                  result.expoPushToken,
              },
            );

            if (!isMounted) {
              return;
            }

            console.log(
              "Push notification device registered successfully.",
            );
          } else {
            console.warn(
              "Notification permission was granted, but no push token was returned.",
            );
          }

          return;
        }

        if (
          result.permission ===
          "denied"
        ) {
          console.log(
            "Push notification permission was denied.",
          );

          return;
        }

        console.log(
          "Push notifications are not supported in the current environment.",
        );
      } catch (error) {
        /*
         * Allow registration to be
         * attempted again if this
         * attempt failed.
         */
        if (
          registeredUserUidRef.current ===
          authenticatedUser.uid
        ) {
          registeredUserUidRef.current =
            null;
        }

        console.error(
          "Push notification registration failed:",
          error,
        );
      }
    }

    void registerDevice();

    return () => {
      isMounted =
        false;
    };
  }, [
    isLoading,
    user,
  ]);

  /*
   * Listen for notification taps while
   * the native application is running
   * or sitting in the background.
   */
  useEffect(() => {
    if (
      Platform.OS === "web"
    ) {
      return;
    }

    const subscription =
      Notifications
        .addNotificationResponseReceivedListener(
          (
            response,
          ) => {
            const notificationId =
              response.notification
                .request
                .identifier;

            /*
             * Ignore a notification
             * response that has already
             * been processed.
             */
            if (
              handledNotificationIdRef
                .current ===
              notificationId
            ) {
              return;
            }

            const route =
              getNotificationRoute(
                response,
              );

            /*
             * Temporary diagnostic logs.
             *
             * These allow us to verify
             * exactly which route the
             * backend included in the
             * notification payload.
             */
            console.log(
              "Notification tapped. Route:",
              route,
            );

            console.log(
              "Notification tapped. Data:",
              response.notification.request
                .content.data,
            );

            if (!route) {
              console.warn(
                "The tapped notification does not contain a valid internal route.",
              );

              return;
            }

            handledNotificationIdRef.current =
              notificationId;

            /*
             * Authentication may still
             * be restoring when the
             * notification is tapped.
             */
            if (
              isLoading ||
              !user ||
              user.mustChangePassword
            ) {
              pendingNotificationRouteRef.current =
                route;

              return;
            }

            /*
             * Only allow navigation into
             * the authenticated user's
             * own protected section.
             */
            if (
              !routeMatchesUserRole(
                route,
                user.role,
              )
            ) {
              console.warn(
                "Notification route does not match the authenticated user role.",
              );

              return;
            }

            console.log(
              "Navigating from notification to:",
              route,
            );

            router.push(
              route,
            );
          },
        );

    return () => {
      subscription.remove();
    };
  }, [
    isLoading,
    router,
    user,
  ]);

  /*
   * Handle a notification that launched
   * the native application from a
   * terminated state.
   *
   * Expo's last-notification-response
   * API is native-only, so this does not
   * run on web.
   */
  useEffect(() => {
    if (
      Platform.OS === "web"
    ) {
      return;
    }

    let isMounted =
      true;

    async function handleInitialNotification() {
      try {
        const response =
          await Notifications
            .getLastNotificationResponseAsync();

        if (
          !isMounted ||
          !response
        ) {
          return;
        }

        const notificationId =
          response.notification
            .request
            .identifier;

        if (
          handledNotificationIdRef
            .current ===
          notificationId
        ) {
          return;
        }

        const route =
          getNotificationRoute(
            response,
          );

        /*
         * Diagnostic information for a
         * notification that opened the
         * application from a terminated
         * state.
         */
        console.log(
          "Initial notification route:",
          route,
        );

        console.log(
          "Initial notification data:",
          response.notification.request
            .content.data,
        );

        if (!route) {
          console.warn(
            "The notification that opened the app does not contain a valid internal route.",
          );

          return;
        }

        handledNotificationIdRef.current =
          notificationId;

        /*
         * Authentication may still be
         * restoring when the application
         * starts, so hold the destination
         * until the signed-in user is
         * known.
         */
        pendingNotificationRouteRef.current =
          route;
      } catch (error) {
        console.error(
          "Unable to read the notification that opened the app:",
          error,
        );
      }
    }

    void handleInitialNotification();

    return () => {
      isMounted =
        false;
    };
  }, []);

  /*
   * Once authentication is ready,
   * follow any notification route that
   * had to be delayed during startup.
   */
  useEffect(() => {
    if (
      isLoading ||
      !user ||
      user.mustChangePassword
    ) {
      return;
    }

    const pendingRoute =
      pendingNotificationRouteRef.current;

    if (!pendingRoute) {
      return;
    }

    pendingNotificationRouteRef.current =
      null;

    /*
     * Do not allow a stale notification
     * from another account to navigate
     * the currently signed-in user into
     * the wrong protected section.
     */
    if (
      !routeMatchesUserRole(
        pendingRoute,
        user.role,
      )
    ) {
      console.warn(
        "Pending notification route does not match the authenticated user role.",
      );

      return;
    }

    console.log(
      "Navigating to pending notification route:",
      pendingRoute,
    );

    router.push(
      pendingRoute,
    );
  }, [
    isLoading,
    router,
    user,
  ]);

  if (isLoading) {
    return (
      <View
        style={
          styles.loadingScreen
        }
      >
        <View
          style={
            styles.logo
          }
        >
          <Image
            accessibilityLabel="Thabazimbi Christian School logo"
            resizeMode="contain"
            source={require(
              "../../assets/images/tcs-logo.jpeg"
            )}
            style={
              styles.logoImage
            }
          />
        </View>

        <ActivityIndicator
          color={
            colors.accent
          }
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Checking your account...
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        style="light"
      />

      <Stack
        screenOptions={{
          headerShown:
            false,

          contentStyle: {
            backgroundColor:
              colors.background,
          },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ProtectedNavigator />
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles =
  StyleSheet.create({
    loadingScreen: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        colors.primary,

      paddingHorizontal:
        24,
    },

    logo: {
      width: 76,
      height: 76,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        colors.surface,

      borderWidth:
        2,

      borderColor:
        colors.accent,

      borderRadius:
        38,

      marginBottom:
        24,

      overflow:
        "hidden",
    },

    logoImage: {
      width: 64,
      height: 64,
    },

    loadingText: {
      color:
        colors.primaryLight,

      fontSize:
        14,

      marginTop:
        14,

      textAlign:
        "center",
    },
  });