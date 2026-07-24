"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Mail,
  Pencil,
  Plus,
  ScanSearch,
  Trash2,
  Upload,
} from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { Roadmap } from "@/components/wealth/roadmap";
import { HealthCheck } from "@/components/wealth/health-check";
import { MetricMini } from "@/components/wealth/metric-mini";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
import { Badge } from "@/components/ui/badge";
import {
  NumberField,
  SegmentedControl,
  TextField,
} from "@/components/wealth/form-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  applyPortfolioImport,
  portfolioAssetsToCsv,
  previewPortfolioImport,
  samplePortfolioCsv,
  type PortfolioImportMode,
} from "@/lib/csv-import";
import { buildCombinedImportOverview } from "@/lib/combined-import-overview";
import type { CombinedImportOverview } from "@/lib/combined-import-overview";
import { formatMoney } from "@/lib/formatters";
import {
  describeReadiness,
  detectImportSource,
  importSourceDescriptors,
} from "@/lib/import-sources";
import {
  resolveUploadedImportText,
  type ImportUploadExtraction,
} from "@/lib/import-upload";
import { normalizeImportTextForProvider } from "@/lib/provider-import-normalizers";
import { getProviderParserProfile } from "@/lib/provider-parser-profiles";
import {
  analyzeImportDocument,
  type ImportReview,
} from "@/lib/import-review";
import {
  createImportJobFromReview,
  filterNewImportedTransactions,
} from "@/lib/import-jobs";
import { buildImportDiagnostics, type ImportDiagnostics } from "@/lib/import-diagnostics";
import { parseImportedTransactions } from "@/lib/transaction-import";
import {
  createPortfolioTransaction,
  coercePortfolioAssets,
  type ImportJob,
  type PortfolioAsset,
  type PortfolioTransaction,
} from "@/lib/local-storage";
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
import {
  calculatePortfolioInvestedValue,
  getAllocationInsights,
  getPortfolioDiversificationScore,
  calculateRealizedGainFromTransactions,
  getPortfolioHealthChecks,
  summarizeTransactions,
} from "@/lib/portfolio-rules";
import type { RiskProfile } from "@/lib/wealth-rules";

type PdfExtractResult = ImportUploadExtraction;

const importModeOptions: Array<[PortfolioImportMode, string]> = [
  ["merge", "Merge duplicates"],
  ["add", "Keep all rows"],
];

const defaultDraftAsset: PortfolioAsset = {
  gain: 0,
  investedValue: 25000,
  name: "New index fund",
  price: 100,
  quantity: 250,
  source: "Manual",
  type: "Index Fund",
  value: 25000,
};

export type PortfolioFocusTarget =
  | "import-review"
  | "manual-entry"
  | "transaction-journal";
export type PortfolioReturnState = {
  csvText: string;
  importArtifacts: ImportDiagnostics | null;
  importReview: ImportReview | null;
  uploadedFileLabel: string | null;
  uploadedImportStatus: "idle" | "selected" | "processing" | "ready" | "error";
  uploadedImportText: string;
};

