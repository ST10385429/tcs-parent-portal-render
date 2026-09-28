import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getTermReportById } from "@/services/term-report-service";
import { colors } from "@/theme/colors";
import type {
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

function getStatusLabel(
  status: TermReportStatus,
): string {
  switch (status) {
    case "approved":
      return "Approved";

    case "withheld":
      return "Withheld";

    default:
      return "Draft";
  }
}

function getStatusColor(
  status: TermReportStatus,
): string {
  switch (status) {
    case "approved":
      return colors.success;

    case "withheld":
      return colors.error;

    default:
      return "#B7791F";
  }
}

function getPerformanceLabel(
  averageMark: number,
): string {
  if (averageMark >= 80) {
    return "Outstanding achievement";
  }

  if (averageMark >= 70) {
    return "Strong achievement";
  }

  if (averageMark >= 60) {
    return "Good achievement";
  }

  if (averageMark >= 50) {
    return "Satisfactory achievement";
  }

  return "Additional support recommended";
}

export default function AdminReportPreviewScreen() {
  const router = useRouter();

  const parameters = useLocalSearchParams<{
    reportId?: string | string[];
  }>();

  const reportId = readParameter(parameters.reportId);

  const [report, setReport] =
    useState<TermReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      try {
        if (!reportId) {
          throw new Error(
            "No report was selected.",
          );
        }

        const loadedReport =
          await getTermReportById(reportId);

        if (!isMounted) {
          return;
        }

        if (!loadedReport) {
          throw new Error(
            "The selected report could not be found.",
          );
        }

        setReport(loadedReport);
        setErrorMessage("");
      } catch (error) {
        console.error(
          "Unable to load term report:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The report could not be loaded.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/admin/results");
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
            Preparing report preview...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report || errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorScreen}>
          <Ionicons
            color={colors.error}
            name="alert-circle-outline"
            size={48}
          />

          <Text style={styles.errorTitle}>
            Report unavailable
          </Text>

          <Text style={styles.errorText}>
            {errorMessage ||
              "The report could not be found."}
          </Text>

          <Pressable
            accessibilityLabel="Return to submitted marks"
            accessibilityRole="button"
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.returnButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.returnButtonText}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const learnerName =
    `${report.learnerFirstName} ${report.learnerLastName}`.trim();

  const statusColor = getStatusColor(report.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.navigationHeader}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.navigationTitle}>
            Report Preview
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reportDocument}>
            <View style={styles.schoolHeader}>
              <View
                accessible
                accessibilityLabel="Thabazimbi Christian School logo"
                style={styles.logo}
              >
                <Image
                  resizeMode="contain"
                  source={require("../../../../../assets/images/tcs-logo.jpeg")}
                  style={styles.logoImage}
                />
              </View>

              <View style={styles.schoolInformation}>
                <Text style={styles.schoolName}>
                  Thabazimbi Christian School
                </Text>

                <Text style={styles.documentName}>
                  Learner Academic Report
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.reportHeadingRow}>
              <View>
                <Text style={styles.reportLabel}>
                  ACADEMIC REPORT
                </Text>

                <Text style={styles.reportHeading}>
                  Term {report.term}, {report.academicYear}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    borderColor: statusColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: statusColor,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color: statusColor,
                    },
                  ]}
                >
                  {getStatusLabel(report.status)}
                </Text>
              </View>
            </View>

            <View style={styles.learnerSection}>
              <Text style={styles.sectionEyebrow}>
                LEARNER INFORMATION
              </Text>

              <Text style={styles.learnerName}>
                {learnerName}
              </Text>

              <View style={styles.informationGrid}>
                <View style={styles.informationItem}>
                  <Text style={styles.informationLabel}>
                    STUDENT NUMBER
                  </Text>

                  <Text style={styles.informationValue}>
                    {report.studentNumber}
                  </Text>
                </View>

                <View style={styles.informationItem}>
                  <Text style={styles.informationLabel}>
                    CLASS
                  </Text>

                  <Text style={styles.informationValue}>
                    {report.className}
                  </Text>
                </View>

                <View style={styles.informationItem}>
                  <Text style={styles.informationLabel}>
                    ACADEMIC YEAR
                  </Text>

                  <Text style={styles.informationValue}>
                    {report.academicYear}
                  </Text>
                </View>

                <View style={styles.informationItem}>
                  <Text style={styles.informationLabel}>
                    TERM
                  </Text>

                  <Text style={styles.informationValue}>
                    {report.term}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.resultsHeading}>
              <Text style={styles.sectionTitle}>
                Academic results
              </Text>

              <Text style={styles.subjectCount}>
                {report.subjects.length}{" "}
                {report.subjects.length === 1
                  ? "subject"
                  : "subjects"}
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.subjectColumn,
                ]}
              >
                SUBJECT
              </Text>

              <Text
                style={[
                  styles.tableHeaderText,
                  styles.markColumn,
                ]}
              >
                MARK
              </Text>
            </View>

            {report.subjects.map((subject) => (
              <View
                key={subject.subjectResultId}
                style={styles.subjectRow}
              >
                <View style={styles.subjectColumn}>
                  <Text style={styles.subjectName}>
                    {subject.subject}
                  </Text>

                  <Text style={styles.subjectComment}>
                    {subject.comments ||
                      "No teacher comment provided."}
                  </Text>
                </View>

                <View style={styles.markColumn}>
                  <Text
                    style={[
                      styles.subjectMark,
                      {
                        color:
                          subject.mark >= 50
                            ? colors.success
                            : colors.error,
                      },
                    ]}
                  >
                    {subject.mark}%
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.averageSection}>
              <View>
                <Text style={styles.averageLabel}>
                  OVERALL AVERAGE
                </Text>

                <Text style={styles.performanceText}>
                  {getPerformanceLabel(
                    report.averageMark,
                  )}
                </Text>
              </View>

              <Text style={styles.averageValue}>
                {report.averageMark}%
              </Text>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.sectionEyebrow}>
                OVERALL COMMENT
              </Text>

              <Text style={styles.overallComment}>
                {report.overallComment ||
                  "No overall comment was provided."}
              </Text>
            </View>

            <View style={styles.footerDivider} />

            <View style={styles.reportFooter}>
              <View>
                <Text style={styles.footerLabel}>
                  REPORT STATUS
                </Text>

                <Text
                  style={[
                    styles.footerValue,
                    {
                      color: statusColor,
                    },
                  ]}
                >
                  {getStatusLabel(report.status)}
                </Text>
              </View>

              <View style={styles.footerRight}>
                <Text style={styles.footerLabel}>
                  REPORT REFERENCE
                </Text>

                <Text style={styles.referenceText}>
                  {report.id}
                </Text>
              </View>
            </View>

            <Text style={styles.verificationNotice}>
              This report was generated securely through the
              TCS Parent and Staff Portal.
            </Text>
          </View>
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
  navigationHeader: {
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
  navigationTitle: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 75,
  },
  content: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
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
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 28,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    textAlign: "center",
  },
  returnButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 25,
  },
  returnButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  reportDocument: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  schoolHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 29,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  schoolInformation: {
    flex: 1,
    marginLeft: 14,
  },
  schoolName: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
  },
  documentName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  divider: {
    height: 2,
    backgroundColor: colors.primary,
    marginVertical: 18,
  },
  reportHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  reportHeading: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  learnerSection: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    marginTop: 20,
    padding: 17,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  learnerName: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 6,
  },
  informationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 15,
  },
  informationItem: {
    width: "50%",
    marginBottom: 12,
  },
  informationLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  informationValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  resultsHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 11,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  subjectCount: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 11,
  },
  tableHeaderText: {
    color: colors.textOnPrimary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  subjectColumn: {
    flex: 1,
  },
  markColumn: {
    width: 65,
    alignItems: "center",
  },
  subjectName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  subjectComment: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  subjectMark: {
    fontSize: 16,
    fontWeight: "800",
  },
  averageSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    marginTop: 16,
    padding: 16,
  },
  averageLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  performanceText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  averageValue: {
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "800",
  },
  commentSection: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginTop: 17,
    padding: 15,
  },
  overallComment: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerRight: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 15,
  },
  footerLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  footerValue: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  referenceText: {
    color: colors.textPrimary,
    fontSize: 9,
    marginTop: 4,
    textAlign: "right",
  },
  verificationNotice: {
    color: colors.textSecondary,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 20,
    textAlign: "center",
  },
});
