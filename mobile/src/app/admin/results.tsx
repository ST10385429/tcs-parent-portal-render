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

import { getAllSubmittedSubjectResults } from "@/services/subject-result-service";
import { colors } from "@/theme/colors";
import type { SubjectResult } from "@/types/school";

type LearnerResultGroup = {
  id: string;
  learnerId: string;
  learnerName: string;
  studentNumber: string;
  className: string;
  academicYear: number;
  term: number;
  results: SubjectResult[];
};

function groupSubjectResults(
  results: SubjectResult[],
): LearnerResultGroup[] {
  const groups = new Map<string, LearnerResultGroup>();

  results.forEach((result) => {
    const groupId = [
      result.learnerId,
      result.academicYear,
      result.term,
    ].join("-");

    const existingGroup = groups.get(groupId);

    if (existingGroup) {
      existingGroup.results.push(result);
      return;
    }

    groups.set(groupId, {
      id: groupId,
      learnerId: result.learnerId,
      learnerName:
        `${result.learnerFirstName} ${result.learnerLastName}`.trim(),
      studentNumber: result.studentNumber,
      className: result.className,
      academicYear: result.academicYear,
      term: result.term,
      results: [result],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      results: [...group.results].sort((first, second) =>
        first.subject.localeCompare(second.subject),
      ),
    }))
    .sort((first, second) => {
      if (first.academicYear !== second.academicYear) {
        return second.academicYear - first.academicYear;
      }

      if (first.term !== second.term) {
        return second.term - first.term;
      }

      return first.learnerName.localeCompare(
        second.learnerName,
      );
    });
}

export default function AdminResultsScreen() {
  const router = useRouter();

  const [results, setResults] = useState<SubjectResult[]>(
    [],
  );
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNumber, setReloadNumber] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadResults() {
      try {
        const loadedResults =
          await getAllSubmittedSubjectResults();

        if (!isMounted) {
          return;
        }

        setResults(loadedResults);
        setErrorMessage("");
      } catch (error) {
        console.error(
          "Unable to load submitted results:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "Submitted marks could not be loaded. Check your connection and try again.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isMounted = false;
    };
  }, [reloadNumber]);

  const groupedResults = useMemo(
    () => groupSubjectResults(results),
    [results],
  );

  const visibleGroups = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return groupedResults;
    }

    return groupedResults.filter((group) => {
      const subjectNames = group.results
        .map((result) => result.subject)
        .join(" ");

      const searchableText = [
        group.learnerName,
        group.studentNumber,
        group.className,
        group.academicYear.toString(),
        `term ${group.term}`,
        subjectNames,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [groupedResults, searchText]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/admin");
  };

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage("");
    setReloadNumber((current) => current + 1);
  };

  const handleCompileReport = (
    group: LearnerResultGroup,
  ) => {
    const reportRoute =
      `/admin/report/compile` +
      `?learnerId=${encodeURIComponent(group.learnerId)}` +
      `&academicYear=${group.academicYear}` +
      `&term=${group.term}`;

    router.push(reportRoute as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to admin dashboard"
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

          <Text style={styles.headerTitle}>
            Submitted Marks
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons
                color={colors.primary}
                name="documents-outline"
                size={25}
              />
            </View>

            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>
                Reports awaiting compilation
              </Text>

              <Text style={styles.summaryText}>
                {groupedResults.length} learner term{" "}
                {groupedResults.length === 1
                  ? "report"
                  : "reports"}{" "}
                contain submitted subject marks.
              </Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={20}
            />

            <TextInput
              accessibilityLabel="Search submitted marks"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search learner, class or subject"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
            />

            {searchText ? (
              <Pressable
                accessibilityLabel="Clear search"
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
            <Text style={styles.listTitle}>
              Teacher submissions
            </Text>

            <Text style={styles.resultCount}>
              {visibleGroups.length} shown
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />

              <Text style={styles.stateTitle}>
                Loading submitted marks...
              </Text>
            </View>
          ) : null}

          {!isLoading && errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.errorCard}
            >
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={30}
              />

              <Text style={styles.errorTitle}>
                Marks unavailable
              </Text>

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>

              <Pressable
                accessibilityLabel="Retry loading marks"
                accessibilityRole="button"
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryButtonText}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          groupedResults.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                color={colors.textSecondary}
                name="document-text-outline"
                size={40}
              />

              <Text style={styles.stateTitle}>
                No submitted marks
              </Text>

              <Text style={styles.stateText}>
                Teacher submissions will appear here after
                teachers submit learner marks.
              </Text>
            </View>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          groupedResults.length > 0 &&
          visibleGroups.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                color={colors.textSecondary}
                name="search-outline"
                size={40}
              />

              <Text style={styles.stateTitle}>
                No matching submissions
              </Text>

              <Text style={styles.stateText}>
                Try a different learner, class or subject.
              </Text>
            </View>
          ) : null}

          {!isLoading && !errorMessage
            ? visibleGroups.map((group) => (
                <View
                  key={group.id}
                  style={styles.reportCard}
                >
                  <View style={styles.reportHeader}>
                    <View style={styles.learnerAvatar}>
                      <Text style={styles.learnerInitials}>
                        {group.learnerName
                          .split(" ")
                          .map((name) => name.charAt(0))
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.learnerInformation}>
                      <Text style={styles.learnerName}>
                        {group.learnerName}
                      </Text>

                      <Text style={styles.learnerDetails}>
                        {group.className} •{" "}
                        {group.studentNumber}
                      </Text>
                    </View>

                    <View style={styles.pendingBadge}>
                      <View style={styles.pendingDot} />

                      <Text style={styles.pendingText}>
                        PENDING
                      </Text>
                    </View>
                  </View>

                  <View style={styles.termRow}>
                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>
                        ACADEMIC YEAR
                      </Text>

                      <Text style={styles.termValue}>
                        {group.academicYear}
                      </Text>
                    </View>

                    <View style={styles.termDivider} />

                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>
                        SCHOOL TERM
                      </Text>

                      <Text style={styles.termValue}>
                        Term {group.term}
                      </Text>
                    </View>

                    <View style={styles.termDivider} />

                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>
                        SUBJECTS
                      </Text>

                      <Text style={styles.termValue}>
                        {group.results.length}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subjectsTitle}>
                    Submitted subjects
                  </Text>

                  {group.results.map((result) => (
                    <View
                      key={result.id}
                      style={styles.subjectCard}
                    >
                      <View style={styles.subjectHeader}>
                        <View
                          style={styles.subjectInformation}
                        >
                          <Text style={styles.subjectName}>
                            {result.subject}
                          </Text>

                          <Text
                            style={styles.teacherReference}
                          >
                            Teacher submission
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.markBadge,
                            result.mark >= 50
                              ? styles.passMarkBadge
                              : styles.failMarkBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.markText,
                              result.mark >= 50
                                ? styles.passMarkText
                                : styles.failMarkText,
                            ]}
                          >
                            {result.mark}%
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.commentLabel}>
                        TEACHER COMMENT
                      </Text>

                      <Text style={styles.commentText}>
                        {result.comments ||
                          "No teacher comment was provided."}
                      </Text>
                    </View>
                  ))}

                  <Pressable
                    accessibilityHint="Opens the report compilation and approval screen"
                    accessibilityLabel={`Compile report for ${group.learnerName}`}
                    accessibilityRole="button"
                    onPress={() =>
                      handleCompileReport(group)
                    }
                    style={({ pressed }) => [
                      styles.compileButton,
                      pressed &&
                        styles.compileButtonPressed,
                    ]}
                  >
                    <View style={styles.compileButtonText}>
                      <Text style={styles.compileButtonTitle}>
                        Compile report
                      </Text>

                      <Text
                        style={styles.compileButtonSubtitle}
                      >
                        Review marks, fees and approval
                      </Text>
                    </View>

                    <Ionicons
                      color={colors.textOnPrimary}
                      name="arrow-forward"
                      size={21}
                    />
                  </Pressable>
                </View>
              ))
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
    maxWidth: 600,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    padding: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  summaryContent: {
    flex: 1,
    marginLeft: 13,
  },
  summaryTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  searchContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginTop: 17,
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
  reportCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  learnerAvatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
  },
  learnerInitials: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  learnerInformation: {
    flex: 1,
    marginLeft: 12,
  },
  learnerName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  learnerDetails: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3D9",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    backgroundColor: "#B7791F",
    borderRadius: 3,
    marginRight: 5,
  },
  pendingText: {
    color: "#8A5A13",
    fontSize: 8,
    fontWeight: "800",
  },
  termRow: {
    flexDirection: "row",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    marginTop: 15,
    paddingVertical: 12,
  },
  termItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  termDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  termLabel: {
    color: colors.textSecondary,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  termValue: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  subjectsTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 17,
    marginBottom: 9,
  },
  subjectCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 9,
    padding: 13,
  },
  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectInformation: {
    flex: 1,
  },
  subjectName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  teacherReference: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
  },
  markBadge: {
    minWidth: 52,
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  passMarkBadge: {
    backgroundColor: "#E7F4EC",
  },
  failMarkBadge: {
    backgroundColor: "#FDECEC",
  },
  markText: {
    fontSize: 12,
    fontWeight: "800",
  },
  passMarkText: {
    color: colors.success,
  },
  failMarkText: {
    color: colors.error,
  },
  commentLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 11,
  },
  commentText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  compileButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 9,
    paddingHorizontal: 16,
  },
  compileButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  compileButtonText: {
    flex: 1,
  },
  compileButtonTitle: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  compileButtonSubtitle: {
    color: colors.primaryLight,
    fontSize: 10,
    marginTop: 3,
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
    textAlign: "center",
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    textAlign: "center",
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 18,
    padding: 25,
  },
  errorTitle: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 18,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
});