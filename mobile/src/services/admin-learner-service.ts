import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  firebaseApp,
  firestore,
} from "@/lib/firebase";
import type {
  Learner,
  SchoolClass,
} from "@/types/school";

export type CreateLearnerInput = {
  firstName: string;
  lastName: string;
  studentNumber: string;
  classId: string;
};

export type UpdateLearnerInput = CreateLearnerInput & {
  learnerId: string;
};

export type LearnerActionResult = {
  message: string;
  learnerId?: string;
};

type LearnerStatusAction = "active" | "inactive";

type AdminLearnerRequest =
  | {
      action: "createLearner";
      firstName: string;
      lastName: string;
      studentNumber: string;
      classId: string;
    }
  | {
      action: "updateLearner";
      learnerId: string;
      firstName: string;
      lastName: string;
      studentNumber: string;
      classId: string;
    }
  | {
      action: "setLearnerStatus";
      learnerId: string;
      status: LearnerStatusAction;
    };

type BackendResponse = {
  message?: string;
  learnerId?: string;
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

function mapSchoolClass(
  classDocument: QueryDocumentSnapshot<DocumentData>,
): SchoolClass {
  const data = classDocument.data();

  return {
    id: classDocument.id,
    name: readString(data.name),
    gradeNumber: readNumber(data.gradeNumber),
    academicYear: readNumber(data.academicYear),
    status: readString(data.status),
  };
}

function getAdminLearnersEndpoint(): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_PAYFAST_BACKEND_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "EXPO_PUBLIC_PAYFAST_BACKEND_URL has not been configured.",
    );
  }

  const baseUrl = configuredUrl.replace(/\/+$/, "");

  if (baseUrl.endsWith("/.netlify/functions")) {
    return `${baseUrl}/admin-learners`;
  }

  return `${baseUrl}/.netlify/functions/admin-learners`;
}

async function performAdminLearnerRequest(
  request: AdminLearnerRequest,
): Promise<LearnerActionResult> {
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
    getAdminLearnersEndpoint(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
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
        "The learner operation could not be completed.",
    );
  }

  return {
    message:
      responseData.message ??
      "The learner was updated successfully.",
    learnerId: responseData.learnerId,
  };
}

export async function getActiveClassesForLearners(): Promise<
  SchoolClass[]
> {
  const classesSnapshot = await getDocs(
    collection(firestore, "classes"),
  );

  return classesSnapshot.docs
    .map(mapSchoolClass)
    .filter(
      (schoolClass) =>
        schoolClass.status === "active",
    )
    .sort((firstClass, secondClass) =>
      firstClass.name.localeCompare(
        secondClass.name,
      ),
    );
}

export async function getAllLearnersForAdmin(): Promise<
  Learner[]
> {
  const [
    learnersSnapshot,
    classesSnapshot,
  ] = await Promise.all([
    getDocs(
      collection(firestore, "learners"),
    ),
    getDocs(
      collection(firestore, "classes"),
    ),
  ]);

  const classesById = new Map<
    string,
    SchoolClass
  >();

  classesSnapshot.docs.forEach(
    (classDocument) => {
      const schoolClass =
        mapSchoolClass(classDocument);

      classesById.set(
        schoolClass.id,
        schoolClass,
      );
    },
  );

  return learnersSnapshot.docs
    .map((learnerDocument) => {
      const data = learnerDocument.data();
      const currentClassId = readString(
        data.currentClassId,
      );

      return {
        id: learnerDocument.id,
        firstName: readString(
          data.firstName,
        ),
        lastName: readString(
          data.lastName,
        ),
        studentNumber: readString(
          data.studentNumber,
        ),
        status: readString(
          data.status,
          "inactive",
        ),
        currentClassId,
        currentGradeNumber: readNumber(
          data.currentGradeNumber,
          classesById.get(currentClassId)
            ?.gradeNumber ?? 0,
        ),
        schoolClass:
          classesById.get(currentClassId) ??
          null,
        relationship: "",
      } satisfies Learner;
    })
    .sort((firstLearner, secondLearner) => {
      const firstName =
        `${firstLearner.firstName} ${firstLearner.lastName}`.trim();

      const secondName =
        `${secondLearner.firstName} ${secondLearner.lastName}`.trim();

      return firstName.localeCompare(
        secondName,
      );
    });
}

export async function createLearner(
  input: CreateLearnerInput,
): Promise<LearnerActionResult> {
  return performAdminLearnerRequest({
    action: "createLearner",
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    studentNumber:
      input.studentNumber.trim(),
    classId: input.classId.trim(),
  });
}

export async function updateLearner(
  input: UpdateLearnerInput,
): Promise<LearnerActionResult> {
  return performAdminLearnerRequest({
    action: "updateLearner",
    learnerId: input.learnerId.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    studentNumber:
      input.studentNumber.trim(),
    classId: input.classId.trim(),
  });
}

export async function setLearnerStatus(
  learnerId: string,
  status: LearnerStatusAction,
): Promise<LearnerActionResult> {
  return performAdminLearnerRequest({
    action: "setLearnerStatus",
    learnerId: learnerId.trim(),
    status,
  });
}