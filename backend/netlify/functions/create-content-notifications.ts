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

type ContentSourceType =
  | "announcement"
  | "schoolEvent";

type AuthenticatedRole =
  | "teacher"
  | "admin";

type AuthenticatedUser = {
  uid: string;
  role: AuthenticatedRole;
};

type NotificationRecipient = {
  uid: string;
  role: "parent";
};

type RequestBody = {
  sourceType?: string;
  sourceId?: string;
};

type NotificationContent = {
  title: string;
  body: string;
  category:
    | "announcements"
    | "calendar";
  route: string;
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",
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

function normalizeStaffRole(
  role: unknown,
): AuthenticatedRole | null {
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

function readSourceType(
  value: unknown,
): ContentSourceType {
  if (
    value === "announcement" ||
    value === "schoolEvent"
  ) {
    return value;
  }

  throw new Error(
    "The content source type is invalid.",
  );
}

async function requireActiveStaff(
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
    normalizeStaffRole(
      userData?.role,
    );

  if (
    !role ||
    userData?.status !== "active"
  ) {
    throw new Error(
      "Only active teachers or administrators may create content notifications.",
    );
  }

  return {
    uid:
      decodedToken.uid,

    role,
  };
}

async function getActiveParentUids():
  Promise<string[]> {
  const parentSnapshot =
    await adminFirestore
      .collection("users")
      .where(
        "role",
        "==",
        "parent",
      )
      .get();

  return parentSnapshot.docs
    .filter(
      (parentDocument) =>
        parentDocument.data()
          .status === "active",
    )
    .map(
      (parentDocument) =>
        parentDocument.id,
    );
}

async function getParentUidsForClass(
  classId: string,
): Promise<string[]> {
  const cleanedClassId =
    readRequiredString(
      classId,
      "Target class",
    );

  /*
   * A collection-group query gives
   * us every active document stored
   * beneath:
   *
   * parentLearnerLinks/{parentUid}/learners/{linkId}
   */
  const linksSnapshot =
    await adminFirestore
      .collectionGroup("learners")
      .where(
        "status",
        "==",
        "active",
      )
      .get();

  const learnerIds =
    new Set<string>();

  const parentUidByLearnerId =
    new Map<
      string,
      Set<string>
    >();

  for (
    const linkDocument
    of linksSnapshot.docs
  ) {
    /*
     * We only want learner link
     * documents beneath the
     * parentLearnerLinks collection.
     */
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

    const linkData =
      linkDocument.data();

    const learnerId =
      readOptionalString(
        linkData.learnerId,
      ) ||
      linkDocument.id;

    if (!learnerId) {
      continue;
    }

    learnerIds.add(
      learnerId,
    );

    const parentUid =
      parentDocument.id;

    const existingParents =
      parentUidByLearnerId.get(
        learnerId,
      ) ??
      new Set<string>();

    existingParents.add(
      parentUid,
    );

    parentUidByLearnerId.set(
      learnerId,
      existingParents,
    );
  }

  if (
    learnerIds.size === 0
  ) {
    return [];
  }

  /*
   * Firestore "in" queries have
   * limits, so reading each learner
   * directly is simpler and reliable
   * for the school's current scale.
   */
  const learnerResults =
    await Promise.all(
      [...learnerIds].map(
        async (learnerId) => {
          const snapshot =
            await adminFirestore
              .collection("learners")
              .doc(learnerId)
              .get();

          return {
            learnerId,
            snapshot,
          };
        },
      ),
    );

  const matchingParentUids =
    new Set<string>();

  for (
    const learnerResult
    of learnerResults
  ) {
    if (
      !learnerResult
        .snapshot
        .exists
    ) {
      continue;
    }

    const learnerData =
      learnerResult
        .snapshot
        .data();

    if (
      learnerData?.status !==
        "active" ||
      learnerData
        ?.currentClassId !==
        cleanedClassId
    ) {
      continue;
    }

    const parentUids =
      parentUidByLearnerId.get(
        learnerResult.learnerId,
      );

    parentUids?.forEach(
      (parentUid) => {
        matchingParentUids.add(
          parentUid,
        );
      },
    );
  }

  if (
    matchingParentUids.size === 0
  ) {
    return [];
  }

  /*
   * Only active parent accounts
   * should receive notifications.
   */
  const activeParentUids =
    new Set(
      await getActiveParentUids(),
    );

  return [
    ...matchingParentUids,
  ].filter(
    (parentUid) =>
      activeParentUids.has(
        parentUid,
      ),
  );
}

async function verifyTeacherClassAssignment(
  teacherUid: string,
  classId: string,
): Promise<void> {
  const assignmentsSnapshot =
    await adminFirestore
      .collection(
        "teacherAssignments",
      )
      .doc(teacherUid)
      .collection("classes")
      .where(
        "classId",
        "==",
        classId,
      )
      .where(
        "status",
        "==",
        "active",
      )
      .limit(1)
      .get();

  if (
    assignmentsSnapshot.empty
  ) {
    throw new Error(
      "Teachers may only notify classes assigned to them.",
    );
  }
}

function getContentNotification(
  sourceType:
    ContentSourceType,
  sourceData:
    FirebaseFirestore.DocumentData,
): NotificationContent {
  const title =
    readOptionalString(
      sourceData.title,
    );

  if (!title) {
    throw new Error(
      "The published content does not have a valid title.",
    );
  }

  if (
    sourceType ===
    "announcement"
  ) {
    const summary =
      readOptionalString(
        sourceData.summary,
      );

    return {
      title:
        sourceData.priority ===
          "urgent"
          ? `Urgent: ${title}`
          : title,

      body:
        summary ||
        "A new school announcement is available.",

      category:
        "announcements",

      route:
        "/parent/news",
    };
  }

  const location =
    readOptionalString(
      sourceData.location,
    );

  return {
    title:
      `New Calendar Event: ${title}`,

    body:
      location
        ? `Location: ${location}`
        : "A new school event has been added.",

    category:
      "calendar",

    route:
      "/parent/calendar",
  };
}

async function createNotification(
  notificationId: string,
  recipient:
    NotificationRecipient,
  content:
    NotificationContent,
  sourceType:
    ContentSourceType,
  sourceId: string,
): Promise<boolean> {
  const notificationReference =
    adminFirestore
      .collection(
        "notifications",
      )
      .doc(
        notificationId,
      );

  /*
   * Firestore is the source of truth
   * for the user's notification inbox.
   *
   * The deterministic notification ID
   * prevents a published announcement
   * or calendar event from producing
   * duplicate notifications.
   */
  const wasCreated =
    await adminFirestore
      .runTransaction(
        async (
          transaction,
        ) => {
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
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
          );

          return true;
        },
      );

  /*
   * Push is supplementary to the
   * Firestore inbox.
   *
   * It is deliberately sent only
   * after the transaction succeeds
   * and only when a new notification
   * was actually created.
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
        content.category,

      route:
        content.route,

      sourceType,

      sourceId,

      resourceId:
        sourceId,
    });
  }

  return wasCreated;
}

async function createContentNotifications(
  sourceType:
    ContentSourceType,
  sourceId: string,
  authenticatedUser:
    AuthenticatedUser,
): Promise<{
  created: number;
  existing: number;
}> {
  const collectionName =
    sourceType ===
      "announcement"
      ? "announcements"
      : "schoolEvents";

  const sourceSnapshot =
    await adminFirestore
      .collection(
        collectionName,
      )
      .doc(sourceId)
      .get();

  if (
    !sourceSnapshot.exists
  ) {
    throw new Error(
      sourceType ===
        "announcement"
        ? "The announcement could not be found."
        : "The school event could not be found.",
    );
  }

  const sourceData =
    sourceSnapshot.data();

  if (!sourceData) {
    throw new Error(
      "The published content is unavailable.",
    );
  }

  /*
   * The caller must be the person
   * who actually created the
   * Firestore document.
   */
  if (
    sourceData.authorUid !==
      authenticatedUser.uid
  ) {
    throw new Error(
      "You may only create notifications for content that you published.",
    );
  }

  const sourceAuthorRole =
    normalizeStaffRole(
      sourceData.authorRole,
    );

  if (
    !sourceAuthorRole ||
    sourceAuthorRole !==
      authenticatedUser.role
  ) {
    throw new Error(
      "The content author role does not match the signed-in account.",
    );
  }

  /*
   * Only live content should notify
   * parents.
   */
  if (
    sourceType ===
      "announcement"
  ) {
    if (
      sourceData.status !==
        "published"
    ) {
      throw new Error(
        "Only published announcements may create notifications.",
      );
    }
  } else if (
    sourceData.status !==
      "scheduled"
  ) {
    throw new Error(
      "Only scheduled school events may create notifications.",
    );
  }

  const audience =
    sourceData.audience ===
      "class"
      ? "class"
      : "allParents";

  /*
   * Teachers are deliberately
   * restricted to class-targeted
   * content, matching the mobile
   * validation rules.
   */
  if (
    authenticatedUser.role ===
      "teacher" &&
    audience !== "class"
  ) {
    throw new Error(
      "Teachers may only notify an assigned class.",
    );
  }

  let recipientUids:
    string[];

  if (
    audience ===
      "allParents"
  ) {
    recipientUids =
      await getActiveParentUids();
  } else {
    const targetClassId =
      readRequiredString(
        sourceData.targetClassId,
        "Target class",
      );

    if (
      authenticatedUser.role ===
        "teacher"
    ) {
      await verifyTeacherClassAssignment(
        authenticatedUser.uid,
        targetClassId,
      );
    }

    recipientUids =
      await getParentUidsForClass(
        targetClassId,
      );
  }

  /*
   * A Set prevents duplicate
   * notifications where one parent
   * has multiple children in the
   * same class.
   */
  const uniqueRecipientUids =
    [...new Set(
      recipientUids,
    )];

  const content =
    getContentNotification(
      sourceType,
      sourceData,
    );

  let created = 0;
  let existing = 0;

  for (
    const recipientUid
    of uniqueRecipientUids
  ) {
    const notificationId =
      `${sourceType}_${sourceId}_published_${recipientUid}`;

    const wasCreated =
      await createNotification(
        notificationId,
        {
          uid:
            recipientUid,

          role:
            "parent",
        },
        content,
        sourceType,
        sourceId,
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

  return "The content notification could not be created.";
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
        await requireActiveStaff(
          event,
        );

      const body =
        parseRequestBody(
          event,
        );

      const sourceType =
        readSourceType(
          body.sourceType,
        );

      const sourceId =
        readRequiredString(
          body.sourceId,
          "Content identifier",
        );

      const result =
        await createContentNotifications(
          sourceType,
          sourceId,
          authenticatedUser,
        );

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
        "Unable to create content notification:",
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
          "only create notifications",
        ) ||
        message.includes(
          "author role",
        ) ||
        message.includes(
          "Teachers may only",
        ) ||
        message.includes(
          "assigned to them",
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