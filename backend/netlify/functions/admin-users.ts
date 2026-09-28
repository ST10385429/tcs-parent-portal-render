import type { Handler, HandlerEvent } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

type UserRole = "parent" | "teacher" | "admin";

type UserStatus =
  | "active"
  | "inactive"
  | "suspended";

type AdminUserAction =
  | "create"
  | "update"
  | "setStatus"
  | "resetPassword";

type RequestBody = {
  action?: AdminUserAction;
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  temporaryPassword?: string;
};

type AdminIdentity = {
  uid: string;
  email: string;
};

const allowedRoles: UserRole[] = [
  "parent",
  "teacher",
  "admin",
];

const allowedStatuses: UserStatus[] = [
  "active",
  "inactive",
  "suspended",
];

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(
  statusCode: number,
  body: Record<string, unknown>,
) {
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(body),
  };
}

function readRequiredString(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const cleanedValue = value.trim();

  if (!cleanedValue) {
    throw new Error(`${label} is required.`);
  }

  return cleanedValue;
}

function validateName(
  value: unknown,
  label: string,
): string {
  const cleanedValue = readRequiredString(
    value,
    label,
  );

  if (
    cleanedValue.length < 2 ||
    cleanedValue.length > 80
  ) {
    throw new Error(
      `${label} must contain between 2 and 80 characters.`,
    );
  }

  return cleanedValue;
}

function validateEmail(value: unknown): string {
  const email = readRequiredString(
    value,
    "Email address",
  ).toLowerCase();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error(
      "Enter a valid email address.",
    );
  }

  return email;
}

function validatePassword(
  value: unknown,
): string {
  const password = readRequiredString(
    value,
    "Temporary password",
  );

  if (
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error(
      "The temporary password must contain between 8 and 128 characters.",
    );
  }

  if (!/[a-z]/.test(password)) {
    throw new Error(
      "The temporary password must contain a lowercase letter.",
    );
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error(
      "The temporary password must contain an uppercase letter.",
    );
  }

  if (!/[0-9]/.test(password)) {
    throw new Error(
      "The temporary password must contain a number.",
    );
  }

  return password;
}

function validateRole(
  value: unknown,
): UserRole {
  if (
    typeof value !== "string" ||
    !allowedRoles.includes(value as UserRole)
  ) {
    throw new Error(
      "Select a valid user role.",
    );
  }

  return value as UserRole;
}

function validateStatus(
  value: unknown,
): UserStatus {
  if (
    typeof value !== "string" ||
    !allowedStatuses.includes(
      value as UserStatus,
    )
  ) {
    throw new Error(
      "Select a valid account status.",
    );
  }

  return value as UserStatus;
}

function getBearerToken(
  event: HandlerEvent,
): string {
  const authorization =
    event.headers.authorization ??
    event.headers.Authorization;

  if (!authorization) {
    throw new Error(
      "You must be signed in to perform this action.",
    );
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token?.trim()
  ) {
    throw new Error(
      "The administrator authentication token is invalid.",
    );
  }

  return token.trim();
}

async function requireAdministrator(
  event: HandlerEvent,
): Promise<AdminIdentity> {
  const token = getBearerToken(event);

  const decodedToken =
    await adminAuth.verifyIdToken(token);

  const administratorSnapshot =
    await adminFirestore
      .collection("users")
      .doc(decodedToken.uid)
      .get();

  if (!administratorSnapshot.exists) {
    throw new Error(
      "The administrator profile could not be found.",
    );
  }

  const administratorData =
    administratorSnapshot.data();

  if (
    administratorData?.role !== "admin" ||
    administratorData?.status !== "active"
  ) {
    throw new Error(
      "Only active administrators may manage users.",
    );
  }

  return {
    uid: decodedToken.uid,
    email:
      typeof decodedToken.email === "string"
        ? decodedToken.email
        : "",
  };
}

