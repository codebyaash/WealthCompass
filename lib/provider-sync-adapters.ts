import { describeReadiness, importSourceDescriptors } from "./import-sources";
import { analyzeImportDocument } from "./import-review";
import { normalizeImportTextForProvider } from "./provider-import-normalizers";
import { previewPortfolioImport } from "./csv-import";
import type { ImportJob } from "./local-storage";
import type { IntegrationConnection } from "./local-storage";

export type SyncExecutionStage =
  | "authenticate"
  | "ingest"
  | "normalize"
  | "review"
  | "schedule";

export type ProviderSyncPreview = {
  connectorStatus: "manual" | "planned" | "ready";
  providerId: string;
  providerName: string;
  readinessLabel: string;
  recommendedFiles: string[];
  risks: string[];
  steps: Array<{
    detail: string;
    stage: SyncExecutionStage;
    title: string;
  }>;
  summary: string;
};

export type ProviderSyncExecutionResult = {
  artifacts: Array<{
    kind: "csv" | "email" | "payload" | "pdf" | "text";
    label: string;
    preview: string;
  }>;
  connectorStatus: ProviderSyncPreview["connectorStatus"];
  detectedProviderSummary: string;
  importedFileCount: number;
  jobStatus: ImportJob["status"];
  message: string;
  providerId: string;
  providerName: string;
  reviewedWarnings: string[];
  sourceLineage: string[];
  steps: Array<
    ProviderSyncPreview["steps"][number] & {
      status: "completed" | "pending";
    }
  >;
  summary: string;
};

export type ProviderSyncInput = {
  fileName?: string;
  sourceText?: string;
  usedOcr?: boolean;
};

export function buildProviderSyncPreview(
  connection: IntegrationConnection,
): ProviderSyncPreview {
  const source = importSourceDescriptors.find(
    (descriptor) => descriptor.id === connection.providerId,
  );
  const steps = getProviderSteps(connection);
  const readiness = source?.readiness ?? "guided-import";

  return {
    connectorStatus: getConnectorStatus(connection, readiness),
    providerId: connection.providerId,
    providerName: connection.providerName,
    readinessLabel: describeReadiness(readiness),
    recommendedFiles: getRecommendedFiles(connection),
    risks: getProviderRisks(connection),
    steps,
    summary:
      source?.summary ??
      `${connection.providerName} can flow through the guided import pipeline with provider-specific review.`,
  };
}

