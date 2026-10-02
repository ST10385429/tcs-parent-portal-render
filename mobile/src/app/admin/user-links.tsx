import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
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
  assignTeacherToClass,
  getAllActiveClassesForAdmin,
  getAllActiveLearnersForAdmin,
  getParentLearnerLinksForAdmin,
  getTeacherClassLinksForAdmin,
  linkParentToLearner,
  type ParentLearnerLink,
  type TeacherClassLink,
  unassignTeacherFromClass,
  unlinkParentFromLearner,
} from "@/services/admin-link-service";
import { colors } from "@/theme/colors";
import type {
  Learner,
  SchoolClass,
} from "@/types/school";

type SupportedRole =
  | "parent"
  | "teacher";

const burgundy = "#7A1830";

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

function getLearnerName(
  learner: Learner,
): string {
  return `${learner.firstName} ${learner.lastName}`.trim();
}

export default function UserLinksScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    uid?: string;
    role?: string;
    name?: string;
  }>();

  const uid =
    typeof params.uid === "string"
      ? params.uid.trim()
      : "";

  const role: SupportedRole | null =
    params.role === "parent" ||
    params.role === "teacher"
      ? params.role
      : null;

  const accountName =
    typeof params.name === "string" &&
    params.name.trim()
      ? params.name.trim()
      : role === "parent"
        ? "Parent account"
        : "Teacher account";

  const [allLearners, setAllLearners] =
    useState<Learner[]>([]);
  const [allClasses, setAllClasses] =
    useState<SchoolClass[]>([]);

  const [
    parentLinks,
    setParentLinks,
  ] = useState<ParentLearnerLink[]>([]);

  const [
    teacherLinks,
    setTeacherLinks,
  ] = useState<TeacherClassLink[]>([]);

  const [searchText, setSearchText] =
    useState("");
  const [
    relationship,
    setRelationship,
  ] = useState("Parent");

  const [
    selectedClass,
    setSelectedClass,
  ] = useState<SchoolClass | null>(null);
  const [subject, setSubject] =
    useState("");
  const [
    isAssignmentModalVisible,
    setIsAssignmentModalVisible,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [savingId, setSavingId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    if (!uid || !role) {
      return () => {
        isMounted = false;
      };
    }

    const request =
      role === "parent"
        ? Promise.all([
            getAllActiveLearnersForAdmin(),
            getParentLearnerLinksForAdmin(
              uid,
            ),
          ]).then(
            ([
              loadedLearners,
              loadedLinks,
            ]) => {
              if (!isMounted) {
                return;
              }

              setAllLearners(
                loadedLearners,
              );
              setParentLinks(loadedLinks);
            },
          )
        : Promise.all([
            getAllActiveClassesForAdmin(),
            getTeacherClassLinksForAdmin(
              uid,
            ),
          ]).then(
            ([
              loadedClasses,
              loadedLinks,
            ]) => {
              if (!isMounted) {
                return;
              }

              setAllClasses(loadedClasses);
              setTeacherLinks(loadedLinks);
            },
          );

    request
      .then(() => {
        if (isMounted) {
          setErrorMessage("");
        }
      })
      .catch((error: unknown) => {
        console.error(
          "Unable to load account links:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "The account links could not be loaded.",
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
  }, [role, uid]);

  const refreshLinks = async () => {
    if (!uid || !role) {
      return;
    }

    if (role === "parent") {
      const [
        loadedLearners,
        loadedLinks,
      ] = await Promise.all([
        getAllActiveLearnersForAdmin(),
        getParentLearnerLinksForAdmin(
          uid,
        ),
      ]);

      setAllLearners(loadedLearners);
      setParentLinks(loadedLinks);
    } else {
      const [
        loadedClasses,
        loadedLinks,
      ] = await Promise.all([
        getAllActiveClassesForAdmin(),
        getTeacherClassLinksForAdmin(
          uid,
        ),
      ]);

      setAllClasses(loadedClasses);
      setTeacherLinks(loadedLinks);
    }

    setErrorMessage("");
  };

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      await refreshLinks();
    } catch (error) {
      console.error(
        "Unable to refresh account links:",
        error,
      );

      setErrorMessage(
        "The account links could not be refreshed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const linkedLearnerIds = useMemo(
    () =>
      new Set(
        parentLinks.map(
          (link) => link.learnerId,
        ),
      ),
    [parentLinks],
  );

  const availableLearners = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return allLearners.filter(
      (learner) => {
        if (
          linkedLearnerIds.has(
            learner.id,
          )
        ) {
          return false;
        }

        const searchableText = [
          learner.firstName,
          learner.lastName,
          learner.studentNumber,
          learner.schoolClass?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return (
          !normalizedSearch ||
          searchableText.includes(
            normalizedSearch,
          )
        );
      },
    );
  }, [
    allLearners,
    linkedLearnerIds,
    searchText,
  ]);

  const availableClasses = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return allClasses.filter(
      (schoolClass) => {
        const searchableText = [
          schoolClass.name,
          schoolClass.gradeNumber,
          schoolClass.academicYear,
        ]
          .join(" ")
          .toLowerCase();

        return (
          !normalizedSearch ||
          searchableText.includes(
            normalizedSearch,
          )
        );
      },
    );
  }, [
    allClasses,
    searchText,
  ]);

  const handleLinkLearner = async (
    learner: Learner,
  ) => {
    if (savingId) {
      return;
    }

    if (!relationship.trim()) {
      Alert.alert(
        "Relationship required",
        "Enter the parent or guardian relationship.",
      );
      return;
    }

    try {
      setSavingId(learner.id);

      const result =
        await linkParentToLearner(
          uid,
          learner.id,
          relationship,
        );

      setParentLinks(
        await getParentLearnerLinksForAdmin(
          uid,
        ),
      );

      Alert.alert(
        "Learner linked",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to link learner:",
        error,
      );

      Alert.alert(
        "Unable to link learner",
        getErrorMessage(error),
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleUnlinkLearner = async (
    link: ParentLearnerLink,
  ) => {
    if (savingId) {
      return;
    }

    try {
      setSavingId(link.learnerId);

      const result =
        await unlinkParentFromLearner(
          uid,
          link.learnerId,
        );

      setParentLinks(
        await getParentLearnerLinksForAdmin(
          uid,
        ),
      );

      Alert.alert(
        "Learner removed",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to remove learner link:",
        error,
      );

      Alert.alert(
        "Unable to remove learner",
        getErrorMessage(error),
      );
    } finally {
      setSavingId(null);
    }
  };

  const confirmUnlinkLearner = (
    link: ParentLearnerLink,
  ) => {
    const learnerName =
      getLearnerName(link.learner);

    Alert.alert(
      "Remove learner link",
      `Remove ${learnerName} from ${accountName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void handleUnlinkLearner(
              link,
            );
          },
        },
      ],
    );
  };

  const openAssignmentModal = (
    schoolClass: SchoolClass,
  ) => {
    setSelectedClass(schoolClass);
    setSubject("");
    setIsAssignmentModalVisible(true);
  };

  const closeAssignmentModal = () => {
    if (savingId) {
      return;
    }

    setIsAssignmentModalVisible(false);
    setSelectedClass(null);
    setSubject("");
  };

  const handleAssignClass = async () => {
    if (
      savingId ||
      !selectedClass
    ) {
      return;
    }

    if (!subject.trim()) {
      Alert.alert(
        "Subject required",
        "Enter the subject taught in this class.",
      );
      return;
    }

    try {
      setSavingId(selectedClass.id);

      const result =
        await assignTeacherToClass(
          uid,
          selectedClass.id,
          subject,
        );

      setTeacherLinks(
        await getTeacherClassLinksForAdmin(
          uid,
        ),
      );

      setIsAssignmentModalVisible(
        false,
      );
      setSelectedClass(null);
      setSubject("");

      Alert.alert(
        "Class assigned",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to assign class:",
        error,
      );

      Alert.alert(
        "Unable to assign class",
        getErrorMessage(error),
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleUnassignClass = async (
    link: TeacherClassLink,
  ) => {
    if (savingId) {
      return;
    }

    try {
      setSavingId(link.assignmentId);

      const result =
        await unassignTeacherFromClass(
          uid,
          link.assignmentId,
        );

      setTeacherLinks(
        await getTeacherClassLinksForAdmin(
          uid,
        ),
      );

      Alert.alert(
        "Assignment removed",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to remove assignment:",
        error,
      );

      Alert.alert(
        "Unable to remove assignment",
        getErrorMessage(error),
      );
    } finally {
      setSavingId(null);
    }
  };

  const confirmUnassignClass = (
    link: TeacherClassLink,
  ) => {
    Alert.alert(
      "Remove class assignment",
      `Remove ${link.schoolClass.name} – ${link.subject} from ${accountName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void handleUnassignClass(
              link,
            );
          },
        },
      ],
    );
  };

  if (!uid || !role) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View style={styles.invalidScreen}>
          <Ionicons
            color={colors.error}
            name="alert-circle-outline"
            size={42}
          />
          <Text style={styles.invalidTitle}>
            Account unavailable
          </Text>
          <Text style={styles.invalidText}>
            A valid parent or teacher account
            was not selected.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.primaryButton}
          >
            <Text
              style={styles.primaryButtonText}
            >
              Return
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
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
            <Text style={styles.backText}>
              Back
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            {role === "parent"
              ? "Learner Links"
              : "Class Assignments"}
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              onRefresh={handleRefresh}
              refreshing={isRefreshing}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.accountCard}>
            <View style={styles.accountIcon}>
              <Ionicons
                color={colors.primary}
                name={
                  role === "parent"
                    ? "people-outline"
                    : "school-outline"
                }
                size={27}
              />
            </View>

            <View style={styles.accountDetails}>
              <Text style={styles.accountLabel}>
                {role === "parent"
                  ? "PARENT ACCOUNT"
                  : "TEACHER ACCOUNT"}
              </Text>
              <Text style={styles.accountName}>
                {accountName}
              </Text>
              <Text style={styles.accountHelp}>
                {role === "parent"
                  ? "Choose which learners this parent may access."
                  : "Choose the classes and subjects assigned to this teacher."}
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={21}
              />
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />
              <Text style={styles.loadingText}>
                Loading account links...
              </Text>
            </View>
          ) : null}

          {!isLoading && role === "parent" ? (
            <>
              <Text style={styles.sectionTitle}>
                Linked learners
              </Text>

              {parentLinks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    color={colors.textSecondary}
                    name="person-outline"
                    size={31}
                  />
                  <Text style={styles.emptyTitle}>
                    No linked learners
                  </Text>
                  <Text style={styles.emptyText}>
                    Select a learner below to
                    create the first link.
                  </Text>
                </View>
              ) : (
                parentLinks.map((link) => (
                  <View
                    key={link.learnerId}
                    style={styles.linkCard}
                  >
                    <View
                      style={styles.linkIcon}
                    >
                      <Ionicons
                        color={colors.primary}
                        name="person-outline"
                        size={22}
                      />
                    </View>

                    <View
                      style={
                        styles.linkInformation
                      }
                    >
                      <Text
                        style={styles.linkTitle}
                      >
                        {getLearnerName(
                          link.learner,
                        )}
                      </Text>
                      <Text
                        style={styles.linkSubtitle}
                      >
                        {link.learner
                          .studentNumber ||
                          "No student number"}
                      </Text>

                      <View
                        style={styles.linkBadges}
                      >
                        <Text
                          style={
                            styles.relationshipBadge
                          }
                        >
                          {link.relationship}
                        </Text>

                        {link.learner
                          .schoolClass ? (
                          <Text
                            style={
                              styles.classBadge
                            }
                          >
                            {
                              link.learner
                                .schoolClass.name
                            }
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        savingId ===
                        link.learnerId
                      }
                      onPress={() =>
                        confirmUnlinkLearner(
                          link,
                        )
                      }
                      style={styles.removeButton}
                    >
                      {savingId ===
                      link.learnerId ? (
                        <ActivityIndicator
                          color={colors.error}
                          size="small"
                        />
                      ) : (
                        <Ionicons
                          color={colors.error}
                          name="unlink-outline"
                          size={21}
                        />
                      )}
                    </Pressable>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>
                Add learner
              </Text>

              <Text style={styles.fieldLabel}>
                Relationship
              </Text>

              <TextInput
                autoCapitalize="words"
                onChangeText={setRelationship}
                placeholder="Parent or guardian"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.input}
                value={relationship}
              />
            </>
          ) : null}

          {!isLoading &&
          role === "teacher" ? (
            <>
              <Text style={styles.sectionTitle}>
                Current assignments
              </Text>

              {teacherLinks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    color={colors.textSecondary}
                    name="school-outline"
                    size={31}
                  />
                  <Text style={styles.emptyTitle}>
                    No class assignments
                  </Text>
                  <Text style={styles.emptyText}>
                    Select a class below to
                    create an assignment.
                  </Text>
                </View>
              ) : (
                teacherLinks.map((link) => (
                  <View
                    key={link.assignmentId}
                    style={styles.linkCard}
                  >
                    <View
                      style={styles.linkIcon}
                    >
                      <Ionicons
                        color={colors.primary}
                        name="school-outline"
                        size={22}
                      />
                    </View>

                    <View
                      style={
                        styles.linkInformation
                      }
                    >
                      <Text
                        style={styles.linkTitle}
                      >
                        {
                          link.schoolClass
                            .name
                        }
                      </Text>
                      <Text
                        style={styles.linkSubtitle}
                      >
                        {link.subject}
                      </Text>
                      <Text
                        style={
                          styles.academicYear
                        }
                      >
                        Academic year{" "}
                        {
                          link.schoolClass
                            .academicYear
                        }
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        savingId ===
                        link.assignmentId
                      }
                      onPress={() =>
                        confirmUnassignClass(
                          link,
                        )
                      }
                      style={styles.removeButton}
                    >
                      {savingId ===
                      link.assignmentId ? (
                        <ActivityIndicator
                          color={colors.error}
                          size="small"
                        />
                      ) : (
                        <Ionicons
                          color={colors.error}
                          name="unlink-outline"
                          size={21}
                        />
                      )}
                    </Pressable>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>
                Assign class and subject
              </Text>
            </>
          ) : null}

          {!isLoading ? (
            <>
              <View style={styles.searchContainer}>
                <Ionicons
                  color={colors.textSecondary}
                  name="search-outline"
                  size={20}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearchText}
                  placeholder={
                    role === "parent"
                      ? "Search learners"
                      : "Search classes"
                  }
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  style={styles.searchInput}
                  value={searchText}
                />
              </View>

              {role === "parent"
                ? availableLearners.map(
                    (learner) => (
                      <View
                        key={learner.id}
                        style={
                          styles.availableCard
                        }
                      >
                        <View
                          style={
                            styles.availableInformation
                          }
                        >
                          <Text
                            style={
                              styles.availableTitle
                            }
                          >
                            {getLearnerName(
                              learner,
                            )}
                          </Text>
                          <Text
                            style={
                              styles.availableSubtitle
                            }
                          >
                            {learner.studentNumber}
                            {learner.schoolClass
                              ? ` • ${learner.schoolClass.name}`
                              : ""}
                          </Text>
                        </View>

                        <Pressable
                          accessibilityRole="button"
                          disabled={
                            savingId ===
                            learner.id
                          }
                          onPress={() => {
                            void handleLinkLearner(
                              learner,
                            );
                          }}
                          style={({ pressed }) => [
                            styles.addButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          {savingId ===
                          learner.id ? (
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
                                name="link-outline"
                                size={18}
                              />
                              <Text
                                style={
                                  styles.addButtonText
                                }
                              >
                                Link
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ),
                  )
                : availableClasses.map(
                    (schoolClass) => (
                      <View
                        key={schoolClass.id}
                        style={
                          styles.availableCard
                        }
                      >
                        <View
                          style={
                            styles.availableInformation
                          }
                        >
                          <Text
                            style={
                              styles.availableTitle
                            }
                          >
                            {schoolClass.name}
                          </Text>
                          <Text
                            style={
                              styles.availableSubtitle
                            }
                          >
                            Grade{" "}
                            {
                              schoolClass.gradeNumber
                            }{" "}
                            •{" "}
                            {
                              schoolClass.academicYear
                            }
                          </Text>
                        </View>

                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            openAssignmentModal(
                              schoolClass,
                            )
                          }
                          style={({ pressed }) => [
                            styles.addButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Ionicons
                            color={
                              colors.textOnPrimary
                            }
                            name="add"
                            size={18}
                          />
                          <Text
                            style={
                              styles.addButtonText
                            }
                          >
                            Assign
                          </Text>
                        </Pressable>
                      </View>
                    ),
                  )}

              {(role === "parent" &&
                availableLearners.length ===
                  0) ||
              (role === "teacher" &&
                availableClasses.length ===
                  0) ? (
                <Text
                  style={
                    styles.noAvailableText
                  }
                >
                  No additional{" "}
                  {role === "parent"
                    ? "learners"
                    : "classes"}{" "}
                  are available.
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={
          closeAssignmentModal
        }
        transparent
        visible={
          isAssignmentModalVisible
        }
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
          style={styles.overlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons
                color={colors.primary}
                name="school-outline"
                size={27}
              />
            </View>

            <Text style={styles.modalTitle}>
              Assign Class
            </Text>

            <Text style={styles.modalText}>
              {selectedClass?.name}
            </Text>

            <Text style={styles.fieldLabel}>
              Subject
            </Text>

            <TextInput
              autoCapitalize="words"
              onChangeText={setSubject}
              placeholder="e.g. Mathematics"
              placeholderTextColor={
                colors.textSecondary
              }
              style={styles.input}
              value={subject}
            />

            <Pressable
              accessibilityRole="button"
              disabled={savingId !== null}
              onPress={() => {
                void handleAssignClass();
              }}
              style={styles.primaryButton}
            >
              {savingId ? (
                <ActivityIndicator
                  color={colors.textOnPrimary}
                  size="small"
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Confirm Assignment
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={savingId !== null}
              onPress={
                closeAssignmentModal
              }
              style={styles.cancelButton}
            >
              <Text
                style={styles.cancelButtonText}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
    minHeight: 44,
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
    fontSize: 17,
    fontWeight: "800",
  },

  headerSpacer: {
    width: 75,
  },

  content: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
  },

  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 17,
  },

  accountIcon: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
  },

  accountDetails: {
    flex: 1,
    marginLeft: 14,
  },

  accountLabel: {
    color: burgundy,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  accountName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },

  accountHelp: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 25,
    marginBottom: 11,
  },

  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 9,
    padding: 14,
  },

  linkIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
  },

  linkInformation: {
    flex: 1,
    marginHorizontal: 12,
  },

  linkTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  linkSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  linkBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },

  relationshipBadge: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: colors.primaryLight,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  classBadge: {
    color: burgundy,
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: colors.accentLight,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  academicYear: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 5,
  },

  removeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDECEC",
    borderRadius: 13,
  },

  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
  },

  input: {
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
  },

  searchContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 9,
  },

  availableCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginBottom: 9,
    padding: 13,
  },

  availableInformation: {
    flex: 1,
    marginRight: 10,
  },

  availableTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  availableSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },

  addButton: {
    minWidth: 84,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: burgundy,
    borderRadius: 13,
    paddingHorizontal: 12,
  },

  addButtonText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: "800",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 25,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 9,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
    textAlign: "center",
  },

  noAvailableText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    paddingVertical: 20,
    textAlign: "center",
  },

  loadingContainer: {
    alignItems: "center",
    paddingVertical: 55,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 12,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    marginTop: 14,
    padding: 14,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(0, 0, 0, 0.52)",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
  },

  modalIcon: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
  },

  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 13,
    textAlign: "center",
  },

  modalText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 18,
    textAlign: "center",
  },

  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: burgundy,
    borderRadius: 15,
    marginTop: 18,
    paddingHorizontal: 22,
  },

  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },

  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  invalidScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 25,
  },

  invalidTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 12,
  },

  invalidText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.68,
  },
});
