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
import {
  createAnnouncement,
  getActiveAnnouncementClasses,
  removeAnnouncement,
  setAnnouncementArchived,
  subscribeToAdministratorAnnouncements,
  subscribeToTeacherAnnouncements,
  updateAnnouncement,
} from "@/services/announcement-service";
import { getTeacherAssignments } from "@/services/teacher-service";
import { colors } from "@/theme/colors";
import type {
  Announcement,
  AnnouncementAuthorRole,
  AnnouncementCategory,
  AnnouncementPriority,
  SaveAnnouncementInput,
} from "@/types/announcement";
import type { SchoolClass } from "@/types/school";

type AnnouncementManagerProps = {
  role: AnnouncementAuthorRole;
};

type ManagerView = "list" | "form";

const categories: { label: string; value: AnnouncementCategory }[] = [
  { label: "School", value: "school" },
  { label: "Class", value: "class" },
  { label: "Fees", value: "fees" },
];

const priorities: { label: string; value: AnnouncementPriority }[] = [
  { label: "Normal", value: "normal" },
  { label: "Important", value: "important" },
  { label: "Urgent", value: "urgent" },
];

function toDateInput(value: Announcement["expiresAt"]): string {
  if (!value) {
    return "";
  }

  const date = value.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseOptionalDate(value: string): Date | null {
  const cleanedValue = value.trim();

  if (!cleanedValue) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) {
    throw new Error("The expiry date must use YYYY-MM-DD.");
  }

  const date = new Date(`${cleanedValue}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid expiry date.");
  }

  return date;
}

function formatDate(value: Announcement["publishedAt"]): string {
  if (!value) {
    return "Saving...";
  }

  return value.toDate().toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function priorityColour(priority: AnnouncementPriority): string {
  if (priority === "urgent") {
    return colors.error;
  }

  if (priority === "important") {
    return colors.warning;
  }

  return colors.info;
}

export function AnnouncementManager({ role }: AnnouncementManagerProps) {
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [view, setView] = useState<ManagerView>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>(
    role === "teacher" ? "class" : "school",
  );
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [audience, setAudience] = useState<"allParents" | "class">(
    role === "teacher" ? "class" : "allParents",
  );
  const [targetClassId, setTargetClassId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
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
          const uniqueClasses = loadedClasses.filter(
            (schoolClass, index, allClasses) =>
              allClasses.findIndex((item) => item.id === schoolClass.id) === index,
          );
          setClasses(uniqueClasses);
        }
      } catch (loadError) {
        console.error("Unable to load announcement classes:", loadError);
        if (mounted) {
          setError("Available classes could not be loaded.");
        }
      }
    };

    void loadClasses();

    const unsubscribe =
      role === "admin"
        ? subscribeToAdministratorAnnouncements(
            (items) => {
              setAnnouncements(items);
              setLoading(false);
            },
            (subscriptionError) => {
              console.error("Unable to load announcements:", subscriptionError);
              setError("Announcements could not be loaded.");
              setLoading(false);
            },
          )
        : subscribeToTeacherAnnouncements(
            user.uid,
            (items) => {
              setAnnouncements(items);
              setLoading(false);
            },
            (subscriptionError) => {
              console.error("Unable to load teacher announcements:", subscriptionError);
              setError("Your announcements could not be loaded.");
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
    setEditingId(null);
    setTitle("");
    setSummary("");
    setBody("");
    setCategory(role === "teacher" ? "class" : "school");
    setPriority("normal");
    setAudience(role === "teacher" ? "class" : "allParents");
    setTargetClassId("");
    setExpiryDate("");
    setError("");
    setFeedback("");
  };

  const openCreateForm = () => {
    resetForm();
    setView("form");
  };

  const openEditForm = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setSummary(announcement.summary);
    setBody(announcement.body);
    setCategory(announcement.category);
    setPriority(announcement.priority);
    setAudience(announcement.audience);
    setTargetClassId(announcement.targetClassId);
    setExpiryDate(toDateInput(announcement.expiresAt));
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

    let expiresAt: Date | null;
    try {
      expiresAt = parseOptionalDate(expiryDate);
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "Invalid date.");
      return;
    }

    const effectiveAudience = role === "teacher" ? "class" : audience;
    const input: SaveAnnouncementInput = {
      title,
      summary,
      body,
      category: role === "teacher" ? "class" : category,
      priority,
      audience: effectiveAudience,
      targetClassId: effectiveAudience === "class" ? targetClassId : "",
      targetClassName:
        effectiveAudience === "class" ? selectedClass?.name ?? "" : "",
      expiresAt,
    };

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await updateAnnouncement(editingId, input, role);
      } else {
        await createAnnouncement(
          input,
          user.uid,
          `${user.firstName} ${user.lastName}`.trim() ||
            (role === "admin" ? "Administrator" : "Teacher"),
          role,
        );
      }

      closeForm();
      setFeedback(editingId ? "Announcement updated." : "Announcement published.");
    } catch (saveError) {
      console.error("Unable to save announcement:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The announcement could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (announcement: Announcement) => {
    try {
      setError("");
      await setAnnouncementArchived(
        announcement.id,
        announcement.status === "published",
      );
      setFeedback(
        announcement.status === "published"
          ? "Announcement archived."
          : "Announcement republished.",
      );
    } catch (archiveError) {
      console.error("Unable to change announcement status:", archiveError);
      setError("The announcement status could not be changed.");
    }
  };

  const handleDelete = (announcement: Announcement) => {
    Alert.alert(
      "Delete announcement",
      `Delete “${announcement.title}”? This cannot be undone.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void removeAnnouncement(announcement.id).catch((deleteError) => {
              console.error("Unable to delete announcement:", deleteError);
              setError("The announcement could not be deleted.");
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
              <Text style={styles.eyebrow}>COMMUNICATION CENTRE</Text>
              <Text style={styles.formTitle}>
                {editingId ? "Edit announcement" : "New announcement"}
              </Text>
            </View>
          </View>

          <View style={styles.formBody}>
            <Field label="TITLE">
              <TextInput
                maxLength={120}
                onChangeText={setTitle}
                placeholder="e.g. Sports day arrangements"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={title}
              />
            </Field>

            <Field label="SHORT SUMMARY">
              <TextInput
                maxLength={220}
                onChangeText={setSummary}
                placeholder="A short preview for parents"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={summary}
              />
            </Field>

            <Field label="FULL ANNOUNCEMENT">
              <TextInput
                maxLength={3000}
                multiline
                onChangeText={setBody}
                placeholder="Enter all announcement details..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.bodyInput]}
                textAlignVertical="top"
                value={body}
              />
            </Field>

            {role === "admin" ? (
              <>
                <Field label="CATEGORY">
                  <OptionRow
                    options={categories}
                    selected={category}
                    onSelect={setCategory}
                  />
                </Field>

                <Field label="AUDIENCE">
                  <OptionRow
                    options={[
                      { label: "All parents", value: "allParents" },
                      { label: "One class", value: "class" },
                    ]}
                    selected={audience}
                    onSelect={setAudience}
                  />
                </Field>
              </>
            ) : null}

            <Field label="PRIORITY">
              <OptionRow
                options={priorities}
                selected={priority}
                onSelect={setPriority}
              />
            </Field>

            {(role === "teacher" || audience === "class") ? (
              <Field label="CLASS">
                {classes.length === 0 ? (
                  <Text style={styles.helperText}>No active classes are available.</Text>
                ) : (
                  <View style={styles.classList}>
                    {classes.map((schoolClass) => (
                      <Pressable
                        key={schoolClass.id}
                        onPress={() => setTargetClassId(schoolClass.id)}
                        style={[
                          styles.classButton,
                          targetClassId === schoolClass.id &&
                            styles.classButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.classButtonText,
                            targetClassId === schoolClass.id &&
                              styles.classButtonTextSelected,
                          ]}
                        >
                          {schoolClass.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Field>
            ) : null}

            <Field label="EXPIRY DATE (OPTIONAL)">
              <TextInput
                onChangeText={setExpiryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={expiryDate}
              />
            </Field>

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
                  name="send-outline"
                  size={19}
                />
              )}
              <Text style={styles.saveButtonText}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Publish announcement"}
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
        <View>
          <Text style={styles.eyebrow}>
            {role === "admin" ? "ADMINISTRATOR" : "TEACHER WORKSPACE"}
          </Text>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>
            {role === "admin"
              ? "Publish and manage school communication"
              : "Keep the parents in your classes informed"}
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
            <Text style={styles.emptyText}>Loading announcements...</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons color={colors.textSecondary} name="megaphone-outline" size={42} />
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptyText}>
              Select the plus button to publish the first announcement.
            </Text>
          </View>
        ) : (
          announcements.map((announcement) => {
            const colour = priorityColour(announcement.priority);

            return (
              <View key={announcement.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.priorityDot, { backgroundColor: colour }]} />
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardTitle}>{announcement.title}</Text>
                    <Text style={styles.cardMeta}>
                      {announcement.audience === "class"
                        ? announcement.targetClassName
                        : "All parents"}
                      {" · "}
                      {formatDate(announcement.publishedAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      announcement.status === "archived" && styles.archivedBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>{announcement.status}</Text>
                  </View>
                </View>

                <Text style={styles.cardSummary}>{announcement.summary}</Text>
                <Text style={styles.readCount}>
                  Read by {announcement.readBy.length} parent
                  {announcement.readBy.length === 1 ? "" : "s"}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEditForm(announcement)}
                    style={styles.actionButton}
                  >
                    <Ionicons color={colors.primary} name="create-outline" size={17} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleArchive(announcement)}
                    style={styles.actionButton}
                  >
                    <Ionicons
                      color={colors.primary}
                      name={
                        announcement.status === "published"
                          ? "archive-outline"
                          : "cloud-upload-outline"
                      }
                      size={17}
                    />
                    <Text style={styles.actionText}>
                      {announcement.status === "published" ? "Archive" : "Republish"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(announcement)}
                    style={styles.actionButton}
                  >
                    <Ionicons color={colors.error} name="trash-outline" size={17} />
                    <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
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

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function OptionRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: T }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option.value)}
          style={[
            styles.optionButton,
            selected === option.value && styles.optionButtonSelected,
          ]}
        >
          <Text
            style={[
              styles.optionText,
              selected === option.value && styles.optionTextSelected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 25,
    paddingHorizontal: 21,
    paddingTop: 20,
  },
  eyebrow: {
    color: colors.accentLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: colors.textOnPrimary, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.primaryLight, fontSize: 12, marginTop: 5 },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  feedbackText: {
    backgroundColor: "#E8F5E9",
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
    padding: 11,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#FDECEC",
    color: colors.error,
    fontSize: 12,
    padding: 11,
    textAlign: "center",
  },
  list: { backgroundColor: colors.background, flexGrow: 1, padding: 20 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800", marginTop: 14 },
  emptyText: { color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 13,
    padding: 16,
  },
  cardTop: { alignItems: "flex-start", flexDirection: "row" },
  priorityDot: { borderRadius: 5, height: 10, marginRight: 9, marginTop: 5, width: 10 },
  cardHeading: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  cardMeta: { color: colors.textSecondary, fontSize: 10, marginTop: 5 },
  statusBadge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  archivedBadge: { backgroundColor: colors.surfaceMuted },
  statusText: { color: colors.primary, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  cardSummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 12 },
  readCount: { color: colors.textSecondary, fontSize: 10, marginTop: 10 },
  cardActions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: 14, marginTop: 14, paddingTop: 12 },
  actionButton: { alignItems: "center", flexDirection: "row", gap: 5 },
  actionText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  formScroll: { backgroundColor: colors.background, flexGrow: 1 },
  formHeader: { alignItems: "center", backgroundColor: colors.primary, flexDirection: "row", gap: 14, padding: 21 },
  backButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.13)", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  formTitle: { color: colors.textOnPrimary, fontSize: 23, fontWeight: "800", marginTop: 4 },
  formBody: { padding: 20 },
  field: { marginBottom: 18 },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, color: colors.textPrimary, fontSize: 13, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  bodyInput: { minHeight: 135 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  optionButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  optionTextSelected: { color: colors.textOnPrimary },
  classList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  classButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  classButtonSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  classButtonText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  classButtonTextSelected: { color: colors.primary },
  helperText: { color: colors.textSecondary, fontSize: 12 },
  errorText: { color: colors.error, fontSize: 12, marginBottom: 14, textAlign: "center" },
  saveButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 52 },
  saveButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
