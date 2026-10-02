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
  subscribeToTeacherAppointments,
} from "@/services/parent-request-service";
import {
  getTeacherAssignments,
} from "@/services/teacher-service";
import { colors } from "@/theme/colors";
import type {
  ParentServiceRequest,
  TeacherClassAssignment,
} from "@/types/school";

export default function TeacherDashboard() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const [assignments, setAssignments] =
    useState<TeacherClassAssignment[]>([]);

  const [appointments, setAppointments] =
    useState<ParentServiceRequest[]>([]);

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

    if (!user) {
      return () => {
        isMounted = false;
      };
    }

    getTeacherAssignments(user.uid)
      .then((loadedAssignments) => {
        if (!isMounted) {
          return;
        }

        setAssignments(loadedAssignments);
        setLoadFailed(false);
      })
      .catch((error) => {
        console.error(
          "Unable to load teacher assignments:",
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
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToTeacherAppointments(
      user.uid,
      (loadedAppointments) => {
        setAppointments(
          loadedAppointments,
        );
      },
      (error) => {
        console.error(
          "Unable to load teacher appointments:",
          error,
        );
        setLoadFailed(true);
      },
    );
  }, [user]);

  const dashboardStats = useMemo(() => {
    const learnerIds = new Set<string>();
    const subjects = new Set<string>();

    assignments.forEach((assignment) => {
      subjects.add(assignment.subject);

      assignment.learners.forEach(
        (learner) =>
          learnerIds.add(learner.id),
      );
    });

    const activeAppointmentCount =
      appointments.filter(
        (appointment) =>
          appointment.status !==
            "completed" &&
          appointment.status !==
            "cancelled",
      ).length;

    return [
      {
        label: "LEARNERS",
        value: isLoading
          ? "..."
          : String(learnerIds.size),
        icon: "people-outline" as const,
        colour: colors.info,
      },
      {
        label: "ASSIGNED CLASSES",
        value: isLoading
          ? "..."
          : String(assignments.length),
        icon: "school-outline" as const,
        colour: colors.success,
      },
      {
        label: "APPOINTMENTS",
        value: String(
          activeAppointmentCount,
        ),
        icon:
          "calendar-outline" as const,
        colour: colors.warning,
      },
      {
        label: "SUBJECTS",
        value: isLoading
          ? "..."
          : String(subjects.size),
        icon: "book-outline" as const,
        colour: colors.primary,
      },
    ];
  }, [
    appointments,
    assignments,
    isLoading,
  ]);

  const teacherName = user?.firstName
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Teacher";

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View
              style={styles.greetingContainer}
            >
              <Text style={styles.greeting}>
                Good day, {teacherName}
              </Text>

              <Text style={styles.schoolName}>
                Thabazimbi Christian School
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Log out"
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              {isLoggingOut ? (
                <ActivityIndicator
                  color={colors.textOnPrimary}
                  size="small"
                />
              ) : (
                <Ionicons
                  color={colors.textOnPrimary}
                  name="log-out-outline"
                  size={23}
                />
              )}
            </Pressable>
          </View>

          <Text style={styles.assignmentLabel}>
            YOUR ACTIVE ASSIGNMENTS
          </Text>

          {isLoading ? (
            <View
              style={styles.assignmentLoading}
            >
              <ActivityIndicator
                color={colors.textOnPrimary}
                size="small"
              />

              <Text
                style={styles.assignmentLoadingText}
              >
                Loading assignments...
              </Text>
            </View>
          ) : assignments.length === 0 ? (
            <Text style={styles.noAssignmentText}>
              No active class assignments
            </Text>
          ) : (
            <ScrollView
              horizontal
              contentContainerStyle={
                styles.assignmentRow
              }
              showsHorizontalScrollIndicator={
                false
              }
            >
              {assignments.map(
                (assignment) => (
                  <View
                    key={assignment.id}
                    style={styles.assignmentChip}
                  >
                    <Text
                      style={styles.assignmentClass}
                    >
                      {assignment.schoolClass.name}
                    </Text>

                    <Text
                      style={
                        styles.assignmentSubject
                      }
                    >
                      {assignment.subject}
                    </Text>
                  </View>
                ),
              )}
            </ScrollView>
          )}
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
                Some teacher information could
                not be loaded.
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
            {dashboardStats.map((stat) => (
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

                <Text style={styles.statValue}>
                  {stat.value}
                </Text>

                <Text style={styles.statLabel}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>
            Teacher workspace
          </Text>

          <Pressable
            accessibilityHint={
              "Open the list of learners assigned to you."
            }
            accessibilityLabel="Assigned learners"
            accessibilityRole="button"
            onPress={() =>
              router.push(
                "/teacher/learners" as Href,
              )
            }
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                styles.learnersIcon,
              ]}
            >
              <Ionicons
                color={colors.info}
                name="people-outline"
                size={25}
              />
            </View>

            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>
                Assigned learners
              </Text>

              <Text
                style={styles.actionDescription}
              >
                View learners and create academic
                subject results.
              </Text>
            </View>

            <Ionicons
              color={colors.primary}
              name="chevron-forward"
              size={21}
            />
          </Pressable>

          <Pressable
            accessibilityHint={
              "Open parent appointment requests."
            }
            accessibilityLabel="Parent appointments"
            accessibilityRole="button"
            onPress={() =>
              router.push(
                "/teacher/appointments" as Href,
              )
            }
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                styles.appointmentsIcon,
              ]}
            >
              <Ionicons
                color={colors.warning}
                name="calendar-outline"
                size={25}
              />
            </View>

            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>
                Parent appointments
              </Text>

              <Text
                style={styles.actionDescription}
              >
                Review and respond to appointment
                requests.
              </Text>
            </View>

            <Ionicons
              color={colors.primary}
              name="chevron-forward"
              size={21}
            />
          </Pressable>

          <Pressable
            accessibilityHint={
              "Open your account and security settings."
            }
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() =>
              router.push(
                "/teacher/settings" as Href,
              )
            }
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                styles.settingsIcon,
              ]}
            >
              <Ionicons
                color={colors.primary}
                name="settings-outline"
                size={25}
              />
            </View>

            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>
                Settings
              </Text>

              <Text
                style={styles.actionDescription}
              >
                Manage your account, password and
                security settings.
              </Text>
            </View>

            <Ionicons
              color={colors.primary}
              name="chevron-forward"
              size={21}
            />
          </Pressable>
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
    opacity: 0.74,
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

  assignmentLabel: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 22,
  },

  assignmentLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 11,
  },

  assignmentLoadingText: {
    color: colors.textOnPrimary,
    fontSize: 12,
  },

  noAssignmentText: {
    color: colors.primaryLight,
    fontSize: 12,
    marginTop: 10,
  },

  assignmentRow: {
    gap: 9,
    paddingTop: 10,
  },

  assignmentChip: {
    backgroundColor:
      `${colors.textOnPrimary}12`,
    borderColor:
      `${colors.textOnPrimary}25`,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  assignmentClass: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  assignmentSubject: {
    color: colors.primaryLight,
    fontSize: 10,
    marginTop: 2,
  },

  content: {
    alignSelf: "center",
    maxWidth: 620,
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

  actionCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
  },

  actionCardPressed: {
    opacity: 0.76,
    transform: [
      {
        scale: 0.995,
      },
    ],
  },

  actionIcon: {
    alignItems: "center",
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    width: 46,
  },

  learnersIcon: {
    backgroundColor: `${colors.info}18`,
  },

  appointmentsIcon: {
    backgroundColor: `${colors.warning}18`,
  },

  settingsIcon: {
    backgroundColor: `${colors.primary}18`,
  },

  actionContent: {
    flex: 1,
    marginHorizontal: 13,
  },

  actionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  actionDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});