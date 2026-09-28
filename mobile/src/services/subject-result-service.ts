import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import {
  createAcademicFinanceNotification,
} from "@/services/academic-finance-notification-api-service";

import type {
  CreateSubjectResultInput,
  Learner,
  SubjectResult,
  SubjectResultStatus,
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
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function readTimestamp(
  value: unknown,
): SubjectResult["createdAt"] {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value
  ) {
    return value as SubjectResult["createdAt"];
  }

  return null;
}

function isSubjectResultStatus(
  value: unknown,
): value is SubjectResultStatus {
  return (
    value === "draft" ||
    value === "submitted"
  );
}

function normaliseSubject(
  subject: string,
): string {
  return subject.trim().toLowerCase();
}

function createSubjectResultId(
  teacherUid: string,
  learnerId: string,
  academicYear: number,
  term: number,
  subject: string,
): string {
  const safeSubject =
    encodeURIComponent(
      normaliseSubject(subject),
    );

  return [
    teacherUid,
    learnerId,
    academicYear,
    term,
    safeSubject,
  ].join("__");
}

function mapSubjectResult(
  resultId: string,
  data: Record<string, unknown>,
): SubjectResult {
  return {
    id: resultId,

    learnerId:
      readString(
        data.learnerId,
      ),

    classId:
      readString(
        data.classId,
      ),

    teacherUid:
      readString(
        data.teacherUid,
      ),

    learnerFirstName:
      readString(
        data.learnerFirstName,
      ),

    learnerLastName:
      readString(
        data.learnerLastName,
      ),

    studentNumber:
      readString(
        data.studentNumber,
      ),

    className:
      readString(
        data.className,
      ),

    academicYear:
      readNumber(
        data.academicYear,
      ),

    term:
      readNumber(
        data.term,
      ),

    subject:
      readString(
        data.subject,
      ),

    mark:
      readNumber(
        data.mark,
      ),

    comments:
      readString(
        data.comments,
      ),

    status:
      isSubjectResultStatus(
        data.status,
      )
        ? data.status
        : "draft",

    createdAt:
      readTimestamp(
        data.createdAt,
      ),

    updatedAt:
      readTimestamp(
        data.updatedAt,
      ),

    submittedAt:
      readTimestamp(
        data.submittedAt,
      ),
  };
}

function sortSubjectResults(
  results: SubjectResult[],
): SubjectResult[] {
  return [...results].sort(
    (
      firstResult,
      secondResult,
    ) => {
      if (
        firstResult.academicYear !==
        secondResult.academicYear
      ) {
        return (
          secondResult.academicYear -
          firstResult.academicYear
        );
      }

      if (
        firstResult.term !==
        secondResult.term
      ) {
        return (
          secondResult.term -
          firstResult.term
        );
      }

      const learnerComparison =
        firstResult.learnerLastName
          .localeCompare(
            secondResult.learnerLastName,
          );

      if (
        learnerComparison !== 0
      ) {
        return learnerComparison;
      }

      return firstResult.subject
        .localeCompare(
          secondResult.subject,
        );
    },
  );
}

function validateSubjectResult(
  learner: Learner,
  input: CreateSubjectResultInput,
): void {
  if (!learner.schoolClass) {
    throw new Error(
      "The learner does not have an assigned class.",
    );
  }

  if (
    !learner.currentClassId.trim()
  ) {
    throw new Error(
      "The learner does not have a valid class.",
    );
  }

  if (!input.subject.trim()) {
    throw new Error(
      "A subject is required.",
    );
  }

  if (
    input.subject.trim().length >
    60
  ) {
    throw new Error(
      "The subject cannot contain more than 60 characters.",
    );
  }

  if (
    !Number.isInteger(
      input.academicYear,
    ) ||
    input.academicYear < 2020 ||
    input.academicYear > 2100
  ) {
    throw new Error(
      "A valid academic year is required.",
    );
  }

  if (
    !Number.isInteger(
      input.mark,
    )
  ) {
    throw new Error(
      "The mark must be a whole number.",
    );
  }

  if (
    input.mark < 0 ||
    input.mark > 100
  ) {
    throw new Error(
      "The learner mark must be between 0 and 100.",
    );
  }

  if (
    !Number.isInteger(
      input.term,
    )
  ) {
    throw new Error(
      "The school term must be a whole number.",
    );
  }

  if (
    input.term < 1 ||
    input.term > 4
  ) {
    throw new Error(
      "The school term must be between 1 and 4.",
    );
  }

  const trimmedComments =
    input.comments.trim();

  if (
    trimmedComments.length < 10 ||
    trimmedComments.length > 500
  ) {
    throw new Error(
      "The teacher comment must contain between 10 and 500 characters.",
    );
  }

  if (
    input.status !== "draft" &&
    input.status !== "submitted"
  ) {
    throw new Error(
      "Select a valid subject-result status.",
    );
  }
}

export async function getTeacherSubjectResults(
  teacherUid: string,
): Promise<SubjectResult[]> {
  const cleanedTeacherUid =
    teacherUid.trim();

  if (!cleanedTeacherUid) {
    return [];
  }

  const teacherResultsQuery =
    query(
      collection(
        firestore,
        "subjectResults",
      ),

      where(
        "teacherUid",
        "==",
        cleanedTeacherUid,
      ),
    );

  const resultsSnapshot =
    await getDocs(
      teacherResultsQuery,
    );

  const results =
    resultsSnapshot.docs.map(
      (resultDocument) =>
        mapSubjectResult(
          resultDocument.id,

          resultDocument.data() as Record<
            string,
            unknown
          >,
        ),
    );

  return sortSubjectResults(
    results,
  );
}

