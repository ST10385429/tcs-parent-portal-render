import type { Timestamp } from "firebase/firestore";

export type SchoolClassStatus = "active" | "inactive";

export type LearnerStatus = "active" | "inactive";

export type AssignmentStatus = "active" | "inactive";

export type FeeStatus = "upToDate" | "outstanding";

export type FeeStructureStatus = "active" | "inactive";

export type SiblingDiscountType = "manual" | "percentage" | "fixed";

export type FeeStatementStatus =
  | "draft"
  | "issued"
  | "partiallyPaid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "recorded"
  | "refunded";

export type PaymentMethod =
  | "online"
  | "eft"
  | "cash"
  | "card"
  | "adjustment";

export type SubjectResultStatus = "draft" | "submitted";

export type TermReportStatus = "draft" | "withheld" | "approved";

export type SchoolClass = {
  id: string;
  name: string;
  gradeNumber: number;
  academicYear: number;
  status: SchoolClassStatus | string;
};

export type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  status: LearnerStatus | string;
  currentClassId: string;
  currentGradeNumber: number;
  schoolClass: SchoolClass | null;
  relationship: string;
};

export type TeacherClassAssignment = {
  id: string;
  classId: string;
  subject: string;
  status: AssignmentStatus | string;
  schoolClass: SchoolClass;
  learners: Learner[];
};

/**
 * An official school fee structure for a particular grade band
 * and academic year.
 *
 * Stored at:
 * feeStructures/{feeStructureId}
 */
