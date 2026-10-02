// Expo's Ionicons component, used for all icons throughout the screen.
import Ionicons from "@expo/vector-icons/Ionicons";
// useRouter provides programmatic navigation; Href is the type for route strings.
import { type Href, useRouter } from "expo-router";
// React hooks: useEffect for side effects, useMemo for derived/memoized data,
// useState for component state.
import { useEffect, useMemo, useState } from "react";
// Core React Native building blocks and components used to render the UI.
import {
  ActivityIndicator, // Spinner shown during loading
  Pressable,         // Touchable wrapper (replaces TouchableOpacity)
  ScrollView,        // Scrollable container for the main content
  StyleSheet,        // Creates optimized style objects
  Text,              // Renders text
  TextInput,         // Editable text field (used for the search box)
  View,              // Generic container (like a div)
} from "react-native";
// SafeAreaView ensures content respects device notches/status bars.
import { SafeAreaView } from "react-native-safe-area-context";

// Service that fetches all submitted subject results from the backend.
import { getAllSubmittedSubjectResults } from "@/services/subject-result-service";
// Centralised colour palette so styling stays consistent across the app.
import { colors } from "@/theme/colors";
// TypeScript type describing a single subject result record.
import type { SubjectResult } from "@/types/school";

// Shape of a single grouped item: one learner's results for a specific
// academic year and term, ready to be rendered as a "report card".
type LearnerResultGroup = {
  id: string;            // Composite key: learnerId-academicYear-term
  learnerId: string;     // Backend identifier for the learner
  learnerName: string;   // Full name (first + last)
  studentNumber: string; // School-issued student number
  className: string;     // Class/grade the learner belongs to
  academicYear: number;  // e.g., 2025
  term: number;          // e.g., 1, 2, 3, 4
  results: SubjectResult[]; // All subject results for this learner/term
};

// Groups a flat list of subject results by learner + academic year + term.
// Returns groups sorted by year (desc), term (desc), then learner name (asc),
// with each group's subjects sorted alphabetically.
function groupSubjectResults(
  results: SubjectResult[],
): LearnerResultGroup[] {
  // Map keyed by the composite group id for O(1) lookups while iterating.
  const groups = new Map<string, LearnerResultGroup>();

  results.forEach((result) => {
    // Composite id: same learner in the same year/term shares a group.
    const groupId = [
      result.learnerId,
      result.academicYear,
      result.term,
    ].join("-");

    const existingGroup = groups.get(groupId);

    // If the group already exists, just append this result and move on.
    if (existingGroup) {
      existingGroup.results.push(result);
      return;
    }

    // Otherwise, create a new group using the first result as the source
    // of learner metadata (name, number, class, year, term).
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

  // Convert the map to an array, sort subjects within each group,
  // then sort the groups themselves for display.
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      // Alphabetical order of subjects within the learner's report.
      results: [...group.results].sort((first, second) =>
        first.subject.localeCompare(second.subject),
      ),
    }))
    .sort((first, second) => {
      // Newest academic year first.
      if (first.academicYear !== second.academicYear) {
        return second.academicYear - first.academicYear;
      }

      // Then newest term first.
      if (first.term !== second.term) {
        return second.term - first.term;
      }

      // Finally, alphabetical by learner name.
      return first.learnerName.localeCompare(
        second.learnerName,
      );
    });
}

