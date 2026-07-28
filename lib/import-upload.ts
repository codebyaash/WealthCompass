export type ImportUploadExtraction = {
  fileName?: string;
  isPdf?: boolean;
  pageCount: number;
  text: string;
  usedOcr: boolean;
  warnings: string[];
};

export function resolveUploadedImportText({
  extractedUpload,
  fallbackPdfResult,
  fileText,
}: {
  extractedUpload: ImportUploadExtraction | null;
  fallbackPdfResult: ImportUploadExtraction | null;
  fileText: string;
}) {
  const resolvedText =
    extractedUpload?.text ?? fallbackPdfResult?.text ?? fileText;

  return {
    pageCount: extractedUpload?.pageCount ?? fallbackPdfResult?.pageCount ?? 0,
    text: stripExecutableHtmlTags(resolvedText),
    usedOcr: extractedUpload?.usedOcr ?? fallbackPdfResult?.usedOcr ?? false,
    warnings: extractedUpload?.warnings ?? fallbackPdfResult?.warnings ?? [],
  };
}

function stripExecutableHtmlTags(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .trim();
}
