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
  subscribeToAdministratorRequests,
  subscribeToRequestReplies,
  updateParentRequestStatus,
} from "@/services/parent-request-service";
import { colors } from "@/theme/colors";
import type {
  ParentRequestReply,
  ParentRequestStatus,
  ParentRequestType,
  ParentServiceRequest,
} from "@/types/school";

type RequestFilter = "all" | ParentRequestType;

const requestTypeLabels: Record<ParentRequestType, string> = {
  generalQuery: "General query",
  absenceReport: "Absence report",
  teacherAppointment: "Teacher appointment",
};

const requestTypeIcons: Record<
  ParentRequestType,
  keyof typeof Ionicons.glyphMap
> = {
  generalQuery: "help-circle-outline",
  absenceReport: "medkit-outline",
  teacherAppointment: "calendar-outline",
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

const filters: { label: string; value: RequestFilter }[] = [
  { label: "All", value: "all" },
  { label: "Queries", value: "generalQuery" },
  { label: "Absences", value: "absenceReport" },
  { label: "Appointments", value: "teacherAppointment" },
];

function formatDate(value: ParentServiceRequest["createdAt"]): string {
  if (!value) {
    return "Pending timestamp";
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

function getStatusColour(status: ParentRequestStatus): string {
  if (["resolved", "completed", "approved"].includes(status)) {
    return colors.success;
  }

  if (["cancelled", "declined"].includes(status)) {
    return colors.error;
  }

  if (["inReview", "responded", "confirmed"].includes(status)) {
    return colors.info;
  }

  return colors.warning;
}

function getStatusActions(
  request: ParentServiceRequest,
): { label: string; status: ParentRequestStatus }[] {
  if (request.requestType === "teacherAppointment") {
    return [
      { label: "Confirm", status: "confirmed" },
      { label: "Complete", status: "completed" },
      { label: "Cancel", status: "cancelled" },
    ];
  }

  return [
    { label: "Review", status: "inReview" },
    { label: "Responded", status: "responded" },
    { label: "Resolve", status: "resolved" },
  ];
}

export default function AdminRequestsScreen() {
  const { user } = useAuth();

  const [requests, setRequests] = useState<ParentServiceRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [replies, setReplies] = useState<ParentRequestReply[]>([]);
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingReply, setSavingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    return subscribeToAdministratorRequests(
      (loadedRequests) => {
        setRequests(loadedRequests);
        setLoading(false);
        setError("");
      },
      (requestError) => {
        console.error("Unable to load parent requests:", requestError);
        setError("Parent requests could not be loaded. Please try again.");
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedRequestId) {
      return undefined;
    }

    return subscribeToRequestReplies(
      selectedRequestId,
      (loadedReplies) => {
        setReplies(loadedReplies);
      },
      (replyError) => {
        console.error("Unable to load request replies:", replyError);
        setError("Replies for this request could not be loaded.");
      },
    );
  }, [selectedRequestId]);

  const selectedRequest = useMemo(
    () =>
      requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const filteredRequests = useMemo(
    () =>
      filter === "all"
        ? requests
        : requests.filter((request) => request.requestType === filter),
    [filter, requests],
  );

  const openRequest = (requestId: string) => {
    setReplies([]);
    setReply("");
    setError("");
    setFeedback("");
    setSelectedRequestId(requestId);
  };

  const closeRequest = () => {
    setSelectedRequestId(null);
    setReplies([]);
    setReply("");
    setError("");
    setFeedback("");
  };

  const handleSendReply = async () => {
    if (!selectedRequest || !user || savingReply) {
      return;
    }

    try {
      setSavingReply(true);
      setError("");
      setFeedback("");

      await addRequestReply(
        selectedRequest.id,
        user.uid,
        "administrator",
        `${user.firstName} ${user.lastName}`.trim() || "Administrator",
        reply,
      );

      setReply("");
      setFeedback("Your response was sent to the parent.");
    } catch (replyError) {
      console.error("Unable to send administrator response:", replyError);
      setError(
        replyError instanceof Error
          ? replyError.message
          : "The response could not be sent.",
      );
    } finally {
      setSavingReply(false);
    }
  };

  const handleStatusUpdate = async (status: ParentRequestStatus) => {
    if (!selectedRequest || updatingStatus) {
      return;
    }

    try {
      setUpdatingStatus(true);
      setError("");
      setFeedback("");

      await updateParentRequestStatus(selectedRequest.id, status);
      setFeedback(`Request marked as ${statusLabels[status].toLowerCase()}.`);
    } catch (statusError) {
      console.error("Unable to update parent request status:", statusError);
      setError("The request status could not be updated.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (selectedRequest) {
    const statusColour = getStatusColour(selectedRequest.status);
    const statusActions = getStatusActions(selectedRequest);

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailHeader}>
            <Pressable
              accessibilityLabel="Return to request inbox"
              accessibilityRole="button"
              onPress={closeRequest}
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
              <Text style={styles.headerEyebrow}>PARENT REQUEST</Text>
              <Text style={styles.detailHeaderTitle}>
                {selectedRequest.referenceNumber}
              </Text>
            </View>
          </View>

          <View style={styles.detailContent}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.typeIcon}>
                  <Ionicons
                    color={colors.primary}
                    name={requestTypeIcons[selectedRequest.requestType]}
                    size={23}
                  />
                </View>

                <View style={styles.summaryHeading}>
                  <Text style={styles.requestTypeText}>
                    {requestTypeLabels[selectedRequest.requestType]}
                  </Text>
                  <Text style={styles.requestDateText}>
                    {formatDateTime(selectedRequest.createdAt)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColour}18` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColour }]}>
                    {statusLabels[selectedRequest.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailSubject}>{selectedRequest.subject}</Text>
              <Text style={styles.detailDescription}>
                {selectedRequest.description}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Request information</Text>

            <View style={styles.informationCard}>
              <InformationRow
                label="Learner"
                value={`${selectedRequest.learnerFirstName} ${selectedRequest.learnerLastName}`.trim()}
              />
              <InformationRow
                label="Student number"
                value={selectedRequest.studentNumber}
              />
              <InformationRow label="Class" value={selectedRequest.className} />

              {selectedRequest.category ? (
                <InformationRow
                  label="Category"
                  value={selectedRequest.category}
                />
              ) : null}

              {selectedRequest.absenceReason ? (
                <>
                  <InformationRow
                    label="Absence reason"
                    value={selectedRequest.absenceReason}
                  />
                  <InformationRow
                    label="Absence dates"
                    value={`${formatDate(selectedRequest.absenceStartDate)} – ${formatDate(selectedRequest.absenceEndDate)}`}
                  />
                </>
              ) : null}

              {selectedRequest.teacherUid ? (
                <>
                  <InformationRow
                    label="Assigned teacher"
                    value={selectedRequest.teacherName}
                  />
                  <InformationRow
                    label="Subject"
                    value={selectedRequest.teacherSubject}
                  />
                  <InformationRow
                    label="Requested appointment"
                    value={`${formatDate(selectedRequest.requestedAppointmentDate)} at ${selectedRequest.requestedAppointmentTime}`}
                  />
                </>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Update status</Text>

            <View style={styles.statusActions}>
              {statusActions.map((action) => {
                const selected = selectedRequest.status === action.status;

                return (
                  <Pressable
                    key={action.status}
                    accessibilityRole="button"
                    disabled={updatingStatus || selected}
                    onPress={() => handleStatusUpdate(action.status)}
                    style={({ pressed }) => [
                      styles.statusAction,
                      selected && styles.statusActionSelected,
                      pressed && !selected && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusActionText,
                        selected && styles.statusActionTextSelected,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Responses</Text>

            {replies.length === 0 ? (
              <View style={styles.emptyReplies}>
                <Text style={styles.emptyRepliesText}>
                  No responses have been added yet.
                </Text>
              </View>
            ) : (
              <View style={styles.repliesList}>
                {replies.map((requestReply) => (
                  <View key={requestReply.id} style={styles.replyCard}>
                    <View style={styles.replyHeader}>
                      <Text style={styles.replySender}>
                        {requestReply.senderName}
                      </Text>
                      <Text style={styles.replyRole}>
                        {requestReply.senderRole}
                      </Text>
                    </View>
                    <Text style={styles.replyMessage}>{requestReply.message}</Text>
                    <Text style={styles.replyDate}>
                      {formatDateTime(requestReply.createdAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TextInput
              accessibilityLabel="Response to parent"
              multiline
              onChangeText={setReply}
              placeholder="Write a clear response to the parent..."
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
              disabled={savingReply || reply.trim().length === 0}
              onPress={handleSendReply}
              style={({ pressed }) => [
                styles.sendButton,
                (savingReply || reply.trim().length === 0) &&
                  styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {savingReply ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <Ionicons
                  color={colors.textOnPrimary}
                  name="send-outline"
                  size={19}
                />
              )}
              <Text style={styles.sendButtonText}>
                {savingReply ? "Sending..." : "Send response"}
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
        <Text style={styles.headerEyebrow}>ADMINISTRATION</Text>
        <Text style={styles.headerTitle}>Parent requests</Text>
        <Text style={styles.headerSubtitle}>
          Review queries, absences and teacher appointments.
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
                accessibilityRole="button"
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
            <Text style={styles.centerStateText}>Loading requests...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons color={colors.error} name="alert-circle" size={34} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons
              color={colors.textSecondary}
              name="file-tray-outline"
              size={38}
            />
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.centerStateText}>
              New parent requests will appear here automatically.
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const statusColour = getStatusColour(request.status);

            return (
              <Pressable
                key={request.id}
                accessibilityRole="button"
                onPress={() => openRequest(request.id)}
                style={({ pressed }) => [
                  styles.requestCard,
                  pressed && styles.requestCardPressed,
                ]}
              >
                <View style={styles.requestIcon}>
                  <Ionicons
                    color={colors.primary}
                    name={requestTypeIcons[request.requestType]}
                    size={22}
                  />
                </View>

                <View style={styles.requestCardContent}>
                  <View style={styles.requestCardTopRow}>
                    <Text style={styles.requestReference}>
                      {request.referenceNumber}
                    </Text>
                    <Text style={styles.requestDateText}>
                      {formatDate(request.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.requestCardTitle} numberOfLines={1}>
                    {request.subject}
                  </Text>
                  <Text style={styles.requestLearner}>
                    {request.learnerFirstName} {request.learnerLastName} · {" "}
                    {request.className}
                  </Text>

                  <View style={styles.requestCardFooter}>
                    <Text style={styles.requestTypeSmall}>
                      {requestTypeLabels[request.requestType]}
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
                        {statusLabels[request.status]}
                      </Text>
                    </View>
                  </View>
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
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
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
  centerStateText: {
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
  requestCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 15,
  },
  requestCardPressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  requestIcon: {
    alignItems: "center",
    backgroundColor: `${colors.primary}12`,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  requestCardContent: { flex: 1 },
  requestCardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  requestReference: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  requestDateText: { color: colors.textSecondary, fontSize: 11 },
  requestCardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 5,
  },
  requestLearner: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  requestCardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  requestTypeSmall: { color: colors.textSecondary, fontSize: 11 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "800" },
  detailScrollContent: { flexGrow: 1, backgroundColor: colors.background },
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
  detailHeaderTitle: {
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
  typeIcon: {
    alignItems: "center",
    backgroundColor: `${colors.primary}12`,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  summaryHeading: { flex: 1, marginLeft: 12 },
  requestTypeText: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  detailSubject: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 18,
  },
  detailDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
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
    textTransform: "uppercase",
  },
  informationValue: { color: colors.textPrimary, fontSize: 13, marginTop: 4 },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  statusAction: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusActionSelected: { backgroundColor: colors.primary },
  statusActionText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  statusActionTextSelected: { color: colors.textOnPrimary },
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
    minHeight: 110,
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
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: "800" },
});
