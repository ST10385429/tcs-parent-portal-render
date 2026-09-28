import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useRouter,
} from "expo-router";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  formatCurrency,
  formatFeeDate,
} from "@/services/fee-service";

import { colors } from "@/theme/colors";

import type {
  FeeStructure,
} from "@/types/school";

export default function AdminFeesScreen() {
  const router = useRouter();

  const openIssueStatement = (
    learnerId?: string,
  ) => {
    router.push({
      pathname: "/admin/issue-statement",
      params: learnerId
        ? { learnerId }
        : {},
    });
  };

  const openRecordPayment = (
    learnerId?: string,
  ) => {
    router.push({
      pathname: "/admin/record-payment",
      params: learnerId
        ? { learnerId }
        : {},
    });
  };

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

  const [isLoading, setIsLoading] =
    useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const loadFeeData = useCallback(
    async () => {
      const [overviews, structures] =
        await Promise.all([
          getAdminLearnerFeeOverviews(),
          getFeeStructures(),
        ]);

      setLearnerOverviews(overviews);
      setFeeStructures(structures);
      setErrorMessage("");
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getAdminLearnerFeeOverviews(),
      getFeeStructures(),
    ])
      .then(
        ([
          loadedOverviews,
          loadedStructures,
        ]) => {
          if (!isMounted) {
            return;
          }

          setLearnerOverviews(
            loadedOverviews,
          );
          setFeeStructures(
            loadedStructures,
          );
          setErrorMessage("");
        },
      )
      .catch((error: unknown) => {
        console.error(
          "Unable to load administrator fee information:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "The fee information could not be loaded. Check your connection and permissions, then try again.",
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

  const handleRefresh =
    useCallback(async () => {
      if (isRefreshing) {
        return;
      }

      try {
        setIsRefreshing(true);
        await loadFeeData();
      } catch (error) {
        console.error(
          "Unable to refresh administrator fee information:",
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
      loadFeeData,
    ]);

  const summary = useMemo(() => {
    const accounts =
      learnerOverviews
        .map(
          (overview) =>
            overview.feeAccount,
        )
        .filter(
          (
            account,
          ): account is NonNullable<
            typeof account
          > => account !== null,
        );

    return {
      totalLearners:
        learnerOverviews.length,
      outstandingAccounts:
        accounts.filter(
          (account) =>
            account.status ===
            "outstanding",
        ).length,
      upToDateAccounts:
        accounts.filter(
          (account) =>
            account.status ===
            "upToDate",
        ).length,
      currentBalance:
        accounts.reduce(
          (total, account) =>
            total +
            account.currentBalance,
          0,
        ),
    };
  }, [learnerOverviews]);

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.loadingSafeArea}
      >
        <ActivityIndicator
          color={
            colors.textOnPrimary
          }
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading fee accounts...
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
            <Text style={styles.eyebrow}>
              ADMINISTRATION
            </Text>

            <Text style={styles.title}>
              Fee management
            </Text>

            <Text
              style={styles.subtitle}
            >
              Review structures and learner
              account balances
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {errorMessage ? (
            <View
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

              <Pressable
                accessibilityRole="button"
                onPress={
                  handleRefresh
                }
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            Fee actions
          </Text>

          <View style={styles.actionGrid}>
            <Pressable
              accessibilityHint="Opens the statement issuing screen"
              accessibilityLabel="Issue fee statement"
              accessibilityRole="button"
              onPress={() => openIssueStatement()}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={colors.buttonText}
                name="receipt-outline"
                size={22}
              />

              <View style={styles.actionTextContainer}>
                <Text style={styles.primaryActionTitle}>
                  Issue fee statement
                </Text>

                <Text style={styles.primaryActionText}>
                  Create an official learner charge
                </Text>
              </View>

              <Ionicons
                color={colors.buttonText}
                name="chevron-forward"
                size={20}
              />
            </Pressable>

            <Pressable
              accessibilityHint="Opens the verified payment screen"
              accessibilityLabel="Record verified payment"
              accessibilityRole="button"
              onPress={() => openRecordPayment()}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={colors.buttonText}
                name="card-outline"
                size={22}
              />

              <View style={styles.actionTextContainer}>
                <Text style={styles.primaryActionTitle}>
                  Record payment
                </Text>

                <Text style={styles.primaryActionText}>
                  Capture a verified school payment
                </Text>
              </View>

              <Ionicons
                color={colors.buttonText}
                name="chevron-forward"
                size={20}
              />
            </Pressable>
          </View>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Account overview
          </Text>

          <View
            style={styles.statsGrid}
          >
            <View
              style={styles.statCard}
            >
              <Text
                style={styles.statValue}
              >
                {
                  summary.totalLearners
                }
              </Text>

              <Text
                style={styles.statLabel}
              >
                ACTIVE LEARNERS
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                style={styles.statValue}
              >
                {
                  summary.upToDateAccounts
                }
              </Text>

              <Text
                style={styles.statLabel}
              >
                UP TO DATE
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                style={[
                  styles.statValue,
                  styles.outstandingValue,
                ]}
              >
                {
                  summary.outstandingAccounts
                }
              </Text>

              <Text
                style={styles.statLabel}
              >
                OUTSTANDING
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[
                  styles.statValue,
                  styles.balanceValue,
                ]}
              >
                {formatCurrency(
                  summary.currentBalance,
                )}
              </Text>

              <Text
                style={styles.statLabel}
              >
                TOTAL BALANCE
              </Text>
            </View>
          </View>

          <View
            style={
              styles.sectionHeadingRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Fee structures
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                feeStructures.length
              }
            </Text>
          </View>

          {feeStructures.length ===
          0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No fee structures found
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Add the official fee
                structures in Firebase
                before issuing statements.
              </Text>
            </View>
          ) : (
            feeStructures.map(
              (structure) => (
                <View
                  key={structure.id}
                  style={
                    styles.structureCard
                  }
                >
                  <View
                    style={
                      styles.cardTopRow
                    }
                  >
                    <View
                      style={
                        styles.flexContent
                      }
                    >
                      <Text
                        style={
                          styles.cardTitle
                        }
                      >
                        {
                          structure.gradeBand
                        }
                      </Text>

                      <Text
                        style={
                          styles.cardSubtitle
                        }
                      >
                        {
                          structure.academicYear
                        }{" "}
                        fee structure
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        structure.status ===
                        "active"
                          ? styles.activeBadge
                          : styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={
                          styles.statusBadgeText
                        }
                      >
                        {structure.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.amountRow
                    }
                  >
                    <View
                      style={
                        styles.amountColumn
                      }
                    >
                      <Text
                        style={
                          styles.amountLabel
                        }
                      >
                        Registration
                      </Text>

                      <Text
                        style={
                          styles.amountValue
                        }
                      >
                        {formatCurrency(
                          structure.registrationFee,
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.amountColumn
                      }
                    >
                      <Text
                        style={
                          styles.amountLabel
                        }
                      >
                        Monthly
                      </Text>

                      <Text
                        style={
                          styles.amountValue
                        }
                      >
                        {formatCurrency(
                          structure.monthlyTuition,
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.amountColumn
                      }
                    >
                      <Text
                        style={
                          styles.amountLabel
                        }
                      >
                        Annual
                      </Text>

                      <Text
                        style={
                          styles.amountValue
                        }
                      >
                        {formatCurrency(
                          structure.annualTotal,
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              ),
            )
          )}

          <View
            style={
              styles.sectionHeadingRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Learner accounts
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {
                learnerOverviews.length
              }
            </Text>
          </View>

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
                No learners found
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Active learners will
                appear here once they
                have been created.
              </Text>
            </View>
          ) : (
            learnerOverviews.map(
              ({
                learner,
                feeAccount,
              }) => {
                const learnerName =
                  `${learner.firstName} ${learner.lastName}`.trim();

                const gradeName =
                  learner.schoolClass
                    ?.name ||
                  `Grade ${learner.currentGradeNumber}`;

                return (
                  <Pressable
                    key={learner.id}
                    accessibilityHint="Opens statement issuing for this learner"
                    accessibilityLabel={`Open fee account for ${learnerName}`}
                    accessibilityRole="button"
                    onPress={() =>
                      openIssueStatement(
                        learner.id,
                      )
                    }
                    style={({ pressed }) => [
                      styles.accountCard,
                      pressed && styles.accountCardPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.cardTopRow
                      }
                    >
                      <View
                        style={
                          styles.avatar
                        }
                      >
                        <Text
                          style={
                            styles.avatarText
                          }
                        >
                          {learner.firstName
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.accountIdentity
                        }
                      >
                        <Text
                          style={
                            styles.cardTitle
                          }
                        >
                          {learnerName ||
                            "Unnamed learner"}
                        </Text>

                        <Text
                          style={
                            styles.cardSubtitle
                          }
                        >
                          {gradeName} ·{" "}
                          {
                            learner.studentNumber
                          }
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          feeAccount?.status ===
                          "upToDate"
                            ? styles.activeBadge
                            : styles.outstandingBadge,
                        ]}
                      >
                        <Text
                          style={
                            styles.statusBadgeText
                          }
                        >
                          {feeAccount?.status ===
                          "upToDate"
                            ? "UP TO DATE"
                            : feeAccount
                              ? "OUTSTANDING"
                              : "NO ACCOUNT"}
                        </Text>
                      </View>
                    </View>

                    {feeAccount ? (
                      <>
                        <View
                          style={
                            styles.accountBalanceRow
                          }
                        >
                          <View>
                            <Text
                              style={
                                styles.amountLabel
                              }
                            >
                              Current balance
                            </Text>

                            <Text
                              style={
                                styles.accountBalance
                              }
                            >
                              {formatCurrency(
                                feeAccount.currentBalance,
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.rightAligned
                            }
                          >
                            <Text
                              style={
                                styles.amountLabel
                              }
                            >
                              Overdue
                            </Text>

                            <Text
                              style={
                                styles.overdueBalance
                              }
                            >
                              {formatCurrency(
                                feeAccount.overdueBalance,
                              )}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={
                            styles.statementDate
                          }
                        >
                          Last statement:{" "}
                          {formatFeeDate(
                            feeAccount.lastStatementAt,
                            "Not issued yet",
                          )}
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={
                          styles.noAccountText
                        }
                      >
                        A fee account has
                        not yet been
                        created for this
                        learner.
                      </Text>
                    )}

                    <View style={styles.accountActionRow}>
                      <Text style={styles.accountActionText}>
                        Open learner fee actions
                      </Text>

                      <Ionicons
                        color={colors.burgundyDark}
                        name="arrow-forward"
                        size={18}
                      />
                    </View>
                  </Pressable>
                );
              },
            )
          )}

          <View
            style={
              styles.informationCard
            }
          >
            <Text
              style={
                styles.informationEyebrow
              }
            >
              NEXT STEP
            </Text>

            <Text
              style={
                styles.informationTitle
              }
            >
              Statement issuing
            </Text>

            <Text
              style={
                styles.informationText
              }
            >
              Select a learner account to
              issue a statement for that
              learner, or use the fee
              actions above to issue a
              statement or record a
              verified payment.
            </Text>
          </View>
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
    paddingBottom: 34,
  },

  header: {
    minHeight: 154,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
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
    lineHeight: 18,
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
    fontSize: 18,
    fontWeight: "800",
    marginTop: 25,
    marginBottom: 12,
  },

  actionGrid: {
    gap: 10,
  },

  primaryAction: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.buttonPrimary,
    borderRadius: 17,
    paddingHorizontal: 17,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  actionTextContainer: {
    flex: 1,
    marginHorizontal: 13,
  },

  primaryActionTitle: {
    color: colors.buttonText,
    fontSize: 14,
    fontWeight: "800",
  },

  primaryActionText: {
    color: colors.burgundyLight,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionCount: {
    minWidth: 30,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    marginTop: 13,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statCard: {
    width: "48%",
    minHeight: 102,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 15,
  },

  statValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },

  outstandingValue: {
    color: colors.error,
  },

  balanceValue: {
    fontSize: 20,
  },

  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: 6,
  },

  structureCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginBottom: 11,
    padding: 16,
  },

  accountCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginBottom: 11,
    padding: 16,
  },

  accountCardPressed: {
    borderColor: colors.burgundy,
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  accountActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 13,
    paddingTop: 12,
  },

  accountActionText: {
    color: colors.burgundyDark,
    fontSize: 11,
    fontWeight: "800",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  flexContent: {
    flex: 1,
  },

  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  statusBadge: {
    borderRadius: 12,
    marginLeft: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  activeBadge: {
    backgroundColor: "#E4F5E9",
  },

  inactiveBadge: {
    backgroundColor: "#ECECEC",
  },

  outstandingBadge: {
    backgroundColor: "#FDECEC",
  },

  statusBadgeText: {
    color: colors.textPrimary,
    fontSize: 8,
    fontWeight: "800",
  },

  amountRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },

  amountColumn: {
    flex: 1,
  },

  amountLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },

  amountValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },

  avatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 21,
    marginRight: 11,
  },

  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },

  accountIdentity: {
    flex: 1,
  },

  accountBalanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },

  accountBalance: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },

  overdueBalance: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },

  rightAligned: {
    alignItems: "flex-end",
  },

  statementDate: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 11,
  },

  noAccountText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 24,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },

  errorCard: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 15,
    marginTop: 20,
    padding: 15,
  },

  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  retryButton: {
    alignItems: "center",
    backgroundColor: colors.error,
    borderRadius: 11,
    marginTop: 12,
    paddingVertical: 10,
  },

  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },

  informationCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    marginTop: 16,
    padding: 18,
  },

  informationEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  informationTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 7,
  },

  informationText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  pressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },
});
