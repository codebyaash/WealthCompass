"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  describeReadiness,
  importSourceDescriptors,
} from "@/lib/import-sources";
import {
  brokerProviderDescriptors,
  type BrokerConnection,
} from "@/lib/broker-connections";
import {
  inboxProviderDescriptors,
  type InboxConnection,
  type InboxProvider,
} from "@/lib/inbox-connections";
import type {
  EmailIngestionApiResponse,
  EmailIngestionResult,
} from "@/lib/email-ingestion";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getProviderParserProfile } from "@/lib/provider-parser-profiles";
import {
  buildIntegrationOperationsSummary,
  buildIntegrationSchedulerPlan,
  formatSyncTimeLabel,
  getIntegrationAttentionItems,
  getIntegrationHealthMetrics,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
} from "@/lib/integration-sync";
import type {
  ProviderSyncExecutionResult,
  ProviderSyncPreview,
} from "@/lib/provider-sync-adapters";
import {
  createIntegrationConnection,
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

export function DataSettings({
  answers,
  assets,
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
  marketPreferences,
  syncMessage,
  syncStatus,
  transactions,
  userEmail,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  integrations: IntegrationConnection[];
  importJobs: ImportJob[];
  onImportBrokerAssets: (assets: PortfolioAsset[], job: ImportJob) => void;
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
  const [actionMessage, setActionMessage] = useState("Full workspace export is ready.");
  const [jobCorrectionDrafts, setJobCorrectionDrafts] = useState<Record<string, string>>({});
  const [draftIntegration, setDraftIntegration] = useState<IntegrationConnection>(
    createIntegrationConnection({
      channel: "broker",
      providerId: "groww",
      providerName: "Groww",
      sourceHint: "Define the import path for this provider.",
    }),
  );
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
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
  const [syncPreviewProviderId, setSyncPreviewProviderId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<"all" | "completed" | "open" | "failed">("all");
  const [jobSearch, setJobSearch] = useState("");
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
  const operationsSummary = useMemo(
    () => buildIntegrationOperationsSummary(integrations),
    [integrations],
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
  const inboxConnectionMap = useMemo(
    () =>
      new Map(
        inboxConnections.map((connection) => [connection.provider, connection]),
      ),
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
            : "Supabase keys are configured. Sign in from /auth to enable cloud sync and connector auth."
          : "Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
        done: isSupabaseConfigured() && Boolean(userEmail),
        label: "Sign-in and cloud sync",
      },
      {
        detail:
          "Add ALPHA_VANTAGE_API_KEY in .env.local to replace fallback market snapshots with live refreshes.",
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
        label: "Paytm live account link",
      },
    ],
    [userEmail],
  );

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
    setDraftIntegration(createIntegrationConnection());
    setActionMessage("Integration added.");
  }

  async function handlePreviewSyncPlan(connection: IntegrationConnection) {
    try {
      const response = await fetch("/api/integration-sync", {
        body: JSON.stringify({
          connection,
          input: {
            fileName: syncInputFileName.trim() || undefined,
            sourceText: syncInputText.trim() || undefined,
          },
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
      setSyncPreviewProviderId(connection.id);
      setActionMessage(`${connection.providerName} sync plan loaded.`);
    } catch {
      setSyncExecution(null);
      setSyncPreview(null);
      setSyncPreviewProviderId(null);
      setActionMessage("Could not load the sync plan right now.");
    }
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

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Settings and data</CardTitle>
          <CardDescription>Manage the free MVP workspace, live market behavior, and connection records.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Demo setup checklist</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This is the shortest path from local MVP to a credible live demo.
              </p>
            </div>
            <div className="grid gap-3">
              {setupChecklist.map((item) => (
                <div key={item.label} className="rounded-md border bg-background p-3">
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

          <div className="rounded-md border bg-muted/30 p-4">
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

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Workspace export</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Includes onboarding answers, risk profile, portfolio, transactions, goals, and saved risk snapshots.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleCopySnapshot}>
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadSnapshot}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{actionMessage}</p>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Workspace import</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paste a `wealthcompass-data.json` export to restore onboarding, portfolio, transactions, goals, integrations, market preferences, and history.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleImportWorkspace}>
                <Upload className="h-4 w-4" />
                Import JSON
              </Button>
            </div>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="{ ... }"
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
            />
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Reset controls</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Demo resets are useful for walkthroughs, screenshots, and portfolio reviews.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleResetPortfolio}>
                <RotateCcw className="h-4 w-4" />
                Portfolio
              </Button>
              <Button type="button" variant="secondary" onClick={handleRestoreDemoWorkspace}>
                <RotateCcw className="h-4 w-4" />
                Demo workspace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Data snapshot</CardTitle>
            <CardDescription>Current local state prepared for future import and account portability.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Operations pulse</CardTitle>
            <CardDescription>
              See which sources are healthy, which ones are due, and which imports still need a human pass.
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
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Connector queue</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Next scheduled activity {formatSyncTimeLabel(schedulerPlan.nextRunAt)} with {schedulerPlan.readyCount} source{schedulerPlan.readyCount === 1 ? "" : "s"} ready for a first run and {schedulerPlan.pausedCount} paused.
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Import queue</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {importJobSummary.completedCount} completed, {importJobSummary.failedCount} failed, and {importJobSummary.ocrCount} OCR-backed import{importJobSummary.ocrCount === 1 ? "" : "s"} recorded so far.
                </p>
              </div>
            </div>
            <div className="grid gap-3 rounded-md border bg-background p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Needs attention now</p>
              </div>
              {attentionItems.length ? (
                <div className="grid gap-2">
                  {attentionItems.map((item) => (
                    <div key={item.id} className="rounded-md border bg-muted/30 p-3">
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

        <Card>
          <CardHeader>
            <CardTitle>Import connectors</CardTitle>
            <CardDescription>
              Email and broker intake is guided today, with sync-ready connection records and cadence tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-4">
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
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <ScanSearch className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Review before import</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Each imported file can now be analyzed for provider cues, OCR use, and statement quality before holdings are merged.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">Broker API connectors</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Start with Zerodha Kite so live holdings can be synced into the portfolio without manual exports.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadBrokerConnections()}>
                  <Database className="h-4 w-4" />
                  {isBrokerLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
              {brokerProviderDescriptors.map((provider) => {
                const connection = brokerConnectionMap.get(provider.id);

                return (
                  <div key={provider.id} className="grid gap-3 rounded-md border bg-background p-3">
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
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <span>Scopes {provider.scopes.length}</span>
                      <span>Account {connection?.accountLabel ?? "not connected"}</span>
                      <span>Last sync {connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : "not yet"}</span>
                      {connection?.errorMessage ? <span>{connection.errorMessage}</span> : null}
                    </div>
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
                        Sync holdings
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">Inbox OAuth connectors</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Connect Gmail or Outlook so statement emails can move into the import pipeline without manual forwarding payloads.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadInboxConnections()}>
                  <Mail className="h-4 w-4" />
                  {isInboxLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {inboxProviderDescriptors.map((provider) => {
                  const connection = inboxConnectionMap.get(provider.id);

                  return (
                    <div key={provider.id} className="grid gap-3 rounded-md border bg-background p-3">
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
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        <span>Scopes {provider.scopes.length}</span>
                        <span>
                          Account {connection?.providerAccountEmail ?? "not connected"}
                        </span>
                        <span>
                          Last sync {connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : "not yet"}
                        </span>
                        {connection?.errorMessage ? <span>{connection.errorMessage}</span> : null}
                      </div>
                      <Button type="button" size="sm" onClick={() => void handleConnectInbox(provider.id)}>
                        <Mail className="h-4 w-4" />
                        {connection?.status === "connected" ? `Reconnect ${provider.name}` : provider.connectLabel}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
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

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Connected sources</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Track which providers should keep feeding the portfolio pipeline and how often they should be checked.
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
              <div className="grid gap-3 rounded-md border bg-background p-3">
                <ConnectionFields
                  connection={draftIntegration}
                  onChange={setDraftIntegration}
                />
              </div>
              <div className="grid gap-3 rounded-md border bg-background p-3">
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
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-muted-foreground">Ready first run</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.readyCount}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-muted-foreground">Due now</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.dueCount}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-muted-foreground">Paused</p>
                    <p className="mt-2 font-semibold text-foreground">{schedulerPlan.pausedCount}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
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
                        <div key={entry.id} className="flex flex-col justify-between gap-1 rounded-md border bg-muted/30 p-3 text-xs sm:flex-row sm:items-center">
                          <span className="font-medium text-foreground">{entry.providerName}</span>
                          <span className="text-muted-foreground">{entry.reason}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid gap-3">
                {integrations.map((integration) => {
                  const isEditing = editingIntegrationId === integration.id;
                  const syncState = getIntegrationSyncState(integration);
                  const healthMetrics = getIntegrationHealthMetrics(integration);
                  const nextSyncAt = getNextIntegrationSyncAt(integration);

                  return (
                    <div key={integration.id} className="rounded-md border bg-background p-3">
                      {isEditing ? (
                        <ConnectionFields
                          connection={integration}
                          onChange={(nextConnection) =>
                            onUpdateIntegration(integration.id, nextConnection)
                          }
                        />
                      ) : (
                        <div className="grid gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{integration.providerName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {integration.channel} · {integration.importStrategy}
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
                          <p className="text-[11px] text-muted-foreground">
                            Last sync {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "not yet"}
                            {integration.lastSyncOrigin ? ` · ${integration.lastSyncOrigin}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Result {integration.lastSyncStatus} · files {integration.lastImportedFileCount}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Scheduler {integration.lastSchedulerStatus} · {integration.lastSchedulerCheckAt ? new Date(integration.lastSchedulerCheckAt).toLocaleString() : "not checked yet"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Success {healthMetrics.successRate}% · avg files {healthMetrics.averageImportedFiles.toFixed(1)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Next check {formatSyncTimeLabel(nextSyncAt)}{nextSyncAt ? ` · ${new Date(nextSyncAt).toLocaleString()}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {syncState.detail}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Last healthy sync {healthMetrics.lastHealthySyncAt ? new Date(healthMetrics.lastHealthySyncAt).toLocaleString() : "not yet"}
                            {healthMetrics.warningStreak ? ` · warning streak ${healthMetrics.warningStreak}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {integration.lastSyncMessage}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {integration.lastSchedulerMessage}
                          </p>
                          {integration.lastDetectedProviderSummary && (
                            <p className="text-[11px] text-muted-foreground">
                              {integration.lastDetectedProviderSummary}
                            </p>
                          )}
                          {integration.syncHistory.length > 0 && (
                            <div className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Recent sync events
                              </p>
                              {integration.syncHistory.slice(0, 3).map((event) => (
                                <div key={event.id} className="grid gap-1 text-[11px] text-muted-foreground">
                                  <p>
                                    {new Date(event.syncedAt).toLocaleString()} · {event.status} · files {event.importedFileCount}
                                  </p>
                                  <p>{event.message}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handlePreviewSyncPlan(integration)}
                        >
                          <ScanSearch className="h-4 w-4" />
                          Sync plan
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onRunIntegrationSync(integration.id)}
                        >
                          <Cloud className="h-4 w-4" />
                          Sync now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
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
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import job history</CardTitle>
            <CardDescription>
              Track statement reviews, completed imports, and failures so provider-specific workflows can improve over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
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
            </div>
            {filteredImportJobs.length ? filteredImportJobs.map((job) => (
              <ImportJobCard
                key={job.id}
                correctionDraft={jobCorrectionDrafts[job.id] ?? ""}
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
              />
            )) : (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                No import jobs match this filter yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider sync plan</CardTitle>
            <CardDescription>
              Preview how each source will execute through the WealthCompass sync pipeline before direct connectors are added.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {syncPreview ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{syncPreview.providerName}</Badge>
                  <Badge variant="outline">{syncPreview.readinessLabel}</Badge>
                  <Badge variant="outline">{syncPreview.connectorStatus}</Badge>
                  {syncPreviewProviderId && (
                    <Badge variant="outline">{syncPreviewProviderId}</Badge>
                  )}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {syncPreview.summary}
                </p>
                {syncExecution && (
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium">Execution status</p>
                      <p className="mt-2 text-xs text-muted-foreground">{syncExecution.connectorStatus}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Import inputs</p>
                      <p className="mt-2 text-xs text-muted-foreground">{syncExecution.importedFileCount}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Job handoff</p>
                      <p className="mt-2 text-xs text-muted-foreground">{syncExecution.jobStatus}</p>
                    </div>
                  </div>
                )}
                <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
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
                  <div className="rounded-md border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Recommended inputs</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      {syncPreview.recommendedFiles.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Watchouts</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      {syncPreview.risks.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                </div>
                {syncExecution?.artifacts.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {syncExecution.artifacts.map((artifact) => (
                      <div key={`${artifact.kind}-${artifact.label}`} className="rounded-md border bg-muted/30 p-4">
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
                    <div key={`${step.stage}-${step.title}`} className="rounded-md border bg-background p-4">
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
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Execution warnings</p>
                    {syncExecution.reviewedWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                {syncExecution?.sourceLineage.length ? (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Source lineage</p>
                    {syncExecution.sourceLineage.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                Pick any connected source and open its sync plan to inspect the exact execution path we expect for that provider.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live market controls</CardTitle>
            <CardDescription>
              Control continuous market polling and how often the market dashboard refreshes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle>Export preview</CardTitle>
            <CardDescription>Readable backup format for demos and debugging.</CardDescription>
          </CardHeader>
          <CardContent>
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
  job,
  onCorrectionDraftChange,
  onReprocess,
  onSaveCorrection,
  onRetry,
}: {
  correctionDraft: string;
  job: ImportJob;
  onCorrectionDraftChange: (value: string) => void;
  onReprocess: () => void;
  onSaveCorrection: () => void;
  onRetry: () => void;
}) {
  const parserProfile = getProviderParserProfile(job.parserProfileId);
  const documentMetrics = getImportJobDocumentMetrics(job);

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{job.providerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {job.fileName} · {job.documentKind}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{job.status}</Badge>
          <Badge variant="outline">{job.providerConfidence} confidence</Badge>
          {job.usedOcr && <Badge variant="outline">OCR</Badge>}
          <Badge variant={documentMetrics.hasPayload ? "secondary" : "outline"}>
            {documentMetrics.hasPayload ? "payload saved" : "no payload"}
          </Badge>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{job.summary}</p>
      <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Assets {job.assetCount}</span>
        <span>Duplicates {job.duplicateCount}</span>
        <span>Attempts {job.attemptCount}</span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Created {new Date(job.createdAt).toLocaleString()}</span>
        <span>
          Last action {job.lastActionAt ? new Date(job.lastActionAt).toLocaleString() : "not yet"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-[0.8fr_1.2fr]">
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
            <span>Warnings {job.rowWarnings.length}</span>
            <span>Corrections {job.reviewedCorrections.length}</span>
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
        <div className="mt-3 rounded-md border bg-muted/30 p-3">
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
        <div className="mt-3 grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Warnings</p>
          {job.rowWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {job.reviewedCorrections.length > 0 && (
        <div className="mt-3 grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
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
            Save correction
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry review
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReprocess}
          disabled={!documentMetrics.hasPayload}
        >
          Reprocess
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

function createImportTextSnippet(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
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
