import { createImportJob, type ImportJob } from "./local-storage";
import type { ImportReview } from "./import-review";

export function buildImportDocumentStoragePath(
  documentId: string,
  fileName: string,
) {
  const safeFileName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `import-documents/${documentId}/${safeFileName || "document.txt"}`;
}

export function createImportJobFromReview({
  assetCount,
  duplicateCount,
  fileName,
  notes,
  normalizationApplied,
  normalizedText,
  rawText,
  reviewedCorrections,
  review,
  rowWarnings,
  status,
  documentId = crypto.randomUUID(),
}: {
  assetCount: number;
  duplicateCount: number;
  fileName: string;
  documentId?: string;
  notes?: string;
  normalizationApplied?: string[];
  normalizedText?: string;
  rawText?: string;
  reviewedCorrections?: string[];
  review: ImportReview;
  rowWarnings?: string[];
  status: ImportJob["status"];
}) {
  const noteSuffix =
    normalizationApplied && normalizationApplied.length
      ? ` Cleanup: ${normalizationApplied.join("; ")}`
      : "";

  return createImportJob({
    assetCount,
    documentId,
    documentKind: review.documentKind,
    documentStoragePath: buildImportDocumentStoragePath(documentId, fileName),
    duplicateCount,
    fileName,
    lastActionAt: new Date().toISOString(),
    notes: `${notes ?? ""}${noteSuffix}`.trim(),
    normalizationApplied: normalizationApplied ?? [],
    normalizedText: normalizedText ?? "",
    parserProfileId: review.parserProfile?.id ?? null,
    providerId: review.detectedSource?.id ?? null,
    providerName: review.detectedSource?.name ?? "Unknown provider",
    providerConfidence: review.providerConfidence,
    rawText: rawText ?? normalizedText ?? "",
    reviewedCorrections: reviewedCorrections ?? [],
    rowWarnings: rowWarnings ?? [],
    status,
    summary: review.summary,
    usedOcr: review.usedOcr,
  });
}
