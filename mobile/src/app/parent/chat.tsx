import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { getParentLearners } from "@/services/learner-service";
import {
  createAbsenceReport,
  createGeneralQuery,
  createTeacherAppointment,
  getAvailableTeachersForLearner,
  subscribeToParentRequests,
  type AvailableTeacher,
} from "@/services/parent-request-service";
import { colors } from "@/theme/colors";
import type {
  AbsenceReason,
  GeneralQueryCategory,
  Learner,
  ParentRequestStatus,
  ParentRequestType,
  ParentServiceRequest,
} from "@/types/school";

type ScreenView =
  | "overview"
  | "query"
  | "absence"
  | "appointment"
  | "requests";

const queryCategories: {
  value: GeneralQueryCategory;
  label: string;
}[] = [
  { value: "academics", label: "Academics" },
  { value: "homework", label: "Homework" },
  { value: "attendance", label: "Attendance" },
  { value: "behaviour", label: "Behaviour" },
  { value: "fees", label: "Fees" },
  { value: "general", label: "General" },
];

const absenceReasons: {
  value: AbsenceReason;
  label: string;
}[] = [
  { value: "illness", label: "Illness" },
  { value: "medicalAppointment", label: "Medical appointment" },
  { value: "familyResponsibility", label: "Family responsibility" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const requestLabels: Record<ParentRequestType, string> = {
  generalQuery: "General query",
  absenceReport: "Absence report",
  teacherAppointment: "Teacher appointment",
};

const statusLabels: Record<ParentRequestStatus, string> = {
  submitted: "Submitted",
  inReview: "In review",
  responded: "Responded",
  resolved: "Resolved",
  acknowledged: "Acknowledged",
  approved: "Approved",
  declined: "Declined",
  requested: "Requested",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function todayText(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string, label: string): Date {
  const cleanedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const date = new Date(`${cleanedValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }

  return date;
}

function requestDate(request: ParentServiceRequest): string {
  const date = request.createdAt?.toDate();

  if (!date) {
    return "Just now";
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusColour(status: ParentRequestStatus): string {
  if (["approved", "confirmed", "completed", "resolved"].includes(status)) {
    return colors.success;
  }

  if (["declined", "cancelled"].includes(status)) {
    return colors.error;
  }

  if (["inReview", "responded", "rescheduled"].includes(status)) {
    return colors.warning;
  }

  return colors.info;
}

export default function ParentServicesScreen() {
  const { user } = useAuth();

  const [view, setView] = useState<ScreenView>("overview");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [requests, setRequests] = useState<ParentServiceRequest[]>([]);
  const [teachers, setTeachers] = useState<AvailableTeacher[]>([]);
  const [teacherKey, setTeacherKey] = useState("");

  const [category, setCategory] =
    useState<GeneralQueryCategory>("general");
  const [subject, setSubject] = useState("");
  const [queryDetails, setQueryDetails] = useState("");

  const [absenceReason, setAbsenceReason] =
    useState<AbsenceReason>("illness");
  const [startDate, setStartDate] = useState(todayText());
  const [endDate, setEndDate] = useState(todayText());
  const [absenceNote, setAbsenceNote] = useState("");

  const [appointmentDate, setAppointmentDate] = useState(todayText());
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentReason, setAppointmentReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const selectedTeacher = useMemo(
    () =>
      teachers.find(
        (teacher) => `${teacher.uid}:${teacher.subject}` === teacherKey,
      ) ?? null,
    [teacherKey, teachers],
  );

  useEffect(() => {
    let mounted = true;

    if (!user) {
      return () => {
        mounted = false;
      };
    }

    getParentLearners(user.uid)
      .then((loadedLearners) => {
        if (!mounted) {
          return;
        }

        setLearners(loadedLearners);
        setLearnerId(loadedLearners[0]?.id ?? "");
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load linked learners:", loadError);
        if (mounted) {
          setError("Your linked learners could not be loaded.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToParentRequests(
      user.uid,
      setRequests,
      (requestError) => {
        console.error("Unable to load parent requests:", requestError);
        setError("Your requests could not be loaded.");
      },
    );
  }, [user]);

  useEffect(() => {
    let mounted = true;

    if (!user || !learnerId || view !== "appointment") {
      return () => {
        mounted = false;
      };
    }

  getAvailableTeachersForLearner(user.uid, learnerId)
      .then((loadedTeachers) => {
        if (!mounted) {
          return;
        }

        setTeachers(loadedTeachers);
        const firstTeacher = loadedTeachers[0];
        setTeacherKey(
          firstTeacher
            ? `${firstTeacher.uid}:${firstTeacher.subject}`
            : "",
        );
      })
      .catch((teacherError: unknown) => {
        console.error("Unable to load assigned teachers:", teacherError);
        if (mounted) {
          setError("Assigned teachers could not be loaded.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingTeachers(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [learnerId, user, view]);

  const clearNotices = () => {
    setError("");
    setFeedback("");
  };

  const openView = (nextView: ScreenView) => {
    clearNotices();
    if (nextView === "appointment" && learnerId) {
      setLoadingTeachers(true);
      setTeachers([]);
      setTeacherKey("");
    }
    setView(nextView);
  };

  const showSuccess = (message: string) => {
    setFeedback(message);
    setView("requests");
  };

  const submitQuery = async () => {
    if (!user || !learnerId) {
      setError("Select a learner before submitting a query.");
      return;
    }

    setSubmitting(true);
    clearNotices();

    try {
      await createGeneralQuery(user.uid, {
        learnerId,
        category,
        subject,
        description: queryDetails,
      });
      setCategory("general");
      setSubject("");
      setQueryDetails("");
      showSuccess("Your query was sent to the school administrator.");
    } catch (submitError) {
      console.error("Unable to submit query:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your query could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitAbsence = async () => {
    if (!user || !learnerId) {
      setError("Select a learner before reporting an absence.");
      return;
    }

    setSubmitting(true);
    clearNotices();

    try {
      await createAbsenceReport(user.uid, {
        learnerId,
        absenceReason,
        startDate: parseDate(startDate, "Start date"),
        endDate: parseDate(endDate, "End date"),
        description: absenceNote,
      });
      setAbsenceReason("illness");
      setStartDate(todayText());
      setEndDate(todayText());
      setAbsenceNote("");
      showSuccess("The learner absence was reported successfully.");
    } catch (submitError) {
      console.error("Unable to report absence:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The absence report could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitAppointment = async () => {
    if (!user || !learnerId) {
      setError("Select a learner before requesting an appointment.");
      return;
    }

    if (!selectedTeacher) {
      setError("Select an available teacher.");
      return;
    }

    setSubmitting(true);
    clearNotices();

    try {
      await createTeacherAppointment(user.uid, {
        learnerId,
        teacherUid: selectedTeacher.uid,
        teacherName: selectedTeacher.name,
        teacherSubject: selectedTeacher.subject,
        requestedDate: parseDate(appointmentDate, "Appointment date"),
        requestedTime: appointmentTime,
        description: appointmentReason,
      });
      setAppointmentDate(todayText());
      setAppointmentTime("");
      setAppointmentReason("");
      showSuccess("Your appointment request was sent to the teacher.");
    } catch (submitError) {
      console.error("Unable to request appointment:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The appointment request could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const learnerSelector = () => (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>SELECT LEARNER</Text>
      {learners.length === 0 ? (
        <Text style={styles.emptyText}>
          No active learners are linked to this account.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.horizontalChoices}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {learners.map((learner) => {
            const selected = learner.id === learnerId;
            return (
              <Pressable
                key={learner.id}
                onPress={() => {
                  setLearnerId(learner.id);
                  if (view === "appointment") {
                    setLoadingTeachers(true);
                    setTeachers([]);
                    setTeacherKey("");
                  }
                  clearNotices();
                }}
                style={({ pressed }) => [
                  styles.learnerChoice,
                  selected && styles.choiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={selected ? colors.textOnPrimary : colors.primary}
                  name="school-outline"
                  size={16}
                />
                <View>
                  <Text
                    style={[
                      styles.learnerName,
                      selected && styles.choiceTextSelected,
                    ]}
                  >
                    {learner.firstName} {learner.lastName}
                  </Text>
                  <Text
                    style={[
                      styles.learnerClass,
                      selected && styles.learnerClassSelected,
                    ]}
                  >
                    {learner.schoolClass?.name ?? "Class unavailable"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const choiceGroup = <T extends string,>(
    label: string,
    options: { value: T; label: string }[],
    selectedValue: T,
    onChange: (value: T) => void,
  ) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choiceChip,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const input = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    multiline = false,
    maxLength?: number,
  ) => (
    <View style={styles.fieldBlock}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {maxLength ? (
          <Text style={styles.count}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#899590"
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );

  const formHeading = (
    title: string,
    description: string,
    icon: "help-circle-outline" | "medkit-outline" | "calendar-outline",
  ) => (
    <View style={styles.formHeading}>
      <View style={styles.formIcon}>
        <Ionicons color={colors.primary} name={icon} size={24} />
      </View>
      <View style={styles.formHeadingText}>
        <Text style={styles.formTitle}>{title}</Text>
        <Text style={styles.formDescription}>{description}</Text>
      </View>
    </View>
  );

  const submitButton = (label: string, onPress: () => void) => (
    <Pressable
      disabled={submitting}
      onPress={onPress}
      style={({ pressed }) => [
        styles.submitButton,
        pressed && styles.pressed,
        submitting && styles.disabled,
      ]}
    >
      {submitting ? (
        <ActivityIndicator color={colors.textOnPrimary} size="small" />
      ) : (
        <>
          <Text style={styles.submitText}>{label}</Text>
          <Ionicons
            color={colors.textOnPrimary}
            name="arrow-forward"
            size={17}
          />
        </>
      )}
    </Pressable>
  );

  const overview = () => (
    <>
      <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <Ionicons
            color={colors.primary}
            name="shield-checkmark-outline"
            size={25}
          />
        </View>
        <View style={styles.introText}>
          <Text style={styles.introTitle}>How can we help?</Text>
          <Text style={styles.introDescription}>
            Submit and track official school requests securely in one place.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Parent services</Text>
      <View style={styles.serviceGrid}>
        <ServiceCard
          colour={colors.info}
          description="Ask about academics, fees or general school matters."
          icon="help-circle-outline"
          onPress={() => openView("query")}
          title="General query"
        />
        <ServiceCard
          colour={colors.warning}
          description="Notify the school when your learner will be absent."
          icon="medkit-outline"
          onPress={() => openView("absence")}
          title="Report absence"
        />
        <ServiceCard
          colour={colors.success}
          description="Request a meeting with an assigned teacher."
          icon="calendar-outline"
          onPress={() => openView("appointment")}
          title="Book appointment"
        />
        <ServiceCard
          colour={colors.primary}
          description="Review forms published by the school."
          icon="document-text-outline"
          onPress={() => {
            clearNotices();
            setFeedback("There are currently no active permission forms.");
          }}
          title="Permission forms"
        />
      </View>

      <Pressable
        onPress={() => openView("requests")}
        style={({ pressed }) => [
          styles.myRequestsButton,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.myRequestsIcon}>
          <Ionicons
            color={colors.textOnPrimary}
            name="file-tray-full-outline"
            size={21}
          />
        </View>
        <View style={styles.myRequestsText}>
          <Text style={styles.myRequestsTitle}>My requests</Text>
          <Text style={styles.myRequestsDescription}>
            Track {requests.length} submitted request
            {requests.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Ionicons
          color={colors.textOnPrimary}
          name="chevron-forward"
          size={20}
        />
      </Pressable>
    </>
  );

  const queryForm = () => (
    <>
      {formHeading(
        "Submit a general query",
        "Your query will be sent to the school administrator.",
        "help-circle-outline",
      )}
      {learnerSelector()}
      {choiceGroup(
        "QUERY CATEGORY",
        queryCategories,
        category,
        setCategory,
      )}
      {input(
        "SUBJECT",
        subject,
        setSubject,
        "Example: Question about Term 3 fees",
        false,
        100,
      )}
      {input(
        "QUERY DETAILS",
        queryDetails,
        setQueryDetails,
        "Describe how the school can assist you...",
        true,
        1000,
      )}
      {submitButton("Submit query", submitQuery)}
    </>
  );

  const absenceForm = () => (
    <>
      {formHeading(
        "Report learner absence",
        "The school administrator will receive and review this report.",
        "medkit-outline",
      )}
      {learnerSelector()}
      {choiceGroup(
        "REASON FOR ABSENCE",
        absenceReasons,
        absenceReason,
        setAbsenceReason,
      )}
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          {input("START DATE", startDate, setStartDate, "YYYY-MM-DD")}
        </View>
        <View style={styles.column}>
          {input("END DATE", endDate, setEndDate, "YYYY-MM-DD")}
        </View>
      </View>
      {input(
        "ABSENCE NOTE",
        absenceNote,
        setAbsenceNote,
        "Provide any information the school should know...",
        true,
        500,
      )}
      {submitButton("Submit absence report", submitAbsence)}
    </>
  );

  const appointmentForm = () => (
    <>
      {formHeading(
        "Request an appointment",
        "Choose a teacher assigned to your learner's current class.",
        "calendar-outline",
      )}
      {learnerSelector()}

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>SELECT TEACHER</Text>
        {loadingTeachers ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingRowText}>
              Loading assigned teachers...
            </Text>
          </View>
        ) : teachers.length === 0 ? (
          <Text style={styles.emptyText}>
            No active teachers were found for this learner&apos;s class.
          </Text>
        ) : (
          <View style={styles.teacherList}>
            {teachers.map((teacher) => {
              const key = `${teacher.uid}:${teacher.subject}`;
              const selected = key === teacherKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTeacherKey(key)}
                  style={({ pressed }) => [
                    styles.teacherChoice,
                    selected && styles.teacherSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.teacherAvatar}>
                    <Ionicons
                      color={colors.primary}
                      name="person-outline"
                      size={18}
                    />
                  </View>
                  <View style={styles.teacherText}>
                    <Text style={styles.teacherName}>{teacher.name}</Text>
                    <Text style={styles.teacherSubject}>
                      {teacher.subject} • {teacher.className}
                    </Text>
                  </View>
                  <Ionicons
                    color={selected ? colors.success : colors.border}
                    name={
                      selected ? "checkmark-circle" : "ellipse-outline"
                    }
                    size={21}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.twoColumns}>
        <View style={styles.column}>
          {input(
            "PREFERRED DATE",
            appointmentDate,
            setAppointmentDate,
            "YYYY-MM-DD",
          )}
        </View>
        <View style={styles.column}>
          {input(
            "PREFERRED TIME",
            appointmentTime,
            setAppointmentTime,
            "Example: 14:30",
          )}
        </View>
      </View>
      {input(
        "REASON FOR APPOINTMENT",
        appointmentReason,
        setAppointmentReason,
        "Briefly explain what you would like to discuss...",
        true,
        500,
      )}
      {submitButton("Request appointment", submitAppointment)}
    </>
  );

  const requestList = () => (
    <>
      <View style={styles.formHeading}>
        <View style={styles.formIcon}>
          <Ionicons
            color={colors.primary}
            name="file-tray-full-outline"
            size={24}
          />
        </View>
        <View style={styles.formHeadingText}>
          <Text style={styles.formTitle}>My requests</Text>
          <Text style={styles.formDescription}>
            Updates appear automatically when the school responds.
          </Text>
        </View>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            color={colors.primary}
            name="file-tray-outline"
            size={34}
          />
          <Text style={styles.emptyStateTitle}>No requests yet</Text>
          <Text style={styles.emptyStateDescription}>
            Requests submitted through Parent Services will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.requestList}>
          {requests.map((item) => {
            const colour = statusColour(item.status);
            return (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <Text style={styles.requestType}>
                    {requestLabels[item.requestType]}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${colour}18` },
                    ]}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: colour }]}
                    />
                    <Text style={[styles.statusText, { color: colour }]}>
                      {statusLabels[item.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestSubject}>{item.subject}</Text>
                <Text numberOfLines={3} style={styles.requestDescription}>
                  {item.description}
                </Text>

                {item.latestResponse ? (
                  <View style={styles.responseBox}>
                    <Ionicons
                      color={colors.success}
                      name="chatbubble-ellipses-outline"
                      size={16}
                    />
                    <View style={styles.responseText}>
                      <Text style={styles.responseLabel}>LATEST RESPONSE</Text>
                      <Text style={styles.responseMessage}>
                        {item.latestResponse}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.requestFooter}>
                  <Text style={styles.reference}>{item.referenceNumber}</Text>
                  <Text style={styles.requestDate}>
                    {item.learnerFirstName} • {requestDate(item)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  const content = () => {
    if (view === "query") return queryForm();
    if (view === "absence") return absenceForm();
    if (view === "appointment") return appointmentForm();
    if (view === "requests") return requestList();
    return overview();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={76}
        style={styles.keyboardView}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => openView("overview")}
                style={({ pressed }) => [
                  styles.headerIcon,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={colors.textOnPrimary}
                  name={view === "overview" ? "school-outline" : "arrow-back"}
                  size={21}
                />
              </Pressable>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>PARENT PORTAL</Text>
                <Text style={styles.title}>Parent Services</Text>
              </View>
              <Pressable
                onPress={() => openView("requests")}
                style={({ pressed }) => [
                  styles.headerIcon,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={colors.textOnPrimary}
                  name="file-tray-full-outline"
                  size={20}
                />
                {requests.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {requests.length > 9 ? "9+" : requests.length}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Queries, attendance, forms and appointments
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading && Boolean(user) ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loadingText}>Loading Parent Services...</Text>
              </View>
            ) : (
              <>
                {feedback ? (
                  <Notice colour={colors.success} message={feedback} />
                ) : null}
                {error ? <Notice colour={colors.error} message={error} /> : null}
                {content()}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ServiceIcon =
  | "help-circle-outline"
  | "medkit-outline"
  | "calendar-outline"
  | "document-text-outline";

function ServiceCard({
  title,
  description,
  icon,
  colour,
  onPress,
}: {
  title: string;
  description: string;
  icon: ServiceIcon;
  colour: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.serviceCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.serviceIcon, { backgroundColor: `${colour}18` }]}>
        <Ionicons color={colour} name={icon} size={23} />
      </View>
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDescription}>{description}</Text>
      <View style={styles.openRow}>
        <Text style={[styles.openText, { color: colour }]}>Open</Text>
        <Ionicons color={colour} name="arrow-forward" size={14} />
      </View>
    </Pressable>
  );
}

function Notice({ colour, message }: { colour: string; message: string }) {
  return (
    <View style={[styles.notice, { borderColor: `${colour}55` }]}>
      <Ionicons color={colour} name="information-circle-outline" size={19} />
      <Text style={[styles.noticeText, { color: colour }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  keyboardView: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 21,
  },
  headerText: { flex: 1, marginLeft: 12 },
  eyebrow: {
    color: colors.accentLight,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  title: {
    color: colors.textOnPrimary,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 3,
  },
  subtitle: { color: colors.primaryLight, fontSize: 11, marginTop: 8 },
  countBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 3,
  },
  countBadgeText: { color: colors.textOnPrimary, fontSize: 8, fontWeight: "800" },
  scrollContent: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 40,
  },
  loadingState: { alignItems: "center", paddingVertical: 90 },
  loadingText: { color: colors.textSecondary, fontSize: 12, marginTop: 12 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17, marginLeft: 9 },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
  },
  introIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 24,
  },
  introText: { flex: 1, marginLeft: 13 },
  introTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  introDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  serviceCard: {
    width: "48%",
    minHeight: 185,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 15,
  },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  serviceIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  serviceTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 13,
  },
  serviceDescription: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  openRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  openText: { fontSize: 10, fontWeight: "800", marginRight: 4 },
  myRequestsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 17,
    padding: 14,
    marginTop: 16,
  },
  myRequestsIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 13,
  },
  myRequestsText: { flex: 1, marginLeft: 12 },
  myRequestsTitle: { color: colors.textOnPrimary, fontSize: 13, fontWeight: "800" },
  myRequestsDescription: { color: colors.primaryLight, fontSize: 10, marginTop: 3 },
  formHeading: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 15,
    marginBottom: 18,
  },
  formIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
  },
  formHeadingText: { flex: 1, marginLeft: 12 },
  formTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  formDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  fieldBlock: { marginBottom: 18 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  count: { color: colors.textSecondary, fontSize: 8, marginBottom: 8 },
  horizontalChoices: { gap: 9 },
  learnerChoice: {
    minWidth: 165,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 9,
  },
  learnerName: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
  learnerClass: { color: colors.textSecondary, fontSize: 8, marginTop: 2 },
  learnerClassSelected: { color: colors.primaryLight },
  emptyText: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 10,
    lineHeight: 16,
    padding: 14,
  },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  choiceTextSelected: { color: colors.textOnPrimary },
  input: {
    minHeight: 48,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  multilineInput: { minHeight: 115, lineHeight: 19 },
  twoColumns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  loadingRowText: { color: colors.textSecondary, fontSize: 10, marginLeft: 9 },
  teacherList: { gap: 8 },
  teacherChoice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 11,
  },
  teacherSelected: { borderColor: colors.success, backgroundColor: "#F3FAF5" },
  teacherAvatar: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 19,
  },
  teacherText: { flex: 1, marginLeft: 10 },
  teacherName: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
  teacherSubject: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  submitButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 15,
    gap: 8,
  },
  submitText: { color: colors.textOnPrimary, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 40,
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 13,
  },
  emptyStateDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 6,
  },
  requestList: { gap: 12 },
  requestCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 15,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  requestType: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 8, fontWeight: "800" },
  requestSubject: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  requestDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  responseBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F3FAF5",
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
  },
  responseText: { flex: 1, marginLeft: 8 },
  responseLabel: { color: colors.success, fontSize: 8, fontWeight: "800" },
  responseMessage: {
    color: colors.textPrimary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  requestFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 13,
    paddingTop: 10,
    gap: 8,
  },
  reference: { color: colors.primary, fontSize: 8, fontWeight: "800" },
  requestDate: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 8,
    textAlign: "right",
  },
  pressed: { opacity: 0.72 },
});
