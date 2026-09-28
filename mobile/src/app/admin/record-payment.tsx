import {
  useRouter,
} from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

import {
  formatCurrency,
  formatFeeDate,
} from "@/services/fee-service";

import {
  getAllFeeStatements,
} from "@/services/fee-statement-service";

import {
  recordVerifiedPayment,
} from "@/services/payment-service";

import { colors } from "@/theme/colors";

import type {
  FeeStatement,
} from "@/types/school";

type ManualPaymentMethod =
  | "eft"
  | "cash"
  | "card";

function getMethodLabel(
  method: ManualPaymentMethod,
): string {
  switch (method) {
    case "eft":
      return "EFT";

    case "cash":
      return "Cash";

    case "card":
      return "Card";
  }
}

export default function RecordPaymentScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [
    statements,
    setStatements,
  ] = useState<FeeStatement[]>([]);

  const [
    selectedStatementId,
    setSelectedStatementId,
  ] = useState("");

  const [amount, setAmount] =
    useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<ManualPaymentMethod>(
      "eft",
    );

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState(
    "School fee payment",
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    getAllFeeStatements()
      .then((loadedStatements) => {
        if (!isMounted) {
          return;
        }

        const payableStatements =
          loadedStatements.filter(
            (statement) =>
              statement.status !==
                "cancelled" &&
              statement.status !==
                "paid" &&
              statement.amountDue > 0,
          );

        setStatements(
          payableStatements,
        );

        setErrorMessage("");
      })
      .catch((error: unknown) => {
        console.error(
          "Unable to load payable statements:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "The payable statements could not be loaded. Check your connection and permissions.",
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
  }, []);

  const selectedStatement =
    useMemo(
      () =>
        statements.find(
          (statement) =>
            statement.id ===
            selectedStatementId,
        ) ?? null,
      [
        selectedStatementId,
        statements,
      ],
    );

  const selectStatement = (
    statement: FeeStatement,
  ) => {
    setSelectedStatementId(
      statement.id,
    );

    setAmount(
      String(statement.amountDue),
    );

    setPaymentMethod("eft");
    setPaymentReference("");
    setDescription(
      `Payment for ${statement.statementNumber}`,
    );
    setErrorMessage("");
  };

  const selectPaymentMethod = (
    method: ManualPaymentMethod,
  ) => {
    setPaymentMethod(method);

    if (method === "cash") {
      setPaymentReference(
        "Cash payment received by school",
      );
    } else {
      setPaymentReference("");
    }

    setErrorMessage("");
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (
      !user ||
      user.role !== "admin"
    ) {
      setErrorMessage(
        "Only an administrator may record a verified payment.",
      );
      return;
    }

    if (!selectedStatement) {
      setErrorMessage(
        "Select a statement first.",
      );
      return;
    }

    const parsedAmount =
      Number(amount.replace(",", "."));

    if (
      !Number.isFinite(
        parsedAmount,
      ) ||
      parsedAmount <= 0
    ) {
      setErrorMessage(
        "Enter a valid payment amount greater than zero.",
      );
      return;
    }

    if (
      parsedAmount >
      selectedStatement.amountDue
    ) {
      setErrorMessage(
        "The payment cannot be greater than the amount due.",
      );
      return;
    }

    if (
      paymentMethod !== "cash" &&
      !paymentReference.trim()
    ) {
      setErrorMessage(
        "Enter the verified bank or card reference.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      await recordVerifiedPayment(
        user.uid,
        {
          learnerId:
            selectedStatement.learnerId,
          parentUid:
            selectedStatement.parentUid,
          statementId:
            selectedStatement.id,
          amount: parsedAmount,
          method: paymentMethod,
          providerReference:
            paymentReference,
          description,
        },
      );

      Alert.alert(
        "Payment recorded",
        `The verified payment of ${formatCurrency(
          parsedAmount,
        )} was recorded successfully.`,
        [
          {
            text: "Done",
            onPress: () =>
              router.replace(
                "/admin/fees",
              ),
          },
        ],
      );
    } catch (error) {
      console.error(
        "Unable to record payment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The payment could not be recorded. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.loadingSafeArea
        }
      >
        <ActivityIndicator
          color={
            colors.textOnPrimary
          }
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Loading payable statements...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ←
            </Text>
          </Pressable>

          <View
            style={
              styles.headerContent
            }
          >
            <Text
              style={styles.eyebrow}
            >
              FEE MANAGEMENT
            </Text>

            <Text style={styles.title}>
              Record payment
            </Text>

            <Text
              style={styles.subtitle}
            >
              Record a payment already
              verified by the school
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View
            style={
              styles.warningCard
            }
          >
            <Text
              style={
                styles.warningTitle
              }
            >
              Verified payments only
            </Text>

            <Text
              style={
                styles.warningText
              }
            >
              Confirm that the funds were
              received by the school
              before recording this
              payment.
            </Text>
          </View>

          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={
                styles.errorCard
              }
            >
              <Text
                style={
                  styles.errorText
                }
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Text
            style={
              styles.sectionTitle
            }
          >
            1. Select statement
          </Text>

          {statements.length === 0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No payable statements
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                All issued statements are
                paid, cancelled or have no
                amount due.
              </Text>
            </View>
          ) : (
            statements.map(
              (statement) => {
                const isSelected =
                  statement.id ===
                  selectedStatementId;

                return (
                  <Pressable
                    key={statement.id}
                    accessibilityRole="button"
                    onPress={() =>
                      selectStatement(
                        statement,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.statementCard,
                      isSelected &&
                        styles.statementCardSelected,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <View
                      style={
                        styles.statementContent
                      }
                    >
                      <Text
                        style={
                          styles.learnerName
                        }
                      >
                        {
                          statement.learnerFirstName
                        }{" "}
                        {
                          statement.learnerLastName
                        }
                      </Text>

                      <Text
                        style={
                          styles.statementNumber
                        }
                      >
                        {
                          statement.statementNumber
                        }
                      </Text>

                      <Text
                        style={
                          styles.statementMeta
                        }
                      >
                        {statement.gradeName} ·
                        Due{" "}
                        {formatFeeDate(
                          statement.dueDate,
                          "date unavailable",
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.amountContainer
                      }
                    >
                      <Text
                        style={
                          styles.amountLabel
                        }
                      >
                        AMOUNT DUE
                      </Text>

                      <Text
                        style={
                          styles.amountDue
                        }
                      >
                        {formatCurrency(
                          statement.amountDue,
                        )}
                      </Text>
                    </View>
                  </Pressable>
                );
              },
            )
          )}

          {selectedStatement ? (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                2. Payment details
              </Text>

              <Text
                style={styles.label}
              >
                Payment method
              </Text>

              <View
                style={
                  styles.methodRow
                }
              >
                {(
                  [
                    "eft",
                    "cash",
                    "card",
                  ] as ManualPaymentMethod[]
                ).map((method) => {
                  const isSelected =
                    paymentMethod ===
                    method;

                  return (
                    <Pressable
                      key={method}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked:
                          isSelected,
                      }}
                      onPress={() =>
                        selectPaymentMethod(
                          method,
                        )
                      }
                      style={[
                        styles.methodButton,
                        isSelected &&
                          styles.methodButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          isSelected &&
                            styles.methodTextSelected,
                        ]}
                      >
                        {getMethodLabel(
                          method,
                        )}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={styles.label}
              >
                Payment amount (ZAR)
              </Text>

              <TextInput
                accessibilityLabel="Payment amount"
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={amount}
              />

              <Text
                style={styles.label}
              >
                {paymentMethod === "cash"
                  ? "Receipt or cash reference"
                  : "Bank or card reference"}
              </Text>

              <TextInput
                accessibilityLabel="Payment reference"
                autoCapitalize="characters"
                onChangeText={
                  setPaymentReference
                }
                placeholder={
                  paymentMethod === "cash"
                    ? "Cash payment reference"
                    : "Verified transaction reference"
                }
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={
                  paymentReference
                }
              />

              <Text
                style={styles.label}
              >
                Description
              </Text>

              <TextInput
                accessibilityLabel="Payment description"
                onChangeText={
                  setDescription
                }
                placeholder="School fee payment"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={description}
              />

              <View
                style={
                  styles.summaryCard
                }
              >
                <Text
                  style={
                    styles.summaryEyebrow
                  }
                >
                  PAYMENT SUMMARY
                </Text>

                <Text
                  style={
                    styles.summaryName
                  }
                >
                  {
                    selectedStatement.learnerFirstName
                  }{" "}
                  {
                    selectedStatement.learnerLastName
                  }
                </Text>

                <View
                  style={
                    styles.summaryRow
                  }
                >
                  <Text
                    style={
                      styles.summaryLabel
                    }
                  >
                    Statement balance
                  </Text>

                  <Text
                    style={
                      styles.summaryValue
                    }
                  >
                    {formatCurrency(
                      selectedStatement.amountDue,
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.summaryRow
                  }
                >
                  <Text
                    style={
                      styles.summaryLabel
                    }
                  >
                    Payment
                  </Text>

                  <Text
                    style={
                      styles.paymentValue
                    }
                  >
                    -
                    {formatCurrency(
                      Number(
                        amount.replace(
                          ",",
                          ".",
                        ),
                      ) || 0,
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.summaryRow,
                    styles.remainingRow,
                  ]}
                >
                  <Text
                    style={
                      styles.remainingLabel
                    }
                  >
                    Remaining
                  </Text>

                  <Text
                    style={
                      styles.remainingValue
                    }
                  >
                    {formatCurrency(
                      Math.max(
                        selectedStatement.amountDue -
                          (Number(
                            amount.replace(
                              ",",
                              ".",
                            ),
                          ) || 0),
                        0,
                      ),
                    )}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  busy: isSubmitting,
                  disabled:
                    isSubmitting,
                }}
                disabled={
                  isSubmitting
                }
                onPress={
                  handleSubmit
                }
                style={({
                  pressed,
                }) => [
                  styles.submitButton,
                  pressed &&
                    !isSubmitting &&
                    styles.pressed,
                  isSubmitting &&
                    styles.disabled,
                ]}
              >
                {isSubmitting ? (
                  <View
                    style={
                      styles.loadingRow
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
                        styles.submitText
                      }
                    >
                      Recording payment...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={
                      styles.submitText
                    }
                  >
                    Confirm verified payment
                  </Text>
                )}
              </Pressable>
            </>
          ) : null}
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

  loadingSafeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  loadingText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingBottom: 36,
  },

  header: {
    minHeight: 150,
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.14)",
    borderRadius: 21,
    marginRight: 14,
  },

  backButtonText: {
    color: colors.textOnPrimary,
    fontSize: 25,
    fontWeight: "700",
  },

  headerContent: {
    flex: 1,
    paddingTop: 2,
  },

  eyebrow: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  title: {
    color: colors.textOnPrimary,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 7,
  },

  subtitle: {
    color: colors.primaryLight,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 18,
  },

  warningCard: {
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#EBD5A2",
    borderRadius: 15,
    marginTop: 20,
    padding: 14,
  },

  warningTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  warningText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  errorCard: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    marginTop: 12,
    padding: 13,
  },

  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 11,
  },

  statementCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 10,
    padding: 15,
  },

  statementCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor:
      colors.primaryLight,
  },

  statementContent: {
    flex: 1,
    paddingRight: 10,
  },

  learnerName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  statementNumber: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },

  statementMeta: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },

  amountContainer: {
    alignItems: "flex-end",
  },

  amountLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
  },

  amountDue: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 17,
    marginBottom: 7,
  },

  methodRow: {
    flexDirection: "row",
    gap: 9,
  },

  methodButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
  },

  methodButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  methodText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },

  methodTextSelected: {
    color: colors.textOnPrimary,
  },

  input: {
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  summaryCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
    marginTop: 22,
    padding: 17,
  },

  summaryEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  summaryName: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
  },

  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  summaryValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  paymentValue: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
  },

  remainingRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 13,
    paddingTop: 12,
  },

  remainingLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },

  remainingValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  submitButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 15,
    marginTop: 20,
    paddingHorizontal: 18,
  },

  submitText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  disabled: {
    opacity: 0.65,
  },
});