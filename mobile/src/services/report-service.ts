import {
    addDoc,
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import type {
    CreateLearnerReportInput,
    Learner,
    LearnerReport,
    ReportStatus,
    ReviewLearnerReportInput,
} from "@/types/school";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function isReportStatus(value: unknown): value is ReportStatus {
  return (
    value === "draft" ||
    value === "submitted" ||
    value === "withheld" ||
    value === "approved"
  );
}

function mapReport(
  reportId: string,
  data: Record<string, unknown>,
): LearnerReport {
  const reportStatus = isReportStatus(data.status) ? data.status : "draft";

  return {
    id: reportId,

    learnerId: readString(data.learnerId),
    classId: readString(data.classId),
    teacherUid: readString(data.teacherUid),

    learnerFirstName: readString(data.learnerFirstName),
    learnerLastName: readString(data.learnerLastName),
    studentNumber: readString(data.studentNumber),
    className: readString(data.className),

    academicYear: readNumber(data.academicYear),
    term: readNumber(data.term),
    subject: readString(data.subject),
    mark: readNumber(data.mark),
    comments: readString(data.comments),

    reportFilePath: readString(data.reportFilePath),

    status: reportStatus,

    createdAt:
      data.createdAt &&
      typeof data.createdAt === "object" &&
      "toDate" in data.createdAt
        ? (data.createdAt as LearnerReport["createdAt"])
        : null,

    updatedAt:
      data.updatedAt &&
      typeof data.updatedAt === "object" &&
      "toDate" in data.updatedAt
        ? (data.updatedAt as LearnerReport["updatedAt"])
        : null,

    submittedAt:
      data.submittedAt &&
      typeof data.submittedAt === "object" &&
      "toDate" in data.submittedAt
        ? (data.submittedAt as LearnerReport["submittedAt"])
        : null,

    reviewedAt:
      data.reviewedAt &&
      typeof data.reviewedAt === "object" &&
      "toDate" in data.reviewedAt
        ? (data.reviewedAt as LearnerReport["reviewedAt"])
        : null,

    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : null,

    adminNote: readString(data.adminNote),
  };
}

function sortReports(reports: LearnerReport[]): LearnerReport[] {
  return reports.sort((firstReport, secondReport) => {
    if (firstReport.academicYear !== secondReport.academicYear) {
      return secondReport.academicYear - firstReport.academicYear;
    }

    if (firstReport.term !== secondReport.term) {
      return secondReport.term - firstReport.term;
    }

    return firstReport.subject.localeCompare(secondReport.subject);
  });
}

export async function createTeacherReport(
  teacherUid: string,
  learner: Learner,
  input: CreateLearnerReportInput,
): Promise<string> {
  if (!teacherUid) {
    throw new Error("A signed-in teacher is required.");
  }

  if (!learner.schoolClass) {
    throw new Error("The learner does not have an assigned class.");
  }

  if (input.mark < 0 || input.mark > 100) {
    throw new Error("The learner mark must be between 0 and 100.");
  }

  if (input.term < 1 || input.term > 4) {
    throw new Error("The school term must be between 1 and 4.");
  }

  const reportDocument = await addDoc(collection(firestore, "reports"), {
    learnerId: learner.id,
    classId: learner.currentClassId,
    teacherUid,

    learnerFirstName: learner.firstName,
    learnerLastName: learner.lastName,
    studentNumber: learner.studentNumber,
    className: learner.schoolClass.name,

    academicYear: input.academicYear,
    term: input.term,
    subject: input.subject.trim(),
    mark: input.mark,
    comments: input.comments.trim(),

    // Cloud file uploads are intentionally disabled while the
    // Firebase project remains on the free Spark plan.
    reportFilePath: "",

    status: input.status,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    submittedAt: input.status === "submitted" ? serverTimestamp() : null,

    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
  });

  return reportDocument.id;
}

export async function getTeacherReports(
  teacherUid: string,
): Promise<LearnerReport[]> {
  if (!teacherUid) {
    return [];
  }

  const reportsQuery = query(
    collection(firestore, "reports"),
    where("teacherUid", "==", teacherUid),
  );

  const reportsSnapshot = await getDocs(reportsQuery);

  const reports = reportsSnapshot.docs.map((reportDocument) =>
    mapReport(
      reportDocument.id,
      reportDocument.data() as Record<string, unknown>,
    ),
  );

  return sortReports(reports);
}

export async function getSubmittedReports(): Promise<LearnerReport[]> {
  const submittedReportsQuery = query(
    collection(firestore, "reports"),
    where("status", "in", ["submitted", "withheld"]),
  );

  const reportsSnapshot = await getDocs(submittedReportsQuery);

  const reports = reportsSnapshot.docs.map((reportDocument) =>
    mapReport(
      reportDocument.id,
      reportDocument.data() as Record<string, unknown>,
    ),
  );

  return sortReports(reports);
}

export async function getApprovedLearnerReports(
  learnerId: string,
): Promise<LearnerReport[]> {
  if (!learnerId) {
    return [];
  }

  const approvedReportsQuery = query(
    collection(firestore, "reports"),
    where("learnerId", "==", learnerId),
    where("status", "==", "approved"),
  );

  const reportsSnapshot = await getDocs(approvedReportsQuery);

  const reports = reportsSnapshot.docs.map((reportDocument) =>
    mapReport(
      reportDocument.id,
      reportDocument.data() as Record<string, unknown>,
    ),
  );

  return sortReports(reports);
}

export async function reviewLearnerReport(
  reportId: string,
  administratorUid: string,
  input: ReviewLearnerReportInput,
): Promise<void> {
  if (!reportId) {
    throw new Error("A report must be selected.");
  }

  if (!administratorUid) {
    throw new Error("A signed-in administrator is required.");
  }

  await updateDoc(doc(firestore, "reports", reportId), {
    status: input.status,
    adminNote: input.adminNote.trim(),
    reviewedAt: serverTimestamp(),
    reviewedBy: administratorUid,
    updatedAt: serverTimestamp(),
  });
}
