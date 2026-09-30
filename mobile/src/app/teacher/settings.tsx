import type { Href } from "expo-router";

import { AccountSettingsScreen } from "@/components/account-settings-screen";

export default function TeacherSettingsScreen() {
  return (
    <AccountSettingsScreen
      dashboardRoute={"/teacher" as Href}
      roleLabel="Teacher"
      roleDescription={
        "Teacher access is limited to your assigned classes, learners, academic results and parent appointments."
      }
    />
  );
}