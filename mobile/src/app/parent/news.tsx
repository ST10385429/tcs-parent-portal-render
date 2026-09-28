import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import {
  markAnnouncementRead,
  subscribeToParentAnnouncements,
} from "@/services/announcement-service";
import { getParentLearners } from "@/services/learner-service";
import { colors } from "@/theme/colors";
import type {
  Announcement,
  AnnouncementCategory,
} from "@/types/announcement";

type NoticeFilter = "all" | AnnouncementCategory;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const filters: { label: string; value: NoticeFilter }[] = [
  { label: "All", value: "all" },
  { label: "School-wide", value: "school" },
  { label: "Class", value: "class" },
  { label: "Fees", value: "fees" },
];

const categoryDetails: Record<
  AnnouncementCategory,
  {
    background: string;
    foreground: string;
    icon: IoniconName;
    label: string;
  }
> = {
  school: {
    background: colors.primaryLight,
    foreground: colors.primary,
    icon: "megaphone-outline",
    label: "SCHOOL-WIDE",
  },
  class: {
    background: colors.accentLight,
    foreground: colors.warning,
    icon: "school-outline",
    label: "CLASS",
  },
  fees: {
    background: "#FBE9E7",
    foreground: colors.error,
    icon: "wallet-outline",
    label: "FEES",
  },
};

