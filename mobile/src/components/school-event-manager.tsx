import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { getActiveAnnouncementClasses } from "@/services/announcement-service";
import {
  createSchoolEvent,
  removeSchoolEvent,
  setSchoolEventCancelled,
  subscribeToAdministratorSchoolEvents,
  subscribeToTeacherSchoolEvents,
  updateSchoolEvent,
} from "@/services/school-event-service";
import { getTeacherAssignments } from "@/services/teacher-service";
import { colors } from "@/theme/colors";
import type {
  SaveSchoolEventInput,
  SchoolEvent,
  SchoolEventAuthorRole,
  SchoolEventCategory,
} from "@/types/school-event";
import type { SchoolClass } from "@/types/school";

type SchoolEventManagerProps = {
  role: SchoolEventAuthorRole;
};

type ManagerView = "list" | "form";

type Option<T extends string> = {
  label: string;
  value: T;
};

const categories: Option<SchoolEventCategory>[] = [
  { label: "Academic", value: "academic" },
  { label: "Sport", value: "sport" },
  { label: "Meeting", value: "meeting" },
  { label: "Holiday", value: "holiday" },
  { label: "Other", value: "other" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInput(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}`;
}

function toTimeInput(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function createDefaultDates(): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(9, 0, 0, 0);

  return {
    startDate: toDateInput(start),
    startTime: toTimeInput(start),
    endDate: toDateInput(end),
    endTime: toTimeInput(end),
  };
}

function parseDateTime(dateValue: string, timeValue: string, label: string): Date {
  const cleanedDate = dateValue.trim();
  const cleanedTime = timeValue.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedDate)) {
    throw new Error(`${label} date must use YYYY-MM-DD.`);
  }

  if (!/^\d{2}:\d{2}$/.test(cleanedTime)) {
    throw new Error(`${label} time must use HH:MM.`);
  }

  const value = new Date(`${cleanedDate}T${cleanedTime}:00`);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Enter a valid ${label.toLowerCase()} date and time.`);
  }

  const [year, month, day] = cleanedDate.split("-").map(Number);
  const [hour, minute] = cleanedTime.split(":").map(Number);

  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    throw new Error(`Enter a valid ${label.toLowerCase()} date and time.`);
  }

  return value;
}

