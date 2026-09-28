import {
  type Href,
  useRouter,
} from "expo-router";

import { useState } from "react";

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

import {
  getLoginErrorMessage,
  loginUser,
} from "@/services/auth-service";

import { colors } from "@/theme/colors";

import type { UserRole } from "@/types/auth";

const dashboardRoutes: Record<UserRole, Href> = {
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const handleLogin = async () => {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    setErrorMessage("");

    if (!normalizedEmail) {
      setErrorMessage(
        "Please enter your email address.",
      );
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setErrorMessage(
        "Please enter a valid email address.",
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        "Please enter your password.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const user = await loginUser(
        normalizedEmail,
        password,
      );

      const destination: Href =
        user.mustChangePassword
          ? ("/change-password" as Href)
          : dashboardRoutes[user.role];

      router.replace(destination);
    } catch (error) {
      setErrorMessage(
        getLoginErrorMessage(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View
              accessible
              accessibilityLabel="Thabazimbi Christian School logo"
              style={styles.logo}
            >
              <Image
                resizeMode="contain"
                source={require("../../assets/images/tcs-logo.jpeg")}
                style={styles.logoImage}
              />
            </View>

            <Text style={styles.schoolName}>
              Thabazimbi Christian School
            </Text>

            <Text style={styles.portalName}>
              Parent and Staff Portal
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              SECURE LOGIN
            </Text>

            <Text style={styles.title}>
              Welcome back
            </Text>

            <Text style={styles.description}>
              Sign in using the account details
              provided by the school administrator.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Email address
              </Text>

              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isSubmitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={
                  colors.textSecondary
                }
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Password
              </Text>

              <View
                style={styles.passwordContainer}
              >
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isSubmitting}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  placeholder="Enter your password"
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />

                <Pressable
                  accessibilityLabel={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() =>
                    setShowPassword(
                      (currentValue) =>
                        !currentValue,
                    )
                  }
                  style={
                    styles.showPasswordButton
                  }
                >
                  <Text
                    style={
                      styles.showPasswordText
                    }
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {errorMessage ? (
              <View
                accessibilityLiveRegion="polite"
                style={styles.errorContainer}
              >
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Sign in"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                pressed &&
                  !isSubmitting &&
                  styles.buttonPressed,
                isSubmitting &&
                  styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  color={colors.buttonText}
                  size="small"
                />
              ) : (
                <Text
                  style={
                    styles.loginButtonText
                  }
                >
                  Sign In
                </Text>
              )}
            </Pressable>

            <Text style={styles.helpText}>
              Forgot your details? Contact the
              school administrator for assistance.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Return to welcome page"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text
              style={styles.backButtonText}
            >
              Return to welcome page
            </Text>
          </Pressable>
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
    paddingBottom: 30,
  },

  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 65,
  },

  logo: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 41,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },

  logoImage: {
    width: 72,
    height: 72,
  },

  schoolName: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
    textAlign: "center",
  },

  portalName: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 5,
    textAlign: "center",
  },

  card: {
    width: "90%",
    maxWidth: 500,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    marginTop: -35,
    padding: 25,
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
    color: colors.burgundy,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 9,
  },

  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 35,
  },

  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 23,
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

  input: {
    minHeight: 52,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 15,
    paddingHorizontal: 15,
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

  showPasswordButton: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 15,
  },

  showPasswordText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
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

  loginButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.buttonPrimary,
    borderRadius: 15,
    marginTop: 3,
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
    opacity: 0.8,
  },

  loginButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  helpText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    textAlign: "center",
  },

  backButton: {
    alignSelf: "center",
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});