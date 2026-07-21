import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyImportJobToPortfolio,
  createImportJobFromReview,
  describeImportHistoryApplyResult,
  filterNewImportedTransactions,
} from "../lib/import-jobs";
import { createImportJob, createPortfolioTransaction } from "../lib/local-storage";

describe("createImportJobFromReview", () => {
  it("creates a provider-aware import job from a document review", () => {
    const job = createImportJobFromReview({
      assetCount: 3,
      duplicateCount: 1,
      fileName: "paytm-money.pdf",
      notes: "Reviewed statement.",
      normalizationApplied: ["Collapsed extra whitespace"],
      reviewedCorrections: ["Merged duplicate folios after review."],
      rowWarnings: ["Duplicate detected for Nifty 50 Index Fund (Mutual Fund)."],
      review: {
        cues: ["PDF upload"],
        detectedSource: {
          category: "broker",
          hints: ["paytm money"],
          id: "paytm-money",
          name: "Paytm Money",
          readiness: "guided-import",
          supports: ["pdf"],
          summary: "Statement imports supported.",
        },
        documentKind: "pdf-statement",
        guidance: ["Review before import."],
        normalizationApplied: ["Collapsed extra whitespace"],
        parserProfile: {
          bestInputs: ["Monthly account statement PDF"],
          commonPitfalls: ["Duplicate scheme rows across folios"],
          id: "paytm-money",
          name: "Paytm Money",
          preferredHeaders: ["scheme name", "current value"],
          reviewChecklist: ["Confirm scheme names did not split across lines."],
        },
        parseReadiness: "high",
        providerConfidence: "high",
        qualityScore: 84,
        summary: "Paytm Money pdf statement looks import-ready (84/100).",
        textLength: 420,
        transactionCount: 0,
        usedOcr: false,
      },
      status: "reviewed",
    });

    assert.equal(job.providerId, "paytm-money");
    assert.equal(job.assetCount, 3);
    assert.equal(job.documentId.length > 0, true);
    assert.match(job.documentStoragePath ?? "", /import-documents\/.+\/paytm-money\.pdf/);
    assert.equal(job.duplicateCount, 1);
    assert.match(job.notes, /Collapsed extra whitespace/);
    assert.equal(job.normalizedText, "");
    assert.equal(job.parserProfileId, "paytm-money");
    assert.equal(job.providerConfidence, "high");
    assert.equal(job.rawText, "");
    assert.deepEqual(job.reviewedCorrections, ["Merged duplicate folios after review."]);
    assert.deepEqual(job.rowWarnings, [
      "Duplicate detected for Nifty 50 Index Fund (Mutual Fund).",
    ]);
    assert.equal(job.status, "reviewed");
    assert.equal(job.transactionCount, 0);
  });
});

