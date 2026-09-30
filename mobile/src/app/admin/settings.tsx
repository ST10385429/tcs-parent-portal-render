import type { Href } from "expo-router";

import { AccountSettingsScreen } from "@/components/account-settings-screen";

export default function AdminSettingsScreen() {
  return (
    <AccountSettingsScreen
      dashboardRoute={"/admin" as Href}
      roleLabel="Administrator"
      roleDescription={
        "Administrator access allows you to manage users, classes, fees, requests and academic records."
      }
    />
  );
}