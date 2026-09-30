import {
  type Href,
  useRouter,
} from "expo-router";

import {
  useRef,
  useState,
} from "react";

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

type FormField = "email" | "password";

const dashboardRoutes: Record<UserRole, Href> = {
  parent: "/parent",
  teacher: "/teacher",
  admin: "/admin",
};

export default function LoginScreen() {
  const router = useRouter();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [errorField, setErrorField] =
    useState<FormField | null>(null);
  const [focusedField, setFocusedField] =
    useState<FormField | null>(null);

  const clearError = () => {
    setErrorMessage("");
    setErrorField(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    clearError();
  };

  const handlePasswordChange = (
    value: string,
  ) => {
    setPassword(value);
    clearError();
  };

  const handleLogin = async () => {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    clearError();

    if (!normalizedEmail) {
      setErrorField("email");
      setErrorMessage(
        "Please enter your email address.",
      );
      emailInputRef.current?.focus();
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setErrorField("email");
      setErrorMessage(
        "Please enter a valid email address.",
      );
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      setErrorField("password");
      setErrorMessage(
        "Please enter your password.",
      );
      passwordInputRef.current?.focus();
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
      setErrorField(null);
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
          keyboardDismissMode="on-drag"
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
                ref={emailInputRef}
                accessibilityHint={
                  errorField === "email"
                    ? "Correct the email address, then continue."
                    : "Enter the email address provided by the school."
                }
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isSubmitting}
                keyboardType="email-address"
                onBlur={() =>
                  setFocusedField(
                    (currentField) =>
                      currentField === "email"
                        ? null
                        : currentField,
                  )
                }
                onChangeText={handleEmailChange}
                onFocus={() =>
                  setFocusedField("email")
                }
                onSubmitEditing={() =>
                  passwordInputRef.current?.focus()
                }
                placeholder="name@example.com"
                placeholderTextColor={
                  colors.textSecondary
                }
                returnKeyType="next"
                style={[
                  styles.input,
                  focusedField === "email" &&
                    styles.inputFocused,
                  errorField === "email" &&
                    styles.inputError,
                ]}
                value={email}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Password
              </Text>

              <View
                style={[
                  styles.passwordContainer,
                  focusedField === "password" &&
                    styles.inputFocused,
                  errorField === "password" &&
                    styles.inputError,
                ]}
              >
                <TextInput
                  ref={passwordInputRef}
                  accessibilityHint={
                    errorField === "password"
                      ? "Enter your password, then sign in."
                      : "Enter the password supplied by the school."
                  }
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  onBlur={() =>
                    setFocusedField(
                      (currentField) =>
                        currentField === "password"
                          ? null
                          : currentField,
                    )
                  }
                  onChangeText={handlePasswordChange}
                  onFocus={() =>
                    setFocusedField("password")
                  }
                  onSubmitEditing={handleLogin}
                  placeholder="Enter your password"
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  textContentType="password"
                  value={password}
                />

                <Pressable
                  accessibilityHint={
                    showPassword
                      ? "Hides the password characters."
                      : "Shows the password characters."
                  }
                  accessibilityLabel={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isSubmitting,
                  }}
                  disabled={isSubmitting}
                  hitSlop={8}
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
                accessible
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
                style={styles.errorContainer}
              >
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityHint={
                isSubmitting
                  ? "Please wait while your account is being verified."
                  : "Signs in and opens your dashboard."
              }
              accessibilityLabel={
                isSubmitting
                  ? "Signing in"
                  : "Sign in"
              }
              accessibilityRole="button"
              accessibilityState={{
                busy: isSubmitting,
                disabled: isSubmitting,
              }}
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
                  accessibilityLabel="Signing in"
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
            accessibilityHint={
              "Returns to the welcome page."
            }
            accessibilityLabel="Return to welcome page"
            accessibilityRole="button"
            accessibilityState={{
              disabled: isSubmitting,
            }}
            disabled={isSubmitting}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                !isSubmitting &&
                styles.backButtonPressed,
            ]}
          >
            <Text style={styles.backButtonText}>
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

  inputFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },

  inputError: {
    borderWidth: 2,
    borderColor: colors.error,
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
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  backButtonPressed: {
    opacity: 0.72,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});