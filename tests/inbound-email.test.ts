import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processInboundEmail } from "../lib/inbound-email";

describe("processInboundEmail", () => {
  it("turns html email bodies into importable text", async () => {
    const processing = await processInboundEmail({
      from: "alerts@groww.in",
      html: [
        "<div>Forwarded message</div>",
        "<div>From: alerts@groww.in</div>",
        "<table><tr><td>Scheme Name</td><td>Current Value</td></tr><tr><td>Sensex Index Fund</td><td>50250</td></tr></table>",
      ].join(""),
      subject: "Portfolio snapshot",
    });

    assert.equal(processing.attachmentCount, 0);
    assert.equal(processing.result.sourceType, "body");
    assert.equal(processing.result.review.documentKind, "email-statement");
    assert.equal(processing.result.job.assetCount > 0, true);
  });

  it("processes base64 pdf attachments through the server extractor", async () => {
    const processing = await processInboundEmail(
      {
        attachments: [
          {
            base64: Buffer.from("fake-pdf-bytes").toString("base64"),
            contentType: "application/pdf",
            fileName: "paytm-forward.pdf",
          },
        ],
        from: "statements@paytmmoney.com",
        subject: "Monthly statement",
        text: "Forwarded message\nStatement attached.",
      },
      {
        pdfExtractor: async () => ({
          pageCount: 2,
          text: [
            "Paytm Money statement",
            "Scheme Name\tCurrent Value\tInvested Value\tUnits",
            "Axis Bluechip Fund\t154000\t120000\t820.12",
          ].join("\n"),
          usedOcr: false,
          warnings: ["Attachment processed on server."],
        }),
      },
    );

    assert.equal(processing.attachmentCount, 1);
    assert.equal(processing.result.sourceType, "attachment");
    assert.equal(processing.result.job.providerId, "paytm-money");
    assert.ok(
      processing.result.job.rowWarnings.some((warning) =>
        /Attachment processed on server/i.test(warning),
      ),
    );
    assert.match(processing.result.job.documentStoragePath ?? "", /paytm-forward\.pdf/);
  });

  it("uses OCR fallback text for scanned pdf attachments when the text layer is weak", async () => {
    const processing = await processInboundEmail(
      {
        attachments: [
          {
            base64: Buffer.from("fake-pdf-bytes").toString("base64"),
            contentType: "application/pdf",
            fileName: "cams-scanned.pdf",
            ocrText: [
              "CAMS consolidated statement",
              "Scheme Name\tCurrent Value\tInvested Value\tUnits",
              "PPFAS Flexi Cap\t212000\t170000\t556.72",
            ].join("\n"),
            ocrWarnings: ["OCR worker confidence was moderate on page 2."],
          },
        ],
        from: "statements@camsonline.com",
        subject: "Scanned statement",
        text: "Forwarded message\nStatement attached.",
      },
      {
        pdfExtractor: async () => ({
          pageCount: 2,
          text: "12345",
          usedOcr: false,
          warnings: ["Weak text layer detected."],
        }),
      },
    );

    assert.equal(processing.result.sourceType, "attachment");
    assert.equal(processing.result.job.usedOcr, true);
    assert.equal(processing.result.job.providerId, "cams");
    assert.ok(
      processing.result.job.rowWarnings.some((warning) =>
        /OCR worker confidence was moderate/i.test(warning),
      ),
    );
    assert.match(processing.result.normalizedText, /Scheme Name\tCurrent Value/);
  });

  it("uses an injected OCR extractor when no inline OCR text is provided", async () => {
    const processing = await processInboundEmail(
      {
        attachments: [
          {
            base64: Buffer.from("fake-pdf-bytes").toString("base64"),
            contentType: "application/pdf",
            fileName: "groww-scanned.pdf",
          },
        ],
        from: "support@groww.in",
        subject: "Scanned holdings statement",
        text: "Forwarded message\nStatement attached.",
      },
      {
        pdfExtractor: async () => ({
          pageCount: 1,
          text: "98765",
          usedOcr: false,
          warnings: ["Weak text layer detected."],
        }),
        pdfOcrExtractor: async () => ({
          text: [
            "Groww statement",
            "Scheme Name\tCurrent Value\tInvested Value\tUnits",
            "ICICI Prudential Nifty 50 Index\t84500\t70000\t431.20",
          ].join("\n"),
          warnings: ["External OCR provider recovered text from scanned pages."],
        }),
      },
    );

    assert.equal(processing.result.job.usedOcr, true);
    assert.equal(processing.result.job.providerId, "groww");
    assert.ok(
      processing.result.job.rowWarnings.some((warning) =>
        /External OCR provider recovered text/i.test(warning),
      ),
    );
  });
});
