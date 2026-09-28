import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
    type Learner,
    type SchoolClass,
    type TeacherClassAssignment,
} from "@/types/school";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

async function getClass(classId: string): Promise<SchoolClass | null> {
  const classSnapshot = await getDoc(doc(firestore, "classes", classId));

  if (!classSnapshot.exists()) {
    return null;
  }

  const classData = classSnapshot.data();

  if (classData.status !== "active") {
    return null;
  }

  return {
    id: classSnapshot.id,
    name: readString(classData.name),
    gradeNumber: readNumber(classData.gradeNumber),
    academicYear: readNumber(classData.academicYear),
    status: readString(classData.status),
  };
}

async function getLearner(
  learnerId: string,
  schoolClass: SchoolClass,
): Promise<Learner | null> {
  const learnerSnapshot = await getDoc(doc(firestore, "learners", learnerId));

  if (!learnerSnapshot.exists()) {
    return null;
  }

  const learnerData = learnerSnapshot.data();

  if (learnerData.status !== "active") {
    return null;
  }

  return {
    id: learnerSnapshot.id,
    firstName: readString(learnerData.firstName),
    lastName: readString(learnerData.lastName),
    studentNumber: readString(learnerData.studentNumber),
    status: readString(learnerData.status),
    currentClassId: readString(learnerData.currentClassId),
    currentGradeNumber: readNumber(learnerData.currentGradeNumber),
    schoolClass,
    relationship: "",
  };
}

async function getClassLearners(
  classId: string,
  schoolClass: SchoolClass,
): Promise<Learner[]> {
  const enrolmentsSnapshot = await getDocs(
    collection(firestore, "enrolments", classId, "learners"),
  );

  const learnerRequests = enrolmentsSnapshot.docs
    .filter((enrolmentDocument) => enrolmentDocument.data().status === "active")
    .map((enrolmentDocument) => {
      const enrolmentData = enrolmentDocument.data();

      const learnerId = readString(
        enrolmentData.learnerId,
        enrolmentDocument.id,
      );

      return getLearner(learnerId, schoolClass);
    });

  const learnerResults = await Promise.all(learnerRequests);

  return learnerResults
    .filter((learner): learner is Learner => learner !== null)
    .sort((firstLearner, secondLearner) => {
      const firstName = `${firstLearner.firstName} ${firstLearner.lastName}`;

      const secondName = `${secondLearner.firstName} ${secondLearner.lastName}`;

      return firstName.localeCompare(secondName);
    });
}

export async function getTeacherAssignments(
  teacherUid: string,
): Promise<TeacherClassAssignment[]> {
  const assignmentsSnapshot = await getDocs(
    collection(firestore, "teacherAssignments", teacherUid, "classes"),
  );

  const assignmentRequests = assignmentsSnapshot.docs
    .filter(
      (assignmentDocument) => assignmentDocument.data().status === "active",
    )
    .map(async (assignmentDocument) => {
      const assignmentData = assignmentDocument.data();

      const classId = readString(assignmentData.classId, assignmentDocument.id);

      const schoolClass = await getClass(classId);

      if (!schoolClass) {
        return null;
      }

      const learners = await getClassLearners(classId, schoolClass);

      return {
        id: assignmentDocument.id,
        classId,
        subject: readString(assignmentData.subject),
        status: readString(assignmentData.status),
        schoolClass,
        learners,
      };
    });

  const assignmentResults = await Promise.all(assignmentRequests);

  return assignmentResults
    .filter(
      (assignment): assignment is TeacherClassAssignment => assignment !== null,
    )
    .sort((firstAssignment, secondAssignment) =>
      firstAssignment.schoolClass.name.localeCompare(
        secondAssignment.schoolClass.name,
      ),
    );
}

export async function getTeacherLearnerById(
  learnerId: string,
): Promise<Learner | null> {
  const normalizedLearnerId = learnerId.trim();

  if (!normalizedLearnerId) {
    return null;
  }

  const learnerSnapshot = await getDoc(
    doc(firestore, "learners", normalizedLearnerId),
  );

  if (!learnerSnapshot.exists()) {
    return null;
  }

  const learnerData = learnerSnapshot.data();

  if (learnerData.status !== "active") {
    return null;
  }

  const currentClassId = readString(learnerData.currentClassId);

  if (!currentClassId) {
    return null;
  }

  const schoolClass = await getClass(currentClassId);

  if (!schoolClass) {
    return null;
  }

  return getLearner(normalizedLearnerId, schoolClass);
}
