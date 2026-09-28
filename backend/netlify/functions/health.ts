import type { Handler } from "@netlify/functions";

const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success: true,
      message: "TCS PayFast backend is running.",
    }),
  };
};

export { handler };