import { getAuth } from "firebase/auth";

import { firebaseApp } from "@/lib/firebase";

export type ContentNotificationSourceType =
  | "announcement"
  | "schoolEvent";

type ContentNotificationApiResponse = {
  success?: boolean;
  created?: number;
  existing?: number;
  error?: string;
};

export type ContentNotificationResult = {
  created: number;
  existing: number;
};

function getContentNotificationEndpoint(): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_PAYFAST_BACKEND_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "The backend URL has not been configured.",
    );
  }

  const normalizedUrl =
    configuredUrl.replace(/\/+$/, "");

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

    return `${functionsBaseUrl}/create-content-notifications`;
  }

  return `${normalizedUrl}${functionsPath}/create-content-notifications`;
}

export async function createContentNotifications(
  sourceType: ContentNotificationSourceType,
  sourceId: string,
): Promise<ContentNotificationResult> {
  const cleanedSourceId =
    sourceId.trim();

  if (!cleanedSourceId) {
    throw new Error(
      "A content identifier is required.",
    );
  }

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
      getContentNotificationEndpoint(),
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          sourceType,
          sourceId:
            cleanedSourceId,
        }),
      },
    );

  const responseText =
    await response.text();

  let result:
    ContentNotificationApiResponse =
      {};

  if (responseText) {
    try {
      result =
        JSON.parse(
          responseText,
        ) as ContentNotificationApiResponse;
    } catch {
      throw new Error(
        "The server returned an invalid response.",
      );
    }
  }

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        "The content notification could not be created.",
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