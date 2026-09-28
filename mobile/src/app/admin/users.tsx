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
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import {
  createAppUser,
  getAllUsers,
  resetAppUserPassword,
  setAppUserStatus,
  updateAppUser,
} from "@/services/user-service";
import { colors } from "@/theme/colors";
import type {
  AppUser,
  UserRole,
  UserStatus,
} from "@/types/auth";

type RoleFilter = "all" | UserRole;

const burgundy = "#7A1830";

const roleFilters: {
  label: string;
  value: RoleFilter;
}[] = [
  { label: "All", value: "all" },
  { label: "Parents", value: "parent" },
  { label: "Teachers", value: "teacher" },
  { label: "Admins", value: "admin" },
];

const roleOptions: {
  label: string;
  value: UserRole;
  icon:
    | "people-outline"
    | "school-outline"
    | "shield-checkmark-outline";
}[] = [
  {
    label: "Parent",
    value: "parent",
    icon: "people-outline",
  },
  {
    label: "Teacher",
    value: "teacher",
    icon: "school-outline",
  },
  {
    label: "Administrator",
    value: "admin",
    icon: "shield-checkmark-outline",
  },
];

function getRoleLabel(
  role: UserRole,
): string {
  switch (role) {
    case "parent":
      return "Parent";
    case "teacher":
      return "Teacher";
    case "admin":
      return "Administrator";
  }
}

function getStatusLabel(
  status: UserStatus,
): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "suspended":
      return "Suspended";
  }
}

