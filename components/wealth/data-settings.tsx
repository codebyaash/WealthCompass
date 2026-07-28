"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Cloud,
  Copy,
  Database,
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
import {
  NumberField,
  SelectField,
  SegmentedControl,
  TextField,
} from "@/components/wealth/form-fields";
import { MetricMini } from "@/components/wealth/metric-mini";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageNavigatorBar } from "@/components/wealth/page-navigator-bar";
import {
  buildCombinedImportOverview,
  type CombinedImportOverview,
} from "@/lib/combined-import-overview";
import { previewPortfolioImport } from "@/lib/csv-import";
import {
  describeReadiness,
  importSourceDescriptors,
} from "@/lib/import-sources";
import {
  connectorTemplates,
  createConnectionFromTemplate,
  describeConnectorTemplate,
  getConnectorTemplate,
} from "@/lib/connector-templates";
import { getConnectorSampleInput } from "@/lib/connector-samples";
import {
  buildSyncPlanSeedFromEmailResult,
  buildSyncPlanSeedFromImportJob,
} from "@/lib/connector-handoffs";
import { formatMoney } from "@/lib/formatters";
import {
  applyImportJobToPortfolio,
  describeImportHistoryApplyResult,
  filterNewImportedTransactions,
} from "@/lib/import-jobs";
import {
  getBrokerSyncHistory,
  brokerProviderDescriptors,
  type BrokerConnection,
} from "@/lib/broker-connections";
import {
  getInboxSyncHistory,
  buildInboxOperationsSummary,
  getInboxConnectionHealth,
  inboxProviderDescriptors,
  type InboxConnection,
  type InboxProvider,
} from "@/lib/inbox-connections";
import type {
  EmailIngestionApiResponse,
  EmailIngestionResult,
} from "@/lib/email-ingestion";
import { normalizeImportTextForProvider } from "@/lib/provider-import-normalizers";
import { defaultMarketPreferences } from "@/lib/sample-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getProviderParserProfile } from "@/lib/provider-parser-profiles";
import { parseImportedTransactions } from "@/lib/transaction-import";
import {
  getImportJobFlowMeta,
  getImportJobHistoryActions,
  getImportJobOutcomeStats,
  getImportJobPrimaryAction,
} from "@/lib/import-job-flow";
import {
  buildConnectorActivitySummary,
  buildConnectorActivityFeed,
  buildIntegrationDiagnosticsSummary,
  buildIntegrationOperationsSummary,
  filterAndSortIntegrations,
  recordManualIntegrationReview,
  buildIntegrationSchedulerPlan,
  formatSyncTimeLabel,
  getAutoOpenIntegrationAction,
  type IntegrationActivityFilter,
  type IntegrationActionItem,
  getIntegrationActionItems,
  getIntegrationAttentionItems,
  getIntegrationHealthMetrics,
  getIntegrationStrategyLabel,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
} from "@/lib/integration-sync";
import type {
  ProviderSyncExecutionOverview,
  ProviderSyncExecutionResult,
  ProviderSyncPreview,
} from "@/lib/provider-sync-adapters";
import {
  applySyncExecutionToPortfolio,
  buildSyncExecutionOverview,
  createImportJobFromSyncExecution,
} from "@/lib/provider-sync-adapters";
import {
  type ImportJob,
  parseWorkspaceImport,
  type IntegrationConnection,
  type MarketPreferences,
  type PortfolioAsset,
  type PortfolioTransaction,
  type RiskHistoryItem,
  type WealthCompassImport,
  type WealthGoal,
} from "@/lib/local-storage";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";
import { isSupabaseConfigured } from "@/lib/supabase";

export type DataSettingsFocusSection =
  | "broker"
  | "connected-sources"
  | "email-intake"
  | "import-history"
  | "inbox"
  | "sync-plan";

export type DataSettingsFocusRequest = {
  importAction?: "apply-portfolio" | "none" | "open-sync-plan";
  jobId?: string;
  providerId?: string;
  providerName?: string;
  section: DataSettingsFocusSection;
};

