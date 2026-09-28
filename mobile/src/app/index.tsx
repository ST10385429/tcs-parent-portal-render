import { useRouter } from "expo-router";

import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

const userRoles = [
  "Parent",
  "Teacher",
  "Administrator",
];

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push("/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
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

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              WELCOME
            </Text>

            <Text style={styles.title}>
              Your school community in one place
            </Text>

            <Text style={styles.description}>
              Stay informed with school announcements,
              events, learner reports, fee information and
              secure communication.
            </Text>

            <View style={styles.roleContainer}>
              {userRoles.map((role) => (
                <View
                  key={role}
                  style={styles.roleBadge}
                >
                  <Text style={styles.roleText}>
                    {role}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              accessibilityHint="Opens the secure login screen"
              onPress={handleGetStarted}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                Get Started
              </Text>
            </Pressable>
          </View>

          <View style={styles.securityMessage}>
            <View style={styles.statusDot} />

            <Text style={styles.securityText}>
              Secure communication for parents and staff
            </Text>
          </View>
        </View>
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
    minHeight: "100%",
    backgroundColor: colors.background,
  },

  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 72,
  },

  logo: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 44,
    marginBottom: 18,
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
    width: 76,
    height: 76,
  },

  schoolName: {
    maxWidth: 500,
    color: colors.textOnPrimary,
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 30,
    textAlign: "center",
  },

  portalName: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    marginTop: -38,
    padding: 26,
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
    letterSpacing: 1.8,
    marginBottom: 10,
  },

  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 35,
  },

  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 13,
  },

  roleContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 22,
  },

  roleBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  roleText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },

  button: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.buttonPrimary,
    borderRadius: 16,
    marginTop: 27,
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
    backgroundColor: colors.buttonPrimaryPressed,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  securityMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },

  statusDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.success,
    borderRadius: 4,
    marginRight: 8,
  },

  securityText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
});