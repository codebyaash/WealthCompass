import {
  createIntegrationConnection,
  type IntegrationChannel,
  type IntegrationImportStrategy,
} from "./local-storage";
import { describeReadiness, type ImportReadiness } from "./import-sources";

export type ConnectorTemplate = {
  bestInputs: string[];
  channel: IntegrationChannel;
  id: string;
  importStrategy: IntegrationImportStrategy;
  notes: string;
  providerName: string;
  readiness: ImportReadiness;
  setupSteps: string[];
  sourceHint: string;
  summary: string;
  syncCadenceMinutes: number;
};

export const connectorTemplates: ConnectorTemplate[] = [
  {
    id: "paytm-money",
    providerName: "Paytm Money",
    summary: "Best current lane for Paytm Money: statement, email, and pasted transaction text imports.",
    readiness: "guided-import",
    channel: "broker",
    importStrategy: "statement-upload",
    syncCadenceMinutes: 10080,
    sourceHint: "Upload Paytm Money statements, pasted transaction summaries, or forwarded statement emails for review.",
    notes: "Use statement uploads for monthly reconciliation. Switch to email-forward if you mainly receive statements in inbox.",
    bestInputs: ["Transaction summary email text", "Statement PDF", "Portfolio/holding export text"],
    setupSteps: [
      "Export or forward the latest Paytm Money statement.",
      "Run import review before merging holdings or transactions.",
      "Keep this source on a weekly manual cadence until direct account linking exists.",
    ],
  },
  {
    id: "groww",
    providerName: "Groww",
    summary: "Good guided-import source for CSV, statement PDF, and copied holding tables.",
    readiness: "guided-import",
    channel: "broker",
    importStrategy: "csv-upload",
    syncCadenceMinutes: 1440,
    sourceHint: "Use Groww CSV exports when possible, then fall back to statement text or PDFs.",
    notes: "CSV is usually the cleanest first pass. Statement uploads still work when headers drift or exports are unavailable.",
    bestInputs: ["CSV holdings export", "Statement PDF", "Copied holdings table"],
    setupSteps: [
      "Export a fresh Groww holdings CSV or statement.",
      "Review duplicate rows and folio-level overlaps before merge.",
      "Run this source on a daily or on-demand cadence based on how often you trade.",
    ],
  },
  {
    id: "zerodha",
    providerName: "Zerodha",
    summary: "Supports both guided imports and direct account sync through Kite.",
    readiness: "guided-import",
    channel: "broker",
    importStrategy: "sync-ready",
    syncCadenceMinutes: 60,
    sourceHint: "Connect Kite for holdings sync, with CSV or statement fallback kept available.",
    notes: "Use direct sync for live holdings, but keep a fallback export lane until account-linked sync is fully trusted.",
    bestInputs: ["Kite holdings sync", "Coin statement PDF", "CSV export fallback"],
    setupSteps: [
      "Connect Zerodha Kite from the broker connectors card.",
      "Run a first holdings sync and compare it against an export.",
      "Leave fallback imports available for backfill or mismatch review.",
    ],
  },
  {
    id: "jupiter",
    providerName: "Jupiter",
    summary: "Prepared for statement PDFs and forwarded portfolio emails.",
    readiness: "guided-import",
    channel: "email",
    importStrategy: "email-forward",
    syncCadenceMinutes: 1440,
    sourceHint: "Forward Jupiter statements or paste extracted statement text from email.",
    notes: "Email-forward works well here because statement summaries often arrive before you go looking for exports.",
    bestInputs: ["Forwarded statement email", "PDF attachment text", "Copied statement table"],
    setupSteps: [
      "Forward the latest Jupiter statement email or paste the body text.",
      "Attach extracted PDF text if the email body is too summary-heavy.",
      "Review parsed holdings before applying them to the tracked portfolio.",
    ],
  },
  {
    id: "cams",
    providerName: "CAMS",
    summary: "Strong registrar source for consolidated mutual fund statements.",
    readiness: "ready-now",
    channel: "registrar",
    importStrategy: "statement-upload",
    syncCadenceMinutes: 4320,
    sourceHint: "Upload CAMS consolidated statements or paste extracted registrar email text.",
    notes: "Registrar statements are often cleaner than broker summaries for mutual-fund reconciliation.",
    bestInputs: ["Consolidated account statement PDF", "Registrar email text", "Extracted statement table"],
    setupSteps: [
      "Download the latest CAMS consolidated statement.",
      "Review scheme names and value columns after extraction.",
      "Use this source for periodic reconciliation rather than daily monitoring.",
    ],
  },
  {
    id: "kfintech",
    providerName: "KFintech",
    summary: "Registrar workflow suited to pasted email text and statement PDFs.",
    readiness: "ready-now",
    channel: "registrar",
    importStrategy: "statement-upload",
    syncCadenceMinutes: 4320,
    sourceHint: "Upload KFintech statements or paste registrar email content for portfolio review.",
    notes: "Useful for cross-checking broker-reported mutual fund positions against registrar records.",
    bestInputs: ["Registrar statement PDF", "Email body", "Copied holdings table"],
    setupSteps: [
      "Pull the latest KFintech statement.",
      "Run import review to confirm provider detection and parsed holdings.",
      "Use this source as a reconciliation layer for long-term fund positions.",
    ],
  },
  {
    id: "email-forward",
    providerName: "Email Forward",
    summary: "Fastest general-purpose lane when statements mainly arrive by email.",
    readiness: "ready-now",
    channel: "email",
    importStrategy: "email-forward",
    syncCadenceMinutes: 1440,
    sourceHint: "Paste forwarded statement emails with attachment text into the email ingestion flow.",
    notes: "Best general-purpose connector for mixed providers until every broker has a dedicated direct lane.",
    bestInputs: ["Forwarded email body", "Attachment OCR text", "Copied statement table"],
    setupSteps: [
      "Connect Gmail or Outlook if available, or use the simulator manually.",
      "Paste email body plus attachment text for a full import review.",
      "Use this lane for providers that do not yet have their own direct connector.",
    ],
  },
];

export function getConnectorTemplate(templateId: string) {
  return connectorTemplates.find((template) => template.id === templateId) ?? null;
}

export function createConnectionFromTemplate(templateId: string) {
  const template = getConnectorTemplate(templateId);
  if (!template) return createIntegrationConnection();

  return createIntegrationConnection({
    channel: template.channel,
    importStrategy: template.importStrategy,
    notes: template.notes,
    providerId: template.id,
    providerName: template.providerName,
    sourceHint: template.sourceHint,
    syncCadenceMinutes: template.syncCadenceMinutes,
  });
}

export function describeConnectorTemplate(template: ConnectorTemplate) {
  return {
    cadenceLabel:
      template.syncCadenceMinutes >= 1440
        ? `Every ${Math.round(template.syncCadenceMinutes / 1440)} day${Math.round(template.syncCadenceMinutes / 1440) === 1 ? "" : "s"}`
        : `Every ${template.syncCadenceMinutes} min`,
    readinessLabel: describeReadiness(template.readiness),
  };
}
