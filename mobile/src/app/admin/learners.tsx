import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  createLearner,
  getActiveClassesForLearners,
  getAllLearnersForAdmin,
  setLearnerStatus,
  updateLearner,
} from "@/services/admin-learner-service";
import { colors } from "@/theme/colors";
import type {
  Learner,
  SchoolClass,
} from "@/types/school";

type LearnerFilter =
  | "all"
  | "active"
  | "inactive";

const BURGUNDY = "#7A1632";
const BURGUNDY_DARK = "#591025";
const SOFT_YELLOW = "#F5D77A";

function getLearnerName(
  learner: Learner,
): string {
  return `${learner.firstName} ${learner.lastName}`.trim();
}

function getClassLabel(
  schoolClass: SchoolClass,
): string {
  const year =
    schoolClass.academicYear > 0
      ? ` · ${schoolClass.academicYear}`
      : "";

  return `${schoolClass.name}${year}`;
}

export default function ManageLearnersScreen() {
  const router = useRouter();

  const [learners, setLearners] = useState<
    Learner[]
  >([]);

  const [classes, setClasses] = useState<
    SchoolClass[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [selectedFilter, setSelectedFilter] =
    useState<LearnerFilter>("all");

  const [formVisible, setFormVisible] =
    useState(false);

  const [editingLearner, setEditingLearner] =
    useState<Learner | null>(null);

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [studentNumber, setStudentNumber] =
    useState("");

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState("");

  const loadData = useCallback(
    async (refreshing = false) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [
          loadedLearners,
          loadedClasses,
        ] = await Promise.all([
          getAllLearnersForAdmin(),
          getActiveClassesForLearners(),
        ]);

        setLearners(loadedLearners);
        setClasses(loadedClasses);
      } catch (error) {
        console.error(
          "Unable to load learners:",
          error,
        );

        Alert.alert(
          "Unable to load learners",
          error instanceof Error
            ? error.message
            : "The learner information could not be loaded.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const filteredLearners = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return learners.filter((learner) => {
      const matchesFilter =
        selectedFilter === "all" ||
        learner.status === selectedFilter;

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        learner.firstName,
        learner.lastName,
        learner.studentNumber,
        learner.schoolClass?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        normalizedSearch,
      );
    });
  }, [
    learners,
    searchText,
    selectedFilter,
  ]);

  const activeLearnerCount = useMemo(
    () =>
      learners.filter(
        (learner) =>
          learner.status === "active",
      ).length,
    [learners],
  );

  const inactiveLearnerCount =
    learners.length - activeLearnerCount;

  const resetForm = () => {
    setEditingLearner(null);
    setFirstName("");
    setLastName("");
    setStudentNumber("");
    setSelectedClassId("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormVisible(true);
  };

  const handleOpenEdit = (
    learner: Learner,
  ) => {
    setEditingLearner(learner);
    setFirstName(learner.firstName);
    setLastName(learner.lastName);
    setStudentNumber(
      learner.studentNumber,
    );
    setSelectedClassId(
      learner.currentClassId,
    );
    setFormVisible(true);
  };

  const handleCloseForm = () => {
    if (isSaving) {
      return;
    }

    setFormVisible(false);
    resetForm();
  };

  const validateForm = (): string | null => {
    if (firstName.trim().length < 2) {
      return "Enter the learner's first name.";
    }

    if (lastName.trim().length < 2) {
      return "Enter the learner's last name.";
    }

    if (studentNumber.trim().length < 2) {
      return "Enter a valid student number.";
    }

    if (!selectedClassId) {
      return "Select the learner's current class.";
    }

    return null;
  };

  const handleSave = async () => {
    const validationMessage =
      validateForm();

    if (validationMessage) {
      Alert.alert(
        "Check learner details",
        validationMessage,
      );
      return;
    }

    setIsSaving(true);

    try {
      const result = editingLearner
        ? await updateLearner({
            learnerId:
              editingLearner.id,
            firstName,
            lastName,
            studentNumber,
            classId: selectedClassId,
          })
        : await createLearner({
            firstName,
            lastName,
            studentNumber,
            classId: selectedClassId,
          });

      setFormVisible(false);
      resetForm();
      await loadData();

      Alert.alert(
        editingLearner
          ? "Learner updated"
          : "Learner created",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to save learner:",
        error,
      );

      Alert.alert(
        "Unable to save learner",
        error instanceof Error
          ? error.message
          : "The learner could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (
    learner: Learner,
  ) => {
    const isActive =
      learner.status === "active";

    const nextStatus = isActive
      ? "inactive"
      : "active";

    const learnerName =
      getLearnerName(learner);

    Alert.alert(
      isActive
        ? "Deactivate learner?"
        : "Activate learner?",
      isActive
        ? `${learnerName} will no longer appear in active class lists or teacher learner lists.`
        : `${learnerName} will be restored to their current class.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: isActive
            ? "Deactivate"
            : "Activate",
          style: isActive
            ? "destructive"
            : "default",
          onPress: () => {
            void performStatusChange(
              learner,
              nextStatus,
            );
          },
        },
      ],
    );
  };

  const performStatusChange = async (
    learner: Learner,
    status: "active" | "inactive",
  ) => {
    try {
      const result =
        await setLearnerStatus(
          learner.id,
          status,
        );

      await loadData();

      Alert.alert(
        status === "active"
          ? "Learner activated"
          : "Learner deactivated",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to update learner status:",
        error,
      );

      Alert.alert(
        "Unable to update learner",
        error instanceof Error
          ? error.message
          : "The learner status could not be updated.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed &&
                  styles.headerButtonPressed,
              ]}
            >
              <Ionicons
                color={colors.textOnPrimary}
                name="chevron-back"
                size={24}
              />
            </Pressable>

            <View style={styles.headerTextContainer}>
              <Text style={styles.eyebrow}>
                ADMINISTRATION
              </Text>

              <Text style={styles.headerTitle}>
                Manage Learners
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Add learner"
              accessibilityRole="button"
              onPress={handleOpenCreate}
              style={({ pressed }) => [
                styles.addHeaderButton,
                pressed &&
                  styles.headerButtonPressed,
              ]}
            >
              <Ionicons
                color={colors.textOnPrimary}
                name="add"
                size={25}
              />
            </Pressable>
          </View>

          <Text style={styles.headerSubtitle}>
            Create learner profiles, manage
            enrolments and transfer learners
            between classes.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {learners.length}
              </Text>
              <Text style={styles.statLabel}>
                TOTAL
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {activeLearnerCount}
              </Text>
              <Text style={styles.statLabel}>
                ACTIVE
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {inactiveLearnerCount}
              </Text>
              <Text style={styles.statLabel}>
                INACTIVE
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={20}
            />

            <TextInput
              accessibilityLabel="Search learners"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search name, number or class"
              placeholderTextColor={
                colors.textSecondary
              }
              style={styles.searchInput}
              value={searchText}
            />

            {searchText.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() =>
                  setSearchText("")
                }
              >
                <Ionicons
                  color={colors.textSecondary}
                  name="close-circle"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={
              styles.filterRow
            }
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
          >
            {(
              [
                {
                  label: "All",
                  value: "all",
                },
                {
                  label: "Active",
                  value: "active",
                },
                {
                  label: "Inactive",
                  value: "inactive",
                },
              ] as {
                label: string;
                value: LearnerFilter;
              }[]
            ).map((option) => {
              const isSelected =
                selectedFilter ===
                option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() =>
                    setSelectedFilter(
                      option.value,
                    )
                  }
                  style={[
                    styles.filterButton,
                    isSelected &&
                      styles.filterButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      isSelected &&
                        styles.filterButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator
              color={BURGUNDY}
              size="large"
            />
            <Text style={styles.stateText}>
              Loading learners...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={
              styles.listContent
            }
            refreshControl={
              <RefreshControl
                colors={[BURGUNDY]}
                onRefresh={() =>
                  void loadData(true)
                }
                refreshing={isRefreshing}
                tintColor={BURGUNDY}
              />
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            <View style={styles.listHeadingRow}>
              <Text style={styles.listHeading}>
                {filteredLearners.length}{" "}
                {filteredLearners.length === 1
                  ? "learner"
                  : "learners"}
              </Text>

              <Pressable
                onPress={handleOpenCreate}
                style={({ pressed }) => [
                  styles.compactAddButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Ionicons
                  color={colors.textOnPrimary}
                  name="person-add-outline"
                  size={17}
                />
                <Text
                  style={
                    styles.compactAddButtonText
                  }
                >
                  Add learner
                </Text>
              </Pressable>
            </View>

            {filteredLearners.length ===
            0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    color={BURGUNDY}
                    name="school-outline"
                    size={34}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  No learners found
                </Text>

                <Text style={styles.emptyText}>
                  {searchText
                    ? "Try changing your search or selected filter."
                    : "Create the first learner profile to begin managing enrolments."}
                </Text>

                {!searchText ? (
                  <Pressable
                    onPress={handleOpenCreate}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Create learner
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              filteredLearners.map(
                (learner) => {
                  const isActive =
                    learner.status ===
                    "active";

                  return (
                    <View
                      key={learner.id}
                      style={styles.learnerCard}
                    >
                      <View
                        style={
                          styles.learnerTopRow
                        }
                      >
                        <View
                          style={
                            styles.avatarContainer
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
                            {learner.lastName
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.learnerDetails
                          }
                        >
                          <View
                            style={
                              styles.nameStatusRow
                            }
                          >
                            <Text
                              numberOfLines={1}
                              style={
                                styles.learnerName
                              }
                            >
                              {getLearnerName(
                                learner,
                              )}
                            </Text>

                            <View
                              style={[
                                styles.statusBadge,
                                isActive
                                  ? styles.activeBadge
                                  : styles.inactiveBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  isActive
                                    ? styles.activeText
                                    : styles.inactiveText,
                                ]}
                              >
                                {isActive
                                  ? "ACTIVE"
                                  : "INACTIVE"}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={
                              styles.studentNumber
                            }
                          >
                            Student number:{" "}
                            {learner.studentNumber ||
                              "Not assigned"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.classInformation
                        }
                      >
                        <View
                          style={
                            styles.informationIcon
                          }
                        >
                          <Ionicons
                            color={colors.primary}
                            name="school-outline"
                            size={19}
                          />
                        </View>

                        <View style={styles.flex}>
                          <Text
                            style={
                              styles.informationLabel
                            }
                          >
                            CURRENT CLASS
                          </Text>

                          <Text
                            style={
                              styles.informationValue
                            }
                          >
                            {learner.schoolClass
                              ? getClassLabel(
                                  learner.schoolClass,
                                )
                              : "No class assigned"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.cardActions
                        }
                      >
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            handleOpenEdit(
                              learner,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.secondaryButton,
                            pressed &&
                              styles.secondaryButtonPressed,
                          ]}
                        >
                          <Ionicons
                            color={BURGUNDY}
                            name="create-outline"
                            size={18}
                          />
                          <Text
                            style={
                              styles.secondaryButtonText
                            }
                          >
                            Edit
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            handleStatusChange(
                              learner,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.statusActionButton,
                            isActive
                              ? styles.deactivateButton
                              : styles.activateButton,
                            pressed &&
                              styles.buttonPressed,
                          ]}
                        >
                          <Ionicons
                            color={
                              colors.textOnPrimary
                            }
                            name={
                              isActive
                                ? "pause-circle-outline"
                                : "checkmark-circle-outline"
                            }
                            size={18}
                          />

                          <Text
                            style={
                              styles.statusActionText
                            }
                          >
                            {isActive
                              ? "Deactivate"
                              : "Activate"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                },
              )
            )}

            <View style={styles.bottomSpace} />
          </ScrollView>
        )}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={handleCloseForm}
        presentationStyle="pageSheet"
        visible={formVisible}
      >
        <SafeAreaView
          style={styles.modalSafeArea}
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
            style={styles.flex}
          >
            <View style={styles.modalHeader}>
              <Pressable
                disabled={isSaving}
                onPress={handleCloseForm}
                style={styles.modalHeaderButton}
              >
                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Text style={styles.modalTitle}>
                {editingLearner
                  ? "Edit learner"
                  : "New learner"}
              </Text>

              <View
                style={
                  styles.modalHeaderButton
                }
              />
            </View>

            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <View style={styles.formIntro}>
                <View
                  style={styles.formIntroIcon}
                >
                  <Ionicons
                    color={BURGUNDY}
                    name={
                      editingLearner
                        ? "create-outline"
                        : "person-add-outline"
                    }
                    size={27}
                  />
                </View>

                <View style={styles.flex}>
                  <Text
                    style={styles.formIntroTitle}
                  >
                    {editingLearner
                      ? "Update learner profile"
                      : "Create learner profile"}
                  </Text>

                  <Text
                    style={styles.formIntroText}
                  >
                    {editingLearner
                      ? "Update personal details or transfer the learner to another class."
                      : "Add the learner to the school and enrol them in an active class."}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                PERSONAL INFORMATION
              </Text>

              <Text style={styles.inputLabel}>
                First name
              </Text>

              <TextInput
                autoCapitalize="words"
                editable={!isSaving}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={firstName}
              />

              <Text style={styles.inputLabel}>
                Last name
              </Text>

              <TextInput
                autoCapitalize="words"
                editable={!isSaving}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={lastName}
              />

              <Text style={styles.inputLabel}>
                Student number
              </Text>

              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isSaving}
                onChangeText={setStudentNumber}
                placeholder="Example: TCS2026001"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={studentNumber}
              />

              <Text style={styles.sectionTitle}>
                CLASS ENROLMENT
              </Text>

              <Text style={styles.helperText}>
                Select the learner&apos;s current
                class. Changing this class will
                transfer the learner from their
                previous class.
              </Text>

              {classes.length === 0 ? (
                <View
                  style={
                    styles.noClassesContainer
                  }
                >
                  <Ionicons
                    color={colors.warning}
                    name="alert-circle-outline"
                    size={22}
                  />

                  <Text
                    style={styles.noClassesText}
                  >
                    No active classes are
                    available. Create or activate
                    a class before adding a
                    learner.
                  </Text>
                </View>
              ) : (
                <View style={styles.classList}>
                  {classes.map(
                    (schoolClass) => {
                      const isSelected =
                        selectedClassId ===
                        schoolClass.id;

                      return (
                        <Pressable
                          key={schoolClass.id}
                          disabled={isSaving}
                          onPress={() =>
                            setSelectedClassId(
                              schoolClass.id,
                            )
                          }
                          style={[
                            styles.classOption,
                            isSelected &&
                              styles.classOptionSelected,
                          ]}
                        >
                          <View
                            style={[
                              styles.classOptionIcon,
                              isSelected &&
                                styles.classOptionIconSelected,
                            ]}
                          >
                            <Ionicons
                              color={
                                isSelected
                                  ? colors.textOnPrimary
                                  : colors.primary
                              }
                              name="school-outline"
                              size={20}
                            />
                          </View>

                          <View style={styles.flex}>
                            <Text
                              style={[
                                styles.classOptionName,
                                isSelected &&
                                  styles.classOptionNameSelected,
                              ]}
                            >
                              {schoolClass.name}
                            </Text>

                            <Text
                              style={[
                                styles.classOptionDetails,
                                isSelected &&
                                  styles.classOptionDetailsSelected,
                              ]}
                            >
                              Grade{" "}
                              {
                                schoolClass.gradeNumber
                              }
                              {schoolClass.academicYear >
                              0
                                ? ` · ${schoolClass.academicYear}`
                                : ""}
                            </Text>
                          </View>

                          <Ionicons
                            color={
                              isSelected
                                ? colors.textOnPrimary
                                : colors.border
                            }
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={23}
                          />
                        </Pressable>
                      );
                    },
                  )}
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={
                  isSaving ||
                  classes.length === 0
                }
                onPress={() =>
                  void handleSave()
                }
                style={({ pressed }) => [
                  styles.saveButton,
                  (isSaving ||
                    classes.length === 0) &&
                    styles.disabledButton,
                  pressed &&
                    !isSaving &&
                    styles.buttonPressed,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator
                    color={
                      colors.textOnPrimary
                    }
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      color={
                        colors.textOnPrimary
                      }
                      name={
                        editingLearner
                          ? "save-outline"
                          : "person-add-outline"
                      }
                      size={20}
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      {editingLearner
                        ? "Save changes"
                        : "Create learner"}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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

  flex: {
    flex: 1,
  },

  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor:
      "rgba(255,255,255,0.12)",
  },

  headerButtonPressed: {
    opacity: 0.7,
  },

  headerTextContainer: {
    flex: 1,
    marginHorizontal: 14,
  },

  eyebrow: {
    color: SOFT_YELLOW,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 27,
    fontWeight: "800",
    marginTop: 3,
  },

  addHeaderButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BURGUNDY,
    borderRadius: 14,
  },

  headerSubtitle: {
    color: colors.primaryLight,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      "rgba(255,255,255,0.1)",
    borderRadius: 18,
    marginTop: 18,
    paddingVertical: 14,
  },

  statCard: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: "800",
  },

  statLabel: {
    color: SOFT_YELLOW,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 3,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor:
      "rgba(255,255,255,0.18)",
  },

  searchSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 13,
  },

  searchContainer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  filterRow: {
    gap: 8,
    paddingTop: 12,
  },

  filterButton: {
    minWidth: 82,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  filterButtonTextSelected: {
    color: colors.textOnPrimary,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  stateText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 13,
  },

  listContent: {
    padding: 20,
  },

  listHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  listHeading: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },

  compactAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: BURGUNDY,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  compactAddButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  learnerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 14,
    padding: 17,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  learnerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarContainer: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    marginRight: 13,
  },

  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },

  learnerDetails: {
    flex: 1,
  },

  nameStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  learnerName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },

  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  activeBadge: {
    backgroundColor: "#E2F3E8",
  },

  inactiveBadge: {
    backgroundColor: "#F3E5E5",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  activeText: {
    color: colors.success,
  },

  inactiveText: {
    color: colors.error,
  },

  studentNumber: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },

  classInformation: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    marginTop: 16,
    padding: 12,
  },

  informationIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 11,
    marginRight: 11,
  },

  informationLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  informationValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },

  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: BURGUNDY,
    borderRadius: 13,
  },

  secondaryButtonPressed: {
    backgroundColor: "#F9EEF2",
  },

  secondaryButtonText: {
    color: BURGUNDY,
    fontSize: 13,
    fontWeight: "700",
  },

  statusActionButton: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 13,
  },

  deactivateButton: {
    backgroundColor: BURGUNDY,
  },

  activateButton: {
    backgroundColor: colors.success,
  },

  statusActionText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 42,
  },

  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9EEF2",
    borderRadius: 22,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 17,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },

  primaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BURGUNDY,
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 22,
  },

  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "700",
  },

  buttonPressed: {
    backgroundColor: BURGUNDY_DARK,
    opacity: 0.9,
  },

  bottomSpace: {
    height: 24,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  modalHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
  },

  modalHeaderButton: {
    width: 68,
  },

  modalCancelText: {
    color: BURGUNDY,
    fontSize: 14,
    fontWeight: "700",
  },

  modalTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },

  formContent: {
    padding: 20,
    paddingBottom: 45,
  },

  formIntro: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },

  formIntroIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9EEF2",
    borderRadius: 15,
    marginRight: 13,
  },

  formIntroTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },

  formIntroText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  sectionTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginTop: 27,
    marginBottom: 12,
  },

  inputLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },

  input: {
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 13,
  },

  classList: {
    gap: 10,
  },

  classOption: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  classOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  classOptionIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginRight: 12,
  },

  classOptionIconSelected: {
    backgroundColor:
      "rgba(255,255,255,0.15)",
  },

  classOptionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  classOptionNameSelected: {
    color: colors.textOnPrimary,
  },

  classOptionDetails: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },

  classOptionDetailsSelected: {
    color: colors.primaryLight,
  },

  noClassesContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.accentLight,
    borderRadius: 14,
    padding: 14,
  },

  noClassesText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },

  saveButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: BURGUNDY,
    borderRadius: 16,
    marginTop: 28,
    paddingHorizontal: 20,
  },

  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },
});