import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

type LinkAction =
  | "linkParentLearner"
  | "unlinkParentLearner"
  | "assignTeacherClass"
  | "unassignTeacherClass";

type RequestBody = {
  action?: LinkAction;
  userUid?: string;
  learnerId?: string;
  classId?: string;
  relationship?: string;
  subject?: string;
};

type AdministratorIdentity = {
  uid: string;
  email: string;
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

function readOptionalString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validateShortText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): string {
  const cleanedValue =
    readRequiredString(value, label);

  if (
    cleanedValue.length < minimum ||
    cleanedValue.length > maximum
  ) {
    throw new Error(
      `${label} must contain between ${minimum} and ${maximum} characters.`,
    );
  }

  return cleanedValue;
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
): Promise<AdministratorIdentity> {
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
    administratorData.status !== "active"
  ) {
    throw new Error(
      "Only active administrators may manage account links.",
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
    return JSON.parse(
      event.body,
    ) as RequestBody;
  } catch {
    throw new Error(
      "The request body is not valid JSON.",
    );
  }
}

async function requireUserRole(
  uid: string,
  expectedRole: "parent" | "teacher",
): Promise<void> {
  const userSnapshot = await adminFirestore
    .collection("users")
    .doc(uid)
    .get();

  if (!userSnapshot.exists) {
    throw new Error(
      "The selected user account could not be found.",
    );
  }

  const userData = userSnapshot.data();

  if (userData?.role !== expectedRole) {
    throw new Error(
      expectedRole === "parent"
        ? "Only parent accounts can be linked to learners."
        : "Only teacher accounts can be assigned to classes.",
    );
  }

  if (userData.status !== "active") {
    throw new Error(
      "The selected user account must be active.",
    );
  }
}

async function requireActiveLearner(
  learnerId: string,
): Promise<void> {
  const learnerSnapshot =
    await adminFirestore
      .collection("learners")
      .doc(learnerId)
      .get();

  if (!learnerSnapshot.exists) {
    throw new Error(
      "The selected learner could not be found.",
    );
  }

  if (
    learnerSnapshot.data()?.status !==
    "active"
  ) {
    throw new Error(
      "The selected learner is not active.",
    );
  }
}

async function requireActiveClass(
  classId: string,
): Promise<void> {
  const classSnapshot =
    await adminFirestore
      .collection("classes")
      .doc(classId)
      .get();

  if (!classSnapshot.exists) {
    throw new Error(
      "The selected class could not be found.",
    );
  }

  if (
    classSnapshot.data()?.status !== "active"
  ) {
    throw new Error(
      "The selected class is not active.",
    );
  }
}

async function findReplacementPrimaryParentUid(
  learnerId: string,
  excludedParentUid: string,
): Promise<string> {
  const parentLinksSnapshot =
    await adminFirestore
      .collection("parentLearnerLinks")
      .get();

  const possibleParents =
    await Promise.all(
      parentLinksSnapshot.docs
        .filter(
          (parentDocument) =>
            parentDocument.id !==
            excludedParentUid,
        )
        .map(async (parentDocument) => {
          const parentUid =
            parentDocument.id;

          const learnerLinkSnapshot =
            await parentDocument.ref
              .collection("learners")
              .doc(learnerId)
              .get();

          if (
            !learnerLinkSnapshot.exists ||
            learnerLinkSnapshot.data()
              ?.status !== "active"
          ) {
            return null;
          }

          const parentUserSnapshot =
            await adminFirestore
              .collection("users")
              .doc(parentUid)
              .get();

          if (!parentUserSnapshot.exists) {
            return null;
          }

          const parentUserData =
            parentUserSnapshot.data();

          if (
            parentUserData?.role !==
              "parent" ||
            parentUserData.status !==
              "active"
          ) {
            return null;
          }

          return parentUid;
        }),
    );

  return (
    possibleParents.find(
      (parentUid): parentUid is string =>
        typeof parentUid === "string" &&
        parentUid.length > 0,
    ) ?? ""
  );
}

