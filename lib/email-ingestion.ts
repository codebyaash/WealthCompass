import { previewPortfolioImport } from "./csv-import";
import { buildImportDiagnostics } from "./import-diagnostics";
import { createImportJobFromReview } from "./import-jobs";
import { detectImportSource } from "./import-sources";
import { analyzeImportDocument, type ImportReview } from "./import-review";
import { normalizeImportTextForProvider } from "./provider-import-normalizers";
import type { ImportJob } from "./local-storage";

export type EmailIngestionAttachment = {
  contentType?: string;
  fileName: string;
  text: string;
};

export type EmailIngestionPayload = {
  attachments?: EmailIngestionAttachment[];
  bodyText: string;
  from: string;
  receivedAt?: string;
  subject: string;
};

export type EmailIngestionResult = {
  chosenInputLabel: string;
  detectedProviderId: string | null;
  diagnostics: ReturnType<typeof buildImportDiagnostics>;
  job: ImportJob;
  normalizedText: string;
  review: ImportReview;
  sourceType: "attachment" | "body";
};

export function ingestEmailStatement(
  payload: EmailIngestionPayload,
): EmailIngestionResult {
  const attachments = (payload.attachments ?? []).filter(
    (attachment) => attachment.fileName.trim() && attachment.text.trim(),
  );
  const selectedInput = selectBestEmailInput(payload, attachments);
  const detectionText = [
    payload.from,
    payload.subject,
    payload.bodyText,
    ...attachments.map((attachment) => `${attachment.fileName}\n${attachment.text}`),
  ]
    .filter(Boolean)
    .join("\n");
  const detectedSource = detectImportSource({
    fileName: selectedInput.fileName,
    text: detectionText,
  });
  const normalized = normalizeImportTextForProvider({
    providerId: detectedSource?.id,
    text: selectedInput.text,
  });
  const review = analyzeImportDocument({
    fileName: selectedInput.fileName,
    normalizationApplied: normalized.applied,
    text: normalized.text,
    usedOcr: false,
  });
  const preview = previewPortfolioImport(normalized.text, []);
  const diagnostics = buildImportDiagnostics({
    normalizedText: normalized.text,
    preview,
    rawText: selectedInput.text,
  });
  const attachmentWarnings =
    selectedInput.sourceType === "attachment" && attachments.length > 1
      ? [`Reviewed ${attachments.length} attachments and selected ${selectedInput.fileName} as the best holdings candidate.`]
      : [];
  const rowWarnings = [...attachmentWarnings, ...diagnostics.rowWarnings];
  const job = createImportJobFromReview({
    assetCount: preview.assets.length,
    duplicateCount: preview.duplicates.length,
    fileName: selectedInput.fileName,
    notes: `Email intake from ${payload.from} · ${payload.subject}`,
    normalizationApplied: normalized.applied,
    normalizedText: normalized.text,
    rawText: selectedInput.text,
    review,
    rowWarnings,
    status:
      preview.assets.length > 0 || review.documentKind === "email-statement"
        ? "reviewed"
        : "failed",
  });

  return {
    chosenInputLabel: selectedInput.fileName,
    detectedProviderId: detectedSource?.id ?? null,
    diagnostics,
    job,
    normalizedText: normalized.text,
    review,
    sourceType: selectedInput.sourceType,
  };
}

function selectBestEmailInput(
  payload: EmailIngestionPayload,
  attachments: EmailIngestionAttachment[],
) {
  const bodyCandidate = {
    fileName: `${slugifySubject(payload.subject) || "forwarded-email"}.email.txt`,
    score: scoreEmailCandidate(payload.bodyText, payload.subject),
    sourceType: "body" as const,
    text: payload.bodyText,
  };
  const attachmentCandidates = attachments.map((attachment) => ({
    fileName: attachment.fileName,
    score: scoreEmailCandidate(attachment.text, attachment.fileName) + 15,
    sourceType: "attachment" as const,
    text: attachment.text,
  }));

  return [bodyCandidate, ...attachmentCandidates].sort((left, right) => right.score - left.score)[0];
}

function scoreEmailCandidate(text: string, label: string) {
  let score = 0;
  const normalized = `${label}\n${text}`.toLowerCase();

  if (/scheme name|security name|current value|invested value|market value/.test(normalized)) {
    score += 30;
  }
  if (/units|nav|ltp|folio|isin/.test(normalized)) {
    score += 20;
  }
  if (/statement|portfolio|holdings|summary/.test(normalized)) {
    score += 10;
  }
  score += Math.min(20, normalized.replace(/\s+/g, " ").trim().length / 40);

  return score;
}

function slugifySubject(subject: string) {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
