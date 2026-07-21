import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getConnectorSampleInput } from "../lib/connector-samples";

describe("connector samples", () => {
  it("returns a Paytm Money transaction-summary sample", () => {
    const sample = getConnectorSampleInput({
      importStrategy: "statement-upload",
      providerId: "paytm-money",
      providerName: "Paytm Money",
    });

    assert.equal(sample.fileName, "paytm-money-transaction-summary.txt");
    assert.match(sample.sourceText, /Investment Transaction Summary/);
    assert.match(sample.sourceText, /03 Jul 2026/);
  });

  it("returns a Groww csv sample", () => {
    const sample = getConnectorSampleInput({
      importStrategy: "csv-upload",
      providerId: "groww",
      providerName: "Groww",
    });

    assert.equal(sample.fileName, "groww-holdings.csv");
    assert.match(sample.sourceText, /scheme name,current value,invested value,units/i);
  });

  it("falls back to the email-forward sample for email connectors", () => {
    const sample = getConnectorSampleInput({
      importStrategy: "email-forward",
      providerId: "unknown-provider",
      providerName: "Custom Mail Source",
    });

    assert.equal(sample.fileName, "forwarded-statement.txt");
    assert.match(sample.sourceText, /Forwarded message/);
  });
});