export function DataSettings({
  answers,
  assets,
  focusRequestKey,
  focusRequest,
  goals,
  integrations,
  importJobs,
  onImportBrokerAssets,
  onImportWorkspace,
  onAddIntegration,
  onDeleteIntegration,
  onLogImportJob,
  onReprocessImportJob,
  onResetPortfolio,
  onRestoreDemoWorkspace,
  onRunIntegrationSync,
  onUpdateImportJob,
  onUpdateIntegration,
  onUpdateMarketPreferences,
  profile,
  riskHistory,
  marketPreferences = defaultMarketPreferences,
  syncMessage,
  syncStatus,
  transactions,
  userEmail,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  focusRequestKey?: number;
  focusRequest?: DataSettingsFocusRequest | null;
  goals: WealthGoal[];
  integrations: IntegrationConnection[];
  importJobs: ImportJob[];
  onImportBrokerAssets: (
    assets: PortfolioAsset[],
    job: ImportJob,
    transactions?: PortfolioTransaction[],
  ) => void;
  onImportWorkspace: (workspace: WealthCompassImport) => void;
  onAddIntegration: (connection: IntegrationConnection) => void;
  onDeleteIntegration: (connectionId: string) => void;
  onLogImportJob: (job: ImportJob) => void;
  onReprocessImportJob: (jobId: string) => void;
  onResetPortfolio: () => void;
  onRestoreDemoWorkspace: () => void;
  onRunIntegrationSync: (connectionId?: string) => void;
  onUpdateImportJob: (jobId: string, job: ImportJob) => void;
  onUpdateIntegration: (connectionId: string, connection: IntegrationConnection) => void;
  onUpdateMarketPreferences: (preferences: MarketPreferences) => void;
  profile: RiskProfile;
  riskHistory: RiskHistoryItem[];
  marketPreferences: MarketPreferences;
  syncMessage: string;
  syncStatus: string;
  transactions: PortfolioTransaction[];
  userEmail: string;
}) {
  const [navigatorValue, setNavigatorValue] = useState("settings-connected-sources");
  const safeMarketPreferences = {
    ...defaultMarketPreferences,
    ...marketPreferences,
    watchlist: marketPreferences?.watchlist ?? defaultMarketPreferences.watchlist,
  };
  const [actionMessage, setActionMessage] = useState("Full workspace export is ready.");
  const [jobCorrectionDrafts, setJobCorrectionDrafts] = useState<Record<string, string>>({});
  const [draftIntegration, setDraftIntegration] = useState<IntegrationConnection>(
    createConnectionFromTemplate("paytm-money"),
  );
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("paytm-money");
  const [emailAttachmentFileName, setEmailAttachmentFileName] = useState("statement-attachment.txt");
  const [emailAttachmentContentType, setEmailAttachmentContentType] = useState("text/plain");
  const [emailAttachmentPageCount, setEmailAttachmentPageCount] = useState(1);
  const [emailAttachmentText, setEmailAttachmentText] = useState("");
  const [emailBodyText, setEmailBodyText] = useState("");
  const [emailFrom, setEmailFrom] = useState(userEmail || "statements@example.com");
  const [emailIntakeResult, setEmailIntakeResult] = useState<EmailIngestionResult | null>(null);
  const [emailAttachmentOcrMode, setEmailAttachmentOcrMode] = useState("not-needed");
  const [emailSubject, setEmailSubject] = useState("Monthly statement attached");
  const [brokerConnections, setBrokerConnections] = useState<BrokerConnection[]>([]);
  const [isBrokerLoading, setIsBrokerLoading] = useState(false);
  const [inboxConnections, setInboxConnections] = useState<InboxConnection[]>([]);
  const [isInboxLoading, setIsInboxLoading] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [syncInputFileName, setSyncInputFileName] = useState("");
  const [syncInputText, setSyncInputText] = useState("");
  const [syncPreview, setSyncPreview] = useState<ProviderSyncPreview | null>(null);
  const [syncExecution, setSyncExecution] = useState<ProviderSyncExecutionResult | null>(null);
  const [syncPreviewConnection, setSyncPreviewConnection] = useState<IntegrationConnection | null>(null);
  const [syncPreviewProviderId, setSyncPreviewProviderId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<"all" | "completed" | "open" | "failed">("all");
  const [jobSearch, setJobSearch] = useState("");
  const [integrationFilter, setIntegrationFilter] = useState<IntegrationActivityFilter>("all");
  const [integrationSearch, setIntegrationSearch] = useState("");
  const [highlightedBrokerProviderId, setHighlightedBrokerProviderId] = useState<string | null>(null);
  const [highlightedBrokerNotice, setHighlightedBrokerNotice] = useState<string | null>(null);
  const [highlightedInboxProviderId, setHighlightedInboxProviderId] = useState<string | null>(null);
  const [highlightedInboxNotice, setHighlightedInboxNotice] = useState<string | null>(null);
  const [highlightedIntegrationId, setHighlightedIntegrationId] = useState<string | null>(null);
  const [highlightedIntegrationNotice, setHighlightedIntegrationNotice] = useState<string | null>(null);
  const [highlightedActivityProviderId, setHighlightedActivityProviderId] = useState<string | null>(null);
  const [highlightedActivityProviderName, setHighlightedActivityProviderName] = useState<string | null>(null);
  const [highlightedImportJobId, setHighlightedImportJobId] = useState<string | null>(null);
  const [highlightedImportJobNotice, setHighlightedImportJobNotice] = useState<string | null>(null);
  const brokerSectionRef = useRef<HTMLDivElement | null>(null);
  const inboxSectionRef = useRef<HTMLDivElement | null>(null);
  const emailIntakeSectionRef = useRef<HTMLDivElement | null>(null);
  const connectedSourcesSectionRef = useRef<HTMLDivElement | null>(null);
  const importHistorySectionRef = useRef<HTMLDivElement | null>(null);
  const syncPlanSectionRef = useRef<HTMLDivElement | null>(null);
  const safetyExportSectionRef = useRef<HTMLDivElement | null>(null);
  const restoreSectionRef = useRef<HTMLDivElement | null>(null);
  const resetSectionRef = useRef<HTMLDivElement | null>(null);
  const syncInboxActionRef = useRef<(provider: InboxProvider) => Promise<void>>(async () => {});
  const syncBrokerActionRef = useRef<() => Promise<void>>(async () => {});
  const integrationActionRef = useRef<
    (integration: IntegrationConnection, action: IntegrationActionItem) => Promise<void>
  >(async () => {});
  const integrationHealthSummary = useMemo(() => {
    const metrics = integrations.map(getIntegrationHealthMetrics);
    const activeCount = integrations.filter((integration) => integration.status === "active").length;
    const totalRuns = metrics.reduce((sum, item) => sum + item.totalRuns, 0);
    const averageSuccessRate = metrics.length
      ? Math.round(metrics.reduce((sum, item) => sum + item.successRate, 0) / metrics.length)
      : 0;
    const warningConnections = metrics.filter((item) => item.warningStreak > 0).length;

    return {
      activeCount,
      averageSuccessRate,
      totalRuns,
      warningConnections,
    };
  }, [integrations]);
  const schedulerPlan = useMemo(
    () => buildIntegrationSchedulerPlan(integrations),
    [integrations],
  );
  const selectedTemplate = useMemo(
    () => getConnectorTemplate(selectedTemplateId) ?? connectorTemplates[0],
    [selectedTemplateId],
  );
  const selectedTemplateMeta = useMemo(
    () => describeConnectorTemplate(selectedTemplate),
    [selectedTemplate],
  );
  const operationsSummary = useMemo(
    () => buildIntegrationOperationsSummary(integrations),
    [integrations],
  );
  const connectorActivityFeed = useMemo(
    () =>
      buildConnectorActivityFeed({
        brokerConnections,
        inboxConnections,
        integrations,
      }),
    [brokerConnections, inboxConnections, integrations],
  );
  const filteredConnectorActivityFeed = useMemo(() => {
    if (!highlightedActivityProviderId) return connectorActivityFeed;

    return connectorActivityFeed.filter(
      (event) => event.providerId === highlightedActivityProviderId,
    );
  }, [connectorActivityFeed, highlightedActivityProviderId]);
  const connectorActivitySummary = useMemo(
    () => buildConnectorActivitySummary(filteredConnectorActivityFeed),
    [filteredConnectorActivityFeed],
  );
  const attentionItems = useMemo(
    () => getIntegrationAttentionItems(integrations).slice(0, 4),
    [integrations],
  );
  const importJobSummary = useMemo(() => {
    const openCount = importJobs.filter(
      (job) => job.status === "received" || job.status === "reviewed",
    ).length;
    const completedCount = importJobs.filter((job) => job.status === "completed").length;
    const failedCount = importJobs.filter((job) => job.status === "failed").length;
    const ocrCount = importJobs.filter((job) => job.usedOcr).length;

    return {
      completedCount,
      failedCount,
      ocrCount,
      openCount,
    };
  }, [importJobs]);
  const filteredImportJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();

    return importJobs.filter((job) => {
      const matchesFilter =
        jobFilter === "all"
          ? true
          : jobFilter === "open"
            ? job.status === "received" || job.status === "reviewed"
            : job.status === jobFilter;

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        job.providerName,
        job.fileName,
        job.summary,
        job.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [importJobs, jobFilter, jobSearch]);
  const filteredIntegrations = useMemo(
    () =>
      filterAndSortIntegrations(integrations, {
        filter: integrationFilter,
        query: integrationSearch,
      }),
    [integrationFilter, integrationSearch, integrations],
  );
  const latestImportJobByProviderId = useMemo(
    () => {
      const nextMap = new Map<string, ImportJob>();

      for (const job of importJobs) {
        if (!job.providerId) continue;
        const current = nextMap.get(job.providerId);
        if (!current || job.createdAt > current.createdAt) {
          nextMap.set(job.providerId, job);
        }
      }

      return nextMap;
    },
    [importJobs],
  );
  const syncPlanLatestImportJob = useMemo(() => {
    if (!syncPreviewConnection) return null;

    return latestImportJobByProviderId.get(syncPreviewConnection.providerId) ?? null;
  }, [latestImportJobByProviderId, syncPreviewConnection]);
  const syncPlanLatestImportMeta = useMemo(
    () => (syncPlanLatestImportJob ? getImportJobFlowMeta(syncPlanLatestImportJob) : null),
    [syncPlanLatestImportJob],
  );
  const syncPlanLatestImportStats = useMemo(
    () => (syncPlanLatestImportJob ? getImportJobOutcomeStats(syncPlanLatestImportJob) : null),
    [syncPlanLatestImportJob],
  );
  const syncPlanCombinedOverview = useMemo(() => {
    if (!syncPreviewConnection || !syncInputText.trim()) return null;

    const normalized = normalizeImportTextForProvider({
      providerId: syncPreviewConnection.providerId,
      text: syncInputText,
    });
    const holdingsPreview = previewPortfolioImport(normalized.text, assets);
    const parsedTransactions = parseImportedTransactions(normalized.text);
    const newTransactions = filterNewImportedTransactions(
      parsedTransactions.transactions,
      transactions,
    );

    return buildCombinedImportOverview({
      preview: holdingsPreview,
      selectedAssets: holdingsPreview.assets,
      transactionDuplicateCount:
        parsedTransactions.transactions.length - newTransactions.length,
      transactionParsedCount: parsedTransactions.transactions.length,
      transactionReadyCount: newTransactions.length,
    });
  }, [assets, syncInputText, syncPreviewConnection, transactions]);
  const syncExecutionOverview = useMemo<ProviderSyncExecutionOverview | null>(
    () => (syncExecution ? buildSyncExecutionOverview(syncExecution) : null),
    [syncExecution],
  );
  const inboxConnectionMap = useMemo(
    () =>
      new Map(
        inboxConnections.map((connection) => [connection.provider, connection]),
      ),
    [inboxConnections],
  );
  const inboxOperationsSummary = useMemo(
    () => buildInboxOperationsSummary(inboxProviderDescriptors, inboxConnections),
    [inboxConnections],
  );
  const brokerConnectionMap = useMemo(
    () =>
      new Map(
        brokerConnections.map((connection) => [connection.provider, connection]),
      ),
    [brokerConnections],
  );
  const exportedSnapshot = useMemo(
    () =>
      JSON.stringify(
        {
          answers,
          assets,
          exportedAt: new Date().toISOString(),
          goals,
          integrations,
          importJobs,
          marketPreferences,
          profile,
          riskHistory,
          transactions,
          version: 1,
        },
        null,
        2,
      ),
    [
      answers,
      assets,
      goals,
      integrations,
      importJobs,
      marketPreferences,
      profile,
      riskHistory,
      transactions,
    ],
  );
  const setupChecklist = useMemo(
    () => [
      {
        detail: isSupabaseConfigured()
          ? userEmail
            ? `Signed in as ${userEmail}. Cloud sync and connector auth are available.`
            : "Cloud services are connected. Sign in to unlock saved history, live connectors, and account-backed sync."
          : "Connect Supabase in local settings to unlock cloud sync, saved history, and connector sign-in.",
        done: isSupabaseConfigured() && Boolean(userEmail),
        label: "Sign-in and cloud sync",
      },
      {
        detail:
          "Add a live market data key in local settings to replace fallback sector snapshots with fresh refreshes.",
        done: false,
        label: "Live market feed",
      },
      {
        detail:
          "Paytm Money is ready through CSV, statement text, email, and PDF imports today.",
        done: true,
        label: "Paytm import flow",
      },
      {
        detail:
          "Direct broker API sync is implemented for Zerodha only right now. Paytm Money live account linking still needs its own connector.",
        done: false,
        label: "Paytm live linking",
      },
    ],
    [userEmail],
  );
  const settingsTrack =
    profile.actionBaskets.find((track) => track.id === "track") ?? profile.actionBaskets[0];
  const settingsHeadline =
    operationsSummary.attentionCount > 0
      ? "Tighten the feeds that still need a review before they touch your portfolio."
      : operationsSummary.activeCount > 0
        ? "Your data lanes are active. Keep them clean, review exceptions, and protect the workspace."
        : "Set up one reliable feed first, then let the rest of the workflow build around it.";
  const settingsDetail =
    settingsTrack?.items[0] ??
    "Use this page to connect sources, review imports, and keep a clean backup of the workspace.";
  const settingsSteps = [
    {
      detail:
        operationsSummary.activeCount > 0
          ? `${operationsSummary.activeCount} source${operationsSummary.activeCount === 1 ? "" : "s"} already active.`
          : "Start with one broker, email, or statement lane.",
      icon: Cloud,
      title: "1. Connect a feed",
    },
    {
      detail:
        importJobSummary.openCount > 0
          ? `${importJobSummary.openCount} import review${importJobSummary.openCount === 1 ? "" : "s"} waiting.`
          : "Keep staged imports clean before they merge into holdings.",
      icon: ScanSearch,
      title: "2. Review before apply",
    },
    {
      detail:
        "Keep a fresh workspace export around before major connector or import changes.",
      icon: Download,
      title: "3. Protect the workspace",
    },
  ];
  const settingsSectionLinks = [
    {
      badge: `${operationsSummary.activeCount} active`,
      detail: "Connect brokers, inboxes, and manual statement lanes.",
      onClick: () => scrollToSection(connectedSourcesSectionRef),
      title: "Connector lanes",
    },
    {
      badge: `${importJobSummary.openCount} open`,
      detail: "Review staged imports before they touch holdings or transactions.",
      onClick: () => scrollToSection(importHistorySectionRef),
      title: "Review queue",
    },
    {
      badge: syncPreviewConnection ? "in progress" : "ready",
      detail: "Rehearse a provider flow before trusting live cadence.",
      onClick: () => scrollToSection(syncPlanSectionRef),
      title: "Sync plan",
    },
    {
      badge: safeMarketPreferences.watchlist.length
        ? `${safeMarketPreferences.watchlist.length} tracked`
        : "set once",
      detail: "Tune market refresh behavior and saved watch preferences.",
      onClick: () => {
        document
          .getElementById("settings-market-controls")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      title: "Market controls",
    },
  ];
  type SettingsPriorityAction =
    | "connected-sources"
    | "import-history"
    | "sync-plan"
    | "safety-export"
    | "restore"
    | "reset"
    | "market-controls";
  const settingsPriorityQueue = [
    {
      title:
        operationsSummary.attentionCount > 0
          ? `Fix ${operationsSummary.attentionCount} source issue${operationsSummary.attentionCount === 1 ? "" : "s"} first`
          : "Review connector lanes",
      detail:
        operationsSummary.attentionCount > 0
          ? "Source instability comes before growth. Clean the feed pressure before trusting deeper portfolio or market reads."
          : "When the lanes are steady, this section is the best place to confirm what is active, healthy, and due next.",
      action: operationsSummary.attentionCount > 0
        ? ("import-history" as SettingsPriorityAction)
        : ("connected-sources" as SettingsPriorityAction),
    },
    {
      title:
        importJobSummary.openCount > 0
          ? `Clear ${importJobSummary.openCount} open review${importJobSummary.openCount === 1 ? "" : "s"}`
          : "Rehearse the next provider flow",
      detail:
        importJobSummary.openCount > 0
          ? "An open review queue is a stronger warning than a missing connector. Finish staged decisions before expanding setup."
          : "If the queue is clear, use rehearsal to pressure-test the next source before you let it touch the workspace.",
      action: importJobSummary.openCount > 0
        ? ("import-history" as SettingsPriorityAction)
        : ("sync-plan" as SettingsPriorityAction),
    },
    {
      title: "Freeze a safety checkpoint",
      detail:
        "Before resets, bulk imports, or workflow experiments, save one clean checkpoint so recovery stays boring and fast.",
      action: "safety-export" as SettingsPriorityAction,
    },
    {
      title: userEmail ? "Tune market controls" : "Check restore and reset tools",
      detail: userEmail
        ? "Once feeds and reviews are in range, the next calm move is to tighten watch preferences and saved market behavior."
        : "In local mode, restore and reset controls are the main recovery rail if a test run goes sideways.",
      action: userEmail
        ? ("market-controls" as SettingsPriorityAction)
        : ("restore" as SettingsPriorityAction),
    },
  ];
  const settingsStatusCards = [
    {
      detail:
        operationsSummary.attentionCount > 0
          ? `${operationsSummary.attentionCount} source${operationsSummary.attentionCount === 1 ? "" : "s"} need a fix or manual intervention.`
          : "No source is currently blocked by an error or attention state.",
      label: "Attention pressure",
      toneClassName:
        operationsSummary.attentionCount > 0
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-emerald-500/30 bg-emerald-500/10",
      value: operationsSummary.attentionCount > 0 ? "Needs review" : "In range",
    },
    {
      detail:
        importJobSummary.openCount > 0
          ? `${importJobSummary.openCount} import review${importJobSummary.openCount === 1 ? "" : "s"} are waiting for a decision.`
          : "Nothing is staged right now, so the import lane is clear.",
      label: "Import pressure",
      toneClassName:
        importJobSummary.openCount > 0
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-emerald-500/30 bg-emerald-500/10",
      value: importJobSummary.openCount > 0 ? "Queue open" : "Clear",
    },
    {
      detail: `Next scheduled connector check ${formatSyncTimeLabel(schedulerPlan.nextRunAt)} across ${schedulerPlan.activeCount} active source${schedulerPlan.activeCount === 1 ? "" : "s"}.`,
      label: "Cadence health",
      toneClassName: "border-border bg-background",
      value: schedulerPlan.dueCount > 0 ? `${schedulerPlan.dueCount} due now` : "On cadence",
    },
    {
      detail:
        userEmail && isSupabaseConfigured()
          ? "Signed-in cloud sync is available for account-backed connectors and saved history."
          : "The browser copy is available now, and cloud mode unlocks saved history plus connector-backed workflows.",
      label: "Workspace mode",
      toneClassName: userEmail
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-border bg-background",
      value: userEmail ? "Cloud ready" : "Local only",
    },
  ];
  const settingsVerdictLabel =
    operationsSummary.attentionCount > 0
      ? "The workspace is usable, but source trust matters more than adding anything new right now."
      : importJobSummary.openCount > 0
        ? "Your setup is healthy enough to work, but the review queue should close before the connector surface expands."
        : operationsSummary.activeCount > 0
          ? "The control center is in a good operating state, so the next gains come from calmer cadence and cleaner habits."
          : "The setup is still early, so one dependable feed is worth more than a broad connector footprint.";
  const settingsVerdictToneClass =
    operationsSummary.attentionCount > 0
      ? "border-amber-500/30 bg-amber-500/10"
      : importJobSummary.openCount > 0
        ? "border-sky-500/30 bg-sky-500/10"
        : operationsSummary.activeCount > 0
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border/70 bg-muted/20";
  const settingsVerdictBadgeVariant =
    operationsSummary.attentionCount > 0 || importJobSummary.openCount > 0 ? "outline" : "secondary";
  const settingsVerdictDetail =
    operationsSummary.attentionCount > 0
      ? "A connector that keeps asking for manual rescue usually deserves attention before any new live lane gets added."
      : importJobSummary.openCount > 0
        ? "Open reviews are still unfinished decisions. Closing them keeps the portfolio, journal, and sync plan trustworthy."
        : operationsSummary.activeCount > 0
          ? "This is the point where boring process wins: steady cadence, clean reviews, and fresh checkpoints."
          : "The shortest path to a dependable workspace is one feed, one proof cycle, and one clean export.";
  const connectorLaneMix = useMemo(
    () => ({
      brokerConnectedCount: brokerConnections.filter(
        (connection) => connection.status === "connected",
      ).length,
      inboxConnectedCount: inboxConnections.filter(
        (connection) => connection.status === "connected",
      ).length,
      manualLaneCount: integrations.filter(
        (integration) => integration.importStrategy !== "sync-ready",
      ).length,
      autoLaneCount: integrations.filter(
        (integration) => integration.importStrategy === "sync-ready",
      ).length,
    }),
    [brokerConnections, inboxConnections, integrations],
  );
  const connectorSuggestedLane = userEmail
    ? connectorLaneMix.brokerConnectedCount === 0
      ? "Start with a broker or inbox lane so the first live proof can land quickly."
      : importJobSummary.openCount > 0
        ? "Work the open review queue before adding another live connector."
        : "Your signed-in lanes are ready. Add only the next source that removes real manual work."
    : "Start with a manual statement rehearsal first, then unlock inbox and broker lanes after sign-in.";
  const exportPreviewStats = useMemo(
    () => ({
      charCount: exportedSnapshot.length,
      lineCount: exportedSnapshot.split("\n").length,
      watchlistCount: safeMarketPreferences.watchlist.length,
    }),
    [exportedSnapshot, safeMarketPreferences.watchlist.length],
  );
  const connectorVerdictLabel =
    importJobSummary.openCount > 0
      ? "The connector stack should pause here until the review queue is cleaner."
      : operationsSummary.attentionCount > 0
        ? "Your lanes exist, but one unstable source is stronger signal than another successful connection."
        : connectorLaneMix.autoLaneCount > 0
          ? "The connector setup is mature enough to favor cadence and proof over expansion."
          : "You are still proving the first lanes, so review quality matters more than total coverage.";
  const connectorVerdictToneClass =
    importJobSummary.openCount > 0 || operationsSummary.attentionCount > 0
      ? "border-amber-500/30 bg-amber-500/10"
      : connectorLaneMix.autoLaneCount > 0
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-border/70 bg-muted/20";
  const connectorVerdictBadgeVariant =
    importJobSummary.openCount > 0 || operationsSummary.attentionCount > 0 ? "outline" : "secondary";
  const connectorVerdictDetail =
    importJobSummary.openCount > 0
      ? "Until staged imports are resolved, every extra connector increases noise faster than it increases confidence."
      : operationsSummary.attentionCount > 0
        ? "Use the active lanes as evidence. Fix the one that needs help before trusting a wider sync perimeter."
        : connectorLaneMix.autoLaneCount > 0
          ? "A boring connector stack is a strong one. Once proof is in place, the next useful move is usually maintenance."
          : "One rehearsed lane with a clean first import beats several half-trusted connectors.";
  const controlsVerdictLabel =
    safeMarketPreferences.watchlist.length === 0
      ? "The controls are functional, but the market layer is still too generic until the watchlist reflects real sectors."
      : marketPreferences.preferredSource === "alpha-vantage" && marketPreferences.autoRefresh
        ? "This is the liveliest market posture, so only keep it if fresh motion genuinely helps decisions."
        : "The controls are in a calm, trustworthy posture that fits demos and repeat review sessions well.";
  const controlsVerdictToneClass =
    safeMarketPreferences.watchlist.length === 0
      ? "border-amber-500/30 bg-amber-500/10"
      : marketPreferences.preferredSource === "alpha-vantage" && marketPreferences.autoRefresh
        ? "border-sky-500/30 bg-sky-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";
  const controlsVerdictBadgeVariant =
    safeMarketPreferences.watchlist.length === 0 ? "outline" : "secondary";
  const controlsVerdictDetail =
    safeMarketPreferences.watchlist.length === 0
      ? "A saved watchlist turns the market page from a broad scan into a repeatable lens."
      : marketPreferences.preferredSource === "alpha-vantage" && marketPreferences.autoRefresh
        ? "Live polling is only a win when the feed is configured well enough that movement feels informative rather than distracting."
        : "Slower or fallback market posture is usually the easiest one to trust during planning, review, and walkthroughs.";
  const settingsOperatingLenses = [
    {
      label: "Source posture",
      value:
        operationsSummary.activeCount > 0
          ? `${operationsSummary.activeCount} active`
          : "Setup first",
      detail:
        operationsSummary.activeCount > 0
          ? "Enough live lanes exist to focus on review quality, not just setup."
          : "Add one dependable source before widening the connector surface.",
    },
    {
      label: "Review load",
      value:
        importJobSummary.openCount > 0
          ? `${importJobSummary.openCount} open`
          : "Clear",
      detail:
        importJobSummary.openCount > 0
          ? "Open staged imports deserve decisions before more data is added."
          : "The review lane is clean enough to add the next source carefully.",
    },
    {
      label: "Backup confidence",
      value: userEmail ? "Cloud + local" : "Local first",
      detail: userEmail
        ? "Account-backed sync is available, but exports still matter before risky changes."
        : "Browser storage is workable, but exports are your safety net.",
    },
  ];
  const settingsWorkingOrder = [
    "Connect one dependable lane before adding more automation.",
    "Review and stage the first output carefully before letting cadence take over.",
    "Export a clean checkpoint before resets, connector changes, or bigger imports.",
  ];
  type ConnectorPriorityAction =
    | "broker"
    | "inbox"
    | "import-history"
    | "sync-plan";
  const connectorPriorityQueue = [
    {
      title:
        operationsSummary.attentionCount > 0
          ? `Resolve ${operationsSummary.attentionCount} attention item${operationsSummary.attentionCount === 1 ? "" : "s"}`
          : "Review connected sources",
      detail:
        operationsSummary.attentionCount > 0
          ? "Fix or inspect unstable lanes before adding any new source, otherwise trust in downstream reads drops fast."
          : "Use the connected source view to check which lanes are healthy, due, or waiting on first proof.",
      action: "import-history" as ConnectorPriorityAction,
    },
    {
      title:
        importJobSummary.openCount > 0
          ? `Work ${importJobSummary.openCount} open import review${importJobSummary.openCount === 1 ? "" : "s"}`
          : "Rehearse one source workflow",
      detail:
        importJobSummary.openCount > 0
          ? "A clean review queue matters more than another connector badge. Finish staged reviews before you widen the setup."
          : "If nothing is waiting in review, run one proof cycle end to end so the next lane starts from a reliable pattern.",
      action: importJobSummary.openCount > 0 ? "import-history" : "sync-plan",
    },
    {
      title: userEmail ? "Open a live-source lane" : "Start with manual rehearsal",
      detail: userEmail
        ? "Broker and inbox lanes are available. Choose the one that removes the most repeated manual effort first."
        : "Stay with the statement rehearsal path until the first reviewed import feels dependable, then add account-backed lanes.",
      action: userEmail ? "broker" : "sync-plan",
    },
    {
      title:
        connectorLaneMix.inboxConnectedCount > 0
          ? "Inspect inbox automation"
          : "Set up an inbox lane next",
      detail:
        connectorLaneMix.inboxConnectedCount > 0
          ? "Use inbox workflows when statements already arrive naturally and you want less chasing."
          : "Inbox lanes are best once one manual or broker lane already has a clean review rhythm.",
      action: "inbox" as ConnectorPriorityAction,
    },
  ];

  async function handleCopySnapshot() {
    if (!navigator.clipboard) {
      setActionMessage("Clipboard is unavailable in this browser.");
      return;
    }

    await navigator.clipboard.writeText(exportedSnapshot);
    setActionMessage("Workspace JSON copied.");
  }

  function handleDownloadSnapshot() {
    const blob = new Blob([exportedSnapshot], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wealthcompass-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setActionMessage("Downloaded wealthcompass-data.json.");
  }

  function handleResetPortfolio() {
    onResetPortfolio();
    setActionMessage(
      userEmail
        ? "Tracked portfolio data cleared for this signed-in workspace."
        : "Portfolio restored to demo holdings.",
    );
  }

  function handleRestoreDemoWorkspace() {
    onRestoreDemoWorkspace();
    setActionMessage(userEmail ? "Signed-in workspace cleared." : "Demo workspace restored.");
  }

  function handleImportWorkspace() {
    const result = parseWorkspaceImport(importJson);

    if (!result.data) {
      setActionMessage(result.errors.join(" "));
      return;
    }

    onImportWorkspace(result.data);
    setImportJson("");
    setActionMessage("Imported workspace JSON.");
  }

  function handleAddIntegrationClick() {
    if (!draftIntegration.providerName.trim()) {
      setActionMessage("Integration needs a provider name.");
      return;
    }

    onAddIntegration(draftIntegration);
    setDraftIntegration(createConnectionFromTemplate(selectedTemplateId));
    setActionMessage(`${draftIntegration.providerName} source added.`);
  }

  function handleApplyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setDraftIntegration(createConnectionFromTemplate(templateId));

    const template = getConnectorTemplate(templateId);
    if (template) {
      setActionMessage(`${template.providerName} template loaded into the source editor.`);
    }
  }

  function scrollToSection(ref: { current: HTMLDivElement | null }) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const settingsNavigatorOptions = [
    ["settings-connected-sources", "Sources: connected feeds"],
    ["settings-import-history", "History: import reviews"],
    ["settings-sync-plan", "Workflow: sync plan"],
    ["settings-broker", "Setup: broker connectors"],
    ["settings-inbox", "Setup: inbox connectors"],
    ["settings-email-intake", "Setup: email intake"],
    ["settings-market-controls", "Controls: live market"],
    ["settings-export-preview", "Safety: export preview"],
  ] as Array<[string, string]>;
  function handleSettingsNavigatorChange(value: string) {
    setNavigatorValue(value);
    if (value === "settings-connected-sources") {
      scrollToSection(connectedSourcesSectionRef);
      return;
    }
    if (value === "settings-import-history") {
      scrollToSection(importHistorySectionRef);
      return;
    }
    if (value === "settings-sync-plan") {
      scrollToSection(syncPlanSectionRef);
      return;
    }
    if (value === "settings-broker") {
      scrollToSection(brokerSectionRef);
      return;
    }
    if (value === "settings-inbox") {
      scrollToSection(inboxSectionRef);
      return;
    }
    if (value === "settings-email-intake") {
      scrollToSection(emailIntakeSectionRef);
      return;
    }
    document.getElementById(value)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSettingsPriorityAction(action: SettingsPriorityAction) {
    if (action === "market-controls") {
      document
        .getElementById("settings-market-controls")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const focusMap: Record<
      Exclude<SettingsPriorityAction, "market-controls">,
      { current: HTMLDivElement | null }
    > = {
      "connected-sources": connectedSourcesSectionRef,
      "import-history": importHistorySectionRef,
      "reset": resetSectionRef,
      "restore": restoreSectionRef,
      "safety-export": safetyExportSectionRef,
      "sync-plan": syncPlanSectionRef,
    };

    scrollToSection(focusMap[action]);
  }

  function handleConnectorPriorityAction(action: ConnectorPriorityAction) {
    const focusMap: Record<ConnectorPriorityAction, { current: HTMLDivElement | null }> = {
      broker: brokerSectionRef,
      inbox: inboxSectionRef,
      "import-history": importHistorySectionRef,
      "sync-plan": syncPlanSectionRef,
    };

    scrollToSection(focusMap[action]);
  }

  function getAutoOpenActionNotice(
    integration: IntegrationConnection,
    action: IntegrationActionItem,
  ) {
    switch (action.actionId) {
      case "run-connector-now":
        return integration.importStrategy === "sync-ready"
          ? "Started the suggested connector sync for this source."
          : "Opened the sync plan for the suggested next manual review step.";
      case "run-first-check":
        return "Opened the first-run sync plan for this source.";
      case "upload-latest-statement":
      case "import-latest-statement":
      case "upload-fresh-export":
      case "reconcile-holdings":
        return "Opened the sync plan with the suggested source workflow.";
      case "review-import-history":
        return "Opened import history for the latest saved review on this source.";
      case "feed-email-intake":
        return "Prepared the email intake workflow for this source.";
      case "fix-source":
        return "Opened this source in edit mode for review.";
      default:
        return "Opened the next suggested workflow for this source.";
    }
  }

  function buildHighlightedImportNotice(
    job: ImportJob,
    preferredAction?: DataSettingsFocusRequest["importAction"],
  ) {
    const primaryAction = getImportJobPrimaryAction(job);
    const action =
      preferredAction && preferredAction !== "none"
        ? preferredAction
        : primaryAction.actionId;

    if (action === "apply-portfolio") {
      return `Focused the ${job.providerName} review and lined it up for a final apply into the workspace.`;
    }

    if (action === "open-sync-plan") {
      return `Focused the ${job.providerName} review and queued it for a closer pass in the sync plan.`;
    }

    return `Focused the ${job.providerName} review so the next import step is ready from here.`;
  }

  useEffect(() => {
    if (!focusRequest) return;

    const focusMap: Record<DataSettingsFocusSection, { current: HTMLDivElement | null }> = {
      broker: brokerSectionRef,
      "connected-sources": connectedSourcesSectionRef,
      "email-intake": emailIntakeSectionRef,
      "import-history": importHistorySectionRef,
      inbox: inboxSectionRef,
      "sync-plan": syncPlanSectionRef,
    };

    const targetRef = focusMap[focusRequest.section];

    if (!targetRef.current) return;

    if (focusRequest.section === "import-history" && focusRequest.providerName) {
      setJobFilter("all");
      setJobSearch(focusRequest.providerName);
      setHighlightedActivityProviderId(focusRequest.providerId ?? null);
      setHighlightedActivityProviderName(focusRequest.providerName);
      setActionMessage(`${focusRequest.providerName} import history is now in focus.`);

      if (!focusRequest.jobId) {
        const matchedLatestJob = importJobs
          .filter((job) =>
            focusRequest.providerId
              ? job.providerId === focusRequest.providerId
              : job.providerName === focusRequest.providerName,
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

        if (matchedLatestJob) {
          setHighlightedImportJobId(matchedLatestJob.id);
          setHighlightedImportJobNotice(
            buildHighlightedImportNotice(matchedLatestJob, focusRequest.importAction),
          );
          window.setTimeout(() => {
            document.getElementById(`import-job-${matchedLatestJob.id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 120);
        }
      }
    }

    if (focusRequest.section === "broker" && focusRequest.providerId) {
      setHighlightedBrokerProviderId(focusRequest.providerId);
      setHighlightedActivityProviderId(focusRequest.providerId);
      setHighlightedActivityProviderName(focusRequest.providerName ?? "Broker");
      if (focusRequest.providerId === "zerodha") {
        const connection = brokerConnectionMap.get("zerodha");

        if (connection?.status === "connected") {
          setHighlightedBrokerNotice("Running holdings sync for this broker now.");
          void syncBrokerActionRef.current();
        } else {
          setHighlightedBrokerNotice("This broker is ready to reconnect from here.");
          setActionMessage("Zerodha broker connector is in focus and ready to reconnect.");
        }
      }
      window.setTimeout(() => {
        document.getElementById(`broker-connector-${focusRequest.providerId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    }

    if (focusRequest.section === "inbox" && focusRequest.providerId) {
      setHighlightedInboxProviderId(focusRequest.providerId);
      setHighlightedActivityProviderId(focusRequest.providerId);
      setHighlightedActivityProviderName(
        focusRequest.providerName ?? (focusRequest.providerId === "gmail" ? "Gmail" : "Outlook"),
      );
      const provider = focusRequest.providerId as InboxProvider;
      const connection = inboxConnectionMap.get(provider);

      if (connection?.status === "connected") {
        setHighlightedInboxNotice("Running an inbox check for this connector now.");
        void syncInboxActionRef.current(provider);
      } else {
        setHighlightedInboxNotice("This inbox connector is ready for setup from here.");
        setActionMessage(`${focusRequest.providerName ?? (provider === "gmail" ? "Gmail" : "Outlook")} inbox connector is in focus and ready for setup.`);
      }
      window.setTimeout(() => {
        document.getElementById(`inbox-connector-${focusRequest.providerId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    }

    if (focusRequest.section === "connected-sources") {
      const matchedIntegration = integrations.find((integration) =>
        focusRequest.providerId
          ? integration.providerId === focusRequest.providerId
          : focusRequest.providerName
            ? integration.providerName === focusRequest.providerName
            : false,
      );

      if (matchedIntegration) {
        setIntegrationFilter("all");
        setIntegrationSearch(matchedIntegration.providerName);
        setHighlightedIntegrationId(matchedIntegration.id);
        setHighlightedActivityProviderId(matchedIntegration.providerId);
        setHighlightedActivityProviderName(matchedIntegration.providerName);
        const autoOpenActionId = getAutoOpenIntegrationAction(matchedIntegration);
        const autoOpenAction = autoOpenActionId
          ? getIntegrationActionItems(matchedIntegration).find(
              (action) => action.actionId === autoOpenActionId,
            ) ?? null
          : null;

        if (autoOpenAction) {
          setHighlightedIntegrationNotice(
            getAutoOpenActionNotice(matchedIntegration, autoOpenAction),
          );
          void integrationActionRef.current(matchedIntegration, autoOpenAction);
        } else {
          setHighlightedIntegrationNotice("This source is in focus and ready for review.");
        }
        window.setTimeout(() => {
          document.getElementById(`integration-source-${matchedIntegration.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 120);
      }
    }

    if (focusRequest.section === "import-history" && focusRequest.jobId) {
      const matchedJob = importJobs.find((job) => job.id === focusRequest.jobId);
      setHighlightedImportJobId(focusRequest.jobId);
      if (matchedJob?.providerId) {
        setHighlightedActivityProviderId(matchedJob.providerId);
        setHighlightedActivityProviderName(matchedJob.providerName);
      }
      setHighlightedImportJobNotice(
        matchedJob
          ? buildHighlightedImportNotice(matchedJob, focusRequest.importAction)
          : "Focused this import review from the dashboard.",
      );
      if (matchedJob) {
        setActionMessage(`${matchedJob.providerName} import review is now in focus.`);
      }
      window.setTimeout(() => {
        document.getElementById(`import-job-${focusRequest.jobId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    }

    scrollToSection(targetRef);
  }, [
    brokerConnectionMap,
    focusRequestKey,
    focusRequest,
    inboxConnectionMap,
    integrations,
    importJobs,
  ]);

  useEffect(() => {
    if (!highlightedBrokerProviderId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedBrokerProviderId((current) =>
        current === highlightedBrokerProviderId ? null : current,
      );
      setHighlightedBrokerNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedBrokerProviderId]);

  useEffect(() => {
    if (!highlightedInboxProviderId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedInboxProviderId((current) =>
        current === highlightedInboxProviderId ? null : current,
      );
      setHighlightedInboxNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedInboxProviderId]);

  useEffect(() => {
    if (!highlightedIntegrationId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedIntegrationId((current) =>
        current === highlightedIntegrationId ? null : current,
      );
      setHighlightedIntegrationNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedIntegrationId]);

  useEffect(() => {
    if (!highlightedActivityProviderId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedActivityProviderId((current) =>
        current === highlightedActivityProviderId ? null : current,
      );
      setHighlightedActivityProviderName(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedActivityProviderId]);

  useEffect(() => {
    if (!highlightedImportJobId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedImportJobId((current) =>
        current === highlightedImportJobId ? null : current,
      );
      setHighlightedImportJobNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedImportJobId]);

  function handleOpenImportHistoryForProvider(integration: IntegrationConnection) {
    setJobFilter("all");
    setJobSearch(integration.providerName);
    scrollToSection(importHistorySectionRef);
    setActionMessage(`${integration.providerName} import history is now in focus.`);
  }

  function getConnectorActivityActionLabel(sourceType: "broker" | "inbox" | "manual") {
    switch (sourceType) {
      case "broker":
        return "Sync again";
      case "inbox":
        return "Run again";
      case "manual":
      default:
        return "Open source";
    }
  }

  function getConnectorActivitySourceLabel(sourceType: "broker" | "inbox" | "manual") {
    switch (sourceType) {
      case "broker":
        return "Broker";
      case "inbox":
        return "Inbox";
      default:
        return "Manual";
    }
  }

  async function handleConnectorActivityClick(event: {
    providerId: string;
    providerName: string;
    sourceType: "broker" | "inbox" | "manual";
  }) {
    if (event.sourceType === "manual") {
      const integration = integrations.find((item) => item.providerId === event.providerId);

      if (integration) {
        setIntegrationFilter("all");
        setIntegrationSearch(integration.providerName);
        scrollToSection(connectedSourcesSectionRef);
        setActionMessage(`${integration.providerName} source is now in focus.`);
        return;
      }

      scrollToSection(connectedSourcesSectionRef);
      setActionMessage("Connector source list is now in focus.");
      return;
    }

    if (event.sourceType === "inbox") {
      const provider = event.providerId as InboxProvider;
      const connection = inboxConnectionMap.get(provider);

      if (connection?.status === "connected") {
        await handleSyncInbox(provider);
        return;
      }

      scrollToSection(inboxSectionRef);
      setActionMessage(`${event.providerName} inbox connector is ready for review.`);
      return;
    }

    if (event.providerId === "zerodha") {
      const connection = brokerConnectionMap.get("zerodha");

      if (connection?.status === "connected") {
        await handleSyncZerodha();
        return;
      }
    }

    scrollToSection(brokerSectionRef);
    setActionMessage(`${event.providerName} broker connector is ready for review.`);
  }

  async function handleIntegrationActionClick(
    integration: IntegrationConnection,
    action: IntegrationActionItem,
  ) {
    switch (action.actionId) {
      case "fix-source":
        setEditingIntegrationId(integration.id);
        scrollToSection(connectedSourcesSectionRef);
        setActionMessage(`${integration.providerName} opened in edit mode.`);
        return;
      case "connect-live-sync":
        scrollToSection(brokerSectionRef);
        if (integration.providerId === "zerodha") {
          await handleConnectBroker();
        } else {
          await handlePreviewSyncPlan(integration, { prefillSample: true });
        }
        return;
      case "keep-fallback-import":
        handleApplyTemplate("paytm-money");
        scrollToSection(connectedSourcesSectionRef);
        return;
      case "feed-email-intake":
        setEmailSubject(`${integration.providerName} statement attached`);
        setEmailFrom(userEmail || "statements@example.com");
        scrollToSection(emailIntakeSectionRef);
        setActionMessage(`${integration.providerName} email intake is ready for pasted message content.`);
        return;
      case "connect-inbox-access":
        scrollToSection(inboxSectionRef);
        setActionMessage("Inbox connector section is ready for Gmail or Outlook setup.");
        return;
      case "upload-fresh-export":
      case "upload-latest-statement":
      case "import-latest-statement":
      case "reconcile-holdings":
        await handlePreviewSyncPlan(integration, { prefillSample: true });
        scrollToSection(syncPlanSectionRef);
        return;
      case "review-import-history":
        handleOpenImportHistoryForProvider(integration);
        return;
      case "run-connector-now":
        if (integration.importStrategy === "sync-ready") {
          onRunIntegrationSync(integration.id);
          setActionMessage(`${integration.providerName} sync started.`);
        } else {
          await handlePreviewSyncPlan(integration, { prefillSample: true });
          setActionMessage(`${integration.providerName} sync plan opened for the next manual import step.`);
        }
        scrollToSection(syncPlanSectionRef);
        return;
      case "run-first-check":
        await handlePreviewSyncPlan(integration, { prefillSample: true });
        scrollToSection(syncPlanSectionRef);
        setActionMessage(`${integration.providerName} first-run plan opened.`);
        return;
      default:
        return;
    }
  }

  async function handlePreviewSyncPlan(
    connection: IntegrationConnection,
    options?: {
      fileName?: string;
      prefillSample?: boolean;
      sourceText?: string;
    },
  ) {
    const shouldPrefillSample = options?.prefillSample ?? false;
    let requestInput = {
      fileName: options?.fileName ?? (syncInputFileName.trim() || undefined),
      sourceText: options?.sourceText ?? (syncInputText.trim() || undefined),
    };

    if (shouldPrefillSample && !requestInput.sourceText) {
      const sample = getConnectorSampleInput(connection);
      setSyncInputFileName(sample.fileName);
      setSyncInputText(sample.sourceText);
      requestInput = {
        fileName: sample.fileName,
        sourceText: sample.sourceText,
      };
    }

    try {
      const response = await fetch("/api/integration-sync", {
        body: JSON.stringify({
          connection,
          input: requestInput,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sync preview route unavailable.");
      }

      const data = (await response.json()) as {
        execution: ProviderSyncExecutionResult;
        preview: ProviderSyncPreview;
      };
      setSyncExecution(data.execution);
      setSyncPreview(data.preview);
      setSyncPreviewConnection(connection);
      setSyncPreviewProviderId(connection.id);
      setActionMessage(
        shouldPrefillSample
          ? `${connection.providerName} sync plan loaded with provider sample input.`
          : `${connection.providerName} sync plan loaded.`,
      );
    } catch {
      setSyncExecution(null);
      setSyncPreview(null);
      setSyncPreviewConnection(null);
      setSyncPreviewProviderId(null);
      setActionMessage("Could not load the sync plan right now.");
    }
  }

  function handleStageSyncPlanImport() {
    if (!syncPreviewConnection || !syncExecution) {
      setActionMessage("Open a sync plan first so we have something to stage.");
      return;
    }

    const syncInput = {
      fileName: syncInputFileName.trim() || undefined,
      sourceText: syncInputText.trim() || undefined,
    };
    const job = createImportJobFromSyncExecution(
      syncPreviewConnection,
      syncInput,
    );
    const stagedJob = {
      ...job,
      notes: `Sync plan staged for review. ${job.notes}`.trim(),
      summary: `Sync plan staged for ${syncPreviewConnection.providerName}.`,
    };
    const nextConnection = recordManualIntegrationReview(
      syncPreviewConnection,
      syncExecution,
      { outcome: "staged" },
    );

    onLogImportJob(stagedJob);
    onUpdateIntegration(syncPreviewConnection.id, nextConnection);
    setSyncPreviewConnection(nextConnection);
    setActionMessage(
      `${syncPreviewConnection.providerName} review staged in import history for the next pass.`,
    );
  }

  function handleApplySyncPlanToPortfolio() {
    if (!syncPreviewConnection || !syncExecution) {
      setActionMessage("Open a sync plan first so we have reviewed import data to apply.");
      return;
    }

    const result = applySyncExecutionToPortfolio(
      syncPreviewConnection,
      assets,
      transactions,
      {
        fileName: syncInputFileName.trim() || undefined,
        sourceText: syncInputText.trim() || undefined,
      },
      "merge",
    );

    if (!result) {
      setActionMessage("This sync plan does not have parsed holdings or transactions ready to apply yet.");
      return;
    }

    onImportBrokerAssets(result.nextAssets, result.importJob, result.nextTransactions);
    const nextConnection = recordManualIntegrationReview(
      syncPreviewConnection,
      syncExecution,
      { outcome: "applied" },
    );
    onUpdateIntegration(syncPreviewConnection.id, nextConnection);
    setSyncPreviewConnection(nextConnection);
    setActionMessage(buildSyncPlanApplyMessage(syncPreviewConnection.providerName, result));
  }

  async function handleUseEmailResultInSyncPlan(result: EmailIngestionResult) {
    const seed = buildSyncPlanSeedFromEmailResult({
      integrations,
      result,
    });

    setSelectedTemplateId(seed.templateId);
    setDraftIntegration(createConnectionFromTemplate(seed.templateId));
    setSyncInputFileName(seed.fileName);
    setSyncInputText(seed.sourceText);

    await handlePreviewSyncPlan(seed.connection, {
      fileName: seed.fileName,
      sourceText: seed.sourceText,
    });

    scrollToSection(syncPlanSectionRef);
  }

  async function handleUseImportJobInSyncPlan(job: ImportJob) {
    const seed = buildSyncPlanSeedFromImportJob({
      integrations,
      job,
    });

    if (!seed) {
      setActionMessage("This import job does not have saved source text to reopen in the sync plan.");
      return;
    }

    setSelectedTemplateId(seed.templateId);
    setDraftIntegration(createConnectionFromTemplate(seed.templateId));
    setSyncInputFileName(seed.fileName);
    setSyncInputText(seed.sourceText);

    await handlePreviewSyncPlan(seed.connection, {
      fileName: seed.fileName,
      sourceText: seed.sourceText,
    });

    scrollToSection(syncPlanSectionRef);
    setActionMessage(`${job.providerName} import reopened in the sync plan.`);
  }

  function handleApplyImportJobToPortfolio(job: ImportJob) {
    const result = applyImportJobToPortfolio({
      existingAssets: assets,
      existingTransactions: transactions,
      job,
    });

    if (!result) {
      setActionMessage("This import job does not have saved holdings or transactions ready to apply.");
      return;
    }

    onImportBrokerAssets(result.nextAssets, result.importJob, result.nextTransactions);
    setHighlightedImportJobId(job.id);
    setHighlightedActivityProviderId(job.providerId ?? null);
    setHighlightedActivityProviderName(job.providerName);
    setHighlightedImportJobNotice(
      result.appliedAssetCount > 0 && result.appliedTransactionCount > 0
        ? `Applied this ${job.providerName} review into holdings and transactions.`
        : result.appliedAssetCount > 0
          ? `Applied this ${job.providerName} review into tracked holdings.`
          : `Applied this ${job.providerName} review into the transaction journal.`,
    );
    setActionMessage(describeImportHistoryApplyResult(result));
  }

  async function handleIngestEmail() {
    try {
      const supabase = getSupabaseBrowserClient();
      const sessionResult = supabase ? await supabase.auth.getSession() : null;
      const accessToken = sessionResult?.data.session?.access_token;
      const response = await fetch("/api/email-ingest", {
        body: JSON.stringify({
          attachments: emailAttachmentText.trim()
            ? [
                {
                  contentType: emailAttachmentContentType,
                  extractedText: emailAttachmentText,
                  extractionWarnings: buildEmailAttachmentWarnings({
                    contentType: emailAttachmentContentType,
                    pageCount: emailAttachmentPageCount,
                    usedOcr: emailAttachmentOcrMode === "used",
                  }),
                  fileName: emailAttachmentFileName.trim() || "statement-attachment.txt",
                  pageCount: emailAttachmentPageCount,
                  usedOcr: emailAttachmentOcrMode === "used",
                },
              ]
            : [],
          bodyText: emailBodyText,
          from: emailFrom.trim() || "statements@example.com",
          subject: emailSubject.trim() || "Forwarded statement",
        }),
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Email intake route unavailable.");
      }

      const data = (await response.json()) as EmailIngestionApiResponse;
      const result: EmailIngestionResult = data.result;
      setEmailIntakeResult(result);
      onLogImportJob(result.job);
      setActionMessage(
        data.persistedToCloud
          ? `Email intake captured through ${result.sourceType} input and saved to cloud history.`
          : data.persistenceMessage ?? `Email intake captured through ${result.sourceType} input.`,
      );
    } catch {
      setEmailIntakeResult(null);
      setActionMessage("Could not ingest the email payload right now.");
    }
  }

  useEffect(() => {
    void loadInboxConnections();
  }, [userEmail]);

  async function loadInboxConnections() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setInboxConnections([]);
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setInboxConnections([]);
      return;
    }

    setIsInboxLoading(true);

    try {
      const response = await fetch("/api/inbox/connections", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Could not load inbox connections.");
      }

      const data = (await response.json()) as {
        connections: InboxConnection[];
      };
      setInboxConnections(data.connections ?? []);
    } catch {
      setInboxConnections([]);
    } finally {
      setIsInboxLoading(false);
    }
  }

  async function handleConnectInbox(provider: InboxProvider) {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setActionMessage("Add Supabase configuration before starting inbox OAuth.");
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setActionMessage("Sign in first to connect Gmail or Outlook.");
      return;
    }

    try {
      const response = await fetch("/api/inbox/connect", {
        body: JSON.stringify({
          provider,
          returnPath: "/auth",
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Inbox OAuth could not be started.");
      }

      const data = (await response.json()) as {
        authUrl?: string;
        status?: string;
      };

      if (data.status === "needs_configuration") {
        setActionMessage(`${provider === "gmail" ? "Gmail" : "Outlook"} OAuth environment variables are not configured yet.`);
        return;
      }

      if (!data.authUrl) {
        throw new Error("Inbox OAuth did not return an authorization URL.");
      }

      window.location.href = data.authUrl;
    } catch {
      setActionMessage("Could not start the inbox connection flow right now.");
    }
  }

  async function handleSyncInbox(provider: InboxProvider) {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setActionMessage("Add Supabase configuration before running inbox sync.");
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setActionMessage("Sign in first to run inbox connector checks.");
      return;
    }

    try {
      const response = await fetch(`/api/inbox/sync/${provider}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Inbox sync route unavailable.");
      }

      const data = (await response.json()) as {
        fetchedMessageCount: number;
        job: ImportJob | null;
        result: EmailIngestionResult | null;
        summary: string;
      };

      if (data.result) {
        setEmailIntakeResult(data.result);
        onLogImportJob(data.result.job);
        setActionMessage(
          `${provider === "gmail" ? "Gmail" : "Outlook"} checked ${data.fetchedMessageCount} recent message${data.fetchedMessageCount === 1 ? "" : "s"} and staged ${data.result.job.providerName} for review.`,
        );
      } else {
        setActionMessage(
          `${provider === "gmail" ? "Gmail" : "Outlook"} checked ${data.fetchedMessageCount} recent message${data.fetchedMessageCount === 1 ? "" : "s"}. ${data.summary}`,
        );
      }

      await loadInboxConnections();
    } catch {
      setActionMessage("Could not run the inbox connector check right now.");
    }
  }

  useEffect(() => {
    void loadBrokerConnections();
  }, [userEmail]);

  async function loadBrokerConnections() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setBrokerConnections([]);
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setBrokerConnections([]);
      return;
    }

    setIsBrokerLoading(true);

    try {
      const response = await fetch("/api/broker/connections", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Could not load broker connections.");
      }

      const data = (await response.json()) as {
        connections: BrokerConnection[];
      };
      setBrokerConnections(data.connections ?? []);
    } catch {
      setBrokerConnections([]);
    } finally {
      setIsBrokerLoading(false);
    }
  }

  async function handleConnectBroker() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setActionMessage("Add Supabase configuration before starting broker OAuth.");
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setActionMessage("Sign in first to connect Zerodha.");
      return;
    }

    try {
      const response = await fetch("/api/broker/connect", {
        body: JSON.stringify({
          provider: "zerodha",
          returnPath: "/auth",
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Broker OAuth could not be started.");
      }

      const data = (await response.json()) as {
        authUrl?: string;
        status?: string;
      };

      if (data.status === "needs_configuration") {
        setActionMessage("Kite Connect environment variables are not configured yet.");
        return;
      }

      if (!data.authUrl) {
        throw new Error("Broker OAuth did not return an authorization URL.");
      }

      window.location.href = data.authUrl;
    } catch {
      setActionMessage("Could not start the Zerodha connection flow right now.");
    }
  }

  async function handleSyncZerodha() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setActionMessage("Add Supabase configuration before running broker sync.");
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      setActionMessage("Sign in first to sync broker holdings.");
      return;
    }

    try {
      const response = await fetch("/api/broker/sync/zerodha", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Broker sync route unavailable.");
      }

      const data = (await response.json()) as {
        assets: PortfolioAsset[];
        job: ImportJob;
        providerAccountLabel: string;
      };

      onImportBrokerAssets(data.assets, data.job);
      await loadBrokerConnections();
      setActionMessage(`Synced ${data.assets.length} holding${data.assets.length === 1 ? "" : "s"} from ${data.providerAccountLabel}.`);
    } catch {
      setActionMessage("Could not sync Zerodha holdings right now.");
    }
  }

  useEffect(() => {
    syncInboxActionRef.current = handleSyncInbox;
    syncBrokerActionRef.current = handleSyncZerodha;
    integrationActionRef.current = handleIntegrationActionClick;
  });

  return (
    <div className="settings-page grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Card id="settings-market-controls" className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <CardTitle>Data control center</CardTitle>
          <CardDescription>
            Connect feeds, review imports, and keep the workspace ready for everyday tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="wealth-muted-block grid gap-4 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{syncStatus}</Badge>
              <Badge variant="outline">{userEmail || "Browser workspace"}</Badge>
              {settingsTrack ? <Badge variant="outline">{settingsTrack.title}</Badge> : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    {settingsHeadline}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{settingsDetail}</p>
                </div>
                <div className="grid gap-3">
                  {settingsSteps.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.title} className="wealth-inset p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">{item.title}</p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="wealth-inset p-4">
                  <p className="text-sm font-medium">Best next move</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {settingsTrack?.items[0] ??
                      "Add one dependable source, then use import review to keep the portfolio clean."}
                  </p>
                </div>
                <div className="wealth-inset p-4">
                  <p className="text-sm font-medium">Pipeline read</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {operationsSummary.attentionCount > 0
                      ? `${operationsSummary.attentionCount} source${operationsSummary.attentionCount === 1 ? "" : "s"} need attention, ${importJobSummary.openCount} import review${importJobSummary.openCount === 1 ? "" : "s"} are open, and the next scheduled check is ${formatSyncTimeLabel(schedulerPlan.nextRunAt)}.`
                      : `Nothing urgent is blocking the pipeline. ${operationsSummary.activeCount} active source${operationsSummary.activeCount === 1 ? "" : "s"} are on cadence, and the next scheduled check is ${formatSyncTimeLabel(schedulerPlan.nextRunAt)}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
            <div className="wealth-inset p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Use this lane for
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Connecting feeds, reviewing staged imports, protecting the workspace, and keeping sync behavior understandable.
              </p>
            </div>
            <div className="wealth-inset p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Watch closely
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                A connected source is only useful if the review lane stays clean. Bad automation is just faster confusion.
              </p>
            </div>
            <div className="wealth-inset p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Read this with
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Add one dependable source, rehearse it once, review the first output carefully, then let cadence take over.
              </p>
            </div>
          </div>
          <div className={`rounded-md border p-4 ${settingsVerdictToneClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Settings verdict</p>
              <Badge variant={settingsVerdictBadgeVariant}>{syncStatus}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground">{settingsVerdictLabel}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{settingsVerdictDetail}</p>
          </div>

          <div className="wealth-muted-block grid gap-3 p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Control tower</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use the current posture first, then jump straight into the lane that needs action.
                </p>
              </div>
              <Badge variant="outline">Settings navigator</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {settingsPriorityQueue.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleSettingsPriorityAction(item.action)}
                  className="wealth-data-card p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Next move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {settingsStatusCards.map((item) => (
                  <div key={item.label} className={`rounded-md border p-3 ${item.toneClassName}`}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                {settingsSectionLinks.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                    className="rounded-md border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge variant="outline">{item.badge}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3 md:grid-cols-3">
              {settingsOperatingLenses.map((lens) => (
                <div
                  key={lens.label}
                  className="rounded-md border border-border/70 bg-background p-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {lens.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{lens.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{lens.detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reading order
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                {settingsWorkingOrder.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="wealth-muted-block grid gap-3 p-4">
            <div>
              <p className="text-sm font-medium">MVP setup checklist</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This is the shortest path from a fresh workspace to a dependable working setup.
              </p>
            </div>
            <div className="grid gap-3">
              {setupChecklist.map((item) => (
                  <div key={item.label} className="wealth-inset p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    <Badge variant={item.done ? "secondary" : "outline"}>
                      {item.done ? "Ready" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="wealth-muted-block p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Sync status</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{syncStatus}</Badge>
              <Badge variant="outline">{userEmail || "Browser workspace"}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{syncMessage}</p>
          </div>

          <div ref={safetyExportSectionRef} className="wealth-muted-block grid gap-3 p-4">
            <div>
              <p className="text-sm font-medium">Safety export</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Save a full checkpoint of the working state before risky imports, resets, or major edits.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Best use</p>
                <p className="mt-1 text-sm font-medium">Freeze a clean checkpoint</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Export before major imports, demo walkthroughs, or allocation experiments.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">What it saves</p>
                <p className="mt-1 text-sm font-medium">Portfolio plus learning state</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The file captures not just holdings, but risk context, goals, and workflow history too.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Recovery habit</p>
                <p className="mt-1 text-sm font-medium">Keep one stable demo copy</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  A clean export makes it easy to recover from rough test imports without losing momentum.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleCopySnapshot}>
                <Copy className="h-4 w-4" />
                Copy checkpoint
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadSnapshot}>
                <Download className="h-4 w-4" />
                Download checkpoint
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{actionMessage}</p>
          </div>

          <div ref={restoreSectionRef} className="wealth-muted-block grid gap-3 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Restore from checkpoint</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paste a saved `wealthcompass-data.json` file here to restore the full workspace state.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleImportWorkspace}>
                <Upload className="h-4 w-4" />
                Restore checkpoint
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Use this when</p>
                <p className="mt-1 text-sm font-medium">You want a full restore</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Imports replace the current working posture more broadly than a single portfolio upload.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Check before restore</p>
                <p className="mt-1 text-sm font-medium">Source and recency</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Confirm the file belongs to the right investor profile and includes the latest goal state.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Safest sequence</p>
                <p className="mt-1 text-sm font-medium">Export before restoring</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  That gives you an immediate rollback point if you only meant to compare states.
                </p>
              </div>
            </div>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="{ saved checkpoint JSON }"
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
            />
          </div>

          <div ref={resetSectionRef} className="wealth-muted-block grid gap-3 p-4">
            <div>
              <p className="text-sm font-medium">Reset and restore</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Use resets to recover quickly during walkthroughs, test imports, and cleanup passes.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Portfolio reset</p>
                <p className="mt-1 text-sm font-medium">Narrow cleanup</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use this when imports or manual edits need a quick holdings-only reset.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Demo workspace reset</p>
                <p className="mt-1 text-sm font-medium">Full workspace restore</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This is the fastest path back to a polished walkthrough state across pages.
                </p>
              </div>
              <div className="wealth-inset p-3">
                <p className="text-xs text-muted-foreground">Safety rule</p>
                <p className="mt-1 text-sm font-medium">Snapshot first</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Reset actions are safest when paired with a fresh export you can restore in seconds.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleResetPortfolio}>
                <RotateCcw className="h-4 w-4" />
                Reset portfolio
              </Button>
              <Button type="button" variant="secondary" onClick={handleRestoreDemoWorkspace}>
                <RotateCcw className="h-4 w-4" />
                Restore workspace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PageNavigatorBar
        label="Settings navigator"
        options={settingsNavigatorOptions}
        value={navigatorValue}
        onChange={handleSettingsNavigatorChange}
      />

      <div className="grid gap-5">
          <Card id="settings-export-preview" className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>Safety: workspace snapshot</CardTitle>
            <CardDescription>
              A quick read on what is already saved, tracked, and ready to move with the account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <MetricMini label="Portfolio holdings" value={`${assets.length}`} />
            <MetricMini label="Transactions" value={`${transactions.length}`} />
            <MetricMini label="Risk snapshots" value={`${riskHistory.length}`} />
            <MetricMini label="Goals" value={`${goals.length}`} />
            <MetricMini label="Risk score" value={`${profile.score}/100`} />
            <MetricMini label="Integrations" value={`${integrations.length}`} />
            <MetricMini label="Import jobs" value={`${importJobs.length}`} />
            <MetricMini label="Active syncs" value={`${integrationHealthSummary.activeCount}`} />
            <MetricMini label="Avg sync success" value={`${integrationHealthSummary.averageSuccessRate}%`} />
            <MetricMini label="Sync runs" value={`${integrationHealthSummary.totalRuns}`} />
            <MetricMini label="Warning streaks" value={`${integrationHealthSummary.warningConnections}`} />
          </CardContent>
        </Card>

        <Card className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>Workflow: pipeline pulse</CardTitle>
            <CardDescription>
              See which feeds are healthy, which ones are due, and which imports still need review before they change the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricMini label="Active sources" value={`${operationsSummary.activeCount}`} />
              <MetricMini label="Auto syncs" value={`${operationsSummary.autoCount}`} />
              <MetricMini label="Manual sources" value={`${operationsSummary.manualCount}`} />
              <MetricMini label="Due now" value={`${operationsSummary.dueNowCount}`} />
              <MetricMini label="Need attention" value={`${operationsSummary.attentionCount}`} />
              <MetricMini label="Open imports" value={`${importJobSummary.openCount}`} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="wealth-muted-block p-4">
                <p className="text-sm font-medium">Connector queue</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Next scheduled activity {formatSyncTimeLabel(schedulerPlan.nextRunAt)} with {schedulerPlan.readyCount} source{schedulerPlan.readyCount === 1 ? "" : "s"} waiting on a first check and {schedulerPlan.pausedCount} paused.
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <p className="text-sm font-medium">Import queue</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {importJobSummary.completedCount} completed, {importJobSummary.failedCount} failed, and {importJobSummary.ocrCount} OCR-backed import{importJobSummary.ocrCount === 1 ? "" : "s"} recorded so far.
                </p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Needs attention now</p>
              </div>
              {attentionItems.length ? (
                <div className="grid gap-2">
                  {attentionItems.map((item) => (
                    <div key={item.id} className="wealth-muted-block p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{item.providerName}</p>
                        <Badge variant={item.severity === "error" ? "secondary" : "outline"}>
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Nothing urgent right now. Sources are either on cadence or waiting for manual input.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="wealth-panel-strong overflow-hidden">
          <CardHeader>
          <CardTitle>Sources: connected feeds</CardTitle>
            <CardDescription>
              Bring broker, inbox, and statement sources into one review pipeline with clear cadence, proof, and ownership.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className={`rounded-md border p-4 ${connectorVerdictToneClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Connector verdict</p>
                <Badge variant={connectorVerdictBadgeVariant}>
                  {operationsSummary.activeCount} active source{operationsSummary.activeCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{connectorVerdictLabel}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{connectorVerdictDetail}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {connectorPriorityQueue.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleConnectorPriorityAction(item.action)}
                  className="wealth-data-card p-4 text-left transition hover:bg-muted/40"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Next move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </button>
              ))}
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Connector rollout plan</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Treat this like a trading desk setup, not a feature scavenger hunt. One dependable lane with clean review proof beats five half-connected sources.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="wealth-inset p-3">
                  <p className="text-xs text-muted-foreground">Suggested first lane</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {userEmail ? "Live-source path" : "Manual-source path"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {connectorSuggestedLane}
                  </p>
                </div>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Start one lane, prove it, then expand.</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The cleanest connector setup rhythm is: connect a source, run or rehearse it once, review the first output carefully, then let cadence take over only after the review lane looks trustworthy.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => scrollToSection(brokerSectionRef)}>
                  Broker lane
                </Button>
                <Button type="button" variant="outline" onClick={() => scrollToSection(inboxSectionRef)}>
                  Inbox lane
                </Button>
                <Button type="button" variant="outline" onClick={() => scrollToSection(syncPlanSectionRef)}>
                  Rehearse flow
                </Button>
                <Button type="button" variant="outline" onClick={() => scrollToSection(importHistorySectionRef)}>
                  Review queue
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Setup posture
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {operationsSummary.activeCount > 0 ? "Operate existing lanes" : "Build first lane"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {operationsSummary.activeCount > 0
                    ? "You already have enough connector surface to focus on trust, review quality, and cadence discipline."
                    : "The highest-value move is still getting one dependable source through a full reviewed cycle."}
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Review pressure
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {importJobSummary.openCount > 0
                    ? `${importJobSummary.openCount} open review${importJobSummary.openCount === 1 ? "" : "s"}`
                    : "Queue is clear"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {importJobSummary.openCount > 0
                    ? "Open imports should usually be resolved before another connector is added, otherwise trust decays quickly."
                    : "A clear queue is the best time to introduce the next source because you can inspect it with full attention."}
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Scale only when
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectorLaneMix.autoLaneCount > connectorLaneMix.manualLaneCount
                    ? "Cadence is earning trust"
                    : "Manual proof still matters"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {connectorLaneMix.autoLaneCount > connectorLaneMix.manualLaneCount
                    ? "More lanes are already on reliable cadence, so expansion is fine if it removes actual manual friction."
                    : "Do not widen the setup just because a source connected. Promote lanes only after the first proof looks clean."}
                </p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Connector operating order</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Strong connector setups usually follow a boring order on purpose: connect, rehearse, review, then automate. The boring version is the one that keeps imports trustworthy.
                </p>
              </div>
              <div className="grid gap-3">
                {[
                  "Connect the lane that removes the most repeated manual effort.",
                  "Run one proof cycle and inspect the review queue before trusting cadence.",
                  "Add the next lane only after the current one feels boring and dependable.",
                ].map((step, index) => (
                  <div key={step} className="wealth-inset flex items-start gap-3 p-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <p className="text-xs leading-5 text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Broker lanes
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectorLaneMix.brokerConnectedCount} connected
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Best for direct holdings sync and recurring live proof.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Inbox lanes
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectorLaneMix.inboxConnectedCount} connected
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Best for statement emails that naturally arrive without manual chasing.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Manual lanes
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectorLaneMix.manualLaneCount} active
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Good for exported statements, OCR review, and first-pass rehearsals.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Auto lanes
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectorLaneMix.autoLaneCount} active
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use once you trust the first reviewed output and want cadence to take over.
                </p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Start here
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Pick one connector lane first: broker sync, inbox OAuth, or manual statement rehearsal.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Do not assume
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  A connected badge is not the finish line. The first useful proof is a clean reviewed import.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Connect one source, run or rehearse it once, then inspect the review queue before adding another lane.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="wealth-muted-block p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Email-ready intake</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {userEmail
                    ? `Signed in as ${userEmail}. Forwarded statements and attachment text can already feed the portfolio import flow.`
                    : "Sign in later to connect inbox-based workflows. For now, forwarded statement text and attachments can be pasted or uploaded manually."}
                </p>
              </div>
              <div className="wealth-muted-block p-4">
                <div className="flex items-center gap-2">
                  <ScanSearch className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Review before import</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Each imported file can now be analyzed for provider cues, OCR use, and statement quality before holdings are merged.
                </p>
              </div>
            </div>

            <div ref={brokerSectionRef} className="wealth-muted-block grid gap-3 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">Broker API connectors</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Start with Zerodha Kite so live holdings can be synced into the portfolio without manual exports.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadBrokerConnections()}>
                  <Database className="h-4 w-4" />
                  {isBrokerLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Best use</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Live holdings refresh</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use broker APIs when you want direct holdings sync instead of repeated manual exports.
                  </p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Watch closely</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Connection trust</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Reconnect, auth expiry, and failed checks matter more here than formatting cleanup.
                  </p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Best next move</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Connect then sync once</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Treat the first sync as validation. Only trust cadence after you inspect the imported result.
                  </p>
                </div>
              </div>
              {brokerProviderDescriptors.map((provider) => {
                const connection = brokerConnectionMap.get(provider.id);
                const syncHistory = getBrokerSyncHistory(connection);

                return (
                  <div
                    id={`broker-connector-${provider.id}`}
                    key={provider.id}
                    className={`wealth-data-card grid gap-3 p-3 transition-[box-shadow,transform] duration-700 ${highlightedBrokerProviderId === provider.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{provider.name}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                      <Badge variant={connection?.status === "connected" ? "secondary" : "outline"}>
                        {connection?.status ?? "needs_auth"}
                      </Badge>
                    </div>
                    {highlightedBrokerProviderId === provider.id ? (
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs font-medium text-primary">
                          Brought into focus from the dashboard.
                        </p>
                        {highlightedBrokerNotice ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {highlightedBrokerNotice}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <span>Scopes {provider.scopes.length}</span>
                      <span>Account {connection?.accountLabel ?? "not connected"}</span>
                      <span>Last sync {connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : "not yet"}</span>
                      {connection?.errorMessage ? <span>{connection.errorMessage}</span> : null}
                    </div>
                    {syncHistory.length ? (
                      <div className="wealth-stat-tile p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          Recent checks
                        </p>
                        <div className="mt-2 grid gap-2">
                          {syncHistory.slice(0, 2).map((event) => (
                            <div key={event.id} className="grid gap-1 text-[11px] text-muted-foreground">
                              <p>
                                {new Date(event.syncedAt).toLocaleString()} · {event.status} · imports{" "}
                                {event.importedFileCount}
                              </p>
                              <p>{event.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void handleConnectBroker()}>
                        <Database className="h-4 w-4" />
                        {connection?.status === "connected" ? "Reconnect Zerodha" : provider.connectLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={connection?.status !== "connected"}
                        onClick={() => void handleSyncZerodha()}
                      >
                        <Cloud className="h-4 w-4" />
                        Run holding sync
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div ref={inboxSectionRef} className="wealth-muted-block grid gap-3 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">Inbox OAuth connectors</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Connect Gmail or Outlook so statement emails can move into the import pipeline without manual forwarding payloads.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadInboxConnections()}>
                  <Mail className="h-4 w-4" />
                  {isInboxLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Best use</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Statement capture</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use inbox access when statements naturally arrive by email and you want less manual forwarding.
                  </p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">What matters most</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Readiness and review</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    OAuth success is step one. The real win is a clean parsed statement moving into review.
                  </p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Best next move</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Run one inbox check</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    After connecting, run one check and confirm the right message type enters the pipeline.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Coverage</p>
                  <p className="mt-1 text-sm font-semibold">{inboxOperationsSummary.providerCoverageLabel}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{inboxOperationsSummary.nextActionLabel}.</p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Readiness</p>
                  <p className="mt-1 text-sm font-semibold">{inboxOperationsSummary.connectedCount} connected</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {inboxOperationsSummary.needsAuthCount} waiting on OAuth setup.
                  </p>
                </div>
                <div className="wealth-data-card p-3">
                  <p className="text-xs text-muted-foreground">Attention</p>
                  <p className="mt-1 text-sm font-semibold">{inboxOperationsSummary.attentionCount} need follow-up</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {inboxOperationsSummary.pausedCount} paused connection{inboxOperationsSummary.pausedCount === 1 ? "" : "s"} right now.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {inboxProviderDescriptors.map((provider) => {
                  const connection = inboxConnectionMap.get(provider.id);
                  const health = getInboxConnectionHealth(provider, connection);
                  const syncHistory = getInboxSyncHistory(connection);

                  return (
                    <div
                      id={`inbox-connector-${provider.id}`}
                      key={provider.id}
                      className={`wealth-data-card grid gap-3 p-3 transition-[box-shadow,transform] duration-700 ${highlightedInboxProviderId === provider.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {provider.description}
                          </p>
                        </div>
                        <Badge
                          variant={
                            health.readiness === "ready"
                              ? "secondary"
                              : health.readiness === "attention"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {connection?.status ?? "needs_auth"}
                        </Badge>
                      </div>
                      {highlightedInboxProviderId === provider.id ? (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                          <p className="text-xs font-medium text-primary">
                            Brought into focus from the dashboard.
                          </p>
                          {highlightedInboxNotice ? (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {highlightedInboxNotice}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs font-medium">{health.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{health.detail}</p>
                      </div>
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        <span>Scopes {provider.scopes.length}</span>
                        <span>
                          Account {connection?.providerAccountEmail ?? "not connected"}
                        </span>
                        <span>
                          Last sync {connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : "not yet"}
                        </span>
                        <span>
                          Last inbox message {connection?.lastMessageAt ? new Date(connection.lastMessageAt).toLocaleString() : "not seen yet"}
                        </span>
                        <span>
                          Token expiry {connection?.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt).toLocaleString() : "not reported"}
                        </span>
                        {connection?.errorMessage ? <span>{connection.errorMessage}</span> : null}
                      </div>
                      {syncHistory.length ? (
                        <div className="wealth-stat-tile p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                            Recent checks
                          </p>
                          <div className="mt-2 grid gap-2">
                            {syncHistory.slice(0, 2).map((event) => (
                              <div key={event.id} className="grid gap-1 text-[11px] text-muted-foreground">
                                <p>
                                  {new Date(event.syncedAt).toLocaleString()} · {event.status} · fetched{" "}
                                  {event.fetchedMessageCount} · imports {event.importedFileCount}
                                </p>
                                <p>{event.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void handleConnectInbox(provider.id)}>
                          <Mail className="h-4 w-4" />
                          {connection?.status === "connected" ? `Reconnect ${provider.name}` : provider.connectLabel}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={connection?.status !== "connected"}
                          onClick={() => void handleSyncInbox(provider.id)}
                        >
                          <Cloud className="h-4 w-4" />
                          Check inbox now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => scrollToSection(emailIntakeSectionRef)}
                        >
                          <FileText className="h-4 w-4" />
                          Open rehearsal
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={emailIntakeSectionRef} className="wealth-muted-block grid gap-3 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">Email ingestion simulator</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Mirror the future forwarding webhook path by sending sender, subject, body text, and one extracted attachment payload through the email intake route.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleIngestEmail()}>
                  <Mail className="h-4 w-4" />
                  Ingest email
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Use this for</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Safe rehearsal</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Test the future forwarding flow without depending on live inbox connectors.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Most important check</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Chosen input quality</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Make sure the attachment or body text actually contains the usable statement signal.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Best next move</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Open in sync plan</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Once the simulator output looks right, move it into source rehearsal before applying anything.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="From" value={emailFrom} onChange={setEmailFrom} />
                <TextField label="Subject" value={emailSubject} onChange={setEmailSubject} />
              </div>
              <TextField
                label="Attachment file name"
                value={emailAttachmentFileName}
                onChange={setEmailAttachmentFileName}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField
                  label="Attachment type"
                  value={emailAttachmentContentType}
                  onChange={setEmailAttachmentContentType}
                  options={[
                    ["text/plain", "Plain text"],
                    ["application/pdf", "PDF statement"],
                  ]}
                />
                <NumberField
                  label="Attachment pages"
                  value={emailAttachmentPageCount}
                  onChange={(value) => setEmailAttachmentPageCount(Math.max(1, value))}
                />
                <SegmentedControl
                  label="OCR status"
                  value={emailAttachmentOcrMode}
                  onChange={setEmailAttachmentOcrMode}
                  options={[
                    ["not-needed", "Text layer"],
                    ["used", "OCR used"],
                  ]}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Email body</p>
                  <textarea
                    className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Forwarded message&#10;Subject: Monthly statement&#10;Statement attached..."
                    value={emailBodyText}
                    onChange={(event) => setEmailBodyText(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Attachment text</p>
                  <textarea
                    className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={
                      emailAttachmentContentType === "application/pdf"
                        ? "Paste extracted PDF text after OCR or text-layer parsing"
                        : "Scheme Name&#9;Current Value&#9;Invested Value&#9;Units"
                    }
                    value={emailAttachmentText}
                    onChange={(event) => setEmailAttachmentText(event.target.value)}
                  />
                </div>
              </div>
              {emailIntakeResult ? (
                <div className="grid gap-3 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{emailIntakeResult.review.detectedSource?.name ?? "Unknown provider"}</Badge>
                    <Badge variant="outline">{emailIntakeResult.sourceType}</Badge>
                    <Badge variant="outline">{emailIntakeResult.review.documentKind}</Badge>
                    <Badge variant="outline">{emailIntakeResult.review.parseReadiness}</Badge>
                    {emailIntakeResult.job.usedOcr ? <Badge variant="outline">ocr</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{emailIntakeResult.review.summary}</p>
                  <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                    <span>Chosen input {emailIntakeResult.chosenInputLabel}</span>
                    <span>Parsed assets {emailIntakeResult.job.assetCount}</span>
                    <span>Warnings {emailIntakeResult.job.rowWarnings.length}</span>
                    <span>Document {emailIntakeResult.job.documentId}</span>
                  </div>
                  {emailIntakeResult.job.rowWarnings.length ? (
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      {emailIntakeResult.job.rowWarnings.slice(0, 3).map((warning) => (
                        <span key={warning}>- {warning}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleUseEmailResultInSyncPlan(emailIntakeResult)}
                    >
                      <ScanSearch className="h-4 w-4" />
                      Open in sync plan
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {importSourceDescriptors.map((source) => (
                <div key={source.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.summary}</p>
                    </div>
                    <Badge variant="outline">{describeReadiness(source.readiness)}</Badge>
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {source.supports.join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            <div ref={connectedSourcesSectionRef} className="grid gap-3 rounded-md border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Active data feeds</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Track which providers should keep feeding the portfolio pipeline and how often each one should be checked.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onRunIntegrationSync()}>
                    <Cloud className="h-4 w-4" />
                    Run active syncs
                  </Button>
                  <Button type="button" size="sm" onClick={handleAddIntegrationClick}>
                    <Plus className="h-4 w-4" />
                    Add source
                  </Button>
                  </div>
                </div>
                <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <p className="text-sm font-medium text-foreground">Source builder</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Build a lane in this order: pick the provider template, confirm cadence and channel, add the source, then use one small proof run before trusting it in the background.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">1. Template first</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Load a known playbook</p>
                      </div>
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">2. Proof second</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Run or rehearse once</p>
                      </div>
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">3. Cadence last</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Let the schedule take over</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="wealth-data-card p-4">
                      <p className="text-sm font-medium">Feed mix</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {connectorLaneMix.autoLaneCount} auto lane{connectorLaneMix.autoLaneCount === 1 ? "" : "s"}, {connectorLaneMix.manualLaneCount} manual lane{connectorLaneMix.manualLaneCount === 1 ? "" : "s"}, and {schedulerPlan.readyCount} source{schedulerPlan.readyCount === 1 ? "" : "s"} still waiting on a first real check.
                      </p>
                    </div>
                    <div className="wealth-data-card p-4">
                      <p className="text-sm font-medium">Best next move</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {schedulerPlan.readyCount > 0
                          ? "Convert one first-check-pending source into a clean proof run before adding more lanes."
                          : operationsSummary.attentionCount > 0
                            ? "Repair the noisiest lane first so the source board stays trustworthy."
                            : "Use templates to add only the next source that removes real manual review work."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="wealth-inset grid gap-3 p-3 md:grid-cols-3">
                  <div className="wealth-stat-tile p-3">
                    <p className="text-xs text-muted-foreground">Read first</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Lane status</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Start with posture, cadence, and the next scheduled check before you open diagnostics.
                    </p>
                  </div>
                  <div className="wealth-stat-tile p-3">
                    <p className="text-xs text-muted-foreground">Then decide</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">One next move</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Sync now, review history, or open rehearsal. Do the smallest useful action first.
                    </p>
                  </div>
                  <div className="wealth-stat-tile p-3">
                    <p className="text-xs text-muted-foreground">Escalate only if needed</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Open deeper diagnostics later</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Event timelines and provider cues are for confirmation, not the first read.
                    </p>
                  </div>
                </div>
                <div className="wealth-inset grid gap-3 p-3">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-sm font-medium">Provider templates</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Start from a provider playbook so channel, cadence, and import lane are sensible from the first run.
                      </p>
                    </div>
                    <SegmentedControl
                      label="Template"
                      options={connectorTemplates.map((template) => [template.id, template.providerName])}
                      value={selectedTemplateId}
                      onChange={handleApplyTemplate}
                    />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="wealth-data-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{selectedTemplate.providerName}</Badge>
                        <Badge variant="outline">{selectedTemplateMeta.readinessLabel}</Badge>
                        <Badge variant="outline">{selectedTemplate.channel}</Badge>
                        <Badge variant="outline">{selectedTemplate.importStrategy}</Badge>
                        <Badge variant="outline">{selectedTemplateMeta.cadenceLabel}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {selectedTemplate.summary}
                      </p>
                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Best inputs</p>
                        {selectedTemplate.bestInputs.map((item) => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    </div>
                    <div className="wealth-data-card p-4">
                      <p className="text-sm font-medium">Setup playbook</p>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                        {selectedTemplate.setupSteps.map((step, index) => (
                          <p key={step}>
                            {index + 1}. {step}
                          </p>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {selectedTemplate.notes}
                      </p>
                      <div className="mt-4">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyTemplate(selectedTemplate.id)}>
                          <Plus className="h-4 w-4" />
                          Load into editor
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              <div className="wealth-data-card grid gap-3 p-3">
                <ConnectionFields
                  connection={draftIntegration}
                  onChange={setDraftIntegration}
                />
              </div>
              <div className="wealth-data-card grid gap-3 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-medium">Scheduler readiness</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Next connector run {formatSyncTimeLabel(schedulerPlan.nextRunAt)} across {schedulerPlan.activeCount} active source{schedulerPlan.activeCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                  <Badge variant={schedulerPlan.dueCount ? "secondary" : "outline"}>
                    {schedulerPlan.dueCount ? `${schedulerPlan.dueCount} due` : "on cadence"}
                  </Badge>
                </div>
                <div className="grid gap-2 text-xs md:grid-cols-4">
                  <div className="wealth-stat-tile p-3">
                    <p className="text-muted-foreground">First checks pending</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.readyCount}</p>
                  </div>
                  <div className="wealth-stat-tile p-3">
                    <p className="text-muted-foreground">Due now</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.dueCount}</p>
                  </div>
                  <div className="wealth-stat-tile p-3">
                    <p className="text-muted-foreground">Paused</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.pausedCount}</p>
                  </div>
                  <div className="wealth-stat-tile p-3">
                    <p className="text-muted-foreground">Need fixes</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.errorCount}</p>
                  </div>
                </div>
                {schedulerPlan.dueCount > 0 && (
                  <div className="grid gap-2">
                    {schedulerPlan.entries
                      .filter((entry) => entry.shouldRunNow)
                      .slice(0, 3)
                      .map((entry) => (
                        <div key={entry.id} className="wealth-stat-tile flex flex-col justify-between gap-1 p-3 text-xs sm:flex-row sm:items-center">
                          <span className="font-medium text-foreground">{entry.providerName}</span>
                          <span className="text-muted-foreground">{entry.reason}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="wealth-data-card grid gap-3 p-3">
                <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                  <SegmentedControl
                    label="Source focus"
                    options={[
                      ["all", "All"],
                      ["attention", "Attention"],
                      ["due", "Due"],
                      ["active", "Auto"],
                      ["manual", "Manual"],
                    ]}
                    value={integrationFilter}
                    onChange={(value) => setIntegrationFilter(value as IntegrationActivityFilter)}
                  />
                  <TextField
                    label="Search sources"
                    value={integrationSearch}
                    onChange={setIntegrationSearch}
                  />
                </div>
                {(integrationSearch.trim() || integrationFilter !== "all") && (
                  <div className="wealth-stat-tile flex flex-wrap items-center justify-between gap-2 p-3">
                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-medium text-foreground">{filteredIntegrations.length}</span>{" "}
                      source{filteredIntegrations.length === 1 ? "" : "s"} for{" "}
                      <span className="font-medium text-foreground">{integrationFilter}</span>
                      {integrationSearch.trim()
                        ? (
                            <>
                              {" "}matching{" "}
                              <span className="font-medium text-foreground">
                                {integrationSearch.trim()}
                              </span>
                            </>
                          )
                        : null}
                      .
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIntegrationFilter("all");
                        setIntegrationSearch("");
                      }}
                    >
                      Reset filters
                    </Button>
                  </div>
                )}
              </div>
              <div className="wealth-data-card grid gap-3 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-medium">Recent connector activity</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Shared visibility across manual source reviews, inbox checks, and broker sync attempts.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {filteredConnectorActivityFeed.length} recent event{filteredConnectorActivityFeed.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {highlightedActivityProviderId && highlightedActivityProviderName ? (
                  <div className="wealth-data-card flex flex-wrap items-center justify-between gap-2 p-3">
                    <p className="text-xs text-muted-foreground">
                      Showing connector activity for{" "}
                      <span className="font-medium text-foreground">{highlightedActivityProviderName}</span>.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHighlightedActivityProviderId(null);
                        setHighlightedActivityProviderName(null);
                      }}
                    >
                      Show all activity
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricMini
                    label="Imported files"
                    value={String(connectorActivitySummary.totalImportedFiles)}
                    caption={
                      connectorActivitySummary.lastSyncedAt
                        ? `Last event ${new Date(connectorActivitySummary.lastSyncedAt).toLocaleString()}`
                        : "No connector events yet"
                    }
                  />
                  <MetricMini
                    label="Successful events"
                    value={String(connectorActivitySummary.successCount)}
                    caption={`${connectorActivitySummary.warningCount} warning · ${connectorActivitySummary.errorCount} error`}
                  />
                  <MetricMini
                    label="Manual reviews"
                    value={String(connectorActivitySummary.manualEventCount)}
                    caption={`${connectorActivitySummary.inboxEventCount} inbox · ${connectorActivitySummary.brokerEventCount} broker`}
                  />
                  <MetricMini
                    label="Focused sources"
                    value={String(filteredConnectorActivityFeed.length)}
                    caption={
                      highlightedActivityProviderId
                        ? "Filtered to one provider"
                        : "Across all active lanes"
                    }
                  />
                </div>
                {filteredConnectorActivityFeed.length ? (
                  <div className="grid gap-2">
                    {filteredConnectorActivityFeed.map((event) => (
                      <div
                        key={`${event.sourceType}-${event.id}`}
                        className={`wealth-stat-tile p-3 transition-[box-shadow,transform] duration-700 ${highlightedActivityProviderId === event.providerId ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-medium text-foreground">{event.providerName}</p>
                            <Badge variant="outline">
                              {getConnectorActivitySourceLabel(event.sourceType)}
                            </Badge>
                            <Badge
                              variant={
                                event.status === "success"
                                  ? "secondary"
                                  : event.status === "warning" || event.status === "error"
                                    ? "outline"
                                    : "outline"
                              }
                            >
                              {event.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(event.syncedAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{event.message}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            <span>Imports {event.importedFileCount}</span>
                            {event.fetchedMessageCount !== null ? (
                              <span>Fetched {event.fetchedMessageCount}</span>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleConnectorActivityClick(event)}
                          >
                            {getConnectorActivityActionLabel(event.sourceType)}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {highlightedActivityProviderId
                      ? "No connector activity matches this focused provider yet. Run a check or review a sync plan to add timeline history here."
                      : "No connector activity has been recorded yet. Run a check, review a sync plan, or connect an inbox source to start the timeline."}
                  </p>
                )}
              </div>
              <div className="grid gap-3">
                <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        Keep each feed legible: status first, action second, diagnostics third.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Every source below now acts like an operations lane. Read the current posture, take the next best action, then open the deeper sync history only if something looks off.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">1. Read the lane</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Status and cadence</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Start with sync posture, source type, and next scheduled check.
                        </p>
                      </div>
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">2. Take the next move</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">One action at a time</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Use sync plan, history, or sync now depending on what the lane needs next.
                        </p>
                      </div>
                      <div className="wealth-stat-tile p-3">
                        <p className="text-xs text-muted-foreground">3. Escalate only if needed</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">Open diagnostics later</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Deeper provider cues, event history, and scheduler detail are still here when you need them.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="wealth-muted-block p-4">
                      <p className="text-sm font-medium">Feed summary</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {filteredIntegrations.length} source{filteredIntegrations.length === 1 ? "" : "s"} in view, {operationsSummary.attentionCount} needing attention, and the next scheduled check is {formatSyncTimeLabel(schedulerPlan.nextRunAt)}.
                      </p>
                    </div>
                    <div className="wealth-muted-block p-4">
                      <p className="text-sm font-medium">Best next move</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {operationsSummary.attentionCount > 0
                          ? "Clear the noisiest lane first, then rerun or rehearse it before trusting any downstream portfolio read."
                          : "Use rehearsal for new feeds, then let cadence and review history keep the pipeline calm."}
                      </p>
                    </div>
                  </div>
                </div>
                {filteredIntegrations.length ? filteredIntegrations.map((integration) => {
                  const isEditing = editingIntegrationId === integration.id;
                  const syncState = getIntegrationSyncState(integration);
                  const healthMetrics = getIntegrationHealthMetrics(integration);
                  const nextSyncAt = getNextIntegrationSyncAt(integration);
                  const actionItems = getIntegrationActionItems(integration);
                  const diagnosticsSummary = buildIntegrationDiagnosticsSummary(integration);
                  const primaryAction = actionItems[0];
                  const laneRead =
                    integration.status !== "active"
                      ? "Paused or disconnected until you reactivate the source."
                      : syncState.detail;
                  const latestImportJob = latestImportJobByProviderId.get(integration.providerId);
                  const latestImportMeta = latestImportJob
                    ? getImportJobFlowMeta(latestImportJob)
                    : null;
                  const latestImportStats = latestImportJob
                    ? getImportJobOutcomeStats(latestImportJob)
                    : null;
                  const proofLabel = latestImportMeta
                    ? latestImportMeta.label
                    : integration.lastSyncAt
                      ? "Lane has run"
                      : "Awaiting first proof";
                  const proofDetail = latestImportJob
                    ? latestImportJob.summary
                    : integration.lastSyncAt
                      ? `Last connector run ${new Date(integration.lastSyncAt).toLocaleString()}.`
                      : "Run a sync or rehearse a statement once so this lane has a first verified outcome.";
                  const laneModeLabel =
                    integration.importStrategy === "sync-ready"
                      ? "Live-sync lane"
                      : integration.importStrategy === "manual-review"
                        ? "Review-first lane"
                        : "Statement lane";
                  const laneRiskLabel =
                    healthMetrics.warningStreak > 0
                      ? `${healthMetrics.warningStreak} warning streak`
                      : latestImportMeta?.badgeVariant === "secondary"
                        ? "Recent proof looks healthy"
                        : "Needs first clean review";
                  const secondaryActionItems = primaryAction
                    ? actionItems.slice(1, 3)
                    : actionItems.slice(0, 2);

                  return (
                    <div
                      id={`integration-source-${integration.id}`}
                      key={integration.id}
                      className={`wealth-data-card p-3 transition-[box-shadow,transform] duration-700 ${highlightedIntegrationId === integration.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    >
                      {isEditing ? (
                        <ConnectionFields
                          connection={integration}
                          onChange={(nextConnection) =>
                            onUpdateIntegration(integration.id, nextConnection)
                          }
                        />
                      ) : (
                        <div className="grid gap-2">
                          {highlightedIntegrationId === integration.id ? (
                            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                              <p className="text-xs font-medium text-primary">
                                Brought into focus from the dashboard.
                              </p>
                              {highlightedIntegrationNotice ? (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {highlightedIntegrationNotice}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{integration.providerName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {integration.channel} · {getIntegrationStrategyLabel(integration.importStrategy)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{integration.status}</Badge>
                              <Badge
                                variant={
                                  syncState.tone === "healthy"
                                    ? "secondary"
                                    : syncState.tone === "attention"
                                      ? "outline"
                                      : "outline"
                                }
                              >
                                {syncState.label}
                              </Badge>
                              <Badge variant="outline">
                                every {integration.syncCadenceMinutes} min
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {integration.sourceHint}
                          </p>
                          {integration.notes && (
                            <p className="text-xs leading-5 text-muted-foreground">
                              {integration.notes}
                            </p>
                          )}
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Lane mode</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{laneModeLabel}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                {integration.importStrategy === "sync-ready"
                                  ? "This source can usually move from connector check to reusable sync cadence."
                                  : integration.importStrategy === "manual-review"
                                    ? "This source is healthiest when you review staged output before each apply."
                                    : "This lane depends on fresh exported statements more than scheduled checks."}
                              </p>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Latest proof</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{proofLabel}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{proofDetail}</p>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Trust read</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{laneRiskLabel}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                {healthMetrics.warningStreak > 0
                                  ? "Clear the warning pattern before relying on automation here."
                                  : syncState.tone === "healthy"
                                    ? "This lane looks steady enough for routine use."
                                    : "A first successful run is still the main trust milestone for this source."}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[1fr_0.95fr]">
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">What this means</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{syncState.label}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{laneRead}</p>
                            </div>
                            <div className={`p-3 ${primaryAction ? "rounded-md border border-primary/20 bg-primary/5" : "wealth-stat-tile"}`}>
                              <p className="text-xs text-muted-foreground">Do this now</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {primaryAction ? primaryAction.label : "Stay on cadence"}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                {primaryAction
                                  ? primaryAction.detail
                                  : "Nothing urgent is blocking this feed right now. Use history or sync plan only when you want to inspect the lane."}
                              </p>
                              {primaryAction ? (
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <p className="text-[11px] text-muted-foreground">
                                    Highest-value action for this lane right now.
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleIntegrationActionClick(integration, primaryAction)}
                                  >
                                    {primaryAction.label}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Last sync</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleDateString() : "Not yet"}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {integration.lastSyncStatus} · files {integration.lastImportedFileCount}
                              </p>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Success rate</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{healthMetrics.successRate}%</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Avg files {healthMetrics.averageImportedFiles.toFixed(1)}
                              </p>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Next check</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{formatSyncTimeLabel(nextSyncAt)}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                every {integration.syncCadenceMinutes} min
                              </p>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-xs text-muted-foreground">Latest import</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {latestImportMeta ? latestImportMeta.label : "No review yet"}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {latestImportJob ? latestImportJob.summary : "This lane has not produced a saved review yet."}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="wealth-stat-tile p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Sync health
                              </p>
                              <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
                                <span>
                                  Last sync{" "}
                                  {integration.lastSyncAt
                                    ? new Date(integration.lastSyncAt).toLocaleString()
                                    : "not yet"}
                                  {integration.lastSyncOrigin
                                    ? ` · ${integration.lastSyncOrigin}`
                                    : ""}
                                </span>
                                <span>
                                  Result {integration.lastSyncStatus} · files{" "}
                                  {integration.lastImportedFileCount}
                                </span>
                                <span>
                                  Success {healthMetrics.successRate}% · avg files{" "}
                                  {healthMetrics.averageImportedFiles.toFixed(1)}
                                </span>
                                <span>
                                  Last healthy{" "}
                                  {healthMetrics.lastHealthySyncAt
                                    ? new Date(
                                        healthMetrics.lastHealthySyncAt,
                                      ).toLocaleString()
                                    : "not yet"}
                                  {healthMetrics.warningStreak
                                    ? ` · streak ${healthMetrics.warningStreak}`
                                    : ""}
                                </span>
                              </div>
                            </div>
                            <div className="wealth-stat-tile p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Scheduler
                              </p>
                              <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
                                <span>
                                  Status {integration.lastSchedulerStatus}
                                </span>
                                <span>
                                  Checked{" "}
                                  {integration.lastSchedulerCheckAt
                                    ? new Date(
                                        integration.lastSchedulerCheckAt,
                                      ).toLocaleString()
                                    : "not checked yet"}
                                </span>
                                <span>
                                  Next check {formatSyncTimeLabel(nextSyncAt)}
                                </span>
                                {nextSyncAt ? (
                                  <span>
                                    Scheduled {new Date(nextSyncAt).toLocaleString()}
                                  </span>
                                ) : (
                                  <span>Runs when a fresh manual input arrives</span>
                                )}
                              </div>
                            </div>
                            <div className="rounded-md border bg-muted/30 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Current read
                              </p>
                              <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground">
                                <p>{syncState.detail}</p>
                                <p>{integration.lastSyncMessage}</p>
                                <p>{integration.lastSchedulerMessage}</p>
                              </div>
                            </div>
                          </div>
                          <div className="wealth-stat-tile p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                              Provider detection
                            </p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {diagnosticsSummary.providerCue}
                            </p>
                          </div>
                          {latestImportJob && latestImportMeta && (
                            <div className="wealth-muted-block mt-2 grid gap-2 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                  Latest import outcome
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={latestImportMeta.badgeVariant}>
                                    {latestImportMeta.label}
                                  </Badge>
                                  <Badge variant="outline">{latestImportJob.status}</Badge>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {latestImportJob.summary}
                              </p>
                              {latestImportStats && (
                                <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                                  <span>{latestImportStats.fileLabel}</span>
                                  <span>{latestImportStats.holdingsLabel}</span>
                                  <span>{latestImportStats.duplicatesLabel}</span>
                                  <span>{latestImportStats.ocrLabel}</span>
                                </div>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {latestImportMeta.detail} · {new Date(latestImportJob.createdAt).toLocaleString()}
                              </p>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenImportHistoryForProvider(integration)}
                                >
                                  <FileText className="h-4 w-4" />
                                  Review history
                                </Button>
                              </div>
                            </div>
                          )}
                          {diagnosticsSummary.timeline.length > 0 && (
                            <div className="wealth-muted-block mt-2 grid gap-2 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Recent sync events
                              </p>
                              {diagnosticsSummary.timeline.map((event) => (
                                <div key={event.id} className="grid gap-1 text-[11px] text-muted-foreground">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={event.status === "success" ? "secondary" : "outline"}>
                                      {event.statusLabel}
                                    </Badge>
                                    <span>{event.importedFileLabel}</span>
                                    <span>{new Date(event.syncedAt).toLocaleString()}</span>
                                  </div>
                                  <p>{event.message}</p>
                                  {event.detectedProviderSummary ? (
                                    <p>{event.detectedProviderSummary}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                          {secondaryActionItems.length > 0 && (
                            <div className="wealth-muted-block mt-2 grid gap-2 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Supporting moves
                              </p>
                              {secondaryActionItems.map((item) => (
                                <div key={`${integration.id}-${item.label}`} className="grid gap-2 text-[11px] text-muted-foreground">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium text-foreground">
                                      {item.emphasis === "high" ? "Now" : "Next"}: {item.label}
                                    </p>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleIntegrationActionClick(integration, item)}
                                    >
                                      Open
                                    </Button>
                                  </div>
                                  <p>{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <p className="text-[11px] text-muted-foreground">
                          Quick tools for reruns, rehearsal, history, and connector edits.
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onRunIntegrationSync(integration.id)}
                        >
                          <Cloud className="h-4 w-4" />
                          Run check
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handlePreviewSyncPlan(integration)}
                        >
                          <ScanSearch className="h-4 w-4" />
                          Rehearse
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenImportHistoryForProvider(integration)}
                        >
                          <FileText className="h-4 w-4" />
                          Review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditingIntegrationId(isEditing ? null : integration.id)
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          {isEditing ? "Done" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteIntegration(integration.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="grid gap-3 rounded-md border bg-background p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">No source matches this view yet.</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start one lane first or loosen the filter so we can bring a connector back into the operating view.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToSection(brokerSectionRef)}>
                        Broker lane
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToSection(inboxSectionRef)}>
                        Inbox lane
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToSection(syncPlanSectionRef)}>
                        Rehearse a source
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div ref={importHistorySectionRef}>
        <Card className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>History: import reviews</CardTitle>
            <CardDescription>
              Track statement reviews, completed imports, and failures so the intake workflow stays clean over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Queue posture before action</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This lane is healthiest when you separate triage from apply. Read the queue pressure first, then open only the run that deserves a decision.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="wealth-stat-tile p-3">
                  <p className="text-xs text-muted-foreground">Queue pressure</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {importJobSummary.openCount > 0 ? `${importJobSummary.openCount} open reviews` : "Queue is clear"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importJobSummary.openCount > 0
                      ? "Work open items before replaying older completed runs."
                      : "Use history mainly for auditability and replays now."}
                  </p>
                </div>
                <div className="wealth-stat-tile p-3">
                  <p className="text-xs text-muted-foreground">Failure pressure</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {importJobSummary.failedCount > 0 ? `${importJobSummary.failedCount} failed runs` : "No failed runs"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importJobSummary.failedCount > 0
                      ? "Failed imports usually need cleaner source text, a better export, or OCR review."
                      : "Nothing failed is dragging down the queue right now."}
                  </p>
                </div>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Use this queue for
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Final review before holdings or transactions merge into the tracked workspace.
                </p>
              </div>
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Most common mistake
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Applying a run because the provider was recognized, even though warnings or duplicates still need a look.
                </p>
              </div>
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Open the newest reviewed run with saved payload, confirm the parse, then either apply or reopen rehearsal.
                </p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {importJobSummary.openCount > 0
                      ? "Work the open reviews first, then replay only the clean ones."
                      : "The queue is clear. Use history as a reference lane when a source drifts."}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {importJobSummary.openCount > 0
                      ? `${importJobSummary.openCount} review item${importJobSummary.openCount === 1 ? "" : "s"} still need your sign-off. Open items with saved payloads are the fastest way to recover a tricky import.`
                      : "Completed and failed imports stay here so you can reopen the exact source text, note corrections, and replay the provider flow when needed."}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="wealth-data-card p-3">
                    <p className="text-xs text-muted-foreground">1. Triage</p>
                    <p className="mt-1 text-sm font-semibold">Filter the queue</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Start with `Open` or search one provider before diving into raw payloads.
                    </p>
                  </div>
                  <div className="wealth-data-card p-3">
                    <p className="text-xs text-muted-foreground">2. Rehearse</p>
                    <p className="mt-1 text-sm font-semibold">Open in source rehearsal</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Reuse the saved text, inspect warnings, and decide whether the parser needs a cleaner source.
                    </p>
                  </div>
                  <div className="wealth-data-card p-3">
                    <p className="text-xs text-muted-foreground">3. Apply</p>
                    <p className="mt-1 text-sm font-semibold">Merge only clean output</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Apply reviewed holdings or transactions only after the preview looks right.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="wealth-data-card p-4">
                  <p className="text-sm font-medium">Queue read</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importJobSummary.failedCount > 0
                      ? `${importJobSummary.failedCount} failed import${importJobSummary.failedCount === 1 ? "" : "s"} may need a cleaner export or OCR review.`
                      : "No failed imports are blocking the queue right now."}
                  </p>
                </div>
                <div className="wealth-data-card p-4">
                  <p className="text-sm font-medium">Best next move</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {importJobSummary.openCount > 0
                      ? "Open the newest reviewed import with saved payload, confirm the parser output, and either apply it or reopen the source rehearsal."
                      : "Keep this lane for auditability: save corrections, reopen provider-specific runs, and replay only when the portfolio needs it."}
                  </p>
                </div>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricMini label="Open review" value={`${importJobSummary.openCount}`} />
                <MetricMini label="Completed" value={`${importJobSummary.completedCount}`} />
                <MetricMini label="Failed" value={`${importJobSummary.failedCount}`} />
                <MetricMini label="OCR-backed" value={`${importJobSummary.ocrCount}`} />
              </div>
              <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                <SegmentedControl
                  label="Status filter"
                  options={[
                    ["all", "All"],
                    ["open", "Open"],
                    ["completed", "Completed"],
                    ["failed", "Failed"],
                  ]}
                  value={jobFilter}
                  onChange={(value) => setJobFilter(value as typeof jobFilter)}
                />
                <TextField
                  label="Search imports"
                  value={jobSearch}
                  onChange={setJobSearch}
                />
              </div>
              {jobSearch.trim() && (
                <div className="wealth-data-card flex flex-wrap items-center justify-between gap-2 p-3">
                  <p className="text-xs text-muted-foreground">
                    Showing imports matching <span className="font-medium text-foreground">{jobSearch.trim()}</span>.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setJobSearch("")}
                  >
                    Reset filter
                  </Button>
                </div>
              )}
            </div>
            {filteredImportJobs.length ? filteredImportJobs.map((job) => (
              <ImportJobCard
                key={job.id}
                correctionDraft={jobCorrectionDrafts[job.id] ?? ""}
                highlighted={highlightedImportJobId === job.id}
                highlightedNotice={
                  highlightedImportJobId === job.id ? highlightedImportJobNotice : null
                }
                job={job}
                onCorrectionDraftChange={(value) =>
                  setJobCorrectionDrafts((current) => ({
                    ...current,
                    [job.id]: value,
                  }))
                }
                onSaveCorrection={() => {
                  const draft = (jobCorrectionDrafts[job.id] ?? "").trim();

                  if (!draft) {
                    setActionMessage("Add a correction note before saving.");
                    return;
                  }

                  onUpdateImportJob(job.id, {
                    ...job,
                    lastActionAt: new Date().toISOString(),
                    reviewedCorrections: [...job.reviewedCorrections, draft],
                  });
                  setJobCorrectionDrafts((current) => ({ ...current, [job.id]: "" }));
                  setActionMessage("Correction note saved to import history.");
                }}
                onRetry={() =>
                  onUpdateImportJob(job.id, {
                    ...job,
                    attemptCount: job.attemptCount + 1,
                    lastActionAt: new Date().toISOString(),
                    notes: "Retry requested from import history.",
                    status: "reviewed",
                    summary: `${job.providerName} import sent back to review for another pass.`,
                  })
                }
                onReprocess={() =>
                  onReprocessImportJob(job.id)
                }
                onApplyToPortfolio={() =>
                  handleApplyImportJobToPortfolio(job)
                }
                onUseInSyncPlan={() =>
                  void handleUseImportJobInSyncPlan(job)
                }
              />
            )) : (
              <div className="wealth-empty-state">
                {importJobs.length === 0
                  ? "No import jobs yet. Stage a sync plan, ingest an email, or import a statement to start building review history."
                  : jobSearch.trim()
                    ? `No import jobs match "${jobSearch.trim()}" with the current filter.`
                    : jobFilter === "all"
                      ? "No import jobs are available right now."
                      : `No ${jobFilter} import jobs match this view right now.`}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <div ref={syncPlanSectionRef}>
        <Card className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>Workflow: sync plan</CardTitle>
            <CardDescription>
              Preview how one source will move through the WealthCompass pipeline before you run or apply it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rehearsal status
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {syncPreview ? "Provider ready" : "Choose a provider"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Start by opening one source lane into rehearsal before you paste any text.
                </p>
              </div>
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Input quality
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {syncInputText.trim() ? "Sample ready" : "Add a sample"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The fastest useful proof is one realistic statement body, table, or extracted PDF text.
                </p>
              </div>
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Warning pressure
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {syncExecution ? `${syncExecution.reviewedWarnings.length} warning${syncExecution.reviewedWarnings.length === 1 ? "" : "s"}` : "Not run yet"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Warnings do not always block progress, but they usually mean stage-first is the safer path.
                </p>
              </div>
              <div className="wealth-data-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Decision lane
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {syncExecutionOverview?.canApply
                    ? "Ready to apply"
                    : syncExecutionOverview?.canStage
                      ? "Stage first"
                      : "Inspect first"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Let the execution read decide whether this belongs in history, apply, or another cleanup pass.
                </p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Rehearse first, automate second</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This section is the safety rail between a promising connector and a trustworthy one. The goal is not more output, it is cleaner output.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Execution read</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {syncExecutionOverview ? syncExecutionOverview.importReadyLabel : "Waiting for a sample"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {syncExecutionOverview
                      ? syncExecutionOverview.actionHint
                      : "Load one realistic sample so the runner can prove the exact path it will take."}
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Best decision rule</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {syncExecution?.reviewedWarnings.length
                      ? "Stage before apply"
                      : syncExecution
                        ? "Apply only if clean"
                        : "Inspect first"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {syncExecution?.reviewedWarnings.length
                      ? "Warnings or duplicates mean history is usually the safer next stop than direct merge."
                      : "A rehearsal only graduates to apply when the parsed output feels trustworthy end to end."}
                  </p>
                </div>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best use
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Dry-run a provider with real input before trusting live cadence or manual apply.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What matters most
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Parsed output quality, warning count, duplicate handling, and whether the job belongs in history or straight to apply.
                </p>
              </div>
              <div className="wealth-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Rehearse with one realistic sample, inspect the execution preview, then stage or apply only if it reads cleanly.
                </p>
              </div>
            </div>
            {syncPreview ? (
              <>
                <div className="wealth-muted-block grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{syncPreview.providerName}</Badge>
                      <Badge variant="outline">{syncPreview.readinessLabel}</Badge>
                      <Badge variant="outline">{syncPreview.connectorStatus}</Badge>
                      {syncPreviewProviderId ? (
                        <Badge variant="outline">{syncPreviewProviderId}</Badge>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        Rehearse the parser before the source touches holdings.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {syncPreview.summary}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">1. Feed the runner</p>
                        <p className="mt-1 text-sm font-semibold">Paste the source text</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Use an email body, extracted PDF text, or statement table from this provider.
                        </p>
                      </div>
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">2. Inspect the output</p>
                        <p className="mt-1 text-sm font-semibold">Review warnings and duplicates</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Check parsed holdings, transactions, cleanup counts, and watchouts before staging.
                        </p>
                      </div>
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">3. Choose the lane</p>
                        <p className="mt-1 text-sm font-semibold">Stage, apply, or run live</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Keep uncertain runs in history; merge only when the output feels trustworthy.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="wealth-data-card p-4">
                      <p className="text-sm font-medium">Best next move</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {syncExecutionOverview
                          ? syncExecutionOverview.actionHint
                          : "Feed this provider one real source sample, then review the execution preview before deciding whether it belongs in history or the portfolio."}
                      </p>
                    </div>
                    <div className="wealth-data-card p-4">
                      <p className="text-sm font-medium">Rehearsal status</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {syncExecution
                          ? `${syncExecution.parsedAssetCount} holdings, ${syncExecution.parsedTransactionCount} transactions, ${syncExecution.reviewedWarnings.length} warning${syncExecution.reviewedWarnings.length === 1 ? "" : "s"}, and ${syncExecution.duplicateCount} duplicate${syncExecution.duplicateCount === 1 ? "" : "s"} found in the latest pass.`
                          : "No rehearsal run yet. Load a provider sample or paste source text to see the exact pipeline path."}
                      </p>
                    </div>
                  </div>
                </div>
                {syncExecution && (
                  <div className="wealth-muted-block grid gap-3 p-4">
                    {syncExecutionOverview ? (
                      <div className="wealth-data-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{syncExecutionOverview.headline}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {syncExecutionOverview.actionHint}
                            </p>
                          </div>
                          <Badge variant={syncExecutionOverview.canApply ? "secondary" : "outline"}>
                            {syncExecutionOverview.importReadyLabel}
                          </Badge>
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">Execution status</p>
                        <p className="mt-1 text-sm font-semibold">{syncExecution.connectorStatus}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{syncExecution.jobStatus}</p>
                      </div>
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">Parsed output</p>
                        <p className="mt-1 text-sm font-semibold">
                          {syncExecution.parsedAssetCount} holdings
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {syncExecution.parsedTransactionCount} transactions
                        </p>
                      </div>
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">Cleanup</p>
                        <p className="mt-1 text-sm font-semibold">
                          {syncExecution.normalizationCount} normalization
                          {syncExecution.normalizationCount === 1 ? "" : "s"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {syncExecution.duplicateCount} duplicate
                          {syncExecution.duplicateCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="wealth-data-card p-3">
                        <p className="text-xs text-muted-foreground">Review</p>
                        <p className="mt-1 text-sm font-semibold">
                          {syncExecution.reviewedWarnings.length} warning
                          {syncExecution.reviewedWarnings.length === 1 ? "" : "s"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {syncExecution.importedFileCount} input candidate
                          {syncExecution.importedFileCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {syncPlanCombinedOverview ? (
                  <SyncPlanCombinedOverviewCard overview={syncPlanCombinedOverview} />
                ) : null}
                {syncPlanLatestImportJob && syncPlanLatestImportMeta && syncPlanLatestImportStats ? (
                  <div className="wealth-muted-block grid gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Latest saved review for this provider</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {syncPlanLatestImportMeta.detail}
                        </p>
                      </div>
                      <Badge variant={syncPlanLatestImportMeta.badgeVariant}>
                        {syncPlanLatestImportMeta.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{syncPlanLatestImportStats.fileLabel}</Badge>
                      <Badge variant="outline">{syncPlanLatestImportStats.holdingsLabel}</Badge>
                      <Badge variant="outline">
                        {syncPlanLatestImportJob.transactionCount === 1
                          ? "1 transaction"
                          : `${syncPlanLatestImportJob.transactionCount} transactions`}
                      </Badge>
                      <Badge variant="outline">{syncPlanLatestImportStats.duplicatesLabel}</Badge>
                      <Badge variant="outline">{syncPlanLatestImportStats.ocrLabel}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Saved {new Date(syncPlanLatestImportJob.createdAt).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleUseImportJobInSyncPlan(syncPlanLatestImportJob)}
                      >
                        Open saved review
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyImportJobToPortfolio(syncPlanLatestImportJob)}
                        disabled={syncPlanLatestImportJob.status === "failed"}
                      >
                        Apply saved review
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="wealth-muted-block grid gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">Live runner input</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Paste an email body, statement table, or extracted text to see this provider runner produce a real execution preview.
                    </p>
                  </div>
                  <TextField
                    label="File name (optional)"
                    value={syncInputFileName}
                    onChange={setSyncInputFileName}
                  />
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Source text</p>
                    <textarea
                      className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Forwarded message&#10;Subject: Monthly statement&#10;Scheme Name..."
                      value={syncInputText}
                      onChange={(event) => setSyncInputText(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="wealth-stat-tile p-4">
                    <p className="text-sm font-medium">Recommended inputs</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      {syncPreview.recommendedFiles.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                  <div className="wealth-stat-tile p-4">
                    <p className="text-sm font-medium">Watchouts</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      {syncPreview.risks.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    onClick={handleApplySyncPlanToPortfolio}
                    disabled={!syncExecutionOverview || !syncExecutionOverview.canApply}
                  >
                    <Upload className="h-4 w-4" />
                    {syncExecutionOverview?.applyLabel ?? "Apply to portfolio"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStageSyncPlanImport}
                    disabled={!syncExecutionOverview || !syncExecutionOverview.canStage}
                  >
                    <FileText className="h-4 w-4" />
                    Stage in import history
                  </Button>
                  {syncPreviewConnection?.importStrategy === "sync-ready" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRunIntegrationSync(syncPreviewConnection.id)}
                    >
                      <Cloud className="h-4 w-4" />
                      Run sync now
                    </Button>
                  ) : null}
                </div>
                {syncExecution?.artifacts.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {syncExecution.artifacts.map((artifact) => (
                      <div key={`${artifact.kind}-${artifact.label}`} className="wealth-data-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{artifact.label}</p>
                          <Badge variant="outline">{artifact.kind}</Badge>
                        </div>
                        <pre className="mt-3 overflow-auto rounded-md bg-background p-3 text-[11px] leading-5 text-muted-foreground">
                          {artifact.preview}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-3">
                  {(syncExecution?.steps ?? syncPreview.steps).map((step, index) => (
                    <div key={`${step.stage}-${step.title}`} className="wealth-data-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {index + 1}. {step.title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {step.stage}
                            {"status" in step ? ` · ${step.status}` : ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
                {syncExecution?.reviewedWarnings.length ? (
                  <div className="wealth-muted-block grid gap-2 p-4 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">Execution warnings</p>
                      {syncExecutionOverview ? (
                        <Badge variant="outline">{syncExecutionOverview.warningLabel}</Badge>
                      ) : null}
                    </div>
                    {syncExecution.reviewedWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                {syncExecution?.sourceLineage.length ? (
                  <div className="wealth-muted-block grid gap-2 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Source lineage</p>
                    {syncExecution.sourceLineage.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="wealth-empty-state">
                Pick any connected source and open its sync plan to inspect the exact execution path we expect for that provider.
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <Card className="wealth-panel-strong overflow-hidden">
          <div id="settings-market-controls" />
          <CardHeader>
            <CardTitle>Controls: live market</CardTitle>
            <CardDescription>
              Tune live market behavior so the market page stays useful, believable, and calm enough to trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className={`rounded-md border p-4 ${controlsVerdictToneClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Controls verdict</p>
                <Badge variant={controlsVerdictBadgeVariant}>
                  {safeMarketPreferences.watchlist.length
                    ? `${safeMarketPreferences.watchlist.length} tracked`
                    : "watchlist empty"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{controlsVerdictLabel}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{controlsVerdictDetail}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source mode
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {marketPreferences.preferredSource === "alpha-vantage" ? "Live market feed" : "Fallback market mode"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Choose live only when the feed is configured and the extra motion helps more than it hurts.
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Refresh rhythm
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {marketPreferences.autoRefresh ? `${marketPreferences.pollingIntervalSeconds}s polling` : "Manual / static"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Slower refresh makes demos calmer. Faster refresh makes stale feeds more obvious.
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Holdings watch
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {marketPreferences.includeHoldingsWatch ? "Included in market read" : "Sector-only read"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Keep this on when portfolio context matters. Turn it off when you want a broader market-only screen.
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Watchlist coverage
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {safeMarketPreferences.watchlist.length} tracked sector{safeMarketPreferences.watchlist.length === 1 ? "" : "s"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Suggested sectors become more useful when the watchlist reflects the lanes you actually care to revisit.
                </p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Pick the market posture you can trust</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  These settings are less about feeling live and more about keeping the market page believable: source quality, refresh rhythm, and whether holdings should participate in the read.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Current source mode</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {marketPreferences.preferredSource === "alpha-vantage" ? "Live source" : "Fallback only"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {marketPreferences.preferredSource === "alpha-vantage"
                      ? "Use this when the external feed is configured and you want fresher market signals."
                      : "Use this when demo stability matters more than live feed freshness."}
                  </p>
                </div>
                <div className="wealth-muted-block p-3">
                  <p className="text-xs text-muted-foreground">Refresh posture</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {marketPreferences.autoRefresh
                      ? `Every ${marketPreferences.pollingIntervalSeconds}s`
                      : "Manual / static"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {marketPreferences.autoRefresh
                      ? "Faster polling feels more live, but it also makes stale or rate-limited sources more obvious."
                      : "Turn refresh off when you want the screen to stay stable during walkthroughs."}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Use this for</p>
                <p className="mt-1 text-sm font-medium">Confidence in timing</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  These controls decide whether the market page feels live, conservative, or demo-safe.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Best demo posture</p>
                <p className="mt-1 text-sm font-medium">Fallback plus watchlist on</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  That keeps the screen dependable even when external pricing feeds are noisy.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Watch closely</p>
                <p className="mt-1 text-sm font-medium">Polling speed</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Faster intervals feel live, but they also make stale or rate-limited sources more obvious.
                </p>
              </div>
            </div>
            <div className="wealth-muted-block grid gap-3 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  First question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Do you want this page to feel live, or do you want it to stay calm and dependable during review sessions?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Pair source mode with refresh rhythm. Fast polling only helps if the upstream feed is trustworthy enough.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Keep fallback or slower refresh for demos, and only switch to livelier settings when fresh market motion genuinely helps.
                </p>
              </div>
            </div>
            <SegmentedControl
              label="Market source"
              options={[
                ["alpha-vantage", "Live source"],
                ["fallback", "Fallback only"],
              ]}
              value={marketPreferences.preferredSource}
              onChange={(value) =>
                onUpdateMarketPreferences({
                  ...marketPreferences,
                  preferredSource: value as MarketPreferences["preferredSource"],
                })
              }
            />
            <SegmentedControl
              label="Auto refresh"
              options={[
                ["on", "On"],
                ["off", "Off"],
              ]}
              value={marketPreferences.autoRefresh ? "on" : "off"}
              onChange={(value) =>
                onUpdateMarketPreferences({
                  ...marketPreferences,
                  autoRefresh: value === "on",
                })
              }
            />
            <SegmentedControl
              label="Holdings watch"
              options={[
                ["on", "On"],
                ["off", "Off"],
              ]}
              value={marketPreferences.includeHoldingsWatch ? "on" : "off"}
              onChange={(value) =>
                onUpdateMarketPreferences({
                  ...marketPreferences,
                  includeHoldingsWatch: value === "on",
                })
              }
            />
            <NumberField
              label="Polling interval (seconds)"
              value={marketPreferences.pollingIntervalSeconds}
              onChange={(value) =>
                onUpdateMarketPreferences({
                  ...marketPreferences,
                  pollingIntervalSeconds: Math.max(30, Math.round(value || 30)),
                })
              }
            />
          </CardContent>
        </Card>

        <Card className="wealth-panel-strong overflow-hidden">
          <CardHeader>
            <CardTitle>Safety: export preview</CardTitle>
            <CardDescription>Readable backup format for demos, checks, and recovery.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Snapshot size</p>
                <p className="mt-1 text-sm font-medium">{exportPreviewStats.charCount.toLocaleString()} chars</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Quick signal for whether you are exporting a full working state or a very sparse shell.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Readable lines</p>
                <p className="mt-1 text-sm font-medium">{exportPreviewStats.lineCount.toLocaleString()} lines</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  A useful sanity check before sharing or restoring the workspace elsewhere.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Portfolio story</p>
                <p className="mt-1 text-sm font-medium">{assets.length} holdings · {transactions.length} transactions</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Make sure the saved asset story and the journal story still match.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Market context</p>
                <p className="mt-1 text-sm font-medium">{exportPreviewStats.watchlistCount} watch item{exportPreviewStats.watchlistCount === 1 ? "" : "s"}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Helpful when you want the restored workspace to bring back the same market lens too.
                </p>
              </div>
            </div>
            <div className="wealth-inset grid gap-3 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  First question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Does this snapshot tell one coherent story across onboarding, portfolio, goals, and market watch state?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Check size, line count, and portfolio context together before treating the export as a clean restore point.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Use this preview right before resets, risky imports, or walkthroughs so the backup reflects the exact state you mean to preserve.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Why this matters</p>
                <p className="mt-1 text-sm font-medium">Readable before downloadable</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  You can inspect the exact snapshot shape before sharing it or restoring it elsewhere.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Best use</p>
                <p className="mt-1 text-sm font-medium">Spot-check the story</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Review whether goals, risk posture, and portfolio state all reflect the same narrative.
                </p>
              </div>
              <div className="wealth-muted-block p-3">
                <p className="text-xs text-muted-foreground">Best next move</p>
                <p className="mt-1 text-sm font-medium">Use it before resets</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  A quick visual check here helps avoid exporting stale or half-edited workspace data.
                </p>
              </div>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-5">
              {exportedSnapshot}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function buildEmailAttachmentWarnings({
  contentType,
  pageCount,
  usedOcr,
}: {
  contentType: string;
  pageCount: number;
  usedOcr: boolean;
}) {
  if (contentType !== "application/pdf") return [];

  const warnings: string[] = [];

  if (usedOcr) {
    warnings.push("OCR was used on the PDF attachment, so scheme names and numeric fields should be reviewed carefully.");
  }

  if (pageCount > 3) {
    warnings.push("The attachment spans more than 3 pages, so longer statements may need a cleaner export or multi-pass extraction.");
  }

  return warnings;
}

function ImportJobCard({
  correctionDraft,
  highlighted = false,
  highlightedNotice = null,
  job,
  onApplyToPortfolio,
  onCorrectionDraftChange,
  onReprocess,
  onSaveCorrection,
  onRetry,
  onUseInSyncPlan,
}: {
  correctionDraft: string;
  highlighted?: boolean;
  highlightedNotice?: string | null;
  job: ImportJob;
  onApplyToPortfolio: () => void;
  onCorrectionDraftChange: (value: string) => void;
  onReprocess: () => void;
  onSaveCorrection: () => void;
  onRetry: () => void;
  onUseInSyncPlan: () => void;
}) {
  const parserProfile = getProviderParserProfile(job.parserProfileId);
  const documentMetrics = getImportJobDocumentMetrics(job);
  const flowMeta = getImportJobFlowMeta(job);
  const historyActions = getImportJobHistoryActions(job);
  const outcomeStats = getImportJobOutcomeStats(job);
  const suggestedAction = getFocusedImportSuggestedAction(job, documentMetrics.hasPayload);
  const showFocusedCta = highlighted && suggestedAction.action !== "none";
  const focusedCtaDisabled =
    suggestedAction.action === "open-sync-plan" || suggestedAction.action === "apply-portfolio"
      ? !documentMetrics.hasPayload
      : false;
  const readyToApply = job.status === "reviewed" && (job.assetCount > 0 || job.transactionCount > 0);
  const importReadLabel =
    readyToApply
      ? "Ready to apply"
      : job.status === "failed"
        ? "Needs a cleaner source"
        : job.status === "completed"
          ? "Already merged"
          : documentMetrics.hasPayload
            ? "Needs review"
            : "Source missing";

  const handleFocusedCta = () => {
    if (suggestedAction.action === "open-sync-plan") {
      onUseInSyncPlan();
      return;
    }

    if (suggestedAction.action === "apply-portfolio") {
      onApplyToPortfolio();
    }
  };

  return (
    <div
      id={`import-job-${job.id}`}
      className={`rounded-md border bg-background p-3 transition-[box-shadow,transform] duration-700 ${highlighted ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{job.providerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {job.fileName} · {job.documentKind}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{job.status}</Badge>
          <Badge variant={flowMeta.badgeVariant}>{flowMeta.label}</Badge>
          <Badge variant="outline">{job.providerConfidence} confidence</Badge>
          {job.usedOcr && <Badge variant="outline">OCR</Badge>}
          <Badge variant={documentMetrics.hasPayload ? "secondary" : "outline"}>
            {documentMetrics.hasPayload ? "payload saved" : "no payload"}
          </Badge>
        </div>
      </div>
      {highlighted ? (
        <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">
            Brought into focus from the dashboard.
          </p>
          {highlightedNotice ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {highlightedNotice}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Best next step: <span className="font-medium text-foreground">{suggestedAction.title}</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {suggestedAction.detail}
          </p>
          {showFocusedCta ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                onClick={handleFocusedCta}
                disabled={focusedCtaDisabled}
              >
                {suggestedAction.title}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">{job.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{flowMeta.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{outcomeStats.fileLabel}</Badge>
        <Badge variant="outline">{outcomeStats.holdingsLabel}</Badge>
        <Badge variant="outline">{outcomeStats.transactionsLabel}</Badge>
        <Badge variant="outline">{outcomeStats.duplicatesLabel}</Badge>
        <Badge variant="outline">{outcomeStats.ocrLabel}</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.9fr]">
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">What this run means</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{importReadLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{suggestedAction.detail}</p>
        </div>
        <div className="wealth-stat-tile p-3">
          <p className="text-xs text-muted-foreground">Best next move</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{suggestedAction.title}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {documentMetrics.hasPayload
              ? "Reopen the saved payload when you want to inspect the parser again instead of starting from scratch."
              : "This job will need a new import source before it can move forward."}
          </p>
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Attempts {job.attemptCount}</span>
        <span>Warnings {job.rowWarnings.length}</span>
        <span>Corrections {job.reviewedCorrections.length}</span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Created {new Date(job.createdAt).toLocaleString()}</span>
        <span>
          Last action {job.lastActionAt ? new Date(job.lastActionAt).toLocaleString() : "not yet"}
        </span>
      </div>
      <div className="wealth-muted-block mt-3 grid gap-3 p-3 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-foreground">Document archive</p>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <span>Document {job.documentId}</span>
            <span>Storage {job.documentStoragePath ?? "not reserved yet"}</span>
            <span>Raw text {documentMetrics.rawLength} chars</span>
            <span>Normalized {documentMetrics.normalizedLength} chars</span>
            <span>Status lane {flowMeta.label}</span>
            <span>Input mode {outcomeStats.ocrLabel}</span>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-foreground">Reprocess source</p>
          </div>
          <pre className="max-h-28 overflow-auto rounded-md bg-background p-2 text-[11px] leading-5 text-muted-foreground">
            {documentMetrics.preview || "No saved statement text is available for this job."}
          </pre>
        </div>
      </div>
      {parserProfile && (
        <div className="wealth-muted-block mt-3 p-3">
          <p className="text-xs font-medium">Parser profile: {parserProfile.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Best input: {parserProfile.bestInputs[0]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Watch for: {parserProfile.commonPitfalls[0]}
          </p>
        </div>
      )}
      {job.notes && (
        <p className="mt-2 text-xs text-muted-foreground">{job.notes}</p>
      )}
      {job.rowWarnings.length > 0 && (
        <div className="wealth-muted-block mt-3 grid gap-2 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Warnings</p>
          {job.rowWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {job.reviewedCorrections.length > 0 && (
        <div className="wealth-muted-block mt-3 grid gap-2 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Reviewed corrections</p>
          {job.reviewedCorrections.map((correction) => (
            <p key={correction}>{correction}</p>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        <TextField
          label="Correction note"
          value={correctionDraft}
          onChange={onCorrectionDraftChange}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={onSaveCorrection}>
            {historyActions.correctionAction.label}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {historyActions.retryAction.label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onUseInSyncPlan}
          disabled={historyActions.syncPlanAction.disabled}
        >
          {historyActions.syncPlanAction.label}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onApplyToPortfolio}
          disabled={historyActions.applyAction.disabled}
        >
          {historyActions.applyAction.label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReprocess}
          disabled={historyActions.reprocessAction.disabled}
        >
          {historyActions.reprocessAction.label}
        </Button>
      </div>
    </div>
  );
}

function getImportJobDocumentMetrics(job: ImportJob) {
  const rawText = job.rawText.trim();
  const normalizedText = job.normalizedText.trim();
  const sourceText = rawText || normalizedText;

  return {
    hasPayload: Boolean(sourceText),
    normalizedLength: normalizedText.length,
    preview: createImportTextSnippet(sourceText),
    rawLength: rawText.length,
  };
}

function getFocusedImportSuggestedAction(job: ImportJob, hasPayload: boolean) {
  if (!hasPayload) {
    return {
      action: "none" as const,
      detail: "This job does not have reusable source text, so save a cleaner statement export or re-import the source before trying to apply it.",
      title: "Re-import a cleaner source",
    };
  }

  if (job.status === "completed") {
    return {
      action: "open-sync-plan" as const,
      detail: "This import is already part of the workspace, so the useful move now is reopening the sync plan if you want to inspect or replay the parsed source.",
      title: "Open in sync plan",
    };
  }

  if (job.status === "failed") {
    return {
      action: "open-sync-plan" as const,
      detail: "The parser still needs help here. Reopen the saved payload in the sync plan, clean the source, and run another review pass.",
      title: "Open in sync plan",
    };
  }

  if (job.status === "reviewed") {
    const hasImportableOutput = job.assetCount > 0 || job.transactionCount > 0;
    const action: "apply-portfolio" | "open-sync-plan" = hasImportableOutput
      ? "apply-portfolio"
      : "open-sync-plan";

    return {
      action,
      detail:
        hasImportableOutput
          ? "The review has importable holdings or transactions ready. Apply it to the workspace if the preview looks right, or reopen the sync plan to adjust first."
          : "The review is saved, but there are no usable holdings or transactions yet. Reopen the sync plan and improve the source text before applying anything.",
      title:
        hasImportableOutput
          ? "Apply to portfolio"
          : "Open in sync plan",
    };
  }

  return {
    action: "open-sync-plan" as const,
    detail: "This import is still early in the queue. Open the sync plan to inspect the source and move it into a proper reviewed state.",
    title: "Open in sync plan",
  };
}

function buildSyncPlanApplyMessage(
  providerName: string,
  result: NonNullable<ReturnType<typeof applySyncExecutionToPortfolio>>,
) {
  const parts: string[] = [];

  if (result.appliedAssetCount > 0) {
    parts.push(
      result.duplicateCount
        ? `Applied ${result.appliedAssetCount} holding${result.appliedAssetCount === 1 ? "" : "s"} from ${providerName} and merged ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? "" : "s"}.`
        : `Applied ${result.appliedAssetCount} holding${result.appliedAssetCount === 1 ? "" : "s"} from ${providerName}.`,
    );
  }

  if (result.appliedTransactionCount > 0) {
    parts.push(
      `Added ${result.appliedTransactionCount} transaction${result.appliedTransactionCount === 1 ? "" : "s"} from ${providerName}.`,
    );
  }

  return parts.join(" ") || `${providerName} sync plan applied.`;
}

function createImportTextSnippet(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
}

function SyncPlanCombinedOverviewCard({
  overview,
}: {
  overview: CombinedImportOverview;
}) {
  const items = [
    ["Holdings parsed", overview.holdingsParsed.toString()],
    ["Holding duplicates", overview.holdingsDuplicates.toString()],
    ["Transactions parsed", overview.transactionsParsed.toString()],
    ["Transactions new", overview.transactionsNew.toString()],
    ["Transactions skipped", overview.transactionDuplicates.toString()],
    ["Current value", formatMoney(overview.selectedCurrentValue)],
    ["Invested value", formatMoney(overview.selectedInvestedValue)],
  ];

  return (
    <div className="grid gap-3 rounded-md border bg-background p-4">
      <div>
        <p className="text-sm font-medium">Combined import overview</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{overview.headline}</p>
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

function ConnectionFields({
  connection,
  onChange,
}: {
  connection: IntegrationConnection;
  onChange: (connection: IntegrationConnection) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        label="Provider name"
        value={connection.providerName}
        onChange={(value) => onChange({ ...connection, providerName: value })}
      />
      <TextField
        label="Provider id"
        value={connection.providerId}
        onChange={(value) => onChange({ ...connection, providerId: value })}
      />
      <SegmentedControl
        label="Channel"
        options={[
          ["broker", "Broker"],
          ["email", "Email"],
          ["registrar", "Registrar"],
          ["file", "File"],
        ]}
        value={connection.channel}
        onChange={(value) =>
          onChange({ ...connection, channel: value as IntegrationConnection["channel"] })
        }
      />
      <SegmentedControl
        label="Status"
        options={[
          ["active", "Active"],
          ["paused", "Paused"],
          ["error", "Needs fix"],
        ]}
        value={connection.status}
        onChange={(value) =>
          onChange({ ...connection, status: value as IntegrationConnection["status"] })
        }
      />
      <SegmentedControl
        label="Import mode"
        options={[
          ["statement-upload", "Statements"],
          ["email-forward", "Email"],
          ["csv-upload", "CSV"],
          ["sync-ready", "Sync"],
        ]}
        value={connection.importStrategy}
        onChange={(value) =>
          onChange({
            ...connection,
            importStrategy: value as IntegrationConnection["importStrategy"],
          })
        }
      />
      <NumberField
        label="Sync cadence (minutes)"
        value={connection.syncCadenceMinutes}
        onChange={(value) =>
          onChange({
            ...connection,
            syncCadenceMinutes: Math.max(15, Math.round(value || 15)),
          })
        }
      />
      <div className="md:col-span-2">
        <TextField
          label="Source hint"
          value={connection.sourceHint}
          onChange={(value) => onChange({ ...connection, sourceHint: value })}
        />
      </div>
      <div className="md:col-span-2">
        <TextField
          label="Notes"
          value={connection.notes}
          onChange={(value) => onChange({ ...connection, notes: value })}
        />
      </div>
    </div>
  );
}
