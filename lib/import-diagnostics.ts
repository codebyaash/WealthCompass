import type { PortfolioImportPreview } from "./csv-import";
import type { PortfolioAsset } from "./local-storage";

export type ImportDiagnosticRow = {
  currentValue: number;
  gain: number;
  investedValue: number;
  name: string;
  notes: string[];
  price: number;
  quantity: number;
  source: string;
  status: "duplicate" | "new" | "review";
  type: string;
};

export type ImportDiagnostics = {
  afterSnippet: string;
  beforeSnippet: string;
  normalizedText: string;
  parsedRows: ImportDiagnosticRow[];
  rawText: string;
  rowWarnings: string[];
  summary: {
    duplicateCount: number;
    newCount: number;
    parsedCount: number;
    reviewCount: number;
    totalCurrentValue: number;
    totalInvestedValue: number;
    warningCount: number;
  };
};

export function buildImportDiagnostics({
  normalizedText,
  preview,
  rawText,
}: {
  normalizedText: string;
  preview: PortfolioImportPreview;
  rawText: string;
}): ImportDiagnostics {
  const rowWarnings = buildRowWarnings(preview);
  const parsedRows = preview.assets.map((asset) =>
    createDiagnosticRow(asset, preview),
  );

  return {
    afterSnippet: createSnippet(normalizedText),
    beforeSnippet: createSnippet(rawText),
    normalizedText,
    parsedRows,
    rawText,
    rowWarnings: rowWarnings.slice(0, 8),
    summary: {
      duplicateCount: preview.duplicates.length,
      newCount: preview.newAssets.length,
      parsedCount: preview.assets.length,
      reviewCount: parsedRows.filter((row) => row.status === "review").length,
      totalCurrentValue: preview.importedValue,
      totalInvestedValue: preview.importedInvestedValue,
      warningCount: rowWarnings.length,
    },
  };
}

function buildRowWarnings(preview: PortfolioImportPreview) {
  return [
    ...preview.errors,
    ...preview.duplicates.map(
      ({ importedAsset }) =>
        `Duplicate detected for ${importedAsset.name} (${importedAsset.type}).`,
    ),
    ...preview.assets
      .filter(
        (asset) =>
          asset.investedValue <= 0 ||
          Math.abs(asset.investedValue - asset.value) < 0.01,
      )
      .map((asset) => `${asset.name}: invested value missing or inferred.`),
    ...preview.assets
      .filter((asset) => asset.quantity <= 0 || asset.price <= 0)
      .map((asset) => `${asset.name}: units or price missing from the source.`),
  ];
}

function createDiagnosticRow(
  asset: PortfolioAsset,
  preview: PortfolioImportPreview,
): ImportDiagnosticRow {
  const notes = [
    preview.duplicates.some(
      ({ importedAsset }) => createAssetKey(importedAsset) === createAssetKey(asset),
    )
      ? "Duplicate match"
      : "",
    asset.investedValue <= 0 || Math.abs(asset.investedValue - asset.value) < 0.01
      ? "Invested value needs review"
      : "",
    asset.quantity <= 0 || asset.price <= 0
      ? "Units or price missing"
      : "",
  ].filter(Boolean);
  const hasDuplicate = notes.includes("Duplicate match");
  const needsReview = notes.some((note) => note !== "Duplicate match");

  return {
    currentValue: asset.value,
    gain: asset.gain,
    investedValue: asset.investedValue,
    name: asset.name,
    notes,
    price: asset.price,
    quantity: asset.quantity,
    source: asset.source,
    status: needsReview ? "review" : hasDuplicate ? "duplicate" : "new",
    type: asset.type,
  };
}

function createAssetKey(asset: Pick<PortfolioAsset, "name" | "type">) {
  return `${asset.name.trim().toLowerCase()}::${asset.type.trim().toLowerCase()}`;
}

function createSnippet(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}
