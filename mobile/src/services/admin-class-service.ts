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
  SchoolClass,
} from "@/types/school";

export type AdminSchoolClass =
  SchoolClass & {
    activeLearnerCount: number;
  };

export type SaveClassInput = {
  name: string;
  gradeNumber: number;
  academicYear: number;
};

export type UpdateClassInput =
  SaveClassInput & {
    classId: string;
  };

export type ClassActionResult = {
  message: string;
  classId?: string;
};

type ClassStatus =
  | "active"
  | "inactive";

type AdminClassRequest =
  | {
      action: "createClass";
      name: string;
      gradeNumber: number;
      academicYear: number;
    }
  | {
      action: "updateClass";
      classId: string;
      name: string;
      gradeNumber: number;
      academicYear: number;
    }
  | {
      action: "setClassStatus";
      classId: string;
      status: ClassStatus;
    };

type BackendResponse = {
  message?: string;
  classId?: string;
  error?: string;
};

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number"
    ? value
    : fallback;
}

function getAdminClassesEndpoint(): string {
  const configuredUrl =
    process.env
      .EXPO_PUBLIC_PAYFAST_BACKEND_URL
      ?.trim();

  if (!configuredUrl) {
    throw new Error(
      "EXPO_PUBLIC_PAYFAST_BACKEND_URL has not been configured.",
    );
  }

  const baseUrl =
    configuredUrl.replace(/\/+$/, "");

  if (
    baseUrl.endsWith(
      "/.netlify/functions",
    )
  ) {
    return `${baseUrl}/admin-classes`;
  }

  return `${baseUrl}/.netlify/functions/admin-classes`;
}

async function performAdminClassRequest(
  request: AdminClassRequest,
): Promise<ClassActionResult> {
  const currentUser =
    getAuth(firebaseApp).currentUser;

  if (!currentUser) {
    throw new Error(
      "You must be signed in as an administrator.",
    );
  }

  const idToken =
    await currentUser.getIdToken();

  const response = await fetch(
    getAdminClassesEndpoint(),
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${idToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  let responseData: BackendResponse = {};

  try {
    responseData =
      (await response.json()) as BackendResponse;
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    throw new Error(
      responseData.error ??
        responseData.message ??
        "The class operation could not be completed.",
    );
  }

  return {
    message:
      responseData.message ??
      "The class was updated successfully.",
    classId:
      responseData.classId,
  };
}

async function getActiveLearnerCount(
  classId: string,
): Promise<number> {
  const enrolmentsSnapshot =
    await getDocs(
      collection(
        firestore,
        "enrolments",
        classId,
        "learners",
      ),
    );

  return enrolmentsSnapshot.docs.filter(
    (enrolmentDocument) =>
      enrolmentDocument.data().status ===
      "active",
  ).length;
}

export async function getAllClassesForAdmin(): Promise<
  AdminSchoolClass[]
> {
  const classesSnapshot =
    await getDocs(
      collection(firestore, "classes"),
    );

  const classRequests =
    classesSnapshot.docs.map(
      async (classDocument) => {
        const data =
          classDocument.data();

        const activeLearnerCount =
          await getActiveLearnerCount(
            classDocument.id,
          );

        return {
          id: classDocument.id,
          name: readString(data.name),
          gradeNumber: readNumber(
            data.gradeNumber,
          ),
          academicYear: readNumber(
            data.academicYear,
          ),
          status: readString(
            data.status,
            "inactive",
          ),
          activeLearnerCount,
        } satisfies AdminSchoolClass;
      },
    );

  const classes =
    await Promise.all(classRequests);

  return classes.sort(
    (firstClass, secondClass) => {
      if (
        firstClass.academicYear !==
        secondClass.academicYear
      ) {
        return (
          secondClass.academicYear -
          firstClass.academicYear
        );
      }

      if (
        firstClass.gradeNumber !==
        secondClass.gradeNumber
      ) {
        return (
          firstClass.gradeNumber -
          secondClass.gradeNumber
        );
      }

      return firstClass.name.localeCompare(
        secondClass.name,
      );
    },
  );
}

export async function createSchoolClass(
  input: SaveClassInput,
): Promise<ClassActionResult> {
  return performAdminClassRequest({
    action: "createClass",
    name: input.name.trim(),
    gradeNumber:
      input.gradeNumber,
    academicYear:
      input.academicYear,
  });
}

export async function updateSchoolClass(
  input: UpdateClassInput,
): Promise<ClassActionResult> {
  return performAdminClassRequest({
    action: "updateClass",
    classId: input.classId.trim(),
    name: input.name.trim(),
    gradeNumber:
      input.gradeNumber,
    academicYear:
      input.academicYear,
  });
}

export async function setSchoolClassStatus(
  classId: string,
  status: ClassStatus,
): Promise<ClassActionResult> {
  return performAdminClassRequest({
    action: "setClassStatus",
    classId: classId.trim(),
    status,
  });
}