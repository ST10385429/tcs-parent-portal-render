import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getTeacherLearnerById } from "@/services/teacher-service";
import { colors } from "@/theme/colors";
import type { Learner } from "@/types/school";

export default function TeacherLearnerDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    learnerId?: string | string[];
  }>();

  const learnerId = Array.isArray(params.learnerId)
    ? params.learnerId[0]
    : params.learnerId;

  const [learner, setLearner] = useState<Learner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadLearner = async () => {
      if (!learnerId) {
        if (isMounted) {
          setErrorMessage("No learner was selected.");
          setIsLoading(false);
        }

        return;
      }

      try {
        const learnerResult = await getTeacherLearnerById(learnerId);

        if (!isMounted) {
          return;
        }

        if (!learnerResult) {
          setErrorMessage(
            "This learner could not be found or is not assigned to your class.",
          );
          return;
        }

        setLearner(learnerResult);
        setErrorMessage("");
      } catch (error) {
        console.error("Unable to load learner:", error);

        if (isMounted) {
          setErrorMessage(
            "The learner information could not be loaded. Check your connection and try again.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadLearner();

    return () => {
      isMounted = false;
    };
  }, [learnerId]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/teacher/learners");
  };

  const handleCreateReport = () => {
    if (!learner) {
      return;
    }

    const reportRoute = `/teacher/report/new?learnerId=${encodeURIComponent(learner.id)}`;

    router.push(reportRoute as Href);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />

          <Text style={styles.loadingText}>Loading learner information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !learner) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorScreen}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>

          <Text style={styles.errorTitle}>Learner unavailable</Text>

          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {errorMessage || "The learner information could not be found."}
          </Text>

          <Pressable
            accessibilityLabel="Return to learners"
            accessibilityRole="button"
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Return to learners</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${learner.firstName} ${learner.lastName}`.trim();

  const initials =
    `${learner.firstName.charAt(0)}${learner.lastName.charAt(0)}`.toUpperCase();

  const className =
    learner.schoolClass?.name ||
    (learner.currentGradeNumber
      ? `Grade ${learner.currentGradeNumber}`
      : "Not assigned");

  const academicYear =
    learner.schoolClass?.academicYear?.toString() || "Not available";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back to learners"
            accessibilityRole="button"
            hitSlop={12}
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerEyebrow}>TEACHER PORTAL</Text>

            <Text style={styles.headerTitle}>Learner details</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={styles.profileCard}>
            <View
              accessible
              accessibilityLabel={`${fullName} profile`}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials || "L"}</Text>
            </View>

            <Text style={styles.learnerName}>{fullName}</Text>

            <Text style={styles.className}>{className}</Text>

            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />

              <Text style={styles.activeText}>Active learner</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Learner information</Text>

          <View style={styles.informationCard}>
            <InformationRow
              label="First name"
              value={learner.firstName || "Not available"}
            />

            <View style={styles.divider} />

            <InformationRow
              label="Last name"
              value={learner.lastName || "Not available"}
            />

            <View style={styles.divider} />

            <InformationRow
              label="Student number"
              value={learner.studentNumber || "Not available"}
            />

            <View style={styles.divider} />

            <InformationRow label="Class" value={className} />

            <View style={styles.divider} />

            <InformationRow
              label="Grade"
              value={
                learner.currentGradeNumber
                  ? `Grade ${learner.currentGradeNumber}`
                  : "Not available"
              }
            />

            <View style={styles.divider} />

            <InformationRow label="Academic year" value={academicYear} />
          </View>

          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <Ionicons
                color={colors.textOnPrimary}
                name="shield-checkmark-outline"
                size={19}
              />
            </View>

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Secure teacher access</Text>

              <Text style={styles.securityText}>
                You can view this learner because they are enrolled in a class
                assigned to your teacher account.
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityHint="Opens the academic report form"
            accessibilityLabel={`Create a report for ${fullName}`}
            accessibilityRole="button"
            onPress={handleCreateReport}
            style={({ pressed }) => [
              styles.createReportButton,
              pressed && styles.createReportButtonPressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="document-text-outline"
              size={21}
            />

            <Text style={styles.createReportButtonText}>
              Create academic report
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Return to class list"
            accessibilityRole="button"
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Return to class list</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type InformationRowProps = {
  label: string;
  value: string;
};

function InformationRow({ label, value }: InformationRowProps) {
  return (
    <View style={styles.informationRow}>
      <Text style={styles.informationLabel}>{label}</Text>

      <Text style={styles.informationValue}>{value}</Text>
    </View>
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingTop: 18,
    paddingBottom: 42,
  },

  backButton: {
    width: 75,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backButtonPressed: {
    opacity: 0.7,
  },

  backText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  headerTextContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  headerEyebrow: {
    color: colors.accentLight,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 4,
  },

  headerSpacer: {
    width: 75,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 13,
  },

  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 28,
  },

  errorIcon: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDECEC",
    borderRadius: 28,
  },

  errorIconText: {
    color: colors.error,
    fontSize: 27,
    fontWeight: "800",
  },

  errorTitle: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 16,
  },

  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },

  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 25,
  },

  primaryButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },

  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    marginTop: -22,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  avatar: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 39,
  },

  avatarText: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: "800",
  },

  learnerName: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 15,
  },

  className: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 5,
  },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderRadius: 18,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  activeDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.success,
    borderRadius: 4,
    marginRight: 7,
  },

  activeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 28,
    marginBottom: 13,
  },

  informationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 18,
  },

  informationRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },

  informationLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginRight: 16,
  },

  informationValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    marginTop: 22,
    padding: 17,
  },

  securityIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    borderRadius: 18,
    marginRight: 12,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },

  securityText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  createReportButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 23,
    paddingHorizontal: 20,
  },

  createReportButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },

  createReportButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 15,
    marginTop: 11,
    paddingHorizontal: 20,
  },

  secondaryButtonPressed: {
    backgroundColor: colors.primaryLight,
    transform: [{ scale: 0.98 }],
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
});
