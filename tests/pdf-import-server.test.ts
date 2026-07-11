import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTextFromPdfBuffer } from "../lib/pdf-import-server";

describe("extractTextFromPdfBuffer", () => {
  it("extracts text-layer rows from a PDF document in Node", async () => {
    const result = await extractTextFromPdfBuffer(
      new Uint8Array([1, 2, 3]),
      async () => ({
        getDocument: () => ({
          promise: Promise.resolve({
            getPage: async (pageNumber: number) => ({
              getTextContent: async () => ({
                items:
                  pageNumber === 1
                    ? [
                        { str: "Scheme Name", transform: [0, 0, 0, 0, 20, 100] },
                        { str: "Current Value", transform: [0, 0, 0, 0, 120, 100] },
                        { str: "Index Core", transform: [0, 0, 0, 0, 20, 80] },
                        { str: "180000", transform: [0, 0, 0, 0, 120, 80] },
                      ]
                    : [{ str: "Units 734.69", transform: [0, 0, 0, 0, 20, 100] }],
              }),
            }),
            numPages: 2,
          }),
        }),
      }),
    );

    assert.equal(result.pageCount, 2);
    assert.equal(result.usedOcr, false);
    assert.match(result.text, /Scheme Name\tCurrent Value/);
    assert.match(result.text, /Index Core\t180000/);
    assert.match(result.text, /Units 734\.69/);
  });

  it("flags weak scanned-like text when no useful text layer exists", async () => {
    const result = await extractTextFromPdfBuffer(
      new Uint8Array([1]),
      async () => ({
        getDocument: () => ({
          promise: Promise.resolve({
            getPage: async () => ({
              getTextContent: async () => ({
                items: [{ str: "12345", transform: [0, 0, 0, 0, 20, 100] }],
              }),
            }),
            numPages: 1,
          }),
        }),
      }),
    );

    assert.ok(
      result.warnings.some((warning) =>
        /OCR is not configured on the inbound worker yet/i.test(warning),
      ),
    );
  });
});
