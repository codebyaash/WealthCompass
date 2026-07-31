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
  FileText,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  ScanSearch,
  Trash2,
  Upload,
} from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { Roadmap } from "@/components/wealth/roadmap";
import { HealthCheck } from "@/components/wealth/health-check";
import { MetricMini } from "@/components/wealth/metric-mini";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
import { PageNavigatorBar } from "@/components/wealth/page-navigator-bar";
import { Badge } from "@/components/ui/badge";
import {
  NumberField,
  SelectField,
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
  applyImportJobToPortfolio,
  createImportJobFromReview,
  describeImportHistoryApplyResult,
  filterNewImportedTransactions,
} from "@/lib/import-jobs";
import {
  buildImportDiagnostics,
  type ImportDiagnosticRow,
  type ImportDiagnostics,
} from "@/lib/import-diagnostics";
import {
  getImportJobFlowMeta,
  getImportJobHistoryActions,
  getImportJobOutcomeStats,
} from "@/lib/import-job-flow";
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
const holdingsSortOptions: Array<[string, string]> = [
  ["value-desc", "Highest value"],
  ["gain-desc", "Highest gain"],
  ["gain-asc", "Lowest gain"],
  ["name-asc", "Name A-Z"],
  ["manual-first", "Manual rows first"],
];
const transactionActionFilterOptions: Array<[string, string]> = [
  ["all", "All actions"],
  ["buy", "Buys"],
  ["sell", "Sells"],
  ["dividend", "Dividends"],
  ["transfer", "Transfers"],
];
const transactionSortOptions: Array<[string, string]> = [
  ["date-desc", "Newest first"],
  ["date-asc", "Oldest first"],
  ["amount-desc", "Highest amount"],
  ["amount-asc", "Lowest amount"],
  ["name-asc", "Name A-Z"],
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
type PortfolioWorkspaceSection =
  | "manual-entry"
  | "transaction-journal"
  | "import-review"
  | "allocation"
  | "health"
  | "alignment";
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
  importJobs,
  returnState,
  mentorRevision,
  onAddAsset,
  onAddTransaction,
  onDeleteAsset,
  onDeleteTransaction,
  onImportAssets,
  onLogImportJob,
  onOpenMentor,
  onReprocessImportJob,
  onResetAssets,
  onUpdateAsset,
  portfolioTotal,
  profile,
  transactions,
}: {
  assets: PortfolioAsset[];
  focusRequest?: PortfolioFocusTarget | null;
  focusRequestKey?: number;
  importJobs: ImportJob[];
  returnState?: PortfolioReturnState | null;
  mentorRevision: number;
  onAddAsset: (asset: PortfolioAsset) => void;
  onAddTransaction: (transaction: PortfolioTransaction) => void;
  onDeleteAsset: (assetIndex: number) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportAssets: (assets: PortfolioAsset[]) => void;
  onLogImportJob: (job: ImportJob) => void;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  onReprocessImportJob: (jobId: string) => void;
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
  const [holdingsSearch, setHoldingsSearch] = useState("");
  const [holdingsSort, setHoldingsSort] = useState("value-desc");
  const [activeAllocationBucket, setActiveAllocationBucket] = useState<string>("");
  const [activeAlignmentBucket, setActiveAlignmentBucket] = useState<string>("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionActionFilter, setTransactionActionFilter] = useState("all");
  const [transactionSort, setTransactionSort] = useState("date-desc");
  const [draftTransaction, setDraftTransaction] = useState<PortfolioTransaction>(
    createPortfolioTransaction(),
  );
  const [navigatorValue, setNavigatorValue] = useState("portfolio-manual-entry");
  const manualEntryRef = useRef<HTMLDivElement | null>(null);
  const importReviewRef = useRef<HTMLDivElement | null>(null);
  const transactionJournalRef = useRef<HTMLDivElement | null>(null);
  const allocationRef = useRef<HTMLDivElement | null>(null);
  const healthRef = useRef<HTMLDivElement | null>(null);
  const alignmentRef = useRef<HTMLDivElement | null>(null);
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
  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    const base = transactions.filter((transaction) => {
      if (
        transactionActionFilter !== "all" &&
        transaction.action !== transactionActionFilter
      ) {
        return false;
      }

      if (!query) return true;

      const haystack =
        `${transaction.assetName} ${transaction.action} ${transaction.source} ${transaction.type} ${transaction.notes}`.toLowerCase();
      return haystack.includes(query);
    });

    return [...base].sort((left, right) => {
      switch (transactionSort) {
        case "date-asc":
          return left.date.localeCompare(right.date);
        case "amount-desc":
          return right.amount - left.amount;
        case "amount-asc":
          return left.amount - right.amount;
        case "name-asc":
          return left.assetName.localeCompare(right.assetName);
        case "date-desc":
        default:
          return right.date.localeCompare(left.date);
      }
    });
  }, [transactionActionFilter, transactionSearch, transactionSort, transactions]);
  const visibleTransactionAmount = useMemo(
    () => filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [filteredTransactions],
  );
  const visibleTransactionSources = useMemo(
    () => new Set(filteredTransactions.map((transaction) => transaction.source)).size,
    [filteredTransactions],
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
  const scrollToSection = (section: PortfolioWorkspaceSection) => {
    const refMap: Record<PortfolioWorkspaceSection, React.RefObject<HTMLDivElement | null>> = {
      "manual-entry": manualEntryRef,
      "transaction-journal": transactionJournalRef,
      "import-review": importReviewRef,
      allocation: allocationRef,
      health: healthRef,
      alignment: alignmentRef,
    };

    refMap[section].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const portfolioNavigatorOptions = [
    ["portfolio-manual-entry", "Holdings: manual tracker"],
    ["portfolio-import-review", "Imports: review queue"],
    ["portfolio-transaction-journal", "Journal: transaction log"],
    ["portfolio-allocation", "Read: allocation snapshot"],
    ["portfolio-health", "Checks: portfolio health"],
    ["portfolio-alignment", "Compare: profile alignment"],
  ] as Array<[string, string]>;
  const handlePortfolioNavigatorChange = (value: string) => {
    setNavigatorValue(value);
    const sectionMap: Record<string, PortfolioWorkspaceSection> = {
      "portfolio-manual-entry": "manual-entry",
      "portfolio-import-review": "import-review",
      "portfolio-transaction-journal": "transaction-journal",
      "portfolio-allocation": "allocation",
      "portfolio-health": "health",
      "portfolio-alignment": "alignment",
    };
    scrollToSection(sectionMap[value] ?? "manual-entry");
  };
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
  const reconciliationRows = useMemo(
    () => {
      const usedPreviewIndexes = new Set<number>();

      return importPreview.duplicates
        .map(({ existingAsset, importedAsset }) => {
          const importedIndex = importPreview.assets.findIndex((asset, index) => {
            if (usedPreviewIndexes.has(index)) return false;

            return createImportAssetKey(asset) === createImportAssetKey(importedAsset);
          });
          if (importedIndex >= 0) {
            usedPreviewIndexes.add(importedIndex);
          }
          const currentValueDelta = importedAsset.value - existingAsset.value;
          const investedValueDelta = importedAsset.investedValue - existingAsset.investedValue;
          const quantityDelta = importedAsset.quantity - existingAsset.quantity;
          const priceDelta = importedAsset.price - existingAsset.price;
          const hasMeaningfulDelta =
            Math.abs(currentValueDelta) >= 1 ||
            Math.abs(investedValueDelta) >= 1 ||
            Math.abs(quantityDelta) >= 0.01 ||
            Math.abs(priceDelta) >= 0.01;

          return {
            currentValueDelta,
            existingAsset,
            hasMeaningfulDelta,
            importedAsset,
            importedRowKey:
              importedIndex >= 0
                ? createImportSelectionKey(importPreview.assets[importedIndex], importedIndex)
                : createImportAssetKey(importedAsset),
            investedValueDelta,
            priceDelta,
            quantityDelta,
          };
        })
        .filter((row) => row.hasMeaningfulDelta);
    },
    [importPreview.assets, importPreview.duplicates],
  );
  const reconciliationSelectedCount = useMemo(
    () =>
      reconciliationRows.filter((row) => selectedImportKeys.includes(row.importedRowKey)).length,
    [reconciliationRows, selectedImportKeys],
  );
  const reconciliationHeldBackCount = useMemo(
    () => reconciliationRows.length - reconciliationSelectedCount,
    [reconciliationRows.length, reconciliationSelectedCount],
  );
  const allocationInsights = useMemo(
    () => getAllocationInsights({ assets: safeAssets, portfolioTotal, profile }),
    [portfolioTotal, profile, safeAssets],
  );
  const importDecisionMetrics = [
    {
      label: "Holdings parsed",
      value: String(importPreview.assets.length),
      caption:
        importPreview.assets.length > 0
          ? `${selectedImportedAssets.length} selected for import right now.`
          : "Holding rows are not staged yet.",
    },
    {
      label: "Transactions ready",
      value: String(newTransactionImportPreview.length),
      caption:
        transactionImportPreview.transactions.length > 0
          ? `${duplicateTransactionCount} duplicate transaction row${duplicateTransactionCount === 1 ? "" : "s"} filtered out.`
          : "Transaction rows are not parsed yet.",
    },
    {
      label: "Warnings",
      value: String(
        (importArtifacts?.rowWarnings.length ?? importPreview.errors.length) +
          transactionImportPreview.errors.length,
      ),
      caption:
        importReview?.providerConfidence != null
          ? `${importReview.providerConfidence} provider fit with ${importReview.parseReadiness ?? "unknown"} readiness.`
          : "Provider fit appears once the review runs.",
      },
  ];
  const importReadyHoldingCount = selectedImportedAssets.length;
  const importReadyTransactionCount = newTransactionImportPreview.length;
  const importCommitLabel =
    importReadyHoldingCount === 0 && importReadyTransactionCount === 0
      ? "Nothing selected to import yet"
      : importReadyHoldingCount > 0 && importReadyTransactionCount > 0
        ? "Portfolio and journal will both update"
        : importReadyHoldingCount > 0
          ? "Live holdings will update"
          : "Transaction journal will update";
  const importCommitDetail =
    importReadyHoldingCount === 0 && importReadyTransactionCount === 0
      ? "Select reviewed holdings or keep at least one parsed transaction ready before you import."
      : importReadyHoldingCount > 0 && importReadyTransactionCount > 0
        ? `${importReadyHoldingCount} holding${importReadyHoldingCount === 1 ? "" : "s"} and ${importReadyTransactionCount} transaction row${importReadyTransactionCount === 1 ? "" : "s"} are staged for this pass.`
        : importReadyHoldingCount > 0
          ? `${importReadyHoldingCount} reviewed holding${importReadyHoldingCount === 1 ? "" : "s"} will shape the live portfolio snapshot.`
          : `${importReadyTransactionCount} transaction row${importReadyTransactionCount === 1 ? "" : "s"} will strengthen the journal without changing the live holdings snapshot by itself.`;
  const importPrimaryRisk =
    importPreview.errors.length > 0
      ? "Parser blockers still exist"
      : reconciliationHeldBackCount > 0
        ? `${reconciliationHeldBackCount} duplicate mismatch${reconciliationHeldBackCount === 1 ? "" : "es"} still held back`
        : duplicateTransactionCount > 0
          ? `${duplicateTransactionCount} duplicate transaction row${duplicateTransactionCount === 1 ? "" : "s"} will be skipped`
          : "No major blockers in current selection";
  const importPrimaryRiskDetail =
    importPreview.errors.length > 0
      ? "Fix the preview errors before trusting this import pass."
      : reconciliationHeldBackCount > 0
        ? "That is healthy if you are still unsure. Held-back duplicate rows stay out of the import until you explicitly merge them."
        : duplicateTransactionCount > 0
          ? "The journal dedupe is protecting you from replaying the same cash-flow row twice."
          : "The current selection reads like a focused import rather than a broad overwrite.";
  const importVerdictToneClass =
    importPreview.errors.length > 0
      ? "border-rose-500/30 bg-rose-500/10"
      : reconciliationHeldBackCount > 0 || duplicateTransactionCount > 0
        ? "border-amber-500/30 bg-amber-500/10"
        : importReadyHoldingCount > 0 || importReadyTransactionCount > 0
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border bg-muted/30";
  const importVerdictBadgeVariant =
    importPreview.errors.length > 0
      ? "outline"
      : importReadyHoldingCount > 0 || importReadyTransactionCount > 0
        ? "secondary"
        : "outline";
  const importVerdictLabel =
    importPreview.errors.length > 0
      ? "Blocked until fixed"
      : reconciliationHeldBackCount > 0
        ? "Selective import recommended"
        : duplicateTransactionCount > 0
          ? "Journal dedupe active"
          : importReadyHoldingCount > 0 || importReadyTransactionCount > 0
            ? "Ready for controlled import"
            : "Waiting for reviewed selection";
  const importButtonLabel =
    importReadyHoldingCount === 0 && importReadyTransactionCount === 0
      ? "Import selected"
      : importReadyHoldingCount > 0 && importReadyTransactionCount > 0
        ? `Import ${importReadyHoldingCount} holding${importReadyHoldingCount === 1 ? "" : "s"} + ${importReadyTransactionCount} journal row${importReadyTransactionCount === 1 ? "" : "s"}`
        : importReadyHoldingCount > 0
        ? `Import ${importReadyHoldingCount} holding${importReadyHoldingCount === 1 ? "" : "s"}`
        : `Import ${importReadyTransactionCount} journal row${importReadyTransactionCount === 1 ? "" : "s"}`;
  const recentImportJobs = useMemo(
    () =>
      importJobs
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 4),
    [importJobs],
  );
  const latestImportJob = recentImportJobs[0] ?? null;
  const latestImportFlowMeta = latestImportJob ? getImportJobFlowMeta(latestImportJob) : null;
  const latestImportStats = latestImportJob ? getImportJobOutcomeStats(latestImportJob) : null;
  const latestImportSourceText = latestImportJob
    ? latestImportJob.normalizedText.trim() || latestImportJob.rawText.trim()
    : "";
  const latestImportPreview = useMemo(
    () =>
      latestImportSourceText
        ? previewPortfolioImport(latestImportSourceText, safeAssets)
        : null,
    [latestImportSourceText, safeAssets],
  );
  const latestImportReplayResult = useMemo(
    () =>
      latestImportJob
        ? applyImportJobToPortfolio({
            existingAssets: safeAssets,
            existingTransactions: transactions,
            job: latestImportJob,
            mode: importMode,
          })
        : null,
    [importMode, latestImportJob, safeAssets, transactions],
  );
  const historyReplayReadyCount = recentImportJobs.filter((job) => {
    const actions = getImportJobHistoryActions(job);

    return !actions.applyAction.disabled;
  }).length;
  const historyReopenReadyCount = recentImportJobs.filter((job) => job.rawText.trim() || job.normalizedText.trim()).length;
  const historyReprocessReadyCount = recentImportJobs.filter((job) => {
    const actions = getImportJobHistoryActions(job);

    return !actions.reprocessAction.disabled;
  }).length;
  const historyActionSummary =
    recentImportJobs.length === 0
      ? "History will become useful after the first reviewed statement."
      : historyReplayReadyCount > 0
        ? `${historyReplayReadyCount} saved import${historyReplayReadyCount === 1 ? "" : "s"} still have reusable delta if you need to replay them.`
        : "Most saved imports now read more like reference history than replay candidates.";
  const historyActionDetail =
    recentImportJobs.length === 0
      ? "Once you review or complete an import, this lane turns into your memory for what was loaded, what was skipped, and what can still be reused."
      : historyReplayReadyCount > 0
        ? "Replay is best when the current tracker still has a meaningful gap. Reopen is better when you want to inspect the saved review again."
        : "The safest move is usually reopen or reprocess, because the tracker already reflects most of the older payloads.";
  const historyVerdictLabel =
    recentImportJobs.length === 0
      ? "History waiting for first reviewed import"
      : historyReplayReadyCount > 0
        ? "Reusable import memory available"
        : historyReprocessReadyCount > 0
          ? "Reference lane with parser retry value"
          : "Reference and audit lane";
  const historyVerdictToneClass =
    recentImportJobs.length === 0
      ? "border-border bg-muted/30"
      : historyReplayReadyCount > 0
        ? "border-emerald-500/30 bg-emerald-500/10"
        : historyReprocessReadyCount > 0
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-border bg-muted/30";
  const historyVerdictBadgeVariant =
    historyReplayReadyCount > 0 ? "secondary" : "outline";
  const replayImpactLabel =
    !latestImportJob || !latestImportPreview
      ? "Replay check pending"
      : latestImportReplayResult
        ? latestImportReplayResult.appliedAssetCount > 0 || latestImportReplayResult.appliedTransactionCount > 0
          ? "Replay would still change the tracker"
          : "Replay is mostly exhausted"
        : "Replay is mostly exhausted";
  const replayImpactDetail =
    !latestImportJob || !latestImportPreview
      ? "Once a reviewed import is saved, this section compares that payload with the tracker you have now."
      : latestImportReplayResult
        ? latestImportReplayResult.appliedAssetCount > 0 || latestImportReplayResult.appliedTransactionCount > 0
          ? `${latestImportReplayResult.appliedAssetCount} holding change${latestImportReplayResult.appliedAssetCount === 1 ? "" : "s"} and ${latestImportReplayResult.appliedTransactionCount} transaction row${latestImportReplayResult.appliedTransactionCount === 1 ? "" : "s"} would still land if you replayed this import now.`
          : "The live tracker already reflects this saved payload closely enough that replay would add little or no new value."
        : "The live tracker already reflects this saved payload closely enough that replay would add little or no new value.";
  const replayGapLabel =
    !latestImportJob || !latestImportPreview
      ? "No saved comparison yet"
      : latestImportPreview.newAssets.length > 0
        ? `${latestImportPreview.newAssets.length} holding row${latestImportPreview.newAssets.length === 1 ? "" : "s"} still look new`
        : "No obvious holding gap remains";
  const replayGapDetail =
    !latestImportJob || !latestImportPreview
      ? "A reviewed import creates the baseline for this comparison."
      : latestImportPreview.newAssets.length > 0
        ? "These are the holdings from the saved payload that still do not map cleanly into the current tracker."
        : "Most of the latest payload now overlaps with holdings you already track.";
  const replayVerdictLabel =
    !latestImportJob || !latestImportPreview
      ? "Replay decision waiting on saved comparison"
      : latestImportReplayResult &&
          (latestImportReplayResult.appliedAssetCount > 0 ||
            latestImportReplayResult.appliedTransactionCount > 0)
        ? "Replay can still change the tracker"
        : latestImportPreview.newAssets.length > 0
          ? "Gap exists, but replay may not be the best tool"
          : "Replay is mostly exhausted";
  const replayVerdictToneClass =
    !latestImportJob || !latestImportPreview
      ? "border-border bg-muted/30"
      : latestImportReplayResult &&
          (latestImportReplayResult.appliedAssetCount > 0 ||
            latestImportReplayResult.appliedTransactionCount > 0)
        ? "border-amber-500/30 bg-amber-500/10"
        : latestImportPreview.newAssets.length > 0
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-emerald-500/30 bg-emerald-500/10";
  const replayVerdictBadgeVariant =
    latestImportReplayResult &&
    (latestImportReplayResult.appliedAssetCount > 0 ||
      latestImportReplayResult.appliedTransactionCount > 0)
      ? "outline"
      : "secondary";
  const replayVerdictDetail =
    !latestImportJob || !latestImportPreview
      ? "This section becomes useful after a reviewed import is saved and can be compared with the tracker you have now."
      : latestImportReplayResult &&
          (latestImportReplayResult.appliedAssetCount > 0 ||
            latestImportReplayResult.appliedTransactionCount > 0)
        ? "A replay would still make live changes, so treat it like an intentional operating action rather than a convenience click."
        : latestImportPreview.newAssets.length > 0
          ? "The saved payload still teaches you something, but replay alone may not be the cleanest way to close the remaining gap."
          : "The current tracker already mirrors this saved import closely enough that replay is now mostly reference, not action.";
  const healthLeadCheck = portfolioChecks[0];
  const detailCoverageCheck = portfolioChecks.find((check) => check.label === "Detail coverage");
  const diversificationCheck = portfolioChecks.find(
    (check) => check.label === "Diversification score",
  );
  const allocationLeadInsight = allocationInsights[0];
  const allocationActionSummary = allocationLeadInsight
    ? allocationLeadInsight.currentShare > allocationLeadInsight.suggestedShare
      ? `Trim attention from ${allocationLeadInsight.bucket}. It is ${allocationLeadInsight.currentShare - allocationLeadInsight.suggestedShare}% above the suggested weight.`
      : `Build more into ${allocationLeadInsight.bucket}. It is ${allocationLeadInsight.suggestedShare - allocationLeadInsight.currentShare}% below the suggested weight.`
    : "Capture more holdings so the allocation engine can point to a real overweight or underweight.";
  const allocationChangeSummary = latestImportPreview
    ? latestImportPreview.newAssets.length > 0
      ? `${latestImportPreview.newAssets.length} newly parsed holding row${latestImportPreview.newAssets.length === 1 ? "" : "s"} can still change the visible mix.`
      : `${latestImportPreview.duplicates.length} matched row${latestImportPreview.duplicates.length === 1 ? "" : "s"} are mostly refreshing holdings you already track.`
    : "No recent import payload is shaping the allocation read yet.";
  const healthAttentionChecks = portfolioChecks.filter((check) => {
    const text = `${check.label} ${check.status}`.toLowerCase();
    return (
      text.includes("low") ||
      text.includes("needs") ||
      text.includes("add") ||
      text.includes("concentr") ||
      text.includes("under")
    );
  });
  const leadHealthAttentionCheck = healthAttentionChecks[0] ?? null;
  const leadHealthAttentionLabel = leadHealthAttentionCheck?.label ?? "";
  const leadHealthAttentionStatus = leadHealthAttentionCheck?.status ?? "";
  const healthActionSummary = healthAttentionChecks[0]
    ? `${healthAttentionChecks[0].label}: ${healthAttentionChecks[0].status}`
    : portfolioChecks[0]?.status ??
      "Health checks will turn into clearer actions once the portfolio has more detail.";
  const healthSectionReadLabel =
    healthAttentionChecks.length === 0
      ? "Health read is stable"
      : healthAttentionChecks[0]
        ? `${healthAttentionChecks[0].label} is the first issue to clear`
        : "Health read is waiting on more detail";
  const healthSectionReadDetail =
    healthAttentionChecks.length === 0
      ? "Nothing major is shouting for attention right now, so this section is acting more like confirmation than warning."
      : healthAttentionChecks[0]
        ? `Start with ${healthAttentionChecks[0].label.toLowerCase()}. It is the first weak point most likely to improve the rest of the portfolio read once fixed.`
        : "As more holdings and detail land, the checks will turn into clearer operating guidance.";
  const healthConfidenceSummary = latestImportJob
    ? latestImportJob.providerConfidence === "high"
      ? "The latest review came through with strong provider confidence, so these checks are reading off relatively trustworthy data."
      : `The latest review is only ${latestImportJob.providerConfidence} confidence, so use the checks as prompts to verify details rather than as a final verdict.`
    : "No recent reviewed import is supporting the health layer yet.";
  const healthVerdictLabel =
    portfolioChecks.length === 0
      ? "Health checks are still forming"
      : healthAttentionChecks.length === 0
        ? "Health layer is broadly stable"
        : latestImportJob?.providerConfidence === "low"
          ? "Checks show risk, but data trust comes first"
          : "One weak check should lead the next fix";
  const healthVerdictToneClass =
    portfolioChecks.length === 0
      ? "border-border bg-muted/30"
      : healthAttentionChecks.length === 0
        ? "border-emerald-500/30 bg-emerald-500/10"
        : latestImportJob?.providerConfidence === "low"
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-sky-500/30 bg-sky-500/10";
  const healthVerdictBadgeVariant =
    portfolioChecks.length > 0 && healthAttentionChecks.length === 0 ? "secondary" : "outline";
  const healthVerdictDetail =
    portfolioChecks.length === 0
      ? "Once more holdings and imported detail are available, this section turns from placeholder guidance into a real operating read."
      : healthAttentionChecks.length === 0
        ? "The main use of this section right now is confirmation: keep the clean checks clean while the rest of the portfolio evolves."
        : latestImportJob?.providerConfidence === "low"
          ? "The checks are pointing to something real, but low-confidence source quality means the first move may be verifying the data before acting on the conclusion."
          : "There is enough signal here to fix one weak point deliberately instead of spreading attention across every warning at once.";
  const alignmentMissingInsights = allocationInsights.filter(
    (insight) => insight.currentShare < insight.suggestedShare,
  );
  const alignmentOverweightInsights = allocationInsights.filter(
    (insight) => insight.currentShare > insight.suggestedShare,
  );
  const alignmentActionSummary = alignmentMissingInsights[0]
    ? `Add toward ${alignmentMissingInsights[0].bucket} before chasing smaller tweaks elsewhere.`
    : alignmentOverweightInsights[0]
      ? `Review whether ${alignmentOverweightInsights[0].bucket} has become too dominant for your current profile.`
      : "Your captured mix is not showing a major bucket mismatch right now.";
  const alignmentWhyNowSummary = latestImportJob
    ? `${latestImportJob.providerName} is the latest source touching this comparison, so the drift you see here is anchored to the most recent review cycle.`
    : "Once a real statement lands, this section will explain why the newest import changed the mix.";
  const alignmentSectionReadLabel =
    allocationInsights.length === 0
      ? "Alignment read pending"
      : alignmentMissingInsights.length > 0
        ? `${alignmentMissingInsights[0].bucket} needs more support`
        : alignmentOverweightInsights.length > 0
          ? `${alignmentOverweightInsights[0].bucket} is running heavy`
          : "Current mix is broadly aligned";
  const alignmentSectionReadDetail =
    allocationInsights.length === 0
      ? "Once enough holdings are captured, this section will compare your live mix against the suggested profile posture."
      : alignmentMissingInsights.length > 0
        ? `${alignmentMissingInsights[0].bucket} is the clearest underweight bucket right now, so it is the best place to start when you want to close a real profile gap.`
        : alignmentOverweightInsights.length > 0
          ? `${alignmentOverweightInsights[0].bucket} is the loudest overweight bucket right now, so inspect the holdings inside it before making smaller tweaks elsewhere.`
          : "The captured portfolio is not showing a major suggested-vs-current mismatch right now.";
  const alignmentVerdictLabel =
    allocationInsights.length === 0
      ? "Alignment read is still forming"
      : alignmentMissingInsights.length > 0
        ? "One bucket is missing core support"
        : alignmentOverweightInsights.length > 0
          ? "One bucket is carrying too much weight"
          : "Current mix is broadly aligned";
  const alignmentVerdictToneClass =
    allocationInsights.length === 0
      ? "border-border bg-muted/30"
      : alignmentMissingInsights.length > 0
        ? "border-sky-500/30 bg-sky-500/10"
        : alignmentOverweightInsights.length > 0
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-emerald-500/30 bg-emerald-500/10";
  const alignmentVerdictBadgeVariant =
    allocationInsights.length > 0 &&
    alignmentMissingInsights.length === 0 &&
    alignmentOverweightInsights.length === 0
      ? "secondary"
      : "outline";
  const filteredHoldings = useMemo(() => {
    const query = holdingsSearch.trim().toLowerCase();
    const base = query
      ? safeAssets.filter((asset) => {
          const haystack = `${asset.name} ${asset.type} ${asset.source}`.toLowerCase();
          return haystack.includes(query);
        })
      : safeAssets;

    return [...base].sort((left, right) => {
      switch (holdingsSort) {
        case "gain-desc":
          return right.gain - left.gain;
        case "gain-asc":
          return left.gain - right.gain;
        case "name-asc":
          return left.name.localeCompare(right.name);
        case "manual-first": {
          const leftManual = left.source.toLowerCase() === "manual" ? 0 : 1;
          const rightManual = right.source.toLowerCase() === "manual" ? 0 : 1;
          if (leftManual !== rightManual) return leftManual - rightManual;
          return right.value - left.value;
        }
        case "value-desc":
        default:
          return right.value - left.value;
      }
    });
  }, [holdingsSearch, holdingsSort, safeAssets]);
  const visibleHoldingsValue = useMemo(
    () => filteredHoldings.reduce((sum, asset) => sum + asset.value, 0),
    [filteredHoldings],
  );
  const manualHoldingsCount = filteredHoldings.filter(
    (asset) => asset.source.toLowerCase() === "manual",
  ).length;
  const topAllocationBucket = (() => {
    if (chartData.length === 0) return null;
    return [...chartData].sort((left, right) => right.value - left.value)[0] ?? null;
  })();
  useEffect(() => {
    if (allocationInsights.length === 0) {
      if (activeAlignmentBucket) {
        setActiveAlignmentBucket("");
      }
      return;
    }

    const stillExists = allocationInsights.some(
      (insight) => insight.bucket === activeAlignmentBucket,
    );
    if (!stillExists) {
      setActiveAlignmentBucket(allocationInsights[0]?.bucket ?? "");
    }
  }, [activeAlignmentBucket, allocationInsights]);
  const activeAlignmentInsight =
    allocationInsights.find((insight) => insight.bucket === activeAlignmentBucket) ??
    allocationInsights[0] ??
    null;
  const activeAlignmentAssets = useMemo(() => {
    if (!activeAlignmentInsight) return [];

    return safeAssets
      .filter((asset) => asset.type === activeAlignmentInsight.bucket)
      .sort((left, right) => right.value - left.value);
  }, [activeAlignmentInsight, safeAssets]);
  const activeAlignmentBucketValue = activeAlignmentAssets.reduce(
    (sum, asset) => sum + asset.value,
    0,
  );
  const activeAlignmentBucketInvested = activeAlignmentAssets.reduce(
    (sum, asset) => sum + asset.investedValue,
    0,
  );
  const activeAlignmentBucketShare =
    portfolioTotal > 0 ? (activeAlignmentBucketValue / portfolioTotal) * 100 : 0;
  const alignmentFocusedReadLabel = activeAlignmentInsight?.bucket ?? "No bucket selected";
  const alignmentFocusedReadDetail = activeAlignmentInsight
    ? `${activeAlignmentInsight.currentShare}% current vs ${activeAlignmentInsight.suggestedShare}% suggested, with ${activeAlignmentAssets.length} holding${activeAlignmentAssets.length === 1 ? "" : "s"} currently mapping into this bucket.`
    : "Choose a suggested bucket to inspect the holdings that are currently supporting or missing it.";
  const alignmentFocusedVerdictLabel =
    !activeAlignmentInsight
      ? "Choose one bucket to inspect"
      : activeAlignmentAssets.length === 0
        ? "This bucket is missing live support"
        : activeAlignmentInsight.currentShare < activeAlignmentInsight.suggestedShare
          ? "Support here is still too thin"
          : activeAlignmentAssets.length === 1
            ? "One holding is driving this bucket"
            : "This bucket is readable through its holdings";
  const alignmentFocusedVerdictToneClass =
    !activeAlignmentInsight
      ? "border-border bg-muted/30"
      : activeAlignmentAssets.length === 0
        ? "border-sky-500/30 bg-sky-500/10"
        : activeAlignmentInsight.currentShare < activeAlignmentInsight.suggestedShare
          ? "border-amber-500/30 bg-amber-500/10"
          : activeAlignmentAssets.length === 1
            ? "border-sky-500/30 bg-sky-500/10"
            : "border-emerald-500/30 bg-emerald-500/10";
  const alignmentFocusedVerdictBadgeVariant =
    activeAlignmentInsight && activeAlignmentAssets.length > 1 ? "secondary" : "outline";
  const priorityQueue = (() => {
    const items: Array<{
      detail: string;
      label: string;
      section: PortfolioWorkspaceSection;
      tone: "urgent" | "steady" | "watch";
    }> = [];

    if (safeAssets.length === 0) {
      items.push({
        detail:
          "Add the first real holding or import a statement so the rest of the portfolio page can become specific.",
        label: "Capture first live holding",
        section: "manual-entry",
        tone: "urgent",
      });
    }

    if (
      uploadedImportStatus === "ready" ||
      importPreview.assets.length > 0 ||
      transactionImportPreview.transactions.length > 0
    ) {
      items.push({
        detail: `${importPreview.assets.length} holding row${importPreview.assets.length === 1 ? "" : "s"} and ${newTransactionImportPreview.length} transaction row${newTransactionImportPreview.length === 1 ? "" : "s"} are waiting in the review lane.`,
        label: "Finish the pending import review",
        section: "import-review",
        tone: "urgent",
      });
    }

    if (transactions.length === 0 && safeAssets.length > 0) {
      items.push({
        detail:
          "The portfolio has holdings but no journal depth yet, so realized P&L and trajectory are still thin.",
        label: "Backfill the transaction journal",
        section: "transaction-journal",
        tone: "watch",
      });
    }

    if (leadHealthAttentionLabel && leadHealthAttentionStatus) {
      items.push({
        detail: leadHealthAttentionStatus,
        label: `Clear ${leadHealthAttentionLabel.toLowerCase()}`,
        section: "health",
        tone: "watch",
      });
    }

    if (alignmentMissingInsights[0] || alignmentOverweightInsights[0]) {
      const leadingAlignmentSignal = alignmentMissingInsights[0] ?? alignmentOverweightInsights[0];
      const direction =
        alignmentMissingInsights[0] && leadingAlignmentSignal === alignmentMissingInsights[0]
          ? "underweight"
          : "overweight";

      items.push({
        detail: `${leadingAlignmentSignal.bucket} is the clearest ${direction} bucket against the suggested mix right now.`,
        label: `Review ${leadingAlignmentSignal.bucket} drift`,
        section: "alignment",
        tone: "steady",
      });
    }

    if (manualHoldingsCount > 0) {
      items.push({
        detail: `${manualHoldingsCount} visible holding row${manualHoldingsCount === 1 ? "" : "s"} came from manual entry, so units and invested value deserve a quick verification pass.`,
        label: "Verify manual rows",
        section: "manual-entry",
        tone: "steady",
      });
    }

    const fallbackItems: Array<{
      detail: string;
      label: string;
      section: PortfolioWorkspaceSection;
      tone: "urgent" | "steady" | "watch";
    }> = [
      {
        detail:
          "Use the holdings board to confirm whether the biggest positions still deserve to lead the portfolio.",
        label: "Review the visible holdings board",
        section: "manual-entry",
        tone: "steady",
      },
      {
        detail:
          "Use the allocation chart to judge whether the portfolio is drifting by bucket rather than by individual names only.",
        label: "Read the allocation mix",
        section: "allocation",
        tone: "steady",
      },
      {
        detail:
          "Keep the health checks as a maintenance layer even when nothing looks obviously wrong.",
        label: "Confirm health checks stay clean",
        section: "health",
        tone: "steady",
      },
    ];

    const deduped = [...items, ...fallbackItems].filter(
      (item, index, current) =>
        current.findIndex(
          (candidate) =>
            candidate.label === item.label && candidate.section === item.section,
        ) === index,
    );

    return deduped.slice(0, 3);
  })();
  const holdingsBoardReadLabel =
    filteredHoldings.length === 0
      ? "Review board waiting on visible holdings"
      : manualHoldingsCount > 0
        ? "Manual rows deserve the first pass"
        : topAllocationBucket
          ? `${topAllocationBucket.name} is leading the visible risk`
          : "Visible holdings are ready for review";
  const holdingsBoardReadDetail =
    filteredHoldings.length === 0
      ? "Clear the search or load more holdings before the board can guide edits."
      : manualHoldingsCount > 0
        ? `${manualHoldingsCount} visible row${manualHoldingsCount === 1 ? "" : "s"} were entered manually, so units, price, and invested value are worth checking before smaller tidy-ups.`
        : topAllocationBucket
          ? `${formatMoney(topAllocationBucket.value)} of the visible value is currently concentrated in ${topAllocationBucket.name}, so start there if you are prioritizing attention.`
          : "The visible list is broad enough to review by value, gain, or source.";
  const holdingsBoardVerdictLabel =
    filteredHoldings.length === 0
      ? "Board waiting on a visible working set"
      : manualHoldingsCount > 0
        ? "Manual detail risk is the first thing to clear"
        : topAllocationBucket
          ? "Concentration review should lead this pass"
          : "Board is ready for structured review";
  const holdingsBoardVerdictToneClass =
    filteredHoldings.length === 0
      ? "border-border bg-muted/30"
      : manualHoldingsCount > 0
        ? "border-amber-500/30 bg-amber-500/10"
        : topAllocationBucket
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-emerald-500/30 bg-emerald-500/10";
  const holdingsBoardVerdictBadgeVariant =
    filteredHoldings.length > 0 && manualHoldingsCount === 0 ? "secondary" : "outline";
  useEffect(() => {
    if (chartData.length === 0) {
      if (activeAllocationBucket) {
        setActiveAllocationBucket("");
      }
      return;
    }

    const stillExists = chartData.some((bucket) => bucket.name === activeAllocationBucket);
    if (!stillExists) {
      setActiveAllocationBucket(topAllocationBucket?.name ?? chartData[0]?.name ?? "");
    }
  }, [activeAllocationBucket, chartData, topAllocationBucket]);
  const activeAllocationBucketName = activeAllocationBucket || topAllocationBucket?.name || "";
  const activeAllocationAssets = !activeAllocationBucketName
    ? []
    : safeAssets
        .filter((asset) => asset.type === activeAllocationBucketName)
        .sort((left, right) => right.value - left.value);
  const activeAllocationBucketValue = activeAllocationAssets.reduce(
    (sum, asset) => sum + asset.value,
    0,
  );
  const activeAllocationBucketInvested = activeAllocationAssets.reduce(
    (sum, asset) => sum + asset.investedValue,
    0,
  );
  const activeAllocationBucketShare =
    portfolioTotal > 0 ? (activeAllocationBucketValue / portfolioTotal) * 100 : 0;
  const allocationSectionReadLabel =
    chartData.length === 0
      ? "Allocation read pending"
      : allocationLeadInsight
        ? allocationLeadInsight.currentShare > allocationLeadInsight.suggestedShare
          ? `${allocationLeadInsight.bucket} is overweight`
          : `${allocationLeadInsight.bucket} is underweight`
        : topAllocationBucket
          ? `${topAllocationBucket.name} is carrying the mix`
          : "Allocation mix is visible";
  const allocationSectionReadDetail =
    chartData.length === 0
      ? "Once more holdings are tracked, this section turns into the fastest view of where portfolio value is really sitting."
      : allocationLeadInsight
        ? `${allocationLeadInsight.bucket} is at ${allocationLeadInsight.currentShare}% current weight versus ${allocationLeadInsight.suggestedShare}% suggested, so that is the clearest mix signal right now.`
        : topAllocationBucket
          ? `${formatMoney(topAllocationBucket.value)} is currently concentrated in ${topAllocationBucket.name}, so that bucket deserves the first scan.`
          : "The chart is visible, but a clearer suggested-vs-current read still needs more holdings detail.";
  const allocationVerdictLabel =
    chartData.length === 0
      ? "Allocation read is still forming"
      : allocationLeadInsight
        ? allocationLeadInsight.currentShare > allocationLeadInsight.suggestedShare
          ? "One bucket is visibly overweight"
          : "One bucket is visibly underweight"
        : topAllocationBucket
          ? "Concentration read is stronger than profile alignment"
          : "Allocation mix is readable";
  const allocationVerdictToneClass =
    chartData.length === 0
      ? "border-border bg-muted/30"
      : allocationLeadInsight
        ? "border-sky-500/30 bg-sky-500/10"
        : topAllocationBucket
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-emerald-500/30 bg-emerald-500/10";
  const allocationVerdictBadgeVariant =
    chartData.length > 0 && allocationInsights.length > 0 ? "secondary" : "outline";
  const focusedBucketReadLabel = activeAllocationBucketName || "No bucket selected";
  const focusedBucketReadDetail =
    activeAllocationBucketName
      ? `${activeAllocationAssets.length} holding${activeAllocationAssets.length === 1 ? "" : "s"} are currently driving ${activeAllocationBucketName}, which represents ${activeAllocationBucketShare.toFixed(1)}% of tracked value.`
      : "Choose a bucket to inspect the holdings behind that slice of the portfolio.";
  const focusedBucketVerdictLabel =
    !activeAllocationBucketName
      ? "Choose one bucket to inspect"
      : activeAllocationAssets.length === 0
        ? "Bucket is selected but not populated"
        : activeAllocationBucketShare >= 40
          ? "Bucket concentration is material"
          : activeAllocationAssets.length === 1
            ? "Single holding is driving this bucket"
            : "Bucket composition is inspectable";
  const focusedBucketVerdictToneClass =
    !activeAllocationBucketName
      ? "border-border bg-muted/30"
      : activeAllocationBucketShare >= 40
        ? "border-amber-500/30 bg-amber-500/10"
        : activeAllocationAssets.length === 1
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-emerald-500/30 bg-emerald-500/10";
  const focusedBucketVerdictBadgeVariant =
    activeAllocationBucketName && activeAllocationAssets.length > 1 ? "secondary" : "outline";
  const workspaceSections: Array<{
    id: PortfolioWorkspaceSection;
    label: string;
    note: string;
  }> = [
    {
      id: "manual-entry",
      label: "Manual entry",
      note: `${safeAssets.length} holding${safeAssets.length === 1 ? "" : "s"} currently tracked.`,
    },
    {
      id: "transaction-journal",
      label: "Journal",
      note: `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} recorded.`,
    },
    {
      id: "import-review",
      label: "Import review",
      note:
        importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0
          ? `${importPreview.assets.length} holdings and ${transactionImportPreview.transactions.length} transaction rows in review.`
          : "Parsed rows are not waiting in review yet.",
    },
    {
      id: "allocation",
      label: "Allocation",
      note:
        chartData.length > 0
          ? `${chartData.length} allocation bucket${chartData.length === 1 ? "" : "s"} visible.`
          : "Allocation chart wakes up once holdings are captured.",
    },
    {
      id: "health",
      label: "Health",
      note: `${portfolioChecks.length} operating check${portfolioChecks.length === 1 ? "" : "s"} are monitoring portfolio quality.`,
    },
    {
      id: "alignment",
      label: "Alignment",
      note:
        allocationInsights.length > 0
          ? `${allocationInsights.length} suggested bucket${allocationInsights.length === 1 ? "" : "s"} compared with your live mix.`
          : "Suggested-vs-current alignment appears once real holdings are in place.",
    },
  ];
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
  const manualImportReady = csvText.trim().length > 0;
  const importSourceLabel = hasUploadedImport
    ? uploadedFileLabel
      ? `Uploaded source: ${uploadedFileLabel}`
      : "Uploaded source loaded"
    : manualImportReady
      ? "Manual text is active"
      : "No source loaded yet";
  const importSourceHint =
    uploadedImportStatus === "ready" && uploadedFileLabel
      ? "Uploaded file extracted and ready for review."
      : uploadedImportStatus === "processing" && uploadedFileLabel
        ? `Extracting ${uploadedFileLabel} now.`
        : uploadedImportStatus === "selected" && uploadedFileLabel
          ? `${uploadedFileLabel} is selected and waiting for upload.`
          : hasUploadedImport
            ? "The uploaded text is active in the review lane."
            : manualImportReady
              ? "Manual text is active in the review lane."
              : "Load a file or paste statement text to start the review lane.";
  const importNextStepHint =
    uploadedImportStatus === "selected"
      ? "Upload the selected file first."
      : uploadedImportStatus === "ready"
        ? "Review the uploaded statement next."
        : manualImportReady
          ? "Review the pasted text next."
          : "Choose a file or paste statement text first.";
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
  const portfolioTopStats = [
    {
      label: "Tracked value",
      value: formatMoney(portfolioTotal),
      detail:
        safeAssets.length > 0
          ? `${safeAssets.length} holding${safeAssets.length === 1 ? "" : "s"} are contributing to the live view.`
          : "Live holdings are not shaping the portfolio yet.",
    },
    {
      label: "Invested basis",
      value: formatMoney(investedValue),
      detail:
        investedValue > 0
          ? "Cost basis captured across tracked holdings."
          : "Add invested value to make gain and health checks more trustworthy.",
    },
    {
      label: "Diversification",
      value: `${diversificationScore}/100`,
      detail:
        diversificationScore > 0
          ? "A quick read on how concentrated or spread the portfolio is."
          : "This turns meaningful once a few real holdings are captured.",
    },
    {
      label: "P&L posture",
      value: formatMoney(unrealizedGain + realizedGain),
      detail:
        transactions.length > 0
          ? `${formatMoney(realizedGain)} realized and ${formatMoney(unrealizedGain)} unrealized.`
          : `${formatMoney(unrealizedGain)} unrealized across current holdings.`,
    },
  ];
  const portfolioOperatingLenses = [
    {
      label: "Coverage trust",
      value: portfolioReadinessLabel,
      detail:
        safeAssets.length === 0
          ? "The page is still waiting on a first real statement or holding."
          : "Use this to judge whether the rest of the page is reading from complete enough data.",
    },
    {
      label: "Import trust",
      value: latestImportJob
        ? `${latestImportJob.providerName} · ${latestImportJob.providerConfidence}`
        : "No recent import",
      detail: latestImportJob
        ? `${latestImportJob.rowWarnings.length} warning${latestImportJob.rowWarnings.length === 1 ? "" : "s"} on the latest saved review.`
        : "Once a reviewed statement lands, this becomes the source-quality lens.",
    },
    {
      label: "Concentration watch",
      value: topAllocationBucket?.name ?? "No dominant bucket",
      detail: topAllocationBucket
        ? `${formatMoney(topAllocationBucket.value)} is currently the biggest visible bucket.`
        : "Capture more holdings before reading concentration too hard.",
    },
  ];
  const portfolioWorkspaceVerdict =
    safeAssets.length === 0
      ? {
          badge: "Coverage first",
          badgeVariant: "outline" as const,
          detail:
            "This workspace is still waiting on the first real coverage layer, so the best use of the page is getting honest holdings or a statement into the tracker.",
          move: "Start with one import or a few real holdings before reading the lower diagnostics too hard.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        }
      : importPreview.errors.length > 0 || transactionImportPreview.errors.length > 0
        ? {
            badge: "Review lane is constraining trust",
            badgeVariant: "outline" as const,
            detail:
              "The page has enough real data to be useful, but parser or staging issues still limit how confidently you should merge and read everything downstream.",
            move: "Clear the current import review first, then trust the rest of the portfolio page more deeply.",
            toneClass: "border-amber-500/30 bg-amber-500/10",
          }
        : {
            badge: "Tracker is usable",
            badgeVariant: "secondary" as const,
            detail:
              "Coverage is good enough that allocation, health, and alignment can now act more like decision tools than placeholders.",
            move: "Use the priority queue to decide which lane deserves attention before editing the portfolio itself.",
            toneClass: "border-emerald-500/30 bg-emerald-500/10",
          };
  const manualTrackerVerdict =
    safeAssets.length === 0
      ? {
          badge: "Manual tracker is still empty",
          badgeVariant: "outline" as const,
          detail:
            "This section is not asking for optimization yet. It is asking for the first honest holding coverage so the rest of the page can wake up.",
          move: "Add the first holding or import a statement instead of polishing empty structure.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        }
      : investedValue <= 0
        ? {
            badge: "Coverage exists, detail is still thin",
            badgeVariant: "outline" as const,
            detail:
              "Holdings are present, but missing invested basis means gains and health checks can still be directionally useful without being fully trustworthy.",
            move: "Fill invested value and units before making bigger judgment calls from the tracker.",
            toneClass: "border-amber-500/30 bg-amber-500/10",
          }
        : {
            badge: "Tracker detail is usable",
            badgeVariant: "secondary" as const,
            detail:
              "The manual tracker has enough shape now that it can support cleaner allocation and health reads.",
            move: "Use this section mainly to patch gaps and keep the captured holdings honest.",
            toneClass: "border-emerald-500/30 bg-emerald-500/10",
          };
  const journalVerdict =
    transactions.length === 0
      ? {
          badge: "Journal is still thin",
          badgeVariant: "outline" as const,
          detail:
            "Without transaction history, the portfolio can show positions but not much about contribution behavior or realized outcomes.",
          move: "Log the first dated buys, sells, or dividends so trajectory and realized P&L stop relying on guesses.",
          toneClass: "border-sky-500/30 bg-sky-500/10",
        }
      : filteredTransactions.length < transactions.length
        ? {
            badge: "Filtered working view",
            badgeVariant: "outline" as const,
            detail:
              "You are looking at a narrowed journal slice right now, which is good for review as long as you remember it is not the whole story.",
            move: "Use the filter to isolate a pattern, then reset it before making broad conclusions.",
            toneClass: "border-sky-500/30 bg-sky-500/10",
          }
        : {
            badge: "Journal is supporting the story",
            badgeVariant: "secondary" as const,
            detail:
              "The transaction layer is now doing real work for trajectory, realized P&L, and import validation.",
            move: "Keep new entries clean and source-aware rather than letting the journal become an afterthought.",
            toneClass: "border-emerald-500/30 bg-emerald-500/10",
          };
  const operatingDeskMentorPrompt = hasUploadedImport
    ? [
        `I uploaded ${uploadedFileLabel ?? "a statement"} and the portfolio desk says "${operatingHeadline}".`,
        `Right now I have ${safeAssets.length} holdings, ${transactions.length} tracked transactions, and ${formatMoney(portfolioTotal)} in tracked value.`,
        importReview
          ? `The review reads ${importReview.providerConfidence ?? "unknown"} provider confidence with ${importReview.parseReadiness ?? "unknown"} readiness.`
          : "The import review has not been analyzed yet.",
        importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0
          ? `The preview currently shows ${importPreview.assets.length} holding rows and ${transactionImportPreview.transactions.length} transaction rows.`
          : "Useful rows have not been parsed into preview yet.",
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
    importReview?.guidance?.length
      ? `Review guidance: ${importReview.guidance.join(" ")}`
      : "There are no review guidance flags right now.",
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

  function handleSelectSingleImportRow(rowKey: string) {
    setSelectedImportKeys((current) =>
      current.includes(rowKey) ? current : [...current, rowKey],
    );
  }

  function handleDeselectSingleImportRow(rowKey: string) {
    setSelectedImportKeys((current) => current.filter((key) => key !== rowKey));
  }

  function handleSelectAllImportRows() {
    setSelectedImportKeys(
      importPreview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
  }

  function handleClearImportRows() {
    setSelectedImportKeys([]);
  }

  function handleOpenImportHistoryJob(job: ImportJob) {
    const sourceText = job.normalizedText.trim() || job.rawText.trim();

    if (!sourceText) {
      setCsvMessage("This history item does not have saved source text to reopen.");
      return;
    }

    const review = analyzeImportDocument({
      fileName: job.fileName,
      normalizationApplied: job.normalizationApplied,
      text: sourceText,
      usedOcr: job.usedOcr,
    });
    const preview = previewPortfolioImport(sourceText, safeAssets);
    const diagnostics = buildImportDiagnostics({
      normalizedText: sourceText,
      preview,
      rawText: job.rawText || sourceText,
    });

    setCsvText(sourceText);
    setUploadedFileLabel(null);
    setUploadedImportText("");
    setUploadedImportStatus("idle");
    setPendingUploadFile(null);
    setImportArtifacts(diagnostics);
    setImportReview(review);
    setSelectedImportKeys(
      preview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
    setCsvMessage(`Reopened ${job.providerName} import history for review.`);
    window.requestAnimationFrame(() => {
      importReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleReplayImportHistoryJob(job: ImportJob) {
    const result = applyImportJobToPortfolio({
      existingAssets: safeAssets,
      existingTransactions: transactions,
      job,
      mode: importMode,
    });

    if (!result) {
      setCsvMessage("This history item does not have reusable parsed rows to replay.");
      return;
    }

    onImportAssets(result.nextAssets);
    result.nextTransactions
      .slice(0, result.appliedTransactionCount)
      .forEach((transaction) => onAddTransaction(transaction));
    onLogImportJob(result.importJob);
    setCsvMessage(describeImportHistoryApplyResult(result));
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
    <div className="portfolio-page grid gap-5">
      <Card className="wealth-panel-strong overflow-hidden">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Portfolio workspace</Badge>
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
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${portfolioWorkspaceVerdict.toneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Workspace verdict</p>
                  <Badge variant={portfolioWorkspaceVerdict.badgeVariant}>{portfolioWorkspaceVerdict.badge}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {portfolioWorkspaceVerdict.detail}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {portfolioWorkspaceVerdict.move}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coverage
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {safeAssets.length > 0
                    ? `${safeAssets.length} holdings are shaping the live allocation view.`
                    : "Holdings are not tracked yet, so allocation and health checks are still waiting on real inputs."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Journal depth
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {transactions.length > 0
                    ? `${transactions.length} transaction entries are available for trajectory and realized P&L.`
                    : "Transaction history is still light, so portfolio trajectory is mostly inferred from holdings."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {portfolioTopStats.map((stat) => (
                <div
                  key={stat.label}
                  className="wealth-stat-tile"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.detail}</p>
                </div>
              ))}
            </div>
            <div className="wealth-inset grid gap-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Action lanes</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Start here if you want the fastest path to a cleaner, more decision-useful portfolio read.
                  </p>
                </div>
                <Badge variant="outline">{priorityQueue.length} active focus</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {priorityQueue.map((item) => (
                  <div
                    key={`${item.section}-${item.label}`}
                    className="wealth-muted-block p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <Badge
                        variant="outline"
                        className={
                          item.tone === "urgent"
                            ? "border-amber-500/40 text-amber-600 dark:text-amber-300"
                            : item.tone === "watch"
                              ? "border-primary/30 text-primary"
                              : "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                        }
                      >
                        {item.tone === "urgent"
                          ? "Now"
                          : item.tone === "watch"
                            ? "Next"
                            : "Keep in view"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.detail}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => scrollToSection(item.section)}
                    >
                      Jump there
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
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
                Add holding
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyCsv}>
                <Copy className="h-4 w-4" />
                Copy CSV
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
            <div className="wealth-inset grid gap-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">How to work this page</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Move through coverage first, then review allocation and health once the portfolio has enough real detail.
                  </p>
                </div>
                <Badge variant="outline">{portfolioReadinessLabel}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="wealth-muted-block p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step 1
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">Capture the real holdings</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Start with a statement import or add the missing holdings manually so the page has honest coverage.
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step 2
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">Clean the journal and import review</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Use the review lane and transaction journal to make sure the portfolio story is driven by clean rows, not rough guesses.
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step 3
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">Judge the mix, not just the positions</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Once coverage is solid, use allocation, health, and alignment to decide what really needs attention.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {workspaceSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className="wealth-data-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{section.label}</p>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{section.note}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current read
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">{portfolioHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{portfolioSubcopy}</p>
            </div>
            <div className="wealth-muted-block p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next portfolio move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">{importTrack.items[0]}</p>
            </div>
            <div className="wealth-inset p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reading order
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                <li>Get coverage honest before reacting to allocation drift.</li>
                <li>Trust imported rows only after source quality and duplicates look clean.</li>
                <li>Use holdings, journal, and health together before changing the mix.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <PageNavigatorBar
        label="Portfolio navigator"
        options={portfolioNavigatorOptions}
        value={navigatorValue}
        onChange={handlePortfolioNavigatorChange}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.band}</Badge>
            <Badge variant="outline">{profile.confidence}</Badge>
            <Badge variant="outline">{importTrack.title}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Holdings: manual tracker</CardTitle>
                <CardDescription>{formatMoney(portfolioTotal)} tracked across holdings, imports, and journal context</CardDescription>
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
          <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${manualTrackerVerdict.toneClass}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Manual tracker verdict</p>
                <Badge variant={manualTrackerVerdict.badgeVariant}>{manualTrackerVerdict.badge}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{manualTrackerVerdict.detail}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best operating move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{manualTrackerVerdict.move}</p>
            </div>
          </div>
          <div className="wealth-muted-block grid gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">{portfolioHeadline}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {portfolioSubcopy}
                </p>
              </div>
              <div className="wealth-inset min-w-56 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Focus now
                </p>
                <p className="mt-2 text-sm leading-6">{importTrack.items[0]}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  1. Add coverage
                </p>
                <p className="mt-2 text-sm leading-6">
                  Use import when you already have a broker, registrar, or email statement.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  2. Clean the details
                </p>
                <p className="mt-2 text-sm leading-6">
                  Make sure name, current value, invested value, units, and source are filled.
                </p>
              </div>
              <div className="wealth-inset p-3">
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="wealth-muted-block p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best for now
              </p>
              <p className="mt-2 text-sm text-foreground">
                {safeAssets.length === 0
                  ? "Import a real statement or add the first few holdings."
                  : "Review coverage gaps before making allocation judgments."}
              </p>
            </div>
            <div className="wealth-muted-block p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Do not confuse
              </p>
              <p className="mt-2 text-sm text-foreground">
                A neat list of holdings is not the same thing as a clean portfolio picture. Units, invested value, and transaction history matter.
              </p>
            </div>
            <div className="wealth-muted-block p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Next decision
              </p>
              <p className="mt-2 text-sm text-foreground">
                Decide whether to add coverage, clean details, or review drift before changing the portfolio itself.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricMini label="Tracked value" value={formatMoney(portfolioTotal)} />
            <MetricMini label="Invested basis" value={formatMoney(investedValue)} />
            <MetricMini label="Unrealized P&L" value={formatMoney(unrealizedGain)} />
            <MetricMini label="Diversification" value={`${diversificationScore}/100`} />
          </div>
          <div
            id="portfolio-manual-entry"
            ref={manualEntryRef}
            className="wealth-muted-block grid gap-3 p-3"
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
            id="portfolio-transaction-journal"
            ref={transactionJournalRef}
            className="wealth-muted-block grid gap-3 p-3"
            data-testid="transaction-journal"
            aria-label="Transaction journal"
            role="group"
          >
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${journalVerdict.toneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Journal verdict</p>
                  <Badge variant={journalVerdict.badgeVariant}>{journalVerdict.badge}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{journalVerdict.detail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{journalVerdict.move}</p>
              </div>
            </div>
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
            <div className="wealth-inset grid gap-3 p-3 md:grid-cols-[1.3fr_0.9fr_0.9fr] xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr]">
              <TextField
                inputTestId="transaction-search"
                label="Search journal"
                value={transactionSearch}
                onChange={setTransactionSearch}
              />
              <SelectField
                selectTestId="transaction-filter"
                label="Action filter"
                options={transactionActionFilterOptions}
                value={transactionActionFilter}
                onChange={setTransactionActionFilter}
              />
              <SelectField
                selectTestId="transaction-sort"
                label="Sort journal"
                options={transactionSortOptions}
                value={transactionSort}
                onChange={setTransactionSort}
              />
              <div className="wealth-muted-block p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  View summary
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {filteredTransactions.length} of {transactions.length} entries visible
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use the filter to isolate buys, sells, dividends, or transfers before reviewing a run of entries.
                </p>
              </div>
            </div>
            {(transactionSearch.trim() || transactionActionFilter !== "all" || transactionSort !== "recent") && (
              <div className="wealth-stat-tile flex flex-wrap items-center justify-between gap-2 p-3">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">{filteredTransactions.length}</span>{" "}
                  journal entr{filteredTransactions.length === 1 ? "y" : "ies"}
                  {transactionSearch.trim() ? (
                    <>
                      {" "}matching <span className="font-medium text-foreground">{transactionSearch.trim()}</span>
                    </>
                  ) : null}
                  .
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTransactionSearch("");
                    setTransactionActionFilter("all");
                    setTransactionSort("recent");
                  }}
                >
                  Reset view
                </Button>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <MetricMini
                label="Visible flow"
                value={formatMoney(visibleTransactionAmount)}
                caption="Amount represented by the entries currently visible in the journal view."
              />
              <MetricMini
                label="Visible sources"
                value={String(visibleTransactionSources)}
                caption="Helps you spot whether the visible journal slice is coming from one statement, sync, or manual patchwork."
              />
              <MetricMini
                label="Latest visible date"
                value={filteredTransactions[0]?.date ?? "No entries"}
                caption="The top row in the current sort order drives the first thing you review."
              />
            </div>
            <div className="grid gap-2">
              {filteredTransactions.length === 0 ? (
                <div className="wealth-empty-state px-3 py-4">
                  No journal entries match this view yet. Reset the view or widen the filter to bring your transactions back into scope.
                </div>
              ) : null}
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="wealth-data-card grid gap-3 px-3 py-3 text-xs sm:grid-cols-[1.1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{transaction.assetName}</p>
                      <Badge variant="outline">{transaction.action}</Badge>
                      <Badge variant="secondary">{transaction.type}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {transaction.date} · {transaction.source}
                    </p>
                    {transaction.notes ? (
                      <p className="mt-2 text-muted-foreground">{transaction.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatMoney(transaction.amount)}</p>
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

          <div className="wealth-muted-block grid gap-3 p-3">
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
                  className="wealth-data-card p-3"
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
            <div className="wealth-inset grid gap-2 p-3 text-xs text-muted-foreground md:grid-cols-2">
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
            id="portfolio-import-review"
            ref={importReviewRef}
            className="wealth-muted-block grid gap-3 p-3"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Import and review</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports CSV/TSV, pasted email text, OCR-backed PDF statements,
                  HTML tables, scheme/security name, current value, invested value, units,
                  NAV, LTP, and source labels.
                </p>
                {reconciliationRows.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {reconciliationSelectedCount} mismatch{reconciliationSelectedCount === 1 ? "" : "es"} set to merge
                    </Badge>
                    <Badge variant="outline">
                      {reconciliationHeldBackCount} held back
                    </Badge>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2">
                <div className="wealth-inset p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Pre-flight summary</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{importCommitLabel}</p>
                  <p className="mt-2 leading-5">{importCommitDetail}</p>
                  <div className="wealth-muted-block mt-3 p-2">
                    <p className="font-medium text-foreground">Primary risk check</p>
                    <p className="mt-1 leading-5">{importPrimaryRisk}</p>
                    <p className="mt-1 leading-5">{importPrimaryRiskDetail}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={
                    !importReadyHoldingCount &&
                    !importReadyTransactionCount
                  }
                >
                  <Upload className="h-4 w-4" />
                  {importButtonLabel}
                </Button>
                {reconciliationRows.length > 0 ? (
                  <p className="max-w-64 text-right text-[11px] leading-5 text-muted-foreground">
                    {reconciliationHeldBackCount > 0
                      ? `${reconciliationHeldBackCount} duplicate mismatch${reconciliationHeldBackCount === 1 ? "" : "es"} will stay out of this import unless you switch them back on.`
                      : "All reviewed duplicate mismatches are currently included in this import."}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="wealth-chart-frame">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Start here
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Load one source and let the review lane tell you what it actually understood.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Check before import
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Provider fit, warnings, duplicates, and whether the rows improve coverage or just create clutter.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Import only the rows that make the tracker cleaner and more complete.
                  </p>
                </div>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${importVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Import verdict</p>
                  <Badge variant={importVerdictBadgeVariant}>{importVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{importCommitLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{importCommitDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Risk to clear
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{importPrimaryRisk}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{importPrimaryRiskDetail}</p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
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
                  <div className="wealth-muted-block p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      1. Load the source
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Upload a statement or paste export text so the parser can read the real shape of the data.
                    </p>
                  </div>
                  <div className="wealth-muted-block p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      2. Inspect the review
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Check provider fit, cleanup, parsed rows, and warnings before trusting the preview.
                    </p>
                  </div>
                  <div className="wealth-muted-block p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      3. Import selectively
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Select only the holdings and transactions that improve coverage without muddying the portfolio.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {importDecisionMetrics.map((metric) => (
                    <MetricMini
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                      caption={metric.caption}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                <div className="wealth-muted-block p-4">
                  <p className="text-sm font-medium">Review move</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {uploadedImportStatus === "ready"
                      ? "Run the import review now, then decide whether the parsed output is clean enough to stage or import."
                      : hasUploadedImport
                        ? "Use the extracted upload text as the primary source, review the parser output, and only keep the rows that add real coverage."
                        : "Paste a real statement or upload a file first, then let the review layer tell you what the parser actually understood."}
                  </p>
                </div>
                <div className="wealth-muted-block p-4">
                  <p className="text-sm font-medium">Current parsed read</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importPreview.assets.length > 0 || transactionImportPreview.transactions.length > 0
                      ? `${importPreview.assets.length} holding${importPreview.assets.length === 1 ? "" : "s"} and ${transactionImportPreview.transactions.length} transaction row${transactionImportPreview.transactions.length === 1 ? "" : "s"} are currently in preview.`
                      : "Parsed rows are not ready yet. The review starts becoming useful once real statement text or a file has been loaded."}
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
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Active source
                </p>
                <p className="mt-2 text-sm text-foreground">{importSourceLabel}</p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Current state
                </p>
                <p className="mt-2 text-sm text-foreground">{importSourceHint}</p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Next step
                </p>
                <p className="mt-2 text-sm text-foreground">{importNextStepHint}</p>
              </div>
            </div>
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
                disabled={!manualImportReady && !hasUploadedImport}
              >
                <ScanSearch className="h-4 w-4" />
                {isReviewingImport && !uploadedFileLabel
                  ? "Analyzing..."
                  : "Analyze import text"}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-stat-tile p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Upload status
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {uploadedImportStatus === "ready"
                    ? "Source extracted and ready for review."
                    : uploadedImportStatus === "processing"
                      ? "Source is still being extracted."
                      : uploadedImportStatus === "selected"
                        ? "File selected and waiting for upload."
                        : hasUploadedImport
                          ? "Upload text is loaded into the review lane."
                          : "No upload is loaded right now."}
                </p>
              </div>
              <div className="wealth-stat-tile p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Parsed so far
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {importPreview.assets.length} holdings and {transactionImportPreview.transactions.length} transaction rows are currently visible to the parser.
                </p>
              </div>
              <div className="wealth-stat-tile p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Decision rule
                </p>
                <p className="mt-2 text-sm text-foreground">
                  If the review still feels fuzzy, ask the mentor before merging anything into holdings or the journal.
                </p>
              </div>
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
            {reconciliationRows.length > 0 ? (
              <ImportReconciliationCard
                onKeepTrackedRow={handleDeselectSingleImportRow}
                onUseImportedRow={handleSelectSingleImportRow}
                rows={reconciliationRows}
                selectedKeys={selectedImportKeys}
              />
            ) : null}
            <ImportPreview
              onClearSelection={handleClearImportRows}
              onSelectAll={handleSelectAllImportRows}
              onToggleRow={handleToggleImportRow}
              preview={importPreview}
              selectedKeys={selectedImportKeys}
            />
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1fr_0.95fr]">
              <div className="grid gap-2">
                <p className="text-sm font-medium text-foreground">Before you import</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  This last step should feel boring in a good way: you know what gets added, what stays out, and whether the pass changes holdings, the journal, or both.
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="wealth-muted-block p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Holdings to add</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{importReadyHoldingCount}</p>
                  </div>
                  <div className="wealth-muted-block p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Journal rows to add</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{importReadyTransactionCount}</p>
                  </div>
                  <div className="wealth-muted-block p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Held back</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{reconciliationHeldBackCount}</p>
                  </div>
                </div>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-sm font-medium text-foreground">Commit read</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{importCommitLabel}</p>
                  <Badge variant={importVerdictBadgeVariant}>{importVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {importReadyHoldingCount > 0 || importReadyTransactionCount > 0
                    ? importCommitDetail
                    : "The import button is best treated like a final commit action. It should stay quiet until the rows you selected clearly improve the tracker."}
                </p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {importPrimaryRisk}. {importPrimaryRiskDetail}
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-muted-foreground">{csvMessage}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onResetAssets}>
                Reset demo data
              </Button>
            </div>
          </div>

          <div className="wealth-muted-block grid gap-3 p-3">
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
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coverage
                </p>
                <p className="mt-2 text-sm leading-6">
                  {safeAssets.length} holding{safeAssets.length === 1 ? "" : "s"} tracked
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transactions
                </p>
                <p className="mt-2 text-sm leading-6">
                  {transactions.length} journal entr{transactions.length === 1 ? "y" : "ies"}
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Learning edge
                </p>
                <p className="mt-2 text-sm leading-6">{learningTrack.items[0]}</p>
              </div>
            </div>
          </div>

          <div className="wealth-muted-block grid gap-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Recent import history</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reopen a past review, replay a clean import into the tracker, or reprocess the saved source when parser coverage improves.
                </p>
              </div>
              <Badge variant="outline">
                {recentImportJobs.length} recent item{recentImportJobs.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">History read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{historyActionSummary}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{historyActionDetail}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="wealth-inset p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reopen ready</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{historyReopenReadyCount}</p>
                </div>
                <div className="wealth-inset p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Replay ready</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{historyReplayReadyCount}</p>
                </div>
                <div className="wealth-inset p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reprocess ready</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{historyReprocessReadyCount}</p>
                </div>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${historyVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">History verdict</p>
                  <Badge variant={historyVerdictBadgeVariant}>{historyVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{historyActionDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {historyReplayReadyCount > 0
                    ? "Replay only when the delta is still intentional"
                    : historyReprocessReadyCount > 0
                      ? "Prefer reprocess over habit replay"
                      : "Use history mainly as reference context"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {historyReplayReadyCount > 0
                    ? "At least one saved import can still improve the tracker, but it should be a deliberate apply pass, not a reflex."
                    : historyReprocessReadyCount > 0
                      ? "The smarter move is usually to rerun parser understanding on the saved source instead of reapplying old rows unchanged."
                      : "Most saved imports now read more like audit memory than live actions."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reopen
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Bring an old review back into the import lane when you want to inspect the saved payload again.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Replay
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Apply the saved rows again only when the current tracker still has a meaningful gap.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reprocess
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Use this when parser coverage has improved and you want a cleaner second pass on the same source.
                </p>
              </div>
            </div>
            {recentImportJobs.length ? (
              <div className="grid gap-3">
                {recentImportJobs.map((job) => {
                  const flowMeta = getImportJobFlowMeta(job);
                  const outcomeStats = getImportJobOutcomeStats(job);
                  const historyActions = getImportJobHistoryActions(job);
                  const actionRead =
                    !historyActions.applyAction.disabled
                      ? "Replay candidate"
                      : !historyActions.reprocessAction.disabled
                        ? "Reprocess candidate"
                        : job.rawText.trim() || job.normalizedText.trim()
                          ? "Reference review"
                          : "Archive only";
                  const actionReadDetail =
                    !historyActions.applyAction.disabled
                      ? "This saved payload still has useful delta and can be replayed into the tracker again."
                      : !historyActions.reprocessAction.disabled
                        ? "The saved source is better used for a fresh parser pass than a direct replay."
                        : job.rawText.trim() || job.normalizedText.trim()
                          ? "The rows are mostly useful for inspection and audit context rather than another apply pass."
                          : "There is not enough saved source text left here to reopen or replay meaningfully.";
                  const historyVerdictToneClassForJob =
                    !historyActions.applyAction.disabled
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : !historyActions.reprocessAction.disabled
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border bg-muted/30";
                  const historyVerdictBadgeVariantForJob =
                    !historyActions.applyAction.disabled ? "secondary" : "outline";
                  const actionReadSummary =
                    !historyActions.applyAction.disabled
                      ? "Replayable delta still exists"
                      : !historyActions.reprocessAction.disabled
                        ? "Saved source is better than saved outcome"
                        : job.rawText.trim() || job.normalizedText.trim()
                          ? "Use this as reference and reopen context"
                          : "Archive context only";

                  return (
                    <div
                      key={job.id}
                      className="wealth-data-card grid gap-3 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{job.providerName}</p>
                            <Badge variant={flowMeta.badgeVariant}>{flowMeta.label}</Badge>
                            <Badge variant="outline">{outcomeStats.holdingsLabel}</Badge>
                            <Badge variant="outline">{outcomeStats.transactionsLabel}</Badge>
                          </div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {outcomeStats.fileLabel}
                          </p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {flowMeta.detail}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{new Date(job.createdAt).toLocaleDateString("en-IN")}</p>
                          <p>{outcomeStats.duplicatesLabel}</p>
                          <p>{outcomeStats.ocrLabel}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <MetricMini
                          label="History status"
                          value={flowMeta.label}
                          caption={job.summary}
                        />
                        <MetricMini
                          label="Saved rows"
                          value={`${job.assetCount + job.transactionCount}`}
                          caption={`${job.assetCount} holdings and ${job.transactionCount} transactions were captured in this review.`}
                        />
                        <MetricMini
                          label="Attempts"
                          value={String(job.attemptCount)}
                          caption={
                            job.lastActionAt
                              ? `Last touched on ${new Date(job.lastActionAt).toLocaleDateString("en-IN")}.`
                              : "No follow-up actions recorded after the first save."
                          }
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                        <div className="wealth-muted-block p-3">
                          <p className="text-xs text-muted-foreground">Best use now</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{actionRead}</p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{actionReadDetail}</p>
                        </div>
                        <div className="wealth-muted-block p-3">
                          <p className="text-xs text-muted-foreground">Before you click</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {!historyActions.applyAction.disabled
                              ? historyActions.applyAction.label
                              : historyActions.reprocessAction.label}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {!historyActions.applyAction.disabled
                              ? "Use replay when you want the saved rows to affect the tracker again."
                              : !historyActions.reprocessAction.disabled
                                ? "Use reprocess when you trust the source file but want a better parsing pass."
                                : "Use reopen when you mainly want to inspect the saved review details again."}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`grid gap-2 rounded-md border p-3 text-xs ${historyVerdictToneClassForJob}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-foreground">Action verdict</p>
                          <Badge variant={historyVerdictBadgeVariantForJob}>{actionRead}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{actionReadSummary}</p>
                        <p className="leading-5 text-muted-foreground">{actionReadDetail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenImportHistoryJob(job)}
                          disabled={!job.rawText.trim() && !job.normalizedText.trim()}
                        >
                          <FileText className="h-4 w-4" />
                          Reopen review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleReplayImportHistoryJob(job)}
                          disabled={historyActions.applyAction.disabled}
                        >
                          <Upload className="h-4 w-4" />
                          {historyActions.applyAction.label}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onReprocessImportJob(job.id)}
                          disabled={historyActions.reprocessAction.disabled}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {historyActions.reprocessAction.label}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="wealth-empty-state">
                Import history will begin appearing here once you review or complete your first statement import.
              </div>
            )}
          </div>

          <div className="wealth-muted-block grid gap-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Before and after import impact</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compare the latest import payload with the tracker you have now, and see what a replay would still change.
                </p>
              </div>
              {latestImportFlowMeta ? (
                <Badge variant={latestImportFlowMeta.badgeVariant}>{latestImportFlowMeta.label}</Badge>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Replay read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{replayImpactLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{replayImpactDetail}</p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Remaining gap</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{replayGapLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{replayGapDetail}</p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${replayVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Replay verdict</p>
                  <Badge variant={replayVerdictBadgeVariant}>{replayVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{replayVerdictDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best move now
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {!latestImportJob || !latestImportPreview
                    ? "Save one reviewed import first"
                    : latestImportReplayResult &&
                        (latestImportReplayResult.appliedAssetCount > 0 ||
                          latestImportReplayResult.appliedTransactionCount > 0)
                      ? "Replay only if you still want that exact delta"
                      : latestImportPreview.newAssets.length > 0
                        ? "Inspect the gap before replaying habitually"
                        : "Prefer reopen or reprocess over replay"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {!latestImportJob || !latestImportPreview
                    ? "Once there is one saved review, this section starts telling you whether replay is still useful."
                    : latestImportReplayResult &&
                        (latestImportReplayResult.appliedAssetCount > 0 ||
                          latestImportReplayResult.appliedTransactionCount > 0)
                      ? "This saved payload still has live effect, so replay is justified only when you explicitly want those remaining changes."
                      : latestImportPreview.newAssets.length > 0
                        ? "Some mismatch still exists, but the cleaner next move may be reopen or reprocess before applying old rows again."
                        : "The saved import has become more like audit memory than an operational update."}
                </p>
              </div>
            </div>
            <div className="wealth-inset p-3">
              <p className="text-sm font-medium text-foreground">How to read this</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This is your “would this import still change anything?” check. Use it to avoid replaying old files that no longer improve the tracker in a meaningful way.
              </p>
            </div>
            {latestImportJob && latestImportPreview ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricMini
                    label="Current tracker"
                    value={`${safeAssets.length} holdings`}
                    caption={`${formatMoney(portfolioTotal)} currently tracked across the live portfolio.`}
                  />
                  <MetricMini
                    label="Latest import payload"
                    value={`${latestImportPreview.assets.length} holdings`}
                    caption={`${formatMoney(latestImportPreview.importedValue)} current value came through this import.`}
                  />
                  <MetricMini
                    label="Matched already"
                    value={`${latestImportPreview.duplicates.length} rows`}
                    caption="These imported holdings already map to names in the current tracker."
                  />
                  <MetricMini
                    label="Still new"
                    value={`${latestImportPreview.newAssets.length} rows`}
                    caption="These holdings are not currently matched inside the live tracker."
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="wealth-inset p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Before
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {safeAssets.length === 0
                        ? "Tracker was effectively empty"
                        : `${safeAssets.length} holdings and ${transactions.length} journal entries were already in place.`}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      This is the baseline state the latest import had to merge into.
                    </p>
                  </div>
                  <div className="wealth-inset p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Payload
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {latestImportStats?.holdingsLabel ?? "No holdings"} and{" "}
                      {latestImportStats?.transactionsLabel ?? "no transactions"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {latestImportJob.providerName} arrived with {latestImportJob.duplicateCount} duplicate holding
                      {latestImportJob.duplicateCount === 1 ? "" : "s"} and {latestImportJob.rowWarnings.length} row warning
                      {latestImportJob.rowWarnings.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                  <div className="wealth-inset p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Replay now
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {latestImportReplayResult
                        ? `${latestImportReplayResult.appliedAssetCount} holding change${latestImportReplayResult.appliedAssetCount === 1 ? "" : "s"} and ${latestImportReplayResult.appliedTransactionCount} transaction${latestImportReplayResult.appliedTransactionCount === 1 ? "" : "s"}`
                        : "No reusable delta left"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {latestImportReplayResult
                        ? "This is what the latest saved import would still change if replayed into the tracker right now."
                        : "The tracker already reflects this import closely enough that a replay would not add useful rows."}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                  <div className="wealth-inset p-3">
                    <p className="text-xs text-muted-foreground">Best move now</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {latestImportReplayResult &&
                      (latestImportReplayResult.appliedAssetCount > 0 ||
                        latestImportReplayResult.appliedTransactionCount > 0)
                        ? "Replay only if you still want that delta"
                        : "Prefer reopen or reprocess over replay"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {latestImportReplayResult &&
                      (latestImportReplayResult.appliedAssetCount > 0 ||
                        latestImportReplayResult.appliedTransactionCount > 0)
                        ? "The saved payload can still change the tracker, but only replay it when those remaining changes are intentionally wanted."
                        : "If you mainly need to inspect or improve parser quality, reopening or reprocessing is cleaner than replaying the same rows again."}
                    </p>
                  </div>
                  <div className="wealth-inset p-3">
                    <p className="text-xs text-muted-foreground">Decision rule</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Replay delta, not habit</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      A replay is most useful when it still closes a real portfolio or journal gap. If the tracker already mirrors the old import, treat the saved file as reference history instead.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="wealth-empty-state">
                Once an import is reviewed and saved, this section will compare that payload against the current tracker state.
              </div>
            )}
          </div>

          <div className="wealth-muted-block grid gap-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Holdings review board</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scan position size, source quality, and unrealized P&L before you edit individual rows.
                </p>
              </div>
              <Badge variant="outline">
                {safeAssets.length} holding{safeAssets.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Board read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{holdingsBoardReadLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{holdingsBoardReadDetail}</p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">What to optimize for</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Trust before tidiness</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Improve source quality, invested value, units, and concentration visibility first. Cosmetic renames can come after the important numbers feel reliable.
                </p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${holdingsBoardVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Board verdict</p>
                  <Badge variant={holdingsBoardVerdictBadgeVariant}>{holdingsBoardVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{holdingsBoardReadDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {filteredHoldings.length === 0
                    ? "Reset or widen the current view"
                    : manualHoldingsCount > 0
                      ? "Clear manual data uncertainty first"
                      : topAllocationBucket
                        ? `Inspect ${topAllocationBucket.name} before smaller edits`
                        : "Review by value, source, then detail quality"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {filteredHoldings.length === 0
                    ? "Most empty states here come from a narrow filter, so recover the working set before deciding what to edit."
                    : manualHoldingsCount > 0
                      ? "When manually entered rows are visible, they usually deserve attention before cosmetic cleanup or low-value edits."
                      : topAllocationBucket
                        ? "The biggest visible bucket is usually where concentration, sizing, or stale detail will matter most."
                        : "The visible set looks stable enough that you can review it with a predictable routine instead of reacting to noise."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Scan first
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Start with the biggest positions and manual rows before worrying about small tidy-ups.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Edit carefully
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Invested value, units, and source quality usually matter more than making the list look cosmetically neat.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Narrow the board to one source, bucket, or fund family before making multiple edits.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricMini
                label="Largest position"
                value={topAllocationBucket?.name ?? "Holdings pending"}
                caption={
                  topAllocationBucket
                    ? `${formatMoney(topAllocationBucket.value)} is currently concentrated here.`
                    : "Add holdings to see the biggest position."
                }
              />
              <MetricMini
                label="Visible value"
                value={formatMoney(visibleHoldingsValue)}
                caption="This is the value represented by the currently visible holdings after search and sort."
              />
              <MetricMini
                label="Manual detail load"
                value={`${manualHoldingsCount} row${manualHoldingsCount === 1 ? "" : "s"}`}
                caption={
                  manualHoldingsCount > 0
                    ? "Manual rows usually deserve a quick units, price, and invested-value check."
                    : "Most visible rows came from imports or synced sources."
                }
              />
            </div>
            <div className="wealth-inset grid gap-3 p-3 md:grid-cols-[1.4fr_0.9fr_0.9fr]">
              <TextField
                inputTestId="holdings-search"
                label="Search holdings"
                value={holdingsSearch}
                onChange={setHoldingsSearch}
              />
              <SelectField
                selectTestId="holdings-sort"
                label="Sort view"
                options={holdingsSortOptions}
                value={holdingsSort}
                onChange={setHoldingsSort}
              />
              <div className="wealth-muted-block p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  View summary
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {filteredHoldings.length} of {safeAssets.length} holdings visible
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Narrow the review board to one fund family, source, or risk bucket before editing.
                </p>
              </div>
            </div>
            {(holdingsSearch.trim() || holdingsSort !== "value-desc") && (
              <div className="wealth-stat-tile flex flex-wrap items-center justify-between gap-2 p-3">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">{filteredHoldings.length}</span>{" "}
                  holding{filteredHoldings.length === 1 ? "" : "s"}
                  {holdingsSearch.trim() ? (
                    <>
                      {" "}matching <span className="font-medium text-foreground">{holdingsSearch.trim()}</span>
                    </>
                  ) : null}
                  .
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHoldingsSearch("");
                    setHoldingsSort("value-desc");
                  }}
                >
                  Reset view
                </Button>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              {portfolioOperatingLenses.map((lens) => (
                <div
                  key={lens.label}
                  className="wealth-inset p-3"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {lens.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{lens.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{lens.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {filteredHoldings.length === 0 ? (
            <div className="wealth-empty-state grid gap-4 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Nothing matches this filter yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Try a fund name, asset type, or source label, or clear the search to bring the full holdings board back into view.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Best first check</p>
                  <p className="mt-1 text-sm font-medium">Reset the view</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Most empty states here come from a narrow query rather than missing holdings data.
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Then narrow again</p>
                  <p className="mt-1 text-sm font-medium">Filter by one idea</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use one fund family, one source, or one risk bucket at a time to make edits easier.
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Recovery path</p>
                  <p className="mt-1 text-sm font-medium">Reopen the import lane if needed</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    If the holding really should exist, review the latest import before editing manually.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {filteredHoldings.map((asset) => {
            const index = safeAssets.findIndex((candidate, candidateIndex) => {
              if (candidateIndex < 0) return false;

              return candidate === asset;
            });
            const holdingReview = getHoldingReviewAssessment({
              asset,
              portfolioTotal,
            });
            const holdingActionVerdictLabel =
              holdingReview.nextStepLabel.toLowerCase().includes("verify") ||
              holdingReview.nextStepLabel.toLowerCase().includes("check")
                ? "Verification pass"
                : holdingReview.nextStepLabel.toLowerCase().includes("trim") ||
                    holdingReview.nextStepLabel.toLowerCase().includes("rebalance")
                  ? "Position sizing review"
                  : "Routine review";
            const holdingActionVerdictToneClass =
              holdingReview.badgeClassName.includes("rose")
                ? "border-rose-500/30 bg-rose-500/5"
                : holdingReview.badgeClassName.includes("amber")
                  ? "border-amber-500/30 bg-amber-500/5"
                  : holdingReview.badgeClassName.includes("sky")
                    ? "border-sky-500/30 bg-sky-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5";
            const holdingActionBadgeVariant =
              holdingReview.badgeClassName.includes("emerald") ? "secondary" : "outline";

            return (
            <div
              key={`${asset.name}-${asset.type}-${index}`}
              className="wealth-data-card grid gap-3 p-3"
            >
              {editingIndex === index && editingAsset ? (
                <HoldingFields asset={editingAsset} onChange={setEditingAsset} />
              ) : (
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{asset.name}</p>
                        <Badge variant="outline">{asset.type}</Badge>
                        <Badge variant="secondary">{asset.source}</Badge>
                        <Badge variant="outline" className={holdingReview.badgeClassName}>
                          {holdingReview.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {asset.quantity.toFixed(2)} units tracked at {formatMoney(asset.price)} each.
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
                  <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="text-muted-foreground">Why this row matters</p>
                      <p className="mt-1 font-medium text-foreground">{holdingReview.label}</p>
                      <p className="mt-2 leading-5 text-muted-foreground">{holdingReview.detail}</p>
                    </div>
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="text-muted-foreground">Next row move</p>
                      <p className="mt-1 font-medium text-foreground">{holdingReview.nextStepLabel}</p>
                      <p className="mt-2 leading-5 text-muted-foreground">{holdingReview.nextStepDetail}</p>
                    </div>
                  </div>
                  <div className={`grid gap-2 rounded-md border p-3 text-xs ${holdingActionVerdictToneClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">Row action verdict</p>
                      <Badge variant={holdingActionBadgeVariant}>{holdingActionVerdictLabel}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{holdingReview.nextStepLabel}</p>
                    <p className="leading-5 text-muted-foreground">{holdingReview.nextStepDetail}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="uppercase tracking-wide text-muted-foreground">Invested</p>
                      <p className="mt-1 font-medium text-foreground">{formatMoney(asset.investedValue)}</p>
                    </div>
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="uppercase tracking-wide text-muted-foreground">Units</p>
                      <p className="mt-1 font-medium text-foreground">{asset.quantity.toFixed(2)}</p>
                    </div>
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="uppercase tracking-wide text-muted-foreground">Current price</p>
                      <p className="mt-1 font-medium text-foreground">{formatMoney(asset.price)}</p>
                    </div>
                    <div className="wealth-muted-block p-3 text-xs">
                      <p className="uppercase tracking-wide text-muted-foreground">Unrealized P&L</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatMoney(asset.value - asset.investedValue)}
                      </p>
                    </div>
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
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card id="portfolio-allocation" ref={allocationRef} className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>Read: allocation snapshot</CardTitle>
            <CardDescription>
              Compare your tracked mix with your suggested profile once enough holdings are captured.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-chart-frame">
                <p className="text-xs text-muted-foreground">Allocation read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{allocationSectionReadLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{allocationSectionReadDetail}</p>
              </div>
              <div className="wealth-chart-frame">
                <p className="text-xs text-muted-foreground">How to use this well</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Read buckets, then inspect holdings</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The chart is best for spotting concentration or missing exposure. The actual decision gets clearer only after you look at the holdings driving that bucket.
                </p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${allocationVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Allocation verdict</p>
                  <Badge variant={allocationVerdictBadgeVariant}>{allocationVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{allocationSectionReadDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {chartData.length === 0
                    ? "Capture more holdings before trusting the mix"
                    : allocationLeadInsight
                      ? `Inspect ${allocationLeadInsight.bucket} before smaller tweaks`
                      : topAllocationBucket
                        ? `Scan ${topAllocationBucket.name} for concentration drivers`
                        : "Read the largest buckets before adjusting names"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {chartData.length === 0
                    ? "A thin holding set can make the chart feel decisive before it is actually representative."
                    : allocationLeadInsight
                      ? "The clearest suggested-vs-current mismatch should lead this review pass, because it is the strongest signal on the page right now."
                      : topAllocationBucket
                        ? "Even without a strong profile mismatch, the largest visible bucket is still the fastest place to test for concentration risk."
                        : "The mix is readable enough to scan methodically rather than reacting to one number in isolation."}
                </p>
              </div>
            </div>
            <div className="wealth-chart-frame">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What this section does
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Shows where the actual portfolio value is sitting right now.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What it does not do
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    It does not tell you to trade every overweight or underweight bucket immediately.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best use
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Use it to spot concentration and then inspect the holdings underneath the bucket.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What changed
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{allocationChangeSummary}</p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What matters
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {topAllocationBucket
                    ? `${topAllocationBucket.name} is still the biggest visible bucket at ${formatMoney(topAllocationBucket.value)}.`
                    : "No dominant bucket can be judged yet because holdings coverage is still thin."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What to do
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{allocationActionSummary}</p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-[1fr_0.9fr]">
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
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next allocation check
                </p>
                <p className="mt-2 text-sm leading-6">
                  {allocationInsights[0]?.status ??
                    "Capture more holdings, then compare the real mix against the suggested buckets below."}
                </p>
              </div>
            </div>
            <div className="wealth-chart-frame h-72">
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
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  fill="var(--color-chart-3)"
                  onClick={(data) => {
                    if (typeof data?.name === "string") {
                      setActiveAllocationBucket(data.name);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
            {chartData.length > 0 ? (
              <div className="wealth-muted-block grid gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Bucket detail</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Click a bar to focus the holdings driving that slice of the portfolio.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chartData.map((bucket) => (
                      <button
                        key={bucket.name}
                        type="button"
                        onClick={() => setActiveAllocationBucket(bucket.name)}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          bucket.name === activeAllocationBucketName
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {bucket.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                  <div className="wealth-data-card p-3">
                    <p className="text-xs text-muted-foreground">Focused bucket read</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{focusedBucketReadLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{focusedBucketReadDetail}</p>
                  </div>
                  <div className="wealth-data-card p-3">
                    <p className="text-xs text-muted-foreground">Next bucket move</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {activeAllocationBucketName ? "Inspect the top holding inside this bucket" : "Choose one bucket to inspect"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {activeAllocationBucketName
                        ? "Start with the largest holding in this bucket to decide whether the drift is caused by one position or by a broader pattern."
                        : "Once a bucket is selected, compare its top holdings before deciding whether the mix really needs action."}
                    </p>
                  </div>
                </div>
                <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${focusedBucketVerdictToneClass}`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Focused bucket verdict</p>
                      <Badge variant={focusedBucketVerdictBadgeVariant}>{focusedBucketVerdictLabel}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{focusedBucketReadDetail}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/70 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Inspection move
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {!activeAllocationBucketName
                        ? "Choose one bucket first"
                        : activeAllocationAssets.length === 1
                          ? "Review the single name driving this bucket"
                          : "Start with the largest holding, then compare the rest"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {!activeAllocationBucketName
                        ? "The chart becomes much more useful once you translate one bucket into the holdings sitting inside it."
                        : activeAllocationAssets.length === 1
                          ? "A bucket led by one holding is usually easier to reason about, but it can also hide concentration risk if left unquestioned."
                          : "Use the top holding as the anchor, then decide whether the rest of the bucket confirms or softens the concentration read."}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <MetricMini
                    label="Focused bucket"
                    value={activeAllocationBucketName || "None"}
                    caption={
                      activeAllocationBucketName
                        ? `${activeAllocationAssets.length} holding${activeAllocationAssets.length === 1 ? "" : "s"} are driving this bucket.`
                        : "Choose a bucket to inspect the underlying holdings."
                    }
                  />
                  <MetricMini
                    label="Bucket share"
                    value={`${activeAllocationBucketShare.toFixed(1)}%`}
                    caption={`${formatMoney(activeAllocationBucketValue)} of current tracked value sits here.`}
                  />
                  <MetricMini
                    label="Bucket invested"
                    value={formatMoney(activeAllocationBucketInvested)}
                    caption="Useful for checking whether this slice grew by gains or by fresh contributions."
                  />
                </div>
                <div className="grid gap-2">
                  {activeAllocationAssets.map((asset, index) => {
                    const portfolioShare =
                      portfolioTotal > 0 ? (asset.value / portfolioTotal) * 100 : 0;
                    const bucketShare =
                      activeAllocationBucketValue > 0
                        ? (asset.value / activeAllocationBucketValue) * 100
                        : 0;
                    const bucketRowRead =
                      bucketShare >= 50
                        ? "This single holding is dominating the selected bucket."
                        : bucketShare >= 25
                          ? "This holding is a major driver of the selected bucket."
                          : "This holding is part of the bucket mix, but it is not dominating it alone.";

                    return (
                      <div
                        key={`${asset.name}-${asset.type}-${index}`}
                        className="wealth-data-card grid gap-3 p-3 text-xs md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{asset.name}</p>
                            <Badge variant="secondary">{asset.source}</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {asset.quantity.toFixed(2)} units at {formatMoney(asset.price)}
                          </p>
                          <p className="wealth-muted-block mt-2 p-2 text-[11px] leading-5 text-muted-foreground">
                            <span className="font-medium text-foreground">Bucket read</span>{" "}
                            {bucketRowRead}
                          </p>
                        </div>
                        <div className="grid gap-1 text-muted-foreground">
                          <span>Current {formatMoney(asset.value)}</span>
                          <span>Invested {formatMoney(asset.investedValue)}</span>
                        </div>
                        <div className="grid gap-1 text-muted-foreground">
                          <span>Share {portfolioShare.toFixed(1)}%</span>
                          <span>Bucket share {bucketShare.toFixed(1)}%</span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">
                            {asset.gain >= 0 ? "+" : ""}
                            {asset.gain.toFixed(1)}%
                          </p>
                          <p className="text-muted-foreground">
                            {formatMoney(asset.value - asset.investedValue)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <MetricMini
                label="Top bucket"
                value={topAllocationBucket?.name ?? "Mix pending"}
                caption={
                  topAllocationBucket
                    ? `${formatMoney(topAllocationBucket.value)} is currently sitting here.`
                    : "Add holdings to see where the portfolio is leaning."
                }
              />
              <MetricMini
                label="Lead posture"
                value={allocationLeadInsight?.status ?? "Waiting"}
                caption={
                  allocationLeadInsight
                    ? `${allocationLeadInsight.bucket} is at ${allocationLeadInsight.currentShare}% vs ${allocationLeadInsight.suggestedShare}% suggested.`
                    : "Suggested buckets appear once holdings have real shape."
                }
              />
              <MetricMini
                label="Mix clarity"
                value={chartData.length > 0 ? `${chartData.length} buckets` : "No buckets"}
                caption={
                  chartData.length > 2
                    ? "Good enough to start spotting concentration and missing exposure."
                  : "Capture more holdings before reading too much into the chart."
                }
              />
            </div>
            <div className="wealth-muted-block p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Latest import impact</p>
                {latestImportFlowMeta ? (
                  <Badge variant={latestImportFlowMeta.badgeVariant}>
                    {latestImportFlowMeta.label}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestImportJob
                  ? `${latestImportJob.providerName} most recently brought in ${latestImportJob.assetCount} holding${latestImportJob.assetCount === 1 ? "" : "s"} and ${latestImportJob.transactionCount} transaction${latestImportJob.transactionCount === 1 ? "" : "s"}. Use that change set as the context for the chart you are reading now.`
                  : "Once imports begin landing, this section will connect the chart back to the latest statement or file that changed the portfolio mix."}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card
          id="portfolio-health"
          ref={healthRef}
          className="wealth-panel-strong overflow-hidden"
        >
          <CardHeader>
            <CardTitle>Checks: portfolio health</CardTitle>
            <CardDescription>
              Review concentration, detail quality, core allocation, and diversification before making changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-muted-block p-4">
                <p className="text-xs text-muted-foreground">Health read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{healthSectionReadLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{healthSectionReadDetail}</p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs text-muted-foreground">Best use of this section</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Fix the first issue that improves trust</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The highest-value move here is usually not “fix every warning.” It is fixing the first weak check that makes allocation, gains, and planning reads more trustworthy everywhere else.
                </p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${healthVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Health verdict</p>
                  <Badge variant={healthVerdictBadgeVariant}>{healthVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{healthVerdictDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {portfolioChecks.length === 0
                    ? "Add more detail before trusting the health layer"
                    : healthAttentionChecks.length === 0
                      ? "Maintain the clean checks and review drift elsewhere"
                      : latestImportJob?.providerConfidence === "low"
                        ? "Verify source quality before taking bigger action"
                        : `Clear ${healthAttentionChecks[0]?.label.toLowerCase() ?? "the first weak check"}`}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {portfolioChecks.length === 0
                    ? "Without enough captured detail, the section is mostly telling you how to make itself more useful."
                    : healthAttentionChecks.length === 0
                      ? "No urgent health warning is dominating right now, so use this section more as a trust check than a call to action."
                      : latestImportJob?.providerConfidence === "low"
                        ? "Weak parser confidence can make a good check look stronger than the underlying data really is, so confirm the input before changing the portfolio around it."
                        : "The highest-value move is usually fixing the first weak check that would improve allocation, gains, and planning reads everywhere else."}
                </p>
              </div>
            </div>
            <div className="wealth-muted-block p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Use this for
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Checking whether the portfolio is complete and balanced enough to trust your next decisions.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Read carefully
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Weak source quality or thin coverage can make the checks directionally useful but not final.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Fix the first weak check that would improve the rest of the page the most.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What changed
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {healthAttentionChecks.length > 0
                    ? `${healthAttentionChecks.length} check${healthAttentionChecks.length === 1 ? "" : "s"} currently need attention.`
                    : "No major portfolio health warning is standing out from the current captured data."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What matters
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{healthConfidenceSummary}</p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What to do
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{healthActionSummary}</p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium">How to read these checks</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These aren’t predictions. They are operating checks that tell you whether the portfolio is detailed enough, diversified enough, and aligned enough to support better decisions.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coaching read
                </p>
                <p className="mt-2 text-sm leading-6">
                  {portfolioChecks[0]?.status ??
                    "Once more holdings are captured, these checks will start turning into clearer portfolio guidance."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricMini
                label="Lead check"
                value={healthLeadCheck?.label ?? "Checks pending"}
                caption={
                  healthLeadCheck?.status ??
                  "Checks become meaningful once the portfolio has more detail."
                }
              />
              <MetricMini
                label="Detail coverage"
                value={detailCoverageCheck?.value ?? "0%"}
                caption={
                  detailCoverageCheck?.status ??
                  "Add invested value and units to strengthen cost-basis detail."
                }
              />
              <MetricMini
                label="Diversification read"
                value={diversificationCheck?.value ?? `${diversificationScore}/100`}
                caption={
                  diversificationCheck?.status ??
                  "Variety improves as you capture more of the real mix."
                }
              />
            </div>
            <div className="wealth-muted-block p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Latest review quality</p>
                {latestImportStats ? (
                  <Badge variant="outline">{latestImportStats.ocrLabel}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestImportJob
                  ? `${latestImportJob.providerName} is the latest saved review. It came through as ${latestImportJob.providerConfidence} confidence with ${latestImportJob.rowWarnings.length} row warning${latestImportJob.rowWarnings.length === 1 ? "" : "s"}, so read the health checks with that data quality in mind.`
                  : "Health checks become easier to trust once at least one real import has been reviewed and merged into the tracker."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  First question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Is the portfolio detailed enough that these checks deserve action, or are they still mostly asking for better coverage?
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Combine health checks with allocation and journal depth before treating any one warning as the full story.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Next health fix
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Fix the coverage or concentration issue that would make the biggest difference to the rest of the page.
                </p>
              </div>
            </div>
            {portfolioChecks.map((check) => (
              <HealthCheck key={check.label} {...check} />
            ))}
          </CardContent>
        </Card>
        <Card
          id="portfolio-alignment"
          ref={alignmentRef}
          className="wealth-panel-strong overflow-hidden"
        >
          <CardHeader>
            <CardTitle>Compare: profile alignment</CardTitle>
            <CardDescription>Compare your current mix with the suggested profile buckets and spot the loudest drift first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="wealth-muted-block p-4">
                <p className="text-xs text-muted-foreground">Alignment read</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{alignmentSectionReadLabel}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{alignmentSectionReadDetail}</p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs text-muted-foreground">How to use this well</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Fix the loudest drift first</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Alignment works best when you solve the clearest missing or overweight bucket first, then come back for smaller tweaks once the broad shape is healthier.
                </p>
              </div>
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${alignmentVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Alignment verdict</p>
                  <Badge variant={alignmentVerdictBadgeVariant}>{alignmentVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{alignmentSectionReadDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {allocationInsights.length === 0
                    ? "Capture more holdings before trusting the comparison"
                    : alignmentMissingInsights.length > 0
                      ? `Build support in ${alignmentMissingInsights[0].bucket}`
                      : alignmentOverweightInsights.length > 0
                        ? `Inspect ${alignmentOverweightInsights[0].bucket} before smaller tweaks`
                        : "Maintain the current mix and review drift later"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {allocationInsights.length === 0
                    ? "Without enough live holdings, suggested-vs-current posture is still more hint than decision."
                    : alignmentMissingInsights.length > 0
                      ? "The clearest underweight bucket should lead this review, because filling missing core support usually improves the overall shape faster than trimming tiny overweights."
                      : alignmentOverweightInsights.length > 0
                        ? "The loudest overweight bucket deserves a holdings-level scan before you make smaller balancing decisions elsewhere."
                        : "No single bucket is creating a loud mismatch right now, so this section is mostly confirmation rather than intervention."}
                </p>
              </div>
            </div>
            <div className="wealth-muted-block p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What to look for
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Missing core buckets, underweight buckets, and slices that have quietly become too dominant.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Keep in mind
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Alignment is a guidance lens, not a demand to mirror the suggested profile perfectly.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Focus on the loudest missing or overweight bucket before making smaller tweaks elsewhere.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What changed
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{alignmentWhyNowSummary}</p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What matters
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {alignmentMissingInsights.length > 0
                    ? `${alignmentMissingInsights.length} bucket${alignmentMissingInsights.length === 1 ? "" : "s"} are still underweight versus the suggested profile.`
                    : alignmentOverweightInsights.length > 0
                      ? `${alignmentOverweightInsights.length} bucket${alignmentOverweightInsights.length === 1 ? "" : "s"} are running above the suggested posture.`
                      : "The captured mix is not showing a loud profile mismatch right now."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What to do
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{alignmentActionSummary}</p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium">What alignment means here</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Alignment is not about matching every bucket perfectly. It is about noticing where the real portfolio is underweight, overconcentrated, or missing the core shape suggested by your profile.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested posture
                </p>
                <p className="mt-2 text-sm leading-6">
                  {allocationInsights[0]?.status ??
                    "Add holdings or imported transactions to make the alignment check meaningful."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricMini
                label="Lead drift"
                value={allocationLeadInsight?.bucket ?? "No drift yet"}
                caption={
                  allocationLeadInsight
                    ? `${allocationLeadInsight.currentShare}% current against ${allocationLeadInsight.suggestedShare}% suggested.`
                    : "Drift shows up once the current mix has enough captured holdings."
                }
              />
              <MetricMini
                label="Active buckets"
                value={String(allocationInsights.length)}
                caption={
                  allocationInsights.length > 0
                    ? "These are the suggested profile buckets currently in play."
                    : "Live-vs-suggested comparison is not ready yet."
                }
              />
              <MetricMini
                label="Profile band"
                value={profile.band}
                caption="Use this posture as the lens when you judge underweights and concentration."
              />
            </div>
            <div className="wealth-muted-block p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Import-to-alignment bridge</p>
                {latestImportStats ? (
                  <Badge variant="outline">{latestImportStats.holdingsLabel}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestImportJob
                  ? `${latestImportJob.providerName} is the latest source shaping this comparison. If the newest review mainly added one fund family or sector, expect the alignment rows below to show that drift immediately.`
                  : "Once you import a real statement, this section will explain how the newest source changed the suggested-vs-current comparison."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  First question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Which bucket is missing core support, and which one has quietly become too dominant for the current profile?
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Use this together with the holdings board so you can see which actual funds or positions are creating the drift.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move here
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Solve the loudest missing or overweight bucket first before making smaller rebalancing decisions.
                </p>
              </div>
            </div>
            {allocationInsights.length ? (
              <div className="wealth-muted-block grid gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Bucket alignment detail</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Choose a suggested bucket to see the holdings currently helping or hurting that target.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allocationInsights.map((insight) => (
                      <button
                        key={insight.bucket}
                        type="button"
                        onClick={() => setActiveAlignmentBucket(insight.bucket)}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          insight.bucket === (activeAlignmentInsight?.bucket ?? "")
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {insight.bucket}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                  <div className="wealth-inset p-3">
                    <p className="text-xs text-muted-foreground">Focused bucket read</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{alignmentFocusedReadLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{alignmentFocusedReadDetail}</p>
                  </div>
                  <div className="wealth-inset p-3">
                    <p className="text-xs text-muted-foreground">Next drift check</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {activeAlignmentInsight ? "Trace the drift to real holdings" : "Choose one bucket to inspect"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {activeAlignmentInsight
                        ? "Look at the holdings mapped into this bucket to decide whether the drift is caused by one oversized position, missing exposure, or incomplete coverage."
                        : "Once a bucket is selected, compare its holdings before deciding whether the posture really needs correction."}
                    </p>
                  </div>
                </div>
                <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${alignmentFocusedVerdictToneClass}`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Focused bucket verdict</p>
                      <Badge variant={alignmentFocusedVerdictBadgeVariant}>{alignmentFocusedVerdictLabel}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{alignmentFocusedReadDetail}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/70 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Inspection move
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {!activeAlignmentInsight
                        ? "Choose one bucket first"
                        : activeAlignmentAssets.length === 0
                          ? "Treat this as a missing-exposure bucket"
                          : activeAlignmentAssets.length === 1
                            ? "Inspect the single holding shaping this bucket"
                            : "Compare the top holding against the rest of the bucket"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {!activeAlignmentInsight
                        ? "The comparison gets much more useful once one suggested bucket is translated into actual holdings."
                        : activeAlignmentAssets.length === 0
                          ? "No holdings currently map here, so the real decision is whether the profile still wants this exposure and how you would build it."
                          : activeAlignmentAssets.length === 1
                            ? "A single-name bucket is easy to read, but it can also hide concentration or incomplete coverage if left unquestioned."
                            : "Use the largest mapped holding as the anchor, then decide whether the rest of the bucket confirms or softens the drift signal."}
                    </p>
                  </div>
                </div>
                {activeAlignmentInsight ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <MetricMini
                        label="Focused bucket"
                        value={activeAlignmentInsight.bucket}
                        caption={activeAlignmentInsight.status}
                      />
                      <MetricMini
                        label="Current vs suggested"
                        value={`${activeAlignmentInsight.currentShare}% / ${activeAlignmentInsight.suggestedShare}%`}
                        caption="This is the current profile gap for the selected bucket."
                      />
                      <MetricMini
                        label="Captured value"
                        value={formatMoney(activeAlignmentBucketValue)}
                        caption={`${activeAlignmentAssets.length} holding${activeAlignmentAssets.length === 1 ? "" : "s"} currently map into this bucket.`}
                      />
                      <MetricMini
                        label="Captured invested"
                        value={formatMoney(activeAlignmentBucketInvested)}
                        caption="Useful for seeing whether this bucket is small because it is new, underfunded, or just absent."
                      />
                    </div>
                    <div className="grid gap-2">
                      {activeAlignmentAssets.length > 0 ? (
                        activeAlignmentAssets.map((asset, index) => {
                          const portfolioShare =
                            portfolioTotal > 0 ? (asset.value / portfolioTotal) * 100 : 0;
                          const bucketShare =
                            activeAlignmentBucketValue > 0
                              ? (asset.value / activeAlignmentBucketValue) * 100
                              : 0;
                          const alignmentRowRead =
                            activeAlignmentBucketShare < (activeAlignmentInsight?.suggestedShare ?? 0)
                              ? "This holding is part of an underweight bucket, so adding similar exposure may matter more than fine-tuning tiny rows."
                              : bucketShare >= 50
                                ? "This holding is a major reason the bucket is reading heavy."
                                : "This holding contributes to the bucket posture, but it is not driving the drift alone.";

                          return (
                            <div
                              key={`${asset.name}-${asset.type}-${index}`}
                              className="wealth-data-card grid gap-3 p-3 text-xs md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]"
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-foreground">{asset.name}</p>
                                  <Badge variant="secondary">{asset.source}</Badge>
                                </div>
                                <p className="mt-1 text-muted-foreground">
                                  {asset.quantity.toFixed(2)} units at {formatMoney(asset.price)}
                                </p>
                                <p className="wealth-muted-block mt-2 p-2 text-[11px] leading-5 text-muted-foreground">
                                  <span className="font-medium text-foreground">Alignment read</span>{" "}
                                  {alignmentRowRead}
                                </p>
                              </div>
                              <div className="grid gap-1 text-muted-foreground">
                                <span>Current {formatMoney(asset.value)}</span>
                                <span>Invested {formatMoney(asset.investedValue)}</span>
                              </div>
                              <div className="grid gap-1 text-muted-foreground">
                                <span>Portfolio share {portfolioShare.toFixed(1)}%</span>
                                <span>Bucket share {bucketShare.toFixed(1)}%</span>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-foreground">
                                  {asset.gain >= 0 ? "+" : ""}
                                  {asset.gain.toFixed(1)}%
                                </p>
                                <p className="text-muted-foreground">
                                  {formatMoney(asset.value - asset.investedValue)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="wealth-empty-state">
                          No holdings currently map into this bucket, which is exactly why it is showing up as missing or underweight.
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {allocationInsights.length ? (
              allocationInsights.map((insight) => (
                <div
                  key={insight.bucket}
                  className={`grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto] ${
                    insight.bucket === (activeAlignmentInsight?.bucket ?? "")
                      ? "border-primary/50 bg-primary/5"
                      : "bg-background"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{insight.bucket}</p>
                      {insight.bucket === (activeAlignmentInsight?.bucket ?? "") ? (
                        <Badge variant="outline">Focused</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.status}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Current {insight.currentShare}%</p>
                    <p>Suggested {insight.suggestedShare}%</p>
                    <button
                      type="button"
                      onClick={() => setActiveAlignmentBucket(insight.bucket)}
                      className="mt-2 text-[11px] font-medium text-foreground underline underline-offset-4"
                    >
                      View holdings
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="wealth-empty-state">
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
  const parserWarningCount = artifacts?.rowWarnings.length ?? 0;
  const actionableHoldingCount = artifacts?.summary.newCount ?? 0;
  const importReadinessLabel =
    review.qualityScore >= 85 && parserWarningCount === 0
      ? "Ready to import"
      : review.qualityScore >= 70 && parserWarningCount <= 2
        ? "Review before import"
        : "Clean up first";
  const importReadinessDetail =
    importReadinessLabel === "Ready to import"
      ? "The parser fit is strong, warnings are low, and the output looks stable enough for selective import."
      : importReadinessLabel === "Review before import"
        ? "The parser likely understood the source, but you should still verify warnings, duplicates, and a few sample rows."
        : "The current review still needs operator attention before the imported rows should shape the live tracker.";

  return (
    <div className="wealth-inset grid gap-3 p-3">
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
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">What we understood</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {review.detectedSource?.name ?? "Unknown provider table export"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {review.documentKind} · {review.parseReadiness} · {review.providerConfidence} provider fit
          </p>
        </div>
        <div className="wealth-stat-tile p-3">
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
      <div className="grid gap-3 md:grid-cols-3">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Import readiness</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{importReadinessLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{importReadinessDetail}</p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">What looks usable</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {actionableHoldingCount} new holding{actionableHoldingCount === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            These are the rows most likely to improve coverage instead of just restating what the tracker already knows.
          </p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Operator check</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {parserWarningCount} parser warning{parserWarningCount === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Fewer warnings usually means less manual cleanup before you trust the preview.
          </p>
        </div>
      </div>
      <div
        className={`grid gap-2 rounded-md border p-3 text-xs ${
          importReadinessLabel === "Ready to import"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : importReadinessLabel === "Review before import"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-rose-500/30 bg-rose-500/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Operator verdict</p>
          <Badge variant={importReadinessLabel === "Ready to import" ? "secondary" : "outline"}>
            {importReadinessLabel}
          </Badge>
        </div>
        <p className="leading-5 text-muted-foreground">
          {importReadinessLabel === "Ready to import"
            ? "This review looks stable enough that the remaining work is mostly selective import discipline."
            : importReadinessLabel === "Review before import"
              ? "You are close, but a couple of warnings or duplicate signals still deserve a quick human pass."
              : "Treat this as a cleanup pass first. The live tracker should not be shaped by this review yet."}
        </p>
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
        <div className="wealth-muted-block grid gap-2 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cleanup applied</p>
          {review.normalizationApplied.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      {artifacts && (artifacts.beforeSnippet || artifacts.afterSnippet) && (
        <div className="wealth-muted-block grid gap-3 p-3 md:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">Before cleanup</p>
            <pre className="wealth-data-card overflow-auto p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.beforeSnippet || "No raw text saved."}
            </pre>
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">After cleanup</p>
            <pre className="wealth-data-card overflow-auto p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.afterSnippet || "No normalized text saved."}
            </pre>
          </div>
        </div>
      )}
      {artifacts?.rowWarnings.length ? (
        <div className="wealth-muted-block grid gap-2 p-3 text-xs text-muted-foreground">
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
        <div className="wealth-muted-block grid gap-2 p-3 text-xs text-muted-foreground">
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
        <div key={label} className="wealth-stat-tile p-3">
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
    <div className="wealth-muted-block grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed holdings</p>
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(artifacts.parsedRows.length, 8)} of {artifacts.parsedRows.length}
        </p>
      </div>
      <div className="grid gap-2">
        {artifacts.parsedRows.slice(0, 8).map((row, index) => (
          (() => {
            const assessment = getDiagnosticRowAssessment(row);
            const rowDecision = getDiagnosticRowDecision(row);

            return (
              <div
                key={`${row.name}-${row.type}-${index}`}
                className="wealth-data-card grid gap-3 p-3 text-xs lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <Badge
                      variant={row.status === "new" ? "secondary" : "outline"}
                    >
                      {row.status}
                    </Badge>
                    <Badge variant="outline" className={assessment.badgeClassName}>
                      {assessment.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {row.type} · {row.source}
                  </p>
                  <p className="mt-2 leading-5 text-muted-foreground">{assessment.detail}</p>
                  <div className="wealth-muted-block mt-3 p-2 text-[11px] leading-5 text-muted-foreground">
                    <p className="font-medium text-foreground">Decision meaning</p>
                    <p className="mt-1">{rowDecision}</p>
                  </div>
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
            );
          })()
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
  const latestTransaction = transactions[0];
  const readyAmount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const transactionReadinessLabel =
    transactions.length === 0
      ? "Journal update pending"
      : duplicateCount > 0
        ? "Review duplicate journal rows"
        : "Ready to post into journal";
  const transactionReadinessDetail =
    transactions.length === 0
      ? "No new transaction rows are waiting to update the journal yet."
      : duplicateCount > 0
        ? "The parser found usable cash-flow rows, but some already exist in the journal and should stay skipped."
        : "These parsed transaction rows look ready to strengthen the transaction timeline.";

  return (
    <div className="wealth-muted-block grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed transactions</p>
        <p className="text-xs text-muted-foreground">
          {transactions.length} new row{transactions.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="wealth-data-card p-3">
          <p className="text-xs text-muted-foreground">What this lane means</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {transactions.length > 0
              ? "These rows update the transaction journal, not the live holding snapshot."
              : "Transaction rows are not ready yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            This is where statement activity like buys, sells, dividends, or transfers gets preserved for timeline and cash-flow review.
          </p>
        </div>
        <div className="wealth-data-card p-3">
          <p className="text-xs text-muted-foreground">Next journal move</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{transactionReadinessLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{transactionReadinessDetail}</p>
        </div>
      </div>
      {latestTransaction ? (
        <div className="grid gap-3 md:grid-cols-3">
          <MetricMini
            label="Latest parsed row"
            value={latestTransaction.assetName}
            caption={`${latestTransaction.date} · ${latestTransaction.action} · ${formatMoney(latestTransaction.amount)}`}
          />
          <MetricMini
            label="Duplicate rows"
            value={String(duplicateCount)}
            caption="These already exist in the journal and will be skipped on import."
          />
          <MetricMini
            label="Ready amount"
            value={formatMoney(readyAmount)}
            caption="This is the cash flow represented by the parsed transactions ready to enter the journal."
          />
        </div>
      ) : null}
      {duplicateCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {duplicateCount} transaction duplicate{duplicateCount === 1 ? "" : "s"} already exist in the journal and will be skipped.
        </p>
      ) : null}
      <div className="grid gap-2">
        {transactions.slice(0, 8).map((transaction) => {
          const transactionMeaning = getTransactionImportMeaning(transaction);

          return (
            <div
              key={transaction.id}
              className="wealth-data-card grid gap-2 p-3 text-xs md:grid-cols-[1.6fr_0.8fr_0.8fr_1fr]"
            >
              <div>
                <p className="font-medium text-foreground">{transaction.assetName}</p>
                <p className="mt-1 text-muted-foreground">
                  {transaction.type} · {transaction.source}
                </p>
                <p className="wealth-muted-block mt-2 p-2 text-[11px] leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">Journal impact</span>{" "}
                  {transactionMeaning}
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
          );
        })}
      </div>
    </div>
  );
}

function ImportReconciliationCard({
  onKeepTrackedRow,
  onUseImportedRow,
  rows,
  selectedKeys,
}: {
  onKeepTrackedRow: (rowKey: string) => void;
  onUseImportedRow: (rowKey: string) => void;
  rows: Array<{
    currentValueDelta: number;
    existingAsset: PortfolioAsset;
    importedAsset: PortfolioAsset;
    importedRowKey: string;
    investedValueDelta: number;
    priceDelta: number;
    quantityDelta: number;
  }>;
  selectedKeys: string[];
}) {
  const classifiedRows = rows.map((row) => {
    const currentDeltaAbs = Math.abs(row.currentValueDelta);
    const investedDeltaAbs = Math.abs(row.investedValueDelta);
    const quantityDeltaAbs = Math.abs(row.quantityDelta);
    const priceDeltaAbs = Math.abs(row.priceDelta);

    if (
      currentDeltaAbs <= 100 &&
      investedDeltaAbs <= 100 &&
      quantityDeltaAbs <= 0.05 &&
      priceDeltaAbs <= 2
    ) {
      return {
        ...row,
        decision: "Safe refresh",
        note: "Looks like a small statement or rounding update. Usually safe to merge after a quick glance.",
        toneClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    }

    if (
      currentDeltaAbs <= 500 &&
      investedDeltaAbs <= 500 &&
      quantityDeltaAbs <= 0.25 &&
      priceDeltaAbs <= 10
    ) {
      return {
        ...row,
        decision: "Quick review",
        note: "The row is close, but the differences are large enough that you should confirm folio, units, or latest valuation before merge.",
        toneClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    }

    return {
      ...row,
      decision: "Manual review",
      note: "This gap is material. Confirm that the import row matches the right holding before merging into the tracker.",
      toneClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  });
  const safeRefreshCount = classifiedRows.filter((row) => row.decision === "Safe refresh").length;
  const quickReviewCount = classifiedRows.filter((row) => row.decision === "Quick review").length;
  const manualReviewCount = classifiedRows.filter((row) => row.decision === "Manual review").length;
  const leadRecommendation =
    manualReviewCount > 0
      ? "Pause on these rows first. One or more duplicate matches differ materially from what is already tracked."
      : quickReviewCount > 0
        ? "You are close. Review the highlighted rows, then merge once the units and values look right."
        : "These look like minor refreshes. A quick spot check is usually enough before merge.";
  const mergeModeLabel =
    manualReviewCount > 0
      ? "Mismatch-heavy merge lane"
      : quickReviewCount > 0
        ? "Selective merge lane"
        : "Low-risk refresh lane";
  const mergeModeDetail =
    manualReviewCount > 0
      ? "The imported rows are close in name, but the numbers differ enough that you should confirm folio, units, or valuation before overwriting tracked data."
      : quickReviewCount > 0
        ? "Most rows are probably fine, but you still want a human pass on the medium-sized gaps before merge."
        : "The imported rows mainly look like statement refreshes, so the main task is a quick spot-check rather than a full reconciliation.";

  return (
    <div className="wealth-inset grid gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Reconciliation review</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            These rows matched an existing holding name, but the imported numbers differ enough to deserve a quick human check before merge.
          </p>
        </div>
        <Badge variant="outline">
          {rows.length} mismatch{rows.length === 1 ? "" : "es"}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">What this lane means</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{mergeModeLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{mergeModeDetail}</p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Merge decision</p>
          <p className="mt-1 text-sm font-semibold text-foreground">Decide row by row</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use the imported row only when it is clearly the fresher truth. Keep the tracked row when the import looks partial, rounded, or mismatched.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommended move
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{leadRecommendation}</p>
        </div>
        <div className="wealth-data-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Safe refresh
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{safeRefreshCount}</p>
        </div>
        <div className="wealth-data-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick review
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{quickReviewCount}</p>
        </div>
        <div className="wealth-data-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Manual review
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{manualReviewCount}</p>
        </div>
      </div>
      <div
        className={`grid gap-2 rounded-md border p-3 text-xs ${
          manualReviewCount > 0
            ? "border-rose-500/30 bg-rose-500/5"
            : quickReviewCount > 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Duplicate verdict</p>
          <Badge variant={manualReviewCount === 0 && quickReviewCount === 0 ? "secondary" : "outline"}>
            {manualReviewCount > 0
              ? "Manual review required"
              : quickReviewCount > 0
                ? "Quick review recommended"
                : "Safe refresh lane"}
          </Badge>
        </div>
        <p className="leading-5 text-muted-foreground">{leadRecommendation}</p>
      </div>
      <div className="grid gap-3">
        {classifiedRows.slice(0, 6).map((row) => {
          const isSelected = selectedKeys.includes(row.importedRowKey);
          const keepOutcome = getReconciliationChoiceOutcome({
            importedAsset: row.importedAsset,
            importedValueDelta: row.currentValueDelta,
            isImportedSelected: false,
          });
          const mergeOutcome = getReconciliationChoiceOutcome({
            importedAsset: row.importedAsset,
            importedValueDelta: row.currentValueDelta,
            isImportedSelected: true,
          });

          return (
          <div
            key={`${row.existingAsset.name}-${row.existingAsset.type}`}
            className="wealth-muted-block grid gap-3 p-3 lg:grid-cols-[1.1fr_1fr_1fr]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{row.existingAsset.name}</p>
                <Badge variant="outline">{row.existingAsset.type}</Badge>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${row.toneClass}`}
                >
                  {row.decision}
                </span>
                <Badge variant={isSelected ? "default" : "secondary"}>
                  {isSelected ? "Will merge imported row" : "Keeping tracked row"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Current tracker row vs latest import payload.
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground/80">{row.note}</p>
              <div className="wealth-data-card mt-3 grid gap-2 p-2 text-[11px] leading-5 text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">If you use imported row</p>
                  <p className="mt-1">{mergeOutcome}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">If you keep tracked row</p>
                  <p className="mt-1">{keepOutcome}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "outline" : "default"}
                  onClick={() => onUseImportedRow(row.importedRowKey)}
                >
                  Use imported row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "ghost" : "outline"}
                  onClick={() => onKeepTrackedRow(row.importedRowKey)}
                >
                  Keep tracked row
                </Button>
              </div>
            </div>
            <div className="wealth-data-card p-3 text-xs">
              <p className="font-medium text-foreground">Tracked now</p>
              <div className="mt-2 grid gap-1 text-muted-foreground">
                <span>Current {formatMoney(row.existingAsset.value)}</span>
                <span>Invested {formatMoney(row.existingAsset.investedValue)}</span>
                <span>Units {row.existingAsset.quantity.toFixed(2)}</span>
                <span>Price {formatMoney(row.existingAsset.price)}</span>
              </div>
            </div>
            <div className="wealth-data-card p-3 text-xs">
              <p className="font-medium text-foreground">Imported row</p>
              <div className="mt-2 grid gap-1 text-muted-foreground">
                <span>
                  Current {formatMoney(row.importedAsset.value)}{" "}
                  <strong className="text-foreground">
                    ({row.currentValueDelta >= 0 ? "+" : ""}
                    {formatMoney(row.currentValueDelta)})
                  </strong>
                </span>
                <span>
                  Invested {formatMoney(row.importedAsset.investedValue)}{" "}
                  <strong className="text-foreground">
                    ({row.investedValueDelta >= 0 ? "+" : ""}
                    {formatMoney(row.investedValueDelta)})
                  </strong>
                </span>
                <span>
                  Units {row.importedAsset.quantity.toFixed(2)}{" "}
                  <strong className="text-foreground">
                    ({row.quantityDelta >= 0 ? "+" : ""}
                    {row.quantityDelta.toFixed(2)})
                  </strong>
                </span>
                <span>
                  Price {formatMoney(row.importedAsset.price)}{" "}
                  <strong className="text-foreground">
                    ({row.priceDelta >= 0 ? "+" : ""}
                    {formatMoney(row.priceDelta)})
                  </strong>
                </span>
              </div>
            </div>
          </div>
          );
        })}
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
  const decisionReadLabel =
    overview.holdingsSelected === 0 && overview.transactionsNew === 0
      ? "Import delta pending"
      : overview.holdingsDuplicates > overview.holdingsSelected
        ? "Duplicate-heavy review"
        : "Useful import delta";
  const decisionReadDetail =
    decisionReadLabel === "Import delta pending"
      ? "Nothing selected is currently improving the live tracker, so the best move is usually more review rather than more import."
      : decisionReadLabel === "Duplicate-heavy review"
        ? "Most of the selected impact overlaps with existing holdings, so name matching and merge choice matter more than raw row count."
        : "The current selection is adding new coverage or transaction history that should make the tracker more complete.";
  const primaryActionLabel =
    overview.holdingsSelected === 0 && overview.transactionsNew === 0
      ? "Keep reviewing before import"
      : overview.holdingsSelected > 0 && overview.transactionsNew > 0
        ? "Import both holdings and journal rows"
        : overview.holdingsSelected > 0
          ? "Import selected holdings"
          : "Import parsed journal rows";
  const primaryActionDetail =
    overview.holdingsSelected === 0 && overview.transactionsNew === 0
      ? "Nothing meaningful is selected yet, so the next best move is still cleanup or row selection."
      : overview.holdingsSelected > 0 && overview.transactionsNew > 0
        ? "The current pass will update both the live portfolio snapshot and the transaction history."
        : overview.holdingsSelected > 0
          ? "This import mostly changes the current holding snapshot rather than the journal."
          : "This pass is mostly about preserving transaction history instead of changing live holdings.";

  return (
    <div className="wealth-inset grid gap-3 p-3">
      <div>
        <p className="text-sm font-medium">Import decision summary</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{overview.headline}</p>
      </div>
      <div className="wealth-stat-tile p-3">
        <p className="text-xs text-muted-foreground">Decision read</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{decisionReadLabel}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{decisionReadDetail}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Selected impact</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {overview.holdingsSelected} holding{overview.holdingsSelected === 1 ? "" : "s"} selected
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatMoney(overview.selectedCurrentValue)} current value and {formatMoney(overview.selectedInvestedValue)} invested value are currently marked to import.
          </p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Primary action</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{primaryActionLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {primaryActionDetail}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Transaction effect</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {overview.transactionsNew} new transaction{overview.transactionsNew === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {overview.transactionDuplicates} duplicate transaction{overview.transactionDuplicates === 1 ? "" : "s"} will be skipped if they already exist in the journal.
          </p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Why this summary matters</p>
          <p className="mt-1 text-sm font-semibold text-foreground">Import the delta, not the noise</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A good import pass usually adds missing coverage, fresher values, or journal history without overwriting healthy tracked data just because the file had similar names.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="wealth-stat-tile p-3">
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
  const previewActionLabel =
    preview.errors.length > 0
      ? "Fix review blockers first"
      : selectedCount === 0
        ? "Select only rows that improve coverage"
        : preview.duplicates.length > 0
          ? "Import selected rows with duplicate review"
          : "Import selected rows";
  const previewActionDetail =
    preview.errors.length > 0
      ? "Missing required fields or parser issues still make this preview too weak to trust."
      : selectedCount === 0
        ? "A selective import is usually cleaner than pulling every parsed row into the tracker."
        : preview.duplicates.length > 0
          ? "You have selected rows, but some match existing holdings and deserve a quick duplicate check."
          : "The selected rows look ready to move into the tracker.";
  const selectionReadLabel =
    selectedCount === 0
      ? "Nothing selected yet"
      : preview.duplicates.length > 0
        ? "Selection includes duplicate names"
        : "Selection is clean";
  const selectionReadDetail =
    selectedCount === 0
      ? "Start by selecting only the rows that clearly improve live coverage."
      : preview.duplicates.length > 0
        ? "Some selected rows overlap existing holdings, so the duplicate and reconciliation lanes matter before import."
        : "The selected rows mostly behave like clean additions to the tracker.";

  return (
    <div className="wealth-inset grid gap-3 p-3">
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
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Preview meaning</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {preview.assets.length > 0
              ? "These are the holdings the parser believes it found."
              : "Holdings are not parsed yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Duplicate rows are shown so you can decide whether to merge them into existing holdings or keep them separate.
          </p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Next import move</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{previewActionLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {previewActionDetail}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Selection read</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{selectionReadLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectionReadDetail}</p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">What this lane controls</p>
          <p className="mt-1 text-sm font-semibold text-foreground">Live holding snapshot</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            These selections shape the current holdings table, allocation mix, and live portfolio value after the import is applied.
          </p>
        </div>
      </div>
      <div
        className={`grid gap-2 rounded-md border p-3 text-xs ${
          preview.errors.length > 0
            ? "border-rose-500/30 bg-rose-500/5"
            : selectedCount === 0
              ? "border-border bg-muted/30"
              : preview.duplicates.length > 0
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">Selection verdict</p>
          <Badge
            variant={
              preview.errors.length > 0
                ? "outline"
                : selectedCount > 0 && preview.duplicates.length === 0
                  ? "secondary"
                  : "outline"
            }
          >
            {previewActionLabel}
          </Badge>
        </div>
        <p className="leading-5 text-muted-foreground">{previewActionDetail}</p>
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
          const assessment = getPreviewRowAssessment(asset, isDuplicate);

          return (
          <div
            key={rowKey}
            className="wealth-data-card grid gap-3 px-3 py-2 text-xs sm:grid-cols-[auto_1fr_auto]"
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
                <Badge variant="outline" className={assessment.badgeClassName}>
                  {assessment.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {asset.type} · {asset.source}
              </p>
              <p className="mt-1 leading-5 text-muted-foreground">{assessment.detail}</p>
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

function getPreviewRowAssessment(asset: PortfolioAsset, isDuplicate: boolean) {
  const missingInvestedValue =
    asset.investedValue <= 0 || Math.abs(asset.investedValue - asset.value) < 0.01;
  const missingMarketFields = asset.quantity <= 0 || asset.price <= 0;

  if (isDuplicate && (missingInvestedValue || missingMarketFields)) {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "This row overlaps an existing holding and still has fields that deserve a manual check.",
      label: "Review closely",
    };
  }

  if (isDuplicate) {
    return {
      badgeClassName: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      detail: "The parser found a likely match to an existing holding, so merge choice matters more than raw import count.",
      label: "Duplicate match",
    };
  }

  if (missingInvestedValue || missingMarketFields) {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "This row adds coverage, but the imported price, units, or invested value should be checked before trusting it.",
      label: "Needs review",
    };
  }

  return {
    badgeClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    detail: "This row looks complete enough to act as a clean coverage addition.",
    label: "Looks solid",
  };
}

function getHoldingReviewAssessment({
  asset,
  portfolioTotal,
}: {
  asset: PortfolioAsset;
  portfolioTotal: number;
}) {
  const isManual = asset.source.toLowerCase() === "manual";
  const allocationShare = portfolioTotal > 0 ? (asset.value / portfolioTotal) * 100 : 0;
  const missingDetail = asset.investedValue <= 0 || asset.quantity <= 0 || asset.price <= 0;
  const concentrationHeavy = allocationShare >= 20;

  if (isManual && (missingDetail || concentrationHeavy)) {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "This is a manual row with either thin detail quality or a big portfolio footprint, so it deserves a careful numbers check before smaller edits.",
      label: "High-touch row",
      nextStepDetail: "Confirm invested value, units, and source confidence first so this position does not distort allocation or gain reporting.",
      nextStepLabel: "Verify key fields",
    };
  }

  if (concentrationHeavy) {
    return {
      badgeClassName: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      detail: `This holding represents about ${allocationShare.toFixed(1)}% of the tracked portfolio, so even a small mistake here carries outsized impact.`,
      label: "Concentration check",
      nextStepDetail: "Review whether the size is intentional, then confirm current value and invested value before making tactical decisions off the mix.",
      nextStepLabel: "Check position weight",
    };
  }

  if (missingDetail) {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "The row is visible, but one or more supporting fields are still weak enough to limit confidence in the read.",
      label: "Detail cleanup",
      nextStepDetail: "Fill the missing invested value, units, or price so P&L and allocation reads stay trustworthy.",
      nextStepLabel: "Tighten row detail",
    };
  }

  if (asset.gain < -10) {
    return {
      badgeClassName: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      detail: "This row is materially underwater, which makes cost basis and thesis review more important than surface cleanup.",
      label: "Loss review",
      nextStepDetail: "Confirm that the invested value and units are accurate before using this drawdown as a decision signal.",
      nextStepLabel: "Validate drawdown read",
    };
  }

  return {
    badgeClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    detail: "This holding reads like a relatively clean tracked row, so it is better suited for quick scan than heavy cleanup.",
    label: "Healthy row",
    nextStepDetail: "Use it as part of allocation and concentration review, and only edit if source quality or thesis has actually changed.",
    nextStepLabel: "Scan, then move on",
  };
}

function getDiagnosticRowDecision(row: ImportDiagnosticRow) {
  if (row.status === "duplicate") {
    return "Treat this as a comparison row first. It overlaps an existing holding, so the main decision is whether it refreshes tracked truth or just repeats it.";
  }

  if (row.notes.length > 0) {
    return "This row probably adds coverage, but it still deserves a check before it shapes allocation, gain, or invested-value reporting.";
  }

  return "This row is acting like a clean addition, so it is a good candidate to expand live coverage.";
}

function getTransactionImportMeaning(transaction: PortfolioTransaction) {
  if (transaction.action === "buy") {
    return "This will add purchase activity to the journal and improve cost-basis history for the holding.";
  }

  if (transaction.action === "sell") {
    return "This will record an exit or trim in the journal, which matters for realized P&L and timeline accuracy.";
  }

  if (transaction.action === "dividend") {
    return "This will preserve an income event in the journal so payout history stays visible.";
  }

  return "This row will update the journal timeline without directly changing the live holding snapshot on its own.";
}

function getReconciliationChoiceOutcome({
  importedAsset,
  importedValueDelta,
  isImportedSelected,
}: {
  importedAsset: PortfolioAsset;
  importedValueDelta: number;
  isImportedSelected: boolean;
}) {
  if (isImportedSelected) {
    return importedValueDelta === 0
      ? `The live tracker will keep the same current value but refresh from the imported ${importedAsset.type.toLowerCase()} row.`
      : `The live tracker will move to ${formatMoney(importedAsset.value)} for this holding, changing current value by ${importedValueDelta >= 0 ? "+" : ""}${formatMoney(importedValueDelta)}.`;
  }

  return "The live tracker will stay as-is for this holding, and the imported row will be treated as reference rather than the new truth.";
}

function getDiagnosticRowAssessment(row: ImportDiagnosticRow) {
  if (row.status === "duplicate" && row.notes.length > 0) {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "This row overlaps an existing holding and still carries at least one review note.",
      label: "High-touch row",
    };
  }

  if (row.status === "duplicate") {
    return {
      badgeClassName: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      detail: "This row mostly looks complete, but it maps to an existing holding and should be merged deliberately.",
      label: "Duplicate row",
    };
  }

  if (row.status === "review") {
    return {
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: "The parser found a plausible row, but one or more fields still need a human check before import.",
      label: "Review row",
    };
  }

  return {
    badgeClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    detail: "This row looks like a clean new addition with the key fields present.",
    label: "Clean row",
  };
}
