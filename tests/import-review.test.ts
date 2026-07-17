import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeImportDocument } from "../lib/import-review";

describe("analyzeImportDocument", () => {
  it("classifies forwarded statements and detects providers", () => {
    const review = analyzeImportDocument({
      fileName: "cams-statement.pdf",
      text: "Forwarded message\nCAMS consolidated account statement\nScheme Name Current Value Units",
      usedOcr: true,
    });

    assert.equal(review.detectedSource?.id, "cams");
    assert.equal(review.documentKind, "email-statement");
    assert.deepEqual(review.normalizationApplied, []);
    assert.equal(review.parserProfile?.id, "cams");
    assert.equal(review.providerConfidence, "high");
    assert.equal(review.usedOcr, true);
    assert.equal(review.parseReadiness, "high");
  });

  it("flags weak unclassified text for cleanup", () => {
    const review = analyzeImportDocument({
      text: "hello there",
    });

    assert.equal(review.documentKind, "unclassified");
    assert.deepEqual(review.normalizationApplied, []);
    assert.equal(review.parseReadiness, "low");
  });

  it("explains when pasted text is only a transaction summary", () => {
    const review = analyzeImportDocument({
      text: `Transaction Summary
Investment Activity
Fresh Purchase: 3000
Withdrawal: 0`,
    });

    assert.ok(review.cues.includes("Transaction summary markers"));
    assert.ok(
      review.guidance.some((item) =>
        /transaction or activity summary, not the holdings section/i.test(item),
      ),
    );
  });
});
