import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import {
  createAcademicFinanceNotification,
} from "@/services/academic-finance-notification-api-service";

import {
  getFeeAccount,
} from "@/services/fee-service";

import type {
  FeeStatement,
  FeeStatementLineItem,
  FeeStatementStatus,
} from "@/types/school";

export type IssueFeeStatementInput = {
  learnerId: string;
  feeStructureId: string;
  academicYear: number;
  learnerFirstName: string;
  learnerLastName: string;
  studentNumber: string;
  gradeName: string;
  description: string;
  amount: number;
  discountAmount: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  notes: string;
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
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function readTimestamp(
  value: unknown,
): Timestamp | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    "toMillis" in value
  ) {
    return value as Timestamp;
  }

  return null;
}

function readStatementStatus(
  value: unknown,
): FeeStatementStatus {
  if (
    value === "draft" ||
    value === "issued" ||
    value === "partiallyPaid" ||
    value === "paid" ||
    value === "overdue" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "issued";
}

function readLineItems(
  value: unknown,
): FeeStatementLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    .map((item) => ({
      id:
        readString(
          item.id,
        ),

      description:
        readString(
          item.description,
        ),

      type:
        item.type === "discount" ||
        item.type === "payment" ||
        item.type === "adjustment"
          ? item.type
          : "charge",

      amount:
        readNumber(
          item.amount,
        ),

      quantity:
        readNumber(
          item.quantity,
          1,
        ),

      total:
        readNumber(
          item.total,
        ),

      dueDate:
        readTimestamp(
          item.dueDate,
        ),
    }));
}

function mapFeeStatement(
  statementId: string,
  data: Record<string, unknown>,
): FeeStatement {
  return {
    id:
      statementId,

    learnerId:
      readString(
        data.learnerId,
      ),

    parentUid:
      readString(
        data.parentUid,
      ),

    feeStructureId:
      readString(
        data.feeStructureId,
      ),

    academicYear:
      readNumber(
        data.academicYear,
      ),

    statementNumber:
      readString(
        data.statementNumber,
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

    gradeName:
      readString(
        data.gradeName,
      ),

    currency:
      "ZAR",

    periodStart:
      readTimestamp(
        data.periodStart,
      ),

    periodEnd:
      readTimestamp(
        data.periodEnd,
      ),

    issueDate:
      readTimestamp(
        data.issueDate,
      ),

    dueDate:
      readTimestamp(
        data.dueDate,
      ),

    openingBalance:
      readNumber(
        data.openingBalance,
      ),

    lineItems:
      readLineItems(
        data.lineItems,
      ),

    totalCharges:
      readNumber(
        data.totalCharges,
      ),

    totalDiscounts:
      readNumber(
        data.totalDiscounts,
      ),

    totalPayments:
      readNumber(
        data.totalPayments,
      ),

    closingBalance:
      readNumber(
        data.closingBalance,
      ),

    amountDue:
      readNumber(
        data.amountDue,
      ),

    status:
      readStatementStatus(
        data.status,
      ),

    notes:
      readString(
        data.notes,
      ),

    issuedBy:
      readString(
        data.issuedBy,
      ),

    createdAt:
      readTimestamp(
        data.createdAt,
      ),

    updatedAt:
      readTimestamp(
        data.updatedAt,
      ),
  };
}

function createStatementNumber(
  learnerId: string,
  academicYear: number,
): string {
  const now =
    new Date();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      "0",
    );

  const hours =
    String(
      now.getHours(),
    ).padStart(
      2,
      "0",
    );

  const minutes =
    String(
      now.getMinutes(),
    ).padStart(
      2,
      "0",
    );

  const seconds =
    String(
      now.getSeconds(),
    ).padStart(
      2,
      "0",
    );

  const learnerCode =
    learnerId
      .replace(
        /[^a-zA-Z0-9]/g,
        "",
      )
      .slice(
        0,
        6,
      )
      .toUpperCase();

  return [
    "TCS",
    academicYear,
    `${month}${day}`,
    `${hours}${minutes}${seconds}`,
    learnerCode,
  ].join("-");
}