// Main screen component for the admin "Submitted Marks" view.
export default function AdminResultsScreen() {
  // Router instance used for back navigation and pushing to the report screen.
  const router = useRouter();

  // Raw list of results returned from the service.
  const [results, setResults] = useState<SubjectResult[]>(
    [],
  );
  // Text typed into the search box; filters visible groups.
  const [searchText, setSearchText] = useState("");
  // True while the initial fetch is in flight.
  const [isLoading, setIsLoading] = useState(true);
  // Non-empty when the fetch fails; drives the error card.
  const [errorMessage, setErrorMessage] = useState("");
  // Incrementing this triggers the load useEffect to re-run (retry mechanism).
  const [reloadNumber, setReloadNumber] = useState(0);

  // Fetch submitted results whenever reloadNumber changes.
  useEffect(() => {
    // Guard so we don't update state after unmount (avoids React warnings).
    let isMounted = true;

    async function loadResults() {
      try {
        const loadedResults =
          await getAllSubmittedSubjectResults();

        // Bail out if the component unmounted while awaiting.
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
          // Show a user-friendly error (details go to the console only).
          setErrorMessage(
            "Submitted marks could not be loaded. Check your connection and try again.",
          );
        }
      } finally {
        // Always stop the spinner once the request completes.
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    // Fire the async loader (void = intentionally ignoring the promise).
    void loadResults();

    // Cleanup: mark unmounted so late async updates are skipped.
    return () => {
      isMounted = false;
    };
  }, [reloadNumber]);

  // Memoized grouping so we don't regroup on every render.
  const groupedResults = useMemo(
    () => groupSubjectResults(results),
    [results],
  );

  // Memoized filtered list based on the current search text.
  const visibleGroups = useMemo(() => {
    // Normalise the search term once.
    const search = searchText.trim().toLowerCase();

    // No search -> show everything.
    if (!search) {
      return groupedResults;
    }

    // Otherwise filter groups by matching any of their searchable fields.
    return groupedResults.filter((group) => {
      // Concatenate all subject names so "math" matches any subject in the group.
      const subjectNames = group.results
        .map((result) => result.subject)
        .join(" ");

      // Build a single lowercased haystack of everything searchable.
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

  // Back navigation: use history if possible, otherwise jump to /admin.
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/admin");
  };

  // Retry: reset UI state and bump reloadNumber to re-trigger the effect.
  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage("");
    setReloadNumber((current) => current + 1);
  };

  // Navigate to the report compilation screen for the given learner/term,
  // passing the identifying parameters via the query string.
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
    // SafeAreaView paints the top inset with the primary colour (matches header).
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {/* ---- Top navigation bar ---- */}
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

          {/* Empty spacer balances the back button to keep the title centred. */}
          <View style={styles.headerSpacer} />
        </View>

        {/* ---- Scrollable main content ---- */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card showing how many reports await compilation. */}
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
                {/* Pluralise "report"/"reports" based on the count. */}
                {groupedResults.length} learner term{" "}
                {groupedResults.length === 1
                  ? "report"
                  : "reports"}{" "}
                contain submitted subject marks.
              </Text>
            </View>
          </View>

          {/* Search box: filters the visible groups as the user types. */}
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

            {/* Clear button only appears when there is text to clear. */}
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

          {/* Section header above the list of report cards. */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Teacher submissions
            </Text>

            <Text style={styles.resultCount}>
              {visibleGroups.length} shown
            </Text>
          </View>

          {/* ---- Loading state ---- */}
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

          {/* ---- Error state (only after loading completes) ---- */}
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

              {/* Retry button re-runs the fetch. */}
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

          {/* ---- Empty state: no submissions at all ---- */}
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

          {/* ---- Empty state: search yielded no matches ---- */}
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

          {/* ---- Data state: render one card per visible group ---- */}
          {!isLoading && !errorMessage
            ? visibleGroups.map((group) => (
                <View
                  key={group.id}
                  style={styles.reportCard}
                >
                  {/* Learner header: avatar, name, class/number, status badge */}
                  <View style={styles.reportHeader}>
                    <View style={styles.learnerAvatar}>
                      {/* Compute initials from the first two words of the name. */}
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

                    {/* Amber "PENDING" pill indicates the report isn't yet compiled. */}
                    <View style={styles.pendingBadge}>
                      <View style={styles.pendingDot} />

                      <Text style={styles.pendingText}>
                        PENDING
                      </Text>
                    </View>
                  </View>

                  {/* Three-column summary: academic year, term, subject count. */}
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

                  {/* One nested card per subject, each with mark + comment. */}
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

                        {/* Mark badge: green for pass (>= 50), red for fail. */}
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

                      {/* Fall back to a neutral message when no comment exists. */}
                      <Text style={styles.commentText}>
                        {result.comments ||
                          "No teacher comment was provided."}
                      </Text>
                    </View>
                  ))}

                  {/* Primary action: navigate to the report compilation screen. */}
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

// Stylesheet for the screen. Grouped logically: layout > header > content >
// cards > states. Colours come from the shared `colors` theme object.
const styles = StyleSheet.create({
  // Top-level safe area paints behind the notch with the primary colour.
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  // Content area below the header uses the neutral background.
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
    minHeight: 44, // Meets minimum touch target size.
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
  // Empty spacer mirrors the back button width to keep the title centred.
  headerSpacer: {
    width: 75,
  },
  // Main scroll content: constrains width for larger screens/tablets.
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
  },
  // --- Summary card ---
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
  // --- Search box ---
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
  // --- Section header above the list ---
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
  // --- Per-learner report card ---
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
  // Amber "PENDING" badge with a leading dot.
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
  // Three-column summary strip (year / term / subject count).
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
  // --- Individual subject card ---
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
  // Base badge shared by pass/fail variants.
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
  // --- Primary compile-report call-to-action ---
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
  // Pressed state: darker background plus subtle scale-down effect.
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
  // --- Shared loading / empty state card ---
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
  // --- Error state card ---
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
  // Shared "pressed" opacity used by many Pressables.
  pressed: {
    opacity: 0.7,
  },
});