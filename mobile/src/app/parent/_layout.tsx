import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { colors } from "@/theme/colors";

const tabIcons = {
  index: {
    active: "home",
    inactive: "home-outline",
  },
  news: {
    active: "newspaper",
    inactive: "newspaper-outline",
  },
  calendar: {
    active: "calendar",
    inactive: "calendar-outline",
  },
  reports: {
    active: "document-text",
    inactive: "document-text-outline",
  },
  fees: {
    active: "wallet",
    inactive: "wallet-outline",
  },
  chat: {
    active: "apps",
    inactive: "apps-outline",
  },
} as const;

type TabName = keyof typeof tabIcons;

export default function ParentTabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const routeName = route.name as TabName;
        const icons = tabIcons[routeName] ?? tabIcons.index;

        return {
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.navyMuted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: "700",
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          tabBarStyle: {
            height: 78,
            backgroundColor: colors.surface,
            borderTopWidth: 0,
            paddingTop: 8,
            paddingBottom: 10,
            shadowColor: colors.shadow,
            shadowOffset: {
              width: 0,
              height: -3,
            },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 12,
          },
          tabBarItemStyle: {
            paddingHorizontal: 1,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={color}
              name={focused ? icons.active : icons.inactive}
              size={22}
            />
          ),
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          title: "News",
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
        }}
      />

      <Tabs.Screen
        name="fees"
        options={{
          title: "Fees",
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Services",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="language"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}