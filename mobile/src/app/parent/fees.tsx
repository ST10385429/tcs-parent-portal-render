import Ionicons from "@expo/vector-icons/Ionicons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

import { getTcsLogoDataUri } from "@/services/document-branding";

import {
  formatCurrency,
  formatFeeDate,
  formatPaymentDate,
  getFeeAccount,
  getLearnerPayments,
} from "@/services/fee-service";

import {
  getLearnerFeeStatements,
} from "@/services/fee-statement-service";

import {
  getParentLearners,
} from "@/services/learner-service";

import {
  generatePaymentReceipt,
} from "@/services/payment-receipt-service";

import {
  createPayFastPayment,
} from "@/services/payfast-service";

import { colors } from "@/theme/colors";

import type {
  FeeAccount,
  FeePayment,
  FeeStatement,
  Learner,
} from "@/types/school";

type HistoryRecord = {
  id: string;
  sourceId: string;
  title: string;
  date: string;
  amount: number;
  type: "statement" | "payment";
  status: string;
  timestamp: number;
};

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatStatementStatus(
  status: FeeStatement["status"],
): string {
  switch (status) {
    case "partiallyPaid":
      return "Partially paid";

    case "paid":
      return "Paid";

    case "overdue":
      return "Overdue";

    case "cancelled":
      return "Cancelled";

    case "draft":
      return "Draft";

    default:
      return "Issued";
  }
}

function getStatementDate(
  statement: FeeStatement,
): number {
  return (
    statement.issueDate?.toMillis() ??
    statement.createdAt?.toMillis() ??
    0
  );
}

function getPaymentDate(
  payment: FeePayment,
): number {
  return (
    payment.paidAt?.toMillis() ??
    payment.createdAt?.toMillis() ??
    0
  );
}

