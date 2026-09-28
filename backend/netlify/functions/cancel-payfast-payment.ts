import type {
  Handler,
} from "@netlify/functions";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminFirestore,
} from "./lib/firebase-admin";

function readString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function requireEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function createCancellationToken(
  paymentId: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(paymentId)
    .digest("hex");
}

function tokensMatch(
  receivedToken: string,
  expectedToken: string,
): boolean {
  const receivedBuffer =
    Buffer.from(receivedToken, "utf8");

  const expectedBuffer =
    Buffer.from(expectedToken, "utf8");

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer,
  );
}

function textResponse(
  statusCode: number,
  message: string,
) {
  return {
    statusCode,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      "Content-Type":
        "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    body: message,
  };
}

function redirectToCancelledPage() {
  return {
    statusCode: 302,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Location: "/payment-cancelled.html",
    },
    body: "",
  };
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return textResponse(
      405,
      "Method not allowed.",
    );
  }

  try {
    const paymentId = readString(
      event.queryStringParameters?.paymentId,
    );

    const receivedToken = readString(
      event.queryStringParameters?.token,
    );

    if (!paymentId || !receivedToken) {
      return textResponse(
        400,
        "The payment cancellation request is incomplete.",
      );
    }

    const cancellationSecret =
      requireEnvironmentVariable(
        "PAYMENT_CANCEL_SECRET",
      );

    const expectedToken =
      createCancellationToken(
        paymentId,
        cancellationSecret,
      );

    if (
      !tokensMatch(
        receivedToken,
        expectedToken,
      )
    ) {
      console.warn(
        "PayFast cancellation rejected: invalid token.",
      );

      return textResponse(
        403,
        "The payment cancellation request is invalid.",
      );
    }

    const paymentReference =
      adminFirestore
        .collection("payments")
        .doc(paymentId);

    await adminFirestore.runTransaction(
      async (transaction) => {
        const paymentSnapshot =
          await transaction.get(
            paymentReference,
          );

        if (!paymentSnapshot.exists) {
          return;
        }

        const paymentData =
          paymentSnapshot.data();

        if (
          paymentData?.status !== "pending"
        ) {
          return;
        }

        transaction.update(
          paymentReference,
          {
            status: "cancelled",
            cancellationReason:
              "Cancelled during PayFast checkout",
            cancelledAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );
      },
    );

    console.info(
      "PayFast payment attempt cancelled.",
    );

    return redirectToCancelledPage();
  } catch (error) {
    console.error(
      "Unable to cancel PayFast payment:",
      error,
    );

    return textResponse(
      500,
      "The payment cancellation could not be processed.",
    );
  }
};

export { handler };