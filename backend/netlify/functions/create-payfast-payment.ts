import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminFirestore,
} from "./lib/firebase-admin";

type CreatePaymentBody = {
  statementId?: unknown;
  amount?: unknown;
};

function jsonResponse(
  statusCode: number,
  body: Record<string, unknown>,
) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization",
      "Access-Control-Allow-Methods":
        "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function readString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
}

function roundCurrency(
  value: number,
): number {
  return Math.round(value * 100) / 100;
}

function getBearerToken(
  event: HandlerEvent,
): string {
  const authorization =
    event.headers.authorization ??
    event.headers.Authorization ??
    "";

  if (
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    return "";
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

function getBackendOrigin(
  event: HandlerEvent,
): string {
  const configuredUrl =
  process.env.PUBLIC_BACKEND_URL?.trim() ||
  process.env.URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/$/,
      "",
    );
  }

  if (event.rawUrl) {
    return new URL(
      event.rawUrl,
    ).origin;
  }

  return "http://localhost:8888";
}

const handler: Handler = async (
  event,
) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const idToken =
      getBearerToken(event);

    if (!idToken) {
      return jsonResponse(401, {
        success: false,
        message:
          "A signed-in parent is required.",
      });
    }

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken,
      );

    const parentUid =
      decodedToken.uid;

    let requestBody:
      CreatePaymentBody;

    try {
      requestBody = JSON.parse(
        event.body ?? "{}",
      ) as CreatePaymentBody;
    } catch {
      return jsonResponse(400, {
        success: false,
        message:
          "The payment request is invalid.",
      });
    }

    const statementId = readString(
      requestBody.statementId,
    );

    if (!statementId) {
      return jsonResponse(400, {
        success: false,
        message:
          "A fee statement must be selected.",
      });
    }

    const statementReference =
      adminFirestore
        .collection("feeStatements")
        .doc(statementId);

    const statementSnapshot =
      await statementReference.get();

    if (!statementSnapshot.exists) {
      return jsonResponse(404, {
        success: false,
        message:
          "The selected fee statement could not be found.",
      });
    }

    const statementData =
      statementSnapshot.data();

    if (!statementData) {
      return jsonResponse(404, {
        success: false,
        message:
          "The selected fee statement is unavailable.",
      });
    }

    const statementParentUid =
      readString(
        statementData.parentUid,
      );

    if (
      statementParentUid !== parentUid
    ) {
      return jsonResponse(403, {
        success: false,
        message:
          "You do not have permission to pay this statement.",
      });
    }

    const statementStatus =
      readString(
        statementData.status,
      );

    if (
      statementStatus === "paid" ||
      statementStatus === "cancelled" ||
      statementStatus === "draft"
    ) {
      return jsonResponse(400, {
        success: false,
        message:
          "This statement is not available for payment.",
      });
    }

    const amountDue =
      roundCurrency(
        readNumber(
          statementData.amountDue,
        ),
      );

    if (amountDue <= 0) {
      return jsonResponse(400, {
        success: false,
        message:
          "This statement has no outstanding amount.",
      });
    }

    const requestedAmount =
      requestBody.amount === undefined
        ? amountDue
        : roundCurrency(
            readNumber(
              requestBody.amount,
            ),
          );

    if (requestedAmount <= 0) {
      return jsonResponse(400, {
        success: false,
        message:
          "The payment amount must be greater than zero.",
      });
    }

    if (requestedAmount > amountDue) {
      return jsonResponse(400, {
        success: false,
        message:
          "The payment cannot exceed the statement amount due.",
      });
    }

    const learnerId = readString(
      statementData.learnerId,
    );

    if (!learnerId) {
      return jsonResponse(400, {
        success: false,
        message:
          "The statement does not contain a learner ID.",
      });
    }

    const paymentReference =
      adminFirestore
        .collection("payments")
        .doc();

    await paymentReference.set({
      learnerId,
      parentUid,
      statementId,
      amount: requestedAmount,
      currency: "ZAR",
      method: "online",
      status: "pending",
      providerReference: "",
      receiptNumber: "",
      description: `School fees - ${
        readString(
          statementData.statementNumber,
        ) || statementId
      }`,
      createdAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
      paidAt: null,
      recordedBy: "payfast",
    });

    const backendOrigin =
      getBackendOrigin(event);

    const checkoutUrl =
      `${backendOrigin}` +
      "/.netlify/functions/" +
      "open-payfast-checkout" +
      `?paymentId=${encodeURIComponent(
        paymentReference.id,
      )}`;

    return jsonResponse(201, {
      success: true,
      message:
        "The PayFast payment was created.",
      paymentId:
        paymentReference.id,
      checkoutUrl,
    });
  } catch (error) {
    console.error(
      "Unable to create PayFast payment:",
      error,
    );

    return jsonResponse(500, {
      success: false,
      message:
        "The payment could not be created. Please try again.",
    });
  }
};

export { handler };