export function executeProviderSync(
  connection: IntegrationConnection,
  input: ProviderSyncInput = {},
): ProviderSyncExecutionResult {
  const preview = buildProviderSyncPreview(connection);
  const normalized = input.sourceText
    ? normalizeImportTextForProvider({
        providerId: connection.providerId,
        text: input.sourceText,
      })
    : null;
  const review = normalized
    ? analyzeImportDocument({
        fileName: input.fileName,
        normalizationApplied: normalized.applied,
        text: normalized.text,
        usedOcr: input.usedOcr ?? false,
      })
    : null;
  const importPreview = normalized
    ? previewPortfolioImport(normalized.text, [])
    : null;
  const isEmail = connection.importStrategy === "email-forward";
  const isCsv = connection.importStrategy === "csv-upload";
  const isDirect = connection.importStrategy === "sync-ready";
  const importedFileCount =
    importPreview?.assets.length ??
    (isDirect ? 0 : isEmail ? 2 : 1);
  const reviewedWarnings = importPreview
    ? [
        ...importPreview.errors,
        ...importPreview.duplicates.map(
          ({ importedAsset }) =>
            `Duplicate detected for ${importedAsset.name} (${importedAsset.type}).`,
        ),
      ]
    : isEmail
    ? [
        "Email chains can include footer noise and repeated disclaimers.",
        "Attachment OCR may still need a quick decimal and unit review.",
      ]
    : isDirect
      ? ["Direct connector auth is still pending before live account fetches can begin."]
      : ["Duplicate folios or repeated holdings should still be reviewed before merge."];

  return {
    artifacts: getExecutionArtifacts(connection, {
      fileName: input.fileName,
      importPreview,
      normalizedText: normalized?.text,
      sourceText: input.sourceText,
    }),
    connectorStatus: preview.connectorStatus,
    detectedProviderSummary: review?.summary ?? preview.summary,
    importedFileCount,
    jobStatus:
      importPreview?.assets.length
        ? "reviewed"
        : preview.connectorStatus === "ready"
          ? "reviewed"
          : isDirect
            ? "received"
            : "received",
    message: input.sourceText
      ? `${connection.providerName} analyzed ${input.fileName || "provided source text"} and prepared ${importedFileCount} import candidate${importedFileCount === 1 ? "" : "s"}.`
      : isDirect
      ? `${connection.providerName} prepared its direct-sync lane, but account fetch auth is still pending.`
      : isEmail
        ? `${connection.providerName} gathered forwarded email content and attachment-ready inputs for review.`
        : isCsv
          ? `${connection.providerName} prepared a broker export payload for import review.`
          : `${connection.providerName} prepared a statement-driven payload for import review.`,
    providerId: connection.providerId,
    providerName: connection.providerName,
    reviewedWarnings,
    sourceLineage: input.sourceText
      ? [
          `${input.fileName || "Manual source text"} received`,
          ...(normalized?.applied.length
            ? [`Normalization applied: ${normalized.applied.join("; ")}`]
            : ["No provider cleanup was required"]),
          review ? `Import review classified this as ${review.documentKind}` : "Import review pending",
        ]
      : isDirect
      ? [
          "Connector schedule created",
          "Provider auth placeholder reserved",
          "Live account fetch deferred until direct credentials exist",
        ]
      : isEmail
        ? [
            "Forwarded email body collected",
            "Attachment-ready input prepared",
            "Normalized statement text handed to import review",
          ]
        : isCsv
          ? [
              "Broker export requested",
              "Delimited payload staged",
              "CSV normalization handed to import review",
            ]
          : [
              "Statement file lane selected",
              "Provider payload normalized",
              "Statement text handed to import review",
            ],
    steps: preview.steps.map((step, index) => ({
      ...step,
      status: isDirect && index > 1 ? "pending" : "completed",
    })),
    summary: review?.summary ?? preview.summary,
  };
}

function getProviderSteps(connection: IntegrationConnection) {
  const commonSteps = [
    {
      detail: `Check ${connection.providerName} connection status and cadence before collecting new files.`,
      stage: "schedule" as const,
      title: "Schedule sync run",
    },
    {
      detail: `Normalize provider-specific headings and duplicate patterns for ${connection.providerName}.`,
      stage: "normalize" as const,
      title: "Clean provider payload",
    },
    {
      detail: "Run import review, duplicate detection, and parser warnings before applying holdings.",
      stage: "review" as const,
      title: "Review import quality",
    },
  ];

  switch (connection.importStrategy) {
    case "email-forward":
      return [
        {
          detail: "Collect forwarded statement emails and attachment text from the guided intake flow.",
          stage: "ingest" as const,
          title: "Collect forwarded statements",
        },
        ...commonSteps,
      ];
    case "csv-upload":
      return [
        {
          detail: "Expect a fresh CSV/TSV export from the provider before the sync checkpoint is marked complete.",
          stage: "ingest" as const,
          title: "Request broker export",
        },
        ...commonSteps,
      ];
    case "sync-ready":
      return [
        {
          detail: "Reserve an authentication slot for future OAuth or partner API connectors.",
          stage: "authenticate" as const,
          title: "Prepare connector auth",
        },
        {
          detail: "Fetch account payloads once a direct connector is available.",
          stage: "ingest" as const,
          title: "Fetch account payload",
        },
        ...commonSteps,
      ];
    case "statement-upload":
    default:
      return [
        {
          detail: "Expect a PDF or statement upload from the provider intake lane.",
          stage: "ingest" as const,
          title: "Collect statement file",
        },
        ...commonSteps,
      ];
  }
}

