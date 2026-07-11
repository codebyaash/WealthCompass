import type { PdfExtractResult } from "./pdf-import-shared";

export type PdfOcrContext = {
  attachmentName: string;
  base64?: string;
  contentType?: string;
  existingExtraction: PdfExtractResult;
  pdfData?: Uint8Array;
};

export type PdfOcrResult = {
  text: string;
  warnings?: string[];
};

export function shouldAttemptPdfOcr(extraction: PdfExtractResult) {
  const normalized = extraction.text.replace(/\s+/g, " ").trim().toLowerCase();

  if (
    /\b(scheme name|security name|current value|invested value|market value|units|nav|folio|isin)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return normalized.length < 80;
}

export function applyPdfOcrResult({
  extraction,
  ocr,
}: {
  extraction: PdfExtractResult;
  ocr: PdfOcrResult;
}): PdfExtractResult {
  return {
    pageCount: extraction.pageCount,
    text: ocr.text,
    usedOcr: true,
    warnings: [
      "OCR was used on the inbound PDF attachment, so holdings and numeric fields should be reviewed carefully.",
      ...(ocr.warnings ?? []),
    ],
  };
}
