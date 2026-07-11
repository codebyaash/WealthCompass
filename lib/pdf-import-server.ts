import {
  buildPdfExtractionWarnings,
  getPdfImportErrorMessage,
  isLikelyScannedPdfText,
  type PdfExtractResult,
} from "./pdf-import-shared";

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type PdfPage = {
  getTextContent: () => Promise<{
    items: PdfTextItem[];
  }>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfJsModule = {
  getDocument: (source: { data: Uint8Array; useSystemFonts?: boolean }) => {
    promise: Promise<PdfDocument>;
  };
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

async function loadServerPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfJsModule>;
  }

  return pdfJsModulePromise;
}

export async function extractTextFromPdfBuffer(
  data: Uint8Array,
  loader: () => Promise<PdfJsModule> = loadServerPdfJs,
): Promise<PdfExtractResult> {
  const pdfjs = await loader();

  try {
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pageCount = pdf.numPages;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(groupPdfItemsIntoLines(textContent.items));
    }

    const text = pages.join("\n").trim();
    const warnings = buildPdfExtractionWarnings({
      pageCount,
      text,
      usedOcr: false,
    });

    if (isLikelyScannedPdfText(text)) {
      warnings.unshift(
        "Server-side PDF text extraction found weak text, and OCR is not configured on the inbound worker yet.",
      );
    }

    return {
      pageCount,
      text,
      usedOcr: false,
      warnings,
    };
  } catch (error) {
    throw new Error(getPdfImportErrorMessage(error));
  }
}

function groupPdfItemsIntoLines(items: PdfTextItem[]) {
  const rows: Array<{
    y: number;
    columns: Array<{ text: string; x: number }>;
  }> = [];
  const tolerance = 2;

  for (const item of items) {
    const text = item.str?.trim();

    if (!text) continue;

    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? rows.length * -10;
    const row = rows.find((entry) => Math.abs(entry.y - y) <= tolerance);

    if (row) {
      row.columns.push({ text, x });
      continue;
    }

    rows.push({
      y,
      columns: [{ text, x }],
    });
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) =>
      row.columns
        .sort((left, right) => left.x - right.x)
        .map((column) => column.text)
        .join("\t"),
    )
    .join("\n");
}
