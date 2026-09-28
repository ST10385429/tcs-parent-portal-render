import {
  type Href,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
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

import { auth } from "@/lib/firebase-auth";
import { getLearnerSubmittedSubjectResults } from "@/services/subject-result-service";
import {
  compileTermReport,
  getExistingTermReport,
  getFeeAccount,
} from "@/services/term-report-service";
import { colors } from "@/theme/colors";
import type {
  FeeAccount,
  SubjectResult,
  TermReport,
  TermReportStatus,
} from "@/types/school";

function readParameter(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getReportStatusLabel(
  status: TermReportStatus,
): string {
  switch (status) {
    case "approved":
      return "Approved and released";

    case "withheld":
      return "Withheld";

    default:
      return "Draft";
  }
}

export default function CompileTermReportScreen() {
  const router = useRouter();

  const parameters = useLocalSearchParams<{
    learnerId?: string | string[];
    academicYear?: string | string[];
    term?: string | string[];
  }>();

  const learnerId = readParameter(
    parameters.learnerId,
  );
  const academicYear = Number(
    readParameter(parameters.academicYear),
  );
  const term = Number(
    readParameter(parameters.term),
  );

  const [results, setResults] = useState<
    SubjectResult[]
  >([]);
  const [feeAccount, setFeeAccount] =
    useState<FeeAccount | null>(null);
  const [existingReport, setExistingReport] =
    useState<TermReport | null>(null);
  const [overallComment, setOverallComment] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReportInformation() {
      try {
        if (!learnerId || !academicYear || !term) {
          throw new Error(
            "The selected report information is incomplete.",
          );
        }

        const [
          loadedResults,
          loadedFeeAccount,
          loadedReport,
        ] = await Promise.all([
          getLearnerSubmittedSubjectResults(
            learnerId,
            academicYear,
            term,
          ),
          getFeeAccount(learnerId),
          getExistingTermReport(
            learnerId,
            academicYear,
            term,
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setResults(
          loadedResults.filter(
            (result) =>
              result.status === "submitted",
          ),
        );
        setFeeAccount(loadedFeeAccount);
        setExistingReport(loadedReport);
        setOverallComment(
          loadedReport?.overallComment ?? "",
        );
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error(
          "Unable to load report information:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The report information could not be loaded.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReportInformation();

    return () => {
      isMounted = false;
    };
  }, [academicYear, learnerId, term]);

  const firstResult = results[0];

  const learnerName = useMemo(() => {
    if (firstResult) {
      return `${firstResult.learnerFirstName} ${firstResult.learnerLastName}`;
    }

    if (existingReport) {
      return `${existingReport.learnerFirstName} ${existingReport.learnerLastName}`;
    }

    return "Selected learner";
  }, [existingReport, firstResult]);

  const className =
    firstResult?.className ??
    existingReport?.className ??
    "Class unavailable";

  const studentNumber =
    firstResult?.studentNumber ??
    existingReport?.studentNumber ??
    "Not available";

  const averageMark = useMemo(() => {
    if (results.length === 0) {
      return existingReport?.averageMark ?? 0;
    }

    const total = results.reduce(
      (currentTotal, result) =>
        currentTotal + result.mark,
      0,
    );

    return Math.round(total / results.length);
  }, [existingReport, results]);

  const feesAreUpToDate =
    feeAccount?.status === "upToDate";

  const handleViewReport = () => {
    if (!existingReport) {
      return;
    }

    const previewRoute =
      `/admin/report/view/${encodeURIComponent(
        existingReport.id,
      )}`;

    router.push(previewRoute as Href);
  };

  const handleSaveReport = async (
    status: TermReportStatus,
  ) => {
    if (isSaving) {
      return;
    }

    if (results.length === 0) {
      setErrorMessage(
        "No submitted subject results are available for this report.",
      );
      return;
    }

    const administratorUid =
      auth.currentUser?.uid;

    if (!administratorUid) {
      setErrorMessage(
        "Your administrator session could not be verified. Please log in again.",
      );
      return;
    }

    if (
      status === "approved" &&
      !feesAreUpToDate
    ) {
      setErrorMessage(
        "The report cannot be released because the learner's school fees are outstanding.",
      );
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      await compileTermReport(
        administratorUid,
        results,
        overallComment,
        status,
      );

      const updatedReport =
        await getExistingTermReport(
          learnerId,
          academicYear,
          term,
        );

      setExistingReport(updatedReport);

      if (status === "approved") {
        setSuccessMessage(
          "The report was approved and released to the linked parent.",
        );
      } else if (status === "withheld") {
        setSuccessMessage(
          "The report was compiled but withheld because the learner's fees are outstanding.",
        );
      } else {
        setSuccessMessage(
          "The report was saved successfully as a draft.",
        );
      }
    } catch (error) {
      console.error(
        "Unable to compile term report:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The report could not be saved. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            color={colors.primary}
            size="large"
          />

          <Text style={styles.loadingText}>
            Loading report information...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.backButtonPressed,
            ]}
          >
            <Text style={styles.backButtonText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerEyebrow}>
              ADMINISTRATION
            </Text>

            <Text style={styles.headerTitle}>
              Compile report
            </Text>

            <Text style={styles.headerSubtitle}>
              Review submitted marks before releasing
              the learner&apos;s report.
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.errorCard}
            >
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.successCard}
            >
              <Text style={styles.successTitle}>
                Report saved
              </Text>

              <Text style={styles.successText}>
                {successMessage}
              </Text>
            </View>
          ) : null}

          <View style={styles.learnerCard}>
            <Text style={styles.cardEyebrow}>
              LEARNER
            </Text>

            <Text style={styles.learnerName}>
              {learnerName}
            </Text>

            <Text style={styles.learnerDetail}>
              {className}
            </Text>

            <Text style={styles.learnerDetail}>
              Student number: {studentNumber}
            </Text>

            <View style={styles.termRow}>
              <View style={styles.termBadge}>
                <Text style={styles.termBadgeLabel}>
                  ACADEMIC YEAR
                </Text>

                <Text style={styles.termBadgeValue}>
                  {academicYear}
                </Text>
              </View>

              <View style={styles.termBadge}>
                <Text style={styles.termBadgeLabel}>
                  TERM
                </Text>

                <Text style={styles.termBadgeValue}>
                  {term}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.feeCard,
              feesAreUpToDate
                ? styles.feeCardUpToDate
                : styles.feeCardOutstanding,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    feesAreUpToDate
                      ? colors.success
                      : colors.error,
                },
              ]}
            />

            <View style={styles.feeContent}>
              <Text style={styles.feeTitle}>
                School fee status
              </Text>

              <Text
                style={[
                  styles.feeStatus,
                  {
                    color: feesAreUpToDate
                      ? colors.success
                      : colors.error,
                  },
                ]}
              >
                {feesAreUpToDate
                  ? "Up to date"
                  : "Outstanding"}
              </Text>

              <Text style={styles.feeDescription}>
                {feesAreUpToDate
                  ? "The report can be approved and released to the linked parent."
                  : "The report must remain withheld until the fee account is updated."}
              </Text>
            </View>
          </View>

          {existingReport ? (
            <View style={styles.currentStatusCard}>
              <Text
                style={styles.currentStatusLabel}
              >
                CURRENT REPORT STATUS
              </Text>

              <Text
                style={styles.currentStatusValue}
              >
                {getReportStatusLabel(
                  existingReport.status,
                )}
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Submitted subjects
              </Text>

              <Text style={styles.sectionSubtitle}>
                {results.length}{" "}
                {results.length === 1
                  ? "subject"
                  : "subjects"}{" "}
                included
              </Text>
            </View>

            <View style={styles.averageBadge}>
              <Text style={styles.averageLabel}>
                AVERAGE
              </Text>

              <Text style={styles.averageValue}>
                {averageMark}%
              </Text>
            </View>
          </View>

          {results.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No submitted marks
              </Text>

              <Text style={styles.emptyText}>
                Teachers must submit their subject
                results before this report can be
                compiled.
              </Text>
            </View>
          ) : (
            results.map((result) => (
              <View
                key={result.id}
                style={styles.subjectCard}
              >
                <View style={styles.subjectTopRow}>
                  <View
                    style={styles.subjectTextContainer}
                  >
                    <Text
                      style={styles.subjectName}
                    >
                      {result.subject}
                    </Text>

                    <Text
                      style={styles.teacherLabel}
                    >
                      Submitted by assigned teacher
                    </Text>
                  </View>

                  <View style={styles.markBadge}>
                    <Text style={styles.markText}>
                      {result.mark}%
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.commentContainer}
                >
                  <Text
                    style={styles.commentLabel}
                  >
                    TEACHER COMMENT
                  </Text>

                  <Text style={styles.commentText}>
                    {result.comments ||
                      "No teacher comment was provided."}
                  </Text>
                </View>
              </View>
            ))
          )}

          <Text style={styles.inputLabel}>
            Overall administrator comment
          </Text>

          <TextInput
            accessibilityLabel="Overall administrator comment"
            editable={!isSaving}
            maxLength={500}
            multiline
            onChangeText={setOverallComment}
            placeholder="Enter an overall comment for the learner's term report..."
            placeholderTextColor={
              colors.textSecondary
            }
            style={styles.commentInput}
            textAlignVertical="top"
            value={overallComment}
          />

          <Text style={styles.characterCount}>
            {overallComment.length}/500 characters
          </Text>

          <Pressable
            accessibilityLabel="Save report as draft"
            accessibilityRole="button"
            disabled={
              isSaving || results.length === 0
            }
            onPress={() =>
              void handleSaveReport("draft")
            }
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed &&
                !isSaving &&
                styles.secondaryButtonPressed,
              (isSaving ||
                results.length === 0) &&
                styles.buttonDisabled,
            ]}
          >
            <Text
              style={styles.secondaryButtonText}
            >
              Save as draft
            </Text>
          </Pressable>

          {feesAreUpToDate ? (
            <Pressable
              accessibilityLabel="Approve and release report"
              accessibilityRole="button"
              disabled={
                isSaving ||
                results.length === 0
              }
              onPress={() =>
                void handleSaveReport("approved")
              }
              style={({ pressed }) => [
                styles.approveButton,
                pressed &&
                  !isSaving &&
                  styles.approveButtonPressed,
                (isSaving ||
                  results.length === 0) &&
                  styles.buttonDisabled,
              ]}
            >
              {isSaving ? (
                <View
                  style={
                    styles.loadingButtonContent
                  }
                >
                  <ActivityIndicator
                    color={
                      colors.textOnPrimary
                    }
                    size="small"
                  />

                  <Text
                    style={
                      styles.approveButtonText
                    }
                  >
                    Saving...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.approveButtonText
                  }
                >
                  Approve and release report
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Compile and withhold report"
              accessibilityRole="button"
              disabled={
                isSaving ||
                results.length === 0
              }
              onPress={() =>
                void handleSaveReport("withheld")
              }
              style={({ pressed }) => [
                styles.withholdButton,
                pressed &&
                  !isSaving &&
                  styles.withholdButtonPressed,
                (isSaving ||
                  results.length === 0) &&
                  styles.buttonDisabled,
              ]}
            >
              {isSaving ? (
                <View
                  style={
                    styles.loadingButtonContent
                  }
                >
                  <ActivityIndicator
                    color={colors.error}
                    size="small"
                  />

                  <Text
                    style={
                      styles.withholdButtonText
                    }
                  >
                    Saving...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.withholdButtonText
                  }
                >
                  Compile and withhold report
                </Text>
              )}
            </Pressable>
          )}

          {existingReport ? (
            <Pressable
              accessibilityHint="Opens the formatted academic report"
              accessibilityLabel="View compiled report"
              accessibilityRole="button"
              onPress={handleViewReport}
              style={({ pressed }) => [
                styles.previewButton,
                pressed &&
                  styles.previewButtonPressed,
              ]}
            >
              <Text
                style={styles.previewButtonText}
              >
                View compiled report
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.securityNotice}>
            Parents can only access reports that have
            been approved and whose linked
            learner&apos;s fees are up to date.
          </Text>
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
    marginTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 42,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 21,
    marginRight: 14,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: colors.textOnPrimary,
    fontSize: 32,
    lineHeight: 34,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerEyebrow: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 25,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: colors.primaryLight,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  errorCard: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    marginTop: 16,
    padding: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
  },
  successCard: {
    backgroundColor: "#E8F5ED",
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 14,
    marginTop: 16,
    padding: 14,
  },
  successTitle: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
  },
  successText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  learnerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginTop: 18,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  learnerName: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
    marginTop: 7,
  },
  learnerDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  termRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  termBadge: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
    padding: 12,
  },
  termBadgeLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  termBadgeValue: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  feeCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 17,
    marginTop: 18,
    padding: 16,
  },
  feeCardUpToDate: {
    backgroundColor: "#E8F5ED",
    borderColor: colors.success,
  },
  feeCardOutstanding: {
    backgroundColor: "#FDECEC",
    borderColor: colors.error,
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  feeContent: {
    flex: 1,
  },
  feeTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  feeStatus: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
  },
  feeDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  currentStatusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginTop: 16,
    padding: 15,
  },
  currentStatusLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  currentStatusValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 13,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  averageBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  averageLabel: {
    color: colors.primaryLight,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  averageValue: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 22,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },
  subjectCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginBottom: 12,
    padding: 17,
  },
  subjectTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectTextContainer: {
    flex: 1,
  },
  subjectName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  teacherLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  markBadge: {
    minWidth: 62,
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  markText: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },
  commentContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },
  commentLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  commentText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 9,
  },
  commentInput: {
    minHeight: 130,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    fontSize: 14,
    lineHeight: 21,
    padding: 15,
  },
  characterCount: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: "right",
    marginTop: 6,
  },
  secondaryButton: {
    minHeight: 53,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 18,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primaryLight,
    transform: [{ scale: 0.98 }],
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  approveButton: {
    minHeight: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    borderRadius: 15,
    marginTop: 12,
    paddingHorizontal: 18,
  },
  approveButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  approveButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  withholdButton: {
    minHeight: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 15,
    marginTop: 12,
    paddingHorizontal: 18,
  },
  withholdButtonPressed: {
    backgroundColor: "#FDECEC",
    transform: [{ scale: 0.98 }],
  },
  withholdButtonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "800",
  },
  previewButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 15,
    marginTop: 12,
    paddingHorizontal: 18,
  },
  previewButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  previewButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  securityNotice: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 10,
  },
});