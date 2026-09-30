import Ionicons from "@expo/vector-icons/Ionicons";

import {
  type Href,
  useRouter,
} from "expo-router";

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

type AccountSettingsScreenProps = {
  dashboardRoute: Href;
  roleDescription: string;
  roleLabel: string;
};

function getInitials(
  firstName: string,
  lastName: string,
): string {
  return (
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    "U"
  );
}

export function AccountSettingsScreen({
  dashboardRoute,
  roleDescription,
  roleLabel,
}: AccountSettingsScreenProps) {
  const router = useRouter();

  const { logout, user } = useAuth();

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() ||
      roleLabel
    : roleLabel;

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      setErrorMessage("");

      await logout();

      router.replace("/login" as Href);
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
            accessibilityHint={
              "Returns to your dashboard."
            }
            accessibilityLabel={
              `Return to ${roleLabel.toLowerCase()} dashboard`
            }
            accessibilityRole="button"
            onPress={() =>
              router.replace(dashboardRoute)
            }
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
            Settings
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
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

            <View style={styles.profileInformation}>
              <Text style={styles.profileName}>
                {displayName}
              </Text>

              <Text style={styles.profileRole}>
                {roleLabel.toUpperCase()} ACCOUNT
              </Text>

              <Text style={styles.profileEmail}>
                {user?.email ?? ""}
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View
              accessible
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
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
            ACCOUNT SECURITY
          </Text>

          <View style={styles.sectionCard}>
            <Pressable
              accessibilityHint={
                "Opens the secure password change form."
              }
              accessibilityLabel="Change password"
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  "/change-password" as Href,
                )
              }
              style={({ pressed }) => [
                styles.settingRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.settingIcon}>
                <Ionicons
                  color={colors.primary}
                  name="key-outline"
                  size={21}
                />
              </View>

              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  Change password
                </Text>

                <Text
                  style={styles.settingDescription}
                >
                  Update your password to keep your
                  account secure.
                </Text>
              </View>

              <Ionicons
                color={colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>
            ACCESS
          </Text>

          <View style={styles.securityCard}>
            <Ionicons
              color={colors.success}
              name="shield-checkmark-outline"
              size={23}
            />

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>
                Role-protected account
              </Text>

              <Text style={styles.securityText}>
                {roleDescription}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityHint={
              isLoggingOut
                ? "Please wait while you are signed out."
                : "Signs out of this device."
            }
            accessibilityLabel={
              isLoggingOut
                ? "Logging out"
                : "Log out"
            }
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
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
  },

  backButton: {
    width: 75,
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
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
    alignItems: "center",
    flexDirection: "row",
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
    alignItems: "center",
    flexDirection: "row",
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

  settingRow: {
    minHeight: 78,
    alignItems: "center",
    flexDirection: "row",
    padding: 14,
  },

  settingIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
  },

  settingContent: {
    flex: 1,
    marginHorizontal: 11,
  },

  settingTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  settingDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  securityCard: {
    alignItems: "center",
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
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
    alignItems: "center",
    flexDirection: "row",
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