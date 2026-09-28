import type {
  Handler,
} from "@netlify/functions";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminFirestore,
} from "./lib/firebase-admin";

import {
  sendExpoPushNotification,
} from "./lib/expo-push";

import {
  verifyPayFastRawSignature,
  type PayFastData,
} from "./lib/payfast-signature";

function textResponse(
  statusCode: number,
  message: string,
) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type":
        "text/plain; charset=utf-8",
    },
    body: message,
  };
}

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function roundCurrency(
  value: number,
): number {
  return Math.round(value * 100) / 100;
}

function requireEnvironmentVariable(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function getRawRequestBody(
  body: string | null,
  isBase64Encoded: boolean,
): string {
  const receivedBody =
    body ?? "";

  if (!isBase64Encoded) {
    return receivedBody;
  }

  return Buffer.from(
    receivedBody,
    "base64",
  ).toString("utf8");
}

function parsePayFastBody(
  rawBody: string,
): PayFastData {
  const parameters =
    new URLSearchParams(
      rawBody,
    );

  const result:
    PayFastData = {};

  parameters.forEach(
    (value, key) => {
      result[key] =
        value;
    },
  );

  return result;
}

function getValidationUrl(): string {
  return process.env.PAYFAST_SANDBOX ===
    "true"
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";
}

async function validateWithPayFast(
  rawBody: string,
): Promise<boolean> {
  const response =
    await fetch(
      getValidationUrl(),
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          rawBody,
      },
    );

  if (!response.ok) {
    console.warn(
      "PayFast ITN validation endpoint returned:",
      response.status,
    );

    return false;
  }

  const responseText =
    (
      await response.text()
    )
      .trim()
      .toUpperCase();

  return (
    responseText ===
    "VALID"
  );
}

