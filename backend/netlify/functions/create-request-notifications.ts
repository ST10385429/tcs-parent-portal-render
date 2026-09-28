import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

import {
  sendExpoPushNotification,
} from "./lib/expo-push";

type RequestBody = {
  requestId?: string;
  replyId?: string;
};

type SupportedRequestType =
  | "generalQuery"
  | "absenceReport"
  | "teacherAppointment";

type AuthenticatedRole =
  | "parent"
  | "teacher"
  | "admin";

type AuthenticatedUser = {
  uid: string;
  role: AuthenticatedRole;
};

type NotificationRecipient = {
  uid: string;
  role: AuthenticatedRole;
};

type NotificationContent = {
  title: string;
  body: string;
};

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

function parseRequestBody(
  event: HandlerEvent,
): RequestBody {
  if (!event.body) {
    throw new Error(
      "The request body is required.",
    );
  }

  try {
    return JSON.parse(
      event.body,
    ) as RequestBody;
  } catch {
    throw new Error(
      "The request body is not valid JSON.",
    );
  }
}

function readRequiredString(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new Error(
      `${label} is required.`,
    );
  }

  const cleanedValue =
    value.trim();

  if (!cleanedValue) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return cleanedValue;
}

function readOptionalString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getBearerToken(
  event: HandlerEvent,
): string {
  const authorization =
    event.headers.authorization ??
    event.headers.Authorization;

  if (!authorization) {
    throw new Error(
      "You must be signed in.",
    );
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    scheme?.toLowerCase() !==
      "bearer" ||
    !token?.trim()
  ) {
    throw new Error(
      "The authentication token is invalid.",
    );
  }

  return token.trim();
}

function normalizeRole(
  role: unknown,
): AuthenticatedRole | null {
  if (role === "parent") {
    return "parent";
  }

  if (role === "teacher") {
    return "teacher";
  }

  if (
    role === "admin" ||
    role === "administrator"
  ) {
    return "admin";
  }

  return null;
}

async function requireActiveUser(
  event: HandlerEvent,
): Promise<AuthenticatedUser> {
  const token =
    getBearerToken(event);

  const decodedToken =
    await adminAuth.verifyIdToken(
      token,
    );

  const userSnapshot =
    await adminFirestore
      .collection("users")
      .doc(decodedToken.uid)
      .get();

  if (!userSnapshot.exists) {
    throw new Error(
      "The user profile could not be found.",
    );
  }

  const userData =
    userSnapshot.data();

  const role =
    normalizeRole(
      userData?.role,
    );

  if (
    !role ||
    userData?.status !== "active"
  ) {
    throw new Error(
      "Only active parent, teacher, or administrator accounts may perform this action.",
    );
  }

  return {
    uid: decodedToken.uid,
    role,
  };
}

async function getActiveAdministratorUids():
  Promise<string[]> {
  const roles = [
    "admin",
    "administrator",
  ];

  const administratorUids =
    new Set<string>();

  for (
    const role
    of roles
  ) {
    const snapshot =
      await adminFirestore
        .collection("users")
        .where(
          "role",
          "==",
          role,
        )
        .get();

    snapshot.docs
      .filter(
        (document) =>
          document.data().status ===
          "active",
      )
      .forEach(
        (document) => {
          administratorUids.add(
            document.id,
          );
        },
      );
  }

  return [
    ...administratorUids,
  ];
}

async function requireActiveTeacher(
  teacherUid: string,
): Promise<string> {
  const cleanedTeacherUid =
    readRequiredString(
      teacherUid,
      "Assigned teacher",
    );

  const teacherSnapshot =
    await adminFirestore
      .collection("users")
      .doc(cleanedTeacherUid)
      .get();

  if (!teacherSnapshot.exists) {
    throw new Error(
      "The assigned teacher account could not be found.",
    );
  }

  const teacherData =
    teacherSnapshot.data();

  if (
    teacherData?.role !== "teacher" ||
    teacherData?.status !== "active"
  ) {
    throw new Error(
      "The assigned teacher account is not active.",
    );
  }

  return cleanedTeacherUid;
}

function getLearnerName(
  requestData:
    FirebaseFirestore.DocumentData,
): string {
  const firstName =
    readOptionalString(
      requestData.learnerFirstName,
    );

  const lastName =
    readOptionalString(
      requestData.learnerLastName,
    );

  const fullName =
    `${firstName} ${lastName}`.trim();

  return fullName || "Learner";
}

function isSupportedRequestType(
  value: unknown,
): value is SupportedRequestType {
  return (
    value === "generalQuery" ||
    value === "absenceReport" ||
    value === "teacherAppointment"
  );
}

