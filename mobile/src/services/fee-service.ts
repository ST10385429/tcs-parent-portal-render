import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import type {
  FeeAccount,
  FeePayment,
  FeeStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/school";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readTimestamp(value: unknown): Timestamp | null {
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

function isFeeStatus(value: unknown): value is FeeStatus {
  return value === "upToDate" || value === "outstanding";
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "recorded" ||
    value === "refunded"
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    value === "online" ||
    value === "eft" ||
    value === "cash" ||
    value === "card" ||
    value === "adjustment"
  );
}

function getPaymentTimestampValue(payment: FeePayment): number {
  if (payment.paidAt) {
    return payment.paidAt.toMillis();
  }

  if (payment.updatedAt) {
    return payment.updatedAt.toMillis();
  }

  if (payment.createdAt) {
    return payment.createdAt.toMillis();
  }

  return 0;
}

function mapFeeAccount(
  learnerId: string,
  data: Record<string, unknown>,
): FeeAccount {
  const totalCharged = Math.max(
    readNumber(data.totalCharged),
    0,
  );

  const totalPaid = Math.max(
    readNumber(data.totalPaid),
    0,
  );

  const calculatedBalance = Math.max(
    totalCharged - totalPaid,
    0,
  );

  const currentBalance = Math.max(
    readNumber(data.currentBalance, calculatedBalance),
    0,
  );

  const overdueBalance = Math.max(
    readNumber(data.overdueBalance),
    0,
  );

  const calculatedStatus: FeeStatus =
    overdueBalance > 0 || currentBalance > 0
      ? "outstanding"
      : "upToDate";

  return {
    learnerId: readString(data.learnerId, learnerId),
    academicYear: readNumber(
      data.academicYear,
      new Date().getFullYear(),
    ),
    currency: "ZAR",
    totalCharged,
    totalPaid,
    currentBalance,
    overdueBalance,
    status: isFeeStatus(data.status)
      ? data.status
      : calculatedStatus,
    lastStatementAt: readTimestamp(data.lastStatementAt),
    updatedAt: readTimestamp(data.updatedAt),
    updatedBy: readString(data.updatedBy),
  };
}

function mapFeePayment(
  paymentId: string,
  data: Record<string, unknown>,
): FeePayment {
  return {
    id: paymentId,
    learnerId: readString(data.learnerId),
    parentUid: readString(data.parentUid),
    statementId: readString(data.statementId),
    amount: Math.max(readNumber(data.amount), 0),
    currency: "ZAR",
    method: isPaymentMethod(data.method)
      ? data.method
      : "online",
    status: isPaymentStatus(data.status)
      ? data.status
      : "pending",
    providerReference: readString(
      data.providerReference,
    ),
    receiptNumber: readString(data.receiptNumber),
    description: readString(
      data.description,
      "School fee payment",
    ),
    createdAt: readTimestamp(data.createdAt),
    updatedAt: readTimestamp(data.updatedAt),
    paidAt: readTimestamp(data.paidAt),
    recordedBy: readString(data.recordedBy),
  };
}

export async function getFeeAccount(
  learnerId: string,
): Promise<FeeAccount | null> {
  const cleanedLearnerId = learnerId.trim();

  if (!cleanedLearnerId) {
    return null;
  }

  const accountSnapshot = await getDoc(
    doc(
      firestore,
      "feeAccounts",
      cleanedLearnerId,
    ),
  );

  if (!accountSnapshot.exists()) {
    return null;
  }

  return mapFeeAccount(
    accountSnapshot.id,
    accountSnapshot.data() as Record<
      string,
      unknown
    >,
  );
}

export async function getLearnerPayments(
  learnerId: string,
): Promise<FeePayment[]> {
  const cleanedLearnerId = learnerId.trim();

  if (!cleanedLearnerId) {
    return [];
  }

  const paymentsQuery = query(
    collection(firestore, "payments"),
    where(
      "learnerId",
      "==",
      cleanedLearnerId,
    ),
  );

  const paymentsSnapshot = await getDocs(
    paymentsQuery,
  );

  return paymentsSnapshot.docs
    .map((paymentDocument) =>
      mapFeePayment(
        paymentDocument.id,
        paymentDocument.data() as Record<
          string,
          unknown
        >,
      ),
    )
    .sort(
      (firstPayment, secondPayment) =>
        getPaymentTimestampValue(secondPayment) -
        getPaymentTimestampValue(firstPayment),
    );
}

export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount)
    ? amount
    : 0;

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatFeeDate(
  timestamp: Timestamp | null,
  fallback = "No date available",
): string {
  if (!timestamp) {
    return fallback;
  }

  return timestamp.toDate().toLocaleDateString(
    "en-ZA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

export function formatPaymentDate(
  timestamp: FeePayment["paidAt"],
): string {
  return formatFeeDate(timestamp, "Pending");
}