export function Portfolio({
  assets,
  focusRequest,
  focusRequestKey,
  returnState,
  mentorRevision,
  onAddAsset,
  onAddTransaction,
  onDeleteAsset,
  onDeleteTransaction,
  onImportAssets,
  onLogImportJob,
  onOpenMentor,
  onResetAssets,
  onUpdateAsset,
  portfolioTotal,
  profile,
  transactions,
}: {
  assets: PortfolioAsset[];
  focusRequest?: PortfolioFocusTarget | null;
  focusRequestKey?: number;
  returnState?: PortfolioReturnState | null;
  mentorRevision: number;
  onAddAsset: (asset: PortfolioAsset) => void;
  onAddTransaction: (transaction: PortfolioTransaction) => void;
  onDeleteAsset: (assetIndex: number) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportAssets: (assets: PortfolioAsset[]) => void;
  onLogImportJob: (job: ImportJob) => void;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  onResetAssets: () => void;
  onUpdateAsset: (assetIndex: number, asset: PortfolioAsset) => void;
  portfolioTotal: number;
  profile: RiskProfile;
  transactions: PortfolioTransaction[];
}) {
  const [draftAsset, setDraftAsset] = useState<PortfolioAsset>(defaultDraftAsset);
  const [csvText, setCsvText] = useState(samplePortfolioCsv);
  const [csvMessage, setCsvMessage] = useState(
    "Paste or upload portfolio exports, email statements, or broker spreadsheets.",
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [importMode, setImportMode] = useState<PortfolioImportMode>("merge");
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const [importArtifacts, setImportArtifacts] = useState<ImportDiagnostics | null>(null);
  const [selectedImportKeys, setSelectedImportKeys] = useState<string[]>([]);
  const [isReviewingImport, setIsReviewingImport] = useState(false);
  const [uploadedFileLabel, setUploadedFileLabel] = useState<string | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadedImportText, setUploadedImportText] = useState<string>("");
  const [uploadedImportStatus, setUploadedImportStatus] = useState<
    "idle" | "selected" | "processing" | "ready" | "error"
  >("idle");
  const [draftTransaction, setDraftTransaction] = useState<PortfolioTransaction>(
    createPortfolioTransaction(),
  );
  const manualEntryRef = useRef<HTMLDivElement | null>(null);
  const importReviewRef = useRef<HTMLDivElement | null>(null);
  const transactionJournalRef = useRef<HTMLDivElement | null>(null);
  const safeAssets = useMemo(() => coercePortfolioAssets(assets, []), [assets]);
  const exportedCsv = useMemo(() => portfolioAssetsToCsv(safeAssets), [safeAssets]);
  const hasUploadedImport = uploadedImportText.trim().length > 0;
  const activeImportText = hasUploadedImport ? uploadedImportText : csvText;
  const activeImportFileName = uploadedFileLabel?.trim() || "manual-import.txt";
  const importPreview = useMemo(
    () => previewPortfolioImport(activeImportText, safeAssets),
    [activeImportText, safeAssets],
  );
  const selectedImportedAssets = useMemo(
    () =>
      importPreview.assets.filter((asset, index) =>
        selectedImportKeys.includes(createImportSelectionKey(asset, index)),
      ),
    [importPreview.assets, selectedImportKeys],
  );
  const selectedDuplicateCount = useMemo(() => {
    const selectedAssetKeys = new Set(selectedImportedAssets.map(createImportAssetKey));

    return importPreview.duplicates.filter(({ importedAsset }) =>
      selectedAssetKeys.has(createImportAssetKey(importedAsset)),
    ).length;
  }, [importPreview.duplicates, selectedImportedAssets]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const asset of safeAssets) {
      grouped.set(asset.type, (grouped.get(asset.type) ?? 0) + asset.value);
    }

    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [safeAssets]);

  const portfolioChecks = getPortfolioHealthChecks({
    assets: safeAssets,
    portfolioTotal,
    profile,
  });
  const transactionSummary = useMemo(
    () => summarizeTransactions(transactions),
    [transactions],
  );
  const transactionImportPreview = useMemo(
    () => parseImportedTransactions(activeImportText),
    [activeImportText],
  );
  const newTransactionImportPreview = useMemo(
    () =>
      filterNewImportedTransactions(transactionImportPreview.transactions, transactions),
    [transactionImportPreview.transactions, transactions],
  );
  const duplicateTransactionCount = useMemo(
    () =>
      transactionImportPreview.transactions.length - newTransactionImportPreview.length,
    [newTransactionImportPreview.length, transactionImportPreview.transactions.length],
  );

  useEffect(() => {
    if (!focusRequest) return;

    window.requestAnimationFrame(() => {
      (
        {
          "import-review": importReviewRef,
          "manual-entry": manualEntryRef,
          "transaction-journal": transactionJournalRef,
        } satisfies Record<PortfolioFocusTarget, typeof importReviewRef>
      )[focusRequest]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [focusRequest, focusRequestKey]);

  useEffect(() => {
    if (!returnState) return;
    setCsvText(returnState.csvText);
    setImportArtifacts(returnState.importArtifacts);
    setImportReview(returnState.importReview);
    setUploadedFileLabel(returnState.uploadedFileLabel);
    setUploadedImportStatus(returnState.uploadedImportStatus);
    setUploadedImportText(returnState.uploadedImportText);
  }, [returnState, focusRequestKey]);
  const combinedImportOverview = useMemo(
    () =>
      buildCombinedImportOverview({
        preview: importPreview,
        selectedAssets: selectedImportedAssets,
        transactionDuplicateCount: duplicateTransactionCount,
        transactionParsedCount: transactionImportPreview.transactions.length,
        transactionReadyCount: newTransactionImportPreview.length,
      }),
    [
      duplicateTransactionCount,
      importPreview,
      newTransactionImportPreview.length,
      selectedImportedAssets,
      transactionImportPreview.transactions.length,
    ],
  );
  const realizedGain = useMemo(
    () => calculateRealizedGainFromTransactions(transactions),
    [transactions],
  );
  const investedValue = useMemo(
    () => calculatePortfolioInvestedValue(safeAssets),
    [safeAssets],
  );
  const unrealizedGain = useMemo(
    () => portfolioTotal - investedValue,
    [portfolioTotal, investedValue],
  );
  const diversificationScore = useMemo(
    () => getPortfolioDiversificationScore({ assets: safeAssets, portfolioTotal }),
    [portfolioTotal, safeAssets],
  );
  const allocationInsights = useMemo(
    () => getAllocationInsights({ assets: safeAssets, portfolioTotal, profile }),
    [portfolioTotal, profile, safeAssets],
  );
  const importTrack =
    profile.actionBaskets.find((basket) => basket.id === "activate") ??
    profile.actionBaskets[0];
  const learningTrack =
    profile.actionBaskets.find((basket) => basket.id === "understand") ??
    profile.actionBaskets[0];
  const portfolioMentorReturnState = {
    csvText,
    importArtifacts,
    importReview,
    uploadedFileLabel,
    uploadedImportStatus,
    uploadedImportText,
  } satisfies PortfolioReturnState;
  const importHelpLabel = hasUploadedImport
    ? "Ask AI mentor about this import"
    : "Ask AI mentor how to structure your portfolio";
  const portfolioHeadline =
    safeAssets.length === 0
      ? "Start with one holding or one imported statement"
      : safeAssets.length < 4
        ? "Keep building coverage before judging the portfolio too hard"
        : "Now you can judge mix, concentration, and alignment more usefully";
  const portfolioSubcopy =
    safeAssets.length === 0
      ? "The fastest useful start is either a single manual holding or an imported statement with current values and units."
      : safeAssets.length < 4
        ? "You already have a base. The next step is to capture more of the real portfolio so the health checks stop feeling approximate."
        : "Your portfolio has enough shape for the tracker, import review, and allocation checks to become more decision-useful.";
  const portfolioReadinessLabel =
    safeAssets.length === 0
      ? "Setup in progress"
      : importPreview.errors.length > 0 || transactionImportPreview.errors.length > 0
        ? "Needs review"
        : "Tracking live";
  const operatingHeadline =
    safeAssets.length === 0
      ? "Start with coverage, then let the tracker shape the portfolio story."
      : "Track what you own, what you paid, and where the mix is drifting.";
  const operatingSubcopy =
    safeAssets.length === 0
      ? "Load a statement, add a first holding, or start the transaction journal so allocation, health checks, and coaching can become specific."
      : "This page works best when holdings, invested basis, and transactions are all captured well enough to support cleaner allocation and health signals.";
  const operatingDeskMentorPrompt = hasUploadedImport
    ? [
        `I uploaded ${uploadedFileLabel ?? "a statement"} and the portfolio desk says "${operatingHeadline}".`,
        `Right now I have ${safeAssets.length} holdings, ${transactions.length} tracked transactions, and ${formatMoney(portfolioTotal)} in tracked value.`,
        importReview
          ? `The review reads ${importReview.providerConfidence ?? "unknown"} provider confidence with ${importReview.parseReadiness ?? "unknown"} readiness.`
          : "The import review has not been analyzed yet.",
        importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0
          ? `The preview currently shows ${importPreview.assets.length} holding rows and ${transactionImportPreview.transactions.length} transaction rows.`
          : "No useful rows have been parsed into preview yet.",
        `Help me decide what to trust, what to verify manually, and whether I should merge this import now.`,
      ].join(" ")
    : [
        `The portfolio desk says "${operatingHeadline}".`,
        `I currently have ${safeAssets.length} holdings, ${transactions.length} tracked transactions, and ${formatMoney(portfolioTotal)} in tracked value.`,
        `My diversification score is ${diversificationScore}/100 and the portfolio read is "${portfolioHeadline}".`,
        `Help me understand how to structure the portfolio from here and what to clean up first.`,
      ].join(" ");
  const importLaneMentorPrompt = [
    `Before I import ${uploadedFileLabel ?? "this statement"}, tell me what I should check so I do not merge messy or misleading portfolio data.`,
    uploadedImportStatus === "ready"
      ? "The upload is ready for review."
      : uploadedImportStatus === "processing"
        ? "The upload is still processing."
        : hasUploadedImport
          ? "An uploaded source is already loaded into the review lane."
          : "I am still at the paste-or-upload stage.",
    `Current parser preview: ${importPreview.assets.length} holding rows, ${transactionImportPreview.transactions.length} transaction rows, ${importPreview.duplicates.length} holding duplicates, and ${duplicateTransactionCount} duplicate transactions.`,
    importArtifacts ? `Diagnostics summary: ${importArtifacts.summary}.` : null,
    `Help me know what to inspect first before I import anything.`,
  ]
    .filter(Boolean)
    .join(" ");
  const importReviewMentorPrompt = [
    `Walk me through this import review.`,
    `The provider confidence is ${importReview?.providerConfidence ?? "unknown"} and parse readiness is ${importReview?.parseReadiness ?? "unknown"}.`,
    `The current file is ${uploadedFileLabel ?? "manual text"}.`,
    `The preview currently has ${importPreview.assets.length} holdings, ${importPreview.duplicates.length} duplicate holdings, ${transactionImportPreview.transactions.length} parsed transactions, and ${newTransactionImportPreview.length} transaction rows ready after deduping.`,
    importReview?.warnings?.length
      ? `Warnings: ${importReview.warnings.join(" ")}`
      : "There are no parser warnings right now.",
    `Tell me what looks reliable, what needs a manual check, and what I should do next.`,
  ].join(" ");

  useEffect(() => {
    setSelectedImportKeys(
      importPreview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
  }, [importPreview.assets]);

  function handleCsvImport() {
    const rawText = importArtifacts?.rawText || activeImportText;
    const normalizedText = importArtifacts?.normalizedText || activeImportText;
    const rowWarnings = importArtifacts?.rowWarnings ?? importPreview.errors;

    if (!importPreview.assets.length && newTransactionImportPreview.length) {
      newTransactionImportPreview.forEach((transaction) => {
        onAddTransaction(transaction);
      });
      if (importReview) {
        onLogImportJob(
          createImportJobFromReview({
            assetCount: 0,
            duplicateCount: 0,
            fileName: activeImportFileName,
            notes: "Transaction import completed successfully.",
            normalizationApplied: importReview.normalizationApplied,
            normalizedText,
            rawText,
            review: importReview,
            rowWarnings,
            status: "completed",
            transactionCount: newTransactionImportPreview.length,
          }),
        );
      }
      setCsvMessage(
        [
          `Imported ${newTransactionImportPreview.length} transaction${newTransactionImportPreview.length === 1 ? "" : "s"} into the journal.`,
          duplicateTransactionCount > 0
            ? `Skipped ${duplicateTransactionCount} transaction duplicate${duplicateTransactionCount === 1 ? "" : "s"} already in the journal.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return;
    }

    if (!importPreview.assets.length) {
      setCsvMessage(
        [...importPreview.errors, ...transactionImportPreview.errors].filter(Boolean).join(" "),
      );
      if (importReview) {
        onLogImportJob(
          createImportJobFromReview({
            assetCount: 0,
            duplicateCount: 0,
            fileName: activeImportFileName,
            notes: importPreview.errors.join(" "),
            normalizedText,
            rawText,
            review: importReview,
            rowWarnings,
            status: "failed",
          }),
        );
      }
      return;
    }

    if (!selectedImportedAssets.length) {
      setCsvMessage("Select at least one parsed holding before importing.");
      return;
    }

    const nextAssets = applyPortfolioImport({
      existingAssets: safeAssets,
      importedAssets: selectedImportedAssets,
      mode: importMode,
    });

    onImportAssets(nextAssets);
    if (importReview) {
      onLogImportJob(
        createImportJobFromReview({
          assetCount: selectedImportedAssets.length,
          duplicateCount: selectedDuplicateCount,
          fileName: activeImportFileName,
          notes:
            selectedDuplicateCount && importMode === "merge"
              ? "Import completed with duplicate merge handling."
              : "Import completed successfully.",
          normalizationApplied: importReview.normalizationApplied,
          normalizedText,
          rawText,
          review: importReview,
          rowWarnings,
          status: "completed",
          transactionCount: newTransactionImportPreview.length,
        }),
      );
    }
    if (newTransactionImportPreview.length > 0) {
      newTransactionImportPreview.forEach((transaction) => {
        onAddTransaction(transaction);
      });
    }
    setCsvMessage(
      [
        selectedDuplicateCount && importMode === "merge"
          ? `Imported ${selectedImportedAssets.length} holdings and merged ${selectedDuplicateCount} duplicates.`
          : `Imported ${selectedImportedAssets.length} holdings.`,
        newTransactionImportPreview.length > 0
          ? `Added ${newTransactionImportPreview.length} transaction${newTransactionImportPreview.length === 1 ? "" : "s"} to the journal.`
          : "",
        duplicateTransactionCount > 0
          ? `Skipped ${duplicateTransactionCount} transaction duplicate${duplicateTransactionCount === 1 ? "" : "s"} already in the journal.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function handleToggleImportRow(rowKey: string) {
    setSelectedImportKeys((current) =>
      current.includes(rowKey)
        ? current.filter((key) => key !== rowKey)
        : [...current, rowKey],
    );
  }

  function handleSelectAllImportRows() {
    setSelectedImportKeys(
      importPreview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
  }

  function handleClearImportRows() {
    setSelectedImportKeys([]);
  }

  function handleStartEdit(asset: PortfolioAsset, assetIndex: number) {
    setEditingIndex(assetIndex);
    setEditingAsset(asset);
  }

  function handleSaveEdit() {
    if (editingIndex === null || !editingAsset) return;
    if (!editingAsset.name.trim() || editingAsset.value < 0) {
      setCsvMessage("Edited holding needs a name and non-negative value.");
      return;
    }

    onUpdateAsset(editingIndex, syncHoldingNumbers(editingAsset));
    setEditingIndex(null);
    setEditingAsset(null);
    setCsvMessage("Holding updated.");
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setEditingAsset(null);
  }

  function handleDelete(assetIndex: number) {
    onDeleteAsset(assetIndex);
    if (editingIndex === assetIndex) {
      handleCancelEdit();
    }
    setCsvMessage("Holding removed.");
  }

  function handleAddTransactionClick() {
    if (!draftTransaction.assetName.trim() || draftTransaction.amount <= 0) {
      setCsvMessage("Transaction needs an asset name and positive amount.");
      return;
    }

    onAddTransaction(syncTransactionAmount(draftTransaction));
    setDraftTransaction(
      createPortfolioTransaction({
        assetName: draftTransaction.assetName,
        source: draftTransaction.source,
        type: draftTransaction.type,
      }),
    );
    setCsvMessage("Transaction added.");
  }

  async function handleCsvFileUpload(file: File | null) {
    if (!file) return;

    try {
      setIsReviewingImport(true);
      setPendingUploadFile(file);
      setUploadedFileLabel(file.name);
      setUploadedImportText("");
      setUploadedImportStatus("processing");
      setCsvText("");
      setImportArtifacts(null);
      setImportReview(null);
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const fileText = await readFileText(file);
      const extractedUpload = isPdf ? await extractImportTextFromUpload(file) : null;
      const resolvedUpload = resolveUploadedImportText({
        extractedUpload,
        fallbackPdfResult: null,
        fileText,
      });
      const rawText = resolvedUpload.text;

      if (!rawText.trim()) {
        throw new Error(
          "We could open that file, but no readable statement text was extracted. Paste the statement text directly or export a cleaner file.",
        );
      }

      const detectedSource = detectImportSource({
        fileName: file.name,
        text: rawText,
      });
      const normalized = normalizeImportTextForProvider({
        providerId: detectedSource?.id,
        text: rawText,
      });
      const text = normalized.text;
      const filePreview = previewPortfolioImport(text, safeAssets);
      const usedOcr = resolvedUpload.usedOcr;
      const pageCount = resolvedUpload.pageCount;
      const extractedAnyRows =
        filePreview.assets.length > 0 || parseImportedTransactions(text).transactions.length > 0;

      setUploadedImportText(text);
      setUploadedImportStatus("ready");
      setCsvMessage(
        isPdf
          ? usedOcr
            ? `${file.name} uploaded. OCR was used on ${pageCount} page${pageCount === 1 ? "" : "s"}.${detectedSource ? ` Detected ${detectedSource.name}.` : ""} Click Analyze uploaded file to review it.`
            : `${file.name} uploaded from PDF.${detectedSource ? ` Detected ${detectedSource.name}.` : ""} Click Analyze uploaded file to review it.`
          : `${file.name} uploaded.${detectedSource ? ` Detected ${detectedSource.name}.` : ""}${normalized.applied.length ? " Provider cleanup applied." : ""}${
              extractedAnyRows
                ? " Click Analyze uploaded file to review it."
                : " We extracted the file text, but this source still needs a review pass before anything can be imported."
            }`,
      );
    } catch (error) {
      setImportReview(null);
      setImportArtifacts(null);
      setUploadedImportText("");
      setUploadedImportStatus("error");
      setCsvMessage(
        error instanceof Error
          ? error.message
          : "Could not read that file. For PDFs, use a selectable text statement rather than a scanned image.",
      );
    } finally {
      setIsReviewingImport(false);
    }
  }

  function handleSelectUploadFile(file: File | null) {
    setPendingUploadFile(file);
    setUploadedFileLabel(file?.name ?? null);
    setUploadedImportText("");
    setUploadedImportStatus(file ? "selected" : "idle");
    setImportArtifacts(null);
    setImportReview(null);
    if (file) {
      setCsvText("");
      setCsvMessage(`${file.name} selected. Click Upload file to extract the statement text.`);
    }
  }

  async function handleConfirmUpload() {
    if (!pendingUploadFile) {
      setCsvMessage("Choose a file before uploading.");
      return;
    }

    await handleCsvFileUpload(pendingUploadFile);
  }

  async function handleAnalyzeCurrentText() {
    setIsReviewingImport(true);

    try {
      const sourceText = activeImportText;
      const sourceFileName = activeImportFileName;

      if (!sourceText.trim()) {
        throw new Error("Upload a file or paste statement text before analyzing the import.");
      }

      const detectedSource = detectImportSource({
        fileName: uploadedFileLabel ?? undefined,
        text: sourceText,
      });
      const normalized = normalizeImportTextForProvider({
        providerId: detectedSource?.id,
        text: sourceText,
      });
      if (!hasUploadedImport && normalized.text !== csvText) {
        setCsvText(normalized.text);
      }
      if (hasUploadedImport && normalized.text !== uploadedImportText) {
        setUploadedImportText(normalized.text);
      }
      const normalizedPreview = previewPortfolioImport(normalized.text, safeAssets);
      const diagnostics = buildImportDiagnostics({
        normalizedText: normalized.text,
        preview: normalizedPreview,
        rawText: sourceText,
      });
      const review = await reviewImportDocument({
        fileName: uploadedFileLabel ?? undefined,
        text: normalized.text,
        normalizationApplied: normalized.applied,
      });
      setImportReview(review);
      setImportArtifacts(diagnostics);
      if (hasUploadedImport) {
        setUploadedImportStatus("ready");
      }
      onLogImportJob(
        createImportJobFromReview({
          assetCount: normalizedPreview.assets.length,
          duplicateCount: normalizedPreview.duplicates.length,
          fileName: sourceFileName,
          notes: hasUploadedImport
            ? "Uploaded file analyzed from the import workflow."
            : "Text analyzed from the editor.",
          normalizationApplied: normalized.applied,
          normalizedText: normalized.text,
          rawText: sourceText,
          review,
          rowWarnings: diagnostics.rowWarnings,
          status: "reviewed",
        }),
      );
      setCsvMessage(
        hasUploadedImport
          ? `${sourceFileName} analyzed. Review the cues before importing.`
          : "Import text analyzed. Review the cues before importing.",
      );
    } catch (error) {
      setImportReview(null);
      setImportArtifacts(null);
      setCsvMessage(
        error instanceof Error ? error.message : "Could not analyze the pasted text.",
      );
    } finally {
      setIsReviewingImport(false);
    }
  }

  async function handleCopyCsv() {
    if (!navigator.clipboard) {
      setCsvMessage("Clipboard is unavailable in this browser.");
      return;
    }

    await navigator.clipboard.writeText(exportedCsv);
    setCsvMessage("Current portfolio CSV copied.");
  }

  function handleDownloadCsv() {
    const blob = new Blob([exportedCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wealthcompass-portfolio.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setCsvMessage("Downloaded current portfolio CSV.");
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Portfolio operating desk</Badge>
              <Badge variant="outline">{portfolioReadinessLabel}</Badge>
              <Badge variant="outline">
                {safeAssets.length} holding{safeAssets.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {operatingHeadline}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {operatingSubcopy}
              </p>
              <div className="mt-3">
                <AskMentorLink
                  label={importHelpLabel}
                  returnState={portfolioMentorReturnState}
                  mentorPrompt={operatingDeskMentorPrompt}
                  mentorQuestionId="allocation"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Portfolio operating desk"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coverage
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {safeAssets.length > 0
                    ? `${safeAssets.length} holdings are shaping the live allocation view.`
                    : "No holdings yet, so allocation and health checks are still waiting on real inputs."}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Journal depth
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {transactions.length > 0
                    ? `${transactions.length} transaction entries are available for trajectory and realized P&L.`
                    : "Transaction history is still light, so portfolio trajectory is mostly inferred from holdings."}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Import lane
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {uploadedImportStatus === "ready"
                    ? "A statement is ready for review before you merge anything into the portfolio."
                    : "CSV, email text, HTML tables, and OCR-backed PDFs can all flow through the same review lane."}
                </p>
                <div className="mt-3">
                  <AskMentorLink
                    label="Ask AI mentor before importing"
                    returnState={portfolioMentorReturnState}
                    mentorPrompt={importLaneMentorPrompt}
                    mentorQuestionId="allocation"
                    onOpenMentor={onOpenMentor}
                    sourceLabel="Portfolio import lane"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (!draftAsset.name || draftAsset.value <= 0) return;
                  onAddAsset(syncHoldingNumbers(draftAsset));
                  setDraftAsset(defaultDraftAsset);
                }}
              >
                <Plus className="h-4 w-4" />
                Add first-class holding
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyCsv}>
                <Copy className="h-4 w-4" />
                Copy export
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current read
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">{portfolioHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{portfolioSubcopy}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">{importTrack.items[0]}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.band}</Badge>
            <Badge variant="outline">{profile.confidence}</Badge>
            <Badge variant="outline">{importTrack.title}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Manual portfolio tracker</CardTitle>
              <CardDescription>{formatMoney(portfolioTotal)} tracked</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyCsv}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!draftAsset.name || draftAsset.value <= 0) return;
                  onAddAsset(syncHoldingNumbers(draftAsset));
                  setDraftAsset(defaultDraftAsset);
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">{portfolioHeadline}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {portfolioSubcopy}
                </p>
              </div>
              <div className="min-w-56 rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6">{importTrack.items[0]}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  1. Add coverage
                </p>
                <p className="mt-2 text-sm leading-6">
                  Use import when you already have a broker, registrar, or email statement.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  2. Clean the details
                </p>
                <p className="mt-2 text-sm leading-6">
                  Make sure name, current value, invested value, units, and source are filled.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  3. Compare the mix
                </p>
                <p className="mt-2 text-sm leading-6">
                  Once coverage is decent, use allocation and health checks to tighten the plan.
                </p>
              </div>
            </div>
            <MentorOpenCue
              cueLabel="Still open before importing"
              description="You already have an open mentor thread that could help you review this portfolio setup or import decision before you merge more data."
              mentorRevision={mentorRevision}
              onOpenMentor={onOpenMentor}
              questionIds={["allocation", "etf", "gold", "tax"]}
              resumeLabel="Check this with AI mentor"
              sourceLabel="Portfolio"
              stuckLabel="Unblock this before importing more"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricMini label="Tracked value" value={formatMoney(portfolioTotal)} />
            <MetricMini label="Invested basis" value={formatMoney(investedValue)} />
            <MetricMini label="Unrealized P&L" value={formatMoney(unrealizedGain)} />
            <MetricMini label="Diversification" value={`${diversificationScore}/100`} />
          </div>
          <div
            ref={manualEntryRef}
            className="grid gap-3 rounded-md border bg-muted/30 p-3"
          >
            <div>
              <p className="text-sm font-medium">Manual holding entry</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Best for quick edits, fixing import gaps, or adding a missing holding without waiting for a fresh export.
              </p>
            </div>
            <HoldingFields asset={draftAsset} onChange={setDraftAsset} />
          </div>

          <div
            ref={transactionJournalRef}
            className="grid gap-3 rounded-md border bg-muted/30 p-3"
            data-testid="transaction-journal"
            aria-label="Transaction journal"
            role="group"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Transaction journal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record buys, sells, dividends, and transfers so holdings stay transaction-driven.
                </p>
              </div>
              <Button type="button" size="sm" onClick={handleAddTransactionClick}>
                <Plus className="h-4 w-4" />
                Add transaction
              </Button>
            </div>
            <TransactionFields
              transaction={draftTransaction}
              onChange={setDraftTransaction}
            />
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>Buys {formatMoney(transactionSummary.buys)}</span>
              <span>Sells {formatMoney(transactionSummary.sells)}</span>
              <span>Dividends {formatMoney(transactionSummary.dividends)}</span>
              <span>Realized P&L {formatMoney(realizedGain)}</span>
            </div>
            <div className="grid gap-2">
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {transaction.assetName} · {transaction.action}
                    </p>
                    <p className="text-muted-foreground">
                      {transaction.date} · {transaction.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p>{formatMoney(transaction.amount)}</p>
                      <p className="text-muted-foreground">
                        {transaction.quantity.toFixed(2)} @ {formatMoney(transaction.price)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteTransaction(transaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Supported intake lanes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Built around exported statements first, so broker files, registrar PDFs, and forwarded email statements can land in one review flow.
                </p>
              </div>
            <div className="grid gap-2 md:grid-cols-2">
              {importSourceDescriptors.map((source) => (
                <div
                  key={source.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.summary}</p>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
                      {describeReadiness(source.readiness)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {source.supports.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  Forwarded Gmail or Outlook statements can be pasted directly before we add full inbox connectors.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ScanSearch className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  PDF statements are reviewed with OCR fallback, so scanned attachments already fit the MVP flow.
                </span>
              </div>
            </div>
          </div>

          <div
            ref={importReviewRef}
            className="grid gap-3 rounded-md border bg-muted/30 p-3"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Import and review</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports CSV/TSV, pasted email text, OCR-backed PDF statements,
                  HTML tables, scheme/security name, current value, invested value, units,
                  NAV, LTP, and source labels.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCsvImport}
                disabled={
                  !selectedImportedAssets.length &&
                  !newTransactionImportPreview.length
                }
              >
                <Upload className="h-4 w-4" />
                Import {selectedImportedAssets.length || newTransactionImportPreview.length || ""}
              </Button>
            </div>
            <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{importTrack.title}</Badge>
                  <Badge variant="outline">
                    {uploadedImportStatus === "ready"
                      ? "Upload ready"
                      : uploadedImportStatus === "processing"
                        ? "Upload processing"
                        : hasUploadedImport
                          ? "Upload loaded"
                          : "Manual review lane"}
                  </Badge>
                  <Badge variant="outline">{importMode === "merge" ? "Merge duplicates" : "Keep all rows"}</Badge>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Treat imports like a review lane, not a blind upload.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {importTrack.items[0] ??
                      "A clean import is more useful than a fast import. Confirm holdings, transactions, duplicates, and provider fit before merging anything into the tracker."}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      1. Load the source
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Upload a statement or paste export text so the parser can read the real shape of the data.
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      2. Inspect the review
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Check provider fit, cleanup, parsed rows, and warnings before trusting the preview.
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      3. Import selectively
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Select only the holdings and transactions that improve coverage without muddying the portfolio.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium">Best next move</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {uploadedImportStatus === "ready"
                      ? "Run the import review now, then decide whether the parsed output is clean enough to stage or import."
                      : hasUploadedImport
                        ? "Use the extracted upload text as the primary source, review the parser output, and only keep the rows that add real coverage."
                        : "Paste a real statement or upload a file first, then let the review layer tell you what the parser actually understood."}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium">Import read</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0
                      ? `${importPreview.assets.length} holding${importPreview.assets.length === 1 ? "" : "s"} and ${transactionImportPreview.transactions.length} transaction row${transactionImportPreview.transactions.length === 1 ? "" : "s"} are currently in preview.`
                      : "No parsed rows yet. The review starts becoming useful once real statement text or a file has been loaded."}
                  </p>
                  <div className="mt-3">
                    <AskMentorLink
                      label="Ask AI mentor about this review"
                      returnState={portfolioMentorReturnState}
                      mentorPrompt={importReviewMentorPrompt}
                      mentorQuestionId="allocation"
                      onOpenMentor={onOpenMentor}
                      sourceLabel="Portfolio import review"
                    />
                  </div>
                </div>
              </div>
            </div>
            <SegmentedControl
              label="Duplicate handling"
              options={importModeOptions}
              value={importMode}
              onChange={(value) => setImportMode(value as PortfolioImportMode)}
            />
            <Input
              accept=".csv,.tsv,.txt,.html,.pdf,text/csv,text/tab-separated-values,text/plain,text/html,application/pdf"
              type="file"
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => handleSelectUploadFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {uploadedImportStatus === "processing" && uploadedFileLabel
                ? `Processing ${uploadedFileLabel}...`
                : uploadedImportStatus === "ready" && uploadedFileLabel
                  ? `Uploaded: ${uploadedFileLabel}`
                  : uploadedImportStatus === "selected" && uploadedFileLabel
                    ? `Selected: ${uploadedFileLabel}`
                    : uploadedFileLabel
                      ? `Loaded from upload: ${uploadedFileLabel}`
                  : "Choose a CSV, TXT, HTML, or PDF statement to load it into the import editor."}
            </p>
            <textarea
              className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setUploadedFileLabel(null);
                setUploadedImportText("");
                setUploadedImportStatus("idle");
                setImportArtifacts(null);
                setImportReview(null);
              }}
              placeholder="Paste statement text, CSV rows, or email content here for manual analysis."
            />
            {uploadedFileLabel && !isReviewingImport ? (
              <p className="text-xs text-muted-foreground">
                {uploadedImportStatus === "ready"
                  ? "Upload complete. Click Analyze uploaded file to review the extracted statement."
                  : uploadedImportStatus === "selected"
                    ? "File selected. Click Upload file to extract the statement text."
                  : "Uploaded file is queued for analysis and preview independently from the manual paste box."}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleConfirmUpload()}
                disabled={!pendingUploadFile || uploadedImportStatus === "processing"}
              >
                <Upload className="h-4 w-4" />
                {uploadedImportStatus === "processing" ? "Uploading..." : "Upload file"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleAnalyzeCurrentText()}
                disabled={uploadedImportStatus !== "ready"}
              >
                <ScanSearch className="h-4 w-4" />
                {isReviewingImport && hasUploadedImport
                  ? "Analyzing upload..."
                  : "Analyze uploaded file"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleAnalyzeCurrentText()}
              >
                <ScanSearch className="h-4 w-4" />
                {isReviewingImport && !uploadedFileLabel
                  ? "Analyzing..."
                  : "Analyze import text"}
              </Button>
            </div>
            {importReview && (
              <ImportReviewCard
                artifacts={importArtifacts}
                review={importReview}
              />
            )}
            {(importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0) && (
              <CombinedImportOverviewCard
                overview={combinedImportOverview}
              />
            )}
            {transactionImportPreview.transactions.length > 0 && (
              <TransactionImportPreview
                duplicateCount={
                  duplicateTransactionCount
                }
                transactions={newTransactionImportPreview}
              />
            )}
            <ImportPreview
              onClearSelection={handleClearImportRows}
              onSelectAll={handleSelectAllImportRows}
              onToggleRow={handleToggleImportRow}
              preview={importPreview}
              selectedKeys={selectedImportKeys}
            />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-muted-foreground">{csvMessage}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onResetAssets}>
                Reset demo data
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">What makes this tracker useful</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Good portfolio decisions come from enough coverage plus clean detail quality.
                </p>
              </div>
              <Badge variant="outline">{learningTrack.title}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coverage
                </p>
                <p className="mt-2 text-sm leading-6">
                  {safeAssets.length} holding{safeAssets.length === 1 ? "" : "s"} tracked
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transactions
                </p>
                <p className="mt-2 text-sm leading-6">
                  {transactions.length} journal entr{transactions.length === 1 ? "y" : "ies"}
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Learning edge
                </p>
                <p className="mt-2 text-sm leading-6">{learningTrack.items[0]}</p>
              </div>
            </div>
          </div>

          {safeAssets.map((asset, index) => (
            <div
              key={`${asset.name}-${asset.type}-${index}`}
              className="grid gap-3 rounded-md border p-3"
            >
              {editingIndex === index && editingAsset ? (
                <HoldingFields asset={editingAsset} onChange={setEditingAsset} />
              ) : (
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {asset.type} · {asset.source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(asset.value)}</p>
                      <p className={asset.gain >= 0 ? "text-sm text-primary" : "text-sm text-destructive"}>
                        {asset.gain >= 0 ? "+" : ""}
                        {asset.gain.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Invested {formatMoney(asset.investedValue)}</span>
                    <span>Units {asset.quantity.toFixed(2)}</span>
                    <span>Price {formatMoney(asset.price)}</span>
                    <span>
                      P&L {formatMoney(asset.value - asset.investedValue)}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {editingIndex === index ? (
                  <>
                    <Button type="button" size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEdit(asset, index)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Current allocation</CardTitle>
            <CardDescription>
              Compare your tracked mix with your suggested profile once enough holdings are captured.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium">What this chart is telling you</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {chartData.length === 0
                    ? "Once holdings are tracked, this chart becomes the fastest way to see where most of the portfolio value is actually sitting."
                    : chartData.length < 3
                      ? "Right now the chart is directionally useful, but the mix may still look simpler than your real portfolio until more holdings are captured."
                      : "This view is now good enough to judge whether the portfolio is leaning too hard into one part of the market."}
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6">
                  {allocationInsights[0]?.status ??
                    "Capture more holdings, then compare the real mix against the suggested buckets below."}
                </p>
              </div>
            </div>
            <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value) / 1000}k`}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-3)" />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Portfolio health checks</CardTitle>
            <CardDescription>
              Rule-based checks on concentration, detail quality, core allocation, and diversification.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium">How to read these checks</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These aren’t predictions. They are operating checks that tell you whether the portfolio is detailed enough, diversified enough, and aligned enough to support better decisions.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coaching read
                </p>
                <p className="mt-2 text-sm leading-6">
                  {portfolioChecks[0]?.status ??
                    "Once more holdings are captured, these checks will start turning into clearer portfolio guidance."}
                </p>
              </div>
            </div>
            {portfolioChecks.map((check) => (
              <HealthCheck key={check.label} {...check} />
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Allocation alignment</CardTitle>
            <CardDescription>Compare your current mix with the suggested profile buckets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium">What alignment means here</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Alignment is not about matching every bucket perfectly. It is about noticing where the real portfolio is underweight, overconcentrated, or missing the core shape suggested by your profile.
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested posture
                </p>
                <p className="mt-2 text-sm leading-6">
                  {allocationInsights[0]?.status ??
                    "Add holdings or imported transactions to make the alignment check meaningful."}
                </p>
              </div>
            </div>
            {allocationInsights.length ? (
              allocationInsights.map((insight) => (
                <div
                  key={insight.bucket}
                  className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="text-sm font-medium">{insight.bucket}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.status}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Current {insight.currentShare}%</p>
                    <p>Suggested {insight.suggestedShare}%</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                Add holdings or imported transactions to compare your real mix with the suggested allocation buckets.
              </div>
            )}
          </CardContent>
        </Card>
        <Roadmap profile={profile} compact />
      </div>
      </div>
    </div>
  );
}

async function extractImportTextFromUpload(file: File): Promise<PdfExtractResult | null> {
  const body = await file.arrayBuffer();

  const response = await fetch("/api/import-extract", {
    body,
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Upload extraction route unavailable.");
  }

  const payload = JSON.parse(await response.text()) as {
    error?: string;
    fileName?: string;
    isPdf: boolean;
    pageCount: number;
    text: string;
    usedOcr: boolean;
    warnings: string[];
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    fileName: payload.fileName,
    isPdf: payload.isPdf,
    pageCount: payload.pageCount,
    text: payload.text,
    usedOcr: payload.usedOcr,
    warnings: payload.warnings,
  };
}

async function readFileText(file: File) {
  const buffer = await file.arrayBuffer();
  return new TextDecoder().decode(buffer);
}

async function reviewImportDocument({
  fileName,
  normalizationApplied,
  text,
  usedOcr,
}: {
  fileName?: string;
  normalizationApplied?: string[];
  text: string;
  usedOcr?: boolean;
}) {
  try {
    const response = await fetch("/api/import-review", {
      body: JSON.stringify({ fileName, normalizationApplied, text, usedOcr }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Import review route unavailable.");
    }

    return (await response.json()) as ImportReview;
  } catch {
    return analyzeImportDocument({ fileName, normalizationApplied, text, usedOcr });
  }
}

function ImportReviewCard({
  artifacts,
  review,
}: {
  artifacts: ImportDiagnostics | null;
  review: ImportReview;
}) {
  const parserProfile = getProviderParserProfile(review.detectedSource?.id);
  const operatorFocus = review.operatorFocus ?? {
    detail: review.guidance[0] ?? "Review the parsed preview before importing.",
    label: "Review recommended",
    tone: "idle" as const,
  };

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium">Import review</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{review.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{review.parseReadiness}</Badge>
          <Badge variant="outline">{review.providerConfidence} provider fit</Badge>
          <Badge variant="outline">{review.qualityScore}/100</Badge>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">What we understood</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {review.detectedSource?.name ?? "Unknown provider table export"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {review.documentKind} · {review.parseReadiness} · {review.providerConfidence} provider fit
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">What to check next</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{operatorFocus.label}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{operatorFocus.detail}</p>
        </div>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Type {review.documentKind}</span>
        <span>Provider {review.detectedSource?.name ?? "Not detected"}</span>
        <span>Text length {review.textLength}</span>
      </div>
      <div
        className={`grid gap-2 rounded-md border p-3 text-xs ${
          operatorFocus.tone === "healthy"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : operatorFocus.tone === "attention"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-muted/30"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Review focus</p>
          <Badge
            variant={
              operatorFocus.tone === "healthy" ? "secondary" : "outline"
            }
          >
            {operatorFocus.label}
          </Badge>
        </div>
        <p className="leading-5 text-muted-foreground">{operatorFocus.detail}</p>
      </div>
      {artifacts && <ImportDiagnosticsSummary artifacts={artifacts} />}
      {review.cues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.cues.map((cue) => (
            <Badge key={cue} variant="outline">
              {cue}
            </Badge>
          ))}
        </div>
      )}
      {review.normalizationApplied.length > 0 && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cleanup applied</p>
          {review.normalizationApplied.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      {artifacts && (artifacts.beforeSnippet || artifacts.afterSnippet) && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">Before cleanup</p>
            <pre className="overflow-auto rounded-md bg-background p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.beforeSnippet || "No raw text saved."}
            </pre>
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">After cleanup</p>
            <pre className="overflow-auto rounded-md bg-background p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.afterSnippet || "No normalized text saved."}
            </pre>
          </div>
        </div>
      )}
      {artifacts?.rowWarnings.length ? (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Parser warnings</p>
          {artifacts.rowWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {artifacts?.parsedRows.length ? (
        <ParsedImportRows artifacts={artifacts} />
      ) : null}
      {parserProfile && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Provider parser profile</p>
          <p>Best inputs: {parserProfile.bestInputs.join(" · ")}</p>
          <p>Preferred headers: {parserProfile.preferredHeaders.join(", ")}</p>
          <p>First pitfall to check: {parserProfile.commonPitfalls[0]}</p>
        </div>
      )}
      <div className="grid gap-2">
        {review.guidance.map((item) => (
          <p key={item} className="text-xs leading-5 text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ImportDiagnosticsSummary({
  artifacts,
}: {
  artifacts: ImportDiagnostics;
}) {
  const items = [
    ["Parsed", artifacts.summary.parsedCount.toString()],
    ["New", artifacts.summary.newCount.toString()],
    ["Duplicates", artifacts.summary.duplicateCount.toString()],
    ["Review", artifacts.summary.reviewCount.toString()],
    ["Current", formatMoney(artifacts.summary.totalCurrentValue)],
    ["Invested", formatMoney(artifacts.summary.totalInvestedValue)],
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-muted/30 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ParsedImportRows({
  artifacts,
}: {
  artifacts: ImportDiagnostics;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed holdings</p>
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(artifacts.parsedRows.length, 8)} of {artifacts.parsedRows.length}
        </p>
      </div>
      <div className="grid gap-2">
        {artifacts.parsedRows.slice(0, 8).map((row, index) => (
          <div
            key={`${row.name}-${row.type}-${index}`}
            className="grid gap-3 rounded-md border bg-background p-3 text-xs lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{row.name}</p>
                <Badge
                  variant={row.status === "new" ? "secondary" : "outline"}
                >
                  {row.status}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                {row.type} · {row.source}
              </p>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Current {formatMoney(row.currentValue)}</span>
              <span>Invested {formatMoney(row.investedValue)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Units {row.quantity.toFixed(2)}</span>
              <span>Price {formatMoney(row.price)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Gain {row.gain.toFixed(2)}%</span>
              {row.notes.length ? (
                <span>{row.notes.join(" · ")}</span>
              ) : (
                <span>Ready to import</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionImportPreview({
  duplicateCount,
  transactions,
}: {
  duplicateCount: number;
  transactions: PortfolioTransaction[];
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed transactions</p>
        <p className="text-xs text-muted-foreground">
          {transactions.length} new row{transactions.length === 1 ? "" : "s"}
        </p>
      </div>
      {duplicateCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {duplicateCount} transaction duplicate{duplicateCount === 1 ? "" : "s"} already exist in the journal and will be skipped.
        </p>
      ) : null}
      <div className="grid gap-2">
        {transactions.slice(0, 8).map((transaction) => (
          <div
            key={transaction.id}
            className="grid gap-2 rounded-md border bg-background p-3 text-xs md:grid-cols-[1.6fr_0.8fr_0.8fr_1fr]"
          >
            <div>
              <p className="font-medium text-foreground">{transaction.assetName}</p>
              <p className="mt-1 text-muted-foreground">
                {transaction.type} · {transaction.source}
              </p>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>{transaction.date}</span>
              <span>{transaction.action}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Units {transaction.quantity.toFixed(3)}</span>
              <span>NAV {formatMoney(transaction.price)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Amount {formatMoney(transaction.amount)}</span>
              <span>{transaction.notes}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CombinedImportOverviewCard({
  overview,
}: {
  overview: CombinedImportOverview;
}) {
  const items = [
    ["Holdings parsed", overview.holdingsParsed.toString()],
    ["Holdings selected", overview.holdingsSelected.toString()],
    ["Holding duplicates", overview.holdingsDuplicates.toString()],
    ["Transactions new", overview.transactionsNew.toString()],
    ["Transactions skipped", overview.transactionDuplicates.toString()],
    ["Transactions parsed", overview.transactionsParsed.toString()],
    ["Selected current", formatMoney(overview.selectedCurrentValue)],
    ["Selected invested", formatMoney(overview.selectedInvestedValue)],
  ];

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div>
        <p className="text-sm font-medium">Import decision summary</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{overview.headline}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Selected impact</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {overview.holdingsSelected} holding{overview.holdingsSelected === 1 ? "" : "s"} selected
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatMoney(overview.selectedCurrentValue)} current value and {formatMoney(overview.selectedInvestedValue)} invested value are currently marked to import.
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Transaction effect</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {overview.transactionsNew} new transaction{overview.transactionsNew === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {overview.transactionDuplicates} duplicate transaction{overview.transactionDuplicates === 1 ? "" : "s"} will be skipped if they already exist in the journal.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-muted/30 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingFields({
  asset,
  onChange,
}: {
  asset: PortfolioAsset;
  onChange: (asset: PortfolioAsset) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        label="Asset name"
        value={asset.name}
        onChange={(value) => onChange({ ...asset, name: value })}
      />
      <TextField
        label="Type"
        value={asset.type}
        onChange={(value) => onChange({ ...asset, type: value })}
      />
      <NumberField
        label="Current value"
        value={asset.value}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              price: asset.quantity > 0 ? value / asset.quantity : asset.price,
              value,
            }),
          )
        }
      />
      <NumberField
        label="Invested value"
        value={asset.investedValue}
        onChange={(value) => onChange(syncHoldingNumbers({ ...asset, investedValue: value }))}
      />
      <NumberField
        label="Units"
        value={asset.quantity}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              quantity: value,
              value: asset.price > 0 ? value * asset.price : asset.value,
            }),
          )
        }
      />
      <NumberField
        label="Current price"
        value={asset.price}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              price: value,
              value: asset.quantity > 0 ? asset.quantity * value : asset.value,
            }),
          )
        }
      />
      <NumberField
        label="Gain %"
        value={asset.gain}
        onChange={(value) => onChange({ ...asset, gain: value })}
      />
      <TextField
        label="Source"
        value={asset.source}
        onChange={(value) => onChange({ ...asset, source: value })}
      />
    </div>
  );
}

function TransactionFields({
  onChange,
  transaction,
}: {
  onChange: (transaction: PortfolioTransaction) => void;
  transaction: PortfolioTransaction;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        inputTestId="transaction-asset-name"
        label="Asset name"
        value={transaction.assetName}
        onChange={(value) => onChange({ ...transaction, assetName: value })}
      />
      <TextField
        inputTestId="transaction-type"
        label="Type"
        value={transaction.type}
        onChange={(value) => onChange({ ...transaction, type: value })}
      />
      <SegmentedControl
        label="Action"
        options={[
          ["buy", "Buy"],
          ["sell", "Sell"],
          ["dividend", "Dividend"],
          ["transfer", "Transfer"],
        ]}
        value={transaction.action}
        onChange={(value) =>
          onChange({ ...transaction, action: value as PortfolioTransaction["action"] })
        }
      />
      <TextField
        inputTestId="transaction-date"
        label="Date"
        value={transaction.date}
        onChange={(value) => onChange({ ...transaction, date: value })}
      />
      <NumberField
        inputTestId="transaction-units"
        label="Units"
        value={transaction.quantity}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: transaction.price > 0 ? value * transaction.price : transaction.amount,
              quantity: value,
            }),
          )
        }
      />
      <NumberField
        inputTestId="transaction-price"
        label="Price"
        value={transaction.price}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: transaction.quantity > 0 ? transaction.quantity * value : transaction.amount,
              price: value,
            }),
          )
        }
      />
      <NumberField
        inputTestId="transaction-amount"
        label="Amount"
        value={transaction.amount}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: value,
            }),
          )
        }
      />
      <TextField
        inputTestId="transaction-source"
        label="Source"
        value={transaction.source}
        onChange={(value) => onChange({ ...transaction, source: value })}
      />
      <div className="md:col-span-2">
        <TextField
          inputTestId="transaction-notes"
          label="Notes"
          value={transaction.notes}
          onChange={(value) => onChange({ ...transaction, notes: value })}
        />
      </div>
    </div>
  );
}

function ImportPreview({
  onClearSelection,
  onSelectAll,
  onToggleRow,
  preview,
  selectedKeys,
}: {
  onClearSelection: () => void;
  onSelectAll: () => void;
  onToggleRow: (rowKey: string) => void;
  preview: ReturnType<typeof previewPortfolioImport>;
  selectedKeys: string[];
}) {
  if (!preview.assets.length && !preview.errors.length) return null;

  const selectedCount = preview.assets.filter((asset, index) =>
    selectedKeys.includes(createImportSelectionKey(asset, index)),
  ).length;
  const selectedValue = preview.assets.reduce(
    (sum, asset, index) =>
      selectedKeys.includes(createImportSelectionKey(asset, index))
        ? sum + asset.value
        : sum,
    0,
  );

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Import preview</p>
          <p className="text-xs text-muted-foreground">
            {preview.assets.length} holdings · {formatMoney(preview.importedValue)} current value ·{" "}
            {formatMoney(preview.importedInvestedValue)} invested
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{preview.duplicates.length} duplicates · {preview.newAssets.length} new</span>
          <span>{selectedCount} selected · {formatMoney(selectedValue)}</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Preview meaning</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {preview.assets.length > 0
              ? "These are the holdings the parser believes it found."
              : "No holdings parsed yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Duplicate rows are shown so you can decide whether to merge them into existing holdings or keep them separate.
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Best next move</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {preview.errors.length > 0
              ? "Fix the missing fields first"
              : selectedCount > 0
                ? "Import the selected rows"
                : "Select the rows that improve coverage"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The preview is most useful when you import only the rows that make the portfolio cleaner and more complete.
          </p>
        </div>
      </div>
      {preview.errors.length > 0 && (
        <p className="text-xs text-destructive">{preview.errors.join(" ")}</p>
      )}
      {preview.assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
            Select all
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      )}
      <div className="grid gap-2">
        {preview.assets.map((asset, index) => {
          const rowKey = createImportSelectionKey(asset, index);
          const isSelected = selectedKeys.includes(rowKey);
          const isDuplicate = preview.duplicates.some(
            ({ importedAsset }) =>
              createImportAssetKey(importedAsset) === createImportAssetKey(asset),
          );

          return (
          <div
            key={rowKey}
            className="grid gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs sm:grid-cols-[auto_1fr_auto]"
          >
            <input
              aria-label={`Select ${asset.name}`}
              checked={isSelected}
              className="mt-1 h-4 w-4 accent-current"
              type="checkbox"
              onChange={() => onToggleRow(rowKey)}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{asset.name}</p>
                {isDuplicate && <Badge variant="outline">duplicate</Badge>}
              </div>
              <p className="text-muted-foreground">
                {asset.type} · {asset.source}
              </p>
            </div>
            <div className="text-right">
              <p>{formatMoney(asset.value)}</p>
              <p className="text-muted-foreground">{asset.quantity.toFixed(2)} units</p>
            </div>
          </div>
          );
        })}
      </div>
      {preview.duplicates.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Duplicate matches:{" "}
          {preview.duplicates
            .slice(0, 3)
            .map((item) => item.importedAsset.name)
            .join(", ")}
          {preview.duplicates.length > 3 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

function syncHoldingNumbers(asset: PortfolioAsset) {
  const quantity =
    asset.quantity > 0 ? asset.quantity : asset.price > 0 ? asset.value / asset.price : 0;
  const price = quantity > 0 ? asset.value / quantity : asset.price;
  const gain =
    asset.investedValue > 0 ? ((asset.value - asset.investedValue) / asset.investedValue) * 100 : asset.gain;

  return {
    ...asset,
    gain,
    price,
    quantity,
  };
}

function syncTransactionAmount(transaction: PortfolioTransaction) {
  const quantity =
    transaction.quantity > 0
      ? transaction.quantity
      : transaction.price > 0
        ? transaction.amount / transaction.price
        : 0;
  const price = quantity > 0 ? transaction.amount / quantity : transaction.price;

  return {
    ...transaction,
    price,
    quantity,
  };
}

function createImportSelectionKey(asset: PortfolioAsset, index: number) {
  return `${createImportAssetKey(asset)}::${index}`;
}

function createImportAssetKey(asset: Pick<PortfolioAsset, "name" | "type">) {
  return `${asset.name.trim().toLowerCase()}::${asset.type.trim().toLowerCase()}`;
}