function getRequestNotificationContent(
  requestType:
    SupportedRequestType,
  requestData:
    FirebaseFirestore.DocumentData,
): NotificationContent {
  const learnerName =
    getLearnerName(
      requestData,
    );

  if (
    requestType ===
    "generalQuery"
  ) {
    const subject =
      readOptionalString(
        requestData.subject,
      ) || "General query";

    return {
      title:
        "New General Query",

      body:
        `${learnerName}: ${subject}`,
    };
  }

  if (
    requestType ===
    "absenceReport"
  ) {
    return {
      title:
        "New Absence Report",

      body:
        `${learnerName}: Learner absence report`,
    };
  }

  const teacherSubject =
    readOptionalString(
      requestData.teacherSubject,
    );

  const requestedTime =
    readOptionalString(
      requestData.requestedAppointmentTime,
    );

  let appointmentDetails =
    "Teacher appointment request";

  if (
    teacherSubject &&
    requestedTime
  ) {
    appointmentDetails =
      `${teacherSubject} appointment requested for ${requestedTime}`;
  } else if (
    teacherSubject
  ) {
    appointmentDetails =
      `${teacherSubject} appointment request`;
  } else if (
    requestedTime
  ) {
    appointmentDetails =
      `Appointment requested for ${requestedTime}`;
  }

  return {
    title:
      "New Teacher Appointment Request",

    body:
      `${learnerName}: ${appointmentDetails}`,
  };
}

async function getRequestNotificationRecipients(
  requestType:
    SupportedRequestType,
  requestData:
    FirebaseFirestore.DocumentData,
): Promise<NotificationRecipient[]> {
  const administratorUids =
    await getActiveAdministratorUids();

  const recipients:
    NotificationRecipient[] =
      administratorUids.map(
        (administratorUid) => ({
          uid:
            administratorUid,
          role:
            "admin",
        }),
      );

  if (
    requestType ===
    "teacherAppointment"
  ) {
    const teacherUid =
      await requireActiveTeacher(
        readOptionalString(
          requestData.teacherUid,
        ),
      );

    if (
      !recipients.some(
        (recipient) =>
          recipient.uid ===
          teacherUid,
      )
    ) {
      recipients.push({
        uid:
          teacherUid,
        role:
          "teacher",
      });
    }
  }

  return recipients;
}

