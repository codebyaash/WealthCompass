type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type PdfPageViewport = {
  height: number;
  width: number;
};

type PdfPage = {
  getTextContent: () => Promise<{
    items: PdfTextItem[];
  }>;
  getViewport: (options: { scale: number }) => PdfPageViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfPageViewport;
  }) => {
    promise: Promise<void>;
  };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfJsModule = {
  getDocument: (source: { data: Uint8Array }) => {
    promise: Promise<PdfDocument>;
  };
};

type OcrWorker = {
  recognize: (
    image: HTMLCanvasElement,
  ) => Promise<{
    data: {
      text: string;
    };
  }>;
  terminate: () => Promise<unknown>;
};

type TesseractModule = {
  createWorker: (language: string) => Promise<OcrWorker>;
};

export type PdfExtractResult = {
  pageCount: number;
  text: string;
  usedOcr: boolean;
  warnings: string[];
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let tesseractModulePromise: Promise<TesseractModule> | null = null;

async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("pdfjs-dist/webpack.mjs") as unknown as Promise<PdfJsModule>;
  }

  return pdfJsModulePromise;
}

async function loadTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import("tesseract.js") as unknown as Promise<TesseractModule>;
  }

  return tesseractModulePromise;
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = pdf.numPages;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(groupPdfItemsIntoLines(textContent.items));
    }

    const text = pages.join("\n").trim();

    if (!isLikelyScannedPdfText(text)) {
      return {
        pageCount,
        text,
        usedOcr: false,
        warnings: buildPdfExtractionWarnings({
          pageCount,
          text,
          usedOcr: false,
        }),
      };
    }

    const ocrText = await extractTextWithOcr(pdf);
    const normalizedOcrText = ocrText.trim();

    return {
      pageCount,
      text: normalizedOcrText,
      usedOcr: true,
      warnings: buildPdfExtractionWarnings({
        pageCount,
        text: normalizedOcrText,
        usedOcr: true,
      }),
    };
  } catch (error) {
    throw new Error(getPdfImportErrorMessage(error));
  }
}

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

async function extractTextWithOcr(pdf: PdfDocument) {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker("eng");
  const texts: string[] = [];

  try {
    const pageCount = Math.min(pdf.numPages, 3);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");

      if (!context) continue;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const result = await worker.recognize(canvas);
      texts.push(result.data.text);
    }
  } finally {
    await worker.terminate();
  }

  return texts.join("\n");
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

  if (pageCount > 3) {
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
