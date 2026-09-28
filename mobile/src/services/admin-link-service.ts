import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import {
  firebaseApp,
  firestore,
} from "@/lib/firebase";
import type {
  Learner,
  SchoolClass,
} from "@/types/school";

export type ParentLearnerLink = {
  learnerId: string;
  relationship: string;
  status: string;
  learner: Learner;
};

export type TeacherClassLink = {
  classId: string;
  subject: string;
  status: string;
  schoolClass: SchoolClass;
};

type LinkActionResult = {
  message: string;
};

type LinkApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

type LinkApiRequest =
  | {
      action: "linkParentLearner";
      userUid: string;
      learnerId: string;
      relationship: string;
    }
  | {
      action: "unlinkParentLearner";
      userUid: string;
      learnerId: string;
    }
  | {
      action: "assignTeacherClass";
      userUid: string;
      classId: string;
      subject: string;
    }
  | {
      action: "unassignTeacherClass";
      userUid: string;
      classId: string;
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

function getAdminLinksEndpoint(): string {
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

    return `${functionsBaseUrl}/admin-links`;
  }

  return `${normalizedUrl}${functionsPath}/admin-links`;
}

async function callAdminLinksApi(
  request: LinkApiRequest,
): Promise<LinkActionResult> {
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
    getAdminLinksEndpoint(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  const responseText = await response.text();

  let result: LinkApiResponse = {};

  if (responseText) {
    try {
      result = JSON.parse(
        responseText,
      ) as LinkApiResponse;
    } catch {
      throw new Error(
        "The server returned an invalid response.",
      );
    }
  }

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        "The account link could not be updated.",
    );
  }

  return {
    message:
      result.message ||
      "The account link was updated.",
  };
}

async function getSchoolClassById(
  classId: string,
): Promise<SchoolClass | null> {
  if (!classId.trim()) {
    return null;
  }

  const classSnapshot = await getDoc(
    doc(firestore, "classes", classId),
  );

  if (!classSnapshot.exists()) {
    return null;
  }

  const classData = classSnapshot.data();

  return {
    id: classSnapshot.id,
    name: readString(classData.name),
    gradeNumber: readNumber(
      classData.gradeNumber,
    ),
    academicYear: readNumber(
      classData.academicYear,
    ),
    status: readString(
      classData.status,
    ),
  };
}

async function getLearnerById(
  learnerId: string,
  relationship = "",
): Promise<Learner | null> {
  const learnerSnapshot = await getDoc(
    doc(firestore, "learners", learnerId),
  );

  if (!learnerSnapshot.exists()) {
    return null;
  }

  const learnerData =
    learnerSnapshot.data();

  const currentClassId = readString(
    learnerData.currentClassId,
  );

  const schoolClass =
    currentClassId
      ? await getSchoolClassById(
          currentClassId,
        )
      : null;

  return {
    id: learnerSnapshot.id,
    firstName: readString(
      learnerData.firstName,
    ),
    lastName: readString(
      learnerData.lastName,
    ),
    studentNumber: readString(
      learnerData.studentNumber,
    ),
    status: readString(
      learnerData.status,
    ),
    currentClassId,
    currentGradeNumber: readNumber(
      learnerData.currentGradeNumber,
    ),
    schoolClass,
    relationship,
  };
}

export async function getAllActiveLearnersForAdmin(): Promise<
  Learner[]
