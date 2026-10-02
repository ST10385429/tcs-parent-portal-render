import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  useAuth,
} from "@/context/auth-context";
import {
  getTeacherSubjectResult,
  saveSubjectResult,
} from "@/services/subject-result-service";
import {
  getTeacherAssignments,
  getTeacherLearnerById,
} from "@/services/teacher-service";
import {
  colors,
} from "@/theme/colors";
import type {
  Learner,
  SubjectResultStatus,
} from "@/types/school";

const schoolTerms = [
  1,
  2,
  3,
  4,
];

export default function NewSubjectResultScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params =
    useLocalSearchParams<{
      learnerId?: string | string[];
    }>();

  const learnerId =
    Array.isArray(params.learnerId)
      ? params.learnerId[0]
      : params.learnerId;

  const [
    learner,
    setLearner,
  ] = useState<Learner | null>(
    null,
  );

  const [
    assignedSubject,
    setAssignedSubject,
  ] = useState("");

  const [
    availableSubjects,
    setAvailableSubjects,
  ] = useState<string[]>([]);

  const [
    selectedTerm,
    setSelectedTerm,
  ] = useState(1);

  const [
    mark,
    setMark,
  ] = useState("");

  const [
    comments,
    setComments,
  ] = useState("");

  const [
    existingResultStatus,
    setExistingResultStatus,
  ] = useState<
    SubjectResultStatus | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isLoadingExistingResult,
    setIsLoadingExistingResult,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadReportInformation =
      async () => {
        if (!learnerId || !user) {
          if (isMounted) {
            setErrorMessage(
              "A signed-in teacher and learner are required.",
            );
            setIsLoading(false);
          }

          return;
        }

        try {
          const [
            loadedLearner,
            assignments,
          ] = await Promise.all([
            getTeacherLearnerById(
              learnerId,
            ),
            getTeacherAssignments(
              user.uid,
            ),
          ]);

          if (!isMounted) {
            return;
          }

          if (!loadedLearner) {
            setErrorMessage(
              "This learner could not be found or is not assigned to your class.",
            );
            return;
          }

          const matchingAssignments =
            assignments.filter(
              (assignment) =>
                assignment.classId ===
                  loadedLearner.currentClassId &&
                assignment.learners.some(
                  (assignedLearner) =>
                    assignedLearner.id ===
                    loadedLearner.id,
                ) &&
                assignment.subject.trim().length > 0,
            );

          const loadedSubjects = [
            ...new Set(
              matchingAssignments.map(
                (assignment) =>
                  assignment.subject.trim(),
              ),
            ),
          ].sort((firstSubject, secondSubject) =>
            firstSubject.localeCompare(
              secondSubject,
            ),
          );

          if (loadedSubjects.length === 0) {
            setErrorMessage(
              "Your subject assignment for this learner could not be found.",
            );
            return;
          }

          setLearner(
            loadedLearner,
          );

          setAvailableSubjects(
            loadedSubjects,
          );

          setAssignedSubject(
            (currentSubject) =>
              loadedSubjects.includes(
                currentSubject,
              )
                ? currentSubject
                : loadedSubjects[0],
          );

          setErrorMessage("");
        } catch (error) {
          console.error(
            "Unable to prepare subject result:",
            error,
          );

          if (isMounted) {
            setErrorMessage(
              "The learner and subject information could not be loaded. Check your connection and try again.",
            );
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

    void loadReportInformation();

    return () => {
      isMounted = false;
    };
  }, [
    learnerId,
    user,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadExistingResult =
      async () => {
        if (
          !user ||
          !learner ||
          !assignedSubject.trim()
        ) {
          return;
        }

        const academicYear =
          learner.schoolClass
            ?.academicYear ??
          new Date().getFullYear();

        try {
          setIsLoadingExistingResult(
            true,
          );

          setExistingResultStatus(
            null,
          );

          setMark("");
          setComments("");
          setErrorMessage("");

          const existingResult =
            await getTeacherSubjectResult(
              user.uid,
              learner.id,
              academicYear,
              selectedTerm,
              assignedSubject,
            );

          if (!isMounted) {
            return;
          }

          if (!existingResult) {
            return;
          }

          setExistingResultStatus(
            existingResult.status,
          );

          setMark(
            String(existingResult.mark),
          );

          setComments(
            existingResult.comments,
          );
        } catch (error) {
          console.error(
            "Unable to load the saved subject result:",
            error,
          );

          if (isMounted) {
            setErrorMessage(
              "The saved result for this term could not be loaded. Check your connection and try again.",
            );
          }
        } finally {
          if (isMounted) {
            setIsLoadingExistingResult(
              false,
            );
          }
        }
      };

    void loadExistingResult();

    return () => {
      isMounted = false;
    };
  }, [
    assignedSubject,
    learner,
    selectedTerm,
    user,
  ]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(
      "/teacher/learners",
    );
  };

  const validateForm =
    (): string => {
      if (!learner) {
        return "The learner information is unavailable.";
      }

      if (
        !assignedSubject.trim()
      ) {
        return "Your assigned subject is unavailable.";
      }

      if (!mark.trim()) {
        return "Please enter the learner's mark.";
      }

      const numericMark =
        Number(mark);

      if (
        !Number.isFinite(
          numericMark,
        )
      ) {
        return "The mark must be a valid number.";
      }

      if (
        !Number.isInteger(
          numericMark,
        )
      ) {
        return "Please enter the mark as a whole number.";
      }

      if (
        numericMark < 0 ||
        numericMark > 100
      ) {
        return "The mark must be between 0 and 100.";
      }

      if (!comments.trim()) {
        return "Please enter a teacher comment.";
      }

      if (
        comments.trim().length <
        10
      ) {
        return "The teacher comment must contain at least 10 characters.";
      }

      if (
        comments.trim().length >
        500
      ) {
        return "The teacher comment cannot exceed 500 characters.";
      }

      return "";
    };

  const saveResult = async (
    status: SubjectResultStatus,
  ) => {
    if (
      isSaving ||
      isLoadingExistingResult ||
      !user ||
      !learner
    ) {
      return;
    }

    if (
      existingResultStatus ===
      "submitted"
    ) {
      setErrorMessage(
        `${assignedSubject} has already been submitted for term ${selectedTerm} and cannot be changed.`,
      );
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setErrorMessage(
        validationError,
      );
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      await saveSubjectResult(
        user.uid,
        learner,
        {
          learnerId:
            learner.id,
          classId:
            learner.currentClassId,
          academicYear:
            learner.schoolClass
              ?.academicYear ??
            new Date().getFullYear(),
          term:
            selectedTerm,
          subject:
            assignedSubject,
          mark:
            Number(mark),
          comments:
            comments.trim(),
          status,
        },
      );

      setExistingResultStatus(
        status,
      );

      const successTitle =
        status === "submitted"
          ? "Marks submitted"
          : "Draft saved";

      const successMessage =
        status === "submitted"
          ? `${assignedSubject} has been submitted to the administrator for ${learner.firstName}'s term report.`
          : `${assignedSubject} has been saved as a draft.`;

      if (
        Platform.OS === "web"
      ) {
        Alert.alert(
          successTitle,
          successMessage,
        );

        router.replace(
          "/teacher/learners",
        );

        return;
      }

      Alert.alert(
        successTitle,
        successMessage,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace(
                "/teacher/learners",
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        "Unable to save subject result:",
        error,
      );

      if (
        error instanceof Error &&
        error.message.includes(
          "already been submitted",
        )
      ) {
        setExistingResultStatus(
          "submitted",
        );

        setErrorMessage(
          error.message,
        );
      } else if (
        error instanceof Error &&
        error.message.trim()
      ) {
        setErrorMessage(
          error.message,
        );
      } else {
        setErrorMessage(
          "The marks could not be saved. Check your connection and try again.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            color={
              colors.primary
            }
            size="large"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Preparing the subject
            result...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    errorMessage &&
    (
      !learner ||
      !assignedSubject
    )
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.errorScreen
          }
        >
          <Ionicons
            color={
              colors.error
            }
            name="alert-circle-outline"
            size={52}
          />

          <Text
            style={
              styles.errorTitle
            }
          >
            Marks form unavailable
          </Text>

          <Text
            style={
              styles.errorScreenText
            }
          >
            {errorMessage}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={
              handleGoBack
            }
            style={({
              pressed,
            }) => [
              styles.returnButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              Return to learners
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!learner) {
    return null;
  }

  const learnerName =
    `${learner.firstName} ${learner.lastName}`.trim();

  const academicYear =
    learner.schoolClass
      ?.academicYear ??
    new Date().getFullYear();

  const resultIsSubmitted =
    existingResultStatus ===
    "submitted";

  const formIsDisabled =
    isSaving ||
    isLoadingExistingResult ||
    resultIsSubmitted;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        style={
          styles.keyboardView
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={
              handleGoBack
            }
            style={({
              pressed,
            }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Ionicons
              color={
                colors.textOnPrimary
              }
              name="chevron-back"
              size={24}
            />

            <Text
              style={
                styles.backText
              }
            >
              Back
            </Text>
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Submit Marks
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.learnerCard
            }
          >
            <View
              style={
                styles.learnerIcon
              }
            >
              <Ionicons
                color={
                  colors.primary
                }
                name="person-outline"
                size={24}
              />
            </View>

            <View
              style={
                styles.learnerInformation
              }
            >
              <Text
                style={
                  styles.learnerLabel
                }
              >
                LEARNER
              </Text>

              <Text
                style={
                  styles.learnerName
                }
              >
                {learnerName}
              </Text>

              <Text
                style={
                  styles.learnerDetails
                }
              >
                {learner.schoolClass
                  ?.name ??
                  `Grade ${learner.currentGradeNumber}`}
                {" • "}
                {
                  learner.studentNumber
                }
              </Text>
            </View>
          </View>

          <View
            style={
              styles.summaryCard
            }
          >
            <InformationItem
              label="Academic year"
              value={
                academicYear.toString()
              }
            />

            <View
              style={
                styles.verticalDivider
              }
            />

            <InformationItem
              label="Assigned subject"
              value={
                assignedSubject
              }
            />
          </View>

          <View
            style={
              styles.subjectNotice
            }
          >
            <Ionicons
              color={
                colors.primary
              }
              name="information-circle-outline"
              size={22}
            />

            <Text
              style={
                styles.subjectNoticeText
              }
            >
              {availableSubjects.length > 1
                ? "Choose the subject you are submitting for this learner. Each submitted subject is saved separately."
                : "Your assigned subject is loaded from your administrator-managed teacher assignment."}
            </Text>
          </View>

          {availableSubjects.length > 1 ? (
            <>
              <Text
                style={
                  styles.fieldLabel
                }
              >
                Assigned subject
              </Text>

              <View
                style={
                  styles.subjectSelector
                }
              >
                {availableSubjects.map(
                  (availableSubject) => {
                    const isSelected =
                      availableSubject ===
                      assignedSubject;

                    return (
                      <Pressable
                        key={availableSubject}
                        accessibilityLabel={`Select ${availableSubject}`}
                        accessibilityRole="button"
                        disabled={
                          isSaving ||
                          isLoadingExistingResult
                        }
                        onPress={() =>
                          setAssignedSubject(
                            availableSubject,
                          )
                        }
                        style={({ pressed }) => [
                          styles.subjectButton,
                          isSelected &&
                            styles.subjectButtonSelected,
                          pressed &&
                            !isSaving &&
                            !isLoadingExistingResult &&
                            styles.buttonPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subjectButtonText,
                            isSelected &&
                              styles.subjectButtonTextSelected,
                          ]}
                        >
                          {availableSubject}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </>
          ) : null}

          <Text
            style={
              styles.sectionTitle
            }
          >
            Subject result
          </Text>

          <Text
            style={
              styles.fieldLabel
            }
          >
            School term
          </Text>

          <View
            style={
              styles.termContainer
            }
          >
            {schoolTerms.map(
              (term) => {
                const isSelected =
                  selectedTerm ===
                  term;

                return (
                  <Pressable
                    key={term}
                    accessibilityLabel={`Select term ${term}`}
                    accessibilityRole="button"
                    disabled={
                      isSaving ||
                      isLoadingExistingResult
                    }
                    onPress={() =>
                      setSelectedTerm(
                        term,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.termButton,
                      isSelected &&
                        styles.termButtonSelected,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.termButtonText,
                        isSelected &&
                          styles.termButtonTextSelected,
                      ]}
                    >
                      Term {term}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>

          {isLoadingExistingResult ? (
            <View
              style={
                styles.resultStatusCard
              }
            >
              <ActivityIndicator
                color={
                  colors.primary
                }
                size="small"
              />

              <Text
                style={
                  styles.resultStatusText
                }
              >
                Checking for a saved
                result...
              </Text>
            </View>
          ) : null}

          {!isLoadingExistingResult &&
          existingResultStatus ===
            "draft" ? (
            <View
              style={[
                styles.resultStatusCard,
                styles.draftStatusCard,
              ]}
            >
              <Ionicons
                color={
                  colors.primary
                }
                name="document-text-outline"
                size={22}
              />

              <Text
                style={
                  styles.resultStatusText
                }
              >
                Your saved draft has been
                loaded. You can update it
                or submit it to the
                administrator.
              </Text>
            </View>
          ) : null}

          {!isLoadingExistingResult &&
          resultIsSubmitted ? (
            <View
              style={[
                styles.resultStatusCard,
                styles.submittedStatusCard,
              ]}
            >
              <Ionicons
                color="#8A5A00"
                name="lock-closed-outline"
                size={22}
              />

              <Text
                style={[
                  styles.resultStatusText,
                  styles.submittedStatusText,
                ]}
              >
                These marks have already
                been submitted for term{" "}
                {selectedTerm}. Submitted
                results are locked and
                cannot be changed.
              </Text>
            </View>
          ) : null}

          <Text
            style={
              styles.fieldLabel
            }
          >
            Mark percentage
          </Text>

          <View
            style={[
              styles.markInputContainer,
              formIsDisabled &&
                styles.disabledInput,
            ]}
          >
            <TextInput
              accessibilityLabel="Learner mark percentage"
              editable={
                !formIsDisabled
              }
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(
                value,
              ) =>
                setMark(
                  value.replace(
                    /[^0-9]/g,
                    "",
                  ),
                )
              }
              placeholder="0"
              placeholderTextColor={
                colors.textSecondary
              }
              style={
                styles.markInput
              }
              value={mark}
            />

            <Text
              style={
                styles.percentageSymbol
              }
            >
              %
            </Text>
          </View>

          <Text
            style={
              styles.fieldLabel
            }
          >
            Subject teacher comment
          </Text>

          <TextInput
            accessibilityLabel="Subject teacher comment"
            editable={
              !formIsDisabled
            }
            maxLength={500}
            multiline
            onChangeText={
              setComments
            }
            placeholder={`Enter feedback about the learner's progress in ${assignedSubject}...`}
            placeholderTextColor={
              colors.textSecondary
            }
            style={[
              styles.input,
              styles.commentsInput,
              formIsDisabled &&
                styles.disabledInput,
            ]}
            textAlignVertical="top"
            value={comments}
          />

          <Text
            style={
              styles.characterCount
            }
          >
            {comments.length}/500
          </Text>

          {errorMessage ? (
            <View
              accessibilityLiveRegion="polite"
              style={
                styles.errorCard
              }
            >
              <Ionicons
                color={
                  colors.error
                }
                name="alert-circle-outline"
                size={21}
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View
            style={
              styles.securityCard
            }
          >
            <Ionicons
              color={
                colors.primary
              }
              name="shield-checkmark-outline"
              size={24}
            />

            <Text
              style={
                styles.securityText
              }
            >
              Parents cannot access
              individual teacher
              submissions. The
              administrator will compile
              all submitted subjects into
              one final term report.
            </Text>
          </View>

          {!resultIsSubmitted ? (
            <>
              <Pressable
                accessibilityLabel="Submit marks to administrator"
                accessibilityRole="button"
                disabled={
                  formIsDisabled
                }
                onPress={() =>
                  void saveResult(
                    "submitted",
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.submitButton,
                  pressed &&
                    !formIsDisabled &&
                    styles.submitButtonPressed,
                  formIsDisabled &&
                    styles.disabledButton,
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
                        styles.submitButtonText
                      }
                    >
                      Saving marks...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    Submit marks to
                    administrator
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityLabel="Save marks as draft"
                accessibilityRole="button"
                disabled={
                  formIsDisabled
                }
                onPress={() =>
                  void saveResult(
                    "draft",
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.draftButton,
                  pressed &&
                    !formIsDisabled &&
                    styles.draftButtonPressed,
                  formIsDisabled &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.draftButtonText
                  }
                >
                  {existingResultStatus ===
                  "draft"
                    ? "Update draft"
                    : "Save as draft"}
                </Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InformationItemProps = {
  label: string;
  value: string;
};

function InformationItem({
  label,
  value,
}: InformationItemProps) {
  return (
    <View
      style={
        styles.informationItem
      }
    >
      <Text
        style={
          styles.informationLabel
        }
      >
        {label}
      </Text>

      <Text
        numberOfLines={2}
        style={
          styles.informationValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.primary,
    },

    keyboardView: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor:
        colors.primary,
      paddingHorizontal: 15,
    },

    backButton: {
      width: 75,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
    },

    backText: {
      color:
        colors.textOnPrimary,
      fontSize: 13,
      fontWeight: "700",
    },

    headerTitle: {
      color:
        colors.textOnPrimary,
      fontSize: 18,
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

    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.background,
      padding: 24,
    },

    loadingText: {
      color:
        colors.textSecondary,
      fontSize: 14,
      marginTop: 13,
    },

    errorScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.background,
      padding: 28,
    },

    errorTitle: {
      color:
        colors.textPrimary,
      fontSize: 21,
      fontWeight: "800",
      marginTop: 14,
    },

    errorScreenText: {
      color:
        colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
      textAlign: "center",
    },

    returnButton: {
      minHeight: 50,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primary,
      borderRadius: 15,
      marginTop: 22,
      paddingHorizontal: 25,
    },

    returnButtonText: {
      color:
        colors.textOnPrimary,
      fontSize: 14,
      fontWeight: "800",
    },

    learnerCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 19,
      padding: 17,
    },

    learnerIcon: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 25,
    },

    learnerInformation: {
      flex: 1,
      marginLeft: 13,
    },

    learnerLabel: {
      color:
        colors.primary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.3,
    },

    learnerName: {
      color:
        colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 4,
    },

    learnerDetails: {
      color:
        colors.textSecondary,
      fontSize: 11,
      marginTop: 4,
    },

    summaryCard: {
      flexDirection: "row",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 17,
      marginTop: 13,
      padding: 15,
    },

    informationItem: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 5,
    },

    informationLabel: {
      color:
        colors.textSecondary,
      fontSize: 10,
      fontWeight: "600",
      textAlign: "center",
    },

    informationValue: {
      color:
        colors.primaryDark,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 4,
      textAlign: "center",
    },

    verticalDivider: {
      width: 1,
      backgroundColor:
        colors.border,
      marginHorizontal: 8,
    },

    subjectNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      marginTop: 13,
      padding: 13,
    },

    subjectNoticeText: {
      flex: 1,
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 9,
    },

    subjectSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    subjectButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 13,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },

    subjectButtonSelected: {
      backgroundColor:
        colors.primary,
      borderColor:
        colors.primary,
    },

    subjectButtonText: {
      color:
        colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center",
    },

    subjectButtonTextSelected: {
      color:
        colors.textOnPrimary,
    },

    sectionTitle: {
      color:
        colors.textPrimary,
      fontSize: 19,
      fontWeight: "800",
      marginTop: 27,
      marginBottom: 5,
    },

    fieldLabel: {
      color:
        colors.textPrimary,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 17,
      marginBottom: 8,
    },

    termContainer: {
      flexDirection: "row",
      gap: 8,
    },

    termButton: {
      flex: 1,
      minHeight: 45,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 13,
    },

    termButtonSelected: {
      backgroundColor:
        colors.primary,
      borderColor:
        colors.primary,
    },

    termButtonText: {
      color:
        colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
    },

    termButtonTextSelected: {
      color:
        colors.textOnPrimary,
    },

    resultStatusCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.primaryLight,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      marginTop: 13,
      padding: 13,
    },

    draftStatusCard: {
      borderColor:
        colors.primary,
    },

    submittedStatusCard: {
      backgroundColor:
        "#FFF7E6",
      borderColor:
        "#E5B35A",
    },

    resultStatusText: {
      flex: 1,
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 9,
    },

    submittedStatusText: {
      color: "#704900",
    },

    input: {
      minHeight: 52,
      color:
        colors.textPrimary,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      fontSize: 14,
      paddingHorizontal: 15,
    },

    markInputContainer: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      paddingHorizontal: 15,
    },

    markInput: {
      flex: 1,
      minHeight: 50,
      color:
        colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },

    percentageSymbol: {
      color:
        colors.primary,
      fontSize: 18,
      fontWeight: "800",
    },

    commentsInput: {
      minHeight: 125,
      paddingTop: 14,
      paddingBottom: 14,
    },

    characterCount: {
      color:
        colors.textSecondary,
      fontSize: 10,
      marginTop: 5,
      textAlign: "right",
    },

    disabledInput: {
      opacity: 0.65,
      backgroundColor:
        "#F1F3F2",
    },

    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#FDECEC",
      borderWidth: 1,
      borderColor:
        colors.error,
      borderRadius: 14,
      marginTop: 16,
      padding: 13,
    },

    errorText: {
      flex: 1,
      color:
        colors.error,
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 9,
    },

    securityCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 15,
      marginTop: 17,
      padding: 14,
    },

    securityText: {
      flex: 1,
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 10,
    },

    submitButton: {
      minHeight: 54,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primary,
      borderRadius: 15,
      marginTop: 21,
      paddingHorizontal: 18,
    },

    submitButtonPressed: {
      backgroundColor:
        colors.primaryDark,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    submitButtonText: {
      color:
        colors.textOnPrimary,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
    },

    draftButton: {
      minHeight: 52,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.primary,
      borderRadius: 15,
      marginTop: 11,
      paddingHorizontal: 18,
    },

    draftButtonPressed: {
      backgroundColor:
        colors.primaryLight,
    },

    draftButtonText: {
      color:
        colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },

    loadingButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    disabledButton: {
      opacity: 0.65,
    },

    buttonPressed: {
      opacity: 0.7,
    },
  });
