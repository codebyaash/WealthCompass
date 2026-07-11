import {
  ingestEmailStatement,
  type EmailIngestionAttachment,
  type EmailIngestionPayload,
  type EmailIngestionResult,
} from "./email-ingestion";
import { extractTextFromPdfBuffer } from "./pdf-import-server";
import {
  applyPdfOcrResult,
  shouldAttemptPdfOcr,
  type PdfOcrContext,
  type PdfOcrResult,
} from "./pdf-ocr";

export type InboundEmailAttachmentPayload = {
  base64?: string;
  contentType?: string;
  extractedText?: string;
  fileName: string;
  html?: string;
  ocrText?: string;
  ocrWarnings?: string[];
  text?: string;
};

export type InboundEmailPayload = {
  attachments?: InboundEmailAttachmentPayload[];
  from: string;
  html?: string;
  messageId?: string;
  receivedAt?: string;
  subject: string;
  text?: string;
  to?: string;
};

export type InboundEmailProcessingResult = {
  attachmentCount: number;
  messageId: string | null;
  result: EmailIngestionResult;
};

export async function processInboundEmail(
  payload: InboundEmailPayload,
  options: {
    pdfOcrExtractor?: (context: PdfOcrContext) => Promise<PdfOcrResult | null>;
    pdfExtractor?: typeof extractTextFromPdfBuffer;
  } = {},
): Promise<InboundEmailProcessingResult> {
  const attachments = await Promise.all(
    (payload.attachments ?? []).map((attachment) =>
      normalizeInboundAttachment(attachment, {
        pdfExtractor: options.pdfExtractor ?? extractTextFromPdfBuffer,
        pdfOcrExtractor: options.pdfOcrExtractor,
      }),
    ),
  );
  const emailPayload: EmailIngestionPayload = {
    attachments: attachments.filter(
      (attachment) => attachment.fileName.trim() && resolveAttachmentPayloadText(attachment).trim(),
    ),
    bodyText: deriveEmailBodyText(payload),
    from: payload.from,
    receivedAt: payload.receivedAt,
    subject: payload.subject,
  };

  return {
    attachmentCount: emailPayload.attachments?.length ?? 0,
    messageId: payload.messageId ?? null,
    result: ingestEmailStatement(emailPayload),
  };
}

async function normalizeInboundAttachment(
  attachment: InboundEmailAttachmentPayload,
  options: {
    pdfExtractor: typeof extractTextFromPdfBuffer;
    pdfOcrExtractor?: (context: PdfOcrContext) => Promise<PdfOcrResult | null>;
  },
): Promise<EmailIngestionAttachment> {
  const fileName = attachment.fileName || "email-attachment.txt";
  const contentType = attachment.contentType ?? inferContentTypeFromFileName(fileName);

  if (attachment.extractedText?.trim()) {
    return {
      contentType,
      extractedText: attachment.extractedText,
      fileName,
      usedOcr: false,
    };
  }

  if (attachment.text?.trim()) {
    return {
      contentType,
      extractedText: attachment.text,
      fileName,
      usedOcr: false,
    };
  }

  if (attachment.html?.trim()) {
    return {
      contentType,
      extractedText: htmlToText(attachment.html),
      fileName,
      usedOcr: false,
    };
  }

  if (attachment.base64?.trim()) {
    if (isPdfAttachment(fileName, contentType)) {
      const pdfData = decodeBase64ToUint8Array(attachment.base64);
      const extraction = await options.pdfExtractor(pdfData);
      const ocrExtraction = await maybeRunPdfOcr({
        attachment,
        contentType,
        extraction,
        fileName,
        pdfData,
        pdfOcrExtractor: options.pdfOcrExtractor,
      });
      const finalExtraction = ocrExtraction ?? extraction;

      return {
        contentType,
        extractedText: finalExtraction.text,
        extractionWarnings: finalExtraction.warnings,
        fileName,
        pageCount: finalExtraction.pageCount,
        usedOcr: finalExtraction.usedOcr,
      };
    }

    const decodedText = decodeBase64ToUtf8(attachment.base64);
    return {
      contentType,
      extractedText: contentType === "text/html" ? htmlToText(decodedText) : decodedText,
      fileName,
      usedOcr: false,
    };
  }

  return {
    contentType,
    extractedText: "",
    fileName,
    usedOcr: false,
  };
}

function deriveEmailBodyText(payload: InboundEmailPayload) {
  if (payload.text?.trim()) return payload.text;
  if (payload.html?.trim()) return htmlToText(payload.html);
  return "";
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferContentTypeFromFileName(fileName: string) {
  if (fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (fileName.toLowerCase().endsWith(".html") || fileName.toLowerCase().endsWith(".htm")) {
    return "text/html";
  }
  if (fileName.toLowerCase().endsWith(".csv")) return "text/csv";
  return "text/plain";
}

function isPdfAttachment(fileName: string, contentType?: string) {
  return contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

function decodeBase64ToUtf8(value: string) {
  return Buffer.from(stripDataUriPrefix(value), "base64").toString("utf8");
}

function decodeBase64ToUint8Array(value: string) {
  return Uint8Array.from(Buffer.from(stripDataUriPrefix(value), "base64"));
}

function stripDataUriPrefix(value: string) {
  return value.replace(/^data:[^;]+;base64,/i, "");
}

function resolveAttachmentPayloadText(attachment: EmailIngestionAttachment) {
  return attachment.extractedText ?? attachment.text ?? "";
}

async function maybeRunPdfOcr({
  attachment,
  contentType,
  extraction,
  fileName,
  pdfData,
  pdfOcrExtractor,
}: {
  attachment: InboundEmailAttachmentPayload;
  contentType: string;
  extraction: Awaited<ReturnType<typeof extractTextFromPdfBuffer>>;
  fileName: string;
  pdfData: Uint8Array;
  pdfOcrExtractor?: (context: PdfOcrContext) => Promise<PdfOcrResult | null>;
}) {
  if (!shouldAttemptPdfOcr(extraction)) {
    return null;
  }

  if (attachment.ocrText?.trim()) {
    return applyPdfOcrResult({
      extraction,
      ocr: {
        text: attachment.ocrText,
        warnings: attachment.ocrWarnings ?? [],
      },
    });
  }

  if (!pdfOcrExtractor) {
    return null;
  }

  const ocrResult = await pdfOcrExtractor({
    attachmentName: fileName,
    base64: attachment.base64,
    contentType,
    existingExtraction: extraction,
    pdfData,
  });

  if (!ocrResult?.text.trim()) {
    return null;
  }

  return applyPdfOcrResult({
    extraction,
    ocr: ocrResult,
  });
}
