import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import {
  createAcademicFinanceNotification,
} from "@/services/academic-finance-notification-api-service";

import {
  getFeeAccount,
} from "@/services/fee-service";

import type {
  SubjectResult,
  TermReport,
  TermReportStatus,
  TermReportSubject,
} from "@/types/school";

/*
 * Keep this export so existing screens can continue importing
 * getFeeAccount from term-report-service if necessary.
 */
export { getFeeAccount };

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
): TermReport["createdAt"] {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    "toMillis" in value
  ) {
    return value as TermReport["createdAt"];
  }

  return null;
}

function isTermReportStatus(
  value: unknown,
): value is TermReportStatus {
  return (
    value === "draft" ||
    value === "withheld" ||
    value === "approved"
  );
}

function readSubjects(
  value: unknown,
): TermReportSubject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    .map((item) => ({
      subjectResultId:
        readString(
          item.subjectResultId,
        ),

      teacherUid:
        readString(
          item.teacherUid,
        ),

      subject:
        readString(
          item.subject,
        ),

      mark:
        readNumber(
          item.mark,
        ),

      comments:
        readString(
          item.comments,
        ),
    }));
}

function mapTermReport(
  reportId: string,
  data: Record<string, unknown>,
): TermReport {
  return {
    id:
      reportId,

    learnerId:
      readString(
        data.learnerId,
      ),

    classId:
      readString(
        data.classId,
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

    subjects:
      readSubjects(
        data.subjects,
      ),

    averageMark:
      readNumber(
        data.averageMark,
      ),

    overallComment:
      readString(
        data.overallComment,
      ),

    status:
      isTermReportStatus(
        data.status,
      )
        ? data.status
        : "draft",

    compiledBy:
      readString(
        data.compiledBy,
      ),

    createdAt:
      readTimestamp(
        data.createdAt,
      ),

    updatedAt:
      readTimestamp(
        data.updatedAt,
      ),

    approvedAt:
      readTimestamp(
        data.approvedAt,
      ),

    approvedBy:
      typeof data.approvedBy ===
      "string"
        ? data.approvedBy
        : null,
  };
}

function createTermReportId(
  learnerId: string,
  academicYear: number,
  term: number,
): string {
  return [
    learnerId,
    academicYear.toString(),
    `term${term}`,
  ].join("_");
}

function getTimestampValue(
  result: SubjectResult,
): number {
  if (result.submittedAt) {
    return result.submittedAt
      .toMillis();
  }

  if (result.updatedAt) {
    return result.updatedAt
      .toMillis();
  }

  if (result.createdAt) {
    return result.createdAt
      .toMillis();
  }

  return 0;
}

function selectLatestSubjectResults(
  results: SubjectResult[],
): SubjectResult[] {
  const latestBySubject =
    new Map<
      string,
      SubjectResult
    >();

  results.forEach(
    (result) => {
      const subjectKey =
        result.subject
          .trim()
          .toLowerCase();

      if (!subjectKey) {
        return;
      }

      const existingResult =
        latestBySubject.get(
          subjectKey,
        );

      if (
        !existingResult ||
        getTimestampValue(
          result,
        ) >
          getTimestampValue(
            existingResult,
          )
      ) {
        latestBySubject.set(
          subjectKey,
          result,
        );
      }
    },
  );

  return Array.from(
    latestBySubject.values(),
  ).sort(
    (
      first,
      second,
    ) =>
      first.subject.localeCompare(
        second.subject,
      ),
  );
}

export async function getTermReportById(
  reportId: string,
): Promise<TermReport | null> {
  const cleanedReportId =
    reportId.trim();

  if (!cleanedReportId) {
    return null;
  }

  const reportSnapshot =
    await getDoc(
      doc(
        firestore,
        "termReports",
        cleanedReportId,
      ),
    );

  if (!reportSnapshot.exists()) {
    return null;
  }

  return mapTermReport(
    reportSnapshot.id,

    reportSnapshot.data() as Record<
      string,
      unknown
    >,
  );
}

export async function getExistingTermReport(
  learnerId: string,
  academicYear: number,
  term: number,
): Promise<TermReport | null> {
  const cleanedLearnerId =
    learnerId.trim();

  if (
    !cleanedLearnerId ||
    !Number.isInteger(
      academicYear,
    ) ||
    academicYear <= 0 ||
    !Number.isInteger(
      term,
    ) ||
    term < 1 ||
    term > 4
  ) {
    return null;
  }

  const reportId =
    createTermReportId(
      cleanedLearnerId,
      academicYear,
      term,
    );

  return getTermReportById(
    reportId,
  );
}

export async function compileTermReport(
  administratorUid: string,
  submittedResults: SubjectResult[],
  overallComment: string,
  requestedStatus: TermReportStatus,
): Promise<string> {
  const cleanedAdministratorUid =
    administratorUid.trim();

  if (!cleanedAdministratorUid) {
    throw new Error(
      "A signed-in administrator is required.",
    );
  }

  if (
    submittedResults.length ===
    0
  ) {
    throw new Error(
      "At least one submitted subject result is required.",
    );
  }

  if (
    requestedStatus !== "draft" &&
    requestedStatus !== "withheld" &&
    requestedStatus !== "approved"
  ) {
    throw new Error(
      "The requested report status is invalid.",
    );
  }

  const firstResult =
    submittedResults[0];

  const matchingResults =
    submittedResults.filter(
      (result) =>
        result.learnerId ===
          firstResult.learnerId &&
        result.classId ===
          firstResult.classId &&
        result.academicYear ===
          firstResult.academicYear &&
        result.term ===
          firstResult.term &&
        result.status ===
          "submitted",
    );

  const selectedResults =
    selectLatestSubjectResults(
      matchingResults,
    );

  if (
    selectedResults.length ===
    0
  ) {
    throw new Error(
      "No valid submitted subject results were found.",
    );
  }

  const feeAccount =
    await getFeeAccount(
      firstResult.learnerId,
    );

  if (
    requestedStatus ===
      "approved" &&
    feeAccount?.status !==
      "upToDate"
  ) {
    throw new Error(
      "This report cannot be approved because the learner's fees are not up to date.",
    );
  }

  const subjects:
    TermReportSubject[] =
    selectedResults.map(
      (result) => ({
        subjectResultId:
          result.id,

        teacherUid:
          result.teacherUid,

        subject:
          result.subject,

        mark:
          result.mark,

        comments:
          result.comments,
      }),
    );

  const totalMark =
    subjects.reduce(
      (
        total,
        subject,
      ) =>
        total +
        subject.mark,
      0,
    );

  const averageMark =
    Math.round(
      totalMark /
        subjects.length,
    );

  const reportId =
    createTermReportId(
      firstResult.learnerId,
      firstResult.academicYear,
      firstResult.term,
    );

  const reportReference =
    doc(
      firestore,
      "termReports",
      reportId,
    );

  const existingReport =
    await getDoc(
      reportReference,
    );

  const reportData = {
    learnerId:
      firstResult.learnerId,

    classId:
      firstResult.classId,

    learnerFirstName:
      firstResult.learnerFirstName,

    learnerLastName:
      firstResult.learnerLastName,

    studentNumber:
      firstResult.studentNumber,

    className:
      firstResult.className,

    academicYear:
      firstResult.academicYear,

    term:
      firstResult.term,

    subjects,

    averageMark,

    overallComment:
      overallComment.trim(),

    status:
      requestedStatus,

    compiledBy:
      cleanedAdministratorUid,

    updatedAt:
      serverTimestamp(),

    approvedAt:
      requestedStatus ===
      "approved"
        ? serverTimestamp()
        : null,

    approvedBy:
      requestedStatus ===
      "approved"
        ? cleanedAdministratorUid
        : null,
  };

  if (existingReport.exists()) {
    await setDoc(
      reportReference,
      reportData,
      {
        merge: true,
      },
    );
  } else {
    await setDoc(
      reportReference,
      {
        ...reportData,

        createdAt:
          serverTimestamp(),
      },
    );
  }

  /*
   * Only an approved report should notify
   * the parent. Draft and withheld reports
   * remain silent.
   *
   * Notification failure must not undo a
   * successfully saved school report.
   */
  if (
    requestedStatus ===
    "approved"
  ) {
    try {
      await createAcademicFinanceNotification(
        "termReport",
        reportId,
      );
    } catch (error) {
      console.error(
        "The term report was approved, but its notification could not be created:",
        error,
      );
    }
  }

  return reportId;
}

export async function getApprovedTermReports(
  learnerId: string,
): Promise<TermReport[]> {
  const cleanedLearnerId =
    learnerId.trim();

  if (!cleanedLearnerId) {
    return [];
  }

  const reportsQuery =
    query(
      collection(
        firestore,
        "termReports",
      ),

      where(
        "learnerId",
        "==",
        cleanedLearnerId,
      ),

      where(
        "status",
        "==",
        "approved",
      ),
    );

  const reportsSnapshot =
    await getDocs(
      reportsQuery,
    );

  return reportsSnapshot.docs
    .map(
      (reportDocument) =>
        mapTermReport(
          reportDocument.id,

          reportDocument.data() as Record<
            string,
            unknown
          >,
        ),
    )
    .sort(
      (
        first,
        second,
      ) => {
        if (
          first.academicYear !==
          second.academicYear
        ) {
          return (
            second.academicYear -
            first.academicYear
          );
        }

        return (
          second.term -
          first.term
        );
      },
    );
}