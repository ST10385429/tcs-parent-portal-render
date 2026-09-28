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

import {
  getAdminLearnerFeeOverviews,
  getFeeStructures,
  type AdminLearnerFeeOverview,
} from "@/services/admin-fee-service";

import {
  issueFeeStatement,
} from "@/services/fee-statement-service";

import {
  formatCurrency,
} from "@/services/fee-service";

import { useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";

import type {
  FeeStructure,
} from "@/types/school";

type ChargeType =
  | "monthly"
  | "registration";

function getMonthName(
  date: Date,
): string {
  return date.toLocaleDateString(
    "en-ZA",
    {
      month: "long",
      year: "numeric",
    },
  );
}

function createPeriodDates(
  paymentDueDay: number,
): {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
} {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth();

  const safeDueDay = Math.min(
    Math.max(
      paymentDueDay,
      1,
    ),
    28,
  );

  const periodStart = new Date(
    year,
    month,
    1,
    12,
  );

  const periodEnd = new Date(
    year,
    month + 1,
    0,
    12,
  );

  let dueDate = new Date(
    year,
    month,
    safeDueDay,
    12,
  );

  /*
   * A statement must never be issued with a due date
   * that has already passed. When the configured due
   * day has passed, use that day in the next month.
   */
  if (dueDate < now) {
    dueDate = new Date(
      year,
      month + 1,
      safeDueDay,
      12,
    );
  }

  return {
    periodStart,
    periodEnd,
    dueDate,
  };
}

export default function IssueStatementScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [
    learnerOverviews,
    setLearnerOverviews,
  ] = useState<
    AdminLearnerFeeOverview[]
  >([]);

  const [
    feeStructures,
    setFeeStructures,
  ] = useState<FeeStructure[]>([]);

  const [
    selectedLearnerId,
    setSelectedLearnerId,
  ] = useState("");

  const [
    selectedStructureId,
    setSelectedStructureId,
  ] = useState("");

  const [chargeType, setChargeType] =
    useState<ChargeType>("monthly");

  const [amount, setAmount] =
    useState("");

  const [
    discountAmount,
    setDiscountAmount,
  ] = useState("0");

  const [notes, setNotes] =
    useState("");

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

    Promise.all([
      getAdminLearnerFeeOverviews(),
      getFeeStructures(),
    ])
      .then(
        ([
          loadedLearners,
          loadedStructures,
        ]) => {
          if (!isMounted) {
            return;
          }

          setLearnerOverviews(
            loadedLearners,
          );

          setFeeStructures(
            loadedStructures.filter(
              (structure) =>
                structure.status ===
                "active",
            ),
          );

          setErrorMessage("");
        },
      )
      .catch((error: unknown) => {
        console.error(
          "Unable to load statement form:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "The statement form could not be loaded. Check your connection and permissions.",
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

  const selectedOverview =
    useMemo(
      () =>
        learnerOverviews.find(
          (overview) =>
            overview.learner.id ===
            selectedLearnerId,
        ) ?? null,
      [
        learnerOverviews,
        selectedLearnerId,
      ],
    );

  const selectedStructure =
    useMemo(
      () =>
        feeStructures.find(
          (structure) =>
            structure.id ===
            selectedStructureId,
        ) ?? null,
      [
        feeStructures,
        selectedStructureId,
      ],
    );

  const statementDates =
    useMemo(
      () =>
        createPeriodDates(
          selectedStructure
            ?.paymentDueDay ?? 3,
        ),
      [selectedStructure],
    );

  const selectLearner = (
    overview: AdminLearnerFeeOverview,
  ) => {
    const gradeCode = String(
      overview.learner
        .currentGradeNumber,
    );

    const matchingStructure =
      feeStructures.find(
        (structure) =>
          structure.status ===
            "active" &&
          structure.gradeCodes.includes(
            gradeCode,
          ),
      );

    setSelectedLearnerId(
      overview.learner.id,
    );

    setSelectedStructureId(
      matchingStructure?.id ?? "",
    );

    setChargeType("monthly");

    setAmount(
      matchingStructure
        ? String(
            matchingStructure.monthlyTuition,
          )
        : "",
    );

    setDiscountAmount("0");
    setNotes("");
    setErrorMessage("");
  };

  const selectStructure = (
    structure: FeeStructure,
  ) => {
    setSelectedStructureId(
      structure.id,
    );

    setChargeType("monthly");

    setAmount(
      String(
        structure.monthlyTuition,
      ),
    );

    setErrorMessage("");
  };

  const selectChargeType = (
    type: ChargeType,
  ) => {
    setChargeType(type);

    if (!selectedStructure) {
      setAmount("");
      return;
    }

    setAmount(
      String(
        type === "monthly"
          ? selectedStructure.monthlyTuition
          : selectedStructure.registrationFee,
      ),
    );
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
        "Only an administrator may issue a statement.",
      );
      return;
    }

    if (!selectedOverview) {
      setErrorMessage(
        "Select a learner first.",
      );
      return;
    }

    if (!selectedStructure) {
      setErrorMessage(
        "Select the correct fee structure.",
      );
      return;
    }

    const parsedAmount =
      Number(amount.replace(",", "."));

    const parsedDiscount =
      Number(
        discountAmount.replace(
          ",",
          ".",
        ),
      );

    if (
      !Number.isFinite(
        parsedAmount,
      ) ||
      parsedAmount <= 0
    ) {
      setErrorMessage(
        "Enter a valid charge amount greater than zero.",
      );
      return;
    }

    if (
      !Number.isFinite(
        parsedDiscount,
      ) ||
      parsedDiscount < 0
    ) {
      setErrorMessage(
        "Enter a valid discount amount.",
      );
      return;
    }

    if (
      parsedDiscount >
      parsedAmount
    ) {
      setErrorMessage(
        "The discount cannot be greater than the charge.",
      );
      return;
    }

    const learner =
      selectedOverview.learner;

    const chargeDescription =
      chargeType === "monthly"
        ? `${getMonthName(new Date())} Tuition Fee`
        : `${selectedStructure.academicYear} Registration Fee`;

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      await issueFeeStatement(
        user.uid,
        {
          learnerId: learner.id,
          feeStructureId:
            selectedStructure.id,
          academicYear:
            selectedStructure.academicYear,
          learnerFirstName:
            learner.firstName,
          learnerLastName:
            learner.lastName,
          studentNumber:
            learner.studentNumber,
          gradeName:
            learner.schoolClass
              ?.name ||
            selectedStructure.gradeBand,
          description:
            chargeDescription,
          amount: parsedAmount,
          discountAmount:
            parsedDiscount,
          periodStart:
            statementDates.periodStart,
          periodEnd:
            statementDates.periodEnd,
          dueDate:
            statementDates.dueDate,
          notes,
        },
      );

      Alert.alert(
        "Statement issued",
        `The statement for ${learner.firstName} ${learner.lastName} was saved successfully.`,
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
        "Unable to issue fee statement:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The statement could not be issued. Try again.",
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
          Loading statement form...
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
              styles.headerTextContainer
            }
          >
            <Text
              style={styles.eyebrow}
            >
              FEE MANAGEMENT
            </Text>

            <Text style={styles.title}>
              Issue statement
            </Text>

            <Text
              style={styles.subtitle}
            >
              Create an official learner
              fee statement
            </Text>
          </View>
        </View>

        <View style={styles.content}>
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
            1. Select learner
          </Text>

          {learnerOverviews.length ===
          0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No active learners found
              </Text>
            </View>
          ) : (
            learnerOverviews.map(
              (overview) => {
                const learner =
                  overview.learner;

                const isSelected =
                  learner.id ===
                  selectedLearnerId;

                return (
                  <Pressable
                    key={learner.id}
                    accessibilityRole="button"
                    onPress={() =>
                      selectLearner(
                        overview,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.optionCard,
                      isSelected &&
                        styles.optionCardSelected,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <View
                      style={
                        styles.optionText
                      }
                    >
                      <Text
                        style={
                          styles.optionTitle
                        }
                      >
                        {learner.firstName}{" "}
                        {learner.lastName}
                      </Text>

                      <Text
                        style={
                          styles.optionSubtitle
                        }
                      >
                        {learner.schoolClass
                          ?.name ||
                          `Grade ${learner.currentGradeNumber}`}{" "}
                        ·{" "}
                        {
                          learner.studentNumber
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        isSelected &&
                          styles.radioSelected,
                      ]}
                    >
                      {isSelected ? (
                        <View
                          style={
                            styles.radioDot
                          }
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              },
            )
          )}

          {selectedOverview ? (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                2. Select fee structure
              </Text>

              {feeStructures.map(
                (structure) => {
                  const isSelected =
                    structure.id ===
                    selectedStructureId;

                  return (
                    <Pressable
                      key={structure.id}
                      accessibilityRole="button"
                      onPress={() =>
                        selectStructure(
                          structure,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.optionCard,
                        isSelected &&
                          styles.optionCardSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.optionText
                        }
                      >
                        <Text
                          style={
                            styles.optionTitle
                          }
                        >
                          {
                            structure.gradeBand
                          }{" "}
                          ·{" "}
                          {
                            structure.academicYear
                          }
                        </Text>

                        <Text
                          style={
                            styles.optionSubtitle
                          }
                        >
                          Monthly{" "}
                          {formatCurrency(
                            structure.monthlyTuition,
                          )}{" "}
                          · Registration{" "}
                          {formatCurrency(
                            structure.registrationFee,
                          )}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radio,
                          isSelected &&
                            styles.radioSelected,
                        ]}
                      >
                        {isSelected ? (
                          <View
                            style={
                              styles.radioDot
                            }
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                },
              )}
            </>
          ) : null}

          {selectedStructure ? (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                3. Statement charge
              </Text>

              <View
                style={
                  styles.segmentedControl
                }
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    selectChargeType(
                      "monthly",
                    )
                  }
                  style={[
                    styles.segmentButton,
                    chargeType ===
                      "monthly" &&
                      styles.segmentButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      chargeType ===
                        "monthly" &&
                        styles.segmentTextSelected,
                    ]}
                  >
                    Monthly tuition
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    selectChargeType(
                      "registration",
                    )
                  }
                  style={[
                    styles.segmentButton,
                    chargeType ===
                      "registration" &&
                      styles.segmentButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      chargeType ===
                        "registration" &&
                        styles.segmentTextSelected,
                    ]}
                  >
                    Registration
                  </Text>
                </Pressable>
              </View>

              <Text
                style={styles.label}
              >
                Charge amount (ZAR)
              </Text>

              <TextInput
                accessibilityLabel="Charge amount"
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
                Discount amount (optional)
              </Text>

              <TextInput
                accessibilityLabel="Discount amount"
                keyboardType="decimal-pad"
                onChangeText={
                  setDiscountAmount
                }
                placeholder="0.00"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={discountAmount}
              />

              <Text
                style={styles.label}
              >
                Administrator notes
              </Text>

              <TextInput
                accessibilityLabel="Administrator notes"
                multiline
                onChangeText={setNotes}
                placeholder="Optional notes for the parent"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={[
                  styles.input,
                  styles.notesInput,
                ]}
                textAlignVertical="top"
                value={notes}
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
                  STATEMENT SUMMARY
                </Text>

                <Text
                  style={
                    styles.summaryTitle
                  }
                >
                  {selectedOverview
                    ?.learner.firstName}{" "}
                  {selectedOverview
                    ?.learner.lastName}
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
                    Existing balance
                  </Text>

                  <Text
                    style={
                      styles.summaryValue
                    }
                  >
                    {formatCurrency(
                      selectedOverview
                        ?.feeAccount
                        ?.currentBalance ??
                        0,
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
                    New charge
                  </Text>

                  <Text
                    style={
                      styles.summaryValue
                    }
                  >
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
                  style={
                    styles.summaryRow
                  }
                >
                  <Text
                    style={
                      styles.summaryLabel
                    }
                  >
                    Discount
                  </Text>

                  <Text
                    style={
                      styles.summaryValue
                    }
                  >
                    -
                    {formatCurrency(
                      Number(
                        discountAmount.replace(
                          ",",
                          ".",
                        ),
                      ) || 0,
                    )}
                  </Text>
                </View>

                <Text
                  style={
                    styles.dueDateText
                  }
                >
                  Payment due by{" "}
                  {statementDates.dueDate.toLocaleDateString(
                    "en-ZA",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </Text>
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
                      Issuing statement...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={
                      styles.submitText
                    }
                  >
                    Issue statement
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
    alignItems: "flex-start",
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
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 21,
    marginRight: 14,
  },

  backButtonText: {
    color: colors.textOnPrimary,
    fontSize: 25,
    fontWeight: "700",
  },

  headerTextContainer: {
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
    marginTop: 5,
  },

  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 18,
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 11,
  },

  optionCard: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginBottom: 10,
    padding: 15,
  },

  optionCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  optionText: {
    flex: 1,
    paddingRight: 12,
  },

  optionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  optionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 11,
  },

  radioSelected: {
    borderColor: colors.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    backgroundColor: colors.primary,
    borderRadius: 5,
  },

  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 4,
  },

  segmentButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },

  segmentButtonSelected: {
    backgroundColor: colors.primary,
  },

  segmentText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  segmentTextSelected: {
    color: colors.textOnPrimary,
  },

  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 17,
    marginBottom: 7,
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

  notesInput: {
    minHeight: 100,
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

  summaryTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
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

  dueDateText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 12,
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

  errorCard: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    marginTop: 20,
    padding: 14,
  },

  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 22,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
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
