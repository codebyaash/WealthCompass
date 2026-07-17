"use client";

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import type { SetStateAction } from "react";
import { Academy } from "@/components/wealth/academy";
import { AppHeader } from "@/components/wealth/app-header";
import { AppSidebar, type ActiveView } from "@/components/wealth/app-sidebar";
import { DataSettings } from "@/components/wealth/data-settings";
import { Dashboard } from "@/components/wealth/dashboard";
import { Goals } from "@/components/wealth/goals";
import { MarketDashboard } from "@/components/wealth/market-dashboard";
import { MentorPanel } from "@/components/wealth/mentor-panel";
import { Onboarding } from "@/components/wealth/onboarding";
import { Portfolio } from "@/components/wealth/portfolio";
import { RiskHistory } from "@/components/wealth/risk-history";
import {
  defaultRiskAnswers,
  portfolioAssets,
  portfolioTransactions,
} from "@/lib/sample-data";
import {
  createIntegrationConnection,
  coerceIntegrations,
  coercePortfolioAssets,
  type ImportJob,
  createRiskHistoryItem,
  emptySignedInSnapshot,
  loadSignedInWorkspaceCache,
  loadSnapshot,
  loadRiskHistory,
  saveRiskHistory,
  saveSignedInWorkspaceCache,
  saveSnapshot,
  type IntegrationConnection,
  type MarketPreferences,
  type PortfolioAsset,
  type PortfolioTransaction,
  type RiskHistoryItem,
  type WealthCompassImport,
  type WealthGoal,
  workspaceHasMeaningfulUserData,
  createWealthGoal,
  defaultGoals,
} from "@/lib/local-storage";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { createImportJobFromReview } from "@/lib/import-jobs";
import { previewPortfolioImport } from "@/lib/csv-import";
import { buildImportDiagnostics } from "@/lib/import-diagnostics";
import {
  getConnectorAttentionSummary,
  executeIntegrationSyncBatch,
} from "@/lib/integration-sync";
import { detectImportSource } from "@/lib/import-sources";
import { analyzeImportDocument } from "@/lib/import-review";
import { normalizeImportTextForProvider } from "@/lib/provider-import-normalizers";
import {
  loadCloudSnapshot,
  loadRiskProfileHistory,
  saveCloudSnapshot,
  saveRiskProfileHistory,
} from "@/lib/supabase-sync";
import { derivePortfolioAssetsFromTransactions } from "@/lib/portfolio-rules";
import {
  calculateGoalMonthlyInvestment,
  calculateRiskProfile,
  type RiskAnswers,
} from "@/lib/wealth-rules";

type SyncStatus =
  | "Local demo"
  | "Local saved"
  | "Loading cloud"
  | "Changes pending"
  | "Syncing"
  | "Cloud synced"
  | "Cloud error";

