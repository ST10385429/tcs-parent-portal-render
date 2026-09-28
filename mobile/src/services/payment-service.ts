import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import type {
  PaymentMethod,
} from "@/types/school";

export type RecordPaymentInput = {
  learnerId: string;
  parentUid: string;
  statementId: string;
  amount: number;
  method: Exclude<
    PaymentMethod,
    "online" | "adjustment"
  >;
  providerReference: string;
  description: string;
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

function createReceiptNumber(): string {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  const hours = String(
    now.getHours(),
  ).padStart(2, "0");

  const minutes = String(
    now.getMinutes(),
  ).padStart(2, "0");

  const seconds = String(
    now.getSeconds(),
  ).padStart(2, "0");

  return [
    "TCS",
    "RCT",
    year,
    `${month}${day}`,
    `${hours}${minutes}${seconds}`,
  ].join("-");
}

export async function recordVerifiedPayment(
  administratorUid: string,
  input: RecordPaymentInput,
): Promise<string> {
  const cleanedAdministratorUid =
    administratorUid.trim();

  const learnerId =
    input.learnerId.trim();

  const parentUid =
    input.parentUid.trim();

  const statementId =
    input.statementId.trim();

  const reference =
    input.providerReference.trim();

  const description =
    input.description.trim() ||
    "School fee payment";

  if (!cleanedAdministratorUid) {
    throw new Error(
      "A signed-in administrator is required.",
    );
  }

  if (!learnerId) {
    throw new Error(
      "A learner must be selected.",
    );
  }

  if (!parentUid) {
    throw new Error(
      "The learner does not have a linked parent.",
    );
  }

  if (!statementId) {
    throw new Error(
      "A statement must be selected.",
    );
  }

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      "The payment amount must be greater than zero.",
    );
  }

  if (
    input.method !== "eft" &&
    input.method !== "cash" &&
    input.method !== "card"
  ) {
    throw new Error(
      "Select a valid verified payment method.",
    );
  }

  if (
    input.method !== "cash" &&
    !reference
  ) {
    throw new Error(
      "A bank or card reference is required.",
    );
  }

  const statementReference = doc(
    firestore,
    "feeStatements",
    statementId,
  );

  const accountReference = doc(
    firestore,
    "feeAccounts",
    learnerId,
  );

  const paymentReference = doc(
    collection(
      firestore,
      "payments",
    ),
  );

  const receiptNumber =
    createReceiptNumber();

  await runTransaction(
    firestore,
    async (transaction) => {
      const [
        statementSnapshot,
        accountSnapshot,
      ] = await Promise.all([
        transaction.get(
          statementReference,
        ),
        transaction.get(
          accountReference,
        ),
      ]);

      if (!statementSnapshot.exists()) {
        throw new Error(
          "The selected statement no longer exists.",
        );
      }

      if (!accountSnapshot.exists()) {
        throw new Error(
          "The learner's fee account could not be found.",
        );
      }

      const statementData =
        statementSnapshot.data();

      const accountData =
        accountSnapshot.data();

      if (
        readString(
          statementData.learnerId,
        ) !== learnerId
      ) {
        throw new Error(
          "The selected statement does not belong to this learner.",
        );
      }

      if (
        readString(
          statementData.parentUid,
        ) !== parentUid
      ) {
        throw new Error(
          "The statement is not linked to the expected parent.",
        );
      }

      if (
        statementData.status ===
        "cancelled"
      ) {
        throw new Error(
          "A payment cannot be recorded against a cancelled statement.",
        );
      }

      if (
        statementData.status === "paid"
      ) {
        throw new Error(
          "This statement has already been paid.",
        );
      }

      const statementAmountDue =
        readNumber(
          statementData.amountDue,
        );

      if (
        statementAmountDue <= 0
      ) {
        throw new Error(
          "This statement has no amount due.",
        );
      }

      if (
        input.amount >
        statementAmountDue
      ) {
        throw new Error(
          "The payment cannot be greater than the statement amount due.",
        );
      }

      const currentBalance =
        readNumber(
          accountData.currentBalance,
        );

      const overdueBalance =
        readNumber(
          accountData.overdueBalance,
        );

      const totalPaid =
        readNumber(
          accountData.totalPaid,
        );

      const statementPayments =
        readNumber(
          statementData.totalPayments,
        );

      const newStatementAmountDue =
        Math.max(
          statementAmountDue -
            input.amount,
          0,
        );

      const newCurrentBalance =
        Math.max(
          currentBalance -
            input.amount,
          0,
        );

      const amountAppliedToOverdue =
        Math.min(
          overdueBalance,
          input.amount,
        );

      const newOverdueBalance =
        Math.max(
          overdueBalance -
            amountAppliedToOverdue,
          0,
        );

      const newStatementStatus =
        newStatementAmountDue <= 0
          ? "paid"
          : "partiallyPaid";

      const newAccountStatus =
        newOverdueBalance <= 0
          ? "upToDate"
          : "outstanding";

      transaction.set(
        paymentReference,
        {
          learnerId,
          parentUid,
          statementId,
          amount: input.amount,
          currency: "ZAR",
          method: input.method,
          status: "recorded",
          providerReference:
            reference,
          receiptNumber,
          description,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
          paidAt:
            serverTimestamp(),
          recordedBy:
            cleanedAdministratorUid,
        },
      );

      transaction.update(
        statementReference,
        {
          totalPayments:
            statementPayments +
            input.amount,
          amountDue:
            newStatementAmountDue,
          status:
            newStatementStatus,
          updatedAt:
            serverTimestamp(),
        },
      );

      transaction.update(
        accountReference,
        {
          totalPaid:
            totalPaid +
            input.amount,
          currentBalance:
            newCurrentBalance,
          overdueBalance:
            newOverdueBalance,
          status:
            newAccountStatus,
          updatedAt:
            serverTimestamp(),
          updatedBy:
            cleanedAdministratorUid,
        },
      );
    },
  );

  return paymentReference.id;
}