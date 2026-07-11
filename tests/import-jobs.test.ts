import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImportJobFromReview } from "../lib/import-jobs";

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
        usedOcr: false,
      },
      status: "reviewed",
    });

    assert.equal(job.providerId, "paytm-money");
    assert.equal(job.assetCount, 3);
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
  });
});
