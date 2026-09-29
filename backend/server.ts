import "dotenv/config";

import express, {
  type Request,
} from "express";
import { join } from "node:path";
import type {
  Handler,
  HandlerEvent,
} from "@netlify/functions";

import {
  handler as adminClassesHandler,
} from "./netlify/functions/admin-classes";
import {
  handler as adminLearnersHandler,
} from "./netlify/functions/admin-learners";
import {
  handler as adminLinksHandler,
} from "./netlify/functions/admin-links";
import {
  handler as adminUsersHandler,
} from "./netlify/functions/admin-users";
import {
  handler as cancelPayFastPaymentHandler,
} from "./netlify/functions/cancel-payfast-payment";
import {
  handler as academicFinanceNotificationsHandler,
} from "./netlify/functions/create-academic-finance-notifications";
import {
  handler as contentNotificationsHandler,
} from "./netlify/functions/create-content-notifications";
import {
  handler as createPayFastPaymentHandler,
} from "./netlify/functions/create-payfast-payment";
import {
  handler as requestNotificationsHandler,
} from "./netlify/functions/create-request-notifications";
import {
  handler as firebaseHealthHandler,
} from "./netlify/functions/firebase-health";
import {
  handler as healthHandler,
} from "./netlify/functions/health";
import {
  handler as openPayFastCheckoutHandler,
} from "./netlify/functions/open-payfast-checkout";
import {
  handler as payFastHealthHandler,
} from "./netlify/functions/payfast-health";
import {
  handler as payFastItnHandler,
} from "./netlify/functions/payfast-itn";

type FunctionResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

type CompatibleHandler = (
  event: HandlerEvent,
) => Promise<FunctionResponse>;

const functionHandlers: Record<string, Handler> = {
  "admin-classes": adminClassesHandler,
  "admin-learners": adminLearnersHandler,
  "admin-links": adminLinksHandler,
  "admin-users": adminUsersHandler,
  "cancel-payfast-payment": cancelPayFastPaymentHandler,
  "create-academic-finance-notifications":
    academicFinanceNotificationsHandler,
  "create-content-notifications":
    contentNotificationsHandler,
  "create-payfast-payment":
    createPayFastPaymentHandler,
  "create-request-notifications":
    requestNotificationsHandler,
  "firebase-health": firebaseHealthHandler,
  health: healthHandler,
  "open-payfast-checkout":
    openPayFastCheckoutHandler,
  "payfast-health": payFastHealthHandler,
  "payfast-itn": payFastItnHandler,
};

function getHeaders(
  request: Request,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (
    const [name, value] of Object.entries(
      request.headers,
    )
  ) {
    if (typeof value === "string") {
      headers[name] = value;
    } else if (Array.isArray(value)) {
      headers[name] = value.join(", ");
    }
  }

  return headers;
}

function createNetlifyEvent(
  request: Request,
): HandlerEvent {
  const host =
    request.get("host") ??
    `localhost:${process.env.PORT ?? "10000"}`;

  const rawUrl =
    `${request.protocol}://${host}` +
    request.originalUrl;

  const parsedUrl = new URL(rawUrl);

  const queryStringParameters =
    Object.fromEntries(
      parsedUrl.searchParams.entries(),
    );

  const body = Buffer.isBuffer(request.body)
    ? request.body.toString("utf8")
    : typeof request.body === "string"
      ? request.body
      : null;

  return {
    httpMethod: request.method,
    headers: getHeaders(request),
    queryStringParameters:
      Object.keys(queryStringParameters).length > 0
        ? queryStringParameters
        : null,
    body,
    isBase64Encoded: false,
    rawUrl,
    path: parsedUrl.pathname,
  } as HandlerEvent;
}

async function invokeHandler(
  handler: Handler,
  event: HandlerEvent,
): Promise<FunctionResponse> {
  return (
    handler as unknown as CompatibleHandler
  )(event);
}

const app = express();

app.set("trust proxy", 1);

app.use((request, response, next) => {
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*",
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.use(
  express.raw({
    type: "*/*",
    limit: "1mb",
  }),
);

app.all(
  "/.netlify/functions/:functionName",
  async (request, response) => {
    const handler =
      functionHandlers[
        request.params.functionName
      ];

    if (!handler) {
      response.status(404).json({
        success: false,
        message: "Function not found.",
      });
      return;
    }

    try {
      const result = await invokeHandler(
        handler,
        createNetlifyEvent(request),
      );

      for (
        const [name, value] of Object.entries(
          result.headers ?? {},
        )
      ) {
        response.setHeader(name, value);
      }

      response
        .status(result.statusCode)
        .send(result.body ?? "");
    } catch (error) {
      console.error(
        `Function ${request.params.functionName} failed:`,
        error,
      );

      response.status(500).json({
        success: false,
        message:
          "The backend could not process this request.",
      });
    }
  },
);

app.use(
  express.static(
    join(process.cwd(), "public"),
    { index: false },
  ),
);

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "TCS Parent Portal backend is running.",
  });
});

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

const requestedPort = Number.parseInt(
  process.env.PORT ?? "10000",
  10,
);

const port =
  Number.isInteger(requestedPort) &&
  requestedPort > 0
    ? requestedPort
    : 10000;

app.listen(port, "0.0.0.0", () => {
  console.log(
    `TCS backend listening on port ${port}.`,
  );
});