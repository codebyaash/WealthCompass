export type PdfExtractResult = {
  pageCount: number;
  text: string;
  usedOcr: boolean;
  warnings: string[];
};

export function isLikelyScannedPdfText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const digitCount = (normalized.match(/\d/g) ?? []).length;
  const alphaCount = (normalized.match(/[a-z]/gi) ?? []).length;

  return normalized.length < 40 || (digitCount > 0 && alphaCount < 12);
}

export function getPdfImportErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "PasswordException"
  ) {
    return "This PDF is password-protected. Remove the password or export a text statement before importing.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not read that PDF.";
}

export function buildPdfExtractionWarnings({
  pageCount,
  text,
  usedOcr,
}: {
  pageCount: number;
  text: string;
  usedOcr: boolean;
}) {
  const warnings: string[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();

  if (usedOcr) {
    warnings.push("OCR was used, so scheme names, units, and decimal values should be checked carefully.");
  }

  if (usedOcr && pageCount > 3) {
    warnings.push("Only the first 3 PDF pages are sent through OCR today, so longer statements may need a cleaner export.");
  }

  if (normalized.length < 80) {
    warnings.push("Very little text was extracted from this PDF. A text-based statement or CSV export will import more reliably.");
  }

  if (!/\b(current value|invested value|scheme name|security name|units|nav|isin|folio)\b/i.test(normalized)) {
    warnings.push("The extracted text does not clearly show standard holding columns yet, so review before importing.");
  }

  return warnings;
}
