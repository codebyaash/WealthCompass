import {
  describeReadiness,
  detectImportSource,
  type ImportSourceDescriptor,
} from "./import-sources";
import {
  getProviderParserProfile,
  type ProviderParserProfile,
} from "./provider-parser-profiles";

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
  parserProfile: ProviderParserProfile | null;
  parseReadiness: "high" | "low" | "medium";
  providerConfidence: "high" | "low" | "medium";
  qualityScore: number;
  summary: string;
  textLength: number;
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
  const qualityScore = calculateQualityScore({
    cues,
    detectedSource,
    lowerText,
    usedOcr,
  });
  const parseReadiness =
    qualityScore >= 80 ? "high" : qualityScore >= 50 ? "medium" : "low";
  const providerConfidence =
    detectedSource && cues.length >= 2 ? "high" : detectedSource ? "medium" : "low";
  const parserProfile = getProviderParserProfile(detectedSource?.id);
  const guidance = buildGuidance({
    lowerText,
    detectedSource,
    documentKind,
    normalizationApplied,
    parserProfile,
    parseReadiness,
    usedOcr,
  });

  return {
    cues,
    detectedSource,
    documentKind,
    guidance,
    normalizationApplied,
    parserProfile,
    parseReadiness,
    providerConfidence,
    qualityScore,
    summary: buildSummary({
      detectedSource,
      documentKind,
      parseReadiness,
      qualityScore,
    }),
    textLength: normalizedText.length,
    usedOcr,
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
  usedOcr,
}: {
  cues: string[];
  detectedSource: ImportSourceDescriptor | null;
  lowerText: string;
  usedOcr: boolean;
}) {
  let score = 20;

  if (detectedSource) score += 25;
  if (cues.includes("Holding columns detected")) score += 25;
  if (cues.includes("Investment statement terms")) score += 15;
  if (cues.includes("Email statement markers")) score += 10;
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
  usedOcr,
}: {
  lowerText: string;
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  normalizationApplied: string[];
  parserProfile: ProviderParserProfile | null;
  parseReadiness: "high" | "low" | "medium";
  usedOcr: boolean;
}) {
  const guidance: string[] = [];

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

  if (
    /transaction summary|investment activity|fresh purchase|withdrawal|redemption|purchase summary/.test(
      lowerText,
    ) &&
    !/scheme name|security name|current value|market value|invested value/.test(lowerText)
  ) {
    guidance.push(
      "This looks like a transaction or activity summary, not the holdings section. Paste the portfolio holdings table or upload the statement page that lists each fund/security with current value.",
    );
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
}: {
  detectedSource: ImportSourceDescriptor | null;
  documentKind: ImportDocumentKind;
  parseReadiness: "high" | "low" | "medium";
  qualityScore: number;
}) {
  const sourceLabel = detectedSource?.name ?? "Unknown provider";
  const readinessLabel =
    parseReadiness === "high"
      ? "looks import-ready"
      : parseReadiness === "medium"
        ? "needs a quick review"
        : "needs cleanup before import";

  return `${sourceLabel} ${documentKind.replace("-", " ")} ${readinessLabel} (${qualityScore}/100).`;
}
