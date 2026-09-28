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

type NotificationSourceType =
  | "subjectResult"
  | "termReport"
  | "feeStatement";

type RequestBody = {
  sourceType?: NotificationSourceType;
  sourceId?: string;
};

type UserRole =
  | "parent"
  | "teacher"
  | "admin";

type AuthenticatedUser = {
  uid: string;
  role: UserRole;
};

type Recipient = {
  uid: string;
  role: UserRole;
};

type NotificationCategory =
  | "reports"
  | "fees";

type NotificationContent = {
  category: NotificationCategory;
  title: string;
  body: string;
  route: string;
};

function jsonResponse(
  statusCode: number,
  body: Record<string, unknown>,
) {
  return {
    statusCode,

    headers: {
      "Content-Type":
        "application/json",
    },

    body:
      JSON.stringify(body),
  };
}

function normalizeRole(
  value: unknown,
): UserRole | null {
  if (value === "parent") {
    return "parent";
  }

  if (value === "teacher") {
    return "teacher";
  }

  if (
    value === "admin" ||
    value === "administrator"
  ) {
    return "admin";
  }

  return null;
}

function readString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function readNumber(
  value: unknown,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function readBearerToken(
  event: HandlerEvent,
): string {
  const authorization =
    event.headers.authorization ??
    event.headers.Authorization;

  if (!authorization) {
    throw new Error(
      "AUTHORIZATION_REQUIRED",
    );
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  if (!match?.[1]) {
    throw new Error(
      "AUTHORIZATION_REQUIRED",
    );
  }

  return match[1].trim();
}

async function getAuthenticatedUser(
  event: HandlerEvent,
): Promise<AuthenticatedUser> {
  const token =
    readBearerToken(event);

  const decodedToken =
    await adminAuth.verifyIdToken(
      token,
    );

  const userDocument =
    await adminFirestore
      .collection("users")
      .doc(decodedToken.uid)
      .get();

  if (!userDocument.exists) {
    throw new Error(
      "ACTIVE_USER_REQUIRED",
    );
  }

  const userData =
    userDocument.data() ?? {};

  const role =
    normalizeRole(
      userData.role,
    );

  if (
    !role ||
    userData.status !== "active"
  ) {
    throw new Error(
      "ACTIVE_USER_REQUIRED",
    );
  }

  return {
    uid:
      decodedToken.uid,

    role,
  };
}

async function getActiveAdmins():
  Promise<Recipient[]> {
  const snapshot =
    await adminFirestore
      .collection("users")
      .where(
        "role",
        "in",
        [
          "admin",
          "administrator",
        ],
      )
      .get();

  return snapshot.docs
    .filter(
      (document) =>
        document.data().status ===
        "active",
    )
    .map((document) => ({
      uid: document.id,
      role: "admin" as const,
    }));
}

async function getActiveParent(
  parentUid: string,
): Promise<Recipient | null> {
  const cleanedParentUid =
    parentUid.trim();

  if (!cleanedParentUid) {
    return null;
  }

  const snapshot =
    await adminFirestore
      .collection("users")
      .doc(cleanedParentUid)
      .get();

  if (!snapshot.exists) {
    return null;
  }

  const data =
    snapshot.data() ?? {};

  if (
    data.role !== "parent" ||
    data.status !== "active"
  ) {
    return null;
  }

  return {
    uid: snapshot.id,
    role: "parent",
  };
}

async function getParentForLearner(
  learnerId: string,
): Promise<Recipient | null> {
  const cleanedLearnerId =
    learnerId.trim();

  if (!cleanedLearnerId) {
    return null;
  }

  const learnerDocument =
    await adminFirestore
      .collection("learners")
      .doc(cleanedLearnerId)
      .get();

  if (!learnerDocument.exists) {
    return null;
  }

  const learnerData =
    learnerDocument.data() ?? {};

  const primaryParentUid =
    readString(
      learnerData.primaryParentUid,
    );

  if (primaryParentUid) {
    const parent =
      await getActiveParent(
        primaryParentUid,
      );

    if (parent) {
      const linkDocument =
        await adminFirestore
          .collection(
            "parentLearnerLinks",
          )
          .doc(primaryParentUid)
          .collection("learners")
          .doc(cleanedLearnerId)
          .get();

      if (
        linkDocument.exists &&
        linkDocument.data()
          ?.status === "active"
      ) {
        return parent;
      }
    }
  }

  const linksSnapshot =
    await adminFirestore
      .collectionGroup("learners")
      .where(
        "learnerId",
        "==",
        cleanedLearnerId,
      )
      .where(
        "status",
        "==",
        "active",
      )
      .get();

  for (
    const linkDocument
    of linksSnapshot.docs
  ) {
    const parentDocument =
      linkDocument.ref.parent
        .parent;

    const parentLinksCollection =
      parentDocument?.parent;

    if (
      !parentDocument ||
      parentLinksCollection?.id !==
        "parentLearnerLinks"
    ) {
      continue;
    }

    const parent =
      await getActiveParent(
        parentDocument.id,
      );

    if (parent) {
      return parent;
    }
  }

  return null;
}

async function createNotification(
  recipient: Recipient,
  sourceType:
    NotificationSourceType,
  sourceId: string,
  content:
    NotificationContent,
): Promise<"created" | "existing"> {
  const notificationId =
    `${sourceType}_${sourceId}_${recipient.uid}`;

  const reference =
    adminFirestore
      .collection(
        "notifications",
      )
      .doc(notificationId);

  /*
   * Firestore remains the source of
   * truth for the notification inbox.
   *
   * The deterministic document ID
   * prevents retries from creating
   * duplicate inbox notifications.
   */
  const result =
    await adminFirestore.runTransaction(
      async (transaction) => {
        const existing =
          await transaction.get(
            reference,
          );

        if (existing.exists) {
          return "existing" as const;
        }

        transaction.set(
          reference,
          {
            recipientUid:
              recipient.uid,

            recipientRole:
              recipient.role,

            category:
              content.category,

            title:
              content.title,

            body:
              content.body,

            sourceType,

            sourceId,

            resourceId:
              sourceId,

            route:
              content.route,

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

        return "created" as const;
      },
    );

  /*
   * Push delivery happens only after
   * Firestore has successfully created
   * the inbox notification.
   *
   * An API retry that finds the
   * existing notification therefore
   * cannot send a duplicate push.
   */
  if (result === "created") {
    await sendExpoPushNotification({
      recipientUid:
        recipient.uid,

      title:
        content.title,

      body:
        content.body,

      category:
        content.category,

      route:
        content.route,

      sourceType,

      sourceId,

      resourceId:
        sourceId,
    });
  }

  return result;
}

async function createSubjectResultNotifications(
  actor: AuthenticatedUser,
  sourceId: string,
): Promise<{
  created: number;
  existing: number;
}> {
  if (actor.role !== "teacher") {
    throw new Error(
      "TEACHER_REQUIRED",
    );
  }

  const snapshot =
    await adminFirestore
      .collection(
        "subjectResults",
      )
      .doc(sourceId)
      .get();

  if (!snapshot.exists) {
    throw new Error(
      "SOURCE_NOT_FOUND",
    );
  }

  const data =
    snapshot.data() ?? {};

  if (
    readString(
      data.teacherUid,
    ) !== actor.uid
  ) {
    throw new Error(
      "SOURCE_ACCESS_DENIED",
    );
  }

  if (
    data.status !==
    "submitted"
  ) {
    return {
      created: 0,
      existing: 0,
    };
  }

  const learnerName =
    [
      readString(
        data.learnerFirstName,
      ),
      readString(
        data.learnerLastName,
      ),
    ]
      .filter(Boolean)
      .join(" ");

  const subject =
    readString(
      data.subject,
    );

  const admins =
    await getActiveAdmins();

  let created = 0;
  let existing = 0;

  for (
    const admin
    of admins
  ) {
    const result =
      await createNotification(
        admin,
        "subjectResult",
        sourceId,
        {
          category:
            "reports",

          title:
            "Result Submitted",

          body:
            `${learnerName || "A learner"}${subject ? ` — ${subject}` : ""} has a result ready for review.`,

          route:
            "/admin/results",
        },
      );

    if (
      result === "created"
    ) {
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

async function createTermReportNotifications(
  actor: AuthenticatedUser,
  sourceId: string,
): Promise<{
  created: number;
  existing: number;
}> {
  if (actor.role !== "admin") {
    throw new Error(
      "ADMIN_REQUIRED",
    );
  }

  const snapshot =
    await adminFirestore
      .collection(
        "termReports",
      )
      .doc(sourceId)
      .get();

  if (!snapshot.exists) {
    throw new Error(
      "SOURCE_NOT_FOUND",
    );
  }

  const data =
    snapshot.data() ?? {};

  if (
    data.status !==
    "approved"
  ) {
    return {
      created: 0,
      existing: 0,
    };
  }

  const learnerId =
    readString(
      data.learnerId,
    );

  const parent =
    await getParentForLearner(
      learnerId,
    );

  if (!parent) {
    return {
      created: 0,
      existing: 0,
    };
  }

  const learnerName =
    [
      readString(
        data.learnerFirstName,
      ),
      readString(
        data.learnerLastName,
      ),
    ]
      .filter(Boolean)
      .join(" ");

  const academicYear =
    readNumber(
      data.academicYear,
    );

  const term =
    readNumber(
      data.term,
    );

  const result =
    await createNotification(
      parent,
      "termReport",
      sourceId,
      {
        category:
          "reports",

        title:
          "Report Available",

        body:
          `${learnerName || "Your learner"}'s${term ? ` Term ${term}` : ""}${academicYear ? ` ${academicYear}` : ""} report is now available.`,

        route:
          "/parent/reports",
      },
    );

  return {
    created:
      result === "created"
        ? 1
        : 0,

    existing:
      result === "existing"
        ? 1
        : 0,
  };
}

async function createFeeStatementNotifications(
  actor: AuthenticatedUser,
  sourceId: string,
): Promise<{
  created: number;
  existing: number;
}> {
  if (actor.role !== "admin") {
    throw new Error(
      "ADMIN_REQUIRED",
    );
  }

  const snapshot =
    await adminFirestore
      .collection(
        "feeStatements",
      )
      .doc(sourceId)
      .get();

  if (!snapshot.exists) {
    throw new Error(
      "SOURCE_NOT_FOUND",
    );
  }

  const data =
    snapshot.data() ?? {};

  const parentUid =
    readString(
      data.parentUid,
    );

  const parent =
    parentUid
      ? await getActiveParent(
          parentUid,
        )
      : await getParentForLearner(
          readString(
            data.learnerId,
          ),
        );

  if (!parent) {
    return {
      created: 0,
      existing: 0,
    };
  }

  const learnerName =
    [
      readString(
        data.learnerFirstName,
      ),
      readString(
        data.learnerLastName,
      ),
    ]
      .filter(Boolean)
      .join(" ");

  const statementNumber =
    readString(
      data.statementNumber,
    );

  const result =
    await createNotification(
      parent,
      "feeStatement",
      sourceId,
      {
        category:
          "fees",

        title:
          "New Fee Statement",

        body:
          `${learnerName || "Your learner"} has a new fee statement${statementNumber ? ` (${statementNumber})` : ""}.`,

        route:
          "/parent/fees",
      },
    );

  return {
    created:
      result === "created"
        ? 1
        : 0,

    existing:
      result === "existing"
        ? 1
        : 0,
  };
}

export const handler:
  Handler =
  async (
    event,
  ) => {
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
      const actor =
        await getAuthenticatedUser(
          event,
        );

      let body:
        RequestBody = {};

      try {
        body =
          JSON.parse(
            event.body ?? "{}",
          ) as RequestBody;
      } catch {
        return jsonResponse(
          400,
          {
            success: false,
            error:
              "Invalid JSON body.",
          },
        );
      }

      const sourceId =
        readString(
          body.sourceId,
        );

      const sourceType =
        body.sourceType;

      if (
        !sourceId ||
        !sourceType
      ) {
        return jsonResponse(
          400,
          {
            success: false,
            error:
              "A source type and source identifier are required.",
          },
        );
      }

      let result: {
        created: number;
        existing: number;
      };

      switch (
        sourceType
      ) {
        case "subjectResult":
          result =
            await createSubjectResultNotifications(
              actor,
              sourceId,
            );
          break;

        case "termReport":
          result =
            await createTermReportNotifications(
              actor,
              sourceId,
            );
          break;

        case "feeStatement":
          result =
            await createFeeStatementNotifications(
              actor,
              sourceId,
            );
          break;

        default:
          return jsonResponse(
            400,
            {
              success: false,
              error:
                "Unsupported notification source.",
            },
          );
      }

      return jsonResponse(
        200,
        {
          success: true,
          ...result,
        },
      );
    } catch (error) {
      console.error(
        "Unable to create academic/finance notification:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message ===
          "AUTHORIZATION_REQUIRED" ||
        message ===
          "ACTIVE_USER_REQUIRED"
      ) {
        return jsonResponse(
          401,
          {
            success: false,
            error:
              "Authentication is required.",
          },
        );
      }

      if (
        message ===
          "TEACHER_REQUIRED" ||
        message ===
          "ADMIN_REQUIRED" ||
        message ===
          "SOURCE_ACCESS_DENIED"
      ) {
        return jsonResponse(
          403,
          {
            success: false,
            error:
              "You are not permitted to create this notification.",
          },
        );
      }

      if (
        message ===
        "SOURCE_NOT_FOUND"
      ) {
        return jsonResponse(
          404,
          {
            success: false,
            error:
              "The notification source could not be found.",
          },
        );
      }

      return jsonResponse(
        500,
        {
          success: false,
          error:
            "The notification could not be created.",
        },
      );
    }
  };