function getRecommendedFiles(connection: IntegrationConnection) {
  switch (connection.importStrategy) {
    case "email-forward":
      return ["Forwarded email body", "PDF attachment", "Copied table text"];
    case "csv-upload":
      return ["Broker CSV export", "TSV holdings export"];
    case "sync-ready":
      return ["API payload later", "Fallback CSV export", "Statement PDF"];
    case "statement-upload":
    default:
      return ["Account statement PDF", "Registrar statement PDF", "Copied statement table"];
  }
}

function getConnectorStatus(
  connection: IntegrationConnection,
  readiness: "guided-import" | "planned-direct" | "ready-now",
) {
  if (connection.importStrategy === "sync-ready") return "planned";

  if (readiness === "ready-now") return "ready";
  if (readiness === "planned-direct") return "planned";
  return "manual";
}

function getExecutionArtifacts(
  connection: IntegrationConnection,
  {
    fileName,
    importPreview,
    normalizedText,
    sourceText,
  }: {
    fileName?: string;
    importPreview?: ReturnType<typeof previewPortfolioImport> | null;
    normalizedText?: string | null;
    sourceText?: string;
  },
) {
  if (sourceText) {
    return [
      {
        kind: fileName?.toLowerCase().endsWith(".csv") ? "csv" as const : fileName?.toLowerCase().endsWith(".pdf") ? "pdf" as const : "text" as const,
        label: fileName || "Provided source text",
        preview: sourceText.slice(0, 280),
      },
      {
        kind: "text" as const,
        label: "Normalized execution payload",
        preview: normalizedText?.slice(0, 280) ?? "",
      },
      {
        kind: "payload" as const,
        label: "Import candidates",
        preview: importPreview?.assets.length
          ? importPreview.assets
              .slice(0, 3)
              .map((asset) => `${asset.name} | ${asset.type} | ${asset.value}`)
              .join("\n")
          : "No holdings were parsed from the supplied source yet.",
      },
    ];
  }

  switch (connection.importStrategy) {
    case "email-forward":
      return [
        {
          kind: "email" as const,
          label: "Forwarded statement email",
          preview: "Forwarded message\nSubject: Monthly statement\nStatement attached from broker operations.",
        },
        {
          kind: "text" as const,
          label: "Normalized holdings block",
          preview: "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core\t180000\t158000\t734.69",
        },
      ];
    case "csv-upload":
      return [
        {
          kind: "csv" as const,
          label: "Broker export sample",
          preview: "scheme name,current value,invested value,units\nIndex Core,180000,158000,734.69",
        },
      ];
    case "sync-ready":
      return [
        {
          kind: "payload" as const,
          label: "Future API fetch slot",
          preview: "{ provider: \"sync-ready\", auth: \"pending\", fetch: \"deferred\" }",
        },
      ];
    case "statement-upload":
    default:
      return [
        {
          kind: "pdf" as const,
          label: "Statement file lane",
          preview: "Account statement PDF queued for OCR/text extraction and provider normalization.",
        },
        {
          kind: "text" as const,
          label: "Normalized statement table",
          preview: "Scheme Name\tCurrent Value\tInvested Value\tUnits\tNAV\nIndex Core\t180000\t158000\t734.69\t245",
        },
      ];
  }
}

function getProviderRisks(connection: IntegrationConnection) {
  const providerName = connection.providerName;

  if (connection.importStrategy === "email-forward") {
    return [
      `${providerName} email chains may include footer noise and repeated disclaimers.`,
      "Attachment OCR can introduce small decimal or unit errors.",
    ];
  }

  if (connection.importStrategy === "csv-upload") {
    return [
      `${providerName} exports may rename headers across app versions.`,
      "Duplicate folios or repeated holdings still need merge review.",
    ];
  }

  if (connection.importStrategy === "sync-ready") {
    return [
      "Direct connector auth is not wired yet, so this remains a staged plan.",
      "Fallback manual exports should stay available until API sync is proven.",
    ];
  }

  return [
    `${providerName} statement layouts can change and may require parser cleanup.`,
    "Scanned PDFs can still need OCR review before import.",
  ];
}
