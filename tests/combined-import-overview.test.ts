import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCombinedImportOverview } from "../lib/combined-import-overview";
import type { PortfolioImportPreview } from "../lib/csv-import";

const preview: PortfolioImportPreview = {
  assets: [
    {
      gain: 5,
      investedValue: 950,
      name: "Index Core",
      price: 100,
      quantity: 10,
      source: "Imported",
      type: "Mutual Fund",
      value: 1000,
    },
    {
      gain: 8,
      investedValue: 460,
      name: "Mid Cap",
      price: 50,
      quantity: 10,
      source: "Imported",
      type: "Mutual Fund",
      value: 500,
    },
  ],
  duplicates: [
    {
      existingAsset: {
        gain: 4,
        investedValue: 900,
        name: "Index Core",
        price: 98,
        quantity: 10,
        source: "Manual",
        type: "Mutual Fund",
        value: 980,
      },
      importedAsset: {
        gain: 5,
        investedValue: 950,
        name: "Index Core",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "Mutual Fund",
        value: 1000,
      },
    },
  ],
  errors: [],
  importedInvestedValue: 1410,
  importedValue: 1500,
  newAssets: [
    {
      gain: 8,
      investedValue: 460,
      name: "Mid Cap",
      price: 50,
      quantity: 10,
      source: "Imported",
      type: "Mutual Fund",
      value: 500,
    },
  ],
};

describe("buildCombinedImportOverview", () => {
  it("summarizes combined holding and transaction imports", () => {
    const result = buildCombinedImportOverview({
      preview,
      selectedAssets: preview.assets,
      transactionDuplicateCount: 1,
      transactionParsedCount: 3,
      transactionReadyCount: 2,
    });

    assert.equal(
      result.headline,
      "This import can update holdings and add new journal transactions in one pass.",
    );
    assert.equal(result.holdingsParsed, 2);
    assert.equal(result.holdingsSelected, 2);
    assert.equal(result.holdingsDuplicates, 1);
    assert.equal(result.selectedCurrentValue, 1500);
    assert.equal(result.selectedInvestedValue, 1410);
    assert.equal(result.transactionsParsed, 3);
    assert.equal(result.transactionsNew, 2);
    assert.equal(result.transactionDuplicates, 1);
  });

  it("explains duplicate-only transaction statements clearly", () => {
    const result = buildCombinedImportOverview({
      preview: {
        assets: [],
        duplicates: [],
        errors: [],
        importedInvestedValue: 0,
        importedValue: 0,
        newAssets: [],
      },
      selectedAssets: [],
      transactionDuplicateCount: 2,
      transactionParsedCount: 2,
      transactionReadyCount: 0,
    });

    assert.equal(
      result.headline,
      "This statement only matches transactions already recorded in the journal.",
    );
  });
});
