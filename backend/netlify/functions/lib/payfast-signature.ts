import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

export type PayFastData = Record<
  string,
  string | number | undefined | null
>;

function encodePayFastValue(
  value: string,
): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(
      /[!'()~*]/g,
      (character) =>
        `%${character
          .charCodeAt(0)
          .toString(16)
          .toUpperCase()}`,
    );
}

function createMd5Hash(
  value: string,
): string {
  return createHash("md5")
    .update(value)
    .digest("hex");
}

function signaturesMatch(
  expectedSignature: string,
  receivedSignature: string,
): boolean {
  const expectedBuffer = Buffer.from(
    expectedSignature.toLowerCase(),
    "utf8",
  );

  const receivedBuffer = Buffer.from(
    receivedSignature
      .trim()
      .toLowerCase(),
    "utf8",
  );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

export function createPayFastParameterString(
  data: PayFastData,
  passphrase?: string,
): string {
  const parameters: string[] = [];

  Object.entries(data).forEach(
    ([key, value]) => {
      if (
        key === "signature" ||
        value === undefined ||
        value === null
      ) {
        return;
      }

      const stringValue =
        String(value).trim();

      if (!stringValue) {
        return;
      }

      parameters.push(
        `${key}=${encodePayFastValue(
          stringValue,
        )}`,
      );
    },
  );

  const cleanedPassphrase =
    passphrase?.trim();

  if (cleanedPassphrase) {
    parameters.push(
      `passphrase=${encodePayFastValue(
        cleanedPassphrase,
      )}`,
    );
  }

  return parameters.join("&");
}

export function createPayFastSignature(
  data: PayFastData,
  passphrase?: string,
): string {
  const parameterString =
    createPayFastParameterString(
      data,
      passphrase,
    );

  return createMd5Hash(
    parameterString,
  );
}

export function verifyPayFastSignature(
  data: PayFastData,
  receivedSignature: string,
  passphrase?: string,
): boolean {
  const expectedSignature =
    createPayFastSignature(
      data,
      passphrase,
    );

  return signaturesMatch(
    expectedSignature,
    receivedSignature,
  );
}

export function verifyPayFastRawSignature(
  rawBody: string,
  receivedSignature: string,
  passphrase?: string,
): boolean {
  const signedParameters = rawBody
    .split("&")
    .filter((parameter) => {
      if (!parameter) {
        return false;
      }

      const separatorIndex =
        parameter.indexOf("=");

      const encodedKey =
        separatorIndex >= 0
          ? parameter.slice(
              0,
              separatorIndex,
            )
          : parameter;

      const decodedKey =
        decodeURIComponent(
          encodedKey.replace(
            /\+/g,
            "%20",
          ),
        );

      return decodedKey !== "signature";
    });

  const cleanedPassphrase =
    passphrase?.trim();

  if (cleanedPassphrase) {
    signedParameters.push(
      `passphrase=${encodePayFastValue(
        cleanedPassphrase,
      )}`,
    );
  }

  const expectedSignature =
    createMd5Hash(
      signedParameters.join("&"),
    );

  return signaturesMatch(
    expectedSignature,
    receivedSignature,
  );
}