async function getLinkedParentUid(
  learnerId: string,
): Promise<string> {
  const learnerSnapshot =
    await getDoc(
      doc(
        firestore,
        "learners",
        learnerId,
      ),
    );

  if (!learnerSnapshot.exists()) {
    throw new Error(
      "The selected learner could not be found.",
    );
  }

  const learnerData =
    learnerSnapshot.data();

  const parentUid =
    readString(
      learnerData.primaryParentUid,
    ).trim();

  if (!parentUid) {
    throw new Error(
      "This learner does not have a primary parent linked to their account.",
    );
  }

  const parentSnapshot =
    await getDoc(
      doc(
        firestore,
        "users",
        parentUid,
      ),
    );

  if (!parentSnapshot.exists()) {
    throw new Error(
      "The linked parent account could not be found.",
    );
  }

  const parentData =
    parentSnapshot.data();

  if (
    parentData.role !== "parent" ||
    parentData.status !== "active"
  ) {
    throw new Error(
      "The linked parent account is not active.",
    );
  }

  const relationshipSnapshot =
    await getDoc(
      doc(
        firestore,
        "parentLearnerLinks",
        parentUid,
        "learners",
        learnerId,
      ),
    );

  if (
    !relationshipSnapshot.exists() ||
    relationshipSnapshot.data()
      .status !== "active"
  ) {
    throw new Error(
      "The parent and learner relationship is not active.",
    );
  }

  return parentUid;
}

export async function getAllFeeStatements(): Promise<
  FeeStatement[]
> {
  const statementsSnapshot =
    await getDocs(
      collection(
        firestore,
        "feeStatements",
      ),
    );

  return statementsSnapshot.docs
    .map(
      (statementDocument) =>
        mapFeeStatement(
          statementDocument.id,

          statementDocument.data() as Record<
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
        const firstDate =
          first.issueDate
            ?.toMillis() ??
          first.createdAt
            ?.toMillis() ??
          0;

        const secondDate =
          second.issueDate
            ?.toMillis() ??
          second.createdAt
            ?.toMillis() ??
          0;

        return (
          secondDate -
          firstDate
        );
      },
    );
}

export async function getLearnerFeeStatements(
  learnerId: string,
): Promise<FeeStatement[]> {
  const cleanedLearnerId =
    learnerId.trim();

  if (!cleanedLearnerId) {
    return [];
  }

  const statementsQuery =
    query(
      collection(
        firestore,
        "feeStatements",
      ),

      where(
        "learnerId",
        "==",
        cleanedLearnerId,
      ),
    );

  const statementsSnapshot =
    await getDocs(
      statementsQuery,
    );

  return statementsSnapshot.docs
    .map(
      (statementDocument) =>
        mapFeeStatement(
          statementDocument.id,

          statementDocument.data() as Record<
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
        const firstDate =
          first.issueDate
            ?.toMillis() ??
          first.createdAt
            ?.toMillis() ??
          0;

        const secondDate =
          second.issueDate
            ?.toMillis() ??
          second.createdAt
            ?.toMillis() ??
          0;

        return (
          secondDate -
          firstDate
        );
      },
    );
}

