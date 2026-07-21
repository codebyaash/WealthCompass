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
    assert.equal(review.operatorFocus?.label, "Ready to review");
  });

  it("flags weak unclassified text for cleanup", () => {
    const review = analyzeImportDocument({
      text: "hello there",
    });

    assert.equal(review.documentKind, "unclassified");
    assert.deepEqual(review.normalizationApplied, []);
    assert.equal(review.parseReadiness, "low");
    assert.equal(review.operatorFocus?.label, "Provider fit weak");
    assert.match(review.operatorFocus?.detail ?? "", /provider detection is still weak|cleaner export/i);
  });

  it("explains when pasted text is only a transaction summary", () => {
    const review = analyzeImportDocument({
      text: `Here is the text copied from the statement:

## Transaction Summary

### Investment Activity

* **Fresh Purchase:** ₹3,000.00
* **Withdrawal:** ₹0.00

### Investment Transaction Summary

| Date        | Mutual Fund Scheme Name                                      | Folio No.    | Type           | Units |         NAV |    Amount | Status    |
| ----------- | ------------------------------------------------------------ | ------------ | -------------- | ----: | ----------: | --------: | --------- |
| 03 Jul 2026 | HDFC Large Cap Fund Direct Plan-Growth (Equity - Large Cap)  | 43268646     | Purchase - SIP | 0.810 | ₹1,234.1590 | ₹1,000.00 | Confirmed |
| 03 Jul 2026 | Edelweiss Mid Cap Direct Plan-Growth (Equity - Mid Cap)      | 91050161892  | Purchase - SIP | 3.935 |   ₹127.0640 |   ₹500.00 | Confirmed |
`,
    });

    assert.ok(review.cues.includes("Transaction summary markers"));
    assert.equal(review.transactionCount, 2);
    assert.ok(
      review.guidance.some((item) =>
        /transactions? can already be imported/i.test(item),
      ),
    );
    assert.match(review.summary, /can import 2 transactions?/i);
    assert.equal(review.operatorFocus?.label, "Transactions only");
    assert.match(review.operatorFocus?.detail ?? "", /current value tracking|holdings section/i);
  });

  it("highlights OCR-heavy pdf reviews for a human check", () => {
    const review = analyzeImportDocument({
      fileName: "statement.pdf",
      text: "Scheme Name Current Value Invested Value Units NAV",
      usedOcr: true,
    });

    assert.equal(review.documentKind, "pdf-statement");
    assert.equal(review.operatorFocus?.label, "OCR check");
    assert.match(review.operatorFocus?.detail ?? "", /OCR recovered the text|decimal-heavy values/i);
  });
});
