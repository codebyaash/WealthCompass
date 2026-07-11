import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPdfExtractionWarnings,
  getPdfImportErrorMessage,
  isLikelyScannedPdfText,
} from "../lib/pdf-import";

describe("isLikelyScannedPdfText", () => {
  it("treats tiny extracted text as likely scanned", () => {
    assert.equal(isLikelyScannedPdfText("folio 123"), true);
    assert.equal(
      isLikelyScannedPdfText("Scheme Name Current Value Invested Value Units NAV Long enough text"),
      false,
    );
  });

  it("flags digit-heavy low-signal extraction as likely scanned", () => {
    assert.equal(isLikelyScannedPdfText("1234567890 45678 12345"), true);
  });
});

describe("buildPdfExtractionWarnings", () => {
  it("returns review warnings for OCR-heavy weak extractions", () => {
    const warnings = buildPdfExtractionWarnings({
      pageCount: 4,
      text: "12345 67890",
      usedOcr: true,
    });

    assert.equal(warnings.length >= 3, true);
    assert.match(warnings[0] ?? "", /OCR was used/i);
    assert.ok(warnings.some((warning) => /first 3 PDF pages/i.test(warning)));
    assert.ok(warnings.some((warning) => /Very little text/i.test(warning)));
  });
});

describe("getPdfImportErrorMessage", () => {
  it("returns a helpful password-protected message", () => {
    assert.equal(
      getPdfImportErrorMessage({ name: "PasswordException" }),
      "This PDF is password-protected. Remove the password or export a text statement before importing.",
    );
  });
});
