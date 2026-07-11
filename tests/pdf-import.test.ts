import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
});

describe("getPdfImportErrorMessage", () => {
  it("returns a helpful password-protected message", () => {
    assert.equal(
      getPdfImportErrorMessage({ name: "PasswordException" }),
      "This PDF is password-protected. Remove the password or export a text statement before importing.",
    );
  });
});
