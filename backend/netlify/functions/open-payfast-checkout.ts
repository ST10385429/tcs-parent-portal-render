import type {
  Handler,
} from "@netlify/functions";

import {
  createHmac,
} from "node:crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminFirestore,
} from "./lib/firebase-admin";

import {
  createPayFastSignature,
  type PayFastData,
} from "./lib/payfast-signature";

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
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
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

function getPublicBackendUrl(): string {
  const configuredUrl =
    requireEnvironmentVariable(
      "PUBLIC_BACKEND_URL",
    ).replace(/\/+$/, "");

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error(
      "PUBLIC_BACKEND_URL must be a valid URL.",
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(
      "PUBLIC_BACKEND_URL must use HTTPS.",
    );
  }

  return parsedUrl.origin;
}

function createCancellationToken(
  paymentId: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(paymentId)
    .digest("hex");
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlResponse(
  statusCode: number,
  body: string,
) {
  return {
    statusCode,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      "Content-Type":
        "text/html; charset=utf-8",
      "X-Content-Type-Options":
        "nosniff",
    },
    body,
  };
}

function createErrorPage(
  message: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>Payment unavailable</title>

  <style>
    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      background: #f4f7f6;
      color: #17352d;
      font-family: Arial, sans-serif;
    }

    main {
      width: 100%;
      max-width: 480px;
      padding: 32px;
      box-sizing: border-box;
      border-radius: 18px;
      background: #ffffff;
      box-shadow:
        0 12px 35px
        rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    h1 {
      margin-top: 0;
      color: #b42318;
    }

    p {
      line-height: 1.6;
    }
  </style>
</head>

<body>
  <main>
    <h1>Payment unavailable</h1>

    <p>${escapeHtml(message)}</p>

    <p>
      You may close this page and return to the
      TCS Parent Portal.
    </p>
  </main>
</body>
</html>`;
}

function createCheckoutPage(
  processUrl: string,
  paymentData: PayFastData,
): string {
  const hiddenInputs = Object.entries(
    paymentData,
  )
    .filter(
      (
        entry,
      ): entry is [
        string,
        string | number,
      ] =>
        entry[1] !== undefined &&
        entry[1] !== null,
    )
    .map(([name, value]) => {
      return `<input
        type="hidden"
        name="${escapeHtml(name)}"
        value="${escapeHtml(String(value))}"
      />`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>Opening PayFast</title>

  <style>
    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      background: #f4f7f6;
      color: #17352d;
      font-family: Arial, sans-serif;
    }

    main {
      width: 100%;
      max-width: 480px;
      padding: 32px;
      box-sizing: border-box;
      border-radius: 18px;
      background: #ffffff;
      box-shadow:
        0 12px 35px
        rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    h1 {
      margin-top: 0;
    }

    p {
      line-height: 1.6;
    }

    button {
      width: 100%;
      min-height: 50px;
      margin-top: 16px;
      border: 0;
      border-radius: 12px;
      background: #17352d;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>

<body>
  <main>
    <h1>Opening PayFast</h1>

    <p>
      Please wait while you are securely redirected
      to PayFast Sandbox.
    </p>

    <form
      id="payfast-form"
      method="post"
      action="${escapeHtml(processUrl)}"
    >
      ${hiddenInputs}

      <button type="submit">
        Continue to PayFast
      </button>
    </form>
  </main>

  <script>
    window.setTimeout(function () {
      document
        .getElementById("payfast-form")
        .submit();
    }, 500);
  </script>
</body>
</html>`;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return htmlResponse(
      405,
      createErrorPage(
        "Method not allowed.",
      ),
    );
  }

  try {
    const paymentId = readString(
      event.queryStringParameters
        ?.paymentId,
    );

    if (!paymentId) {
      return htmlResponse(
        400,
        createErrorPage(
          "A payment reference was not provided.",
        ),
      );
    }

    const merchantId =
      requireEnvironmentVariable(
        "PAYFAST_MERCHANT_ID",
      );

    const merchantKey =
      requireEnvironmentVariable(
        "PAYFAST_MERCHANT_KEY",
      );

    const passphrase =
      requireEnvironmentVariable(
        "PAYFAST_PASSPHRASE",
      );

    const processUrl =
      requireEnvironmentVariable(
        "PAYFAST_PROCESS_URL",
      );

    const cancellationSecret =
      requireEnvironmentVariable(
        "PAYMENT_CANCEL_SECRET",
      );

    const paymentReference =
      adminFirestore
        .collection("payments")
        .doc(paymentId);

    const paymentSnapshot =
      await paymentReference.get();

    if (!paymentSnapshot.exists) {
      return htmlResponse(
        404,
        createErrorPage(
          "The selected payment could not be found.",
        ),
      );
    }

    const payment =
      paymentSnapshot.data();

    if (!payment) {
      return htmlResponse(
        404,
        createErrorPage(
          "The selected payment is unavailable.",
        ),
      );
    }

    if (payment.status !== "pending") {
      return htmlResponse(
        400,
        createErrorPage(
          "This payment is no longer pending.",
        ),
      );
    }

    const amount = readNumber(
      payment.amount,
    );

    if (amount <= 0) {
      return htmlResponse(
        400,
        createErrorPage(
          "The payment amount is invalid.",
        ),
      );
    }

    const statementId = readString(
      payment.statementId,
    );

    const learnerId = readString(
      payment.learnerId,
    );

    const parentUid = readString(
      payment.parentUid,
    );

    if (
      !statementId ||
      !learnerId ||
      !parentUid
    ) {
      return htmlResponse(
        400,
        createErrorPage(
          "The payment record is incomplete.",
        ),
      );
    }

    const backendOrigin =
      getPublicBackendUrl();

    const cancellationToken =
      createCancellationToken(
        paymentId,
        cancellationSecret,
      );

    const returnUrl =
      `${backendOrigin}/payment-success.html`;

    const cancelUrl =
      `${backendOrigin}` +
      "/.netlify/functions/" +
      "cancel-payfast-payment" +
      `?paymentId=${encodeURIComponent(
        paymentId,
      )}` +
      `&token=${encodeURIComponent(
        cancellationToken,
      )}`;

    const notifyUrl =
      `${backendOrigin}` +
      "/.netlify/functions/payfast-itn";

    const description = readString(
      payment.description,
      "TCS school fee payment",
    ).slice(0, 100);

    const paymentData: PayFastData = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: "TCS School Fees",
      item_description: description,
      custom_str1: statementId,
      custom_str2: learnerId,
      custom_str3: parentUid,
    };

    paymentData.signature =
      createPayFastSignature(
        paymentData,
        passphrase,
      );

    await paymentReference.update({
      checkoutOpenedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return htmlResponse(
      200,
      createCheckoutPage(
        processUrl,
        paymentData,
      ),
    );
  } catch (error) {
    console.error(
      "Unable to open PayFast checkout:",
      error,
    );

    return htmlResponse(
      500,
      createErrorPage(
        "The PayFast checkout could not be opened. Please try again.",
      ),
    );
  }
};

export { handler };