describe("applyImportJobToPortfolio", () => {
  it("reapplies a saved import job into the portfolio with merge behavior", () => {
    const job = createImportJob({
      assetCount: 2,
      documentId: "document-apply-1",
      documentKind: "table-export",
      fileName: "reapply.txt",
      normalizedText:
        "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core Fund\t180000\t158000\t734.69\nGold Saver ETF\t42000\t39000\t600",
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText:
        "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core Fund\t180000\t158000\t734.69\nGold Saver ETF\t42000\t39000\t600",
      status: "reviewed",
      summary: "Paytm import is ready to apply.",
    });

    const result = applyImportJobToPortfolio({
      existingAssets: [
        {
          gain: 12,
          investedValue: 150000,
          name: "Index Core Fund",
          price: 240,
          quantity: 734.69,
          source: "Manual",
          type: "Mutual Fund",
          value: 176000,
        },
      ],
      job,
    });

    assert.ok(result);
    assert.equal(result.appliedAssetCount, 2);
    assert.equal(result.duplicateCount, 1);
    assert.equal(result.importJob.status, "completed");
    assert.match(result.importJob.notes, /reapplied from history/i);
    assert.equal(result.nextAssets.length, 2);
    assert.equal(result.appliedTransactionCount, 0);
  });

  it("reapplies saved transaction-only imports into the journal", () => {
    const job = createImportJob({
      documentId: "document-apply-2",
      documentKind: "table-export",
      fileName: "paytm-transactions.txt",
      normalizedText: `### Investment Transaction Summary

| Date        | Mutual Fund Scheme Name                                      | Folio No.    | Type           | Units |         NAV |    Amount | Status    |
| ----------- | ------------------------------------------------------------ | ------------ | -------------- | ----: | ----------: | --------: | --------- |
| 03 Jul 2026 | HDFC Large Cap Fund Direct Plan-Growth (Equity - Large Cap)  | 43268646     | Purchase - SIP | 0.810 | ₹1,234.1590 | ₹1,000.00 | Confirmed |`,
      providerId: "paytm-money",
      providerName: "Paytm Money",
      rawText: `### Investment Transaction Summary

| Date        | Mutual Fund Scheme Name                                      | Folio No.    | Type           | Units |         NAV |    Amount | Status    |
| ----------- | ------------------------------------------------------------ | ------------ | -------------- | ----: | ----------: | --------: | --------- |
| 03 Jul 2026 | HDFC Large Cap Fund Direct Plan-Growth (Equity - Large Cap)  | 43268646     | Purchase - SIP | 0.810 | ₹1,234.1590 | ₹1,000.00 | Confirmed |`,
      status: "reviewed",
      summary: "Paytm transaction import is ready to apply.",
    });

    const result = applyImportJobToPortfolio({
      existingAssets: [],
      existingTransactions: [],
      job,
    });

    assert.ok(result);
    assert.equal(result.appliedAssetCount, 0);
    assert.equal(result.appliedTransactionCount, 1);
    assert.equal(result.nextTransactions.length, 1);
    assert.equal(result.importJob.transactionCount, 1);
    assert.match(result.importJob.summary, /reapplied 1 transaction/i);
  });

  it("returns null when the import job has no saved source text", () => {
    const result = applyImportJobToPortfolio({
      existingAssets: [],
      job: createImportJob({
        normalizedText: "",
        rawText: "",
      }),
    });

    assert.equal(result, null);
  });
});

describe("describeImportHistoryApplyResult", () => {
  it("describes mixed holding and transaction replays with duplicate merges", () => {
    const message = describeImportHistoryApplyResult({
      appliedAssetCount: 2,
      appliedTransactionCount: 3,
      duplicateCount: 1,
    });

    assert.match(message, /Applied 2 holdings, added 3 transactions, and merged 1 duplicate/i);
    assert.match(message, /replayed outcome was saved to history/i);
  });

  it("describes transaction-only replays cleanly", () => {
    const message = describeImportHistoryApplyResult({
      appliedAssetCount: 0,
      appliedTransactionCount: 1,
      duplicateCount: 0,
    });

    assert.match(message, /Added 1 transaction from import history/i);
    assert.match(message, /replayed outcome was saved to history/i);
  });
});

describe("filterNewImportedTransactions", () => {
  it("skips transactions already present in the journal and deduplicates repeated imported rows", () => {
    const existing = [
      createPortfolioTransaction({
        action: "buy",
        amount: 1000,
        assetName: "HDFC Large Cap Fund Direct Plan-Growth",
        date: "2026-07-03",
        price: 1234.159,
        quantity: 0.81,
        source: "Paytm Money statement",
      }),
    ];

    const imported = [
      createPortfolioTransaction({
        action: "buy",
        amount: 1000,
        assetName: "HDFC Large Cap Fund Direct Plan-Growth",
        date: "2026-07-03",
        price: 1234.159,
        quantity: 0.81,
        source: "Paytm Money statement",
      }),
      createPortfolioTransaction({
        action: "buy",
        amount: 500,
        assetName: "Edelweiss Mid Cap Direct Plan-Growth",
        date: "2026-07-03",
        price: 127.064,
        quantity: 3.935,
        source: "Paytm Money statement",
      }),
      createPortfolioTransaction({
        action: "buy",
        amount: 500,
        assetName: "Edelweiss Mid Cap Direct Plan-Growth",
        date: "2026-07-03",
        price: 127.064,
        quantity: 3.935,
        source: "Paytm Money statement",
      }),
    ];

    const result = filterNewImportedTransactions(imported, existing);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.assetName, "Edelweiss Mid Cap Direct Plan-Growth");
  });
});
