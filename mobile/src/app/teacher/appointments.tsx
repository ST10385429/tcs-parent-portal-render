import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import {
  addRequestReply,
  subscribeToRequestReplies,
  subscribeToTeacherAppointments,
  updateParentRequestStatus,
  updateTeacherAppointmentSchedule,
} from "@/services/parent-request-service";
import { colors } from "@/theme/colors";
import type {
  ParentRequestReply,
  ParentRequestStatus,
  ParentServiceRequest,
} from "@/types/school";

type AppointmentFilter = "all" | "pending" | "confirmed" | "closed";

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

const filters: { label: string; value: AppointmentFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Closed", value: "closed" },
];

function formatDate(value: ParentServiceRequest["createdAt"]): string {
  if (!value) {
    return "Not available";
  }

  return value.toDate().toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: ParentServiceRequest["createdAt"]): string {
  if (!value) {
    return "Not available";
  }

  return value.toDate().toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInput(value: ParentServiceRequest["createdAt"]): string {
  if (!value) {
    return "";
  }

  const date = value.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const cleanedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) {
    throw new Error("The appointment date must use YYYY-MM-DD.");
  }

  const date = new Date(`${cleanedValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid appointment date.");
  }

  return date;
}

function getStatusColour(status: ParentRequestStatus): string {
  if (status === "completed") {
    return colors.success;
  }

  if (status === "cancelled") {
    return colors.error;
  }

  if (status === "confirmed" || status === "rescheduled") {
    return colors.info;
  }

  return colors.warning;
}

function matchesFilter(
  appointment: ParentServiceRequest,
  filter: AppointmentFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "pending") {
    return appointment.status === "requested";
  }

  if (filter === "confirmed") {
    return (
      appointment.status === "confirmed" ||
      appointment.status === "rescheduled"
    );
  }

  return (
    appointment.status === "completed" || appointment.status === "cancelled"
  );
}

export default function TeacherAppointmentsScreen() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<ParentServiceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<ParentRequestReply[]>([]);
  const [filter, setFilter] = useState<AppointmentFilter>("all");
  const [reply, setReply] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToTeacherAppointments(
      user.uid,
      (loadedAppointments) => {
        setAppointments(loadedAppointments);
        setLoading(false);
        setError("");
      },
      (appointmentError) => {
        console.error("Unable to load teacher appointments:", appointmentError);
        setError("Appointment requests could not be loaded.");
        setLoading(false);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!selectedId) {
      return undefined;
    }

    return subscribeToRequestReplies(
      selectedId,
      (loadedReplies) => setReplies(loadedReplies),
      (replyError) => {
        console.error("Unable to load appointment replies:", replyError);
        setError("Responses for this appointment could not be loaded.");
      },
    );
  }, [selectedId]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedId) ?? null,
    [appointments, selectedId],
  );

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => matchesFilter(appointment, filter)),
    [appointments, filter],
  );

  const openAppointment = (appointment: ParentServiceRequest) => {
    const activeDate =
      appointment.confirmedAppointmentDate ??
      appointment.requestedAppointmentDate;
    const activeTime =
      appointment.confirmedAppointmentTime ||
      appointment.requestedAppointmentTime;

    setReplies([]);
    setReply("");
    setScheduleDate(toDateInput(activeDate));
    setScheduleTime(activeTime);
    setError("");
    setFeedback("");
    setSelectedId(appointment.id);
  };

  const closeAppointment = () => {
    setSelectedId(null);
    setReplies([]);
    setReply("");
    setError("");
    setFeedback("");
  };

  const runAction = async (action: () => Promise<void>, message: string) => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setFeedback("");
      await action();
      setFeedback(message);
    } catch (actionError) {
      console.error("Unable to update teacher appointment:", actionError);
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The appointment could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRequestedTime = () => {
    if (!selectedAppointment?.requestedAppointmentDate) {
      setError("The requested appointment date is unavailable.");
      return;
    }

    void runAction(
      () =>
        updateTeacherAppointmentSchedule(
          selectedAppointment.id,
          "confirmed",
          selectedAppointment.requestedAppointmentDate!.toDate(),
          selectedAppointment.requestedAppointmentTime,
        ),
      "The requested appointment time was confirmed.",
    );
  };

  const handleReschedule = () => {
    if (!selectedAppointment) {
      return;
    }

    let confirmedDate: Date;

    try {
      confirmedDate = parseDate(scheduleDate);
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Enter a valid date.",
      );
      return;
    }

    void runAction(
      () =>
        updateTeacherAppointmentSchedule(
          selectedAppointment.id,
          "rescheduled",
          confirmedDate,
          scheduleTime,
        ),
      "The parent was notified of the proposed new appointment time.",
    );
  };

  const handleStatusUpdate = (status: "completed" | "cancelled") => {
    if (!selectedAppointment) {
      return;
    }

    void runAction(
      () => updateParentRequestStatus(selectedAppointment.id, status),
      `The appointment was marked as ${status}.`,
    );
  };

  const handleSendReply = () => {
    if (!selectedAppointment || !user) {
      return;
    }

    void runAction(
      async () => {
        await addRequestReply(
          selectedAppointment.id,
          user.uid,
          "teacher",
          `${user.firstName} ${user.lastName}`.trim() || "Teacher",
          reply,
        );
        setReply("");
      },
      "Your response was sent to the parent.",
    );
  };

  if (selectedAppointment) {
    const statusColour = getStatusColour(selectedAppointment.status);
    const appointmentClosed =
      selectedAppointment.status === "completed" ||
      selectedAppointment.status === "cancelled";

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.detailScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailHeader}>
            <Pressable
              accessibilityLabel="Return to appointments"
              accessibilityRole="button"
              onPress={closeAppointment}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={colors.textOnPrimary}
                name="arrow-back"
                size={23}
              />
            </Pressable>
            <View style={styles.detailHeaderText}>
              <Text style={styles.headerEyebrow}>APPOINTMENT REQUEST</Text>
              <Text style={styles.detailTitle}>
                {selectedAppointment.referenceNumber}
              </Text>
            </View>
          </View>

          <View style={styles.detailContent}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.calendarIcon}>
                  <Ionicons
                    color={colors.primary}
                    name="calendar-outline"
                    size={24}
                  />
                </View>
                <View style={styles.summaryHeading}>
                  <Text style={styles.learnerName}>
                    {selectedAppointment.learnerFirstName}{" "}
                    {selectedAppointment.learnerLastName}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {selectedAppointment.className} · {" "}
                    {selectedAppointment.teacherSubject}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColour}18` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColour }]}>
                    {statusLabels[selectedAppointment.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.reasonTitle}>Parent&apos;s reason</Text>
              <Text style={styles.reasonText}>
                {selectedAppointment.description}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Appointment information</Text>
            <View style={styles.informationCard}>
              <InformationRow
                label="Requested date"
                value={formatDate(selectedAppointment.requestedAppointmentDate)}
              />
              <InformationRow
                label="Requested time"
                value={selectedAppointment.requestedAppointmentTime}
              />
              <InformationRow
                label="Confirmed date"
                value={formatDate(selectedAppointment.confirmedAppointmentDate)}
              />
              <InformationRow
                label="Confirmed time"
                value={selectedAppointment.confirmedAppointmentTime}
              />
              <InformationRow
                label="Submitted"
                value={formatDateTime(selectedAppointment.createdAt)}
              />
            </View>

            {!appointmentClosed ? (
              <>
                <Text style={styles.sectionTitle}>Manage appointment</Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={handleConfirmRequestedTime}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    color={colors.textOnPrimary}
                    name="checkmark-circle-outline"
                    size={20}
                  />
                  <Text style={styles.primaryButtonText}>
                    Confirm requested time
                  </Text>
                </Pressable>

                <View style={styles.rescheduleCard}>
                  <Text style={styles.rescheduleTitle}>Propose another time</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Text style={styles.inputLabel}>DATE</Text>
                      <TextInput
                        onChangeText={setScheduleDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.input}
                        value={scheduleDate}
                      />
                    </View>
                    <View style={styles.inputColumn}>
                      <Text style={styles.inputLabel}>TIME</Text>
                      <TextInput
                        onChangeText={setScheduleTime}
                        placeholder="14:30"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.input}
                        value={scheduleTime}
                      />
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={handleReschedule}
                    style={({ pressed }) => [
                      styles.outlineButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Reschedule</Text>
                  </Pressable>
                </View>

                <View style={styles.finalActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => handleStatusUpdate("completed")}
                    style={({ pressed }) => [
                      styles.completeButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.completeButtonText}>Complete</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => handleStatusUpdate("cancelled")}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Conversation</Text>

            {replies.length === 0 ? (
              <View style={styles.emptyReplies}>
                <Text style={styles.emptyRepliesText}>
                  No responses have been added yet.
                </Text>
              </View>
            ) : (
              <View style={styles.repliesList}>
                {replies.map((appointmentReply) => (
                  <View key={appointmentReply.id} style={styles.replyCard}>
                    <View style={styles.replyHeader}>
                      <Text style={styles.replySender}>
                        {appointmentReply.senderName}
                      </Text>
                      <Text style={styles.replyRole}>
                        {appointmentReply.senderRole}
                      </Text>
                    </View>
                    <Text style={styles.replyMessage}>
                      {appointmentReply.message}
                    </Text>
                    <Text style={styles.replyDate}>
                      {formatDateTime(appointmentReply.createdAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TextInput
              multiline
              onChangeText={setReply}
              placeholder="Write a response to the parent..."
              placeholderTextColor={colors.textSecondary}
              style={styles.replyInput}
              textAlignVertical="top"
              value={reply}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {feedback ? (
              <Text style={styles.feedbackText}>{feedback}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving || reply.trim().length === 0}
              onPress={handleSendReply}
              style={({ pressed }) => [
                styles.sendButton,
                (saving || reply.trim().length === 0) &&
                  styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <Ionicons
                  color={colors.textOnPrimary}
                  name="send-outline"
                  size={19}
                />
              )}
              <Text style={styles.sendButtonText}>
                {saving ? "Saving..." : "Send response"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>TEACHER WORKSPACE</Text>
        <Text style={styles.headerTitle}>Parent appointments</Text>
        <Text style={styles.headerSubtitle}>
          Review and manage appointment requests assigned to you.
        </Text>
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          contentContainerStyle={styles.filterRow}
          showsHorizontalScrollIndicator={false}
        >
          {filters.map((filterOption) => {
            const selected = filterOption.value === filter;

            return (
              <Pressable
                key={filterOption.value}
                onPress={() => setFilter(filterOption.value)}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selected && styles.filterButtonTextSelected,
                  ]}
                >
                  {filterOption.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.centerText}>Loading appointments...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons color={colors.error} name="alert-circle" size={34} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons
              color={colors.textSecondary}
              name="calendar-clear-outline"
              size={40}
            />
            <Text style={styles.emptyTitle}>No appointments found</Text>
            <Text style={styles.centerText}>
              New requests assigned to you will appear here automatically.
            </Text>
          </View>
        ) : (
          filteredAppointments.map((appointment) => {
            const statusColour = getStatusColour(appointment.status);

            return (
              <Pressable
                key={appointment.id}
                accessibilityRole="button"
                onPress={() => openAppointment(appointment)}
                style={({ pressed }) => [
                  styles.appointmentCard,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.calendarIcon}>
                  <Ionicons
                    color={colors.primary}
                    name="calendar-outline"
                    size={23}
                  />
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.referenceText}>
                      {appointment.referenceNumber}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${statusColour}18` },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: statusColour }]}
                      >
                        {statusLabels[appointment.status]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle}>
                    {appointment.learnerFirstName}{" "}
                    {appointment.learnerLastName}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {formatDate(appointment.requestedAppointmentDate)} at {" "}
                    {appointment.requestedAppointmentTime}
                  </Text>
                  <Text style={styles.cardReason} numberOfLines={2}>
                    {appointment.description}
                  </Text>
                </View>
                <Ionicons
                  color={colors.textSecondary}
                  name="chevron-forward"
                  size={20}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InformationRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.informationRow}>
      <Text style={styles.informationLabel}>{label}</Text>
      <Text style={styles.informationValue}>{value || "Not available"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.5 },
  header: {
    backgroundColor: colors.primary,
    paddingBottom: 30,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  headerEyebrow: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 27,
    fontWeight: "800",
    marginTop: 6,
  },
  headerSubtitle: { color: colors.primaryLight, fontSize: 13, marginTop: 6 },
  filterSection: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  filterRow: { gap: 9, paddingHorizontal: 18, paddingVertical: 13 },
  filterButton: {
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  filterButtonTextSelected: { color: colors.textOnPrimary },
  listContent: { flexGrow: 1, gap: 12, padding: 18, paddingBottom: 32 },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 320,
    paddingHorizontal: 30,
  },
  centerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },
  appointmentCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 15,
  },
  cardPressed: { opacity: 0.76, transform: [{ scale: 0.995 }] },
  calendarIcon: {
    alignItems: "center",
    backgroundColor: `${colors.primary}12`,
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  cardContent: { flex: 1 },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  referenceText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  statusBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "800" },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  cardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  cardReason: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
  },
  detailScroll: { flexGrow: 1, backgroundColor: colors.background },
  detailHeader: {
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  backButton: {
    alignItems: "center",
    borderColor: `${colors.textOnPrimary}30`,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  detailHeaderText: { marginLeft: 13 },
  detailTitle: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  detailContent: {
    alignSelf: "center",
    maxWidth: 620,
    padding: 18,
    paddingBottom: 40,
    width: "100%",
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 17,
  },
  summaryTopRow: { alignItems: "center", flexDirection: "row" },
  summaryHeading: { flex: 1, marginLeft: 12 },
  learnerName: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  summaryMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  reasonTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 17,
  },
  reasonText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 11,
    marginTop: 24,
  },
  informationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  informationRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  informationLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  informationValue: { color: colors.textPrimary, fontSize: 13, marginTop: 4 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  rescheduleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 15,
  },
  rescheduleTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  inputColumn: { flex: 1 },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 11,
  },
  outlineButton: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 11,
  },
  outlineButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  finalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  completeButton: {
    alignItems: "center",
    backgroundColor: `${colors.success}16`,
    borderColor: colors.success,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  completeButtonText: { color: colors.success, fontSize: 12, fontWeight: "800" },
  cancelButton: {
    alignItems: "center",
    backgroundColor: `${colors.error}12`,
    borderColor: colors.error,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  cancelButtonText: { color: colors.error, fontSize: 12, fontWeight: "800" },
  emptyReplies: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  emptyRepliesText: { color: colors.textSecondary, fontSize: 13 },
  repliesList: { gap: 10 },
  replyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  replyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  replySender: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
  replyRole: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  replyMessage: { color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  replyDate: { color: colors.textSecondary, fontSize: 10, marginTop: 8 },
  replyInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 12,
    minHeight: 105,
    padding: 14,
  },
  errorText: { color: colors.error, fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: "center" },
  feedbackText: { color: colors.success, fontSize: 12, marginTop: 10, textAlign: "center" },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  sendButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: "800" },
});
