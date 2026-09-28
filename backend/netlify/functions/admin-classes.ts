import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

type ClassAction =
  | "createClass"
  | "updateClass"
  | "setClassStatus";

type ClassStatus =
  | "active"
  | "inactive";

type RequestBody = {
  action?: ClassAction;
  classId?: string;
  name?: string;
  gradeNumber?: number;
  academicYear?: number;
  status?: ClassStatus;
};

type AdministratorIdentity = {
  uid: string;
  email: string;
};

type ValidatedClassInput = {
  name: string;
  gradeNumber: number;
  academicYear: number;
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

function readRequiredNumber(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `${label} must be a valid number.`,
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
    administratorData.status !== "active"
  ) {
    throw new Error(
      "Only active administrators may manage classes.",
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

function validateClassInput(
  body: RequestBody,
): ValidatedClassInput {
  const name = readRequiredString(
    body.name,
    "Class name",
  );

  if (
    name.length < 2 ||
    name.length > 80
  ) {
    throw new Error(
      "Class name must contain between 2 and 80 characters.",
    );
  }

  const gradeNumber = readRequiredNumber(
    body.gradeNumber,
    "Grade number",
  );

  if (
    !Number.isInteger(gradeNumber) ||
    gradeNumber < 0 ||
    gradeNumber > 12
  ) {
    throw new Error(
      "Grade number must be a whole number between 0 and 12.",
    );
  }

  const academicYear = readRequiredNumber(
    body.academicYear,
    "Academic year",
  );

  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2020 ||
    academicYear > 2100
  ) {
    throw new Error(
      "Academic year must be between 2020 and 2100.",
    );
  }

  return {
    name,
    gradeNumber,
    academicYear,
  };
}

async function ensureUniqueClass(
  input: ValidatedClassInput,
  excludedClassId = "",
): Promise<void> {
  const classesSnapshot =
    await adminFirestore
      .collection("classes")
      .get();

  const normalizedName =
    input.name.toLowerCase();

  const duplicateClass =
    classesSnapshot.docs.find(
      (classDocument) => {
        if (
          classDocument.id ===
          excludedClassId
        ) {
          return false;
        }

        const data =
          classDocument.data();

        const existingName =
          typeof data.name === "string"
            ? data.name.trim().toLowerCase()
            : "";

        return (
          existingName === normalizedName &&
          data.academicYear ===
            input.academicYear
        );
      },
    );

  if (duplicateClass) {
    throw new Error(
      "A class with this name already exists for the selected academic year.",
    );
  }
}

async function getActiveEnrolmentIds(
  classId: string,
): Promise<string[]> {
  const enrolmentsSnapshot =
    await adminFirestore
      .collection("enrolments")
      .doc(classId)
      .collection("learners")
      .get();

  return enrolmentsSnapshot.docs
    .filter(
      (enrolmentDocument) =>
        enrolmentDocument.data().status ===
        "active",
    )
    .map((enrolmentDocument) => {
      const data =
        enrolmentDocument.data();

      return typeof data.learnerId ===
        "string" &&
        data.learnerId.trim()
        ? data.learnerId.trim()
        : enrolmentDocument.id;
    });
}

async function createClass(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const input = validateClassInput(body);

  await ensureUniqueClass(input);

  const classReference =
    adminFirestore
      .collection("classes")
      .doc();

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch =
    adminFirestore.batch();

  batch.set(classReference, {
    name: input.name,
    gradeNumber: input.gradeNumber,
    academicYear:
      input.academicYear,
    status: "active",
    createdBy: administrator.uid,
    createdAt:
      FieldValue.serverTimestamp(),
    updatedBy: administrator.uid,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  batch.set(auditReference, {
    action: "createClass",
    targetId: classReference.id,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      name: input.name,
      gradeNumber:
        input.gradeNumber,
      academicYear:
        input.academicYear,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message:
      "The class was created successfully.",
    classId: classReference.id,
  };
}

async function updateClass(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

  const input = validateClassInput(body);

  const classReference =
    adminFirestore
      .collection("classes")
      .doc(classId);

  const classSnapshot =
    await classReference.get();

  if (!classSnapshot.exists) {
    throw new Error(
      "The selected class could not be found.",
    );
  }

  await ensureUniqueClass(
    input,
    classId,
  );

  const currentClassData =
    classSnapshot.data();

  const previousGradeNumber =
    typeof currentClassData
      ?.gradeNumber === "number"
      ? currentClassData.gradeNumber
      : 0;

  const gradeChanged =
    previousGradeNumber !==
    input.gradeNumber;

  const activeLearnerIds =
    gradeChanged
      ? await getActiveEnrolmentIds(
          classId,
        )
      : [];

  if (activeLearnerIds.length > 450) {
    throw new Error(
      "This class contains too many learners to update in one operation.",
    );
  }

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch =
    adminFirestore.batch();

  batch.update(classReference, {
    name: input.name,
    gradeNumber: input.gradeNumber,
    academicYear:
      input.academicYear,
    updatedBy: administrator.uid,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  activeLearnerIds.forEach(
    (learnerId) => {
      const learnerReference =
        adminFirestore
          .collection("learners")
          .doc(learnerId);

      batch.set(
        learnerReference,
        {
          currentGradeNumber:
            input.gradeNumber,
          updatedBy:
            administrator.uid,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    },
  );

  batch.set(auditReference, {
    action: "updateClass",
    targetId: classId,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      previousName:
        currentClassData?.name ?? "",
      updatedName: input.name,
      previousGradeNumber,
      updatedGradeNumber:
        input.gradeNumber,
      previousAcademicYear:
        currentClassData
          ?.academicYear ?? 0,
      updatedAcademicYear:
        input.academicYear,
      learnerGradesUpdated:
        activeLearnerIds.length,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message:
      "The class was updated successfully.",
    classId,
  };
}

async function setClassStatus(
  body: RequestBody,
  administrator: AdministratorIdentity,
) {
  const classId = readRequiredString(
    body.classId,
    "Class identifier",
  );

  const status = body.status;

  if (
    status !== "active" &&
    status !== "inactive"
  ) {
    throw new Error(
      "Select a valid class status.",
    );
  }

  const classReference =
    adminFirestore
      .collection("classes")
      .doc(classId);

  const classSnapshot =
    await classReference.get();

  if (!classSnapshot.exists) {
    throw new Error(
      "The selected class could not be found.",
    );
  }

  if (status === "inactive") {
    const activeLearnerIds =
      await getActiveEnrolmentIds(
        classId,
      );

    if (activeLearnerIds.length > 0) {
      throw new Error(
        `This class cannot be deactivated while ${activeLearnerIds.length} active learner${
          activeLearnerIds.length === 1
            ? " is"
            : "s are"
        } still enrolled.`,
      );
    }
  }

  const auditReference =
    adminFirestore
      .collection("adminAuditLogs")
      .doc();

  const batch =
    adminFirestore.batch();

  batch.update(classReference, {
    status,
    updatedBy: administrator.uid,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  batch.set(auditReference, {
    action: "setClassStatus",
    targetId: classId,
    administratorUid:
      administrator.uid,
    administratorEmail:
      administrator.email,
    details: {
      previousStatus:
        classSnapshot.data()?.status ??
        "",
      updatedStatus: status,
    },
    createdAt:
      FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    message:
      status === "active"
        ? "The class was activated successfully."
        : "The class was deactivated successfully.",
    classId,
  };
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The class operation could not be completed.";
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

    const body =
      parseRequestBody(event);

    if (!body.action) {
      return jsonResponse(400, {
        success: false,
        error:
          "A class-management action is required.",
      });
    }

    let result:
      | Record<string, unknown>
      | undefined;

    switch (body.action) {
      case "createClass":
        result = await createClass(
          body,
          administrator,
        );
        break;

      case "updateClass":
        result = await updateClass(
          body,
          administrator,
        );
        break;

      case "setClassStatus":
        result = await setClassStatus(
          body,
          administrator,
        );
        break;

      default:
        return jsonResponse(400, {
          success: false,
          error:
            "The requested class-management action is invalid.",
        });
    }

    return jsonResponse(200, {
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Unable to manage class:",
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