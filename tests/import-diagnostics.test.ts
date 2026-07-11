import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewPortfolioImport } from "../lib/csv-import";
import { buildImportDiagnostics } from "../lib/import-diagnostics";

describe("buildImportDiagnostics", () => {
  it("summarizes parsed rows, duplicates, and review warnings", () => {
    const preview = previewPortfolioImport(
      `scheme name,current value,invested value,units,nav
Nifty 50 Index Fund,180000,180000,734.69,245
Gold ETF,42000,40000,600,70`,
      [
        {
          gain: 12,
          investedValue: 158000,
          name: "Nifty 50 Index Fund",
          price: 240,
          quantity: 734.69,
          source: "Manual",
          type: "Mutual Fund",
          value: 176325.6,
        },
      ],
    );

    const diagnostics = buildImportDiagnostics({
      normalizedText: "normalized",
      preview,
      rawText: "raw",
    });

    assert.equal(diagnostics.summary.parsedCount, 2);
    assert.equal(diagnostics.summary.duplicateCount, 1);
    assert.equal(diagnostics.summary.newCount, 1);
    assert.equal(diagnostics.summary.reviewCount, 1);
    assert.equal(diagnostics.parsedRows[0]?.status, "review");
    assert.deepEqual(diagnostics.parsedRows[0]?.notes, [
      "Duplicate match",
      "Units or price missing",
    ]);
    assert.equal(diagnostics.parsedRows[1]?.status, "new");
    assert.match(diagnostics.rowWarnings.join(" "), /Duplicate detected/);
  });
});
