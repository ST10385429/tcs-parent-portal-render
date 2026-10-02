// Firestore SDK imports used to read/write term report documents.
import {
  collection,       // Reference a Firestore collection
  doc,              // Reference a single document by id
  getDoc,           // Fetch one document
  getDocs,          // Fetch multiple documents
  query,            // Build a query
  serverTimestamp,  // Firestore placeholder for server-side timestamp
  setDoc,           // Create or overwrite a document
  where,            // Add a where-clause to a query
} from "firebase/firestore";

// The shared Firestore instance initialised elsewhere in the app.
import { firestore } from "@/lib/firebase";

// Service used to send academic/finance related notifications to parents.
import {
  createAcademicFinanceNotification,
} from "@/services/academic-finance-notification-api-service";

// Fee service reused here for the "fees up to date" check on approval.
import {
  getFeeAccount,
} from "@/services/fee-service";

// Domain types shared across the app.
import type {
  SubjectResult,      // A single teacher-submitted subject mark
  TermReport,         // A compiled term report
  TermReportStatus,   // "draft" | "withheld" | "approved"
  TermReportSubject,  // A subject entry embedded inside a TermReport
} from "@/types/school";

/*
 * Keep this export so existing screens can continue importing
 * getFeeAccount from term-report-service if necessary.
 *
 * (Re-export rather than reimplement, so there's a single source of truth.)
 */
export { getFeeAccount };

// Safely reads a string from an unknown value, falling back if not a string.
function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

// Safely reads a finite number from an unknown value, falling back otherwise.
function readNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

// Safely reads a Firestore Timestamp, verifying it looks like one
// (has both toDate and toMillis) before returning it.
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

// Type guard validating that a value is one of the allowed report statuses.
function isTermReportStatus(
  value: unknown,
): value is TermReportStatus {
  return (
    value === "draft" ||
    value === "withheld" ||
    value === "approved"
  );
}

// Normalises the raw `subjects` field from Firestore into a typed
// TermReportSubject array, discarding anything malformed.
function readSubjects(
  value: unknown,
): TermReportSubject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    // Keep only plain objects (not arrays, not null).
    .filter(
      (
        item,
      ): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    // Map each object to a strongly-typed TermReportSubject,
    // using safe readers for every field.
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

// Converts a raw Firestore document into a fully-typed TermReport,
// applying safe readers/guards to every field.
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

    // Defaults to "draft" if the stored status is missing or invalid.
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

    // approvedBy is deliberately nullable (only set after approval).
    approvedBy:
      typeof data.approvedBy ===
      "string"
        ? data.approvedBy
        : null,
  };
}

// Builds the deterministic document id for a term report from its
// composite key: learnerId_academicYear_term{term}.
// This guarantees one report per learner/year/term.
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

// Returns the most recent timestamp (in millis) available on a result,
// preferring submittedAt, then updatedAt, then createdAt, else 0.
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

// Given many subject results, keeps only the latest entry per subject
// (keyed case-insensitively), then returns them sorted alphabetically.
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
      // Normalise subject name for case/whitespace-insensitive matching.
      const subjectKey =
        result.subject
          .trim()
          .toLowerCase();

      // Skip results with no subject name.
      if (!subjectKey) {
        return;
      }

      const existingResult =
        latestBySubject.get(
          subjectKey,
        );

      // Replace the stored result if this one is newer.
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

// Fetches a term report by its document id. Returns null if the id is
// blank or the document doesn't exist.
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

// Looks up an existing term report for a learner/year/term.
// Returns null if arguments are invalid or no report exists.
export async function getExistingTermReport(
  learnerId: string,
  academicYear: number,
  term: number,
): Promise<TermReport | null> {
  const cleanedLearnerId =
    learnerId.trim();

  // Validate inputs: learner id required, year positive integer,
  // term must be 1..4.
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

  // Deterministic id means we can look it up directly without a query.
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

// Compiles (creates or updates) a term report from a set of submitted
// subject results. Enforces validation, de-duplicates to the latest
// result per subject, checks fees before approval, and optionally sends
// a notification to the parent. Returns the report id.
export async function compileTermReport(
  administratorUid: string,
  submittedResults: SubjectResult[],
  overallComment: string,
  requestedStatus: TermReportStatus,
): Promise<string> {
  const cleanedAdministratorUid =
    administratorUid.trim();

  // Ensure the caller is authenticated.
  if (!cleanedAdministratorUid) {
    throw new Error(
      "A signed-in administrator is required.",
    );
  }

  // Must have at least one subject result to compile.
  if (
    submittedResults.length ===
    0
  ) {
    throw new Error(
      "At least one submitted subject result is required.",
    );
  }

  // Validate status argument against the allowed set.
  if (
    requestedStatus !== "draft" &&
    requestedStatus !== "withheld" &&
    requestedStatus !== "approved"
  ) {
    throw new Error(
      "The requested report status is invalid.",
    );
  }

  // Use the first result as the canonical learner/year/term/class for
  // this compilation.
  const firstResult =
    submittedResults[0];

  // Keep only results that belong to the same learner/year/term/class
  // AND are still in the "submitted" state (i.e., not already compiled).
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

  // If the same subject has multiple results, keep only the latest one.
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

  // Load the learner's fee account to decide whether approval is allowed.
  const feeAccount =
    await getFeeAccount(
      firstResult.learnerId,
    );

  // Approval requires fees to be up to date; otherwise block the action.
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

  // Project each selected result into the shape stored on the report.
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

  // Compute the average mark (rounded to nearest whole number).
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

  // Deterministic id ensures one report per learner/year/term.
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

  // Check whether the report already exists (update vs. create).
  const existingReport =
    await getDoc(
      reportReference,
    );

  // Fields that are always written on compile.
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

    // Trim so accidental whitespace doesn't get stored.
    overallComment:
      overallComment.trim(),

    status:
      requestedStatus,

    compiledBy:
      cleanedAdministratorUid,

    updatedAt:
      serverTimestamp(),

    // Approval metadata only set when status is "approved".
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

  // Update existing report (merge to preserve createdAt) or create new.
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
      // Fire a "termReport" notification keyed by the report id.
      await createAcademicFinanceNotification(
        "termReport",
        reportId,
      );
    } catch (error) {
      // Swallow notification errors: the report is already saved and
      // approval should not be rolled back.
      console.error(
        "The term report was approved, but its notification could not be created:",
        error,
      );
    }
  }

  return reportId;
}

// Returns all approved term reports for a learner, sorted newest-first
// by academic year, then by term descending.
export async function getApprovedTermReports(
  learnerId: string,
): Promise<TermReport[]> {
  const cleanedLearnerId =
    learnerId.trim();

  // Nothing to fetch without a learner id.
  if (!cleanedLearnerId) {
    return [];
  }

  // Query termReports where learnerId matches AND status == "approved".
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
    // Map each snapshot to a typed TermReport.
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
    // Sort: newest academic year first, then newest term first.
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