async function createNotification(
  notificationId: string,
  recipient:
    NotificationRecipient,
  content:
    NotificationContent,
  sourceType: string,
  sourceId: string,
  route: string,
): Promise<boolean> {
  const notificationReference =
    adminFirestore
      .collection("notifications")
      .doc(notificationId);

  /*
   * Firestore is the source of truth.
   *
   * The deterministic notification
   * ID prevents the same request or
   * reply from creating duplicate
   * inbox notifications.
   */
  const wasCreated =
    await adminFirestore.runTransaction(
      async (transaction) => {
        const existingSnapshot =
          await transaction.get(
            notificationReference,
          );

        if (
          existingSnapshot.exists
        ) {
          return false;
        }

        transaction.create(
          notificationReference,
          {
            recipientUid:
              recipient.uid,

            recipientRole:
              recipient.role,

            category:
              "requests",

            title:
              content.title,

            body:
              content.body,

            sourceType,

            sourceId,

            resourceId:
              sourceId,

            route,

            read:
              false,

            readAt:
              null,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        return true;
      },
    );

  /*
   * Push delivery happens only after
   * the Firestore transaction has
   * completed successfully.
   *
   * Existing notifications are not
   * pushed again when an API request
   * is retried.
   */
  if (wasCreated) {
    await sendExpoPushNotification({
      recipientUid:
        recipient.uid,

      title:
        content.title,

      body:
        content.body,

      category:
        "requests",

      route,

      sourceType,

      sourceId,

      resourceId:
        sourceId,
    });
  }

  return wasCreated;
}

async function createInitialRequestNotifications(
  requestId: string,
  authenticatedUser:
    AuthenticatedUser,
): Promise<{
  created: number;
  existing: number;
}> {
  if (
    authenticatedUser.role !==
    "parent"
  ) {
    throw new Error(
      "Only parents may create notifications for new parent requests.",
    );
  }

  const requestSnapshot =
    await adminFirestore
      .collection("parentRequests")
      .doc(requestId)
      .get();

  if (!requestSnapshot.exists) {
    throw new Error(
      "The parent request could not be found.",
    );
  }

  const requestData =
    requestSnapshot.data();

  if (!requestData) {
    throw new Error(
      "The parent request is unavailable.",
    );
  }

  if (
    requestData.parentUid !==
    authenticatedUser.uid
  ) {
    throw new Error(
      "You may only create notifications for your own requests.",
    );
  }

  if (
    !isSupportedRequestType(
      requestData.requestType,
    )
  ) {
    throw new Error(
      "This request type is not supported by the notification service.",
    );
  }

  const requestType =
    requestData.requestType;

  const recipients =
    await getRequestNotificationRecipients(
      requestType,
      requestData,
    );

  if (
    recipients.length === 0
  ) {
    throw new Error(
      "No active notification recipients are available.",
    );
  }

  const notificationContent =
    getRequestNotificationContent(
      requestType,
      requestData,
    );

  let created = 0;
  let existing = 0;

  for (
    const recipient
    of recipients
  ) {
    const notificationId =
      `parentRequest_${requestId}_created_${recipient.uid}`;

    const route =
      recipient.role ===
      "teacher"
        ? "/teacher/appointments"
        : "/admin/requests";

    const wasCreated =
      await createNotification(
        notificationId,
        recipient,
        notificationContent,
        "parentRequest",
        requestId,
        route,
      );

    if (wasCreated) {
      created += 1;
    } else {
      existing += 1;
    }
  }

  return {
    created,
    existing,
  };
}

function getReplyContent(
  senderRole:
    AuthenticatedRole,
  senderName: string,
  requestData:
    FirebaseFirestore.DocumentData,
): NotificationContent {
  const learnerName =
    getLearnerName(
      requestData,
    );

  const displayName =
    senderName ||
    (
      senderRole === "parent"
        ? "Parent"
        : senderRole === "teacher"
          ? "Teacher"
          : "Administrator"
    );

  if (
    senderRole ===
    "parent"
  ) {
    return {
      title:
        "New Parent Reply",

      body:
        `${displayName} replied regarding ${learnerName}.`,
    };
  }

  if (
    senderRole ===
    "teacher"
  ) {
    return {
      title:
        "New Teacher Reply",

      body:
        `${displayName} replied to your request for ${learnerName}.`,
    };
  }

  return {
    title:
      "New Administrator Reply",

    body:
      `${displayName} replied to your request for ${learnerName}.`,
  };
}

async function getReplyRecipients(
  authenticatedUser:
    AuthenticatedUser,
  requestData:
    FirebaseFirestore.DocumentData,
): Promise<NotificationRecipient[]> {
  /*
   * Staff replies always return to
   * the parent who owns the request.
   */
  if (
    authenticatedUser.role ===
      "teacher" ||
    authenticatedUser.role ===
      "admin"
  ) {
    const parentUid =
      readRequiredString(
        requestData.parentUid,
        "Parent",
      );

    return [
      {
        uid:
          parentUid,
        role:
          "parent",
      },
    ];
  }

  /*
   * Parent replies return to the
   * appropriate staff recipients.
   */
  const administratorUids =
    await getActiveAdministratorUids();

  const recipients:
    NotificationRecipient[] =
      administratorUids.map(
        (administratorUid) => ({
          uid:
            administratorUid,
          role:
            "admin",
        }),
      );

  if (
    requestData.requestType ===
    "teacherAppointment"
  ) {
    const teacherUid =
      await requireActiveTeacher(
        readOptionalString(
          requestData.teacherUid,
        ),
      );

    if (
      !recipients.some(
        (recipient) =>
          recipient.uid ===
          teacherUid,
      )
    ) {
      recipients.push({
        uid:
          teacherUid,
        role:
          "teacher",
      });
    }
  }

  return recipients;
}

async function createReplyNotifications(
  requestId: string,
  replyId: string,
  authenticatedUser:
    AuthenticatedUser,
): Promise<{
  created: number;
  existing: number;
}> {
  const requestReference =
    adminFirestore
      .collection("parentRequests")
      .doc(requestId);

  const requestSnapshot =
    await requestReference.get();

  if (!requestSnapshot.exists) {
    throw new Error(
      "The parent request could not be found.",
    );
  }

  const requestData =
    requestSnapshot.data();

  if (!requestData) {
    throw new Error(
      "The parent request is unavailable.",
    );
  }

  if (
    !isSupportedRequestType(
      requestData.requestType,
    )
  ) {
    throw new Error(
      "This request type is not supported by the notification service.",
    );
  }

  const replySnapshot =
    await requestReference
      .collection("replies")
      .doc(replyId)
      .get();

  if (!replySnapshot.exists) {
    throw new Error(
      "The request reply could not be found.",
    );
  }

  const replyData =
    replySnapshot.data();

  if (!replyData) {
    throw new Error(
      "The request reply is unavailable.",
    );
  }

  /*
   * The authenticated account must
   * be the account that created the
   * reply document.
   */
  if (
    replyData.senderUid !==
    authenticatedUser.uid
  ) {
    throw new Error(
      "You may only create notifications for your own replies.",
    );
  }

  const replyRole =
    normalizeRole(
      replyData.senderRole,
    );

  if (
    !replyRole ||
    replyRole !==
      authenticatedUser.role
  ) {
    throw new Error(
      "The reply sender role does not match the signed-in account.",
    );
  }

  /*
   * Verify the signed-in user is
   * actually allowed to participate
   * in this request.
   */
  if (
    authenticatedUser.role ===
    "parent"
  ) {
    if (
      requestData.parentUid !==
      authenticatedUser.uid
    ) {
      throw new Error(
        "You may only reply to your own parent requests.",
      );
    }
  } else if (
    authenticatedUser.role ===
    "teacher"
  ) {
    if (
      requestData.requestType !==
        "teacherAppointment" ||
      requestData.teacherUid !==
        authenticatedUser.uid
    ) {
      throw new Error(
        "You may only reply to appointment requests assigned to you.",
      );
    }
  }

  const senderName =
    readOptionalString(
      replyData.senderName,
    );

  const content =
    getReplyContent(
      authenticatedUser.role,
      senderName,
      requestData,
    );

  const recipients =
    await getReplyRecipients(
      authenticatedUser,
      requestData,
    );

  if (
    recipients.length === 0
  ) {
    throw new Error(
      "No active notification recipients are available.",
    );
  }

  let created = 0;
  let existing = 0;

  for (
    const recipient
    of recipients
  ) {
    /*
     * Never notify the person who
     * just sent the reply.
     */
    if (
      recipient.uid ===
      authenticatedUser.uid
    ) {
      continue;
    }

    const notificationId =
      `parentRequest_${requestId}_reply_${replyId}_${recipient.uid}`;

    let route =
      "/parent/chat";

    if (
      recipient.role ===
      "teacher"
    ) {
      route =
        "/teacher/appointments";
    } else if (
      recipient.role ===
      "admin"
    ) {
      route =
        "/admin/requests";
    }

    const wasCreated =
      await createNotification(
        notificationId,
        recipient,
        content,
        "parentRequestReply",
        requestId,
        route,
      );

    if (wasCreated) {
      created += 1;
    } else {
      existing += 1;
    }
  }

  return {
    created,
    existing,
  };
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "The notification could not be created.";
}

export const handler: Handler =
  async (event) => {
    if (
      event.httpMethod ===
      "OPTIONS"
    ) {
      return {
        statusCode: 204,
        headers:
          responseHeaders,
        body: "",
      };
    }

    if (
      event.httpMethod !==
      "POST"
    ) {
      return jsonResponse(
        405,
        {
          success: false,
          error:
            "Method not allowed.",
        },
      );
    }

    try {
      const authenticatedUser =
        await requireActiveUser(
          event,
        );

      const body =
        parseRequestBody(
          event,
        );

      const requestId =
        readRequiredString(
          body.requestId,
          "Request identifier",
        );

      let result: {
        created: number;
        existing: number;
      };

      if (
        body.replyId
      ) {
        const replyId =
          readRequiredString(
            body.replyId,
            "Reply identifier",
          );

        result =
          await createReplyNotifications(
            requestId,
            replyId,
            authenticatedUser,
          );
      } else {
        result =
          await createInitialRequestNotifications(
            requestId,
            authenticatedUser,
          );
      }

      return jsonResponse(
        200,
        {
          success: true,
          created:
            result.created,
          existing:
            result.existing,
        },
      );
    } catch (error) {
      console.error(
        "Unable to create request notification:",
        error,
      );

      const message =
        getErrorMessage(
          error,
        );

      const isAuthenticationError =
        message.includes(
          "signed in",
        ) ||
        message.includes(
          "authentication token",
        );

      const isAuthorizationError =
        message.includes(
          "Only active",
        ) ||
        message.includes(
          "Only parents",
        ) ||
        message.includes(
          "your own",
        ) ||
        message.includes(
          "assigned to you",
        ) ||
        message.includes(
          "sender role",
        );

      return jsonResponse(
        isAuthenticationError
          ? 401
          : isAuthorizationError
            ? 403
            : 400,
        {
          success: false,
          error:
            message,
        },
      );
    }
  };