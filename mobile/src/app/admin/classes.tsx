import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
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
import {
  SafeAreaView,
} from "react-native-safe-area-context";
import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  createSchoolClass,
  getAllClassesForAdmin,
  setSchoolClassStatus,
  updateSchoolClass,
  type AdminSchoolClass,
} from "@/services/admin-class-service";
import { colors } from "@/theme/colors";

type ClassFilter =
  | "all"
  | "active"
  | "inactive";

const BURGUNDY = "#7A1632";
const BURGUNDY_DARK = "#591025";
const SOFT_YELLOW = "#F5D77A";

export default function ManageClassesScreen() {
  const router = useRouter();

  const [classes, setClasses] = useState<
    AdminSchoolClass[]
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
    useState<ClassFilter>("all");

  const [formVisible, setFormVisible] =
    useState(false);

  const [editingClass, setEditingClass] =
    useState<AdminSchoolClass | null>(
      null,
    );

  const [className, setClassName] =
    useState("");

  const [gradeNumber, setGradeNumber] =
    useState("");

  const [academicYear, setAcademicYear] =
    useState(
      String(new Date().getFullYear()),
    );

  const loadClasses = useCallback(
    async (refreshing = false) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const loadedClasses =
          await getAllClassesForAdmin();

        setClasses(loadedClasses);
      } catch (error) {
        console.error(
          "Unable to load classes:",
          error,
        );

        Alert.alert(
          "Unable to load classes",
          error instanceof Error
            ? error.message
            : "The class information could not be loaded.",
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
      void loadClasses();
    }, [loadClasses]),
  );

  const filteredClasses = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return classes.filter(
      (schoolClass) => {
        const matchesFilter =
          selectedFilter === "all" ||
          schoolClass.status ===
            selectedFilter;

        if (!matchesFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableText = [
          schoolClass.name,
          schoolClass.gradeNumber,
          schoolClass.academicYear,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch,
        );
      },
    );
  }, [
    classes,
    searchText,
    selectedFilter,
  ]);

  const activeClassCount = useMemo(
    () =>
      classes.filter(
        (schoolClass) =>
          schoolClass.status === "active",
      ).length,
    [classes],
  );

  const totalLearnerCount = useMemo(
    () =>
      classes.reduce(
        (total, schoolClass) =>
          total +
          schoolClass.activeLearnerCount,
        0,
      ),
    [classes],
  );

  const resetForm = () => {
    setEditingClass(null);
    setClassName("");
    setGradeNumber("");
    setAcademicYear(
      String(new Date().getFullYear()),
    );
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormVisible(true);
  };

  const handleOpenEdit = (
    schoolClass: AdminSchoolClass,
  ) => {
    setEditingClass(schoolClass);
    setClassName(schoolClass.name);
    setGradeNumber(
      String(schoolClass.gradeNumber),
    );
    setAcademicYear(
      String(schoolClass.academicYear),
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
    const parsedGrade =
      Number(gradeNumber);

    const parsedYear =
      Number(academicYear);

    if (
      className.trim().length < 2
    ) {
      return "Enter a valid class name.";
    }

    if (
      !Number.isInteger(parsedGrade) ||
      parsedGrade < 0 ||
      parsedGrade > 12
    ) {
      return "Grade number must be between 0 and 12.";
    }

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 2020 ||
      parsedYear > 2100
    ) {
      return "Enter a valid academic year.";
    }

    return null;
  };

  const handleSave = async () => {
    const validationMessage =
      validateForm();

    if (validationMessage) {
      Alert.alert(
        "Check class details",
        validationMessage,
      );
      return;
    }

    const parsedGrade =
      Number(gradeNumber);

    const parsedYear =
      Number(academicYear);

    setIsSaving(true);

    try {
      const result = editingClass
        ? await updateSchoolClass({
            classId: editingClass.id,
            name: className,
            gradeNumber: parsedGrade,
            academicYear: parsedYear,
          })
        : await createSchoolClass({
            name: className,
            gradeNumber: parsedGrade,
            academicYear: parsedYear,
          });

      setFormVisible(false);
      resetForm();

      await loadClasses();

      Alert.alert(
        editingClass
          ? "Class updated"
          : "Class created",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to save class:",
        error,
      );

      Alert.alert(
        "Unable to save class",
        error instanceof Error
          ? error.message
          : "The class could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateClass = (
    schoolClass: AdminSchoolClass,
  ) => {
    Alert.alert(
      "Activate class?",
      `${schoolClass.name} will become available for learner enrolments and teacher assignments.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Activate",
          onPress: () => {
            void performStatusChange(
              schoolClass,
              "active",
            );
          },
        },
      ],
    );
  };

  const performStatusChange = async (
    schoolClass: AdminSchoolClass,
    status: "active" | "inactive",
  ) => {
    try {
      const result =
        await setSchoolClassStatus(
          schoolClass.id,
          status,
        );

      await loadClasses();

      Alert.alert(
        status === "active"
          ? "Class activated"
          : "Class deactivated",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to update class status:",
        error,
      );

      Alert.alert(
        "Unable to update class",
        error instanceof Error
          ? error.message
          : "The class status could not be updated.",
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
                styles.headerButton,
                pressed &&
                  styles.pressedOpacity,
              ]}
            >
              <Ionicons
                color={colors.textOnPrimary}
                name="chevron-back"
                size={24}
              />
            </Pressable>

            <View
              style={
                styles.headerTextContainer
              }
            >
              <Text style={styles.eyebrow}>
                ADMINISTRATION
              </Text>

              <Text style={styles.headerTitle}>
                Manage Classes
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Add class"
              accessibilityRole="button"
              onPress={handleOpenCreate}
              style={({ pressed }) => [
                styles.addButton,
                pressed &&
                  styles.pressedOpacity,
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
            Create classes, manage academic
            years and control active
            enrolments.
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {classes.length}
              </Text>
              <Text style={styles.statLabel}>
                TOTAL CLASSES
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {activeClassCount}
              </Text>
              <Text style={styles.statLabel}>
                ACTIVE
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {totalLearnerCount}
              </Text>
              <Text style={styles.statLabel}>
                LEARNERS
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={20}
            />

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search classes"
              placeholderTextColor={
                colors.textSecondary
              }
              style={styles.searchInput}
              value={searchText}
            />

            {searchText ? (
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
                value: ClassFilter;
              }[]
            ).map((option) => {
              const isSelected =
                selectedFilter ===
                option.value;

              return (
                <Pressable
                  key={option.value}
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
                      styles.filterText,
                      isSelected &&
                        styles.filterTextSelected,
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
          <View style={styles.loadingState}>
            <ActivityIndicator
              color={BURGUNDY}
              size="large"
            />

            <Text style={styles.loadingText}>
              Loading classes...
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
                  void loadClasses(true)
                }
                refreshing={isRefreshing}
                tintColor={BURGUNDY}
              />
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            <View style={styles.listHeader}>
              <Text style={styles.resultText}>
                {filteredClasses.length}{" "}
                {filteredClasses.length === 1
                  ? "class"
                  : "classes"}
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
                  name="add-circle-outline"
                  size={17}
                />

                <Text
                  style={
                    styles.compactAddText
                  }
                >
                  Add class
                </Text>
              </Pressable>
            </View>

            {filteredClasses.length ===
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
                  No classes found
                </Text>

                <Text style={styles.emptyText}>
                  {searchText
                    ? "Try changing your search or selected filter."
                    : "Create the first class to begin enrolling learners."}
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
                      Create class
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              filteredClasses.map(
                (schoolClass) => {
                  const isActive =
                    schoolClass.status ===
                    "active";

                  return (
                    <View
                      key={schoolClass.id}
                      style={styles.classCard}
                    >
                      <View
                        style={
                          styles.classTopRow
                        }
                      >
                        <View
                          style={
                            styles.classIcon
                          }
                        >
                          <Ionicons
                            color={colors.primary}
                            name="school"
                            size={25}
                          />
                        </View>

                        <View style={styles.flex}>
                          <View
                            style={
                              styles.nameStatusRow
                            }
                          >
                            <Text
                              numberOfLines={1}
                              style={
                                styles.className
                              }
                            >
                              {schoolClass.name}
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
                              styles.classDetails
                            }
                          >
                            Grade{" "}
                            {
                              schoolClass.gradeNumber
                            }{" "}
                            ·{" "}
                            {
                              schoolClass.academicYear
                            }
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.learnerSummary
                        }
                      >
                        <View
                          style={
                            styles.summaryIcon
                          }
                        >
                          <Ionicons
                            color={BURGUNDY}
                            name="people-outline"
                            size={19}
                          />
                        </View>

                        <View style={styles.flex}>
                          <Text
                            style={
                              styles.summaryLabel
                            }
                          >
                            ACTIVE LEARNERS
                          </Text>

                          <Text
                            style={
                              styles.summaryValue
                            }
                          >
                            {
                              schoolClass.activeLearnerCount
                            }{" "}
                            {schoolClass.activeLearnerCount ===
                            1
                              ? "learner"
                              : "learners"}{" "}
                            enrolled
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.actionRow
                        }
                      >
                        <Pressable
                          onPress={() =>
                            handleOpenEdit(
                              schoolClass,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.editButton,
                            pressed &&
                              styles.editButtonPressed,
                          ]}
                        >
                          <Ionicons
                            color={BURGUNDY}
                            name="create-outline"
                            size={18}
                          />

                          <Text
                            style={
                              styles.editButtonText
                            }
                          >
                            Edit class
                          </Text>
                        </Pressable>

                        {!isActive ? (
                          <Pressable
                            accessibilityLabel={`Activate ${schoolClass.name}`}
                            accessibilityRole="button"
                            onPress={() =>
                              handleActivateClass(
                                schoolClass,
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.statusActionButton,
                              styles.activateButton,
                              pressed &&
                                styles.pressedOpacity,
                            ]}
                          >
                            <Ionicons
                              color={
                                colors.textOnPrimary
                              }
                              name="checkmark-circle-outline"
                              size={18}
                            />

                            <Text
                              style={
                                styles.statusActionText
                              }
                            >
                              Activate
                            </Text>
                          </Pressable>
                        ) : null}
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
                style={
                  styles.modalHeaderSide
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Text style={styles.modalTitle}>
                {editingClass
                  ? "Edit class"
                  : "New class"}
              </Text>

              <View
                style={
                  styles.modalHeaderSide
                }
              />
            </View>

            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formIntro}>
                <View
                  style={styles.formIntroIcon}
                >
                  <Ionicons
                    color={BURGUNDY}
                    name="school-outline"
                    size={27}
                  />
                </View>

                <View style={styles.flex}>
                  <Text
                    style={styles.formTitle}
                  >
                    {editingClass
                      ? "Update class details"
                      : "Create a new class"}
                  </Text>

                  <Text
                    style={styles.formText}
                  >
                    {editingClass
                      ? "Changes will be applied to the class and its active learner records."
                      : "The class will immediately become available for learner enrolments and teacher assignments."}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                CLASS INFORMATION
              </Text>

              <Text style={styles.inputLabel}>
                Class name
              </Text>

              <TextInput
                autoCapitalize="words"
                editable={!isSaving}
                onChangeText={setClassName}
                placeholder="Example: Grade 5"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={className}
              />

              <Text style={styles.inputLabel}>
                Grade number
              </Text>

              <TextInput
                editable={!isSaving}
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={setGradeNumber}
                placeholder="0 to 12"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={gradeNumber}
              />

              <Text style={styles.inputLabel}>
                Academic year
              </Text>

              <TextInput
                editable={!isSaving}
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={setAcademicYear}
                placeholder="Example: 2026"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={academicYear}
              />

              {editingClass &&
              editingClass.activeLearnerCount >
                0 ? (
                <View style={styles.notice}>
                  <Ionicons
                    color={colors.warning}
                    name="information-circle-outline"
                    size={22}
                  />

                  <Text
                    style={styles.noticeText}
                  >
                    Updating the grade number
                    will also update{" "}
                    {
                      editingClass.activeLearnerCount
                    }{" "}
                    active learner{" "}
                    {editingClass.activeLearnerCount ===
                    1
                      ? "record"
                      : "records"}.
                  </Text>
                </View>
              ) : null}

              <Pressable
                disabled={isSaving}
                onPress={() =>
                  void handleSave()
                }
                style={({ pressed }) => [
                  styles.saveButton,
                  isSaving &&
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
                  />
                ) : (
                  <>
                    <Ionicons
                      color={
                        colors.textOnPrimary
                      }
                      name={
                        editingClass
                          ? "save-outline"
                          : "add-circle-outline"
                      }
                      size={20}
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      {editingClass
                        ? "Save changes"
                        : "Create class"}
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

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.12)",
    borderRadius: 14,
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

  addButton: {
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

  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      "rgba(255,255,255,0.1)",
    borderRadius: 18,
    marginTop: 18,
    paddingVertical: 14,
  },

  stat: {
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

  searchBox: {
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

  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  filterTextSelected: {
    color: colors.textOnPrimary,
  },

  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 13,
  },

  listContent: {
    padding: 20,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  resultText: {
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

  compactAddText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  classCard: {
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

  classTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  classIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    marginRight: 13,
  },

  nameStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  className: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },

  classDetails: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
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

  learnerSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    marginTop: 16,
    padding: 12,
  },

  summaryIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9EEF2",
    borderRadius: 11,
    marginRight: 11,
  },

  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  summaryValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  editButton: {
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

  editButtonPressed: {
    backgroundColor: "#F9EEF2",
  },

  editButtonText: {
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
    padding: 34,
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
    textAlign: "center",
    marginTop: 8,
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

  pressedOpacity: {
    opacity: 0.75,
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

  modalHeaderSide: {
    width: 68,
  },

  cancelText: {
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

  formTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },

  formText: {
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

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.accentLight,
    borderRadius: 14,
    marginTop: 4,
    padding: 14,
  },

  noticeText: {
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
    marginTop: 27,
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
