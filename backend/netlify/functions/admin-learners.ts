import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

type LearnerAction =
  | "createLearner"
  | "updateLearner"
  | "setLearnerStatus";

type LearnerStatus =
  | "active"
  | "inactive";

type RequestBody = {
  action?: LearnerAction;
  learnerId?: string;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  classId?: string;
  status?: LearnerStatus;
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

function validateStudentNumber(
  value: unknown,
): string {
  const studentNumber =
    readRequiredString(
      value,
      "Student number",
    ).toUpperCase();

  if (
    studentNumber.length < 3 ||
    studentNumber.length > 40
  ) {
    throw new Error(
      "The student number must contain between 3 and 40 characters.",
    );
  }

  if (
    !/^[A-Z0-9/_-]+$/.test(
      studentNumber,
    )
  ) {
    throw new Error(
      "The student number may only contain letters, numbers, hyphens, underscores or forward slashes.",
    );
  }

  return studentNumber;
}

function validateStatus(
  value: unknown,
): LearnerStatus {
  if (
    value !== "active" &&
    value !== "inactive"
  ) {
    throw new Error(
      "Select a valid learner status.",
    );
  }

  return value;
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
    administratorData?.status !== "active"
  ) {
    throw new Error(
      "Only active administrators may manage learners.",
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

async function getActiveClass(
  classId: string,
) {
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

  const classData = classSnapshot.data();

  if (classData?.status !== "active") {
    throw new Error(
      "The selected class is not active.",
    );
  }

  const gradeNumber =
    typeof classData.gradeNumber ===
    "number"
      ? classData.gradeNumber
      : 0;

  return {
    id: classSnapshot.id,
    name:
      typeof classData.name === "string"
        ? classData.name
        : "",
    gradeNumber,
    academicYear:
      typeof classData.academicYear ===
      "number"
        ? classData.academicYear
        : 0,
  };
}

async function ensureUniqueStudentNumber(
  studentNumber: string,
  ignoredLearnerId?: string,
): Promise<void> {
  const matchingSnapshot =
    await adminFirestore
      .collection("learners")
      .where(
        "studentNumber",
        "==",
        studentNumber,
      )
      .limit(2)
      .get();

  const conflictingDocument =
    matchingSnapshot.docs.find(
      (document) =>
        document.id !== ignoredLearnerId,
    );

  if (conflictingDocument) {
    throw new Error(
      "A learner already exists with this student number.",
    );
  }
}

function addAuditRecord(
  batch: FirebaseFirestore.WriteBatch,
  administrator: AdministratorIdentity,
  action: LearnerAction,
  learnerId: string,
  details: Record<string, unknown>,
) {
  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  batch.set(auditReference, {
    action,
    targetUid: learnerId,
    administratorUid: administrator.uid,
    administratorEmail:
      administrator.email,
    details,
    createdAt:
      FieldValue.serverTimestamp(),
  });
}

async function createLearner(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const firstName = validateName(
    body.firstName,
    "First name",
  );

  const lastName = validateName(
    body.lastName,
    "Last name",
  );

  const studentNumber =
    validateStudentNumber(
      body.studentNumber,
    );

  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

  const [
    schoolClass,
  ] = await Promise.all([
    getActiveClass(classId),
    ensureUniqueStudentNumber(
      studentNumber,
    ),
  ]);

  const learnerReference =
    adminFirestore
      .collection("learners")
      .doc();

  const enrolmentReference =
    adminFirestore
      .collection("enrolments")
      .doc(classId);

  const enrolledLearnerReference =
    enrolmentReference
      .collection("learners")
      .doc(learnerReference.id);

  const batch = adminFirestore.batch();

  batch.set(learnerReference, {
    firstName,
    lastName,
    studentNumber,
    status: "active",
    currentClassId: classId,
    currentGradeNumber:
      schoolClass.gradeNumber,
    createdBy: administrator.uid,
    updatedBy: administrator.uid,
    createdAt:
      FieldValue.serverTimestamp(),
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  batch.set(
    enrolmentReference,
    {
      classId,
      className: schoolClass.name,
      academicYear:
        schoolClass.academicYear,
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
    enrolledLearnerReference,
    {
      learnerId: learnerReference.id,
      status: "active",
      enrolledBy: administrator.uid,
      enrolledAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  addAuditRecord(
    batch,
    administrator,
    "createLearner",
    learnerReference.id,
    {
      firstName,
      lastName,
      studentNumber,
      classId,
      className: schoolClass.name,
    },
  );

  await batch.commit();

  return {
    message:
      "The learner was created and enrolled successfully.",
    learner: {
      id: learnerReference.id,
      firstName,
      lastName,
      studentNumber,
      status: "active",
      currentClassId: classId,
      currentGradeNumber:
        schoolClass.gradeNumber,
      className: schoolClass.name,
    },
  };
}

async function updateLearner(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const learnerId = readRequiredString(
    body.learnerId,
    "Learner identifier",
  );

  const firstName = validateName(
    body.firstName,
    "First name",
  );

  const lastName = validateName(
    body.lastName,
    "Last name",
  );

  const studentNumber =
    validateStudentNumber(
      body.studentNumber,
    );

  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

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

  const existingLearner =
    learnerSnapshot.data();

  const previousClassId =
    typeof existingLearner
      ?.currentClassId === "string"
      ? existingLearner.currentClassId
      : "";

  const [
    schoolClass,
  ] = await Promise.all([
    getActiveClass(classId),
    ensureUniqueStudentNumber(
      studentNumber,
      learnerId,
    ),
  ]);

  const batch = adminFirestore.batch();

  batch.set(
    learnerReference,
    {
      firstName,
      lastName,
      studentNumber,
      currentClassId: classId,
      currentGradeNumber:
        schoolClass.gradeNumber,
      updatedBy: administrator.uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  if (
    previousClassId &&
    previousClassId !== classId
  ) {
    const previousEnrolmentReference =
      adminFirestore
        .collection("enrolments")
        .doc(previousClassId)
        .collection("learners")
        .doc(learnerId);

    batch.set(
      previousEnrolmentReference,
      {
        status: "inactive",
        transferredBy:
          administrator.uid,
        transferredAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  const enrolmentReference =
    adminFirestore
      .collection("enrolments")
      .doc(classId);

  const currentEnrolmentReference =
    enrolmentReference
      .collection("learners")
      .doc(learnerId);

  batch.set(
    enrolmentReference,
    {
      classId,
      className: schoolClass.name,
      academicYear:
        schoolClass.academicYear,
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
    currentEnrolmentReference,
    {
      learnerId,
      status:
        existingLearner?.status ===
        "inactive"
          ? "inactive"
          : "active",
      enrolledBy: administrator.uid,
      enrolledAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  addAuditRecord(
    batch,
    administrator,
    "updateLearner",
    learnerId,
    {
      firstName,
      lastName,
      studentNumber,
      previousClassId,
      classId,
      className: schoolClass.name,
    },
  );

  await batch.commit();

  return {
    message:
      previousClassId !== classId
        ? "The learner was updated and transferred successfully."
        : "The learner details were updated successfully.",
  };
}

async function setLearnerStatus(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const learnerId = readRequiredString(
    body.learnerId,
    "Learner identifier",
  );

  const status = validateStatus(
    body.status,
  );

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

  const learnerData =
    learnerSnapshot.data();

  const currentClassId =
    typeof learnerData?.currentClassId ===
    "string"
      ? learnerData.currentClassId
      : "";

  const batch = adminFirestore.batch();

  batch.set(
    learnerReference,
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

  if (currentClassId) {
    const enrolmentReference =
      adminFirestore
        .collection("enrolments")
        .doc(currentClassId)
        .collection("learners")
        .doc(learnerId);

    batch.set(
      enrolmentReference,
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
  }

  addAuditRecord(
    batch,
    administrator,
    "setLearnerStatus",
    learnerId,
    {
      previousStatus:
        learnerData?.status ?? null,
      status,
      currentClassId,
    },
  );

  await batch.commit();

  return {
    message:
      status === "active"
        ? "The learner was activated successfully."
        : "The learner was deactivated successfully.",
  };
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The learner-management request could not be completed.";
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
          "A learner-management action is required.",
      });
    }

    let result:
      | Record<string, unknown>
      | undefined;

    switch (body.action) {
      case "createLearner":
        result = await createLearner(
          body,
          administrator,
        );
        break;

      case "updateLearner":
        result = await updateLearner(
          body,
          administrator,
        );
        break;

      case "setLearnerStatus":
        result =
          await setLearnerStatus(
            body,
            administrator,
          );
        break;

      default:
        return jsonResponse(400, {
          success: false,
          error:
            "The requested learner-management action is invalid.",
        });
    }

    return jsonResponse(200, {
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Unable to complete learner action:",
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