export type FeeStructure = {
  id: string;
  academicYear: number;
  name: string;
  gradeBand: string;
  gradeCodes: string[];
  registrationFee: number;
  monthlyTuition: number;
  tuitionMonths: number;
  annualTuitionTotal: number;
  annualTotal: number;
  paymentDueDay: number;
  currency: "ZAR";
  status: FeeStructureStatus;
  siblingDiscountEnabled: boolean;
  siblingDiscountType: SiblingDiscountType;
  siblingDiscountValue: number;
  siblingDiscountNote: string;
  paymentNote: string;
  excludedExpenses: string[];
  terminationNoticeMonths: number;
  terminationNote: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/**
 * A summary of the learner's current fee-account position.
 *
 * Stored at:
 * feeAccounts/{learnerId}
 *
 * The values in this record are calculated from statements,
 * verified payments and authorised adjustments.
 */
export type FeeAccount = {
  learnerId: string;
  academicYear: number;
  currency: "ZAR";
  totalCharged: number;
  totalPaid: number;
  currentBalance: number;
  overdueBalance: number;
  status: FeeStatus;
  lastStatementAt: Timestamp | null;
  updatedAt: Timestamp | null;
  updatedBy: string;
};

/**
 * A single charge, discount, payment allocation or adjustment
 * displayed on a fee statement.
 */
export type FeeStatementLineItem = {
  id: string;
  description: string;
  type: "charge" | "discount" | "payment" | "adjustment";
  amount: number;
  quantity: number;
  total: number;
  dueDate: Timestamp | null;
};

/**
 * An official statement issued to a learner's fee account.
 *
 * Stored at:
 * feeStatements/{statementId}
 */
export type FeeStatement = {
  id: string;
  learnerId: string;
  parentUid: string;
  feeStructureId: string;
  academicYear: number;
  statementNumber: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  gradeName: string;
  currency: "ZAR";
  periodStart: Timestamp | null;
  periodEnd: Timestamp | null;
  issueDate: Timestamp | null;
  dueDate: Timestamp | null;
  openingBalance: number;
  lineItems: FeeStatementLineItem[];
  totalCharges: number;
  totalDiscounts: number;
  totalPayments: number;
  closingBalance: number;
  amountDue: number;
  status: FeeStatementStatus;
  notes: string;
  issuedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/**
 * Values used by an administrator when creating a statement.
 */
export type CreateFeeStatementInput = {
  learnerId: string;
  parentUid: string;
  feeStructureId: string;
  academicYear: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  openingBalance: number;
  lineItems: FeeStatementLineItem[];
  notes: string;
};

/**
 * A payment attempt, verified payment or authorised financial
 * adjustment.
 *
 * A trusted backend or authorised administrator must confirm
 * payments. The mobile app must never mark an online payment
 * as paid by itself.
 *
 * Stored at:
 * payments/{paymentId}
 */
export type FeePayment = {
  id: string;
  learnerId: string;
  parentUid: string;
  statementId: string;
  amount: number;
  currency: "ZAR";
  method: PaymentMethod;
  status: PaymentStatus;
  providerReference: string;
  receiptNumber: string;
  description: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  paidAt: Timestamp | null;
  recordedBy: string;
};

/**
 * A single subject result entered by one teacher.
 *
 * Parents cannot access these records directly. An administrator
 * uses submitted subject results when compiling a final report.
 */
export type SubjectResult = {
  id: string;
  learnerId: string;
  classId: string;
  teacherUid: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  className: string;
  academicYear: number;
  term: number;
  subject: string;
  mark: number;
  comments: string;
  status: SubjectResultStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  submittedAt: Timestamp | null;
};

/**
 * Values required when a teacher creates a subject result.
 */
export type CreateSubjectResultInput = {
  learnerId: string;
  classId: string;
  academicYear: number;
  term: number;
  subject: string;
  mark: number;
  comments: string;
  status: SubjectResultStatus;
};

/**
 * A subject-result snapshot stored inside a final term report.
 */
export type TermReportSubject = {
  subjectResultId: string;
  teacherUid: string;
  subject: string;
  mark: number;
  comments: string;
};

/**
 * A complete term report compiled and controlled by an
 * administrator.
 */
export type TermReport = {
  id: string;
  learnerId: string;
  classId: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  className: string;
  academicYear: number;
  term: number;
  subjects: TermReportSubject[];
  averageMark: number;
  overallComment: string;
  status: TermReportStatus;
  compiledBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  approvedAt: Timestamp | null;
  approvedBy: string | null;
};

/**
 * Values used by an administrator when compiling a final
 * term report.
 */
export type CreateTermReportInput = {
  learnerId: string;
  classId: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  className: string;
  academicYear: number;
  term: number;
  subjects: TermReportSubject[];
  averageMark: number;
  overallComment: string;
  status: TermReportStatus;
};

/**
 * Temporary legacy report types.
 *
 * These can be removed after every screen and service has been
 * migrated to SubjectResult and TermReport.
 */
export type ReportStatus =
  | "draft"
  | "submitted"
  | "withheld"
  | "approved";

export type LearnerReport = {
  id: string;
  learnerId: string;
  classId: string;
  teacherUid: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  className: string;
  academicYear: number;
  term: number;
  subject: string;
  mark: number;
  comments: string;
  reportFilePath: string;
  status: ReportStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  adminNote: string;
};

export type CreateLearnerReportInput = {
  learnerId: string;
  classId: string;
  academicYear: number;
  term: number;
  subject: string;
  mark: number;
  comments: string;
  reportFilePath: string;
  status: "draft" | "submitted";
};

export type ReviewLearnerReportInput = {
  status: "approved" | "withheld";
  adminNote: string;
};

export type ParentRequestType =
  | "generalQuery"
  | "absenceReport"
  | "teacherAppointment";

export type ParentRequestStatus =
  | "submitted"
  | "inReview"
  | "responded"
  | "resolved"
  | "acknowledged"
  | "approved"
  | "declined"
  | "requested"
  | "confirmed"
  | "rescheduled"
  | "completed"
  | "cancelled";

export type ParentRequestActorRole =
  | "parent"
  | "teacher"
  | "administrator";

export type GeneralQueryCategory =
  | "academics"
  | "homework"
  | "attendance"
  | "behaviour"
  | "fees"
  | "general";

export type AbsenceReason =
  | "illness"
  | "medicalAppointment"
  | "familyResponsibility"
  | "transport"
  | "other";

export type PermissionFormStatus = "draft" | "active" | "closed";

export type PermissionDecision = "pending" | "approved" | "declined";

/**
 * A request submitted by a parent.
 *
 * General queries and absence reports are sent to administrators.
 * Appointment requests are sent to the selected teacher.
 *
 * Stored at:
 * parentRequests/{requestId}
 */
export type ParentServiceRequest = {
  id: string;
  referenceNumber: string;
  requestType: ParentRequestType;
  status: ParentRequestStatus;

  parentUid: string;

  learnerId: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  classId: string;
  className: string;

  subject: string;
  description: string;

  category: GeneralQueryCategory | null;

  absenceReason: AbsenceReason | null;
  absenceStartDate: Timestamp | null;
  absenceEndDate: Timestamp | null;

  teacherUid: string | null;
  teacherName: string;
  teacherSubject: string;

  requestedAppointmentDate: Timestamp | null;
  requestedAppointmentTime: string;

  confirmedAppointmentDate: Timestamp | null;
  confirmedAppointmentTime: string;

  latestResponse: string;
  latestResponseBy: string | null;
  latestResponseAt: Timestamp | null;

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
};

/**
 * A reply added to a parent service request.
 *
 * Stored at:
 * parentRequests/{requestId}/replies/{replyId}
 */
export type ParentRequestReply = {
  id: string;
  requestId: string;

  senderUid: string;
  senderRole: ParentRequestActorRole;
  senderName: string;

  message: string;

  createdAt: Timestamp | null;
};

/**
 * Values used when submitting a general query.
 */
export type CreateGeneralQueryInput = {
  learnerId: string;
  category: GeneralQueryCategory;
  subject: string;
  description: string;
};

/**
 * Values used when reporting a learner absence.
 */
export type CreateAbsenceReportInput = {
  learnerId: string;
  absenceReason: AbsenceReason;
  startDate: Date;
  endDate: Date;
  description: string;
};

/**
 * Values used when requesting a teacher appointment.
 */
export type CreateTeacherAppointmentInput = {
  learnerId: string;
  teacherUid: string;
  teacherName: string;
  teacherSubject: string;
  requestedDate: Date;
  requestedTime: string;
  description: string;
};

/**
 * A permission form created by an administrator.
 *
 * Stored at:
 * permissionForms/{permissionFormId}
 */
export type PermissionForm = {
  id: string;

  title: string;
  description: string;
  eventLocation: string;

  eventDate: Timestamp | null;
  responseDueDate: Timestamp | null;

  targetClassIds: string[];
  status: PermissionFormStatus;

  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/**
 * A parent's response to a permission form.
 *
 * Stored at:
 * permissionForms/{permissionFormId}/responses/{learnerId}
 */
export type PermissionFormResponse = {
  id: string;
  permissionFormId: string;

  parentUid: string;

  learnerId: string;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;

  decision: PermissionDecision;
  parentNote: string;

  respondedAt: Timestamp | null;
  updatedAt: Timestamp | null;
};
