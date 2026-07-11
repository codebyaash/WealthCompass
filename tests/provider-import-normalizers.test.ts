import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeImportTextForProvider } from "../lib/provider-import-normalizers";

describe("normalizeImportTextForProvider", () => {
  it("removes common email chain noise for email-forward imports", () => {
    const result = normalizeImportTextForProvider({
      providerId: "email-forward",
      text: "From: broker@example.com\nSubject: Statement\nScheme Name\tCurrent Value\nRegards,\nTeam",
    });

    assert.match(result.text, /Scheme Name/);
    assert.equal(result.text.includes("Subject:"), false);
    assert.ok(result.applied.length > 0);
  });

  it("normalizes broker shorthand labels", () => {
    const result = normalizeImportTextForProvider({
      providerId: "groww",
      text: "ISIN: INF123\nLTP: 120\nQty: 10",
    });

    assert.match(result.text, /ISIN INF123/);
    assert.match(result.text, /LTP 120/);
    assert.ok(result.applied.includes("Standardized broker shorthand labels"));
  });
});
