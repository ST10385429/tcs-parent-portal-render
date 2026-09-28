import type { Handler } from "@netlify/functions";

function hasEnvironmentVariable(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

const handler: Handler = async () => {
  const requiredVariables = [
    "PAYFAST_MERCHANT_ID",
    "PAYFAST_MERCHANT_KEY",
    "PAYFAST_PASSPHRASE",
    "PAYFAST_PROCESS_URL",
    "PAYFAST_SANDBOX",
  ];

  const missingVariables = requiredVariables.filter(
    (name) => !hasEnvironmentVariable(name),
  );

  if (missingVariables.length > 0) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        message:
          "Some PayFast environment variables are missing.",
        missingVariables,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success: true,
      message:
        "The PayFast Sandbox configuration is available.",
      sandbox:
        process.env.PAYFAST_SANDBOX === "true",
    }),
  };
};

export { handler };