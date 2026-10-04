import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type Href,
  useRouter,
} from "expo-router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { subscribeToParentAnnouncements } from "@/services/announcement-service";
import {
  formatCurrency,
  getFeeAccount,
} from "@/services/fee-service";
import { getParentLearners } from "@/services/learner-service";
import { subscribeToParentSchoolEvents } from "@/services/school-event-service";
import { getApprovedTermReports } from "@/services/term-report-service";
import { colors } from "@/theme/colors";
import type { Announcement } from "@/types/announcement";
import type {
  FeeAccount,
  Learner,
  TermReport,
} from "@/types/school";
import type { SchoolEvent } from "@/types/school-event";

type DashboardStat = {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colour: string;
  route: Href;
  accessibilityLabel: string;
};

const dashboardSessionDate = new Date();

const dashboardDateLabel =
  dashboardSessionDate.toLocaleDateString(
    "en-ZA",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

const dashboardGreeting =
  dashboardSessionDate.getHours() < 12
    ? "Good morning"
    : dashboardSessionDate.getHours() < 17
      ? "Good afternoon"
      : "Good evening";

function formatAnnouncementDate(
  announcement: Announcement,
): string {
  const timestamp =
    announcement.publishedAt ??
    announcement.createdAt;

  if (!timestamp) {
    return "Recently";
  }

  return timestamp
    .toDate()
    .toLocaleDateString(
      "en-ZA",
      {
        day: "numeric",
        month: "short",
      },
    );
}

function getAnnouncementCategoryLabel(
  announcement: Announcement,
): string {
  if (announcement.category === "fees") {
    return "FEES";
  }

  if (
    announcement.audience === "class" &&
    announcement.targetClassName
  ) {
    return announcement.targetClassName.toUpperCase();
  }

  return "SCHOOL-WIDE";
}

function getEventStartDate(
  event: SchoolEvent,
): Date | null {
  return event.startAt?.toDate() ?? null;
}

function formatEventMonth(
  event: SchoolEvent,
): string {
  const start =
    getEventStartDate(event);

  if (!start) {
    return "---";
  }

  return start
    .toLocaleDateString(
      "en-ZA",
      {
        month: "short",
      },
    )
    .toUpperCase();
}

function formatEventDay(
  event: SchoolEvent,
): string {
  const start =
    getEventStartDate(event);

  if (!start) {
    return "--";
  }

  return String(start.getDate());
}

function formatEventTime(
  event: SchoolEvent,
): string {
  const start =
    getEventStartDate(event);

  if (!start) {
    return "Time to be confirmed";
  }

  return start.toLocaleTimeString(
    "en-ZA",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
}

function filterUpcomingEvents(
  loadedEvents: SchoolEvent[],
): SchoolEvent[] {
  const currentTime =
    Date.now();

  return loadedEvents
    .filter((event) => {
      const start =
        getEventStartDate(event);

      return (
        event.status === "scheduled" &&
        start !== null &&
        start.getTime() >= currentTime
      );
    })
    .sort((first, second) => {
      const firstTime =
        getEventStartDate(first)?.getTime() ??
        Number.MAX_SAFE_INTEGER;

      const secondTime =
        getEventStartDate(second)?.getTime() ??
        Number.MAX_SAFE_INTEGER;

      return firstTime - secondTime;
    });
}

export default function ParentDashboard() {
  const router =
    useRouter();

  const {
    user,
  } = useAuth();

  const [
    learners,
    setLearners,
  ] =
    useState<Learner[]>([]);

  const [
    selectedLearner,
    setSelectedLearner,
  ] =
    useState<Learner | null>(
      null,
    );

  const [
    announcements,
    setAnnouncements,
  ] =
    useState<Announcement[]>(
      [],
    );

  const [
    events,
    setEvents,
  ] =
    useState<SchoolEvent[]>(
      [],
    );

  const [
    feeAccount,
    setFeeAccount,
  ] =
    useState<FeeAccount | null>(
      null,
    );

  const [
    reports,
    setReports,
  ] =
    useState<TermReport[]>(
      [],
    );

  const [
    learnersLoadedForUserId,
    setLearnersLoadedForUserId,
  ] =
    useState("");

  const [
    dashboardLoadedForLearnerId,
    setDashboardLoadedForLearnerId,
  ] =
    useState("");

  const [
    learnerError,
    setLearnerError,
  ] =
    useState("");

  const [
    dashboardError,
    setDashboardError,
  ] =
    useState("");

  const isLoadingLearners =
    Boolean(
      user &&
        learnersLoadedForUserId !==
          user.uid,
    );

  const isLoadingDashboard =
    Boolean(
      selectedLearner &&
        dashboardLoadedForLearnerId !==
          selectedLearner.id,
    );

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return undefined;
    }

    getParentLearners(
      user.uid,
    )
      .then(
        (
          loadedLearners,
        ) => {
          if (!isMounted) {
            return;
          }

          setLearners(
            loadedLearners,
          );

          setSelectedLearner(
            loadedLearners[0] ??
              null,
          );

          setLearnerError("");
        },
      )
      .catch(
        (error: unknown) => {
          console.error(
            "Unable to load linked learners:",
            error,
          );

          if (!isMounted) {
            return;
          }

          setLearners([]);
          setSelectedLearner(
            null,
          );

          setLearnerError(
            "Learner information could not be loaded. Check your connection and try again.",
          );
        },
      )
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setLearnersLoadedForUserId(
          user.uid,
        );
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    let unsubscribeAnnouncements:
      | (() => void)
      | undefined;

    let unsubscribeEvents:
      | (() => void)
      | undefined;

    if (
      !selectedLearner ||
      !user
    ) {
      return undefined;
    }

    const learnerId =
      selectedLearner.id;

    const classIds =
      selectedLearner.currentClassId
        ? [
            selectedLearner.currentClassId,
          ]
        : [];

    unsubscribeAnnouncements =
      subscribeToParentAnnouncements(
        classIds,
        (
          loadedAnnouncements,
        ) => {
          if (!isMounted) {
            return;
          }

          setAnnouncements(
            loadedAnnouncements,
          );
        },
        (
          error,
        ) => {
          console.error(
            "Unable to load parent dashboard announcements:",
            error,
          );

          if (!isMounted) {
            return;
          }

          setAnnouncements([]);

          setDashboardError(
            "Some dashboard information could not be loaded.",
          );
        },
      );

    unsubscribeEvents =
      subscribeToParentSchoolEvents(
        classIds,
        (
          loadedEvents,
        ) => {
          if (!isMounted) {
            return;
          }

          setEvents(
            filterUpcomingEvents(
              loadedEvents,
            ),
          );
        },
        (
          error,
        ) => {
          console.error(
            "Unable to load parent dashboard events:",
            error,
          );

          if (!isMounted) {
            return;
          }

          setEvents([]);

          setDashboardError(
            "Some dashboard information could not be loaded.",
          );
        },
      );

    Promise.all([
      getFeeAccount(
        learnerId,
      ),
      getApprovedTermReports(
        learnerId,
      ),
    ])
      .then(
        ([
          loadedFeeAccount,
          loadedReports,
        ]) => {
          if (!isMounted) {
            return;
          }

          setFeeAccount(
            loadedFeeAccount,
          );

          setReports(
            loadedReports,
          );

          setDashboardError("");
        },
      )
      .catch(
        (error: unknown) => {
          console.error(
            "Unable to load parent dashboard financial/report information:",
            error,
          );

          if (!isMounted) {
            return;
          }

          setFeeAccount(null);
          setReports([]);

          setDashboardError(
            "Some dashboard information could not be loaded.",
          );
        },
      )
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setDashboardLoadedForLearnerId(
          learnerId,
        );
      });

    return () => {
      isMounted = false;

      unsubscribeAnnouncements?.();
      unsubscribeEvents?.();
    };
  }, [
    selectedLearner,
    user,
  ]);

  const visibleAnnouncements = useMemo(
  () =>
    isLoadingDashboard
      ? []
      : announcements,
  [
    announcements,
    isLoadingDashboard,
  ],
);

  const visibleEvents =
    isLoadingDashboard
      ? []
      : events;

  const visibleFeeAccount =
    isLoadingDashboard
      ? null
      : feeAccount;

  const visibleReports =
    isLoadingDashboard
      ? []
      : reports;

  const unreadAnnouncements =
    useMemo(
      () =>
        visibleAnnouncements.filter(
          (
            announcement,
          ) =>
            !user ||
            !announcement.readBy.includes(
              user.uid,
            ),
        ),
      [
        visibleAnnouncements,
        user,
      ],
    );

  const latestAnnouncement =
    visibleAnnouncements[0] ??
    null;

  const nextEvent =
    visibleEvents[0] ??
    null;

  const reportReadyCount =
    visibleFeeAccount?.status ===
    "upToDate"
      ? visibleReports.length
      : 0;

  const dashboardStats =
    useMemo<
      DashboardStat[]
    >(
      () => [
        {
          value:
            isLoadingDashboard
              ? "..."
              : String(
                  unreadAnnouncements.length,
                ),

          label:
            "NEW ANNOUNCEMENTS",

          icon:
            "notifications-outline",

          colour:
            colors.info,

          route:
            "/parent/news" as Href,

          accessibilityLabel:
            "Open announcements",
        },

        {
          value:
            isLoadingDashboard
              ? "..."
              : String(
                  visibleEvents.length,
                ),

          label:
            "UPCOMING EVENTS",

          icon:
            "calendar-outline",

          colour:
            colors.warning,

          route:
            "/parent/calendar" as Href,

          accessibilityLabel:
            "Open upcoming events",
        },

        {
          value:
            isLoadingDashboard
              ? "..."
              : String(
                  reportReadyCount,
                ),

          label:
            "REPORTS READY",

          icon:
            "document-text-outline",

          colour:
            colors.success,

          route:
            "/parent/reports" as Href,

          accessibilityLabel:
            "Open academic reports",
        },

        {
          value:
            isLoadingDashboard
              ? "..."
              : formatCurrency(
                  visibleFeeAccount
                    ?.currentBalance ??
                    0,
                ),

          label:
            "FEE BALANCE",

          icon:
            "wallet-outline",

          colour:
            colors.error,

          route:
            "/parent/fees" as Href,

          accessibilityLabel:
            "Open fees and payments",
        },
      ],
      [
        isLoadingDashboard,
        reportReadyCount,
        unreadAnnouncements.length,
        visibleEvents.length,
        visibleFeeAccount,
      ],
    );

  const handleOpenProfile =
    () => {
      router.push(
        "/parent/profile" as Href,
      );
    };

  const handleOpenNews =
    () => {
      router.push(
        "/parent/news" as Href,
      );
    };

  const handleOpenCalendar =
    () => {
      router.push(
        "/parent/calendar" as Href,
      );
    };

  const openRoute = (
    route: Href,
  ) => {
    router.push(route);
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerTop
            }
          >
            <View
              style={
                styles.greetingContainer
              }
            >
              <Text
                style={
                  styles.greeting
                }
              >
                {dashboardGreeting},{" "}
                {user?.firstName ||
                  "Parent"}
              </Text>

              <Text
                style={styles.date}
              >
                {dashboardDateLabel}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open parent profile"
              onPress={
                handleOpenProfile
              }
              style={({
                pressed,
              }) => [
                styles.profileButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                color={
                  colors.textOnPrimary
                }
                name="person-outline"
                size={23}
              />
            </Pressable>
          </View>

          <Text
            style={
              styles.learnerLabel
            }
          >
            VIEWING INFORMATION FOR
          </Text>

          {isLoadingLearners ? (
            <View
              style={
                styles.learnerLoading
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
                  styles.learnerLoadingText
                }
              >
                Loading linked
                learners...
              </Text>
            </View>
          ) : learnerError ? (
            <View
              style={
                styles.learnerMessage
              }
            >
              <Text
                style={
                  styles.learnerMessageText
                }
              >
                {learnerError}
              </Text>
            </View>
          ) : learners.length ===
            0 ? (
            <View
              style={
                styles.learnerMessage
              }
            >
              <Text
                style={
                  styles.learnerMessageText
                }
              >
                No learners are
                linked to this
                parent account.
                Contact the school
                administrator.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={
                styles.learnerSelector
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
            >
              {learners.map(
                (learner) => {
                  const isSelected =
                    selectedLearner?.id ===
                    learner.id;

                  return (
                    <Pressable
                      key={
                        learner.id
                      }
                      accessibilityRole="radio"
                      accessibilityLabel={`View information for ${learner.firstName}`}
                      accessibilityState={{
                        checked:
                          isSelected,
                      }}
                      onPress={() =>
                        setSelectedLearner(
                          learner,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.learnerButton,
                        isSelected &&
                          styles.learnerButtonSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.learnerName,
                          isSelected &&
                            styles.learnerNameSelected,
                        ]}
                      >
                        {
                          learner.firstName
                        }
                      </Text>

                      <Text
                        style={[
                          styles.learnerGrade,
                          isSelected &&
                            styles.learnerGradeSelected,
                        ]}
                      >
                        {learner
                          .schoolClass
                          ?.name ??
                          `Grade ${learner.currentGradeNumber}`}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          )}
        </View>

        <View
          style={styles.content}
        >
          {dashboardError ? (
            <View
              accessibilityLiveRegion="polite"
              style={
                styles.warningCard
              }
            >
              <Ionicons
                color={
                  colors.warning
                }
                name="warning-outline"
                size={19}
              />

              <Text
                style={
                  styles.warningText
                }
              >
                {dashboardError}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open school calendar"
            onPress={
              handleOpenCalendar
            }
            style={({
              pressed,
            }) => [
              styles.calendarButton,
              pressed &&
                styles.calendarButtonPressed,
            ]}
          >
            <View
              style={
                styles.calendarButtonIcon
              }
            >
              <Ionicons
                color={
                  colors.primary
                }
                name="calendar-outline"
                size={25}
              />
            </View>

            <View
              style={
                styles.calendarButtonContent
              }
            >
              <Text
                style={
                  styles.calendarButtonEyebrow
                }
              >
                SCHOOL CALENDAR
              </Text>

              <Text
                style={
                  styles.calendarButtonTitle
                }
              >
                View upcoming events
              </Text>

              <Text
                style={
                  styles.calendarButtonText
                }
              >
                Tests, sports days
                and parent meetings
              </Text>
            </View>

            <Ionicons
              color={
                colors.primary
              }
              name="chevron-forward"
              size={21}
            />
          </Pressable>

          <Text
            style={
              styles.sectionTitle
            }
          >
            At a glance
          </Text>

          <View
            style={
              styles.statsGrid
            }
          >
            {dashboardStats.map(
              (stat) => (
                <Pressable
                  key={
                    stat.label
                  }
                  accessibilityLabel={
                    stat.accessibilityLabel
                  }
                  accessibilityRole="button"
                  onPress={() =>
                    openRoute(
                      stat.route,
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.statCard,
                    pressed &&
                      styles.statCardPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.statIcon,
                      {
                        backgroundColor:
                          `${stat.colour}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      color={
                        stat.colour
                      }
                      name={
                        stat.icon
                      }
                      size={20}
                    />
                  </View>

                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={
                      styles.statValue
                    }
                  >
                    {stat.value}
                  </Text>

                  <Text
                    style={
                      styles.statLabel
                    }
                  >
                    {stat.label}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Latest for you
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all announcements"
              onPress={
                handleOpenNews
              }
              style={({
                pressed,
              }) => [
                styles.seeAllButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.seeAll
                }
              >
                View all
              </Text>
            </Pressable>
          </View>

          {isLoadingDashboard ? (
            <View
              style={
                styles.stateCard
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
                  styles.stateText
                }
              >
                Loading your latest
                school information...
              </Text>
            </View>
          ) : latestAnnouncement ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open announcement: ${latestAnnouncement.title}`}
              onPress={
                handleOpenNews
              }
              style={({
                pressed,
              }) => [
                styles.announcementCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.cardHeader
                }
              >
                <View
                  style={
                    styles.categoryBadge
                  }
                >
                  <Text
                    style={
                      styles.categoryText
                    }
                  >
                    {getAnnouncementCategoryLabel(
                      latestAnnouncement,
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.newBadge
                  }
                >
                  {!latestAnnouncement.readBy.includes(
                    user?.uid ?? "",
                  ) ? (
                    <View
                      style={
                        styles.newDot
                      }
                    />
                  ) : null}

                  <Text
                    style={
                      styles.timeText
                    }
                  >
                    {formatAnnouncementDate(
                      latestAnnouncement,
                    )}
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.cardTitle
                }
              >
                {
                  latestAnnouncement.title
                }
              </Text>

              <Text
                numberOfLines={3}
                style={
                  styles.cardDescription
                }
              >
                {latestAnnouncement.summary ||
                  latestAnnouncement.body}
              </Text>

              <View
                style={
                  styles.cardFooter
                }
              >
                <Text
                  style={
                    styles.readMoreText
                  }
                >
                  Read announcement
                </Text>

                <Ionicons
                  color={
                    colors.primary
                  }
                  name="arrow-forward"
                  size={18}
                />
              </View>
            </Pressable>
          ) : (
            <View
              style={
                styles.stateCard
              }
            >
              <Ionicons
                color={
                  colors.primary
                }
                name="notifications-off-outline"
                size={27}
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No announcements yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                New school and class
                announcements will
                appear here.
              </Text>
            </View>
          )}

          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Coming up
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all calendar events"
              onPress={
                handleOpenCalendar
              }
              style={({
                pressed,
              }) => [
                styles.eventCountBadge,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.eventCountText
                }
              >
                VIEW CALENDAR
              </Text>
            </Pressable>
          </View>

          {isLoadingDashboard ? (
            <View
              style={
                styles.stateCard
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
                  styles.stateText
                }
              >
                Loading upcoming
                events...
              </Text>
            </View>
          ) : nextEvent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${nextEvent.title} in the calendar`}
              onPress={
                handleOpenCalendar
              }
              style={({
                pressed,
              }) => [
                styles.eventCard,
                pressed &&
                  styles.eventCardPressed,
              ]}
            >
              <View
                style={
                  styles.eventDate
                }
              >
                <Text
                  style={
                    styles.eventMonth
                  }
                >
                  {formatEventMonth(
                    nextEvent,
                  )}
                </Text>

                <Text
                  style={
                    styles.eventDay
                  }
                >
                  {formatEventDay(
                    nextEvent,
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.eventDetails
                }
              >
                <Text
                  style={
                    styles.eventTitle
                  }
                >
                  {
                    nextEvent.title
                  }
                </Text>

                <Text
                  style={
                    styles.eventMeta
                  }
                >
                  {formatEventTime(
                    nextEvent,
                  )}

                  {nextEvent.audience ===
                    "class" &&
                  nextEvent.targetClassName
                    ? ` • ${nextEvent.targetClassName}`
                    : " • Whole school"}
                </Text>

                <Text
                  numberOfLines={1}
                  style={
                    styles.eventLocation
                  }
                >
                  {nextEvent.location ||
                    "Location to be confirmed"}
                </Text>
              </View>

              <Ionicons
                color={
                  colors.textSecondary
                }
                name="chevron-forward"
                size={20}
              />
            </Pressable>
          ) : (
            <View
              style={
                styles.stateCard
              }
            >
              <Ionicons
                color={
                  colors.primary
                }
                name="calendar-clear-outline"
                size={27}
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Nothing coming up
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                There are no upcoming
                school or class events
                currently scheduled.
              </Text>
            </View>
          )}

          <View
            style={
              styles.connectedMessage
            }
          >
            <Ionicons
              color={
                colors.success
              }
              name="checkmark-circle-outline"
              size={20}
            />

            <View
              style={
                styles.connectedContent
              }
            >
              <Text
                style={
                  styles.connectedTitle
                }
              >
                School information
                connected
              </Text>

              <Text
                style={
                  styles.connectedText
                }
              >
                Dashboard information
                is loaded from your
                linked learner&apos;s
                school records.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.primary,
    },

    scrollContent: {
      flexGrow: 1,
      backgroundColor:
        colors.background,
      paddingBottom: 24,
    },

    header: {
      backgroundColor:
        colors.primary,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
    },

    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    greetingContainer: {
      flex: 1,
      paddingRight: 16,
    },

    greeting: {
      color:
        colors.textOnPrimary,
      fontSize: 22,
      fontWeight: "800",
    },

    date: {
      color:
        colors.primaryLight,
      fontSize: 12,
      marginTop: 5,
    },

    profileButton: {
      width: 46,
      height: 46,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryDark,
      borderWidth: 1,
      borderColor:
        colors.primaryLight,
      borderRadius: 23,
    },

    learnerLabel: {
      color:
        colors.accentLight,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.3,
      marginTop: 27,
      marginBottom: 9,
    },

    learnerSelector: {
      flexDirection: "row",
      gap: 10,
      paddingRight: 2,
    },

    learnerLoading: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.primaryDark,
      borderRadius: 15,
      paddingHorizontal: 15,
    },

    learnerLoadingText: {
      color:
        colors.textOnPrimary,
      fontSize: 12,
      marginLeft: 10,
    },

    learnerMessage: {
      minHeight: 64,
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryDark,
      borderWidth: 1,
      borderColor:
        colors.primaryLight,
      borderRadius: 15,
      padding: 13,
    },

    learnerMessageText: {
      color:
        colors.textOnPrimary,
      fontSize: 11,
      lineHeight: 17,
    },

    learnerButton: {
      minWidth: 130,
      backgroundColor:
        colors.primaryDark,
      borderWidth: 1,
      borderColor:
        colors.primaryLight,
      borderRadius: 15,
      paddingHorizontal: 15,
      paddingVertical: 11,
    },

    learnerButtonSelected: {
      backgroundColor:
        colors.surface,
      borderColor:
        colors.surface,
    },

    learnerName: {
      color:
        colors.textOnPrimary,
      fontSize: 14,
      fontWeight: "800",
    },

    learnerNameSelected: {
      color: colors.primary,
    },

    learnerGrade: {
      color:
        colors.primaryLight,
      fontSize: 11,
      marginTop: 2,
    },

    learnerGradeSelected: {
      color:
        colors.textSecondary,
    },

    content: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      paddingHorizontal: 20,
    },

    warningCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.accentLight,
      borderWidth: 1,
      borderColor:
        colors.warning,
      borderRadius: 14,
      marginTop: 16,
      padding: 13,
    },

    warningText: {
      flex: 1,
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginLeft: 9,
    },

    calendarButton: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 20,
      marginTop: 18,
      padding: 15,
      shadowColor:
        colors.shadow,
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },

    calendarButtonPressed: {
      backgroundColor:
        colors.primaryLight,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    calendarButtonIcon: {
      width: 51,
      height: 51,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 16,
    },

    calendarButtonContent: {
      flex: 1,
      marginHorizontal: 13,
    },

    calendarButtonEyebrow: {
      color:
        colors.accentDark,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1,
    },

    calendarButtonTitle: {
      color:
        colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 3,
    },

    calendarButtonText: {
      color:
        colors.textSecondary,
      fontSize: 10,
      marginTop: 3,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    sectionTitle: {
      color:
        colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 25,
      marginBottom: 13,
    },

    seeAllButton: {
      minHeight: 44,
      justifyContent:
        "center",
      marginTop: 12,
      paddingLeft: 15,
    },

    seeAll: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 11,
    },

    statCard: {
      width: "48%",
      minHeight: 132,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      padding: 15,
    },

    statCardPressed: {
      backgroundColor:
        colors.surfaceMuted,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    statIcon: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 11,
    },

    statValue: {
      color:
        colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      marginTop: 13,
    },

    statLabel: {
      color:
        colors.textSecondary,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 15,
      marginTop: 4,
    },

    announcementCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 20,
      padding: 18,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    categoryBadge: {
      maxWidth: "68%",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    categoryText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.7,
    },

    newBadge: {
      flexDirection: "row",
      alignItems: "center",
    },

    newDot: {
      width: 7,
      height: 7,
      backgroundColor:
        colors.error,
      borderRadius: 4,
      marginRight: 6,
    },

    timeText: {
      color:
        colors.textSecondary,
      fontSize: 11,
    },

    cardTitle: {
      color:
        colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 15,
    },

    cardDescription: {
      color:
        colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 7,
    },

    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "flex-end",
      marginTop: 13,
    },

    readMoreText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      marginRight: 6,
    },

    eventCountBadge: {
      backgroundColor:
        colors.accentLight,
      borderRadius: 10,
      marginTop: 12,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    eventCountText: {
      color:
        colors.warning,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 20,
      padding: 15,
    },

    eventCardPressed: {
      backgroundColor:
        colors.surfaceMuted,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    eventDate: {
      width: 54,
      height: 60,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.accentLight,
      borderRadius: 14,
    },

    eventMonth: {
      color:
        colors.warning,
      fontSize: 10,
      fontWeight: "800",
    },

    eventDay: {
      color:
        colors.textPrimary,
      fontSize: 21,
      fontWeight: "800",
    },

    eventDetails: {
      flex: 1,
      marginHorizontal: 13,
    },

    eventTitle: {
      color:
        colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },

    eventMeta: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 5,
    },

    eventLocation: {
      color:
        colors.textSecondary,
      fontSize: 11,
      marginTop: 3,
    },

    stateCard: {
      minHeight: 112,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 20,
      padding: 18,
    },

    stateText: {
      color:
        colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
      textAlign: "center",
    },

    emptyTitle: {
      color:
        colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 8,
    },

    emptyText: {
      color:
        colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
      textAlign: "center",
    },

    connectedMessage: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      backgroundColor:
        colors.primaryLight,
      borderRadius: 16,
      marginTop: 16,
      padding: 14,
    },

    connectedContent: {
      flex: 1,
      marginLeft: 10,
    },

    connectedTitle: {
      color:
        colors.primaryDark,
      fontSize: 12,
      fontWeight: "800",
    },

    connectedText: {
      color:
        colors.textSecondary,
      fontSize: 10,
      lineHeight: 16,
      marginTop: 3,
    },

    pressed: {
      opacity: 0.7,
    },
  });