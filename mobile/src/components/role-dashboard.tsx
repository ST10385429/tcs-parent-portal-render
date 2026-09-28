import { useRouter } from "expo-router";
import { useState } from "react";
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
import { colors } from "@/theme/colors";

type DashboardStat = {
  label: string;
  value: string;
};

type DashboardAction = {
  label: string;
  description?: string;
  onPress: () => void;
};

type RoleDashboardProps = {
  role: string;
  greeting: string;
  subtitle: string;
  stats: DashboardStat[];

  /*
   * The original single-action properties remain supported so
   * existing parent and teacher dashboards do not break.
   */
  actionLabel?: string;
  onActionPress?: () => void;

  /*
   * Administrators can use multiple dashboard actions.
   */
  actions?: DashboardAction[];
};

export function RoleDashboard({
  role,
  greeting,
  subtitle,
  stats,
  actionLabel,
  onActionPress,
  actions,
}: RoleDashboardProps) {
  const router = useRouter();
  const { logout } = useAuth();

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);
  const [logoutError, setLogoutError] = useState("");

  const legacyActions: DashboardAction[] =
    actionLabel && onActionPress
      ? [
          {
            label: actionLabel,
            onPress: onActionPress,
          },
        ]
      : [];

  const visibleActions =
    actions && actions.length > 0
      ? actions
      : legacyActions;

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
        "You could not be logged out. Check your connection and try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.roleLabel}>
              {role.toUpperCase()}
            </Text>

            <Text style={styles.greeting}>
              {greeting}
            </Text>

            <Text style={styles.subtitle}>
              {subtitle}
            </Text>
          </View>

          <View
            accessible
            accessibilityLabel={`${role} profile`}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {role.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statusCard}>
            <View style={styles.statusDot} />

            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>
                You are signed in
              </Text>

              <Text style={styles.statusText}>
                Your identity and account role have been
                verified securely.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Overview
          </Text>

          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={styles.statCard}
              >
                <Text style={styles.statValue}>
                  {stat.value}
                </Text>

                <Text style={styles.statLabel}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {visibleActions.length > 0 ? (
            <View style={styles.actionsContainer}>
              <Text style={styles.actionsTitle}>
                Administration
              </Text>

              {visibleActions.map((action, index) => (
                <Pressable
                  key={action.label}
                  accessibilityHint={
                    action.description
                  }
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.actionButton,
                    index > 0 &&
                      styles.actionButtonSpacing,
                    pressed &&
                      styles.actionButtonPressed,
                  ]}
                >
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionButtonText}>
                      {action.label}
                    </Text>

                    {action.description ? (
                      <Text
                        style={
                          styles.actionButtonDescription
                        }
                      >
                        {action.description}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.actionButtonArrow}>
                    →
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>
              ACCOUNT STATUS
            </Text>

            <Text style={styles.nextTitle}>
              Secure access is active
            </Text>

            <Text style={styles.nextText}>
              Your dashboard access is determined by the role
              assigned to your account by the school.
            </Text>
          </View>

          {logoutError ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.errorContainer}
            >
              <Text style={styles.errorText}>
                {logoutError}
              </Text>
            </View>
          ) : null}

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
              <View style={styles.logoutLoadingContent}>
                <ActivityIndicator
                  color={colors.error}
                  size="small"
                />

                <Text style={styles.logoutText}>
                  Logging out...
                </Text>
              </View>
            ) : (
              <Text style={styles.logoutText}>
                Log out
              </Text>
            )}
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 42,
  },

  headerText: {
    flex: 1,
  },

  roleLabel: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 7,
  },

  greeting: {
    color: colors.textOnPrimary,
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    color: colors.primaryLight,
    fontSize: 13,
    marginTop: 5,
  },

  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 24,
    marginLeft: 15,
  },

  avatarText: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: "800",
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginTop: -20,
    padding: 17,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  statusDot: {
    width: 11,
    height: 11,
    backgroundColor: colors.success,
    borderRadius: 6,
    marginRight: 12,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 28,
    marginBottom: 13,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    width: "48%",
    minHeight: 112,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 17,
  },

  statValue: {
    color: colors.primary,
    fontSize: 27,
    fontWeight: "800",
  },

  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 7,
  },

  actionsContainer: {
    marginTop: 25,
  },

  actionsTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },

  actionButton: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },

  actionButtonSpacing: {
    marginTop: 11,
  },

  actionButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },

  actionTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  actionButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  actionButtonDescription: {
    color: colors.primaryLight,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  actionButtonArrow: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: "700",
  },

  nextCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    marginTop: 25,
    padding: 20,
  },

  nextEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  nextTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: 8,
  },

  nextText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  errorContainer: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    marginTop: 20,
    padding: 12,
  },

  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  logoutButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 15,
    marginTop: 24,
    paddingHorizontal: 20,
  },

  logoutButtonPressed: {
    backgroundColor: "#FBEDEC",
    transform: [{ scale: 0.98 }],
  },

  logoutButtonDisabled: {
    opacity: 0.65,
  },

  logoutLoadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  logoutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "800",
  },
});