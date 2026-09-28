type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(
  name: string,
  run: () => void,
): void {
  tests.push({
    name,
    run,
  });
}

function assertEqual(
  actual: unknown,
  expected: unknown,
): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(
        expected,
      )} but received ${String(
        actual,
      )}.`,
    );
  }
}

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
  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function roundCurrency(
  value: number,
): number {
  return Math.round(value * 100) / 100;
}

function isExpoPushToken(
  value: string,
): boolean {
  return (
    value.startsWith(
      "ExponentPushToken[",
    ) ||
    value.startsWith(
      "ExpoPushToken[",
    )
  );
}

test(
  "readString trims valid strings",
  () => {
    assertEqual(
      readString("  Parent  "),
      "Parent",
    );
  },
);

test(
  "readString returns fallback for non-string values",
  () => {
    assertEqual(
      readString(
        123,
        "Unknown",
      ),
      "Unknown",
    );
  },
);

test(
  "readNumber accepts numeric strings",
  () => {
    assertEqual(
      readNumber("125.50"),
      125.5,
    );
  },
);

test(
  "readNumber returns fallback for invalid numbers",
  () => {
    assertEqual(
      readNumber(
        "not-a-number",
        10,
      ),
      10,
    );
  },
);

test(
  "roundCurrency rounds monetary values to two decimals",
  () => {
    assertEqual(
      roundCurrency(
        123.456,
      ),
      123.46,
    );
  },
);

test(
  "ExpoPushToken format is accepted",
  () => {
    assertEqual(
      isExpoPushToken(
        "ExpoPushToken[test-token]",
      ),
      true,
    );
  },
);

test(
  "ExponentPushToken format is accepted",
  () => {
    assertEqual(
      isExpoPushToken(
        "ExponentPushToken[test-token]",
      ),
      true,
    );
  },
);

test(
  "invalid push token format is rejected",
  () => {
    assertEqual(
      isExpoPushToken(
        "invalid-token",
      ),
      false,
    );
  },
);

let passed = 0;
let failed = 0;

for (const currentTest of tests) {
  try {
    currentTest.run();

    passed += 1;

    console.log(
      `PASS: ${currentTest.name}`,
    );
  } catch (error) {
    failed += 1;

    console.error(
      `FAIL: ${currentTest.name}`,
    );

    console.error(
      error,
    );
  }
}

console.log("");
console.log(
  `Tests: ${tests.length}`,
);
console.log(
  `Passed: ${passed}`,
);
console.log(
  `Failed: ${failed}`,
);

if (failed > 0) {
  throw new Error(
    `${failed} automated test(s) failed.`,
  );
}