import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveUploadedImportText } from "../lib/import-upload";

describe("resolveUploadedImportText", () => {
  it("preserves extracted non-pdf upload text instead of falling back to the raw file reader path", () => {
    const result = resolveUploadedImportText({
      extractedUpload: {
        fileName: "statement.html",
        isPdf: false,
        pageCount: 0,
        text: "<table><tr><td>Axis Bluechip Fund</td></tr></table>",
        usedOcr: false,
        warnings: [],
      },
      fallbackPdfResult: null,
      fileText: "",
    });

    assert.equal(result.text, "<table><tr><td>Axis Bluechip Fund</td></tr></table>");
    assert.equal(result.usedOcr, false);
    assert.equal(result.pageCount, 0);
    assert.deepEqual(result.warnings, []);
  });

  it("falls back to the pdf reader result or direct file text when the upload route is unavailable", () => {
    const pdfFallback = resolveUploadedImportText({
      extractedUpload: null,
      fallbackPdfResult: {
        pageCount: 2,
        text: "Scheme Name\tCurrent Value",
        usedOcr: true,
        warnings: ["OCR was used."],
      },
      fileText: "ignored",
    });

    assert.equal(pdfFallback.text, "Scheme Name\tCurrent Value");
    assert.equal(pdfFallback.usedOcr, true);
    assert.equal(pdfFallback.pageCount, 2);
    assert.deepEqual(pdfFallback.warnings, ["OCR was used."]);

    const textFallback = resolveUploadedImportText({
      extractedUpload: null,
      fallbackPdfResult: null,
      fileText: "Fund Name,Current Value",
    });

    assert.equal(textFallback.text, "Fund Name,Current Value");
    assert.equal(textFallback.usedOcr, false);
    assert.equal(textFallback.pageCount, 0);
    assert.deepEqual(textFallback.warnings, []);
  });
});