function buildStatementHtml(
  statement: FeeStatement,
  logoDataUri: string,
): string {
  const learnerName = escapeHtml(
    `${statement.learnerFirstName} ${statement.learnerLastName}`.trim(),
  );

  const lineItems = statement.lineItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.type)}</td>
          <td class="number">${formatCurrency(item.total)}</td>
        </tr>
      `,
    )
    .join("");

  const issueDate = formatFeeDate(
    statement.issueDate,
    "Not available",
  );

  const dueDate = formatFeeDate(
    statement.dueDate,
    "Not available",
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 38px;
            color: #17233d;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.5;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 4px solid #193b66;
            padding-bottom: 20px;
          }

          .school-brand {
            display: flex;
            align-items: center;
          }

          .school-logo {
            width: 72px;
            height: 72px;
            object-fit: contain;
            margin-right: 16px;
          }

          .school-copy {
            padding-top: 4px;
          }

          .school-name {
            margin: 0;
            color: #193b66;
            font-size: 24px;
            font-weight: 800;
          }

          .document-title {
            margin: 5px 0 0;
            color: #667085;
            font-size: 14px;
          }

          .statement-number {
            color: #193b66;
            font-size: 12px;
            font-weight: 700;
            text-align: right;
          }

          .section {
            margin-top: 24px;
          }

          .section-title {
            margin: 0 0 10px;
            color: #193b66;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.7px;
          }

          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 24px;
            padding: 16px;
            background: #f3f6fa;
            border-radius: 10px;
          }

          .label {
            color: #667085;
            font-size: 11px;
          }

          .value {
            color: #17233d;
            font-weight: 700;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }

          th {
            padding: 10px;
            color: #ffffff;
            background: #193b66;
            font-size: 11px;
            text-align: left;
          }

          td {
            padding: 11px 10px;
            border-bottom: 1px solid #d9e0e8;
          }

          .number {
            text-align: right;
          }

          .summary {
            width: 310px;
            margin-top: 18px;
            margin-left: auto;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
          }

          .summary-total {
            margin-top: 5px;
            padding-top: 12px;
            border-top: 2px solid #193b66;
            color: #193b66;
            font-size: 16px;
            font-weight: 800;
          }

          .notes {
            padding: 14px;
            background: #fff8e7;
            border: 1px solid #ebd5a2;
            border-radius: 10px;
          }

          .footer {
            margin-top: 38px;
            padding-top: 15px;
            border-top: 1px solid #d9e0e8;
            color: #667085;
            font-size: 10px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div class="school-brand">
            <img
              class="school-logo"
              src="${logoDataUri}"
              alt="Thabazimbi Christian School logo"
            />

            <div class="school-copy">
              <h1 class="school-name">
                Thabazimbi Christian School
              </h1>

              <p class="document-title">
                Official Fee Statement
              </p>
            </div>
          </div>

          <div class="statement-number">
            ${escapeHtml(statement.statementNumber)}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            Learner information
          </h2>

          <div class="details">
            <div>
              <div class="label">Learner</div>
              <div class="value">${learnerName}</div>
            </div>

            <div>
              <div class="label">Student number</div>
              <div class="value">
                ${escapeHtml(statement.studentNumber)}
              </div>
            </div>

            <div>
              <div class="label">Grade</div>
              <div class="value">
                ${escapeHtml(statement.gradeName)}
              </div>
            </div>

            <div>
              <div class="label">Academic year</div>
              <div class="value">
                ${statement.academicYear}
              </div>
            </div>

            <div>
              <div class="label">Issue date</div>
              <div class="value">${issueDate}</div>
            </div>

            <div>
              <div class="label">Due date</div>
              <div class="value">${dueDate}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            Statement items
          </h2>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th class="number">Amount</th>
              </tr>
            </thead>

            <tbody>
              ${lineItems}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row">
              <span>Opening balance</span>
              <strong>
                ${formatCurrency(statement.openingBalance)}
              </strong>
            </div>

            <div class="summary-row">
              <span>Charges</span>
              <strong>
                ${formatCurrency(statement.totalCharges)}
              </strong>
            </div>

            <div class="summary-row">
              <span>Discounts</span>
              <strong>
                -${formatCurrency(statement.totalDiscounts)}
              </strong>
            </div>

            <div class="summary-row">
              <span>Payments</span>
              <strong>
                -${formatCurrency(statement.totalPayments)}
              </strong>
            </div>

            <div class="summary-row summary-total">
              <span>Amount due</span>
              <span>
                ${formatCurrency(statement.amountDue)}
              </span>
            </div>
          </div>
        </div>

        ${
          statement.notes
            ? `
              <div class="section">
                <h2 class="section-title">Notes</h2>
                <div class="notes">
                  ${escapeHtml(statement.notes)}
                </div>
              </div>
            `
            : ""
        }

        <div class="footer">
          This statement was generated securely through the
          TCS Parent Portal. Please contact the school office
          if any information appears incorrect.
        </div>
      </body>
    </html>
  `;
}

