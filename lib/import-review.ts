import {
  describeReadiness,
  detectImportSource,
  type ImportSourceDescriptor,
} from "./import-sources";
import {
  getProviderParserProfile,
  type ProviderParserProfile,
} from "./provider-parser-profiles";
import { parseImportedTransactions } from "./transaction-import";

export type ImportDocumentKind =
  | "broker-export"
  | "email-statement"
  | "pdf-statement"
  | "table-export"
  | "unclassified";

export type ImportReview = {
  cues: string[];
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  guidance: string[];
  normalizationApplied: string[];
  operatorFocus?: {
    detail: string;
    label: string;
    tone: "attention" | "healthy" | "idle";
  };
  parserProfile: ProviderParserProfile | null;
  parseReadiness: "high" | "low" | "medium";
  providerConfidence: "high" | "low" | "medium";
  qualityScore: number;
  summary: string;
  textLength: number;
  transactionCount: number;
  usedOcr: boolean;
};

export function analyzeImportDocument({
  normalizationApplied = [],
  fileName,
  text,
  usedOcr = false,
}: {
  fileName?: string;
  normalizationApplied?: string[];
  text: string;
  usedOcr?: boolean;
}): ImportReview {
  const detectedSource = detectImportSource({ fileName, text });
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const lowerText = normalizedText.toLowerCase();
  const cues = collectCues(lowerText, fileName, usedOcr);
  const documentKind = classifyDocumentKind(lowerText, fileName);
  const transactionPreview = parseImportedTransactions(text);
  const transactionCount = transactionPreview.transactions.length;
  const qualityScore = calculateQualityScore({
    cues,
    detectedSource,
    lowerText,
    transactionCount,
    usedOcr,
  });
  const parseReadiness =
    qualityScore >= 80 ? "high" : qualityScore >= 50 ? "medium" : "low";
  const providerConfidence =
    detectedSource && cues.length >= 2 ? "high" : detectedSource ? "medium" : "low";
  const parserProfile = getProviderParserProfile(detectedSource?.id);
  const hasTransactionSummaryMarkers =
    /transaction summary|investment activity|fresh purchase|withdrawal|redemption|purchase summary/.test(
      lowerText,
    );
  const hasHoldingsValueColumns =
    /current value|market value|invested value/.test(lowerText);
  const guidance = buildGuidance({
    lowerText,
    detectedSource,
    documentKind,
    normalizationApplied,
    parserProfile,
    parseReadiness,
    transactionCount,
    usedOcr,
  });
  const operatorFocus = buildOperatorFocus({
    detectedSource,
    documentKind,
    hasHoldingsValueColumns,
    hasTransactionSummaryMarkers,
    normalizationApplied,
    parseReadiness,
    providerConfidence,
    transactionCount,
    usedOcr,
  });

  return {
    cues,
    detectedSource,
    documentKind,
    guidance,
    normalizationApplied,
    operatorFocus,
    parserProfile,
    parseReadiness,
    providerConfidence,
    qualityScore,
    summary: buildSummary({
      detectedSource,
      documentKind,
      parseReadiness,
      qualityScore,
      transactionCount,
    }),
    textLength: normalizedText.length,
    transactionCount,
    usedOcr,
  };
}

function buildOperatorFocus({
  detectedSource,
  documentKind,
  hasHoldingsValueColumns,
  hasTransactionSummaryMarkers,
  normalizationApplied,
  parseReadiness,
  providerConfidence,
  transactionCount,
  usedOcr,
}: {
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  hasHoldingsValueColumns: boolean;
  hasTransactionSummaryMarkers: boolean;
  normalizationApplied: string[];
  parseReadiness: "high" | "low" | "medium";
  providerConfidence: "high" | "low" | "medium";
  transactionCount: number;
  usedOcr: boolean;
}): NonNullable<ImportReview["operatorFocus"]> {
  if (hasTransactionSummaryMarkers && !hasHoldingsValueColumns) {
    return transactionCount > 0
      ? {
          detail:
            "Transactions can be imported now, but current value tracking still needs the holdings section from the same statement or a portfolio export.",
          label: "Transactions only",
          tone: "attention" as const,
        }
      : {
          detail:
            "This looks like activity-only text. Add the holdings table or statement page that lists each fund or security with current value.",
          label: "Holdings section missing",
          tone: "attention" as const,
        };
  }

  if (documentKind === "pdf-statement" && usedOcr) {
    return {
      detail:
        "OCR recovered the text, so scheme names, units, and decimal-heavy values should get a quick human check before import.",
      label: "OCR check",
      tone: "attention",
    };
  }

  if (!detectedSource || providerConfidence === "low") {
    return {
      detail:
        "Provider detection is still weak. Review the preview carefully and prefer a cleaner export or clearer statement text if the rows look off.",
      label: "Provider fit weak",
      tone: "attention",
    };
  }

  if (parseReadiness === "low") {
    return {
      detail:
        "The source still needs cleanup before it is likely to import cleanly. A text export or cleaner pasted table should work better.",
      label: "Need cleaner source",
      tone: "attention",
    };
  }

  if (normalizationApplied.length > 0) {
    return {
      detail:
        "Cleanup improved the source structure. Review the parsed rows once before importing, especially if headers or footers were stripped.",
      label: "Cleanup changed source",
      tone: "idle",
    };
  }

  if (parseReadiness === "medium") {
    return {
      detail:
        "The structure looks usable, but one quick preview pass is still worth it before importing or staging the result.",
      label: "Quick review",
      tone: "idle",
    };
  }

  return {
    detail:
      transactionCount > 0
        ? "The source looks strong enough to review holdings and transactions together."
        : "The source looks strong enough to review and import from here.",
    label: "Ready to review",
    tone: "healthy",
  };
}

