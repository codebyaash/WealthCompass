import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDashboardImportOutcomes,
  getImportJobFlowMeta,
  getImportJobHistoryActions,
  getImportJobOutcomeStats,
} from "../lib/import-job-flow";
import { createImportJob } from "../lib/local-storage";

describe("getImportJobFlowMeta", () => {
  it("distinguishes reapplied imports from ordinary completed imports", () => {
    const meta = getImportJobFlowMeta(
      createImportJob({
        notes: "Import reapplied from history with duplicate merge handling.",
        status: "completed",
        summary: "Paytm Money import reapplied from history.",
      }),
    );

    assert.equal(meta.label, "Reapplied");
    assert.match(meta.detail, /replayed from history/i);
  });

  it("keeps staged sync-plan reviews distinct", () => {
    const meta = getImportJobFlowMeta(
      createImportJob({
        notes: "Sync plan staged for review.",
        status: "reviewed",
        summary: "Sync plan staged for Paytm Money.",
      }),
    );

    assert.equal(meta.label, "Staged");
  });

  it("calls out transaction-only staged reviews", () => {
    const meta = getImportJobFlowMeta(
      createImportJob({
        assetCount: 0,
        notes: "Sync plan staged for review.",
        status: "reviewed",
        summary: "Transaction summary staged for Paytm Money.",
        transactionCount: 4,
      }),
    );

    assert.equal(meta.label, "Transactions staged");
    assert.match(meta.detail, /transaction-only/i);
  });

  it("falls back to completed for normal finished imports", () => {
    const meta = getImportJobFlowMeta(
      createImportJob({
        notes: "Import completed successfully.",
        status: "completed",
        summary: "Paytm import completed.",
      }),
    );

    assert.equal(meta.label, "Completed");
  });

  it("marks OCR-backed failures as OCR review", () => {
    const meta = getImportJobFlowMeta(
      createImportJob({
        notes: "OCR extraction needs manual cleanup.",
        status: "failed",
        summary: "Provider fit weak after OCR pass.",
        usedOcr: true,
      }),
    );

    assert.equal(meta.label, "OCR review");
    assert.match(meta.detail, /ocr-backed/i);
  });
});

describe("getImportJobOutcomeStats", () => {
  it("formats file, holdings, duplicate, and OCR labels for connector summaries", () => {
    const stats = getImportJobOutcomeStats(
      createImportJob({
        assetCount: 2,
        duplicateCount: 1,
        documentKind: "email-forward",
        fileName: "paytm-money-july.txt",
        transactionCount: 3,
        usedOcr: true,
      }),
    );

    assert.equal(stats.fileLabel, "paytm-money-july.txt · email-forward");
    assert.equal(stats.holdingsLabel, "2 holdings");
    assert.equal(stats.duplicatesLabel, "1 duplicate");
    assert.equal(stats.ocrLabel, "OCR-backed PDF");
    assert.equal(stats.transactionsLabel, "3 transactions");
  });

  it("treats transaction-only imports as having no holdings parsed", () => {
    const stats = getImportJobOutcomeStats(
      createImportJob({
        assetCount: 0,
        transactionCount: 2,
        usedOcr: false,
      }),
    );

    assert.equal(stats.holdingsLabel, "No holdings parsed");
    assert.equal(stats.transactionsLabel, "2 transactions");
    assert.equal(stats.ocrLabel, "Direct text parse");
  });
});

describe("buildDashboardImportOutcomes", () => {
  it("returns the latest import outcomes in reverse chronological order", () => {
    const outcomes = buildDashboardImportOutcomes([
      createImportJob({
        createdAt: "2026-07-16T09:00:00.000Z",
        fileName: "older.txt",
        providerName: "Paytm Money",
        status: "reviewed",
        summary: "Sync plan staged for Paytm Money.",
      }),
      createImportJob({
        createdAt: "2026-07-17T10:00:00.000Z",
        fileName: "latest.txt",
        notes: "Import completed successfully.",
        providerName: "Zerodha",
        status: "completed",
        summary: "Zerodha import completed.",
      }),
    ]);

    assert.equal(outcomes.length, 2);
    assert.equal(outcomes[0]?.providerName, "Zerodha");
    assert.equal(outcomes[0]?.label, "Completed");
    assert.equal(outcomes[0]?.transactionsLabel, "No transactions");
    assert.equal(outcomes[1]?.label, "Staged");
  });
});

describe("getImportJobHistoryActions", () => {
  it("prefers apply labels for reviewed transaction-only jobs", () => {
    const actions = getImportJobHistoryActions(
      createImportJob({
        assetCount: 0,
        rawText: "transaction payload",
        status: "reviewed",
        transactionCount: 2,
      }),
    );

    assert.equal(actions.applyAction.disabled, false);
    assert.equal(actions.applyAction.label, "Apply transactions");
    assert.equal(actions.syncPlanAction.label, "Open in sync plan");
  });

  it("makes missing-payload jobs explicit", () => {
    const actions = getImportJobHistoryActions(
      createImportJob({
        normalizedText: "",
        rawText: "",
        status: "failed",
      }),
    );

    assert.equal(actions.applyAction.disabled, true);
    assert.equal(actions.syncPlanAction.disabled, true);
    assert.equal(actions.syncPlanAction.label, "Needs saved source");
    assert.equal(actions.reprocessAction.label, "Reprocess unavailable");
  });

  it("uses replay language for completed jobs", () => {
    const actions = getImportJobHistoryActions(
      createImportJob({
        assetCount: 1,
        normalizedText: "payload",
        rawText: "payload",
        status: "completed",
      }),
    );

    assert.equal(actions.applyAction.label, "Replay to portfolio");
    assert.equal(actions.retryAction.label, "Stage another review");
    assert.equal(actions.syncPlanAction.label, "Reopen in sync plan");
  });
});
