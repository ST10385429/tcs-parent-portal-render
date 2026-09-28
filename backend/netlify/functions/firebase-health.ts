import type { Handler } from "@netlify/functions";

import { adminFirestore } from "./lib/firebase-admin";

const handler: Handler = async () => {
  try {
    await adminFirestore
      .collection("users")
      .limit(1)
      .get();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message:
          "The PayFast backend is connected to Firebase.",
      }),
    };
  } catch (error) {
    console.error(
      "Firebase connection test failed:",
      error,
    );

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        message:
          "The backend could not connect to Firebase.",
      }),
    };
  }
};

export { handler };