> {
  const snapshot = await getDocs(
    collection(firestore, "learners"),
  );

  const learnerRequests = snapshot.docs
    .filter(
      (learnerDocument) =>
        learnerDocument.data().status ===
        "active",
    )
    .map((learnerDocument) =>
      getLearnerById(learnerDocument.id),
    );

  const learnerResults =
    await Promise.all(learnerRequests);

  return learnerResults
    .filter(
      (learner): learner is Learner =>
        learner !== null,
    )
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

export async function getAllActiveClassesForAdmin(): Promise<
  SchoolClass[]
> {
  const snapshot = await getDocs(
    collection(firestore, "classes"),
  );

  return snapshot.docs
    .map((classDocument) => {
      const data = classDocument.data();

      return {
        id: classDocument.id,
        name: readString(data.name),
        gradeNumber: readNumber(
          data.gradeNumber,
        ),
        academicYear: readNumber(
          data.academicYear,
        ),
        status: readString(data.status),
      } satisfies SchoolClass;
    })
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

export async function getParentLearnerLinksForAdmin(
  parentUid: string,
): Promise<ParentLearnerLink[]> {
  const normalizedUid = parentUid.trim();

  if (!normalizedUid) {
    return [];
  }

  const snapshot = await getDocs(
    collection(
      firestore,
      "parentLearnerLinks",
      normalizedUid,
      "learners",
    ),
  );

  const linkRequests = snapshot.docs
    .filter(
      (linkDocument) =>
        linkDocument.data().status ===
        "active",
    )
    .map(async (linkDocument) => {
      const data = linkDocument.data();

      const learnerId = readString(
        data.learnerId,
        linkDocument.id,
      );

      const relationship = readString(
        data.relationship,
        "Parent",
      );

      const learner =
        await getLearnerById(
          learnerId,
          relationship,
        );

      if (!learner) {
        return null;
      }

      return {
        learnerId,
        relationship,
        status: readString(
          data.status,
          "active",
        ),
        learner,
      } satisfies ParentLearnerLink;
    });

  const linkResults =
    await Promise.all(linkRequests);

  return linkResults
    .filter(
      (
        link,
      ): link is ParentLearnerLink =>
        link !== null,
    )
    .sort((firstLink, secondLink) => {
      const firstName =
        `${firstLink.learner.firstName} ${firstLink.learner.lastName}`.trim();

      const secondName =
        `${secondLink.learner.firstName} ${secondLink.learner.lastName}`.trim();

      return firstName.localeCompare(
        secondName,
      );
    });
}

export async function getTeacherClassLinksForAdmin(
  teacherUid: string,
): Promise<TeacherClassLink[]> {
  const normalizedUid = teacherUid.trim();

  if (!normalizedUid) {
    return [];
  }

  const snapshot = await getDocs(
    collection(
      firestore,
      "teacherAssignments",
      normalizedUid,
      "classes",
    ),
  );

  const linkRequests = snapshot.docs
    .filter(
      (assignmentDocument) =>
        assignmentDocument.data().status ===
        "active",
    )
    .map(async (assignmentDocument) => {
      const data =
        assignmentDocument.data();

      const classId = readString(
        data.classId,
        assignmentDocument.id,
      );

      const schoolClass =
        await getSchoolClassById(classId);

      if (!schoolClass) {
        return null;
      }

      return {
        classId,
        subject: readString(
          data.subject,
        ),
        status: readString(
          data.status,
          "active",
        ),
        schoolClass,
      } satisfies TeacherClassLink;
    });

  const linkResults =
    await Promise.all(linkRequests);

  return linkResults
    .filter(
      (
        link,
      ): link is TeacherClassLink =>
        link !== null,
    )
    .sort((firstLink, secondLink) =>
      firstLink.schoolClass.name.localeCompare(
        secondLink.schoolClass.name,
      ),
    );
}

export async function linkParentToLearner(
  parentUid: string,
  learnerId: string,
  relationship: string,
): Promise<LinkActionResult> {
  return callAdminLinksApi({
    action: "linkParentLearner",
    userUid: parentUid.trim(),
    learnerId: learnerId.trim(),
    relationship: relationship.trim(),
  });
}

export async function unlinkParentFromLearner(
  parentUid: string,
  learnerId: string,
): Promise<LinkActionResult> {
  return callAdminLinksApi({
    action: "unlinkParentLearner",
    userUid: parentUid.trim(),
    learnerId: learnerId.trim(),
  });
}

export async function assignTeacherToClass(
  teacherUid: string,
  classId: string,
  subject: string,
): Promise<LinkActionResult> {
  return callAdminLinksApi({
    action: "assignTeacherClass",
    userUid: teacherUid.trim(),
    classId: classId.trim(),
    subject: subject.trim(),
  });
}

export async function unassignTeacherFromClass(
  teacherUid: string,
  classId: string,
): Promise<LinkActionResult> {
  return callAdminLinksApi({
    action: "unassignTeacherClass",
    userUid: teacherUid.trim(),
    classId: classId.trim(),
  });
}