function getInitials(
  account: AppUser,
): string {
  const firstInitial =
    account.firstName.charAt(0);
  const lastInitial =
    account.lastName.charAt(0);

  return (
    `${firstInitial}${lastInitial}`.toUpperCase() ||
    "U"
  );
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

export default function ManageUsersScreen() {
  const router = useRouter();
  const { user: signedInUser } = useAuth();

  const [users, setUsers] = useState<
    AppUser[]
  >([]);
  const [searchText, setSearchText] =
    useState("");
  const [selectedRole, setSelectedRole] =
    useState<RoleFilter>("all");

  const [isLoading, setIsLoading] =
    useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [isSaving, setIsSaving] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const [isFormVisible, setIsFormVisible] =
    useState(false);
  const [
    isPasswordModalVisible,
    setIsPasswordModalVisible,
  ] = useState(false);

  const [editingUser, setEditingUser] =
    useState<AppUser | null>(null);
  const [
    passwordResetUser,
    setPasswordResetUser,
  ] = useState<AppUser | null>(null);

  const [firstName, setFirstName] =
    useState("");
  const [lastName, setLastName] =
    useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] =
    useState<UserRole>("parent");
  const [
    temporaryPassword,
    setTemporaryPassword,
  ] = useState("");
  const [
    resetPassword,
    setResetPassword,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    getAllUsers()
      .then((loadedUsers) => {
        if (!isMounted) {
          return;
        }

        setUsers(loadedUsers);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        console.error(
          "Unable to load user accounts:",
          error,
        );

        if (isMounted) {
          setErrorMessage(
            "User accounts could not be loaded. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const reloadUsers = async () => {
    const loadedUsers =
      await getAllUsers();

    setUsers(loadedUsers);
    setErrorMessage("");
  };

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      await reloadUsers();
    } catch (error) {
      console.error(
        "Unable to refresh user accounts:",
        error,
      );

      setErrorMessage(
        "User accounts could not be refreshed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return users.filter((account) => {
      const matchesRole =
        selectedRole === "all" ||
        account.role === selectedRole;

      const searchableText = [
        account.firstName,
        account.lastName,
        account.email,
        account.role,
        account.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesRole &&
        (!normalizedSearch ||
          searchableText.includes(
            normalizedSearch,
          ))
      );
    });
  }, [searchText, selectedRole, users]);

  const accountCounts = useMemo(
    () => ({
      active: users.filter(
        (account) =>
          account.status === "active",
      ).length,
      parents: users.filter(
        (account) =>
          account.role === "parent",
      ).length,
      teachers: users.filter(
        (account) =>
          account.role === "teacher",
      ).length,
    }),
    [users],
  );

  const clearForm = () => {
    setEditingUser(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("parent");
    setTemporaryPassword("");
  };

  const openCreateForm = () => {
    clearForm();
    setIsFormVisible(true);
  };

  const openEditForm = (
    account: AppUser,
  ) => {
    setEditingUser(account);
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setEmail(account.email);
    setRole(account.role);
    setTemporaryPassword("");
    setIsFormVisible(true);
  };

  const closeForm = () => {
    if (isSaving) {
      return;
    }

    setIsFormVisible(false);
    clearForm();
  };

  const validateForm = (): boolean => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim()
    ) {
      Alert.alert(
        "Missing information",
        "Enter the user’s first name, last name and email address.",
      );
      return false;
    }

    if (
      !editingUser &&
      !temporaryPassword
    ) {
      Alert.alert(
        "Temporary password required",
        "Enter a temporary password for the new account.",
      );
      return false;
    }

    return true;
  };

  const handleSaveUser = async () => {
    if (isSaving || !validateForm()) {
      return;
    }

    const isEditing =
      editingUser !== null;

    try {
      setIsSaving(true);

      const result = editingUser
        ? await updateAppUser({
            uid: editingUser.uid,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email
              .trim()
              .toLowerCase(),
            role,
          })
        : await createAppUser({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email
              .trim()
              .toLowerCase(),
            role,
            temporaryPassword,
          });

      await reloadUsers();

      setIsFormVisible(false);
      clearForm();

      Alert.alert(
        isEditing
          ? "Account updated"
          : "Account created",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to save user account:",
        error,
      );

      Alert.alert(
        "Unable to save account",
        getErrorMessage(error),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    account: AppUser,
    status: UserStatus,
  ) => {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      const result =
        await setAppUserStatus(
          account.uid,
          status,
        );

      await reloadUsers();

      setIsFormVisible(false);
      clearForm();

      Alert.alert(
        "Account status updated",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to update account status:",
        error,
      );

      Alert.alert(
        "Unable to update account",
        getErrorMessage(error),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmStatusChange = (
    account: AppUser,
    status: UserStatus,
  ) => {
    if (account.uid === signedInUser?.uid) {
      Alert.alert(
        "Action unavailable",
        "You cannot change the status of your own administrator account.",
      );
      return;
    }

    const actionLabel =
      status === "active"
        ? "Activate"
        : status === "suspended"
          ? "Suspend"
          : "Deactivate";

    Alert.alert(
      `${actionLabel} account`,
      `${actionLabel} ${account.firstName} ${account.lastName}’s account?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: actionLabel,
          style:
            status === "active"
              ? "default"
              : "destructive",
          onPress: () => {
            void handleStatusChange(
              account,
              status,
            );
          },
        },
      ],
    );
  };

  const openPasswordReset = (
    account: AppUser,
  ) => {
    setPasswordResetUser(account);
    setResetPassword("");
    setIsFormVisible(false);
    setIsPasswordModalVisible(true);
  };

  const closePasswordReset = () => {
    if (isSaving) {
      return;
    }

    setIsPasswordModalVisible(false);
    setPasswordResetUser(null);
    setResetPassword("");
  };

  const handleResetPassword = async () => {
    const targetUser =
      passwordResetUser;

    if (isSaving || !targetUser) {
      return;
    }

    if (!resetPassword) {
      Alert.alert(
        "Password required",
        "Enter a new temporary password.",
      );
      return;
    }

    try {
      setIsSaving(true);

      const result =
        await resetAppUserPassword(
          targetUser.uid,
          resetPassword,
        );

      await reloadUsers();

      setIsPasswordModalVisible(false);
      setPasswordResetUser(null);
      setResetPassword("");

      Alert.alert(
        "Password reset",
        result.message,
      );
    } catch (error) {
      console.error(
        "Unable to reset password:",
        error,
      );

      Alert.alert(
        "Unable to reset password",
        getErrorMessage(error),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openAccountLinks = (
    account: AppUser,
  ) => {
    if (account.role === "admin") {
      return;
    }

    const accountName =
      `${account.firstName} ${account.lastName}`.trim();

    const destination =
      `/admin/user-links?uid=${encodeURIComponent(
        account.uid,
      )}&role=${account.role}&name=${encodeURIComponent(
        accountName,
      )}`;

    setIsFormVisible(false);
    clearForm();

    router.push(destination as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to admin dashboard"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="chevron-back"
              size={24}
            />
            <Text style={styles.backText}>
              Back
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Manage Users
          </Text>

          <Pressable
            accessibilityLabel="Create user account"
            accessibilityRole="button"
            onPress={openCreateForm}
            style={({ pressed }) => [
              styles.headerAddButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="add"
              size={22}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              onRefresh={handleRefresh}
              refreshing={isRefreshing}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  color={colors.primary}
                  name="people-outline"
                  size={26}
                />
              </View>

              <View style={styles.summaryContent}>
                <Text style={styles.summaryTitle}>
                  {users.length} registered
                  accounts
                </Text>
                <Text style={styles.summaryText}>
                  Securely create and manage
                  school access.
                </Text>
              </View>
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {accountCounts.active}
                </Text>
                <Text style={styles.summaryLabel}>
                  ACTIVE
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {accountCounts.parents}
                </Text>
                <Text style={styles.summaryLabel}>
                  PARENTS
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {accountCounts.teachers}
                </Text>
                <Text style={styles.summaryLabel}>
                  TEACHERS
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={openCreateForm}
            style={({ pressed }) => [
              styles.createButton,
              pressed &&
                styles.actionButtonPressed,
            ]}
          >
            <Ionicons
              color={colors.textOnPrimary}
              name="person-add-outline"
              size={20}
            />
            <Text style={styles.createButtonText}>
              Create New Account
            </Text>
          </Pressable>

          <View style={styles.securityCard}>
            <Ionicons
              color={colors.success}
              name="shield-checkmark-outline"
              size={22}
            />
            <Text style={styles.securityText}>
              Account changes and linking
              actions are secured and recorded
              in the administrator audit log.
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={20}
            />

            <TextInput
              accessibilityLabel="Search user accounts"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search by name or email"
              placeholderTextColor={
                colors.textSecondary
              }
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
            />

            {searchText ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() =>
                  setSearchText("")
                }
                style={styles.clearButton}
              >
                <Ionicons
                  color={colors.textSecondary}
                  name="close-circle"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={
              styles.filterContent
            }
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
          >
            {roleFilters.map((filter) => {
              const isSelected =
                selectedRole === filter.value;

              return (
                <Pressable
                  key={filter.value}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: isSelected,
                  }}
                  onPress={() =>
                    setSelectedRole(
                      filter.value,
                    )
                  }
                  style={({ pressed }) => [
                    styles.filterButton,
                    isSelected &&
                      styles.filterButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isSelected &&
                        styles.filterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Accounts
            </Text>
            <Text style={styles.resultCount}>
              {filteredUsers.length} shown
            </Text>
          </View>

          {errorMessage ? (
            <View
              accessibilityRole="alert"
              style={styles.errorCard}
            >
              <Ionicons
                color={colors.error}
                name="alert-circle-outline"
                size={21}
              />
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                color={colors.primary}
                size="large"
              />
              <Text style={styles.loadingText}>
                Loading user accounts...
              </Text>
            </View>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          filteredUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                color={colors.textSecondary}
                name="person-outline"
                size={34}
              />
              <Text style={styles.emptyTitle}>
                No accounts found
              </Text>
              <Text style={styles.emptyText}>
                Try changing the search text or
                role filter.
              </Text>
            </View>
          ) : null}

          {!isLoading
            ? filteredUsers.map((account) => (
                <Pressable
                  key={account.uid}
                  accessibilityLabel={`Manage ${account.firstName} ${account.lastName}`}
                  accessibilityRole="button"
                  onPress={() =>
                    openEditForm(account)
                  }
                  style={({ pressed }) => [
                    styles.userCard,
                    pressed &&
                      styles.userCardPressed,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitials(account)}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.userInformation
                    }
                  >
                    <View style={styles.userNameRow}>
                      <Text
                        numberOfLines={1}
                        style={styles.userName}
                      >
                        {account.firstName}{" "}
                        {account.lastName}
                      </Text>

                      {account.uid ===
                      signedInUser?.uid ? (
                        <View style={styles.youBadge}>
                          <Text
                            style={
                              styles.youBadgeText
                            }
                          >
                            YOU
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={styles.userEmail}
                    >
                      {account.email}
                    </Text>

                    <View style={styles.badgeRow}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>
                          {getRoleLabel(
                            account.role,
                          )}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          account.status ===
                            "active" &&
                            styles.activeBadge,
                          account.status ===
                            "inactive" &&
                            styles.inactiveBadge,
                          account.status ===
                            "suspended" &&
                            styles.suspendedBadge,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            account.status ===
                              "active" &&
                              styles.activeDot,
                            account.status ===
                              "inactive" &&
                              styles.inactiveDot,
                            account.status ===
                              "suspended" &&
                              styles.suspendedDot,
                          ]}
                        />

                        <Text
                          style={[
                            styles.statusText,
                            account.status ===
                              "active" &&
                              styles.activeText,
                            account.status ===
                              "inactive" &&
                              styles.inactiveText,
                            account.status ===
                              "suspended" &&
                              styles.suspendedText,
                          ]}
                        >
                          {getStatusLabel(
                            account.status,
                          ).toUpperCase()}
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
              ))
            : null}
        </ScrollView>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={closeForm}
        presentationStyle="pageSheet"
        visible={isFormVisible}
      >
        <SafeAreaView
          style={styles.modalSafeArea}
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={closeForm}
                style={styles.modalHeaderButton}
              >
                <Text style={styles.modalCancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Text style={styles.modalTitle}>
                {editingUser
                  ? "Edit Account"
                  : "Create Account"}
              </Text>

              <View
                style={styles.modalHeaderButton}
              />
            </View>

            <ScrollView
              contentContainerStyle={
                styles.modalContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <View style={styles.formIntro}>
                <View style={styles.formIntroIcon}>
                  <Ionicons
                    color={colors.primary}
                    name={
                      editingUser
                        ? "person-outline"
                        : "person-add-outline"
                    }
                    size={27}
                  />
                </View>

                <Text style={styles.formIntroTitle}>
                  {editingUser
                    ? "Account details"
                    : "New school account"}
                </Text>

                <Text style={styles.formIntroText}>
                  {editingUser
                    ? "Update this user’s profile, links, role or account access."
                    : "Create secure login details for a parent, teacher or administrator."}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>
                First name
              </Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.formInput}
                value={firstName}
              />

              <Text style={styles.fieldLabel}>
                Last name
              </Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.formInput}
                value={lastName}
              />

              <Text style={styles.fieldLabel}>
                Email address
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={
                  colors.textSecondary
                }
                style={styles.formInput}
                value={email}
              />

              <Text style={styles.fieldLabel}>
                Account role
              </Text>

              <View style={styles.roleOptions}>
                {roleOptions.map((option) => {
                  const isSelected =
                    role === option.value;

                  const isOwnAccount =
                    editingUser?.uid ===
                    signedInUser?.uid;

                  const isDisabled =
                    isOwnAccount &&
                    option.value !==
                      editingUser?.role;

                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: isDisabled,
                        selected: isSelected,
                      }}
                      disabled={isDisabled}
                      onPress={() =>
                        setRole(option.value)
                      }
                      style={({ pressed }) => [
                        styles.roleOption,
                        isSelected &&
                          styles.roleOptionSelected,
                        isDisabled &&
                          styles.disabledOption,
                        pressed &&
                          !isDisabled &&
                          styles.pressed,
                      ]}
                    >
                      <Ionicons
                        color={
                          isSelected
                            ? colors.textOnPrimary
                            : colors.primary
                        }
                        name={option.icon}
                        size={20}
                      />

                      <Text
                        style={[
                          styles.roleOptionText,
                          isSelected &&
                            styles.roleOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!editingUser ? (
                <>
                  <Text style={styles.fieldLabel}>
                    Temporary password
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={
                      setTemporaryPassword
                    }
                    placeholder="Enter temporary password"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    secureTextEntry
                    style={styles.formInput}
                    value={temporaryPassword}
                  />

                  <View style={styles.passwordHelp}>
                    <Ionicons
                      color={colors.info}
                      name="information-circle-outline"
                      size={19}
                    />
                    <Text
                      style={
                        styles.passwordHelpText
                      }
                    >
                      Use at least 8 characters,
                      including an uppercase
                      letter, lowercase letter and
                      number.
                    </Text>
                  </View>
                </>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void handleSaveUser();
                }}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  isSaving &&
                    styles.disabledButton,
                  pressed &&
                    !isSaving &&
                    styles.actionButtonPressed,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator
                    color={colors.textOnPrimary}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      color={colors.textOnPrimary}
                      name="checkmark-circle-outline"
                      size={20}
                    />
                    <Text
                      style={
                        styles.primaryActionText
                      }
                    >
                      {editingUser
                        ? "Save Changes"
                        : "Create Account"}
                    </Text>
                  </>
                )}
              </Pressable>

              {editingUser ? (
                <View
                  style={
                    styles.accountActionsSection
                  }
                >
                  <Text
                    style={
                      styles.accountActionsTitle
                    }
                  >
                    Account management
                  </Text>

                  {editingUser.role !==
                  "admin" ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSaving}
                        onPress={() =>
                          openAccountLinks(
                            editingUser,
                          )
                        }
                        style={({ pressed }) => [
                          styles.secondaryActionButton,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          color={colors.primary}
                          name="link-outline"
                          size={20}
                        />

                        <View
                          style={
                            styles.actionInformation
                          }
                        >
                          <Text
                            style={
                              styles.secondaryActionTitle
                            }
                          >
                            {editingUser.role ===
                            "parent"
                              ? "Manage learner links"
                              : "Manage class assignments"}
                          </Text>

                          <Text
                            style={
                              styles.secondaryActionText
                            }
                          >
                            {editingUser.role ===
                            "parent"
                              ? "Choose the learners this parent may access"
                              : "Choose this teacher’s classes and subjects"}
                          </Text>
                        </View>

                        <Ionicons
                          color={
                            colors.textSecondary
                          }
                          name="chevron-forward"
                          size={19}
                        />
                      </Pressable>

                      <View
                        style={
                          styles.actionSpacing
                        }
                      />
                    </>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() =>
                      openPasswordReset(
                        editingUser,
                      )
                    }
                    style={({ pressed }) => [
                      styles.secondaryActionButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      color={colors.primary}
                      name="key-outline"
                      size={20}
                    />

                    <View
                      style={
                        styles.actionInformation
                      }
                    >
                      <Text
                        style={
                          styles.secondaryActionTitle
                        }
                      >
                        Reset password
                      </Text>
                      <Text
                        style={
                          styles.secondaryActionText
                        }
                      >
                        Set a new temporary password
                      </Text>
                    </View>

                    <Ionicons
                      color={colors.textSecondary}
                      name="chevron-forward"
                      size={19}
                    />
                  </Pressable>

                  {editingUser.uid !==
                  signedInUser?.uid ? (
                    <View style={styles.statusActions}>
                      {editingUser.status !==
                      "active" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSaving}
                          onPress={() =>
                            confirmStatusChange(
                              editingUser,
                              "active",
                            )
                          }
                          style={({ pressed }) => [
                            styles.statusActionButton,
                            styles.activateButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Ionicons
                            color={colors.success}
                            name="checkmark-circle-outline"
                            size={19}
                          />
                          <Text
                            style={
                              styles.activateButtonText
                            }
                          >
                            Activate
                          </Text>
                        </Pressable>
                      ) : null}

                      {editingUser.status !==
                      "suspended" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSaving}
                          onPress={() =>
                            confirmStatusChange(
                              editingUser,
                              "suspended",
                            )
                          }
                          style={({ pressed }) => [
                            styles.statusActionButton,
                            styles.suspendButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Ionicons
                            color={colors.warning}
                            name="pause-circle-outline"
                            size={19}
                          />
                          <Text
                            style={
                              styles.suspendButtonText
                            }
                          >
                            Suspend
                          </Text>
                        </Pressable>
                      ) : null}

                      {editingUser.status !==
                      "inactive" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSaving}
                          onPress={() =>
                            confirmStatusChange(
                              editingUser,
                              "inactive",
                            )
                          }
                          style={({ pressed }) => [
                            styles.statusActionButton,
                            styles.deactivateButton,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Ionicons
                            color={colors.error}
                            name="close-circle-outline"
                            size={19}
                          />
                          <Text
                            style={
                              styles.deactivateButtonText
                            }
                          >
                            Deactivate
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.selfNotice}>
                      <Ionicons
                        color={colors.info}
                        name="lock-closed-outline"
                        size={19}
                      />
                      <Text
                        style={
                          styles.selfNoticeText
                        }
                      >
                        Your own administrator
                        access cannot be removed
                        here.
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closePasswordReset}
        transparent
        visible={isPasswordModalVisible}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
          style={styles.overlay}
        >
          <View style={styles.passwordModal}>
            <View
              style={styles.passwordModalIcon}
            >
              <Ionicons
                color={colors.primary}
                name="key-outline"
                size={27}
              />
            </View>

            <Text
              style={styles.passwordModalTitle}
            >
              Reset Password
            </Text>

            <Text
              style={styles.passwordModalText}
            >
              Set a temporary password for{" "}
              {passwordResetUser?.firstName}{" "}
              {passwordResetUser?.lastName}.
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setResetPassword}
              placeholder="New temporary password"
              placeholderTextColor={
                colors.textSecondary
              }
              secureTextEntry
              style={styles.formInput}
              value={resetPassword}
            />

            <Text
              style={styles.passwordRequirement}
            >
              Minimum 8 characters with uppercase,
              lowercase and a number.
            </Text>

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => {
                void handleResetPassword();
              }}
              style={({ pressed }) => [
                styles.primaryActionButton,
                isSaving &&
                  styles.disabledButton,
                pressed &&
                  !isSaving &&
                  styles.actionButtonPressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator
                  color={colors.textOnPrimary}
                  size="small"
                />
              ) : (
                <Text
                  style={
                    styles.primaryActionText
                  }
                >
                  Set Temporary Password
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={closePasswordReset}
              style={styles.cancelModalButton}
            >
              <Text
                style={
                  styles.cancelModalButtonText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
  },

  backButton: {
    width: 75,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  headerAddButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: burgundy,
    borderRadius: 14,
  },

  content: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 35,
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 17,
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  summaryIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
  },

  summaryContent: {
    flex: 1,
    marginLeft: 13,
  },

  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },

  summaryText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  summaryStat: {
    flex: 1,
    alignItems: "center",
  },

  summaryValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },

  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 3,
  },

  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  createButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: burgundy,
    borderRadius: 16,
    marginTop: 14,
    paddingHorizontal: 20,
  },

  createButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    marginTop: 13,
    padding: 14,
  },

  securityText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },

  searchContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginTop: 19,
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 9,
  },

  clearButton: {
    minWidth: 40,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  filterContent: {
    gap: 9,
    paddingTop: 13,
    paddingBottom: 3,
  },

  filterButton: {
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
  },

  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  filterTextSelected: {
    color: colors.textOnPrimary,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 11,
  },

  listTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },

  resultCount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  loadingContainer: {
    alignItems: "center",
    paddingVertical: 45,
  },

  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    padding: 14,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 9,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 30,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 11,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    marginBottom: 10,
    padding: 15,
  },

  userCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
  },

  avatarText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  userInformation: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  userName: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  youBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  youBadgeText: {
    color: burgundy,
    fontSize: 8,
    fontWeight: "900",
  },

  userEmail: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },

  roleBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  roleText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  activeBadge: {
    backgroundColor: "#E7F4EC",
  },

  inactiveBadge: {
    backgroundColor: "#FDECEC",
  },

  suspendedBadge: {
    backgroundColor: "#FFF2D8",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  activeDot: {
    backgroundColor: colors.success,
  },

  inactiveDot: {
    backgroundColor: colors.error,
  },

  suspendedDot: {
    backgroundColor: colors.warning,
  },

  statusText: {
    fontSize: 8,
    fontWeight: "800",
  },

  activeText: {
    color: colors.success,
  },

  inactiveText: {
    color: colors.error,
  },

  suspendedText: {
    color: colors.warning,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  modalKeyboardView: {
    flex: 1,
  },

  modalHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
  },

  modalHeaderButton: {
    width: 70,
    minHeight: 44,
    justifyContent: "center",
  },

  modalCancelText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  modalTitle: {
    color: colors.textOnPrimary,
    fontSize: 17,
    fontWeight: "800",
  },

  modalContent: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 45,
  },

  formIntro: {
    alignItems: "center",
    marginBottom: 23,
  },

  formIntroIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    marginBottom: 12,
  },

  formIntroTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },

  formIntroText: {
    maxWidth: 370,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },

  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 7,
  },

  formInput: {
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
  },

  roleOptions: {
    gap: 8,
  },

  roleOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
  },

  roleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  roleOptionText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  roleOptionTextSelected: {
    color: colors.textOnPrimary,
  },

  disabledOption: {
    opacity: 0.45,
  },

  passwordHelp: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 13,
    marginTop: 10,
    padding: 12,
  },

  passwordHelpText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 8,
  },

  primaryActionButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: burgundy,
    borderRadius: 16,
    marginTop: 24,
    paddingHorizontal: 18,
  },

  primaryActionText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "800",
  },

  actionButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  disabledButton: {
    opacity: 0.55,
  },

  accountActionsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 27,
    paddingTop: 20,
  },

  accountActionsTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 11,
  },

  secondaryActionButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
  },

  actionInformation: {
    flex: 1,
    marginLeft: 11,
  },

  secondaryActionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },

  secondaryActionText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  actionSpacing: {
    height: 10,
  },

  statusActions: {
    gap: 8,
    marginTop: 10,
  },

  statusActionButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
  },

  activateButton: {
    backgroundColor: "#E7F4EC",
    borderColor: colors.success,
  },

  activateButtonText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
  },

  suspendButton: {
    backgroundColor: "#FFF2D8",
    borderColor: colors.warning,
  },

  suspendButtonText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "800",
  },

  deactivateButton: {
    backgroundColor: "#FDECEC",
    borderColor: colors.error,
  },

  deactivateButtonText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "800",
  },

  selfNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    marginTop: 10,
    padding: 13,
  },

  selfNoticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 8,
  },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(0, 0, 0, 0.52)",
    padding: 20,
  },

  passwordModal: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
  },

  passwordModalIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 17,
  },

  passwordModalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },

  passwordModalText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 15,
    textAlign: "center",
  },

  passwordRequirement: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
  },

  cancelModalButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  cancelModalButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.65,
  },
});