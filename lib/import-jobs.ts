import { createImportJob, type ImportJob } from "./local-storage";
import type { ImportReview } from "./import-review";

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
}: {
  assetCount: number;
  duplicateCount: number;
  fileName: string;
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
    documentKind: review.documentKind,
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