async function linkParentLearner(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const parentUid = readRequiredString(
    body.userUid,
    "Parent identifier",
  );

  const learnerId = readRequiredString(
    body.learnerId,
    "Learner identifier",
  );

  const relationship = validateShortText(
    body.relationship ?? "Parent",
    "Relationship",
    2,
    50,
  );

  await Promise.all([
    requireUserRole(parentUid, "parent"),
    requireActiveLearner(learnerId),
  ]);

  const parentReference =
    adminFirestore
      .collection("parentLearnerLinks")
      .doc(parentUid);

  const learnerLinkReference =
    parentReference
      .collection("learners")
      .doc(learnerId);

  const learnerReference =
    adminFirestore
      .collection("learners")
      .doc(learnerId);

  const learnerSnapshot =
    await learnerReference.get();

  if (!learnerSnapshot.exists) {
    throw new Error(
      "The selected learner could not be found.",
    );
  }

  const currentPrimaryParentUid =
    readOptionalString(
      learnerSnapshot.data()
        ?.primaryParentUid,
    );

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch = adminFirestore.batch();

  batch.set(
    parentReference,
    {
      parentUid,
      status: "active",
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(
    learnerLinkReference,
    {
      learnerId,
      relationship,
      status: "active",
      linkedBy: administrator.uid,
      linkedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  if (!currentPrimaryParentUid) {
    batch.set(
      learnerReference,
      {
        primaryParentUid: parentUid,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  batch.set(auditReference, {
    action: "linkParentLearner",
    targetUid: parentUid,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      learnerId,
      relationship,
      primaryParentAssigned:
        !currentPrimaryParentUid,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message: currentPrimaryParentUid
      ? "The learner was linked to the parent account."
      : "The learner was linked and the parent was assigned as the primary account holder.",
  };
}

async function unlinkParentLearner(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const parentUid = readRequiredString(
    body.userUid,
    "Parent identifier",
  );

  const learnerId = readRequiredString(
    body.learnerId,
    "Learner identifier",
  );

  await requireUserRole(
    parentUid,
    "parent",
  );

  const learnerLinkReference =
    adminFirestore
      .collection("parentLearnerLinks")
      .doc(parentUid)
      .collection("learners")
      .doc(learnerId);

  const learnerReference =
    adminFirestore
      .collection("learners")
      .doc(learnerId);

  const [
    linkSnapshot,
    learnerSnapshot,
  ] = await Promise.all([
    learnerLinkReference.get(),
    learnerReference.get(),
  ]);

  if (!linkSnapshot.exists) {
    throw new Error(
      "The learner link could not be found.",
    );
  }

  if (!learnerSnapshot.exists) {
    throw new Error(
      "The selected learner could not be found.",
    );
  }

  const currentPrimaryParentUid =
    readOptionalString(
      learnerSnapshot.data()
        ?.primaryParentUid,
    );

  const shouldReplacePrimaryParent =
    !currentPrimaryParentUid ||
    currentPrimaryParentUid ===
      parentUid;

  const replacementParentUid =
    shouldReplacePrimaryParent
      ? await findReplacementPrimaryParentUid(
          learnerId,
          parentUid,
        )
      : "";

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch = adminFirestore.batch();

  batch.set(
    learnerLinkReference,
    {
      status: "inactive",
      unlinkedBy: administrator.uid,
      unlinkedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  if (shouldReplacePrimaryParent) {
    batch.set(
      learnerReference,
      {
        primaryParentUid:
          replacementParentUid ||
          FieldValue.delete(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  batch.set(auditReference, {
    action: "unlinkParentLearner",
    targetUid: parentUid,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      learnerId,
      wasPrimaryParent:
        currentPrimaryParentUid ===
        parentUid,
      replacementParentUid:
        replacementParentUid || null,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message: replacementParentUid
      ? "The learner was removed and another linked parent was assigned as the primary account holder."
      : "The learner was removed from the parent account.",
  };
}

async function assignTeacherClass(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const teacherUid = readRequiredString(
    body.userUid,
    "Teacher identifier",
  );

  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

  const subject = validateShortText(
    body.subject,
    "Subject",
    2,
    100,
  );

  await Promise.all([
    requireUserRole(teacherUid, "teacher"),
    requireActiveClass(classId),
  ]);

  const teacherReference =
    adminFirestore
      .collection("teacherAssignments")
      .doc(teacherUid);

  const classAssignmentReference =
    teacherReference
      .collection("classes")
      .doc(classId);

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch = adminFirestore.batch();

  batch.set(
    teacherReference,
    {
      teacherUid,
      status: "active",
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(
    classAssignmentReference,
    {
      classId,
      subject,
      status: "active",
      assignedBy: administrator.uid,
      assignedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(auditReference, {
    action: "assignTeacherClass",
    targetUid: teacherUid,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      classId,
      subject,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message:
      "The class and subject were assigned to the teacher.",
  };
}

async function unassignTeacherClass(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const teacherUid = readRequiredString(
    body.userUid,
    "Teacher identifier",
  );

  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

  await requireUserRole(
    teacherUid,
    "teacher",
  );

  const assignmentReference =
    adminFirestore
      .collection("teacherAssignments")
      .doc(teacherUid)
      .collection("classes")
      .doc(classId);

  const assignmentSnapshot =
    await assignmentReference.get();

  if (!assignmentSnapshot.exists) {
    throw new Error(
      "The teacher class assignment could not be found.",
    );
  }

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch = adminFirestore.batch();

  batch.set(
    assignmentReference,
    {
      status: "inactive",
      unassignedBy: administrator.uid,
      unassignedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  batch.set(auditReference, {
    action: "unassignTeacherClass",
    targetUid: teacherUid,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      classId,
      subject:
        assignmentSnapshot.data()
          ?.subject ?? "",
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message:
      "The class assignment was removed from the teacher.",
  };
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The account link could not be updated.";
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
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const administrator =
      await requireAdministrator(event);

    const body = parseRequestBody(event);

    if (!body.action) {
      return jsonResponse(400, {
        success: false,
        error:
          "An account-link action is required.",
      });
    }

    let result:
      | Record<string, unknown>
      | undefined;

    switch (body.action) {
      case "linkParentLearner":
        result = await linkParentLearner(
          body,
          administrator,
        );
        break;

      case "unlinkParentLearner":
        result = await unlinkParentLearner(
          body,
          administrator,
        );
        break;

      case "assignTeacherClass":
        result = await assignTeacherClass(
          body,
          administrator,
        );
        break;

      case "unassignTeacherClass":
        result = await unassignTeacherClass(
          body,
          administrator,
        );
        break;

      default:
        return jsonResponse(400, {
          success: false,
          error:
            "The requested account-link action is invalid.",
        });
    }

    return jsonResponse(200, {
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Unable to update account link:",
      error,
    );

    const message =
      getErrorMessage(error);

    const isAuthenticationError =
      message.includes("signed in") ||
      message.includes(
        "authentication token",
      );

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