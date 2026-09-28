import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Platform } from "react-native";

import { getTcsLogoDataUri } from "@/services/document-branding";

import type {
  TermReport,
} from "@/types/school";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusLabel(
  status: TermReport["status"],
): string {
  switch (status) {
    case "approved":
      return "Approved";

    case "withheld":
      return "Withheld";

    default:
      return "Draft";
  }
}

function getPerformanceLabel(
  averageMark: number,
): string {
  if (averageMark >= 80) {
    return "Outstanding achievement";
  }

  if (averageMark >= 70) {
    return "Strong achievement";
  }

  if (averageMark >= 60) {
    return "Good achievement";
  }

  if (averageMark >= 50) {
    return "Satisfactory achievement";
  }

  return "Additional support recommended";
}

function buildAcademicReportHtml(
  report: TermReport,
  logoDataUri: string,
): string {
  const learnerName =
    `${report.learnerFirstName} ${report.learnerLastName}`.trim();

  const subjectRows = report.subjects
    .map(
      (subject) => `
        <tr>
          <td>
            <div class="subject-name">
              ${escapeHtml(subject.subject)}
            </div>

            <div class="subject-comment">
              ${escapeHtml(
                subject.comments ||
                  "No teacher comment provided.",
              )}
            </div>
          </td>

          <td class="mark">
            ${subject.mark}%
          </td>
        </tr>
      `,
    )
    .join("");

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
            align-items: center;
            border-bottom: 4px solid #172b4d;
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
            color: #172b4d;
            font-size: 24px;
            font-weight: 800;
          }

          .document-title {
            margin: 5px 0 0;
            color: #667085;
            font-size: 14px;
          }

          .status {
            padding: 8px 12px;
            color: #257a4b;
            background: #e7f4ec;
            border: 1px solid #b8ddc6;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .report-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: 24px;
          }

          .eyebrow {
            color: #667085;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
          }

          .term-title {
            margin-top: 4px;
            color: #172b4d;
            font-size: 22px;
            font-weight: 800;
          }

          .learner-card {
            margin-top: 20px;
            padding: 18px;
            background: #eef2f7;
            border-radius: 12px;
          }

          .learner-name {
            color: #172b4d;
            font-size: 20px;
            font-weight: 800;
          }

          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px 24px;
            margin-top: 14px;
          }

          .label {
            color: #667085;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .value {
            margin-top: 2px;
            color: #17233d;
            font-weight: 700;
          }

          .section-title {
            margin: 26px 0 10px;
            color: #172b4d;
            font-size: 15px;
            font-weight: 800;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th {
            padding: 11px 12px;
            color: #ffffff;
            background: #172b4d;
            font-size: 10px;
            letter-spacing: 0.7px;
            text-align: left;
          }

          td {
            padding: 12px;
            border: 1px solid #d8dee8;
            vertical-align: top;
          }

          .subject-name {
            font-weight: 800;
          }

          .subject-comment {
            margin-top: 4px;
            color: #667085;
            font-size: 11px;
          }

          .mark {
            width: 85px;
            color: #172b4d;
            font-size: 16px;
            font-weight: 800;
            text-align: center;
          }

          .average-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 18px;
            padding: 18px;
            background: #eef2f7;
            border-radius: 12px;
          }

          .average-value {
            color: #172b4d;
            font-size: 30px;
            font-weight: 800;
          }

          .performance {
            color: #667085;
            font-size: 11px;
          }

          .comment-card {
            margin-top: 20px;
            padding: 16px;
            background: #f7f8fa;
            border: 1px solid #d8dee8;
            border-radius: 12px;
          }

          .comment {
            margin-top: 6px;
          }

          .footer {
            margin-top: 30px;
            padding-top: 14px;
            border-top: 1px solid #d8dee8;
            color: #667085;
            font-size: 10px;
          }

          .footer-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
          }

          .reference {
            word-break: break-all;
            text-align: right;
          }

          .verification {
            margin-top: 12px;
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
                Learner Academic Report
              </p>
            </div>
          </div>

          <div class="status">
            ${escapeHtml(getStatusLabel(report.status))}
          </div>
        </div>

        <div class="report-heading">
          <div>
            <div class="eyebrow">
              ACADEMIC REPORT
            </div>

            <div class="term-title">
              Term ${report.term}, ${report.academicYear}
            </div>
          </div>
        </div>

        <div class="learner-card">
          <div class="eyebrow">
            LEARNER INFORMATION
          </div>

          <div class="learner-name">
            ${escapeHtml(learnerName || "Unnamed learner")}
          </div>

          <div class="details">
            <div>
              <div class="label">Student number</div>
              <div class="value">
                ${escapeHtml(report.studentNumber || "Not available")}
              </div>
            </div>

            <div>
              <div class="label">Class</div>
              <div class="value">
                ${escapeHtml(report.className || "Not available")}
              </div>
            </div>

            <div>
              <div class="label">Academic year</div>
              <div class="value">${report.academicYear}</div>
            </div>

            <div>
              <div class="label">Term</div>
              <div class="value">${report.term}</div>
            </div>
          </div>
        </div>

        <h2 class="section-title">
          Academic results
        </h2>

        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th class="mark">Mark</th>
            </tr>
          </thead>

          <tbody>
            ${subjectRows}
          </tbody>
        </table>

        <div class="average-card">
          <div>
            <div class="eyebrow">
              OVERALL AVERAGE
            </div>

            <div class="performance">
              ${escapeHtml(
                getPerformanceLabel(report.averageMark),
              )}
            </div>
          </div>

          <div class="average-value">
            ${report.averageMark}%
          </div>
        </div>

        <div class="comment-card">
          <div class="eyebrow">
            OVERALL COMMENT
          </div>

          <div class="comment">
            ${escapeHtml(
              report.overallComment ||
                "No overall comment was provided.",
            )}
          </div>
        </div>

        <div class="footer">
          <div class="footer-row">
            <div>
              Report status:<br />
              <strong>
                ${escapeHtml(getStatusLabel(report.status))}
              </strong>
            </div>

            <div class="reference">
              Report reference:<br />
              <strong>${escapeHtml(report.id)}</strong>
            </div>
          </div>

          <div class="verification">
            This report was generated securely through the
            TCS Parent and Staff Portal.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateAcademicReportPdf(
  report: TermReport,
): Promise<"printed" | "shared" | "created"> {
  const logoDataUri =
    await getTcsLogoDataUri();

  const html =
    buildAcademicReportHtml(
      report,
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

  await Sharing.shareAsync(
    result.uri,
    {
      dialogTitle:
        "Share academic report",
      mimeType:
        "application/pdf",
      UTI:
        "com.adobe.pdf",
    },
  );

  return "shared";
}