function formatPublishedTime(announcement: Announcement): string {
  if (!announcement.publishedAt) {
    return "Just now";
  }

  const publishedDate = announcement.publishedAt.toDate();
  const difference = Date.now() - publishedDate.getTime();
  const days = Math.floor(difference / 86_400_000);

  if (days <= 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return publishedDate.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function priorityLabel(announcement: Announcement): string {
  if (announcement.priority === "urgent") {
    return "URGENT";
  }

  if (announcement.priority === "important") {
    return "IMPORTANT";
  }

  return "NEW";
}

export default function ParentNewsScreen() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [learnerNames, setLearnerNames] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<NoticeFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    getParentLearners(user.uid)
      .then((learners) => {
        if (!mounted) {
          return;
        }

        setLearnerNames(
          learners.map((learner) => `${learner.firstName} ${learner.lastName}`),
        );

        const classIds = learners
          .map((learner) => learner.currentClassId)
          .filter((classId, index, allIds) =>
            Boolean(classId) && allIds.indexOf(classId) === index,
          );

        unsubscribe = subscribeToParentAnnouncements(
          classIds,
          (loadedAnnouncements) => {
            setAnnouncements(loadedAnnouncements);
            setLoading(false);
            setError("");
          },
          (subscriptionError) => {
            console.error("Unable to load parent announcements:", subscriptionError);
            setError("Announcements could not be loaded.");
            setLoading(false);
          },
        );
      })
      .catch((loadError) => {
        console.error("Unable to load learners for announcements:", loadError);
        if (mounted) {
          setError("Your linked learners could not be loaded.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [user]);

  const filteredAnnouncements = useMemo(() => {
    if (selectedFilter === "all") {
      return announcements;
    }

    return announcements.filter(
      (announcement) => announcement.category === selectedFilter,
    );
  }, [announcements, selectedFilter]);

  const unreadCount = useMemo(
    () =>
      announcements.filter(
        (announcement) => user && !announcement.readBy.includes(user.uid),
      ).length,
    [announcements, user],
  );

  const subtitle =
    learnerNames.length === 0
      ? "Announcements for your family"
      : `Notices for ${learnerNames.join(" and ")}`;

  const toggleAnnouncement = (announcement: Announcement) => {
    setExpandedId((currentId) =>
      currentId === announcement.id ? null : announcement.id,
    );

    if (user && !announcement.readBy.includes(user.uid)) {
      void markAnnouncementRead(announcement.id, user.uid).catch((readError) => {
        console.error("Unable to mark announcement as read:", readError);
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>PARENT PORTAL</Text>
              <Text style={styles.title}>Announcements</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.unreadBadge}>
              <Text style={styles.unreadNumber}>{unreadCount}</Text>
              <Text style={styles.unreadLabel}>NEW</Text>
            </View>
          </View>

          <View style={styles.liveStatus}>
            <Ionicons
              color={colors.primaryLight}
              name="radio-outline"
              size={15}
            />
            <Text style={styles.liveStatusText}>Live updates enabled</Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <ScrollView
            contentContainerStyle={styles.filterContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {filters.map((filter) => {
              const selected = selectedFilter === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setSelectedFilter(filter.value)}
                  style={[
                    styles.filterButton,
                    selected && styles.filterButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selected && styles.filterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={styles.noticeList}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.stateText}>Loading announcements...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Ionicons color={colors.error} name="alert-circle-outline" size={38} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : filteredAnnouncements.length === 0 ? (
            <View style={styles.stateContainer}>
              <Ionicons
                color={colors.textSecondary}
                name="newspaper-outline"
                size={42}
              />
              <Text style={styles.emptyTitle}>No announcements</Text>
              <Text style={styles.stateText}>
                New notices from the school will appear here automatically.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultText}>
                {filteredAnnouncements.length}{" "}
                {filteredAnnouncements.length === 1
                  ? "announcement"
                  : "announcements"}
              </Text>

              {filteredAnnouncements.map((announcement) => {
                const expanded = expandedId === announcement.id;
                const unread = Boolean(
                  user && !announcement.readBy.includes(user.uid),
                );
                const category = categoryDetails[announcement.category];
                const categoryLabel =
                  announcement.audience === "class"
                    ? announcement.targetClassName.toUpperCase()
                    : category.label;

                return (
                  <Pressable
                    key={announcement.id}
                    onPress={() => toggleAnnouncement(announcement)}
                    style={[styles.noticeCard, unread && styles.unreadCard]}
                  >
                    <View style={styles.noticeTop}>
                      <View
                        style={[
                          styles.noticeIcon,
                          { backgroundColor: category.background },
                        ]}
                      >
                        <Ionicons
                          color={category.foreground}
                          name={category.icon}
                          size={20}
                        />
                      </View>

                      <View style={styles.noticeHeading}>
                        <View style={styles.categoryRow}>
                          <View
                            style={[
                              styles.categoryBadge,
                              { backgroundColor: category.background },
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryText,
                                { color: category.foreground },
                              ]}
                            >
                              {categoryLabel}
                            </Text>
                          </View>
                          {unread ? (
                            <View style={styles.newIndicator}>
                              <Text style={styles.newIndicatorText}>
                                {priorityLabel(announcement)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.noticeTime}>
                          {formatPublishedTime(announcement)} · {announcement.authorName}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.noticeTitle}>{announcement.title}</Text>
                    <Text style={styles.noticeSummary}>{announcement.summary}</Text>

                    {expanded ? (
                      <View style={styles.expandedContent}>
                        <View style={styles.divider} />
                        <Text style={styles.noticeDetails}>{announcement.body}</Text>
                      </View>
                    ) : null}

                    <View style={styles.noticeFooter}>
                      <Text style={styles.readMore}>
                        {expanded ? "Show less" : "Read more"}
                      </Text>
                      <Ionicons
                        color={colors.primary}
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 20 },
  headerTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerText: { flex: 1, paddingRight: 15 },
  eyebrow: { color: colors.accentLight, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: colors.textOnPrimary, fontSize: 27, fontWeight: "800", marginTop: 6 },
  subtitle: { color: colors.primaryLight, fontSize: 12, marginTop: 5 },
  unreadBadge: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 26, height: 52, justifyContent: "center", width: 52 },
  unreadNumber: { color: colors.primaryDark, fontSize: 18, fontWeight: "800", lineHeight: 20 },
  unreadLabel: { color: colors.primaryDark, fontSize: 8, fontWeight: "800" },
  liveStatus: { alignItems: "center", flexDirection: "row", marginTop: 18 },
  liveStatusText: { color: colors.primaryLight, fontSize: 11, marginLeft: 7 },
  filterSection: { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 },
  filterContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  filterButton: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 20, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 16 },
  filterButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: colors.textOnPrimary },
  noticeList: { alignSelf: "center", maxWidth: 520, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 18, width: "100%" },
  stateContainer: { alignItems: "center", paddingHorizontal: 20, paddingTop: 75 },
  stateText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 10, textAlign: "center" },
  errorText: { color: colors.error, fontSize: 12, marginTop: 10, textAlign: "center" },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800", marginTop: 12 },
  resultText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 12 },
  noticeCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 19, borderWidth: 1, marginBottom: 13, padding: 17 },
  unreadCard: { borderLeftColor: colors.accent, borderLeftWidth: 4 },
  noticeTop: { alignItems: "center", flexDirection: "row" },
  noticeIcon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  noticeHeading: { flex: 1, marginLeft: 11 },
  categoryRow: { alignItems: "center", flexDirection: "row" },
  categoryBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  categoryText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  newIndicator: { backgroundColor: colors.error, borderRadius: 8, marginLeft: 7, paddingHorizontal: 6, paddingVertical: 3 },
  newIndicatorText: { color: colors.textOnPrimary, fontSize: 7, fontWeight: "800" },
  noticeTime: { color: colors.textSecondary, fontSize: 10, marginTop: 5 },
  noticeTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", lineHeight: 22, marginTop: 14 },
  noticeSummary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6 },
  expandedContent: { marginTop: 3 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 13 },
  noticeDetails: { color: colors.textPrimary, fontSize: 13, lineHeight: 21 },
  noticeFooter: { alignItems: "center", flexDirection: "row", justifyContent: "flex-end", marginTop: 13 },
  readMore: { color: colors.primary, fontSize: 11, fontWeight: "800", marginRight: 5 },
});