export function WealthCompassApp() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [answers, setAnswers] = useState<RiskAnswers>(defaultRiskAnswers);
  const [assets, setAssets] = useState<PortfolioAsset[]>(portfolioAssets);
  const [goals, setGoals] = useState<WealthGoal[]>(defaultGoals);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [marketPreferences, setMarketPreferences] = useState<MarketPreferences>({
    autoRefresh: true,
    includeHoldingsWatch: true,
    pollingIntervalSeconds: 60,
    preferredSource: "alpha-vantage",
  });
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryItem[]>([]);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseConfigured() ? "Local saved" : "Local demo",
  );
  const [syncMessage, setSyncMessage] = useState("Browser autosave is active.");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasHydratedCloudWorkspace, setHasHydratedCloudWorkspace] = useState(false);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [lastSyncedRevision, setLastSyncedRevision] = useState(0);
  const [isCloudSaveInFlight, setIsCloudSaveInFlight] = useState(false);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const workspaceRevisionRef = useRef(0);

  function resetWorkspaceSyncTracking() {
    workspaceRevisionRef.current = 0;
    setWorkspaceRevision(0);
    setLastSyncedRevision(0);
    setIsCloudSaveInFlight(false);
  }

  function markWorkspaceChanged(message: string) {
    if (userId && supabase && hasHydratedCloudWorkspace) {
      const nextRevision = workspaceRevisionRef.current + 1;
      workspaceRevisionRef.current = nextRevision;
      setWorkspaceRevision(nextRevision);
      setSyncStatus("Changes pending");
      setSyncMessage(message);
      return;
    }

    setSyncStatus(isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage(message);
  }

  function applySnapshotState(snapshot: {
    answers: RiskAnswers;
    assets: PortfolioAsset[];
    goals: WealthGoal[];
    importJobs: ImportJob[];
    integrations: IntegrationConnection[];
    marketPreferences: MarketPreferences;
    transactions: PortfolioTransaction[];
  }) {
    const derivedAssets = snapshot.transactions.length
      ? derivePortfolioAssetsFromTransactions(snapshot.transactions, snapshot.assets)
      : snapshot.assets;

    setAnswers(snapshot.answers);
    setAssets(derivedAssets);
    setGoals(snapshot.goals);
    setIntegrations(snapshot.integrations);
    setImportJobs(snapshot.importJobs);
    setMarketPreferences(snapshot.marketPreferences);
    setTransactions(snapshot.transactions);

    return derivedAssets;
  }

  useEffect(() => {
    if (isSupabaseConfigured()) {
      applySnapshotState(emptySignedInSnapshot);
      setRiskHistory([]);
      resetWorkspaceSyncTracking();
      return;
    }

    const snapshot = loadSnapshot();
    applySnapshotState(snapshot);
    setRiskHistory(loadRiskHistory());
    resetWorkspaceSyncTracking();
    setHasLoadedSnapshot(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSnapshot) return;
    const snapshot = {
      answers,
      assets,
      goals,
      integrations,
      importJobs,
      marketPreferences,
      transactions,
    };
    saveSnapshot(snapshot);

    if (userId) {
      saveSignedInWorkspaceCache({
        riskHistory,
        snapshot,
        userId,
      });
    }
  }, [
    answers,
    assets,
    goals,
    hasLoadedSnapshot,
    importJobs,
    integrations,
    marketPreferences,
    riskHistory,
    transactions,
    userId,
  ]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const client = supabase;

    async function hydrateWorkspaceForUser(user: NonNullable<Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"]>["user"]) {
      if (!isMounted) return;

      const cachedWorkspace = loadSignedInWorkspaceCache(user.id);
      setHasHydratedCloudWorkspace(false);
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setSyncStatus("Loading cloud");
      setSyncMessage("Loading your Supabase workspace.");

      try {
        const snapshot = await loadCloudSnapshot(client, user.id);
        if (!isMounted) return;
        const history = await loadRiskProfileHistory(client, user.id);
        if (!isMounted) return;
        const shouldRestoreCachedWorkspace =
          cachedWorkspace !== null &&
          workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory) &&
          !workspaceHasMeaningfulUserData(snapshot, history);
        const resolvedSnapshot = shouldRestoreCachedWorkspace
          ? cachedWorkspace.snapshot
          : snapshot;
        const resolvedHistory = shouldRestoreCachedWorkspace
          ? cachedWorkspace.riskHistory
          : history;
        const derivedAssets = applySnapshotState(resolvedSnapshot);
        saveSnapshot({ ...resolvedSnapshot, assets: derivedAssets });
        saveSignedInWorkspaceCache({
          riskHistory: resolvedHistory,
          snapshot: { ...resolvedSnapshot, assets: derivedAssets },
          userId: user.id,
        });
        setRiskHistory(resolvedHistory);
        saveRiskHistory(resolvedHistory);
        resetWorkspaceSyncTracking();
        setSyncStatus("Cloud synced");
        setSyncMessage(
          shouldRestoreCachedWorkspace
            ? "Loaded your last saved browser copy while cloud data catches up."
            : snapshot.assets.length || snapshot.transactions.length || snapshot.goals.length
              ? "Loaded your saved Supabase data."
              : "Signed in with a clean workspace. Add your own portfolio to begin tracking.",
        );
        setHasHydratedCloudWorkspace(true);
        setHasLoadedSnapshot(true);
      } catch (error) {
        if (!isMounted) return;
        if (
          cachedWorkspace !== null &&
          workspaceHasMeaningfulUserData(cachedWorkspace.snapshot, cachedWorkspace.riskHistory)
        ) {
          const derivedAssets = applySnapshotState(cachedWorkspace.snapshot);
          setRiskHistory(cachedWorkspace.riskHistory);
          saveSnapshot({ ...cachedWorkspace.snapshot, assets: derivedAssets });
          saveRiskHistory(cachedWorkspace.riskHistory);
          setSyncStatus("Cloud error");
          setSyncMessage("Cloud refresh failed, so the last saved browser copy was restored.");
        } else {
          setSyncStatus("Cloud error");
          setSyncMessage(getErrorMessage(error));
        }
        resetWorkspaceSyncTracking();
        setHasHydratedCloudWorkspace(true);
        setHasLoadedSnapshot(true);
      }
    }

    async function loadSession() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;

      if (!isMounted) return;
      if (!user) {
        const snapshot = loadSnapshot();
        applySnapshotState(snapshot);
        setRiskHistory(loadRiskHistory());
        resetWorkspaceSyncTracking();
        setHasHydratedCloudWorkspace(true);
        setHasLoadedSnapshot(true);
        setSyncStatus("Local saved");
        setSyncMessage("Browser autosave is active.");
        return;
      }

      await hydrateWorkspaceForUser(user);
    }

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        const snapshot = loadSnapshot();
        applySnapshotState(snapshot);
        setRiskHistory(loadRiskHistory());
        setUserId("");
        setUserEmail("");
        resetWorkspaceSyncTracking();
        setHasHydratedCloudWorkspace(true);
        setHasLoadedSnapshot(true);
        setSyncStatus("Local saved");
        setSyncMessage("Signed out. Browser autosave is active.");
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        void hydrateWorkspaceForUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (
      !hasLoadedSnapshot ||
      !supabase ||
      !userId ||
      !hasHydratedCloudWorkspace ||
      isCloudSaveInFlight ||
      workspaceRevision === lastSyncedRevision
    ) {
      return;
    }

    const client = supabase;
    const targetRevision = workspaceRevision;

    const timeoutId = window.setTimeout(async () => {
      setIsCloudSaveInFlight(true);
      setSyncStatus("Syncing");
      setSyncMessage("Saving profile, portfolio, and goal data.");

      try {
        await saveCloudSnapshot({
          snapshot: {
            answers,
            assets,
            goals,
            integrations,
            importJobs,
            marketPreferences,
            transactions,
          },
          supabase: client,
          userId,
        });
        setLastSyncedRevision(targetRevision);
        if (workspaceRevisionRef.current > targetRevision) {
          setSyncStatus("Changes pending");
          setSyncMessage("More changes are waiting to sync.");
        } else {
          setSyncStatus("Cloud synced");
          setSyncMessage("Cloud save complete.");
        }
      } catch (error) {
        setSyncStatus("Cloud error");
        setSyncMessage(getErrorMessage(error));
      } finally {
        setIsCloudSaveInFlight(false);
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [
    answers,
    assets,
    goals,
    hasLoadedSnapshot,
    integrations,
    isCloudSaveInFlight,
    importJobs,
    lastSyncedRevision,
    marketPreferences,
    supabase,
    transactions,
    hasHydratedCloudWorkspace,
    userId,
    workspaceRevision,
  ]);

  const safeAssets = useMemo(() => coercePortfolioAssets(assets, []), [assets]);
  const safeIntegrations = useMemo(() => coerceIntegrations(integrations, []), [integrations]);
  const profile = useMemo(() => calculateRiskProfile(answers), [answers]);
  const connectorAttention = useMemo(
    () => getConnectorAttentionSummary(safeIntegrations),
    [safeIntegrations],
  );
  const isCloudWorkspaceInitializing = Boolean(supabase) && !hasHydratedCloudWorkspace;
  const isFreshWorkspace =
    userId.length > 0 &&
    safeAssets.length === 0 &&
    goals.length === 0 &&
    safeIntegrations.length === 0 &&
    importJobs.length === 0 &&
    transactions.length === 0;
  const portfolioTotal = safeAssets.reduce((sum, asset) => sum + asset.value, 0);
  const monthlyGoal = goals.reduce(
    (sum, goal) => sum + calculateGoalMonthlyInvestment(goal),
    0,
  );
  const healthScore = Math.round(
    (profile.score * 0.35) +
      (answers.emergencyMonths >= 6 ? 22 : answers.emergencyMonths * 3) +
      (answers.debtLevel === "heavy" ? 4 : answers.debtLevel === "none" ? 20 : 13) +
      16,
  );

  function handleUpdateAnswers(nextAnswers: SetStateAction<RiskAnswers>) {
    setAnswers(nextAnswers);
    markWorkspaceChanged(
      userId
        ? "Profile answers updated. Saving your workspace."
        : "Profile answers updated in this browser.",
    );
  }

  async function handleSaveRiskHistory() {
    const historyItem = createRiskHistoryItem(profile);
    const nextHistory = [historyItem, ...riskHistory].slice(0, 12);
    setRiskHistory(nextHistory);
    saveRiskHistory(nextHistory);

    if (!supabase || !userId) {
      setSyncStatus(isSupabaseConfigured() ? "Local saved" : "Local demo");
      setSyncMessage("Risk profile saved in this browser.");
      return;
    }

    setSyncStatus("Syncing");
    setSyncMessage("Saving risk profile snapshot.");
    setIsCloudSaveInFlight(true);
    const targetRevision = workspaceRevisionRef.current;

    try {
      await saveCloudSnapshot({
        snapshot: {
          answers,
          assets,
          goals,
          integrations,
          importJobs,
          marketPreferences,
          transactions,
        },
        supabase,
        userId,
      });
      await saveRiskProfileHistory({
        answers,
        profile,
        supabase,
        userId,
      });
      const history = await loadRiskProfileHistory(supabase, userId);
      setRiskHistory(history);
      saveRiskHistory(history);
      setLastSyncedRevision(targetRevision);
      if (workspaceRevisionRef.current > targetRevision) {
        setSyncStatus("Changes pending");
        setSyncMessage("Risk snapshot saved. More workspace changes are still pending.");
      } else {
        setSyncStatus("Cloud synced");
        setSyncMessage("Risk profile and workspace saved to cloud.");
      }
    } catch (error) {
      setSyncStatus("Cloud error");
      setSyncMessage(getErrorMessage(error));
    } finally {
      setIsCloudSaveInFlight(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function handleResetPortfolio() {
    if (userId) {
      setAssets([]);
      setTransactions([]);
      setImportJobs([]);
      markWorkspaceChanged("Tracked portfolio data cleared for this signed-in workspace.");
      return;
    }

    setAssets(derivePortfolioAssetsFromTransactions(portfolioTransactions, portfolioAssets));
    setTransactions(portfolioTransactions);
    markWorkspaceChanged("Portfolio restored to demo holdings.");
  }

  function handleUpdateAsset(assetIndex: number, nextAsset: PortfolioAsset) {
    setAssets((current) =>
      current.map((asset, index) => (index === assetIndex ? nextAsset : asset)),
    );
    markWorkspaceChanged("Portfolio holding updated.");
  }

  function handleAddAsset(nextAsset: PortfolioAsset) {
    setAssets((current) => [nextAsset, ...current]);
    markWorkspaceChanged("Portfolio holding added.");
  }

  function handleImportAssets(nextAssets: PortfolioAsset[]) {
    setAssets(nextAssets);
    markWorkspaceChanged("Portfolio import applied.");
  }

  function handleImportBrokerAssets(nextAssets: PortfolioAsset[], job: ImportJob) {
    setAssets(nextAssets);
    setImportJobs((current) => [job, ...current].slice(0, 20));
    markWorkspaceChanged("Broker holdings sync applied.");
  }

  function handleDeleteAsset(assetIndex: number) {
    setAssets((current) => current.filter((_, index) => index !== assetIndex));
    markWorkspaceChanged("Portfolio holding removed.");
  }

  function handleAddTransaction(nextTransaction: PortfolioTransaction) {
    setTransactions((current) => {
      const nextTransactions = [nextTransaction, ...current];
      setAssets((assetsState) =>
        derivePortfolioAssetsFromTransactions(nextTransactions, assetsState),
      );
      return nextTransactions;
    });
    markWorkspaceChanged("Transaction recorded.");
  }

  function handleDeleteTransaction(transactionId: string) {
    setTransactions((current) => {
      const nextTransactions = current.filter(
        (transaction) => transaction.id !== transactionId,
      );
      setAssets((assetsState) =>
        derivePortfolioAssetsFromTransactions(nextTransactions, assetsState),
      );
      return nextTransactions;
    });
    markWorkspaceChanged("Transaction removed.");
  }

  function handleRestoreDemoWorkspace() {
    if (userId) {
      setAnswers(emptySignedInSnapshot.answers);
      setAssets(emptySignedInSnapshot.assets);
      setGoals(emptySignedInSnapshot.goals);
      setIntegrations(emptySignedInSnapshot.integrations);
      setImportJobs(emptySignedInSnapshot.importJobs);
      setMarketPreferences(emptySignedInSnapshot.marketPreferences);
      setTransactions(emptySignedInSnapshot.transactions);
      setRiskHistory([]);
      saveRiskHistory([]);
      markWorkspaceChanged("Signed-in workspace cleared. Add your own portfolio to begin tracking.");
      return;
    }

    setAnswers(defaultRiskAnswers);
    setAssets(derivePortfolioAssetsFromTransactions(portfolioTransactions, portfolioAssets));
    setGoals(defaultGoals);
    setIntegrations([
      createIntegrationConnection({
        channel: "broker",
        id: "integration-paytm-money",
        importStrategy: "statement-upload",
        notes: "Primary broker workflow for guided statement imports.",
        providerId: "paytm-money",
        providerName: "Paytm Money",
        sourceHint: "Upload account statements or CSV exports first.",
        status: "active",
        syncCadenceMinutes: 720,
      }),
      createIntegrationConnection({
        channel: "email",
        id: "integration-email-forward",
        importStrategy: "email-forward",
        notes: "Use forwarded statements and PDF attachments until inbox OAuth is added.",
        providerId: "email-forward",
        providerName: "Email Forward",
        sourceHint: "Forward broker statements to yourself and paste or upload them here.",
        status: "active",
        syncCadenceMinutes: 1440,
      }),
    ]);
    setImportJobs([]);
    setMarketPreferences({
      autoRefresh: true,
      includeHoldingsWatch: true,
      pollingIntervalSeconds: 60,
      preferredSource: "alpha-vantage",
    });
    setTransactions(portfolioTransactions);
    setRiskHistory([]);
    saveRiskHistory([]);
    markWorkspaceChanged(
      userId
        ? "Demo workspace restored. Profile, portfolio, and goal changes will sync; cloud history is retained."
        : "Demo workspace restored in this browser.",
    );
  }

  function handleImportWorkspace(workspace: WealthCompassImport) {
    const derivedAssets = workspace.transactions.length
      ? derivePortfolioAssetsFromTransactions(workspace.transactions, workspace.assets)
      : workspace.assets;
    setAnswers(workspace.answers);
    setAssets(derivedAssets);
    setGoals(workspace.goals);
    setIntegrations(workspace.integrations);
    setImportJobs(workspace.importJobs);
    setMarketPreferences(workspace.marketPreferences);
    setTransactions(workspace.transactions);
    setRiskHistory(workspace.riskHistory);
    saveRiskHistory(workspace.riskHistory);
    markWorkspaceChanged("Imported workspace data.");
  }

  function handleAddGoal() {
    setGoals((current) => [createWealthGoal(), ...current]);
    markWorkspaceChanged("Goal added.");
  }

  function handleUpdateGoal(goalId: string, nextGoal: WealthGoal) {
    setGoals((current) => current.map((goal) => (goal.id === goalId ? nextGoal : goal)));
    markWorkspaceChanged("Goal updated.");
  }

  function handleDeleteGoal(goalId: string) {
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
    markWorkspaceChanged("Goal removed.");
  }

  function handleAddIntegration(connection: IntegrationConnection) {
    setIntegrations((current) => [connection, ...current]);
    markWorkspaceChanged("Integration connection added.");
  }

  function handleUpdateIntegration(connectionId: string, nextConnection: IntegrationConnection) {
    setIntegrations((current) =>
      current.map((connection) =>
        connection.id === connectionId ? nextConnection : connection,
      ),
    );
    markWorkspaceChanged("Integration updated.");
  }

  function handleDeleteIntegration(connectionId: string) {
    setIntegrations((current) =>
      current.filter((connection) => connection.id !== connectionId),
    );
    markWorkspaceChanged("Integration removed.");
  }

  function handleUpdateMarketPreferences(nextPreferences: MarketPreferences) {
    setMarketPreferences(nextPreferences);
    markWorkspaceChanged("Market preferences updated.");
  }

  async function handleRunIntegrationSync(connectionId?: string) {
    const mode = connectionId ? "single" : "all-active";
    const targetConnections = safeIntegrations.filter((connection) =>
      mode === "single"
        ? connection.id === connectionId && connection.status === "active"
        : connection.status === "active",
    );

    if (!targetConnections.length) {
      markWorkspaceChanged("No active integration sources were available to sync.");
      return;
    }

    markWorkspaceChanged(
      mode === "single"
        ? `Running ${targetConnections[0].providerName} sync checkpoint.`
        : `Running ${targetConnections.length} integration sync checkpoints.`,
    );

    try {
      const response = await fetch("/api/integration-sync", {
        body: JSON.stringify({
          connectionId,
          importJobs,
          integrations: safeIntegrations,
          mode,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Integration sync route unavailable.");
      }

      const result = (await response.json()) as {
        importJobs: ImportJob[];
        integrations: IntegrationConnection[];
        syncedConnectionIds: string[];
      };

      setIntegrations(result.integrations);
      setImportJobs(result.importJobs);
      markWorkspaceChanged(
        result.syncedConnectionIds.length === 1
          ? `${targetConnections[0].providerName} sync checkpoint recorded.`
          : `${result.syncedConnectionIds.length} integration sync checkpoints recorded.`,
      );
    } catch {
      const fallback = executeIntegrationSyncBatch(safeIntegrations, {
        connectionId,
        importJobs,
        mode,
      });

      setIntegrations(fallback.integrations);
      setImportJobs(fallback.importJobs);
      markWorkspaceChanged(
        fallback.syncedConnectionIds.length === 1
          ? `${targetConnections[0].providerName} sync checkpoint recorded locally.`
          : `${fallback.syncedConnectionIds.length} integration sync checkpoints recorded locally.`,
      );
    }
  }

  function handleLogImportJob(job: ImportJob) {
    setImportJobs((current) => [job, ...current].slice(0, 20));
    markWorkspaceChanged("Import job saved.");
  }

  function handleUpdateImportJob(jobId: string, nextJob: ImportJob) {
    setImportJobs((current) =>
      current.map((job) => (job.id === jobId ? nextJob : job)),
    );
    markWorkspaceChanged("Import job updated.");
  }

  function handleReprocessImportJob(jobId: string) {
    setImportJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job;

        const sourceText = job.rawText || job.normalizedText;

        if (!sourceText.trim()) {
          return {
            ...job,
            attemptCount: job.attemptCount + 1,
            lastActionAt: new Date().toISOString(),
            notes: "Reprocess requested, but no saved import payload was available.",
            status: "failed",
            summary: `${job.providerName} import could not be reprocessed without saved text.`,
          };
        }

        const detectedSource = detectImportSource({
          fileName: job.fileName,
          text: sourceText,
        });
        const normalized = normalizeImportTextForProvider({
          providerId: detectedSource?.id ?? job.providerId,
          text: sourceText,
        });
        const review = analyzeImportDocument({
          fileName: job.fileName,
          normalizationApplied: normalized.applied,
          text: normalized.text,
          usedOcr: job.usedOcr,
        });
        const preview = previewPortfolioImport(normalized.text, assets);
        const diagnostics = buildImportDiagnostics({
          normalizedText: normalized.text,
          preview,
          rawText: sourceText,
        });
        const nextJob = createImportJobFromReview({
          assetCount: preview.assets.length,
          duplicateCount: preview.duplicates.length,
          fileName: job.fileName,
          notes: "Job reprocessed from saved payload.",
          normalizationApplied: normalized.applied,
          normalizedText: normalized.text,
          rawText: sourceText,
          reviewedCorrections: job.reviewedCorrections,
          review,
          rowWarnings: diagnostics.rowWarnings,
          status: "reviewed",
        });

        return {
          ...nextJob,
          attemptCount: job.attemptCount + 1,
          createdAt: job.createdAt,
          id: job.id,
        };
      }),
    );
    markWorkspaceChanged("Import job reprocessed.");
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:flex-row lg:py-6">
        <AppSidebar activeView={activeView} onNavigate={setActiveView} />

        <section className="min-w-0 flex-1">
          <AppHeader
            connectorAttention={connectorAttention}
            onSaveRiskHistory={handleSaveRiskHistory}
            onSignOut={handleSignOut}
            profile={profile}
            showProfileContext={!isFreshWorkspace}
            syncMessage={syncMessage}
            syncStatus={syncStatus}
            userEmail={userEmail}
          />
          {isCloudWorkspaceInitializing ? (
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium">Preparing your workspace</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We are loading your signed-in data before the app becomes editable.
              </p>
            </div>
          ) : activeView === "dashboard" ? (
            <Dashboard
              assets={safeAssets}
              goals={goals}
              healthScore={healthScore}
              integrations={safeIntegrations}
              monthlyGoal={monthlyGoal}
              onNavigate={(view) => setActiveView(view)}
              portfolioTotal={portfolioTotal}
              profile={profile}
              transactions={transactions}
            />
          ) : activeView === "onboarding" ? (
            <Onboarding answers={answers} onChange={handleUpdateAnswers} profile={profile} />
          ) : activeView === "academy" ? <Academy /> : activeView === "portfolio" ? (
            <Portfolio
              assets={safeAssets}
              onAddAsset={handleAddAsset}
              onAddTransaction={handleAddTransaction}
              onDeleteAsset={handleDeleteAsset}
              onDeleteTransaction={handleDeleteTransaction}
              onImportAssets={handleImportAssets}
              onLogImportJob={handleLogImportJob}
              onResetAssets={handleResetPortfolio}
              onUpdateAsset={handleUpdateAsset}
              portfolioTotal={portfolioTotal}
              profile={profile}
              transactions={transactions}
            />
          ) : activeView === "goals" ? (
            <Goals
              goals={goals}
              monthlyGoal={monthlyGoal}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
              onUpdateGoal={handleUpdateGoal}
            />
          ) : activeView === "history" ? (
            <RiskHistory history={riskHistory} profile={profile} />
          ) : activeView === "market" ? (
            <MarketDashboard
              assets={safeAssets}
              integrations={safeIntegrations}
              marketPreferences={marketPreferences}
              onRunIntegrationSync={handleRunIntegrationSync}
              onUpdatePreferences={handleUpdateMarketPreferences}
            />
          ) : activeView === "mentor" ? (
            <MentorPanel answers={answers} assets={safeAssets} profile={profile} />
          ) : activeView === "settings" ? (
            <DataSettings
              answers={answers}
              assets={safeAssets}
              goals={goals}
              integrations={safeIntegrations}
              importJobs={importJobs}
              onImportBrokerAssets={handleImportBrokerAssets}
              onImportWorkspace={handleImportWorkspace}
              onAddIntegration={handleAddIntegration}
              onDeleteIntegration={handleDeleteIntegration}
              onLogImportJob={handleLogImportJob}
              onReprocessImportJob={handleReprocessImportJob}
              onResetPortfolio={handleResetPortfolio}
              onRestoreDemoWorkspace={handleRestoreDemoWorkspace}
              onRunIntegrationSync={handleRunIntegrationSync}
              onUpdateImportJob={handleUpdateImportJob}
              onUpdateIntegration={handleUpdateIntegration}
              onUpdateMarketPreferences={handleUpdateMarketPreferences}
              profile={profile}
              riskHistory={riskHistory}
              marketPreferences={marketPreferences}
              syncMessage={syncMessage}
              syncStatus={syncStatus}
              transactions={transactions}
              userEmail={userEmail}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (typeof error === "string") return error;
  return "Something went wrong while syncing.";
}
