import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { getTeacherAssignments } from "@/services/teacher-service";
import { colors } from "@/theme/colors";
import type { TeacherClassAssignment } from "@/types/school";

export default function TeacherLearnersScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        console.error("Unable to load teacher assignments:", error);

        if (!isMounted) {
          return;
        }

        setErrorMessage(
          "Assigned learners could not be loaded. Check your connection and try again.",
        );
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

  const filteredAssignments = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return assignments.map((assignment) => ({
      ...assignment,
      learners: assignment.learners.filter((learner) => {
        const searchableText = [
          learner.firstName,
          learner.lastName,
          learner.studentNumber,
        ]
          .join(" ")
          .toLowerCase();

        return !search || searchableText.includes(search);
      }),
    }));
  }, [assignments, searchText]);

  const visibleLearnerCount = useMemo(
    () =>
      filteredAssignments.reduce(
        (total, assignment) => total + assignment.learners.length,
        0,
      ),
    [filteredAssignments],
  );

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/teacher");
  };

  const handleOpenLearner = (learnerId: string) => {
    router.push(`/teacher/learner/${learnerId}` as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to teacher dashboard"
            accessibilityRole="button"
            onPress={handleGoBack}
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

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>My Learners</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchContainer}>
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={20}
            />

            <TextInput
              accessibilityLabel="Search assigned learners"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search by name or student number"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
            />

            {searchText ? (
              <Pressable
                accessibilityLabel="Clear learner search"
                accessibilityRole="button"
                onPress={() => setSearchText("")}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={colors.textSecondary}
                  name="close-circle"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Assigned learners</Text>

            <Text style={styles.resultCount}>{visibleLearnerCount} shown</Text>
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.primary} size="large" />

              <Text style={styles.stateTitle}>Loading learners...</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View accessibilityLiveRegion="polite" style={styles.errorCard}>
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={22}
              />

              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!isLoading && !errorMessage && assignments.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                color={colors.textSecondary}
                name="school-outline"
                size={35}
              />

              <Text style={styles.stateTitle}>No assigned classes</Text>

              <Text style={styles.stateText}>
                Contact the school administrator to verify your class
                assignments.
              </Text>
            </View>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          assignments.length > 0 &&
          visibleLearnerCount === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                color={colors.textSecondary}
                name="search-outline"
                size={35}
              />

              <Text style={styles.stateTitle}>No learners found</Text>

              <Text style={styles.stateText}>
                Try a different name or student number.
              </Text>
            </View>
          ) : null}

          {!isLoading && !errorMessage
            ? filteredAssignments.map((assignment) => {
                if (searchText.trim() && assignment.learners.length === 0) {
                  return null;
                }

                return (
                  <View key={assignment.id} style={styles.classSection}>
                    <View style={styles.classHeader}>
                      <View style={styles.classIcon}>
                        <Ionicons
                          color={colors.primary}
                          name="school-outline"
                          size={22}
                        />
                      </View>

                      <View style={styles.classInformation}>
                        <Text style={styles.className}>
                          {assignment.schoolClass.name}
                        </Text>

                        <Text style={styles.classSubject}>
                          {assignment.subject}
                        </Text>
                      </View>

                      <View style={styles.classCountBadge}>
                        <Text style={styles.classCountText}>
                          {assignment.learners.length}
                        </Text>
                      </View>
                    </View>

                    {assignment.learners.map((learner) => {
                      const fullName =
                        `${learner.firstName} ${learner.lastName}`.trim();

                      return (
                        <Pressable
                          key={learner.id}
                          accessibilityHint="Opens the learner details page"
                          accessibilityLabel={`Open details for ${fullName}`}
                          accessibilityRole="button"
                          onPress={() => handleOpenLearner(learner.id)}
                          style={({ pressed }) => [
                            styles.learnerCard,
                            pressed && styles.learnerCardPressed,
                          ]}
                        >
                          <View style={styles.learnerAvatar}>
                            <Text style={styles.learnerInitials}>
                              {learner.firstName.charAt(0).toUpperCase()}
                              {learner.lastName.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.learnerInformation}>
                            <Text style={styles.learnerName}>{fullName}</Text>

                            <Text style={styles.studentNumber}>
                              {learner.studentNumber}
                            </Text>

                            <Text style={styles.gradeText}>
                              {learner.schoolClass?.name ??
                                `Grade ${learner.currentGradeNumber}`}
                            </Text>
                          </View>

                          <View style={styles.learnerAction}>
                            <View style={styles.activeBadge}>
                              <View style={styles.activeDot} />

                              <Text style={styles.activeText}>ACTIVE</Text>
                            </View>

                            <Ionicons
                              color={colors.textSecondary}
                              name="chevron-forward"
                              size={19}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            : null}
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
    maxWidth: 540,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 35,
  },

  searchContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 9,
  },

  clearButton: {
    minWidth: 40,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },

  listTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  resultCount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  classSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    marginBottom: 14,
    padding: 14,
  },

  classHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 13,
  },

  classIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
  },

  classInformation: {
    flex: 1,
    marginLeft: 11,
  },

  className: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  classSubject: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  classCountBadge: {
    minWidth: 34,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
  },

  classCountText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  learnerCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 13,
  },

  learnerCardPressed: {
    backgroundColor: colors.primaryLight,
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  learnerAvatar: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
  },

  learnerInitials: {
    color: colors.textOnPrimary,
    fontSize: 12,
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

  studentNumber: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  gradeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },

  learnerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginLeft: 8,
  },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  activeDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.success,
    borderRadius: 3,
    marginRight: 5,
  },

  activeText: {
    color: colors.success,
    fontSize: 8,
    fontWeight: "800",
  },

  stateCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 30,
  },

  stateTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 11,
  },

  stateText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    textAlign: "center",
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 15,
    padding: 14,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },

  pressed: {
    opacity: 0.65,
  },
});
