import {
  type Href,
  useRouter,
} from "expo-router";

import { useMemo, useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

import {
  changeCurrentUserPassword,
  getPasswordChangeErrorMessage,
} from "@/services/auth-service";

import { colors } from "@/theme/colors";

import type { UserRole } from "@/types/auth";

const dashboardRoutes: Record<UserRole, Href> = {
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

type PasswordRequirement = {
  label: string;
  isMet: boolean;
};

export default function ChangePasswordScreen() {
  const router = useRouter();

  const {
    user,
    logout,
    refreshUser,
  } = useAuth();

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const requirements =
    useMemo<PasswordRequirement[]>(
      () => [
        {
          label:
            "At least 8 characters",
          isMet:
            newPassword.length >= 8,
        },
        {
          label:
            "One uppercase letter",
          isMet:
            /[A-Z]/.test(newPassword),
        },
        {
          label:
            "One lowercase letter",
          isMet:
            /[a-z]/.test(newPassword),
        },
        {
          label: "One number",
          isMet:
            /[0-9]/.test(newPassword),
        },
        {
          label:
            "One special character",
          isMet:
            /[^A-Za-z0-9]/.test(
              newPassword,
            ),
        },
      ],
      [newPassword],
    );

  const allRequirementsMet =
    requirements.every(
      (requirement) =>
        requirement.isMet,
    );

  const passwordsMatch =
    newPassword.length > 0 &&
    newPassword === confirmPassword;

  const formIsComplete =
    currentPassword.length > 0 &&
    allRequirementsMet &&
    passwordsMatch;

  const handleChangePassword =
    async () => {
      setErrorMessage("");

      if (!currentPassword) {
        setErrorMessage(
          "Please enter your temporary password.",
        );
        return;
      }

      if (!newPassword) {
        setErrorMessage(
          "Please enter a new password.",
        );
        return;
      }

      if (!allRequirementsMet) {
        setErrorMessage(
          "Your new password does not meet all the password requirements.",
        );
        return;
      }

      if (
        newPassword !== confirmPassword
      ) {
        setErrorMessage(
          "The new passwords do not match.",
        );
        return;
      }

      if (
        currentPassword === newPassword
      ) {
        setErrorMessage(
          "Your new password must be different from your temporary password.",
        );
        return;
      }

      if (!user) {
        setErrorMessage(
          "Your login session has expired. Please sign in again.",
        );
        return;
      }

      try {
        setIsSubmitting(true);

        await changeCurrentUserPassword(
          currentPassword,
          newPassword,
        );

        await refreshUser();

        router.replace(
          dashboardRoutes[user.role],
        );
      } catch (error) {
        console.error(
          "Unable to change password:",
          error,
        );

        setErrorMessage(
          getPasswordChangeErrorMessage(
            error,
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleLogout = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      await logout();
    } finally {
      router.replace(
        "/login" as Href,
      );
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.header}>
            <View style={styles.logo}>
              <Image
                accessibilityLabel="Thabazimbi Christian School logo"
                resizeMode="contain"
                source={require("../../assets/images/tcs-logo.jpeg")}
                style={styles.logoImage}
              />
            </View>

            <Text style={styles.portalLabel}>
              SECURE ACCOUNT SETUP
            </Text>

            <Text style={styles.headerTitle}>
              Create your password
            </Text>

            <Text
              style={
                styles.headerDescription
              }
            >
              Before continuing, replace
              the temporary password
              provided by the school.
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>
                FIRST LOGIN
              </Text>

              <Text style={styles.title}>
                Welcome
                {user?.firstName
                  ? `, ${user.firstName}`
                  : ""}
              </Text>

              <Text
                style={
                  styles.description
                }
              >
                Choose a strong password
                that you have not used for
                another account.
              </Text>

              <View
                style={styles.notice}
              >
                <Text
                  style={
                    styles.noticeIcon
                  }
                >
                  !
                </Text>

                <Text
                  style={
                    styles.noticeText
                  }
                >
                  You must complete this
                  step before accessing
                  the portal.
                </Text>
              </View>

              <View
                style={styles.formGroup}
              >
                <Text style={styles.label}>
                  Temporary password
                </Text>

                <View
                  style={
                    styles.passwordContainer
                  }
                >
                  <TextInput
                    accessibilityLabel="Temporary password"
                    autoCapitalize="none"
                    autoComplete="current-password"
                    editable={
                      !isSubmitting
                    }
                    onChangeText={
                      setCurrentPassword
                    }
                    placeholder="Enter your temporary password"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    secureTextEntry={
                      !showCurrentPassword
                    }
                    style={
                      styles.passwordInput
                    }
                    value={
                      currentPassword
                    }
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isSubmitting
                    }
                    onPress={() =>
                      setShowCurrentPassword(
                        (current) =>
                          !current,
                      )
                    }
                    style={
                      styles.showButton
                    }
                  >
                    <Text
                      style={
                        styles.showButtonText
                      }
                    >
                      {showCurrentPassword
                        ? "Hide"
                        : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View
                style={styles.formGroup}
              >
                <Text style={styles.label}>
                  New password
                </Text>

                <View
                  style={
                    styles.passwordContainer
                  }
                >
                  <TextInput
                    accessibilityLabel="New password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={
                      !isSubmitting
                    }
                    onChangeText={
                      setNewPassword
                    }
                    placeholder="Create a strong password"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    secureTextEntry={
                      !showNewPassword
                    }
                    style={
                      styles.passwordInput
                    }
                    value={newPassword}
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isSubmitting
                    }
                    onPress={() =>
                      setShowNewPassword(
                        (current) =>
                          !current,
                      )
                    }
                    style={
                      styles.showButton
                    }
                  >
                    <Text
                      style={
                        styles.showButtonText
                      }
                    >
                      {showNewPassword
                        ? "Hide"
                        : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View
                style={
                  styles.requirementsCard
                }
              >
                <Text
                  style={
                    styles.requirementsTitle
                  }
                >
                  Your password must
                  include:
                </Text>

                {requirements.map(
                  (requirement) => (
                    <View
                      key={
                        requirement.label
                      }
                      style={
                        styles.requirementRow
                      }
                    >
                      <View
                        style={[
                          styles.requirementIcon,
                          requirement.isMet &&
                            styles.requirementIconMet,
                        ]}
                      >
                        <Text
                          style={[
                            styles.requirementCheck,
                            requirement.isMet &&
                              styles.requirementCheckMet,
                          ]}
                        >
                          {requirement.isMet
                            ? "✓"
                            : "•"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.requirementText,
                          requirement.isMet &&
                            styles.requirementTextMet,
                        ]}
                      >
                        {
                          requirement.label
                        }
                      </Text>
                    </View>
                  ),
                )}
              </View>

              <View
                style={styles.formGroup}
              >
                <Text style={styles.label}>
                  Confirm new password
                </Text>

                <View
                  style={[
                    styles.passwordContainer,
                    confirmPassword
                      .length > 0 &&
                      !passwordsMatch &&
                      styles.inputError,
                  ]}
                >
                  <TextInput
                    accessibilityLabel="Confirm new password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={
                      !isSubmitting
                    }
                    onChangeText={
                      setConfirmPassword
                    }
                    onSubmitEditing={
                      handleChangePassword
                    }
                    placeholder="Enter your new password again"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    returnKeyType="done"
                    secureTextEntry={
                      !showConfirmPassword
                    }
                    style={
                      styles.passwordInput
                    }
                    value={
                      confirmPassword
                    }
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isSubmitting
                    }
                    onPress={() =>
                      setShowConfirmPassword(
                        (current) =>
                          !current,
                      )
                    }
                    style={
                      styles.showButton
                    }
                  >
                    <Text
                      style={
                        styles.showButtonText
                      }
                    >
                      {showConfirmPassword
                        ? "Hide"
                        : "Show"}
                    </Text>
                  </Pressable>
                </View>

                {confirmPassword.length >
                  0 && (
                  <Text
                    style={[
                      styles.matchText,
                      passwordsMatch
                        ? styles.matchSuccess
                        : styles.matchError,
                    ]}
                  >
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </Text>
                )}
              </View>

              {errorMessage ? (
                <View
                  style={
                    styles.errorContainer
                  }
                >
                  <Text
                    style={
                      styles.errorText
                    }
                  >
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={
                  isSubmitting ||
                  !formIsComplete
                }
                onPress={
                  handleChangePassword
                }
                style={({
                  pressed,
                }) => [
                  styles.submitButton,
                  pressed &&
                    styles.buttonPressed,
                  (isSubmitting ||
                    !formIsComplete) &&
                    styles.buttonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator
                    color={
                      colors.buttonText
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    Save Password and
                    Continue
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleLogout}
                style={
                  styles.logoutButton
                }
              >
                <Text
                  style={
                    styles.logoutButtonText
                  }
                >
                  Sign out
                </Text>
              </Pressable>
            </View>

            <Text style={styles.helpText}>
              If you do not recognise this
              account, sign out and contact
              the school administrator.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },

  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 66,
  },

  logo: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 36,
    marginBottom: 18,
    overflow: "hidden",
  },

  logoImage: {
    width: 60,
    height: 60,
  },

  portalLabel: {
    color: colors.accentLight,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 9,
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 29,
    fontWeight: "800",
    textAlign: "center",
  },

  headerDescription: {
    maxWidth: 420,
    color: colors.primaryLight,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    textAlign: "center",
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    marginTop: -38,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },

  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 8,
  },

  title: {
    color: colors.textPrimary,
    fontSize: 27,
    fontWeight: "800",
  },

  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentLight,
    borderRadius: 14,
    marginBottom: 22,
    padding: 13,
  },

  noticeIcon: {
    width: 26,
    height: 26,
    color: colors.primaryDark,
    backgroundColor: colors.accent,
    borderRadius: 13,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 26,
    marginRight: 10,
    textAlign: "center",
  },

  noticeText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },

  formGroup: {
    marginBottom: 17,
  },

  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },

  passwordContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },

  passwordInput: {
    flex: 1,
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 15,
    paddingLeft: 15,
    paddingRight: 8,
  },

  showButton: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 15,
  },

  showButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  requirementsCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 18,
    padding: 14,
  },

  requirementsTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  requirementIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
    borderRadius: 10,
    marginRight: 9,
  },

  requirementIconMet: {
    backgroundColor: colors.success,
  },

  requirementCheck: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "900",
  },

  requirementCheckMet: {
    color: colors.textOnPrimary,
  },

  requirementText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  requirementTextMet: {
    color: colors.success,
    fontWeight: "700",
  },

  inputError: {
    borderColor: colors.error,
  },

  matchText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },

  matchSuccess: {
    color: colors.success,
  },

  matchError: {
    color: colors.error,
  },

  errorContainer: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    marginBottom: 17,
    padding: 12,
  },

  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
  },

  submitButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.buttonPrimary,
    borderRadius: 15,
    paddingHorizontal: 20,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  buttonPressed: {
    backgroundColor:
      colors.buttonPrimaryPressed,
    transform: [{ scale: 0.98 }],
  },

  buttonDisabled: {
    backgroundColor:
      colors.buttonPrimaryDisabled,
    opacity: 0.75,
  },

  submitButtonText: {
    color: colors.buttonText,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  logoutButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  logoutButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  helpText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
    paddingHorizontal: 12,
    textAlign: "center",
  },
});