export default function ParentFeesScreen() {
  const { user } = useAuth();

  const [learners, setLearners] =
    useState<Learner[]>([]);

  const [
    selectedLearnerId,
    setSelectedLearnerId,
  ] = useState("");

  const [
    feeAccount,
    setFeeAccount,
  ] = useState<FeeAccount | null>(
    null,
  );

  const [
    statements,
    setStatements,
  ] = useState<FeeStatement[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<FeePayment[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    isGeneratingPdf,
    setIsGeneratingPdf,
  ] = useState(false);

  const [
    isStartingPayment,
    setIsStartingPayment,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState("");

  const selectedLearner =
    useMemo(
      () =>
        learners.find(
          (learner) =>
            learner.id ===
            selectedLearnerId,
        ) ?? null,
      [
        learners,
        selectedLearnerId,
      ],
    );

  const latestStatement =
    statements[0] ?? null;

  const payableStatement =
    statements.find(
      (statement) =>
        statement.amountDue > 0 &&
        (statement.status === "issued" ||
          statement.status === "partiallyPaid" ||
          statement.status === "overdue"),
    ) ?? null;

  const loadLearnerFinancials =
    useCallback(
      async (
        learnerId: string,
      ) => {
        const [
          loadedAccount,
          loadedStatements,
          loadedPayments,
        ] = await Promise.all([
          getFeeAccount(learnerId),
          getLearnerFeeStatements(
            learnerId,
          ),
          getLearnerPayments(
            learnerId,
          ),
        ]);

        setFeeAccount(loadedAccount);
        setStatements(
          loadedStatements,
        );
        setPayments(loadedPayments);
        setErrorMessage("");
      },
      [],
    );

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return () => {
        isMounted = false;
      };
    }

    getParentLearners(user.uid)
      .then(async (loadedLearners) => {
        if (!isMounted) {
          return;
        }

        setLearners(loadedLearners);

        const firstLearner =
          loadedLearners[0];

        if (!firstLearner) {
          setSelectedLearnerId("");
          setFeeAccount(null);
          setStatements([]);
          setPayments([]);
          return;
        }

        setSelectedLearnerId(
          firstLearner.id,
        );

        const [
          loadedAccount,
          loadedStatements,
          loadedPayments,
        ] = await Promise.all([
          getFeeAccount(
            firstLearner.id,
          ),
          getLearnerFeeStatements(
            firstLearner.id,
          ),
          getLearnerPayments(
            firstLearner.id,
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setFeeAccount(loadedAccount);
        setStatements(
          loadedStatements,
        );
        setPayments(loadedPayments);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        console.error(
          "Unable to load parent fee information:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "Your fee information could not be loaded. Check your connection and try again.",
          );
        }
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

  const handleLearnerChange =
    async (learnerId: string) => {
      if (
        learnerId ===
        selectedLearnerId
      ) {
        return;
      }

      try {
        setSelectedLearnerId(
          learnerId,
        );
        setIsLoading(true);
        setFeedbackMessage("");
        setErrorMessage("");

        await loadLearnerFinancials(
          learnerId,
        );
      } catch (error) {
        console.error(
          "Unable to change fee account:",
          error,
        );

        setErrorMessage(
          "The selected learner's fee information could not be loaded.",
        );
      } finally {
        setIsLoading(false);
      }
    };

  const handleRefresh =
    useCallback(async () => {
      if (
        !selectedLearnerId ||
        isRefreshing
      ) {
        return;
      }

      try {
        setIsRefreshing(true);
        setFeedbackMessage("");

        await loadLearnerFinancials(
          selectedLearnerId,
        );
      } catch (error) {
        console.error(
          "Unable to refresh parent fee information:",
          error,
        );

        setErrorMessage(
          "The fee information could not be refreshed.",
        );
      } finally {
        setIsRefreshing(false);
      }
    }, [
      isRefreshing,
      loadLearnerFinancials,
      selectedLearnerId,
    ]);

  const handlePayNow = async () => {
    if (isStartingPayment) {
      return;
    }

    if (!payableStatement) {
      setErrorMessage(
        "There is no payable fee statement available for this learner.",
      );
      return;
    }

    try {
      setIsStartingPayment(true);
      setErrorMessage("");
      setFeedbackMessage(
        "Preparing your secure PayFast checkout...",
      );

      const { checkoutUrl } =
        await createPayFastPayment(
          payableStatement.id,
          payableStatement.amountDue,
        );

      const canOpenCheckout =
        await Linking.canOpenURL(
          checkoutUrl,
        );

      if (!canOpenCheckout) {
        throw new Error(
          "This device could not open the PayFast checkout.",
        );
      }

      await Linking.openURL(
        checkoutUrl,
      );

      setFeedbackMessage(
        "PayFast was opened securely. Return here after completing or cancelling the payment, then pull down to refresh.",
      );
    } catch (error) {
      console.error(
        "Unable to start PayFast payment:",
        error,
      );

      setFeedbackMessage("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The PayFast checkout could not be opened. Try again.",
      );
    } finally {
      setIsStartingPayment(false);
    }
  };

  const handleShareStatement =
    async () => {
      if (
        !latestStatement ||
        isGeneratingPdf
      ) {
        return;
      }

      try {
        setIsGeneratingPdf(true);
        setFeedbackMessage("");

        const logoDataUri =
          await getTcsLogoDataUri();

        const html =
          buildStatementHtml(
            latestStatement,
            logoDataUri,
          );

        if (Platform.OS === "web") {
          await Print.printAsync({
            html,
          });

          setFeedbackMessage(
            "The statement was opened in the print dialog. Select Save as PDF to download it.",
          );

          return;
        }

        const result =
          await Print.printToFileAsync({
            html,
          });

        const sharingAvailable =
          await Sharing.isAvailableAsync();

        if (!sharingAvailable) {
          setFeedbackMessage(
            "The PDF was created, but sharing is not available on this device.",
          );

          return;
        }

        await Sharing.shareAsync(
          result.uri,
          {
            dialogTitle:
              "Share fee statement",
            mimeType:
              "application/pdf",
            UTI: "com.adobe.pdf",
          },
        );

        setFeedbackMessage(
          "The statement PDF was generated successfully.",
        );
      } catch (error) {
        console.error(
          "Unable to generate fee statement PDF:",
          error,
        );

        setErrorMessage(
          "The statement PDF could not be generated. Try again.",
        );
      } finally {
        setIsGeneratingPdf(false);
      }
    };

  const handleSharePaymentReceipt =
    async (paymentId: string) => {
      if (!selectedLearner || isGeneratingPdf) {
        return;
      }

      const payment = payments.find(
        (item) => item.id === paymentId,
      );

      if (!payment) {
        setErrorMessage(
          "The selected payment could not be found.",
        );
        return;
      }

      const statement =
        statements.find(
          (item) =>
            item.id === payment.statementId,
        ) ?? null;

      try {
        setIsGeneratingPdf(true);
        setErrorMessage("");
        setFeedbackMessage("");

        const result =
          await generatePaymentReceipt({
            payment,
            learner: selectedLearner,
            statement,
          });

        setFeedbackMessage(
          result === "printed"
            ? "The receipt was opened in the print dialog. Select Save as PDF to download it."
            : result === "shared"
              ? "The payment receipt was generated successfully."
              : "The receipt PDF was created, but sharing is not available on this device.",
        );
      } catch (error) {
        console.error(
          "Unable to generate payment receipt:",
          error,
        );

        setErrorMessage(
          "The payment receipt could not be generated. Try again.",
        );
      } finally {
        setIsGeneratingPdf(false);
      }
    };

  const history =
    useMemo<HistoryRecord[]>(() => {
      const statementRecords =
        statements.map(
          (
            statement,
          ): HistoryRecord => ({
            id: `statement-${statement.id}`,
            sourceId: statement.id,
            title:
              statement.statementNumber,
            date: formatFeeDate(
              statement.issueDate ??
                statement.createdAt,
              "Date unavailable",
            ),
            amount:
              statement.amountDue,
            type: "statement",
            status:
              formatStatementStatus(
                statement.status,
              ),
            timestamp:
              getStatementDate(
                statement,
              ),
          }),
        );

      const paymentRecords =
        payments.map(
          (
            payment,
          ): HistoryRecord => ({
            id: `payment-${payment.id}`,
            sourceId: payment.id,
            title:
              payment.description ||
              "School fee payment",
            date: formatPaymentDate(
              payment.paidAt ??
                payment.createdAt,
            ),
            amount: -payment.amount,
            type: "payment",
            status:
              payment.status === "paid" ||
              payment.status ===
                "recorded"
                ? "Recorded"
                : payment.status,
            timestamp:
              getPaymentDate(payment),
          }),
        );

      return [
        ...statementRecords,
        ...paymentRecords,
      ].sort(
        (first, second) =>
          second.timestamp -
          first.timestamp,
      );
    }, [payments, statements]);

  const currentBalance =
    feeAccount?.currentBalance ?? 0;

  const overdueBalance =
    feeAccount?.overdueBalance ?? 0;

  const hasCurrentBalance =
    currentBalance > 0;

  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.loadingSafeArea
        }
      >
        <View
          style={
            styles.loadingCircle
          }
        >
          <Ionicons
            color={colors.primary}
            name="wallet-outline"
            size={28}
          />
        </View>

        <Text
          style={styles.loadingText}
        >
          Loading fee information...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            PARENT PORTAL
          </Text>

          <Text style={styles.title}>
            Fees and Payments
          </Text>

          <Text style={styles.subtitle}>
            Secure, transparent account
            information
          </Text>

          {learners.length > 0 ? (
            <ScrollView
              contentContainerStyle={
                styles.learnerSelector
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
            >
              {learners.map(
                (learner) => {
                  const isSelected =
                    selectedLearnerId ===
                    learner.id;

                  return (
                    <Pressable
                      key={learner.id}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked:
                          isSelected,
                      }}
                      onPress={() =>
                        handleLearnerChange(
                          learner.id,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.learnerButton,
                        isSelected &&
                          styles.learnerButtonSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.learnerName,
                          isSelected &&
                            styles.learnerNameSelected,
                        ]}
                      >
                        {
                          learner.firstName
                        }
                      </Text>

                      <Text
                        style={[
                          styles.learnerGrade,
                          isSelected &&
                            styles.learnerGradeSelected,
                        ]}
                      >
                        {learner.schoolClass
                          ?.name ||
                          `Grade ${learner.currentGradeNumber}`}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={
                isRefreshing
              }
              onRefresh={
                handleRefresh
              }
              tintColor={
                colors.primary
              }
            />
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {errorMessage ? (
            <View
              accessibilityRole="alert"
              style={styles.errorCard}
            >
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={21}
              />

              <Text
                style={styles.errorText}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {!selectedLearner ? (
            <View
              style={styles.emptyCard}
            >
              <Ionicons
                color={colors.primary}
                name="people-outline"
                size={30}
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No linked learners
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Contact the school if a
                learner should be linked
                to your account.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.balanceCard,
                  !hasCurrentBalance &&
                    styles.balanceCardPaid,
                ]}
              >
                <View
                  style={
                    styles.balanceTop
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.balanceLabel
                      }
                    >
                      CURRENT BALANCE
                    </Text>

                    <Text
                      style={
                        styles.balanceValue
                      }
                    >
                      {formatCurrency(
                        currentBalance,
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.balanceIcon,
                      !hasCurrentBalance &&
                        styles.balanceIconPaid,
                    ]}
                  >
                    <Ionicons
                      color={
                        hasCurrentBalance
                          ? colors.warning
                          : colors.success
                      }
                      name={
                        hasCurrentBalance
                          ? "wallet-outline"
                          : "checkmark-circle-outline"
                      }
                      size={28}
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.balanceDivider
                  }
                />

                <View
                  style={styles.dueRow}
                >
                  <Ionicons
                    color={
                      colors.textSecondary
                    }
                    name="calendar-outline"
                    size={16}
                  />

                  <Text
                    style={
                      styles.dueText
                    }
                  >
                    {feeAccount
                      ? `Last statement: ${formatFeeDate(
                          feeAccount.lastStatementAt,
                          "Not issued yet",
                        )}`
                      : "No fee account is available"}
                  </Text>
                </View>

                {overdueBalance > 0 ? (
                  <Text
                    style={
                      styles.overdueText
                    }
                  >
                    Overdue:{" "}
                    {formatCurrency(
                      overdueBalance,
                    )}
                  </Text>
                ) : null}

                {hasCurrentBalance ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      isStartingPayment ||
                      !payableStatement
                    }
                    onPress={() =>
                      void handlePayNow()
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.payButton,
                      pressed &&
                        styles.payButtonPressed,
                      (isStartingPayment ||
                        !payableStatement) &&
                        styles.disabled,
                    ]}
                  >
                    <Ionicons
                      color={
                        colors.textOnPrimary
                      }
                      name="card-outline"
                      size={20}
                    />

                    <Text
                      style={
                        styles.payButtonText
                      }
                    >
                      {isStartingPayment
                        ? "Opening PayFast..."
                        : payableStatement
                          ? `Pay ${formatCurrency(
                              payableStatement.amountDue,
                            )} now`
                          : "No payable statement"}
                    </Text>
                  </Pressable>
                ) : (
                  <View
                    style={
                      styles.upToDateMessage
                    }
                  >
                    <Ionicons
                      color={
                        colors.success
                      }
                      name="shield-checkmark-outline"
                      size={18}
                    />

                    <Text
                      style={
                        styles.upToDateText
                      }
                    >
                      This account has no
                      current balance.
                    </Text>
                  </View>
                )}
              </View>

              {latestStatement ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isGeneratingPdf
                  }
                  onPress={
                    handleShareStatement
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.statementButton,
                    pressed &&
                      styles.pressed,
                    isGeneratingPdf &&
                      styles.disabled,
                  ]}
                >
                  <View
                    style={
                      styles.statementIcon
                    }
                  >
                    <Ionicons
                      color={
                        colors.primary
                      }
                      name="document-text-outline"
                      size={21}
                    />
                  </View>

                  <View
                    style={
                      styles.statementContent
                    }
                  >
                    <Text
                      style={
                        styles.statementTitle
                      }
                    >
                      Latest fee statement
                    </Text>

                    <Text
                      style={
                        styles.statementText
                      }
                    >
                      {
                        latestStatement.statementNumber
                      }
                    </Text>
                  </View>

                  <Ionicons
                    color={colors.primary}
                    name={
                      isGeneratingPdf
                        ? "hourglass-outline"
                        : "share-outline"
                    }
                    size={20}
                  />
                </Pressable>
              ) : (
                <View
                  style={
                    styles.noStatementCard
                  }
                >
                  <Ionicons
                    color={
                      colors.textSecondary
                    }
                    name="document-outline"
                    size={21}
                  />

                  <Text
                    style={
                      styles.noStatementText
                    }
                  >
                    No official statements
                    have been issued for
                    this learner.
                  </Text>
                </View>
              )}

              {feedbackMessage ? (
                <View
                  accessibilityRole="alert"
                  style={
                    styles.feedbackMessage
                  }
                >
                  <Ionicons
                    color={colors.info}
                    name="information-circle"
                    size={21}
                  />

                  <Text
                    style={
                      styles.feedbackText
                    }
                  >
                    {feedbackMessage}
                  </Text>
                </View>
              ) : null}

              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Account history
                </Text>

                <Text
                  style={
                    styles.recordCount
                  }
                >
                  {history.length}{" "}
                  {history.length === 1
                    ? "record"
                    : "records"}
                </Text>
              </View>

              {history.length > 0 ? (
                <View
                  style={
                    styles.historyCard
                  }
                >
                  {history.map(
                    (
                      record,
                      index,
                    ) => {
                      const isPayment =
                        record.type ===
                        "payment";

                      const isProblem =
                        record.status ===
                          "Overdue" ||
                        record.status ===
                          "Cancelled" ||
                        record.status ===
                          "failed";

                      return (
                        <View
                          key={
                            record.id
                          }
                        >
                          <View
                            style={
                              styles.historyItem
                            }
                          >
                            <View
                              style={[
                                styles.historyIcon,
                                isPayment &&
                                  styles.paymentHistoryIcon,
                              ]}
                            >
                              <Ionicons
                                color={
                                  isPayment
                                    ? colors.success
                                    : colors.primary
                                }
                                name={
                                  isPayment
                                    ? "arrow-down-outline"
                                    : "receipt-outline"
                                }
                                size={20}
                              />
                            </View>

                            <View
                              style={
                                styles.historyDetails
                              }
                            >
                              <Text
                                style={
                                  styles.historyTitle
                                }
                              >
                                {
                                  record.title
                                }
                              </Text>

                              <Text
                                style={
                                  styles.historyDate
                                }
                              >
                                {
                                  record.date
                                }
                              </Text>

                              <View
                                style={[
                                  styles.statusBadge,
                                  isProblem
                                    ? styles.outstandingBadge
                                    : styles.completedBadge,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusText,
                                    isProblem
                                      ? styles.outstandingStatusText
                                      : styles.completedText,
                                  ]}
                                >
                                  {
                                    record.status
                                  }
                                </Text>
                              </View>

                              {isPayment ? (
                                <Pressable
                                  accessibilityLabel={`View receipt for ${record.title}`}
                                  accessibilityRole="button"
                                  disabled={isGeneratingPdf}
                                  onPress={() =>
                                    void handleSharePaymentReceipt(
                                      record.sourceId,
                                    )
                                  }
                                  style={({ pressed }) => [
                                    styles.receiptButton,
                                    pressed &&
                                      styles.receiptButtonPressed,
                                    isGeneratingPdf &&
                                      styles.receiptButtonDisabled,
                                  ]}
                                >
                                  <Ionicons
                                    color={colors.primary}
                                    name="download-outline"
                                    size={14}
                                  />

                                  <Text
                                    style={
                                      styles.receiptButtonText
                                    }
                                  >
                                    View receipt
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>

                            <Text
                              style={[
                                styles.historyAmount,
                                isPayment &&
                                  styles.paymentAmount,
                              ]}
                            >
                              {record.amount <
                              0
                                ? "-"
                                : ""}
                              {formatCurrency(
                                Math.abs(
                                  record.amount,
                                ),
                              )}
                            </Text>
                          </View>

                          {index <
                          history.length -
                            1 ? (
                            <View
                              style={
                                styles.historyDivider
                              }
                            />
                          ) : null}
                        </View>
                      );
                    },
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.emptyHistoryCard
                  }
                >
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    No statements or
                    verified payments have
                    been recorded yet.
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.securityNotice
                }
              >
                <Ionicons
                  color={colors.primary}
                  name="lock-closed-outline"
                  size={18}
                />

                <Text
                  style={
                    styles.securityText
                  }
                >
                  Financial records are
                  only visible to
                  authorised parents and
                  school administrators.
                </Text>
              </View>
            </>
          )}
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

  loadingSafeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  loadingCircle: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 29,
  },

  loadingText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
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
    marginTop: 5,
  },

  learnerSelector: {
    gap: 10,
    marginTop: 21,
    paddingRight: 4,
  },

  learnerButton: {
    minWidth: 135,
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
    marginTop: 2,
  },

  learnerGradeSelected: {
    color: colors.textSecondary,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  balanceCard: {
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#EBD5A2",
    borderRadius: 22,
    padding: 20,
  },

  balanceCardPaid: {
    backgroundColor: "#E7F4EC",
    borderColor: "#B8DDC6",
  },

  balanceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  balanceValue: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: "800",
    marginTop: 5,
  },

  balanceIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentLight,
    borderRadius: 27,
  },

  balanceIconPaid: {
    backgroundColor: colors.surface,
  },

  balanceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 17,
  },

  dueRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dueText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },

  overdueText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },

  payButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 14,
    marginTop: 18,
  },

  payButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  payButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  upToDateMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },

  upToDateText: {
    flex: 1,
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },

  statementButton: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginTop: 14,
    padding: 15,
  },

  statementIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
  },

  statementContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  statementTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  statementText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },

  noStatementCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginTop: 14,
    padding: 15,
  },

  noStatementText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },

  feedbackMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F3F8",
    borderRadius: 14,
    marginTop: 12,
    padding: 13,
  },

  feedbackText: {
    flex: 1,
    color: colors.info,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 9,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    marginBottom: 14,
    padding: 13,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 9,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    padding: 28,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
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

  recordCount: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  historyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 17,
  },

  historyIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
  },

  paymentHistoryIcon: {
    backgroundColor: "#E7F4EC",
  },

  historyDetails: {
    flex: 1,
    marginHorizontal: 12,
  },

  historyTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  historyDate: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  completedBadge: {
    backgroundColor: "#E7F4EC",
  },

  outstandingBadge: {
    backgroundColor: "#FBE9E7",
  },

  statusText: {
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  completedText: {
    color: colors.success,
  },

  outstandingStatusText: {
    color: colors.error,
  },

  receiptButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 9,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  receiptButtonPressed: {
    backgroundColor: colors.primaryLight,
  },

  receiptButtonDisabled: {
    opacity: 0.55,
  },

  receiptButtonText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
  },

  historyAmount: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  paymentAmount: {
    color: colors.success,
  },

  historyDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  emptyHistoryCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 22,
  },

  securityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    marginTop: 17,
    padding: 14,
  },

  securityText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.6,
  },
});
