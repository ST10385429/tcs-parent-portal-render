import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
  type Learner,
  type SchoolClass,
} from "@/types/school";

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

async function getSchoolClass(
  classId: string,
): Promise<SchoolClass | null> {
  if (!classId) {
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
    gradeNumber: readNumber(classData.gradeNumber),
    academicYear: readNumber(classData.academicYear),
    status: readString(classData.status),
  };
}

async function getLearnerFromLink(
  learnerId: string,
  relationship: string,
): Promise<Learner | null> {
  const learnerSnapshot = await getDoc(
    doc(firestore, "learners", learnerId),
  );

  if (!learnerSnapshot.exists()) {
    return null;
  }

  const learnerData = learnerSnapshot.data();

  if (learnerData.status !== "active") {
    return null;
  }

  const currentClassId = readString(
    learnerData.currentClassId,
  );

  const schoolClass = await getSchoolClass(
    currentClassId,
  );

  return {
    id: learnerSnapshot.id,
    firstName: readString(learnerData.firstName),
    lastName: readString(learnerData.lastName),
    studentNumber: readString(
      learnerData.studentNumber,
    ),
    status: readString(learnerData.status),
    currentClassId,
    currentGradeNumber: readNumber(
      learnerData.currentGradeNumber,
    ),
    schoolClass,
    relationship,
  };
}

export async function getParentLearners(
  parentUid: string,
): Promise<Learner[]> {
  const linksSnapshot = await getDocs(
    collection(
      firestore,
      "parentLearnerLinks",
      parentUid,
      "learners",
    ),
  );

  const learnerRequests = linksSnapshot.docs
    .filter(
      (linkDocument) =>
        linkDocument.data().status === "active",
    )
    .map((linkDocument) => {
      const linkData = linkDocument.data();

      const learnerId = readString(
        linkData.learnerId,
        linkDocument.id,
      );

      const relationship = readString(
        linkData.relationship,
        "Parent",
      );

      return getLearnerFromLink(
        learnerId,
        relationship,
      );
    });

  const learnerResults = await Promise.all(
    learnerRequests,
  );

  return learnerResults
    .filter(
      (learner): learner is Learner =>
        learner !== null,
    )
    .sort((firstLearner, secondLearner) =>
      firstLearner.firstName.localeCompare(
        secondLearner.firstName,
      ),
    );
}