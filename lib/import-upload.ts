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
  return {
    pageCount: extractedUpload?.pageCount ?? fallbackPdfResult?.pageCount ?? 0,
    text: extractedUpload?.text ?? fallbackPdfResult?.text ?? fileText,
    usedOcr: extractedUpload?.usedOcr ?? fallbackPdfResult?.usedOcr ?? false,
    warnings: extractedUpload?.warnings ?? fallbackPdfResult?.warnings ?? [],
  };
}
