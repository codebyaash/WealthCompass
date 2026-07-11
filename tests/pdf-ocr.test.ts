import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPdfOcrResult,
  shouldAttemptPdfOcr,
} from "../lib/pdf-ocr";

describe("shouldAttemptPdfOcr", () => {
  it("requests OCR when extracted text is too weak", () => {
    assert.equal(
      shouldAttemptPdfOcr({
        pageCount: 1,
        text: "12345",
        usedOcr: false,
        warnings: [],
      }),
      true,
    );
    assert.equal(
      shouldAttemptPdfOcr({
        pageCount: 1,
        text: "Scheme Name\tCurrent Value\tInvested Value\tUnits\tIndex Core\t180000\t158000\t734.69",
        usedOcr: false,
        warnings: [],
      }),
      false,
    );
  });
});

describe("applyPdfOcrResult", () => {
  it("marks the extraction as OCR-backed and preserves warnings", () => {
    const applied = applyPdfOcrResult({
      extraction: {
        pageCount: 2,
        text: "12345",
        usedOcr: false,
        warnings: ["Weak text layer detected."],
      },
      ocr: {
        text: "Scheme Name\tCurrent Value\nIndex Core\t180000",
        warnings: ["OCR provider confidence was medium."],
      },
    });

    assert.equal(applied.usedOcr, true);
    assert.match(applied.text, /Index Core\t180000/);
    assert.ok(applied.warnings.some((warning) => /OCR provider confidence was medium/i.test(warning)));
    assert.ok(applied.warnings.some((warning) => /OCR was used on the inbound PDF attachment/i.test(warning)));
  });
});
