import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/lib/firebase-auth";
import { getParentLearners } from "@/services/learner-service";
import { generateAcademicReportPdf } from "@/services/academic-report-pdf-service";
import {
  getApprovedTermReports,
  getFeeAccount,
} from "@/services/term-report-service";
import { colors } from "@/theme/colors";
import type {
  Learner,
  TermReport,
} from "@/types/school";

type ReportsByLearner = Record<
  string,
  TermReport[]
>;

type FeeAccessByLearner = Record<
  string,
  boolean
>;

function getResultColour(mark: number): string {
  if (mark >= 75) {
    return colors.success;
  }

  if (mark >= 50) {
    return colors.warning;
  }

  return colors.error;
}

function getPerformanceMessage(
  averageMark: number,
): string {
  if (averageMark >= 80) {
    return "Outstanding academic achievement";
  }

  if (averageMark >= 70) {
    return "Strong academic achievement";
  }

  if (averageMark >= 60) {
    return "Good academic progress";
  }

  if (averageMark >= 50) {
    return "Satisfactory academic progress";
  }

  return "Additional academic support recommended";
}

export default function ParentReportsScreen() {
  const [learners, setLearners] = useState<
    Learner[]
  >([]);
  const [reportsByLearner, setReportsByLearner] =
    useState<ReportsByLearner>({});
  const [feeAccessByLearner, setFeeAccessByLearner] =
    useState<FeeAccessByLearner>({});
  const [selectedLearnerId, setSelectedLearnerId] =
    useState("");
  const [selectedReportId, setSelectedReportId] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [feedbackMessage, setFeedbackMessage] =
    useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] =
    useState(false);
  const [reloadNumber, setReloadNumber] =
    useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadParentReports() {
      try {
        const parentUid = auth.currentUser?.uid;

        if (!parentUid) {
          throw new Error(
            "Your parent account could not be verified. Please log in again.",
          );
        }

        const loadedLearners =
          await getParentLearners(parentUid);

        const reportEntries = await Promise.all(
          loadedLearners.map(async (learner) => {
            const feeAccount =
              await getFeeAccount(learner.id);

            const hasFeeAccess =
              feeAccount?.status === "upToDate";

            if (!hasFeeAccess) {
              return {
                learnerId: learner.id,
                hasFeeAccess: false,
                reports: [] as TermReport[],
              };
            }

            const learnerReports =
              await getApprovedTermReports(
                learner.id,
              );

            return {
              learnerId: learner.id,
              hasFeeAccess: true,
              reports: learnerReports,
            };
          }),
        );

        if (!isMounted) {
          return;
        }

        const loadedReports: ReportsByLearner =
          {};
        const loadedFeeAccess: FeeAccessByLearner =
          {};

        reportEntries.forEach((entry) => {
          loadedReports[entry.learnerId] =
            entry.reports;
          loadedFeeAccess[entry.learnerId] =
            entry.hasFeeAccess;
        });

        const firstLearnerWithReport =
          loadedLearners.find(
            (learner) =>
              (
                loadedReports[learner.id] ?? []
              ).length > 0,
          );

        const initialLearner =
          firstLearnerWithReport ??
          loadedLearners[0] ??
          null;

        const initialReport = initialLearner
          ? loadedReports[
              initialLearner.id
            ]?.[0]
          : undefined;

        setLearners(loadedLearners);
        setReportsByLearner(loadedReports);
        setFeeAccessByLearner(
          loadedFeeAccess,
        );
        setSelectedLearnerId(
          initialLearner?.id ?? "",
        );
        setSelectedReportId(
          initialReport?.id ?? "",
        );
        setErrorMessage("");
      } catch (error) {
        console.error(
          "Unable to load parent reports:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Approved reports could not be loaded. Check your connection and try again.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadParentReports();

    return () => {
      isMounted = false;
    };
  }, [reloadNumber]);

  const selectedLearner = useMemo(
    () =>
      learners.find(
        (learner) =>
          learner.id === selectedLearnerId,
      ) ?? null,
    [learners, selectedLearnerId],
  );

  const selectedLearnerReports = useMemo(
    () =>
      reportsByLearner[selectedLearnerId] ??
      [],
    [reportsByLearner, selectedLearnerId],
  );

  const selectedReport = useMemo(
    () =>
      selectedLearnerReports.find(
        (report) =>
          report.id === selectedReportId,
      ) ??
      selectedLearnerReports[0] ??
      null,
    [
      selectedLearnerReports,
      selectedReportId,
    ],
  );

  const selectedLearnerHasFeeAccess =
    feeAccessByLearner[selectedLearnerId] ??
    false;

  const handleLearnerChange = (
    learnerId: string,
  ) => {
    const learnerReports =
      reportsByLearner[learnerId] ?? [];

    setSelectedLearnerId(learnerId);
    setSelectedReportId(
      learnerReports[0]?.id ?? "",
    );
    setFeedbackMessage("");
  };

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage("");
    setFeedbackMessage("");
    setReloadNumber(
      (currentValue) => currentValue + 1,
    );
  };

  const handleDownloadReport = async () => {
    if (!selectedReport || isGeneratingPdf) {
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setErrorMessage("");
      setFeedbackMessage("");

      const result =
        await generateAcademicReportPdf(
          selectedReport,
        );

      setFeedbackMessage(
        result === "printed"
          ? "The report was opened in the print dialog. Select Save as PDF to download it."
          : result === "shared"
            ? "The academic report PDF was generated successfully."
            : "The report PDF was created, but sharing is not available on this device.",
      );
    } catch (error) {
      console.error(
        "Unable to generate academic report PDF:",
        error,
      );

      setErrorMessage(
        "The academic report PDF could not be generated. Try again.",
      );
    } finally {
      setIsGeneratingPdf(false);
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
            Loading approved reports...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            PARENT PORTAL
          </Text>

          <Text style={styles.title}>
            Progress and Reports
          </Text>

          <Text style={styles.subtitle}>
            Approved academic information for your
            linked learners
          </Text>

          {learners.length > 0 ? (
            <ScrollView
              contentContainerStyle={
                styles.learnerSelector
              }
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {learners.map((learner) => {
                const isSelected =
                  learner.id ===
                  selectedLearnerId;

                const reportCount =
                  reportsByLearner[
                    learner.id
                  ]?.length ?? 0;

                return (
                  <Pressable
                    key={learner.id}
                    accessibilityLabel={`Select ${learner.firstName}`}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: isSelected,
                    }}
                    onPress={() =>
                      handleLearnerChange(
                        learner.id,
                      )
                    }
                    style={({ pressed }) => [
                      styles.learnerButton,
                      isSelected &&
                        styles.learnerButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.learnerName,
                        isSelected &&
                          styles.learnerNameSelected,
                      ]}
                    >
                      {learner.firstName}
                    </Text>

                    <Text
                      style={[
                        styles.learnerGrade,
                        isSelected &&
                          styles.learnerGradeSelected,
                      ]}
                    >
                      Grade{" "}
                      {
                        learner.currentGradeNumber
                      }{" "}
                      • {reportCount}{" "}
                      {reportCount === 1
                        ? "report"
                        : "reports"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.errorCard}
            >
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={38}
              />

              <Text style={styles.errorTitle}>
                Reports unavailable
              </Text>

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>

              <Pressable
                accessibilityLabel="Retry loading reports"
                accessibilityRole="button"
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed &&
                    styles.retryButtonPressed,
                ]}
              >
                <Text
                  style={styles.retryButtonText}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}

          {feedbackMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.feedbackCard}
            >
              <Ionicons
                color={colors.success}
                name="checkmark-circle-outline"
                size={20}
              />

              <Text style={styles.feedbackText}>
                {feedbackMessage}
              </Text>
            </View>
          ) : null}

          {!errorMessage &&
          learners.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                color={colors.textSecondary}
                name="people-outline"
                size={44}
              />

              <Text style={styles.emptyTitle}>
                No linked learners
              </Text>

              <Text style={styles.emptyText}>
                No active learners are currently
                linked to this parent account. Please
                contact the school administrator.
              </Text>
            </View>
          ) : null}

          {!errorMessage &&
          selectedLearner &&
          !selectedLearnerHasFeeAccess ? (
            <View style={styles.feeRestrictedCard}>
              <View
                style={styles.feeRestrictedIcon}
              >
                <Ionicons
                  color={colors.error}
                  name="lock-closed-outline"
                  size={30}
                />
              </View>

              <Text
                style={styles.feeRestrictedTitle}
              >
                Report access restricted
              </Text>

              <Text
                style={styles.feeRestrictedText}
              >
                {selectedLearner.firstName}
                &apos;s reports are currently
                unavailable because the school fee
                account is not marked as up to date.
                Please contact the school office for
                assistance.
              </Text>
            </View>
          ) : null}

          {!errorMessage &&
          selectedLearner &&
          selectedLearnerHasFeeAccess &&
          !selectedReport ? (
            <View style={styles.emptyCard}>
              <Ionicons
                color={colors.textSecondary}
                name="document-text-outline"
                size={44}
              />

              <Text style={styles.emptyTitle}>
                No approved reports
              </Text>

              <Text style={styles.emptyText}>
                There are currently no approved
                reports available for{" "}
                {selectedLearner.firstName}. Draft and
                withheld reports are not shown.
              </Text>
            </View>
          ) : null}

          {!errorMessage && selectedReport ? (
            <>
              <View style={styles.releaseCard}>
                <View style={styles.releaseIcon}>
                  <Ionicons
                    color={colors.success}
                    name="shield-checkmark-outline"
                    size={26}
                  />
                </View>

                <View
                  style={styles.releaseContent}
                >
                  <View
                    style={styles.releaseHeading}
                  >
                    <Text
                      style={styles.releaseTitle}
                    >
                      Term {selectedReport.term} report
                      released
                    </Text>

                    <View
                      style={styles.approvedBadge}
                    >
                      <Text
                        style={styles.approvedText}
                      >
                        APPROVED
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={styles.releaseText}
                  >
                    Reviewed and released by the
                    school administrator for{" "}
                    {selectedReport.academicYear}.
                  </Text>
                </View>
              </View>

              {selectedLearnerReports.length >
              1 ? (
                <View
                  style={
                    styles.reportSelectorSection
                  }
                >
                  <Text
                    style={
                      styles.reportSelectorTitle
                    }
                  >
                    Available reports
                  </Text>

                  <ScrollView
                    contentContainerStyle={
                      styles.reportSelector
                    }
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                  >
                    {selectedLearnerReports.map(
                      (report) => {
                        const isSelected =
                          report.id ===
                          selectedReport.id;

                        return (
                          <Pressable
                            key={report.id}
                            accessibilityLabel={`View Term ${report.term} ${report.academicYear} report`}
                            accessibilityRole="button"
                            onPress={() =>
                              setSelectedReportId(
                                report.id,
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.reportButton,
                              isSelected &&
                                styles.reportButtonSelected,
                              pressed &&
                                styles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.reportButtonText,
                                isSelected &&
                                  styles.reportButtonTextSelected,
                              ]}
                            >
                              Term {report.term}
                            </Text>

                            <Text
                              style={[
                                styles.reportYear,
                                isSelected &&
                                  styles.reportYearSelected,
                              ]}
                            >
                              {report.academicYear}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.learnerCard}>
                <Text
                  style={styles.cardEyebrow}
                >
                  LEARNER
                </Text>

                <Text
                  style={styles.fullLearnerName}
                >
                  {
                    selectedReport.learnerFirstName
                  }{" "}
                  {selectedReport.learnerLastName}
                </Text>

                <Text
                  style={styles.learnerInformation}
                >
                  {selectedReport.className} •{" "}
                  {selectedReport.studentNumber}
                </Text>
              </View>

              <View style={styles.averageCard}>
                <View style={styles.averageContent}>
                  <Text
                    style={styles.averageLabel}
                  >
                    OVERALL AVERAGE
                  </Text>

                  <Text
                    style={styles.averageValue}
                  >
                    {selectedReport.averageMark}%
                  </Text>

                  <Text
                    style={
                      styles.averageDescription
                    }
                  >
                    {getPerformanceMessage(
                      selectedReport.averageMark,
                    )}
                  </Text>
                </View>

                <View style={styles.averageIcon}>
                  <Ionicons
                    color={colors.primary}
                    name="trending-up"
                    size={28}
                  />
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Subject results
                </Text>

                <View style={styles.termBadge}>
                  <Text style={styles.termText}>
                    TERM {selectedReport.term}
                  </Text>
                </View>
              </View>

              {selectedReport.subjects.map(
                (subject) => {
                  const resultColour =
                    getResultColour(
                      subject.mark,
                    );

                  const progressWidth = `${Math.min(
                    Math.max(subject.mark, 0),
                    100,
                  )}%` as `${number}%`;

                  return (
                    <View
                      key={
                        subject.subjectResultId
                      }
                      style={styles.subjectCard}
                    >
                      <View
                        style={
                          styles.subjectHeading
                        }
                      >
                        <View
                          style={
                            styles.subjectInformation
                          }
                        >
                          <Text
                            style={
                              styles.subjectName
                            }
                          >
                            {subject.subject}
                          </Text>

                          <Text
                            style={
                              styles.teacherComment
                            }
                          >
                            {subject.comments ||
                              "No teacher comment was provided."}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.subjectAverage,
                            {
                              color:
                                resultColour,
                            },
                          ]}
                        >
                          {subject.mark}%
                        </Text>
                      </View>

                      <View
                        style={styles.progressTrack}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width:
                                progressWidth,
                              backgroundColor:
                                resultColour,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                },
              )}

              <View style={styles.commentCard}>
                <Text
                  style={styles.commentLabel}
                >
                  OVERALL COMMENT
                </Text>

                <Text
                  style={styles.overallComment}
                >
                  {selectedReport.overallComment ||
                    "No overall comment was provided."}
                </Text>
              </View>

              <View
                style={styles.verificationCard}
              >
                <Ionicons
                  color={colors.success}
                  name="checkmark-circle"
                  size={22}
                />

                <View
                  style={
                    styles.verificationContent
                  }
                >
                  <Text
                    style={
                      styles.verificationTitle
                    }
                  >
                    Verified school report
                  </Text>

                  <Text
                    style={
                      styles.verificationText
                    }
                  >
                    Reference: {selectedReport.id}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityLabel="Download or share academic report PDF"
                accessibilityRole="button"
                disabled={isGeneratingPdf}
                onPress={() =>
                  void handleDownloadReport()
                }
                style={({ pressed }) => [
                  styles.downloadButton,
                  pressed &&
                    !isGeneratingPdf &&
                    styles.downloadButtonPressed,
                  isGeneratingPdf &&
                    styles.downloadButtonDisabled,
                ]}
              >
                {isGeneratingPdf ? (
                  <>
                    <ActivityIndicator
                      color={colors.textOnPrimary}
                      size="small"
                    />

                    <Text
                      style={styles.downloadButtonText}
                    >
                      Preparing PDF...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      color={colors.textOnPrimary}
                      name="download-outline"
                      size={20}
                    />

                    <Text
                      style={styles.downloadButtonText}
                    >
                      Download / Share PDF
                    </Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.privacyText}>
                Reports contain private learner
                information and are only available to
                authorised parents and school staff.
              </Text>
            </>
          ) : null}
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
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
  },
  eyebrow: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.textOnPrimary,
    fontSize: 27,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: colors.primaryLight,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  learnerSelector: {
    gap: 10,
    paddingTop: 21,
    paddingRight: 20,
  },
  learnerButton: {
    minWidth: 145,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  learnerButtonSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  learnerName: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  learnerNameSelected: {
    color: colors.primary,
  },
  learnerGrade: {
    color: colors.primaryLight,
    fontSize: 10,
    marginTop: 3,
  },
  learnerGradeSelected: {
    color: colors.textSecondary,
  },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 35,
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
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderRadius: 12,
    marginTop: 15,
    paddingHorizontal: 20,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 30,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  feeRestrictedCard: {
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 18,
    padding: 28,
  },
  feeRestrictedIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 29,
  },
  feeRestrictedTitle: {
    color: colors.error,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 13,
  },
  feeRestrictedText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  releaseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderWidth: 1,
    borderColor: "#B8DDC6",
    borderRadius: 18,
    padding: 16,
  },
  releaseIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 23,
    marginRight: 12,
  },
  releaseContent: {
    flex: 1,
  },
  releaseHeading: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  releaseTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  approvedBadge: {
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  approvedText: {
    color: colors.textOnPrimary,
    fontSize: 7,
    fontWeight: "800",
  },
  releaseText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  reportSelectorSection: {
    marginTop: 18,
  },
  reportSelectorTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  reportSelector: {
    gap: 9,
    paddingTop: 10,
    paddingRight: 15,
  },
  reportButton: {
    minWidth: 92,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  reportButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reportButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  reportButtonTextSelected: {
    color: colors.textOnPrimary,
  },
  reportYear: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
  },
  reportYearSelected: {
    color: colors.primaryLight,
  },
  learnerCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
    marginTop: 16,
    padding: 17,
  },
  cardEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  fullLearnerName: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },
  learnerInformation: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  averageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
  },
  averageContent: {
    flex: 1,
    paddingRight: 12,
  },
  averageLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  averageValue: {
    color: colors.primary,
    fontSize: 35,
    fontWeight: "800",
    marginTop: 4,
  },
  averageDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  averageIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 27,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  termBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  termText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: "800",
  },
  subjectCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginBottom: 11,
    padding: 16,
  },
  subjectHeading: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectInformation: {
    flex: 1,
    paddingRight: 12,
  },
  subjectName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  teacherComment: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  subjectAverage: {
    fontSize: 20,
    fontWeight: "800",
  },
  progressTrack: {
    width: "100%",
    height: 7,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    marginTop: 13,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  commentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginTop: 5,
    padding: 16,
  },
  commentLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  overallComment: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  verificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderRadius: 14,
    marginTop: 15,
    padding: 14,
  },
  verificationContent: {
    flex: 1,
    marginLeft: 10,
  },
  verificationTitle: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  verificationText: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
  },
  feedbackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F4EC",
    borderWidth: 1,
    borderColor: "#B8DDC6",
    borderRadius: 14,
    marginBottom: 16,
    padding: 13,
  },
  feedbackText: {
    flex: 1,
    color: colors.success,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },
  downloadButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 18,
    paddingHorizontal: 18,
  },
  downloadButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  privacyText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
