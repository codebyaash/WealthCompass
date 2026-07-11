import { previewPortfolioImport } from "./csv-import";
import { buildImportDiagnostics } from "./import-diagnostics";
import { createImportJobFromReview } from "./import-jobs";
import { detectImportSource } from "./import-sources";
import { analyzeImportDocument, type ImportReview } from "./import-review";
import { normalizeImportTextForProvider } from "./provider-import-normalizers";
import type { ImportJob } from "./local-storage";

export type EmailIngestionAttachment = {
  contentType?: string;
  extractedText?: string;
  extractionWarnings?: string[];
  fileName: string;
  pageCount?: number;
  text?: string;
  usedOcr?: boolean;
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

export type EmailIngestionApiResponse = {
  persistedToCloud: boolean;
  persistenceMessage: string | null;
  result: EmailIngestionResult;
};

type SelectedEmailInput = {
  extractionWarnings: string[];
  fileName: string;
  score: number;
  sourceType: "attachment" | "body";
  text: string;
  usedOcr: boolean;
};

export function ingestEmailStatement(
  payload: EmailIngestionPayload,
): EmailIngestionResult {
  const attachments = (payload.attachments ?? []).filter(
    (attachment) =>
      attachment.fileName.trim() && resolveAttachmentText(attachment).trim(),
  );
  const selectedInput = selectBestEmailInput(payload, attachments);
  const detectionText = [
    payload.from,
    payload.subject,
    payload.bodyText,
    ...attachments.map((attachment) => `${attachment.fileName}\n${resolveAttachmentText(attachment)}`),
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
    usedOcr: selectedInput.usedOcr,
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
  const rowWarnings = [
    ...attachmentWarnings,
    ...selectedInput.extractionWarnings,
    ...diagnostics.rowWarnings,
  ];
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
  const bodyCandidate: SelectedEmailInput = {
    extractionWarnings: [],
    fileName: `${slugifySubject(payload.subject) || "forwarded-email"}.email.txt`,
    score: scoreEmailCandidate(payload.bodyText, payload.subject),
    sourceType: "body",
    text: payload.bodyText,
    usedOcr: false,
  };
  const attachmentCandidates: SelectedEmailInput[] = attachments.map((attachment) => ({
    extractionWarnings: attachment.extractionWarnings ?? [],
    fileName: attachment.fileName,
    score:
      scoreEmailCandidate(resolveAttachmentText(attachment), attachment.fileName) +
      (attachment.contentType?.includes("pdf") || attachment.fileName.toLowerCase().endsWith(".pdf")
        ? 20
        : 15),
    sourceType: "attachment",
    text: resolveAttachmentText(attachment),
    usedOcr: attachment.usedOcr ?? false,
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

function resolveAttachmentText(attachment: EmailIngestionAttachment) {
  return attachment.extractedText ?? attachment.text ?? "";
}

function slugifySubject(subject: string) {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
