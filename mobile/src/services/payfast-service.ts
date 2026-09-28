import { auth } from "@/lib/firebase-auth";

type CreatePayFastPaymentResponse = {
  paymentId: string;
  checkoutUrl: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

const PAYFAST_BACKEND_URL =
  process.env.EXPO_PUBLIC_PAYFAST_BACKEND_URL?.replace(
    /\/+$/,
    "",
  );

function getErrorMessage(
  data: ErrorResponse | null,
): string {
  if (data?.error) {
    return data.error;
  }

  if (data?.message) {
    return data.message;
  }

  return "The PayFast checkout could not be created.";
}

export async function createPayFastPayment(
  statementId: string,
  amount: number,
): Promise<CreatePayFastPaymentResponse> {
  const cleanedStatementId = statementId.trim();

  if (!PAYFAST_BACKEND_URL) {
    throw new Error(
      "The PayFast backend URL has not been configured.",
    );
  }

  if (!cleanedStatementId) {
    throw new Error(
      "A valid fee statement is required.",
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "The payment amount must be greater than zero.",
    );
  }

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "You must be signed in to make a payment.",
    );
  }

  const idToken =
    await firebaseUser.getIdToken();

  const response = await fetch(
    `${PAYFAST_BACKEND_URL}/.netlify/functions/create-payfast-payment`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statementId: cleanedStatementId,
        amount,
      }),
    },
  );

  let responseData:
    | CreatePayFastPaymentResponse
    | ErrorResponse
    | null = null;

  try {
    responseData =
      (await response.json()) as
        | CreatePayFastPaymentResponse
        | ErrorResponse;
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        responseData as ErrorResponse | null,
      ),
    );
  }

  const paymentData =
    responseData as CreatePayFastPaymentResponse;

  if (
    !paymentData.paymentId ||
    !paymentData.checkoutUrl
  ) {
    throw new Error(
      "The PayFast checkout response was incomplete.",
    );
  }

  return paymentData;
}