function classifyDocumentKind(
  lowerText: string,
  fileName?: string,
): ImportDocumentKind {
  const lowerFileName = fileName?.toLowerCase() ?? "";

  if (
    lowerFileName.endsWith(".csv") ||
    lowerText.includes("scheme name,") ||
    lowerText.includes("security name,")
  ) {
    return "broker-export";
  }

  if (
    lowerText.includes("forwarded message") ||
    lowerText.includes("from:") ||
    lowerText.includes("subject:")
  ) {
    return "email-statement";
  }

  if (lowerFileName.endsWith(".pdf")) {
    return "pdf-statement";
  }

  if (
    lowerText.includes("\t") ||
    /scheme name|security name|current value|invested value|market value/.test(lowerText)
  ) {
    return "table-export";
  }

  return "unclassified";
}

function collectCues(lowerText: string, fileName: string | undefined, usedOcr: boolean) {
  const cues: string[] = [];

  if (fileName?.toLowerCase().endsWith(".pdf")) cues.push("PDF upload");
  if (usedOcr) cues.push("OCR applied");
  if (/current value|market value|invested value|scheme name|security name/.test(lowerText)) {
    cues.push("Holding columns detected");
  }
  if (/forwarded message|from:|subject:|statement attached/.test(lowerText)) {
    cues.push("Email statement markers");
  }
  if (/folio|isin|nav|ltp|units/.test(lowerText)) {
    cues.push("Investment statement terms");
  }
  if (/transaction summary|investment activity|fresh purchase|withdrawal|redemption|purchase summary/.test(lowerText)) {
    cues.push("Transaction summary markers");
  }

  return cues;
}

function calculateQualityScore({
  cues,
  detectedSource,
  lowerText,
  transactionCount,
  usedOcr,
}: {
  cues: string[];
  detectedSource: ImportSourceDescriptor | null;
  lowerText: string;
  transactionCount: number;
  usedOcr: boolean;
}) {
  let score = 20;

  if (detectedSource) score += 25;
  if (cues.includes("Holding columns detected")) score += 25;
  if (cues.includes("Investment statement terms")) score += 15;
  if (cues.includes("Email statement markers")) score += 10;
  if (transactionCount > 0) score += 20;
  if (lowerText.length >= 120) score += 10;
  if (usedOcr) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function buildGuidance({
  lowerText,
  detectedSource,
  documentKind,
  normalizationApplied,
  parserProfile,
  parseReadiness,
  transactionCount,
  usedOcr,
}: {
  lowerText: string;
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  normalizationApplied: string[];
  parserProfile: ProviderParserProfile | null;
  parseReadiness: "high" | "low" | "medium";
  transactionCount: number;
  usedOcr: boolean;
}) {
  const guidance: string[] = [];
  const hasTransactionSummaryMarkers =
    /transaction summary|investment activity|fresh purchase|withdrawal|redemption|purchase summary/.test(
      lowerText,
    );
  const hasHoldingsValueColumns =
    /current value|market value|invested value/.test(lowerText);

  if (detectedSource) {
    guidance.push(
      `${detectedSource.name} is supported through ${describeReadiness(detectedSource.readiness).toLowerCase()}.`,
    );
  } else {
    guidance.push("Provider not confidently detected yet, so review the preview before importing.");
  }

  if (documentKind === "email-statement") {
    guidance.push("Keep the holdings section and trim long email footers if the preview looks noisy.");
  }

  if (hasTransactionSummaryMarkers && !hasHoldingsValueColumns) {
    if (transactionCount > 0) {
      guidance.push(
        `This looks like a transaction or activity summary, but ${transactionCount} transaction${transactionCount === 1 ? "" : "s"} can already be imported from it. Add the holdings section too if you want current value tracking in the same pass.`,
      );
    } else {
      guidance.push(
        "This looks like a transaction or activity summary, not the holdings section. Paste the portfolio holdings table or upload the statement page that lists each fund/security with current value.",
      );
    }
  }

  if (documentKind === "pdf-statement" && usedOcr) {
    guidance.push("Because OCR was used, double-check scheme names, units, and decimal values.");
  }

  if (parseReadiness === "low") {
    guidance.push("A cleaner export, copied table, or text-based PDF will import more reliably.");
  }

  if (parserProfile) {
    guidance.push(`Best input for ${parserProfile.name}: ${parserProfile.bestInputs[0]}.`);
  }

  if (normalizationApplied.length > 0) {
    guidance.push(`Cleanup applied: ${normalizationApplied[0]}.`);
  }

  return guidance;
}

function buildSummary({
  detectedSource,
  documentKind,
  parseReadiness,
  qualityScore,
  transactionCount,
}: {
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  parseReadiness: "high" | "low" | "medium";
  qualityScore: number;
  transactionCount: number;
}) {
  const sourceLabel = detectedSource?.name ?? "Unknown provider";
  const importableLabel =
    transactionCount > 0
      ? `can import ${transactionCount} transaction${transactionCount === 1 ? "" : "s"} and`
      : "";
  const readinessLabel =
    parseReadiness === "high"
      ? "looks import-ready"
      : parseReadiness === "medium"
        ? "needs a quick review"
        : "needs cleanup before import";

  return `${sourceLabel} ${documentKind.replace("-", " ")} ${importableLabel} ${readinessLabel} (${qualityScore}/100).`
    .replace(/\s+/g, " ")
    .trim();
}
