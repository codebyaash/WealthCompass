import {
  createImportJob,
  type ImportJob,
  type PortfolioAsset,
  type PortfolioTransaction,
} from "./local-storage";
import type { ImportReview } from "./import-review";
import {
  applyPortfolioImport,
  previewPortfolioImport,
  type PortfolioImportMode,
} from "./csv-import";
import { parseImportedTransactions } from "./transaction-import";

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
  transactionCount = 0,
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
  transactionCount?: number;
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
    transactionCount,
    usedOcr: review.usedOcr,
  });
}

export function applyImportJobToPortfolio({
  existingAssets,
  existingTransactions = [],
  job,
  mode = "merge",
  now = new Date(),
}: {
  existingAssets: PortfolioAsset[];
  existingTransactions?: PortfolioTransaction[];
  job: ImportJob;
  mode?: PortfolioImportMode;
  now?: Date;
}) {
  const sourceText = job.normalizedText.trim() || job.rawText.trim();

  if (!sourceText) return null;

  const importPreview = previewPortfolioImport(sourceText, existingAssets);
  const transactionPreview = parseImportedTransactions(sourceText);
  const importedTransactions = filterNewImportedTransactions(
    transactionPreview.transactions,
    existingTransactions,
  );

  if (!importPreview.assets.length && !importedTransactions.length) return null;

  const importedAssets =
    mode === "merge"
      ? importPreview.assets
      : [...importPreview.newAssets, ...importPreview.duplicates.map(({ importedAsset }) => importedAsset)];
  const nextAssets = importedAssets.length
    ? applyPortfolioImport({
        existingAssets,
        importedAssets,
        mode,
      })
    : existingAssets;
  const nextTransactions = importedTransactions.length
    ? [...importedTransactions, ...existingTransactions]
    : existingTransactions;
  const duplicateCount = importPreview.duplicates.length;
  const appliedAssetCount = importedAssets.length;
  const appliedTransactionCount = importedTransactions.length;
  const completedJob = createImportJob({
    ...job,
    assetCount: appliedAssetCount,
    createdAt: now.toISOString(),
    duplicateCount,
    id: crypto.randomUUID(),
    lastActionAt: now.toISOString(),
    notes: buildReplayNotes({
      appliedAssetCount,
      appliedTransactionCount,
      duplicateCount,
      mode,
    }),
    status: "completed",
    summary: buildReplaySummary({
      appliedAssetCount,
      appliedTransactionCount,
      duplicateCount,
      mode,
      providerName: job.providerName,
    }),
    transactionCount: appliedTransactionCount,
  });

  return {
    appliedAssetCount,
    appliedTransactionCount,
    duplicateCount,
    importJob: completedJob,
    nextAssets,
    nextTransactions,
  };
}

export function describeImportHistoryApplyResult({
  appliedAssetCount,
  appliedTransactionCount,
  duplicateCount,
}: {
  appliedAssetCount: number;
  appliedTransactionCount: number;
  duplicateCount: number;
}) {
  const parts: string[] = [];

  if (appliedAssetCount > 0 && appliedTransactionCount > 0) {
    parts.push(
      duplicateCount > 0
        ? `Applied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"}, added ${appliedTransactionCount} transaction${appliedTransactionCount === 1 ? "" : "s"}, and merged ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} from import history.`
        : `Applied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"} and added ${appliedTransactionCount} transaction${appliedTransactionCount === 1 ? "" : "s"} from import history.`
    );
  } else if (appliedAssetCount > 0) {
    parts.push(
      duplicateCount > 0
        ? `Applied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"} and merged ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} from import history.`
        : `Applied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"} from import history.`
    );
  } else if (appliedTransactionCount > 0) {
    parts.push(
      `Added ${appliedTransactionCount} transaction${appliedTransactionCount === 1 ? "" : "s"} from import history.`
    );
  }

  parts.push("A replayed outcome was saved to history.");

  return parts.join(" ");
}

function buildReplayNotes({
  appliedAssetCount,
  appliedTransactionCount,
  duplicateCount,
  mode,
}: {
  appliedAssetCount: number;
  appliedTransactionCount: number;
  duplicateCount: number;
  mode: PortfolioImportMode;
}) {
  const parts: string[] = [];

  if (appliedAssetCount > 0) {
    parts.push(
      duplicateCount && mode === "merge"
        ? "Import reapplied from history with duplicate merge handling."
        : "Holdings reapplied from import history.",
    );
  }

  if (appliedTransactionCount > 0) {
    parts.push("Transactions reapplied from import history.");
  }

  return parts.join(" ").trim() || "Import reapplied from history.";
}

function buildReplaySummary({
  appliedAssetCount,
  appliedTransactionCount,
  duplicateCount,
  mode,
  providerName,
}: {
  appliedAssetCount: number;
  appliedTransactionCount: number;
  duplicateCount: number;
  mode: PortfolioImportMode;
  providerName: string;
}) {
  const details: string[] = [];

  if (appliedAssetCount > 0) {
    details.push(
      duplicateCount && mode === "merge"
        ? `reapplied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"} and merged ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}`
        : `reapplied ${appliedAssetCount} holding${appliedAssetCount === 1 ? "" : "s"}`,
    );
  }

  if (appliedTransactionCount > 0) {
    details.push(
      `reapplied ${appliedTransactionCount} transaction${appliedTransactionCount === 1 ? "" : "s"}`,
    );
  }

  return details.length
    ? `${providerName} import ${details.join(" and ")} from history.`
    : `${providerName} import reapplied from history.`;
}

function createTransactionReplayKey(transaction: PortfolioTransaction) {
  return [
    transaction.assetName.trim().toLowerCase(),
    transaction.action,
    transaction.date,
    transaction.amount.toFixed(2),
    transaction.quantity.toFixed(4),
    transaction.price.toFixed(4),
    transaction.source.trim().toLowerCase(),
  ].join("|");
}

export function filterNewImportedTransactions(
  importedTransactions: PortfolioTransaction[],
  existingTransactions: PortfolioTransaction[],
) {
  const existingKeys = new Set(existingTransactions.map(createTransactionReplayKey));
  const seenImportedKeys = new Set<string>();

  return importedTransactions.filter((transaction) => {
    const key = createTransactionReplayKey(transaction);

    if (existingKeys.has(key) || seenImportedKeys.has(key)) {
      return false;
    }

    seenImportedKeys.add(key);
    return true;
  });
}
