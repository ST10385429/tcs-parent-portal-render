import { getAuth } from "firebase/auth";

import { firebaseApp } from "@/lib/firebase";

export type AcademicFinanceNotificationSourceType =
  | "subjectResult"
  | "termReport"
  | "feeStatement";

type AcademicFinanceNotificationApiResponse = {
  success?: boolean;
  created?: number;
  existing?: number;
  error?: string;
};

export type AcademicFinanceNotificationResult = {
  created: number;
  existing: number;
};

function getNotificationEndpoint(): string {
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

    return `${functionsBaseUrl}/create-academic-finance-notifications`;
  }

  return `${normalizedUrl}${functionsPath}/create-academic-finance-notifications`;
}

export async function createAcademicFinanceNotification(
  sourceType:
    AcademicFinanceNotificationSourceType,
  sourceId: string,
): Promise<AcademicFinanceNotificationResult> {
  const cleanedSourceId =
    sourceId.trim();

  if (!cleanedSourceId) {
    throw new Error(
      "A notification source identifier is required.",
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
      getNotificationEndpoint(),
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
    AcademicFinanceNotificationApiResponse =
      {};

  if (responseText) {
    try {
      result =
        JSON.parse(
          responseText,
        ) as AcademicFinanceNotificationApiResponse;
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
        "The notification could not be created.",
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