const handler: Handler =
  async (event) => {
    if (
      event.httpMethod !==
      "POST"
    ) {
      console.warn(
        "PayFast ITN rejected: unsupported HTTP method.",
      );

      return textResponse(
        405,
        "Method not allowed",
      );
    }

    try {
      const rawBody =
        getRawRequestBody(
          event.body,
          event.isBase64Encoded,
        );

      if (!rawBody) {
        console.warn(
          "PayFast ITN rejected: missing notification body.",
        );

        return textResponse(
          400,
          "Missing notification body",
        );
      }

      const payFastData =
        parsePayFastBody(
          rawBody,
        );

      const receivedSignature =
        readString(
          payFastData.signature,
        );

      if (!receivedSignature) {
        console.warn(
          "PayFast ITN rejected: missing signature.",
        );

        return textResponse(
          400,
          "Missing signature",
        );
      }

      const merchantId =
        requireEnvironmentVariable(
          "PAYFAST_MERCHANT_ID",
        );

      const passphrase =
        requireEnvironmentVariable(
          "PAYFAST_PASSPHRASE",
        );

      if (
        readString(
          payFastData.merchant_id,
        ) !== merchantId
      ) {
        console.warn(
          "PayFast ITN rejected: merchant ID mismatch.",
        );

        return textResponse(
          400,
          "Invalid merchant",
        );
      }

      const signatureIsValid =
        verifyPayFastRawSignature(
          rawBody,
          receivedSignature,
          passphrase,
        );

      if (!signatureIsValid) {
        console.warn(
          "PayFast ITN rejected: invalid signature.",
        );

        return textResponse(
          400,
          "Invalid signature",
        );
      }

      const payFastIsValid =
        await validateWithPayFast(
          rawBody,
        );

      if (!payFastIsValid) {
        console.warn(
          "PayFast ITN rejected: PayFast validation failed.",
        );

        return textResponse(
          400,
          "PayFast validation failed",
        );
      }

      const paymentId =
        readString(
          payFastData.m_payment_id,
        );

      if (!paymentId) {
        console.warn(
          "PayFast ITN rejected: missing payment reference.",
        );

        return textResponse(
          400,
          "Missing payment reference",
        );
      }

      const paymentReference =
        adminFirestore
          .collection(
            "payments",
          )
          .doc(
            paymentId,
          );

      const paymentSnapshot =
        await paymentReference.get();

      if (
        !paymentSnapshot.exists
      ) {
        console.warn(
          "PayFast ITN rejected: payment record not found.",
        );

        return textResponse(
          404,
          "Payment not found",
        );
      }

      const paymentData =
        paymentSnapshot.data();

      if (!paymentData) {
        console.warn(
          "PayFast ITN rejected: payment data unavailable.",
        );

        return textResponse(
          404,
          "Payment unavailable",
        );
      }

      /*
       * PayFast may retry an ITN.
       *
       * A payment that has already
       * been processed must not be
       * applied to the account again.
       */
      if (
        paymentData.status ===
        "paid"
      ) {
        console.info(
          "PayFast ITN already processed.",
        );

        return textResponse(
          200,
          "OK",
        );
      }

      if (
        paymentData.status !==
        "pending"
      ) {
        console.warn(
          "PayFast ITN rejected: payment is not pending.",
        );

        return textResponse(
          400,
          "Payment is not pending",
        );
      }

      const expectedAmount =
        roundCurrency(
          readNumber(
            paymentData.amount,
          ),
        );

      const paidAmount =
        roundCurrency(
          readNumber(
            payFastData.amount_gross,
          ),
        );

      if (
        expectedAmount <= 0 ||
        paidAmount !==
          expectedAmount
      ) {
        console.warn(
          "PayFast ITN rejected: payment amount mismatch.",
        );

        return textResponse(
          400,
          "Payment amount mismatch",
        );
      }

      const paymentStatus =
        readString(
          payFastData.payment_status,
        ).toUpperCase();

      /*
       * PayFast can notify the backend
       * about unsuccessful payment
       * attempts as well.
       */
      if (
        paymentStatus !==
        "COMPLETE"
      ) {
        await paymentReference.update(
          {
            status:
              paymentStatus ===
              "FAILED"
                ? "failed"
                : "cancelled",

            providerReference:
              readString(
                payFastData.pf_payment_id,
              ),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        console.info(
          "PayFast ITN processed a non-complete payment.",
        );

        return textResponse(
          200,
          "OK",
        );
      }

      const learnerId =
        readString(
          paymentData.learnerId,
        );

      const parentUid =
        readString(
          paymentData.parentUid,
        );

      const statementId =
        readString(
          paymentData.statementId,
        );

      if (
        !learnerId ||
        !parentUid ||
        !statementId
      ) {
        console.warn(
          "PayFast ITN rejected: incomplete payment record.",
        );

        return textResponse(
          400,
          "Incomplete payment record",
        );
      }

      /*
       * These custom PayFast values
       * were supplied when the payment
       * was initiated.
       *
       * They must still match the
       * trusted Firestore payment.
       */
      const customStatementId =
        readString(
          payFastData.custom_str1,
        );

      const customLearnerId =
        readString(
          payFastData.custom_str2,
        );

      const customParentUid =
        readString(
          payFastData.custom_str3,
        );

      if (
        customStatementId !==
          statementId ||
        customLearnerId !==
          learnerId ||
        customParentUid !==
          parentUid
      ) {
        console.warn(
          "PayFast ITN rejected: payment details mismatch.",
        );

        return textResponse(
          400,
          "Payment details mismatch",
        );
      }

      const statementReference =
        adminFirestore
          .collection(
            "feeStatements",
          )
          .doc(
            statementId,
          );

      const accountReference =
        adminFirestore
          .collection(
            "feeAccounts",
          )
          .doc(
            learnerId,
          );

      /*
       * A deterministic notification
       * ID prevents duplicate payment
       * notifications if PayFast sends
       * the same ITN more than once.
       */
      const paymentNotificationReference =
        adminFirestore
          .collection(
            "notifications",
          )
          .doc(
            `payment_${paymentId}_paid_${parentUid}`,
          );

      /*
       * Payment, statement, fee
       * account and notification are
       * handled in one Firestore
       * transaction.
       */
      const paymentNotificationCreated =
      await adminFirestore.runTransaction(
        async (
          transaction,
        ) => {
          const [
            currentPaymentSnapshot,
            statementSnapshot,
            accountSnapshot,
            paymentNotificationSnapshot,
          ] =
            await Promise.all([
              transaction.get(
                paymentReference,
              ),

              transaction.get(
                statementReference,
              ),

              transaction.get(
                accountReference,
              ),

              transaction.get(
                paymentNotificationReference,
              ),
            ]);

          if (
            !currentPaymentSnapshot.exists ||
            !statementSnapshot.exists ||
            !accountSnapshot.exists
          ) {
            throw new Error(
              "Required financial records are missing.",
            );
          }

          const currentPayment =
            currentPaymentSnapshot.data();

          const statement =
            statementSnapshot.data();

          const account =
            accountSnapshot.data();

          if (
            !currentPayment ||
            !statement ||
            !account
          ) {
            throw new Error(
              "Required financial data is unavailable.",
            );
          }

          /*
           * Transaction-level
           * idempotency protects
           * against concurrent ITN
           * processing.
           */
          if (
            currentPayment.status ===
            "paid"
          ) {
          return false;
}

          if (
            currentPayment.status !==
            "pending"
          ) {
            throw new Error(
              "The payment is no longer pending.",
            );
          }

          if (
            readString(
              statement.learnerId,
            ) !== learnerId ||
            readString(
              statement.parentUid,
            ) !== parentUid
          ) {
            throw new Error(
              "The statement does not match the payment.",
            );
          }

          const amountDue =
            roundCurrency(
              readNumber(
                statement.amountDue,
              ),
            );

          if (
            paidAmount >
            amountDue
          ) {
            throw new Error(
              "The payment exceeds the statement balance.",
            );
          }

          const totalPayments =
            roundCurrency(
              readNumber(
                statement.totalPayments,
              ),
            );

          const currentBalance =
            roundCurrency(
              readNumber(
                account.currentBalance,
              ),
            );

          const overdueBalance =
            roundCurrency(
              readNumber(
                account.overdueBalance,
              ),
            );

          const totalPaid =
            roundCurrency(
              readNumber(
                account.totalPaid,
              ),
            );

          const newAmountDue =
            roundCurrency(
              Math.max(
                amountDue -
                  paidAmount,
                0,
              ),
            );

          const newCurrentBalance =
            roundCurrency(
              Math.max(
                currentBalance -
                  paidAmount,
                0,
              ),
            );

          const overduePaymentAmount =
            Math.min(
              overdueBalance,
              paidAmount,
            );

          const newOverdueBalance =
            roundCurrency(
              Math.max(
                overdueBalance -
                  overduePaymentAmount,
                0,
              ),
            );

          const newStatementStatus =
            newAmountDue <= 0
              ? "paid"
              : "partiallyPaid";

          const newAccountStatus =
            newOverdueBalance <= 0
              ? "upToDate"
              : "outstanding";

          const providerReference =
            readString(
              payFastData.pf_payment_id,
            );

          /*
           * Mark the trusted payment
           * as completed.
           */
          transaction.update(
            paymentReference,
            {
              status:
                "paid",

              providerReference,

              receiptNumber:
                providerReference,

              updatedAt:
                FieldValue.serverTimestamp(),

              paidAt:
                FieldValue.serverTimestamp(),

              recordedBy:
                "payfast",
            },
          );

          /*
           * Apply the payment to the
           * relevant statement.
           */
          transaction.update(
            statementReference,
            {
              totalPayments:
                roundCurrency(
                  totalPayments +
                    paidAmount,
                ),

              amountDue:
                newAmountDue,

              status:
                newStatementStatus,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
          );

          /*
           * Apply the payment to the
           * learner's overall fee
           * account.
           */
          transaction.update(
            accountReference,
            {
              totalPaid:
                roundCurrency(
                  totalPaid +
                    paidAmount,
                ),

              currentBalance:
                newCurrentBalance,

              overdueBalance:
                newOverdueBalance,

              status:
                newAccountStatus,

              updatedAt:
                FieldValue.serverTimestamp(),

              updatedBy:
                "payfast",
            },
          );

          /*
           * Create the parent's
           * notification only if this
           * payment has not already
           * produced one.
           */
          if (
            !paymentNotificationSnapshot.exists
          ) {
            transaction.set(
              paymentNotificationReference,
              {
                recipientUid:
                  parentUid,

                recipientRole:
                  "parent",

                category:
                  "fees",

                title:
                  "Payment Received",

                body:
                  `Your payment of R${paidAmount.toFixed(
                    2,
                  )} has been received successfully.`,

                sourceType:
                  "payment",

                sourceId:
                  paymentId,

                resourceId:
                  paymentId,

                route:
                  "/parent/fees",

                read:
                  false,

                readAt:
                  null,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp(),
              },
            );
          }
          return !paymentNotificationSnapshot.exists;
        },
      );

            if (paymentNotificationCreated) {
        await sendExpoPushNotification({
          recipientUid:
            parentUid,

          title:
            "Payment Received",

          body:
            `Your payment of R${paidAmount.toFixed(
              2,
            )} has been received successfully.`,

          category:
            "fees",

          route:
            "/parent/fees",

          sourceType:
            "payment",

          sourceId:
            paymentId,

          resourceId:
            paymentId,
        });
      }

      console.info(
        "PayFast ITN payment completed successfully.",
      );

      return textResponse(
        200,
        "OK",
      );
    } catch (error) {
      console.error(
        "Unable to process PayFast ITN:",
        error,
      );

      return textResponse(
        500,
        "Unable to process notification",
      );
    }
  };

export {
  handler,
};