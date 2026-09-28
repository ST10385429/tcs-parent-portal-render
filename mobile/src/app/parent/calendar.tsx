import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { getParentLearners } from "@/services/learner-service";
import { subscribeToParentSchoolEvents } from "@/services/school-event-service";
import { colors } from "@/theme/colors";
import type { SchoolEvent, SchoolEventCategory } from "@/types/school-event";

type CalendarDay = Date | null;

type CategoryPresentation = {
  colour: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const days: CalendarDay[] = Array.from(
    { length: firstDay.getDay() },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getEventDate(event: SchoolEvent): Date | null {
  return event.startAt?.toDate() ?? null;
}

function getCategoryPresentation(
  category: SchoolEventCategory,
): CategoryPresentation {
  if (category === "academic") {
    return { colour: colors.info, icon: "school-outline", label: "Academic" };
  }

  if (category === "sport") {
    return { colour: colors.success, icon: "trophy-outline", label: "Sport" };
  }

  if (category === "meeting") {
    return { colour: colors.warning, icon: "people-outline", label: "Meeting" };
  }

  if (category === "holiday") {
    return { colour: colors.accent, icon: "sunny-outline", label: "Holiday" };
  }

  return {
    colour: colors.primary,
    icon: "calendar-outline",
    label: "School event",
  };
}

function formatMonth(value: Date): string {
  return value.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function formatSelectedDate(value: Date): string {
  return value.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatEventTime(event: SchoolEvent): string {
  const start = event.startAt?.toDate();
  const end = event.endAt?.toDate();

  if (!start) {
    return "Time to be confirmed";
  }

  if (!end) {
    return formatTime(start);
  }

  if (isSameDay(start, end)) {
    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  return `${formatTime(start)} - ${end.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  })} ${formatTime(end)}`;
}

export default function ParentCalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
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

        const classIds = [
          ...new Set(
            learners
              .map((learner) => learner.currentClassId)
              .filter((classId) => classId.length > 0),
          ),
        ];

        unsubscribe = subscribeToParentSchoolEvents(
          classIds,
          (loadedEvents) => {
            if (mounted) {
              setEvents(loadedEvents);
              setError("");
              setLoading(false);
            }
          },
          (loadError) => {
            console.error("Unable to load school events:", loadError);
            if (mounted) {
              setError("The school calendar could not be loaded.");
              setLoading(false);
            }
          },
        );
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load calendar learners:", loadError);
        if (mounted) {
          setError("The school calendar could not be loaded.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [user]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );

  const eventsForSelectedDate = useMemo(
    () =>
      events.filter((event) => {
        const eventDate = getEventDate(event);
        return eventDate !== null && isSameDay(eventDate, selectedDate);
      }),
    [events, selectedDate],
  );

  const eventDates = useMemo(
    () =>
      events
        .map(getEventDate)
        .filter((date): date is Date => date !== null),
    [events],
  );

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  const returnToToday = () => {
    const currentDate = new Date();
    setVisibleMonth(startOfMonth(currentDate));
    setSelectedDate(currentDate);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Parent dashboard"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />
            <Text style={styles.backText}>Home</Text>
          </Pressable>

          <Text style={styles.headerTitle}>School Calendar</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => changeMonth(-1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons color={colors.primary} name="chevron-back" size={20} />
              </Pressable>

              <View style={styles.monthInformation}>
                <Text style={styles.monthName}>{formatMonth(visibleMonth)}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={returnToToday}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.monthSubtitle}>Return to today</Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => changeMonth(1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons color={colors.primary} name="chevron-forward" size={20} />
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {weekDays.map((day) => (
                <Text key={day} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const selected = isSameDay(selectedDate, day);
                const current = isSameDay(today, day);
                const hasEvent = eventDates.some((eventDate) =>
                  isSameDay(eventDate, day),
                );

                return (
                  <Pressable
                    key={day.toISOString()}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatSelectedDate(day)}${
                      hasEvent ? ", event scheduled" : ""
                    }`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedDate(day)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      current && !selected && styles.todayCell,
                      selected && styles.selectedDayCell,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        current && !selected && styles.todayText,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {day.getDate()}
                    </Text>

                    {hasEvent ? (
                      <View
                        style={[
                          styles.eventDot,
                          selected && styles.selectedEventDot,
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
                <Text style={styles.legendText}>Event scheduled</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendOutline, { borderColor: colors.primary }]}
                />
                <Text style={styles.legendText}>Today</Text>
              </View>
            </View>
          </View>

          <View style={styles.selectedDateHeader}>
            <Text style={styles.sectionTitle}>
              {formatSelectedDate(selectedDate)}
            </Text>
            <Text style={styles.eventCount}>
              {eventsForSelectedDate.length}{" "}
              {eventsForSelectedDate.length === 1 ? "event" : "events"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.stateText}>Loading school events...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  color={colors.error}
                  name="cloud-offline-outline"
                  size={30}
                />
              </View>
              <Text style={styles.emptyTitle}>Calendar unavailable</Text>
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : eventsForSelectedDate.length > 0 ? (
            eventsForSelectedDate.map((event) => {
              const presentation = getCategoryPresentation(event.category);

              return (
                <View key={event.id} style={styles.eventCard}>
                  <View
                    style={[
                      styles.eventIcon,
                      { backgroundColor: `${presentation.colour}18` },
                    ]}
                  >
                    <Ionicons
                      color={presentation.colour}
                      name={presentation.icon}
                      size={23}
                    />
                  </View>

                  <View style={styles.eventInformation}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text
                        style={[
                          styles.categoryText,
                          { color: presentation.colour },
                        ]}
                      >
                        {presentation.label}
                      </Text>
                    </View>

                    <Text style={styles.eventDescription}>{event.description}</Text>

                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        color={colors.textSecondary}
                        name="time-outline"
                        size={14}
                      />
                      <Text style={styles.eventDetailText}>
                        {formatEventTime(event)}
                      </Text>
                    </View>

                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        color={colors.textSecondary}
                        name="location-outline"
                        size={14}
                      />
                      <Text style={styles.eventDetailText}>{event.location}</Text>
                    </View>

                    <View style={styles.audienceBadge}>
                      <Text style={styles.audienceText}>
                        {event.audience === "allParents"
                          ? "Whole school"
                          : event.targetClassName}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.stateCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  color={colors.primary}
                  name="calendar-clear-outline"
                  size={30}
                />
              </View>
              <Text style={styles.emptyTitle}>No events scheduled</Text>
              <Text style={styles.emptyText}>
                Choose a date marked with a dot to view its school or class events.
              </Text>
            </View>
          )}

          <View style={styles.liveCard}>
            <Ionicons color={colors.success} name="sync-outline" size={19} />
            <Text style={styles.liveText}>
              Calendar changes from the school appear here automatically.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
  },
  backButton: {
    width: 80,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  backText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: "700" },
  headerTitle: { color: colors.textOnPrimary, fontSize: 18, fontWeight: "800" },
  headerSpacer: { width: 80 },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 30,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    padding: 17,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  monthButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
  },
  monthInformation: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  monthName: { color: colors.textPrimary, fontSize: 19, fontWeight: "800" },
  monthSubtitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  weekHeader: { flexDirection: "row", marginBottom: 7 },
  weekDay: {
    width: "14.2857%",
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  todayCell: { borderWidth: 1, borderColor: colors.primary },
  selectedDayCell: { backgroundColor: colors.primary },
  dayText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  todayText: { color: colors.primary },
  selectedDayText: { color: colors.textOnPrimary },
  eventDot: {
    width: 5,
    height: 5,
    backgroundColor: colors.info,
    borderRadius: 3,
    marginTop: 3,
  },
  selectedEventDot: { backgroundColor: colors.accent },
  legend: {
    flexDirection: "row",
    gap: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 14,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  legendOutline: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: { color: colors.textSecondary, fontSize: 9 },
  selectedDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 23,
    marginBottom: 11,
  },
  sectionTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  eventCount: { color: colors.textSecondary, fontSize: 10, marginLeft: 10 },
  eventCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 11,
    padding: 15,
  },
  eventIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  eventInformation: { flex: 1, marginLeft: 13 },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  eventTitle: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  categoryText: {
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  eventDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 3,
  },
  eventDetailRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  eventDetailText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 10,
    marginLeft: 6,
  },
  audienceBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 9,
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  audienceText: { color: colors.primary, fontSize: 8, fontWeight: "800" },
  stateCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 25,
  },
  stateText: { color: colors.textSecondary, fontSize: 11, marginTop: 12 },
  emptyIcon: {
    width: 57,
    height: 57,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 29,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 13,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
  },
  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    marginTop: 15,
    padding: 13,
  },
  liveText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 8,
  },
  pressed: { opacity: 0.65 },
});
