import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingestEmailStatement } from "../lib/email-ingestion";

describe("ingestEmailStatement", () => {
  it("prefers a holdings attachment over a generic email body", () => {
    const result = ingestEmailStatement({
      attachments: [
        {
          fileName: "paytm-money-june-statement.txt",
          text: [
            "Paytm Money portfolio statement",
            "Scheme Name\tCurrent Value\tInvested Value\tUnits",
            "Axis Bluechip Fund\t154000\t120000\t820.12",
            "Parag Parikh Flexi Cap\t98000\t75000\t412.75",
          ].join("\n"),
        },
      ],
      bodyText: "Forwarded message\nPlease review the attached monthly statement.",
      from: "statements@paytmmoney.com",
      subject: "Your June statement is attached",
    });

    assert.equal(result.sourceType, "attachment");
    assert.equal(result.chosenInputLabel, "paytm-money-june-statement.txt");
    assert.equal(result.review.detectedSource?.id, "paytm-money");
    assert.equal(result.job.providerId, "paytm-money");
    assert.equal(result.job.assetCount > 0, true);
    assert.match(
      result.job.documentStoragePath ?? "",
      /import-documents\/.+\/paytm-money-june-statement\.txt/,
    );
    assert.match(result.job.notes, /Email intake from statements@paytmmoney\.com/);
  });

  it("falls back to the email body when no attachment text is available", () => {
    const result = ingestEmailStatement({
      bodyText: [
        "Forwarded message",
        "From: alerts@groww.in",
        "Subject: Portfolio snapshot",
        "Scheme Name\tCurrent Value\tInvested Value\tUnits",
        "HDFC Index Sensex Fund\t50250\t43000\t301.44",
      ].join("\n"),
      from: "alerts@groww.in",
      subject: "Portfolio snapshot",
    });

    assert.equal(result.sourceType, "body");
    assert.match(result.chosenInputLabel, /portfolio-snapshot\.email\.txt$/);
    assert.equal(result.review.documentKind, "email-statement");
    assert.equal(result.job.documentKind, "email-statement");
    assert.equal(result.job.assetCount > 0, true);
    assert.match(result.job.documentStoragePath ?? "", /portfolio-snapshot\.email\.txt/);
  });
});
