import {
  getAuth,
} from "firebase/auth";

import {
  firebaseApp,
} from "@/lib/firebase";

type RequestNotificationApiResponse = {
  success?: boolean;
  created?: number;
  existing?: number;
  error?: string;
};

type RequestNotificationPayload = {
  requestId: string;
  replyId?: string;
};

export type RequestNotificationResult = {
  created: number;
  existing: number;
};

function getRequestNotificationEndpoint():
  string {
  const configuredUrl =
    process.env
      .EXPO_PUBLIC_PAYFAST_BACKEND_URL
      ?.trim();

  if (!configuredUrl) {
    throw new Error(
      "The backend URL has not been configured.",
    );
  }

  const normalizedUrl =
    configuredUrl.replace(
      /\/+$/,
      "",
    );

  const functionsPath =
    "/.netlify/functions";

  const functionsPathIndex =
    normalizedUrl.indexOf(
      functionsPath,
    );

  if (functionsPathIndex >= 0) {
    const functionsBaseUrl =
      normalizedUrl.slice(
        0,
        functionsPathIndex +
          functionsPath.length,
      );

    return (
      `${functionsBaseUrl}` +
      "/create-request-notifications"
    );
  }

  return (
    `${normalizedUrl}` +
    `${functionsPath}` +
    "/create-request-notifications"
  );
}

async function callRequestNotificationApi(
  payload: RequestNotificationPayload,
): Promise<RequestNotificationResult> {
  const firebaseAuth =
    getAuth(firebaseApp);

  const signedInUser =
    firebaseAuth.currentUser;

  if (!signedInUser) {
    throw new Error(
      "You must be signed in to create notifications.",
    );
  }

  const token =
    await signedInUser.getIdToken(
      true,
    );

  const response =
    await fetch(
      getRequestNotificationEndpoint(),
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  const responseText =
    await response.text();

  let result:
    RequestNotificationApiResponse =
      {};

  if (responseText) {
    try {
      result =
        JSON.parse(
          responseText,
        ) as RequestNotificationApiResponse;
    } catch {
      throw new Error(
        "The notification server returned an invalid response.",
      );
    }
  }

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        "The request notification could not be created.",
    );
  }

  return {
    created:
      typeof result.created ===
      "number"
        ? result.created
        : 0,

    existing:
      typeof result.existing ===
      "number"
        ? result.existing
        : 0,
  };
}

export async function createRequestNotifications(
  requestId: string,
): Promise<RequestNotificationResult> {
  const cleanedRequestId =
    requestId.trim();

  if (!cleanedRequestId) {
    throw new Error(
      "A request identifier is required.",
    );
  }

  return callRequestNotificationApi({
    requestId:
      cleanedRequestId,
  });
}

export async function createRequestReplyNotifications(
  requestId: string,
  replyId: string,
): Promise<RequestNotificationResult> {
  const cleanedRequestId =
    requestId.trim();

  const cleanedReplyId =
    replyId.trim();

  if (!cleanedRequestId) {
    throw new Error(
      "A request identifier is required.",
    );
  }

  if (!cleanedReplyId) {
    throw new Error(
      "A reply identifier is required.",
    );
  }

  return callRequestNotificationApi({
    requestId:
      cleanedRequestId,

    replyId:
      cleanedReplyId,
  });
}