import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type Href,
  useRouter,
} from "expo-router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import {
  subscribeToAdministratorRequests,
} from "@/services/parent-request-service";
import {
  getAllSubmittedSubjectResults,
} from "@/services/subject-result-service";
import {
  getAllUsers,
} from "@/services/user-service";
import { colors } from "@/theme/colors";
import type {
  AppUser,
} from "@/types/auth";
import type {
  ParentServiceRequest,
  SubjectResult,
} from "@/types/school";

type AdminAction = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  colour: string;
  route: Href;
};

const adminActions: AdminAction[] = [
  {
    label: "Parent requests",
    description:
      "Review queries, absence reports and appointments.",
    icon: "mail-open-outline",
    colour: colors.info,
    route: "/admin/requests" as Href,
  },
  {
    label: "Reports and results",
    description:
      "Review teacher submissions and compile reports.",
    icon: "document-text-outline",
    colour: colors.success,
    route: "/admin/results" as Href,
  },
  {
    label: "Manage learners",
    description:
      "Create learner profiles, manage enrolments and transfer learners.",
    icon: "person-add-outline",
    colour: colors.info,
    route: "/admin/learners" as Href,
  },
  {
    label: "Manage classes",
    description:
      "Create classes, manage academic years and control active classes.",
    icon: "school-outline",
    colour: colors.primary,
    route: "/admin/classes" as Href,
  },
  {
    label: "Manage fees",
    description:
      "Review fee structures and learner balances.",
    icon: "wallet-outline",
    colour: colors.warning,
    route: "/admin/fees" as Href,
  },
  {
    label: "Manage users",
    description:
      "View parent, teacher and administrator accounts.",
    icon: "people-outline",
    colour: colors.primary,
    route: "/admin/users" as Href,
  },
  {
    label: "Issue fee statement",
    description:
      "Create an official charge for a linked learner.",
    icon: "receipt-outline",
    colour: colors.error,
    route:
      "/admin/issue-statement" as Href,
  },
  {
    label: "Record payment",
    description:
      "Record a verified EFT, cash or card payment.",
    icon: "card-outline",
    colour: colors.accent,
    route:
      "/admin/record-payment" as Href,
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const [users, setUsers] = useState<
    AppUser[]
  >([]);

  const [
    submittedResults,
    setSubmittedResults,
  ] = useState<SubjectResult[]>([]);

  const [
    parentRequests,
    setParentRequests,
  ] = useState<ParentServiceRequest[]>(
    [],
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [loadFailed, setLoadFailed] =
    useState(false);

  const [logoutError, setLogoutError] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getAllUsers(),
      getAllSubmittedSubjectResults(),
    ])
      .then(
        ([
          loadedUsers,
          loadedResults,
        ]) => {
          if (!isMounted) {
            return;
          }

          setUsers(loadedUsers);
          setSubmittedResults(
            loadedResults,
          );
          setLoadFailed(false);
        },
      )
      .catch((error) => {
        console.error(
          "Unable to load administrator dashboard:",
          error,
        );

        if (isMounted) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToAdministratorRequests(
      (loadedRequests) => {
        setParentRequests(
          loadedRequests,
        );
      },
      (error) => {
        console.error(
          "Unable to load administrator request summary:",
          error,
        );

        setLoadFailed(true);
      },
    );
  }, []);

  const dashboardStats = useMemo(() => {
    const parentCount = users.filter(
      (account) =>
        account.role === "parent",
    ).length;

    const teacherCount = users.filter(
      (account) =>
        account.role === "teacher",
    ).length;

    const openRequestCount =
      parentRequests.filter(
        (request) =>
          request.status !==
            "resolved" &&
          request.status !==
            "completed" &&
          request.status !==
            "cancelled",
      ).length;

    const submittedLearnerCount =
      new Set(
        submittedResults.map(
          (result) =>
            `${result.learnerId}-${result.academicYear}-${result.term}`,
        ),
      ).size;

    return [
      {
        label: "PARENT ACCOUNTS",
        value: isLoading
          ? "..."
          : String(parentCount),
        icon: "people-outline" as const,
        colour: colors.info,
      },
      {
        label: "TEACHER ACCOUNTS",
        value: isLoading
          ? "..."
          : String(teacherCount),
        icon: "school-outline" as const,
        colour: colors.success,
      },
      {
        label: "OPEN REQUESTS",
        value: String(
          openRequestCount,
        ),
        icon:
          "mail-unread-outline" as const,
        colour: colors.warning,
      },
      {
        label: "REPORTS TO COMPILE",
        value: isLoading
          ? "..."
          : String(
              submittedLearnerCount,
            ),
        icon:
          "document-text-outline" as const,
        colour: colors.error,
      },
    ];
  }, [
    isLoading,
    parentRequests,
    submittedResults,
    users,
  ]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      setLogoutError("");

      await logout();

      router.replace("/login");
    } catch {
      setLogoutError(
        "You could not be logged out. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View
              style={
                styles.greetingContainer
              }
            >
              <Text style={styles.greeting}>
                Good day,{" "}
                {user?.firstName ||
                  "Administrator"}
              </Text>

              <Text
                style={styles.schoolName}
              >
                Thabazimbi Christian
                School
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Log out"
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.profileButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              {isLoggingOut ? (
                <ActivityIndicator
                  color={
                    colors.textOnPrimary
                  }
                  size="small"
                />
              ) : (
                <Ionicons
                  color={
                    colors.textOnPrimary
                  }
                  name="log-out-outline"
                  size={23}
                />
              )}
            </Pressable>
          </View>

          <View style={styles.adminBadge}>
            <View
              style={styles.statusDot}
            />

            <Text
              style={
                styles.adminBadgeText
              }
            >
              ADMINISTRATOR ACCESS ACTIVE
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {loadFailed ? (
            <View
              style={styles.warningCard}
            >
              <Ionicons
                color={colors.warning}
                name="warning-outline"
                size={20}
              />

              <Text
                style={styles.warningText}
              >
                Some dashboard information
                could not be loaded.
              </Text>
            </View>
          ) : null}

          {logoutError ? (
            <Text style={styles.errorText}>
              {logoutError}
            </Text>
          ) : null}

          <Text style={styles.sectionTitle}>
            At a glance
          </Text>

          <View style={styles.statsGrid}>
            {dashboardStats.map(
              (stat) => (
                <View
                  key={stat.label}
                  style={styles.statCard}
                >
                  <View
                    style={[
                      styles.statIcon,
                      {
                        backgroundColor:
                          `${stat.colour}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      color={stat.colour}
                      name={stat.icon}
                      size={20}
                    />
                  </View>

                  <Text
                    style={styles.statValue}
                  >
                    {stat.value}
                  </Text>

                  <Text
                    style={styles.statLabel}
                  >
                    {stat.label}
                  </Text>
                </View>
              ),
            )}
          </View>

          <View
            style={styles.sectionHeader}
          >
            <Text
              style={styles.sectionTitle}
            >
              Administration
            </Text>

            <Text
              style={styles.sectionHint}
            >
              Select a workspace
            </Text>
          </View>

          <View style={styles.actionsGrid}>
            {adminActions.map(
              (action) => (
                <Pressable
                  key={action.label}
                  accessibilityHint={
                    action.description
                  }
                  accessibilityLabel={
                    action.label
                  }
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      action.route,
                    )
                  }
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed &&
                      styles.actionCardPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      {
                        backgroundColor:
                          `${action.colour}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      color={
                        action.colour
                      }
                      name={action.icon}
                      size={23}
                    />
                  </View>

                  <Text
                    style={
                      styles.actionTitle
                    }
                  >
                    {action.label}
                  </Text>

                  <Text
                    style={
                      styles.actionDescription
                    }
                  >
                    {action.description}
                  </Text>

                  <View
                    style={
                      styles.actionFooter
                    }
                  >
                    <Text
                      style={
                        styles.actionLink
                      }
                    >
                      Open
                    </Text>

                    <Ionicons
                      color={colors.primary}
                      name="arrow-forward"
                      size={17}
                    />
                  </View>
                </Pressable>
              ),
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },

  pressed: {
    opacity: 0.75,
  },

  header: {
    backgroundColor: colors.primary,
    paddingBottom: 38,
    paddingHorizontal: 22,
    paddingTop: 24,
  },

  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  greetingContainer: {
    flex: 1,
  },

  greeting: {
    color: colors.textOnPrimary,
    fontSize: 24,
    fontWeight: "800",
  },

  schoolName: {
    color: colors.primaryLight,
    fontSize: 13,
    marginTop: 5,
  },

  profileButton: {
    alignItems: "center",
    backgroundColor:
      `${colors.textOnPrimary}16`,
    borderColor:
      `${colors.textOnPrimary}30`,
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    marginLeft: 14,
    width: 46,
  },

  adminBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor:
      `${colors.textOnPrimary}12`,
    borderRadius: 14,
    flexDirection: "row",
    marginTop: 22,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  statusDot: {
    backgroundColor: colors.success,
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },

  adminBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  content: {
    alignSelf: "center",
    maxWidth: 720,
    paddingBottom: 34,
    paddingHorizontal: 20,
    width: "100%",
  },

  warningCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: -18,
    padding: 14,
  },

  warningText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 12,
  },

  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 12,
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 13,
    marginTop: 25,
  },

  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },

  sectionHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 13,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    minHeight: 128,
    padding: 15,
    width: "48%",
  },

  statIcon: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  statValue: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
    marginTop: 10,
  },

  statLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 3,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 188,
    padding: 16,
    width: "48%",
  },

  actionCardPressed: {
    opacity: 0.76,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  actionIcon: {
    alignItems: "center",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },

  actionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 13,
  },

  actionDescription: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  actionFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  actionLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});