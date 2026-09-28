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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { getParentLearners } from "@/services/learner-service";
import { colors } from "@/theme/colors";
import type { Learner } from "@/types/school";

function getInitials(
  firstName: string,
  lastName: string,
): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "P";
}

export default function ParentProfileScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const [learners, setLearners] =
    useState<Learner[]>([]);
  const [
    isLoadingLearners,
    setIsLoadingLearners,
  ] = useState(true);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return () => {
        isMounted = false;
      };
    }

    getParentLearners(user.uid)
      .then((loadedLearners) => {
        if (isMounted) {
          setLearners(loadedLearners);
          setErrorMessage("");
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage(
            "Linked learners could not be loaded. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingLearners(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const learnerSummary = useMemo(() => {
    if (learners.length === 0) {
      return "No linked learners";
    }

    if (learners.length === 1) {
      return `Parent of ${learners[0].firstName}`;
    }

    return `Parent of ${learners.length} linked learners`;
  }, [learners]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      setErrorMessage("");

      await logout();
      router.replace("/login");
    } catch {
      setErrorMessage(
        "You could not be logged out. Check your connection and try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to parent dashboard"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />

            <Text style={styles.backText}>
              Back
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            My Profile
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(
                  user?.firstName ?? "",
                  user?.lastName ?? "",
                )}
              </Text>
            </View>

            <View
              style={styles.profileInformation}
            >
              <Text style={styles.profileName}>
                {user
                  ? `${user.firstName} ${user.lastName}`.trim()
                  : "Parent"}
              </Text>

              <Text style={styles.profileRole}>
                {learnerSummary}
              </Text>

              <Text style={styles.profileEmail}>
                {user?.email ?? ""}
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.errorCard}
            >
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={20}
              />

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>
            LINKED LEARNERS
          </Text>

          <View style={styles.sectionCard}>
            {isLoadingLearners ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  color={colors.primary}
                  size="small"
                />

                <Text
                  style={styles.loadingText}
                >
                  Loading linked learners...
                </Text>
              </View>
            ) : learners.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons
                  color={colors.textSecondary}
                  name="people-outline"
                  size={25}
                />

                <Text style={styles.emptyText}>
                  No active learners are linked
                  to this account. Contact the
                  school administrator if a
                  learner is missing.
                </Text>
              </View>
            ) : (
              learners.map(
                (learner, index) => (
                  <View key={learner.id}>
                    {index > 0 ? (
                      <View
                        style={styles.divider}
                      />
                    ) : null}

                    <View
                      style={styles.learnerRow}
                    >
                      <View
                        style={styles.childAvatar}
                      >
                        <Text
                          style={
                            styles.childInitials
                          }
                        >
                          {getInitials(
                            learner.firstName,
                            learner.lastName,
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.learnerInformation
                        }
                      >
                        <Text
                          style={
                            styles.learnerName
                          }
                        >
                          {learner.firstName}{" "}
                          {learner.lastName}
                        </Text>

                        <Text
                          style={
                            styles.learnerDetails
                          }
                        >
                          {learner.schoolClass
                            ?.name ??
                            `Grade ${learner.currentGradeNumber}`}
                          {learner.studentNumber
                            ? ` • ${learner.studentNumber}`
                            : ""}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.activeBadge
                        }
                      >
                        <Text
                          style={
                            styles.activeBadgeText
                          }
                        >
                          ACTIVE
                        </Text>
                      </View>
                    </View>
                  </View>
                ),
              )
            )}
          </View>

          <Text style={styles.sectionLabel}>
            PREFERENCES
          </Text>

          <View style={styles.sectionCard}>
            <Pressable
              accessibilityLabel="Choose preferred language"
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  "/parent/language" as Href,
                )
              }
              style={({ pressed }) => [
                styles.preferenceRow,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={styles.preferenceIcon}
              >
                <Ionicons
                  color={colors.primary}
                  name="language-outline"
                  size={20}
                />
              </View>

              <View
                style={
                  styles.preferenceContent
                }
              >
                <Text
                  style={
                    styles.preferenceTitle
                  }
                >
                  Language preference
                </Text>

                <Text
                  style={
                    styles.preferenceDescription
                  }
                >
                  Save the language you prefer
                  for approved school content.
                </Text>
              </View>

              <Ionicons
                color={colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </Pressable>
          </View>

          <View style={styles.securityCard}>
            <Ionicons
              color={colors.success}
              name="shield-checkmark-outline"
              size={23}
            />

            <View
              style={styles.securityContent}
            >
              <Text
                style={styles.securityTitle}
              >
                Role-protected account
              </Text>

              <Text
                style={styles.securityText}
              >
                Your access is limited to
                learners linked by a school
                administrator.
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="Log out"
            accessibilityRole="button"
            accessibilityState={{
              busy: isLoggingOut,
              disabled: isLoggingOut,
            }}
            disabled={isLoggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed &&
                !isLoggingOut &&
                styles.logoutButtonPressed,
              isLoggingOut &&
                styles.logoutButtonDisabled,
            ]}
          >
            {isLoggingOut ? (
              <ActivityIndicator
                color={colors.error}
                size="small"
              />
            ) : (
              <Ionicons
                color={colors.error}
                name="log-out-outline"
                size={21}
              />
            )}

            <Text style={styles.logoutText}>
              {isLoggingOut
                ? "Logging out..."
                : "Log out"}
            </Text>
          </Pressable>

          <Text style={styles.versionText}>
            TCS Parent Portal • Version 1.0.0
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
  },

  backButton: {
    width: 75,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  headerSpacer: {
    width: 75,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 17,
  },

  avatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 29,
  },

  avatarText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  profileInformation: {
    flex: 1,
    marginLeft: 13,
  },

  profileName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },

  profileRole: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  profileEmail: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.burgundyLight,
    borderColor: colors.error,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 8,
  },

  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 9,
    marginLeft: 3,
  },

  sectionCard: {
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },

  loadingRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 10,
  },

  emptyRow: {
    alignItems: "center",
    padding: 20,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },

  learnerRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  childAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 21,
  },

  childInitials: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  learnerInformation: {
    flex: 1,
    marginLeft: 11,
  },

  learnerName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  learnerDetails: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  activeBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  activeBadgeText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 14,
  },

  preferenceRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  preferenceIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
  },

  preferenceContent: {
    flex: 1,
    marginHorizontal: 11,
  },

  preferenceTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  preferenceDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },

  securityContent: {
    flex: 1,
    marginLeft: 11,
  },

  securityTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  securityText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  logoutButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 15,
    marginTop: 25,
  },

  logoutButtonPressed: {
    backgroundColor: colors.burgundyLight,
  },

  logoutButtonDisabled: {
    opacity: 0.6,
  },

  logoutText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "800",
  },

  versionText: {
    color: colors.textSecondary,
    fontSize: 9,
    textAlign: "center",
    marginTop: 18,
  },

  pressed: {
    opacity: 0.65,
  },
});