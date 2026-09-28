import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Platform } from "react-native";

import { getTcsLogoDataUri } from "@/services/document-branding";

import type {
  FeePayment,
  FeeStatement,
  Learner,
} from "@/types/school";

type GeneratePaymentReceiptInput = {
  payment: FeePayment;
  learner: Learner;
  statement?: FeeStatement | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatReceiptDate(
  payment: FeePayment,
): string {
  const timestamp =
    payment.paidAt ??
    payment.createdAt;

  if (!timestamp) {
    return "Date unavailable";
  }

  return timestamp
    .toDate()
    .toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

function formatPaymentMethod(
  method: FeePayment["method"],
): string {
  switch (method) {
    case "eft":
      return "Electronic funds transfer";

    case "cash":
      return "Cash";

    case "card":
      return "Card";

    case "online":
      return "Online payment";

    case "adjustment":
      return "Account adjustment";

    default:
      return method;
  }
}

function buildPaymentReceiptHtml(
  {
    payment,
    learner,
    statement,
  }: GeneratePaymentReceiptInput,
  logoDataUri: string,
): string {
  const learnerName =
    `${learner.firstName} ${learner.lastName}`.trim();

  const receiptNumber =
    payment.receiptNumber ||
    payment.id;

  const reference =
    payment.providerReference ||
    "Not applicable";

  const statementNumber =
    statement?.statementNumber ||
    payment.statementId ||
    "Not available";

  const gradeName =
    learner.schoolClass?.name ||
    `Grade ${learner.currentGradeNumber}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 38px;
            color: #17233d;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.5;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 4px solid #193b66;
            padding-bottom: 20px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .logo-wrap {
            width: 72px;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #ffffff;
            border: 2px solid #f2c75c;
            border-radius: 36px;
          }

          .logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
          }

          .school-name {
            margin: 0;
            color: #193b66;
            font-size: 24px;
            font-weight: 800;
          }

          .document-title {
            margin: 5px 0 0;
            color: #667085;
            font-size: 14px;
          }

          .receipt-number {
            color: #193b66;
            font-size: 12px;
            font-weight: 700;
            text-align: right;
          }

          .success-card {
            margin-top: 24px;
            padding: 22px;
            background: #e7f4ec;
            border: 1px solid #a8d5b5;
            border-radius: 12px;
            text-align: center;
          }

          .success-label {
            color: #257442;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.7px;
            text-transform: uppercase;
          }

          .payment-amount {
            margin-top: 8px;
            color: #193b66;
            font-size: 30px;
            font-weight: 800;
          }

          .section {
            margin-top: 24px;
          }

          .section-title {
            margin: 0 0 10px;
            color: #193b66;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.7px;
            text-transform: uppercase;
          }

          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px 24px;
            padding: 18px;
            background: #f3f6fa;
            border-radius: 10px;
          }

          .label {
            color: #667085;
            font-size: 11px;
          }

          .value {
            margin-top: 2px;
            color: #17233d;
            font-weight: 700;
          }

          .description {
            padding: 16px;
            background: #fff8e7;
            border: 1px solid #ebd5a2;
            border-radius: 10px;
          }

          .footer {
            margin-top: 38px;
            padding-top: 15px;
            border-top: 1px solid #d9e0e8;
            color: #667085;
            font-size: 10px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div class="brand">
            <div class="logo-wrap">
              <img
                class="logo"
                src="${escapeHtml(logoDataUri)}"
                alt="Thabazimbi Christian School logo"
              />
            </div>

            <div>
              <h1 class="school-name">
                Thabazimbi Christian School
              </h1>

              <p class="document-title">
                Official Payment Receipt
              </p>
            </div>
          </div>

          <div class="receipt-number">
            Receipt<br />
            ${escapeHtml(receiptNumber)}
          </div>
        </div>

        <div class="success-card">
          <div class="success-label">
            Payment received
          </div>

          <div class="payment-amount">
            ${formatCurrency(payment.amount)}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            Payment information
          </h2>

          <div class="details">
            <div>
              <div class="label">Payment date</div>

              <div class="value">
                ${escapeHtml(formatReceiptDate(payment))}
              </div>
            </div>

            <div>
              <div class="label">Payment method</div>

              <div class="value">
                ${escapeHtml(
                  formatPaymentMethod(payment.method),
                )}
              </div>
            </div>

            <div>
              <div class="label">Payment reference</div>

              <div class="value">
                ${escapeHtml(reference)}
              </div>
            </div>

            <div>
              <div class="label">Statement</div>

              <div class="value">
                ${escapeHtml(statementNumber)}
              </div>
            </div>

            <div>
              <div class="label">Payment status</div>

              <div class="value">
                ${
                  payment.status === "paid" ||
                  payment.status === "recorded"
                    ? "Verified"
                    : escapeHtml(payment.status)
                }
              </div>
            </div>

            <div>
              <div class="label">Currency</div>

              <div class="value">
                South African Rand (ZAR)
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            Learner information
          </h2>

          <div class="details">
            <div>
              <div class="label">Learner</div>

              <div class="value">
                ${escapeHtml(
                  learnerName || "Unnamed learner",
                )}
              </div>
            </div>

            <div>
              <div class="label">Student number</div>

              <div class="value">
                ${escapeHtml(
                  learner.studentNumber ||
                    "Not available",
                )}
              </div>
            </div>

            <div>
              <div class="label">Grade</div>

              <div class="value">
                ${escapeHtml(gradeName)}
              </div>
            </div>

            <div>
              <div class="label">Academic year</div>

              <div class="value">
                ${
                  learner.schoolClass?.academicYear ??
                  new Date().getFullYear()
                }
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            Description
          </h2>

          <div class="description">
            ${escapeHtml(
              payment.description ||
                "School fee payment",
            )}
          </div>
        </div>

        <div class="footer">
          This receipt confirms that the payment was recorded
          and verified by Thabazimbi Christian School.
          Please retain it for your records.
        </div>
      </body>
    </html>
  `;
}

export async function generatePaymentReceipt(
  input: GeneratePaymentReceiptInput,
): Promise<"printed" | "shared" | "created"> {
  const logoDataUri =
    await getTcsLogoDataUri();

  const html =
    buildPaymentReceiptHtml(
      input,
      logoDataUri,
    );

  if (Platform.OS === "web") {
    await Print.printAsync({
      html,
    });

    return "printed";
  }

  const result =
    await Print.printToFileAsync({
      html,
    });

  const sharingAvailable =
    await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    return "created";
  }

  await Sharing.shareAsync(result.uri, {
    dialogTitle:
      "Share payment receipt",
    mimeType:
      "application/pdf",
    UTI:
      "com.adobe.pdf",
  });

  return "shared";
}