function parseRequestBody(
  event: HandlerEvent,
): RequestBody {
  if (!event.body) {
    throw new Error(
      "The request body is required.",
    );
  }

  try {
    return JSON.parse(event.body) as RequestBody;
  } catch {
    throw new Error(
      "The request body is not valid JSON.",
    );
  }
}

async function writeAuditLog(
  administrator: AdminIdentity,
  action: AdminUserAction,
  targetUid: string,
  details: Record<string, unknown>,
): Promise<void> {
  await adminFirestore
    .collection("adminAuditLogs")
    .add({
      action,
      targetUid,
      administratorUid: administrator.uid,
      administratorEmail:
        administrator.email,
      details,
      createdAt: FieldValue.serverTimestamp(),
    });
}

async function createUser(
  body: RequestBody,
  administrator: AdminIdentity,
) {
  const email = validateEmail(body.email);
  const firstName = validateName(
    body.firstName,
    "First name",
  );
  const lastName = validateName(
    body.lastName,
    "Last name",
  );
  const role = validateRole(body.role);
  const password = validatePassword(
    body.temporaryPassword,
  );

  const displayName =
    `${firstName} ${lastName}`.trim();

  const authUser =
    await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
      disabled: false,
    });

  try {
    await adminAuth.setCustomUserClaims(
      authUser.uid,
      {
        role,
      },
    );

    await adminFirestore
      .collection("users")
      .doc(authUser.uid)
      .set({
        uid: authUser.uid,
        email,
        firstName,
        lastName,
        role,
        status: "active",
        mustChangePassword: true,
        createdBy: administrator.uid,
        updatedBy: administrator.uid,
        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

    await writeAuditLog(
      administrator,
      "create",
      authUser.uid,
      {
        email,
        firstName,
        lastName,
        role,
      },
    );
  } catch (error) {
    await adminAuth
      .deleteUser(authUser.uid)
      .catch(() => undefined);

    throw error;
  }

  return {
    message: "The user account was created.",
    user: {
      uid: authUser.uid,
      email,
      firstName,
      lastName,
      role,
      status: "active" as UserStatus,
      mustChangePassword: true,
    },
  };
}

async function updateUser(
  body: RequestBody,
  administrator: AdminIdentity,
) {
  const uid = readRequiredString(
    body.uid,
    "User identifier",
  );
  const email = validateEmail(body.email);
  const firstName = validateName(
    body.firstName,
    "First name",
  );
  const lastName = validateName(
    body.lastName,
    "Last name",
  );
  const role = validateRole(body.role);

  const userReference = adminFirestore
    .collection("users")
    .doc(uid);

  const userSnapshot =
    await userReference.get();

  if (!userSnapshot.exists) {
    throw new Error(
      "The selected user could not be found.",
    );
  }

  const existingData = userSnapshot.data();

  if (
    uid === administrator.uid &&
    existingData?.role !== role
  ) {
    throw new Error(
      "You cannot change your own administrator role.",
    );
  }

  await adminAuth.updateUser(uid, {
    email,
    displayName:
      `${firstName} ${lastName}`.trim(),
  });

  if (existingData?.role !== role) {
    await adminAuth.setCustomUserClaims(uid, {
      role,
    });
  }

  await userReference.set(
    {
      email,
      firstName,
      lastName,
      role,
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  await writeAuditLog(
    administrator,
    "update",
    uid,
    {
      email,
      firstName,
      lastName,
      role,
      previousRole:
        existingData?.role ?? null,
    },
  );

  return {
    message: "The user account was updated.",
    user: {
      uid,
      email,
      firstName,
      lastName,
      role,
      status:
        existingData?.status === "inactive" ||
        existingData?.status === "suspended"
          ? existingData.status
          : "active",
      mustChangePassword:
        existingData?.mustChangePassword ===
        true,
    },
  };
}

async function setUserStatus(
  body: RequestBody,
  administrator: AdminIdentity,
) {
  const uid = readRequiredString(
    body.uid,
    "User identifier",
  );
  const status = validateStatus(body.status);

  if (uid === administrator.uid) {
    throw new Error(
      "You cannot change the status of your own administrator account.",
    );
  }

  const userReference = adminFirestore
    .collection("users")
    .doc(uid);

  const userSnapshot =
    await userReference.get();

  if (!userSnapshot.exists) {
    throw new Error(
      "The selected user could not be found.",
    );
  }

  const userData = userSnapshot.data();

  await adminAuth.updateUser(uid, {
    disabled: status !== "active",
  });

  await userReference.set(
    {
      status,
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  await writeAuditLog(
    administrator,
    "setStatus",
    uid,
    {
      previousStatus:
        userData?.status ?? null,
      status,
    },
  );

  return {
    message:
      status === "active"
        ? "The user account was activated."
        : status === "suspended"
          ? "The user account was suspended."
          : "The user account was deactivated.",
    user: {
      uid,
      email:
        typeof userData?.email === "string"
          ? userData.email
          : "",
      firstName:
        typeof userData?.firstName ===
        "string"
          ? userData.firstName
          : "",
      lastName:
        typeof userData?.lastName ===
        "string"
          ? userData.lastName
          : "",
      role: validateRole(userData?.role),
      status,
      mustChangePassword:
        userData?.mustChangePassword === true,
    },
  };
}

async function resetUserPassword(
  body: RequestBody,
  administrator: AdminIdentity,
) {
  const uid = readRequiredString(
    body.uid,
    "User identifier",
  );
  const temporaryPassword =
    validatePassword(
      body.temporaryPassword,
    );

  const userReference = adminFirestore
    .collection("users")
    .doc(uid);

  const userSnapshot =
    await userReference.get();

  if (!userSnapshot.exists) {
    throw new Error(
      "The selected user could not be found.",
    );
  }

  await adminAuth.updateUser(uid, {
    password: temporaryPassword,
  });

  await userReference.set(
    {
      mustChangePassword: true,
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  await writeAuditLog(
    administrator,
    "resetPassword",
    uid,
    {},
  );

  return {
    message:
      "A new temporary password was set.",
  };
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = String(error.code);

    if (
      code ===
      "auth/email-already-exists"
    ) {
      return "An account already exists with this email address.";
    }

    if (code === "auth/user-not-found") {
      return "The selected authentication account could not be found.";
    }

    if (
      code === "auth/invalid-email"
    ) {
      return "Enter a valid email address.";
    }

    if (
      code === "auth/invalid-password"
    ) {
      return "The temporary password is invalid.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The user-management request could not be completed.";
}

export const handler: Handler = async (
  event,
) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: responseHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Method not allowed.",
    });
  }

  try {
    const administrator =
      await requireAdministrator(event);

    const body = parseRequestBody(event);

    if (!body.action) {
      return jsonResponse(400, {
        error:
          "A user-management action is required.",
      });
    }

    let result:
      | Record<string, unknown>
      | undefined;

    switch (body.action) {
      case "create":
        result = await createUser(
          body,
          administrator,
        );
        break;

      case "update":
        result = await updateUser(
          body,
          administrator,
        );
        break;

      case "setStatus":
        result = await setUserStatus(
          body,
          administrator,
        );
        break;

      case "resetPassword":
        result = await resetUserPassword(
          body,
          administrator,
        );
        break;

      default:
        return jsonResponse(400, {
          error:
            "The requested user-management action is invalid.",
        });
    }

    return jsonResponse(200, {
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Unable to complete administrator user action:",
      error,
    );

    const message =
      getErrorMessage(error);

    const isAuthenticationError =
      message.includes("signed in") ||
      message.includes("authentication token");

    const isAuthorizationError =
      message.includes(
        "Only active administrators",
      );

    return jsonResponse(
      isAuthenticationError
        ? 401
        : isAuthorizationError
          ? 403
          : 400,
      {
        success: false,
        error: message,
      },
    );
  }
};