export async function getTeacherSubjectResult(
  teacherUid: string,
  learnerId: string,
  academicYear: number,
  term: number,
  subject: string,
): Promise<SubjectResult | null> {
  const cleanedTeacherUid =
    teacherUid.trim();

  const cleanedLearnerId =
    learnerId.trim();

  const cleanedSubject =
    normaliseSubject(subject);

  if (
    !cleanedTeacherUid ||
    !cleanedLearnerId ||
    !cleanedSubject
  ) {
    return null;
  }

  const teacherResults =
    await getTeacherSubjectResults(
      cleanedTeacherUid,
    );

  const matchingResults =
    teacherResults.filter(
      (result) =>
        result.learnerId ===
          cleanedLearnerId &&
        result.academicYear ===
          academicYear &&
        result.term ===
          term &&
        normaliseSubject(
          result.subject,
        ) === cleanedSubject,
    );

  if (
    matchingResults.length ===
    0
  ) {
    return null;
  }

  const submittedResult =
    matchingResults.find(
      (result) =>
        result.status ===
        "submitted",
    );

  return (
    submittedResult ??
    matchingResults[0]
  );
}

export async function saveSubjectResult(
  teacherUid: string,
  learner: Learner,
  input: CreateSubjectResultInput,
): Promise<string> {
  const cleanedTeacherUid =
    teacherUid.trim();

  if (!cleanedTeacherUid) {
    throw new Error(
      "A signed-in teacher is required.",
    );
  }

  validateSubjectResult(
    learner,
    input,
  );

  const subject =
    input.subject.trim();

  const comments =
    input.comments.trim();

  const existingResult =
    await getTeacherSubjectResult(
      cleanedTeacherUid,
      learner.id,
      input.academicYear,
      input.term,
      subject,
    );

  if (
    existingResult?.status ===
    "submitted"
  ) {
    throw new Error(
      "This subject result has already been submitted and can no longer be changed.",
    );
  }

  if (existingResult) {
    const existingReference =
      doc(
        firestore,
        "subjectResults",
        existingResult.id,
      );

    await updateDoc(
      existingReference,
      {
        academicYear:
          input.academicYear,

        term:
          input.term,

        mark:
          input.mark,

        comments,

        status:
          input.status,

        updatedAt:
          serverTimestamp(),

        submittedAt:
          input.status ===
          "submitted"
            ? serverTimestamp()
            : null,
      },
    );

    if (
      input.status ===
      "submitted"
    ) {
      try {
        await createAcademicFinanceNotification(
          "subjectResult",
          existingResult.id,
        );
      } catch (error) {
        console.error(
          "The subject result was submitted, but its notification could not be created:",
          error,
        );
      }
    }

    return existingResult.id;
  }

  const resultId =
    createSubjectResultId(
      cleanedTeacherUid,
      learner.id,
      input.academicYear,
      input.term,
      subject,
    );

  const resultReference =
    doc(
      firestore,
      "subjectResults",
      resultId,
    );

  await setDoc(
    resultReference,
    {
      learnerId:
        learner.id,

      classId:
        learner.currentClassId,

      teacherUid:
        cleanedTeacherUid,

      learnerFirstName:
        learner.firstName,

      learnerLastName:
        learner.lastName,

      studentNumber:
        learner.studentNumber,

      className:
        learner.schoolClass?.name ??
        `Grade ${learner.currentGradeNumber}`,

      academicYear:
        input.academicYear,

      term:
        input.term,

      subject,

      mark:
        input.mark,

      comments,

      status:
        input.status,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      submittedAt:
        input.status ===
        "submitted"
          ? serverTimestamp()
          : null,
    },
  );

  if (
    input.status ===
    "submitted"
  ) {
    try {
      await createAcademicFinanceNotification(
        "subjectResult",
        resultId,
      );
    } catch (error) {
      console.error(
        "The subject result was submitted, but its notification could not be created:",
        error,
      );
    }
  }

  return resultId;
}

export async function getAllSubmittedSubjectResults(): Promise<
  SubjectResult[]
> {
  const resultsSnapshot =
    await getDocs(
      collection(
        firestore,
        "subjectResults",
      ),
    );

  const results =
    resultsSnapshot.docs
      .map(
        (resultDocument) =>
          mapSubjectResult(
            resultDocument.id,

            resultDocument.data() as Record<
              string,
              unknown
            >,
          ),
      )
      .filter(
        (result) =>
          result.status ===
          "submitted",
      );

  return sortSubjectResults(
    results,
  );
}

export async function getLearnerSubmittedSubjectResults(
  learnerId: string,
  academicYear: number,
  term: number,
): Promise<SubjectResult[]> {
  const cleanedLearnerId =
    learnerId.trim();

  if (!cleanedLearnerId) {
    return [];
  }

  const resultsSnapshot =
    await getDocs(
      collection(
        firestore,
        "subjectResults",
      ),
    );

  const matchingResults =
    resultsSnapshot.docs
      .map(
        (resultDocument) =>
          mapSubjectResult(
            resultDocument.id,

            resultDocument.data() as Record<
              string,
              unknown
            >,
          ),
      )
      .filter(
        (result) =>
          result.learnerId ===
            cleanedLearnerId &&
          result.academicYear ===
            academicYear &&
          result.term ===
            term &&
          result.status ===
            "submitted",
      );

  return sortSubjectResults(
    matchingResults,
  );
}