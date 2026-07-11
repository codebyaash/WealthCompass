import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeReadiness,
  detectImportSource,
  importSourceDescriptors,
} from "../lib/import-sources";

describe("detectImportSource", () => {
  it("detects provider names from filenames and extracted text", () => {
    const detected = detectImportSource({
      fileName: "paytm-money-july-statement.pdf",
      text: "Paytm Money mutual fund account statement",
    });

    assert.equal(detected?.id, "paytm-money");
  });

  it("detects email-forward flows from pasted email content", () => {
    const detected = detectImportSource({
      text: "Forwarded message\nStatement attached from Gmail",
    });

    assert.equal(detected?.id, "email-forward");
  });
});

describe("describeReadiness", () => {
  it("returns readable labels", () => {
    assert.equal(describeReadiness("guided-import"), "Guided import");
    assert.equal(importSourceDescriptors.length >= 6, true);
  });
});
