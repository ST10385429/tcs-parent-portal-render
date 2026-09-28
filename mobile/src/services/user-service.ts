import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  firebaseApp,
  firestore,
} from "@/lib/firebase";

import type {
  AdminUserActionResult,
  AppUser,
  CreateAppUserInput,
  UpdateAppUserInput,
  UserRole,
  UserStatus,
} from "@/types/auth";

const validRoles: UserRole[] = [
  "parent",
  "teacher",
  "admin",
];

const validStatuses: UserStatus[] = [
  "active",
  "inactive",
  "suspended",
];

type AdminUserApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  user?: AppUser;
};

type AdminUserApiRequest =
  | ({
      action: "create";
    } & CreateAppUserInput)
  | ({
      action: "update";
    } & UpdateAppUserInput)
  | {
      action: "setStatus";
      uid: string;
      status: UserStatus;
    }
  | {
      action: "resetPassword";
      uid: string;
      temporaryPassword: string;
    };

function isUserRole(
  value: unknown,
): value is UserRole {
  return (
    typeof value === "string" &&
    validRoles.includes(value as UserRole)
  );
}

function isUserStatus(
  value: unknown,
): value is UserStatus {
  return (
    typeof value === "string" &&
    validStatuses.includes(
      value as UserStatus,
    )
  );
}

function getAdminUsersEndpoint(): string {
  const configuredUrl =
    process.env
      .EXPO_PUBLIC_PAYFAST_BACKEND_URL
      ?.trim();

  if (!configuredUrl) {
    throw new Error(
      "The backend URL has not been configured.",
    );
  }

  const normalizedUrl =
    configuredUrl.replace(/\/+$/, "");

  const functionsPath =
    "/.netlify/functions";

  const functionsPathIndex =
    normalizedUrl.indexOf(functionsPath);

  if (functionsPathIndex >= 0) {
    const functionsBaseUrl =
      normalizedUrl.slice(
        0,
        functionsPathIndex +
          functionsPath.length,
      );

    return `${functionsBaseUrl}/admin-users`;
  }

  return `${normalizedUrl}${functionsPath}/admin-users`;
}

async function readApiResponse(
  response: Response,
): Promise<AdminUserApiResponse> {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(
      responseText,
    ) as AdminUserApiResponse;
  } catch {
    throw new Error(
      "The server returned an invalid response.",
    );
  }
}

async function callAdminUserApi(
  request: AdminUserApiRequest,
): Promise<AdminUserActionResult> {
  const firebaseAuth =
    getAuth(firebaseApp);

  const signedInUser =
    firebaseAuth.currentUser;

  if (!signedInUser) {
    throw new Error(
      "You must be signed in as an administrator.",
    );
  }

  const token =
    await signedInUser.getIdToken(true);

  const response = await fetch(
    getAdminUsersEndpoint(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  const result =
    await readApiResponse(response);

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        "The user-management request could not be completed.",
    );
  }

  return {
    message:
      result.message ||
      "The user account was updated.",
    user: result.user,
  };
}

export async function getAllUsers(): Promise<
  AppUser[]
> {
  const snapshot = await getDocs(
    collection(firestore, "users"),
  );

  const users: AppUser[] = [];

  snapshot.forEach((userDocument) => {
    const data = userDocument.data();

    if (
      !isUserRole(data.role) ||
      !isUserStatus(data.status)
    ) {
      return;
    }

    users.push({
      uid: userDocument.id,
      email:
        typeof data.email === "string"
          ? data.email
          : "",
      firstName:
        typeof data.firstName === "string"
          ? data.firstName
          : "",
      lastName:
        typeof data.lastName === "string"
          ? data.lastName
          : "",
      role: data.role,
      status: data.status,
      mustChangePassword:
        data.mustChangePassword === true,
    });
  });

  return users.sort(
    (firstUser, secondUser) => {
      const firstName =
        `${firstUser.firstName} ${firstUser.lastName}`.trim();

      const secondName =
        `${secondUser.firstName} ${secondUser.lastName}`.trim();

      return firstName.localeCompare(
        secondName,
      );
    },
  );
}

export async function createAppUser(
  input: CreateAppUserInput,
): Promise<AdminUserActionResult> {
  return callAdminUserApi({
    action: "create",
    ...input,
  });
}

export async function updateAppUser(
  input: UpdateAppUserInput,
): Promise<AdminUserActionResult> {
  return callAdminUserApi({
    action: "update",
    ...input,
  });
}

export async function setAppUserStatus(
  uid: string,
  status: UserStatus,
): Promise<AdminUserActionResult> {
  return callAdminUserApi({
    action: "setStatus",
    uid: uid.trim(),
    status,
  });
}

export async function resetAppUserPassword(
  uid: string,
  temporaryPassword: string,
): Promise<AdminUserActionResult> {
  return callAdminUserApi({
    action: "resetPassword",
    uid: uid.trim(),
    temporaryPassword,
  });
}