function formatEventDate(event: SchoolEvent): string {
  const start = event.startAt?.toDate();
  const end = event.endAt?.toDate();

  if (!start) {
    return "Date pending";
  }

  const date = start.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endTime = end?.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${date} · ${startTime}${endTime ? ` - ${endTime}` : ""}`;
}

function categoryColour(category: SchoolEventCategory): string {
  if (category === "academic") {
    return colors.info;
  }

  if (category === "sport") {
    return colors.success;
  }

  if (category === "meeting") {
    return colors.warning;
  }

  if (category === "holiday") {
    return colors.accent;
  }

  return colors.primary;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function OptionRow<T extends string>({
  onSelect,
  options,
  selected,
}: {
  onSelect: (value: T) => void;
  options: Option<T>[];
  selected: T;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.optionButton, active && styles.optionButtonActive]}
          >
            <Text
              style={[
                styles.optionButtonText,
                active && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SchoolEventManager({ role }: SchoolEventManagerProps) {
  const { user } = useAuth();
  const defaults = useMemo(() => createDefaultDates(), []);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [view, setView] = useState<ManagerView>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<SchoolEventCategory>("academic");
  const [audience, setAudience] = useState<"allParents" | "class">(
    role === "teacher" ? "class" : "allParents",
  );
  const [targetClassId, setTargetClassId] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let mounted = true;

    const loadClasses = async () => {
      try {
        const loadedClasses =
          role === "admin"
            ? await getActiveAnnouncementClasses()
            : (await getTeacherAssignments(user.uid)).map(
                (assignment) => assignment.schoolClass,
              );

        if (mounted) {
          setClasses(
            loadedClasses.filter(
              (schoolClass, index, allClasses) =>
                allClasses.findIndex((item) => item.id === schoolClass.id) ===
                index,
            ),
          );
        }
      } catch (loadError) {
        console.error("Unable to load calendar classes:", loadError);
        if (mounted) {
          setError("Available classes could not be loaded.");
        }
      }
    };

    void loadClasses();

    const unsubscribe =
      role === "admin"
        ? subscribeToAdministratorSchoolEvents(
            (items) => {
              setEvents(items);
              setLoading(false);
            },
            (subscriptionError) => {
              console.error("Unable to load school events:", subscriptionError);
              setError("School events could not be loaded.");
              setLoading(false);
            },
          )
        : subscribeToTeacherSchoolEvents(
            user.uid,
            (items) => {
              setEvents(items);
              setLoading(false);
            },
            (subscriptionError) => {
              console.error(
                "Unable to load teacher school events:",
                subscriptionError,
              );
              setError("Your school events could not be loaded.");
              setLoading(false);
            },
          );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [role, user]);

  const selectedClass = useMemo(
    () => classes.find((schoolClass) => schoolClass.id === targetClassId) ?? null,
    [classes, targetClassId],
  );

  const resetForm = () => {
    const nextDefaults = createDefaultDates();
    setEditingId(null);
    setTitle("");
    setDescription("");
    setLocation("");
    setCategory("academic");
    setAudience(role === "teacher" ? "class" : "allParents");
    setTargetClassId("");
    setStartDate(nextDefaults.startDate);
    setStartTime(nextDefaults.startTime);
    setEndDate(nextDefaults.endDate);
    setEndTime(nextDefaults.endTime);
    setError("");
  };

  const openCreateForm = () => {
    resetForm();
    setFeedback("");
    setView("form");
  };

  const openEditForm = (event: SchoolEvent) => {
    const start = event.startAt?.toDate();
    const end = event.endAt?.toDate();

    if (!start || !end) {
      setError("This event has incomplete date information.");
      return;
    }

    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    setLocation(event.location);
    setCategory(event.category);
    setAudience(event.audience);
    setTargetClassId(event.targetClassId);
    setStartDate(toDateInput(start));
    setStartTime(toTimeInput(start));
    setEndDate(toDateInput(end));
    setEndTime(toTimeInput(end));
    setError("");
    setFeedback("");
    setView("form");
  };

  const closeForm = () => {
    resetForm();
    setView("list");
  };

  const handleSave = async () => {
    if (!user || saving) {
      return;
    }

    let parsedStart: Date;
    let parsedEnd: Date;

    try {
      parsedStart = parseDateTime(startDate, startTime, "Start");
      parsedEnd = parseDateTime(endDate, endTime, "End");
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Invalid event date.",
      );
      return;
    }

    const effectiveAudience = role === "teacher" ? "class" : audience;
    const input: SaveSchoolEventInput = {
      title,
      description,
      location,
      category,
      startAt: parsedStart,
      endAt: parsedEnd,
      audience: effectiveAudience,
      targetClassId: effectiveAudience === "class" ? targetClassId : "",
      targetClassName:
        effectiveAudience === "class" ? selectedClass?.name ?? "" : "",
    };

    const eventWasEdited = editingId !== null;

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await updateSchoolEvent(editingId, input, role);
      } else {
        await createSchoolEvent(
          input,
          user.uid,
          `${user.firstName} ${user.lastName}`.trim() ||
            (role === "admin" ? "Administrator" : "Teacher"),
          role,
        );
      }

      closeForm();
      setFeedback(eventWasEdited ? "Event updated." : "Event scheduled.");
    } catch (saveError) {
      console.error("Unable to save school event:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The event could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (event: SchoolEvent) => {
    try {
      setError("");
      const shouldCancel = event.status === "scheduled";
      await setSchoolEventCancelled(event.id, shouldCancel);
      setFeedback(shouldCancel ? "Event cancelled." : "Event restored.");
    } catch (statusError) {
      console.error("Unable to change event status:", statusError);
      setError("The event status could not be changed.");
    }
  };

  const handleDelete = (event: SchoolEvent) => {
    Alert.alert(
      "Delete event",
      `Delete “${event.title}”? This cannot be undone.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void removeSchoolEvent(event.id).catch((deleteError) => {
              console.error("Unable to delete school event:", deleteError);
              setError("The event could not be deleted.");
            });
          },
        },
      ],
    );
  };

  if (view === "form") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.formScroll}>
          <View style={styles.formHeader}>
            <Pressable onPress={closeForm} style={styles.backButton}>
              <Ionicons color={colors.textOnPrimary} name="arrow-back" size={23} />
            </Pressable>
            <View>
              <Text style={styles.eyebrow}>SCHOOL CALENDAR</Text>
              <Text style={styles.formTitle}>
                {editingId ? "Edit event" : "Schedule event"}
              </Text>
            </View>
          </View>

          <View style={styles.formBody}>
            <Field label="EVENT TITLE">
              <TextInput
                maxLength={120}
                onChangeText={setTitle}
                placeholder="e.g. Inter-school athletics"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={title}
              />
            </Field>

            <Field label="DESCRIPTION">
              <TextInput
                maxLength={1000}
                multiline
                onChangeText={setDescription}
                placeholder="Provide the important event details..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.descriptionInput]}
                textAlignVertical="top"
                value={description}
              />
            </Field>

            <Field label="LOCATION">
              <TextInput
                maxLength={150}
                onChangeText={setLocation}
                placeholder="e.g. School sports field"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={location}
              />
            </Field>

            <Field label="CATEGORY">
              <OptionRow
                onSelect={setCategory}
                options={categories}
                selected={category}
              />
            </Field>

            {role === "admin" ? (
              <Field label="AUDIENCE">
                <OptionRow
                  onSelect={setAudience}
                  options={[
                    { label: "All parents", value: "allParents" },
                    { label: "One class", value: "class" },
                  ]}
                  selected={audience}
                />
              </Field>
            ) : null}

            {role === "teacher" || audience === "class" ? (
              <Field label="CLASS">
                {classes.length === 0 ? (
                  <Text style={styles.helperText}>
                    No active classes are available.
                  </Text>
                ) : (
                  <View style={styles.classList}>
                    {classes.map((schoolClass) => {
                      const selected = targetClassId === schoolClass.id;
                      return (
                        <Pressable
                          key={schoolClass.id}
                          onPress={() => setTargetClassId(schoolClass.id)}
                          style={[
                            styles.classButton,
                            selected && styles.classButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.classButtonText,
                              selected && styles.classButtonTextSelected,
                            ]}
                          >
                            {schoolClass.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Field>
            ) : null}

            <View style={styles.dateRow}>
              <View style={styles.dateColumn}>
                <Field label="START DATE">
                  <TextInput
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={startDate}
                  />
                </Field>
              </View>
              <View style={styles.timeColumn}>
                <Field label="START TIME">
                  <TextInput
                    onChangeText={setStartTime}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={startTime}
                  />
                </Field>
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateColumn}>
                <Field label="END DATE">
                  <TextInput
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={endDate}
                  />
                </Field>
              </View>
              <View style={styles.timeColumn}>
                <Field label="END TIME">
                  <TextInput
                    onChangeText={setEndTime}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={endTime}
                  />
                </Field>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              disabled={saving}
              onPress={() => void handleSave()}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Ionicons
                  color={colors.textOnPrimary}
                  name="calendar-outline"
                  size={19}
                />
              )}
              <Text style={styles.saveButtonText}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Schedule event"}
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
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            {role === "admin" ? "ADMINISTRATOR" : "TEACHER WORKSPACE"}
          </Text>
          <Text style={styles.title}>School Calendar</Text>
          <Text style={styles.subtitle}>
            {role === "admin"
              ? "Schedule and manage school or class events"
              : "Schedule events for your assigned classes"}
          </Text>
        </View>
        <Pressable onPress={openCreateForm} style={styles.addButton}>
          <Ionicons color={colors.primary} name="add" size={25} />
        </Pressable>
      </View>

      {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.emptyText}>Loading school events...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              color={colors.textSecondary}
              name="calendar-outline"
              size={42}
            />
            <Text style={styles.emptyTitle}>No events scheduled</Text>
            <Text style={styles.emptyText}>
              Select the plus button to schedule the first event.
            </Text>
          </View>
        ) : (
          events.map((event) => {
            const colour = categoryColour(event.category);
            return (
              <View key={event.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.categoryDot, { backgroundColor: colour }]} />
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardTitle}>{event.title}</Text>
                    <Text style={styles.cardMeta}>{formatEventDate(event)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      event.status === "cancelled" && styles.cancelledBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>{event.status}</Text>
                  </View>
                </View>

                <Text style={styles.cardDescription}>{event.description}</Text>
                <Text style={styles.cardDetail}>
                  {event.location} · {event.audience === "class"
                    ? event.targetClassName
                    : "All parents"}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => openEditForm(event)}
                    style={styles.actionButton}
                  >
                    <Ionicons color={colors.primary} name="create-outline" size={17} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleStatusChange(event)}
                    style={styles.actionButton}
                  >
                    <Ionicons
                      color={colors.warning}
                      name={event.status === "scheduled" ? "close-circle-outline" : "refresh-outline"}
                      size={17}
                    />
                    <Text style={styles.actionText}>
                      {event.status === "scheduled" ? "Cancel" : "Restore"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(event)}
                    style={styles.actionButton}
                  >
                    <Ionicons color={colors.error} name="trash-outline" size={17} />
                    <Text style={styles.actionText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerText: { flex: 1, paddingRight: 12 },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  title: {
    color: colors.textOnPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 3,
  },
  subtitle: {
    color: colors.textOnPrimary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    opacity: 0.82,
  },
  addButton: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 15,
  },
  list: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    padding: 17,
    paddingBottom: 110,
  },
  feedbackText: {
    color: colors.success,
    backgroundColor: colors.primaryLight,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  errorBanner: {
    color: colors.error,
    backgroundColor: colors.surface,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 28,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 7,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 13,
    padding: 16,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  categoryDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, marginRight: 10 },
  cardHeading: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  cardMeta: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cancelledBadge: { backgroundColor: `${colors.error}18` },
  statusText: {
    color: colors.textPrimary,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  cardDetail: { color: colors.primary, fontSize: 10, fontWeight: "700", marginTop: 9 },
  actions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 11,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 37,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  actionText: { color: colors.textPrimary, fontSize: 9, fontWeight: "700" },
  formScroll: { flexGrow: 1, backgroundColor: colors.background, paddingBottom: 35 },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 17,
    paddingVertical: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  formTitle: { color: colors.textOnPrimary, fontSize: 21, fontWeight: "800", marginTop: 2 },
  formBody: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    padding: 18,
  },
  field: { marginBottom: 17 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  descriptionInput: { minHeight: 105 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionButtonText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  optionButtonTextActive: { color: colors.textOnPrimary },
  classList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  classButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  classButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  classButtonText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  classButtonTextSelected: { color: colors.textOnPrimary },
  helperText: { color: colors.textSecondary, fontSize: 11 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateColumn: { flex: 1.35 },
  timeColumn: { flex: 0.85 },
  errorText: { color: colors.error, fontSize: 11, lineHeight: 17, marginBottom: 13 },
  saveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 13,
  },
  saveButtonText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
