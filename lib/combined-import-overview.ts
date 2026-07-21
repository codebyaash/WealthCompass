import type { PortfolioAsset } from "@/lib/local-storage";
import type { PortfolioImportPreview } from "@/lib/csv-import";

export type CombinedImportOverview = {
  headline: string;
  holdingsDuplicates: number;
  holdingsParsed: number;
  holdingsSelected: number;
  selectedCurrentValue: number;
  selectedInvestedValue: number;
  transactionDuplicates: number;
  transactionsNew: number;
  transactionsParsed: number;
};

export function buildCombinedImportOverview({
  preview,
  selectedAssets,
  transactionDuplicateCount,
  transactionParsedCount,
  transactionReadyCount,
}: {
  preview: PortfolioImportPreview;
  selectedAssets: PortfolioAsset[];
  transactionDuplicateCount: number;
  transactionParsedCount: number;
  transactionReadyCount: number;
}): CombinedImportOverview {
  const selectedCurrentValue = selectedAssets.reduce((sum, asset) => sum + asset.value, 0);
  const selectedInvestedValue = selectedAssets.reduce(
    (sum, asset) => sum + asset.investedValue,
    0,
  );

  return {
    headline: buildHeadline({
      holdingsParsed: preview.assets.length,
      transactionReadyCount,
      transactionDuplicateCount,
    }),
    holdingsDuplicates: preview.duplicates.length,
    holdingsParsed: preview.assets.length,
    holdingsSelected: selectedAssets.length,
    selectedCurrentValue,
    selectedInvestedValue,
    transactionDuplicates: transactionDuplicateCount,
    transactionsNew: transactionReadyCount,
    transactionsParsed: transactionParsedCount,
  };
}

function buildHeadline({
  holdingsParsed,
  transactionReadyCount,
  transactionDuplicateCount,
}: {
  holdingsParsed: number;
  transactionReadyCount: number;
  transactionDuplicateCount: number;
}) {
  if (holdingsParsed > 0 && transactionReadyCount > 0) {
    return "This import can update holdings and add new journal transactions in one pass.";
  }

  if (holdingsParsed > 0) {
    return "This import is ready to update holdings.";
  }

  if (transactionReadyCount > 0) {
    return "This import will add new journal transactions without changing current holdings directly.";
  }

  if (transactionDuplicateCount > 0) {
    return "This statement only matches transactions already recorded in the journal.";
  }

  return "Review the parsed data before applying anything to the workspace.";
}