export async function issueFeeStatement(
  administratorUid: string,
  input: IssueFeeStatementInput,
): Promise<string> {
  const cleanedAdministratorUid =
    administratorUid.trim();

  const cleanedLearnerId =
    input.learnerId.trim();

  const cleanedDescription =
    input.description.trim();

  if (!cleanedAdministratorUid) {
    throw new Error(
      "A signed-in administrator is required.",
    );
  }

  if (!cleanedLearnerId) {
    throw new Error(
      "A learner must be selected.",
    );
  }

  if (
    !input.feeStructureId.trim()
  ) {
    throw new Error(
      "A fee structure must be selected.",
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
      "The academic year is invalid.",
    );
  }

  if (!cleanedDescription) {
    throw new Error(
      "A statement description is required.",
    );
  }

  if (
    !Number.isFinite(
      input.amount,
    ) ||
    input.amount <= 0
  ) {
    throw new Error(
      "The charge amount must be greater than zero.",
    );
  }

  if (
    !Number.isFinite(
      input.discountAmount,
    ) ||
    input.discountAmount < 0
  ) {
    throw new Error(
      "The discount amount cannot be negative.",
    );
  }

  if (
    input.discountAmount >
    input.amount
  ) {
    throw new Error(
      "The discount cannot be greater than the charge.",
    );
  }

  if (
    input.periodEnd <
    input.periodStart
  ) {
    throw new Error(
      "The statement period end date cannot be before its start date.",
    );
  }

  const parentUid =
    await getLinkedParentUid(
      cleanedLearnerId,
    );

  const existingAccount =
    await getFeeAccount(
      cleanedLearnerId,
    );

  const openingBalance =
    existingAccount
      ?.currentBalance ?? 0;

  const totalCharges =
    input.amount;

  const totalDiscounts =
    input.discountAmount;

  const netCharge =
    Math.max(
      totalCharges -
        totalDiscounts,
      0,
    );

  const closingBalance =
    openingBalance +
    netCharge;

  const existingTotalCharged =
    existingAccount
      ?.totalCharged ?? 0;

  const existingTotalPaid =
    existingAccount
      ?.totalPaid ?? 0;

  const existingOverdueBalance =
    existingAccount
      ?.overdueBalance ?? 0;

  const statementReference =
    doc(
      collection(
        firestore,
        "feeStatements",
      ),
    );

  const statementNumber =
    createStatementNumber(
      cleanedLearnerId,
      input.academicYear,
    );

  const chargeLineItem:
    FeeStatementLineItem = {
      id:
        `${statementReference.id}-charge`,

      description:
        cleanedDescription,

      type:
        "charge",

      amount:
        totalCharges,

      quantity:
        1,

      total:
        totalCharges,

      dueDate:
        Timestamp.fromDate(
          input.dueDate,
        ),
    };

  const lineItems:
    FeeStatementLineItem[] = [
      chargeLineItem,
    ];

  if (
    totalDiscounts > 0
  ) {
    lineItems.push({
      id:
        `${statementReference.id}-discount`,

      description:
        "Approved fee discount",

      type:
        "discount",

      amount:
        totalDiscounts,

      quantity:
        1,

      total:
        -totalDiscounts,

      dueDate:
        Timestamp.fromDate(
          input.dueDate,
        ),
    });
  }

  const batch =
    writeBatch(
      firestore,
    );

  batch.set(
    statementReference,
    {
      learnerId:
        cleanedLearnerId,

      parentUid,

      feeStructureId:
        input.feeStructureId
          .trim(),

      academicYear:
        input.academicYear,

      statementNumber,

      learnerFirstName:
        input.learnerFirstName
          .trim(),

      learnerLastName:
        input.learnerLastName
          .trim(),

      studentNumber:
        input.studentNumber
          .trim(),

      gradeName:
        input.gradeName
          .trim(),

      currency:
        "ZAR",

      periodStart:
        Timestamp.fromDate(
          input.periodStart,
        ),

      periodEnd:
        Timestamp.fromDate(
          input.periodEnd,
        ),

      issueDate:
        serverTimestamp(),

      dueDate:
        Timestamp.fromDate(
          input.dueDate,
        ),

      openingBalance,

      lineItems,

      totalCharges,

      totalDiscounts,

      totalPayments:
        0,

      closingBalance,

      amountDue:
        closingBalance,

      status:
        "issued",

      notes:
        input.notes.trim(),

      issuedBy:
        cleanedAdministratorUid,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );

  const accountReference =
    doc(
      firestore,
      "feeAccounts",
      cleanedLearnerId,
    );

  batch.set(
    accountReference,
    {
      learnerId:
        cleanedLearnerId,

      academicYear:
        input.academicYear,

      currency:
        "ZAR",

      totalCharged:
        existingTotalCharged +
        netCharge,

      totalPaid:
        existingTotalPaid,

      currentBalance:
        closingBalance,

      overdueBalance:
        existingOverdueBalance,

      status:
        existingOverdueBalance >
        0
          ? "outstanding"
          : "upToDate",

      lastStatementAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      updatedBy:
        cleanedAdministratorUid,
    },
  );

  /*
   * The statement and fee account must be
   * saved successfully before notification
   * creation is attempted.
   */
  await batch.commit();

  /*
   * Notification failure must not undo a
   * successfully issued fee statement.
   */
  try {
    await createAcademicFinanceNotification(
      "feeStatement",
      statementReference.id,
    );
  } catch (error) {
    console.error(
      "The fee statement was issued, but its notification could not be created:",
      error,
    );
  }

  return statementReference.id;
}