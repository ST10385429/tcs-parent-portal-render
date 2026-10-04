import type { Href } from "expo-router";

import { AccountSettingsScreen } from "@/components/account-settings-screen";

export default function ParentSettingsScreen() {
  return (
    <AccountSettingsScreen
      dashboardRoute={"/parent" as Href}
      roleLabel="Parent"
      roleDescription={
        "Parent access is limited to learners linked to your account, their academic reports, fee information and school communication."
      }
    />
  );
}