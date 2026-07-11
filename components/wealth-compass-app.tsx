"use client";

import { useEffect, useMemo, useState } from "react";
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
  loadSnapshot,
  loadRiskHistory,
  saveRiskHistory,
  saveSnapshot,
  type IntegrationConnection,
  type MarketPreferences,
  type PortfolioAsset,
  type PortfolioTransaction,
  type RiskHistoryItem,
  type WealthCompassImport,
  type WealthGoal,
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

type SyncStatus = "Local demo" | "Local saved" | "Loading cloud" | "Syncing" | "Cloud synced" | "Cloud error";

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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    const snapshot = loadSnapshot();
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
    setRiskHistory(loadRiskHistory());
    setHasLoadedSnapshot(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSnapshot) return;
    saveSnapshot({
      answers,
      assets,
      goals,
      integrations,
      importJobs,
      marketPreferences,
      transactions,
    });
  }, [answers, assets, goals, integrations, importJobs, marketPreferences, transactions, hasLoadedSnapshot]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const client = supabase;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;

      if (!isMounted || !user) return;

      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setSyncStatus("Loading cloud");
      setSyncMessage("Loading your Supabase workspace.");

      try {
        const snapshot = await loadCloudSnapshot(client, user.id);
        if (!isMounted) return;
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
        saveSnapshot({ ...snapshot, assets: derivedAssets });
        const history = await loadRiskProfileHistory(client, user.id);
        if (!isMounted) return;
        setRiskHistory(history);
        saveRiskHistory(history);
        setSyncStatus("Cloud synced");
        setSyncMessage("Loaded your saved Supabase data.");
      } catch (error) {
        if (!isMounted) return;
        setSyncStatus("Cloud error");
        setSyncMessage(getErrorMessage(error));
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUserId("");
        setUserEmail("");
        setSyncStatus("Local saved");
        setSyncMessage("Signed out. Browser autosave is active.");
        return;
      }

      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? "");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!hasLoadedSnapshot || !supabase || !userId) return;

    const client = supabase;
    setSyncStatus("Syncing");
    setSyncMessage("Saving profile, portfolio, and goal data.");

    const timeoutId = window.setTimeout(async () => {
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
        setSyncStatus("Cloud synced");
        setSyncMessage("Cloud save complete.");
      } catch (error) {
        setSyncStatus("Cloud error");
        setSyncMessage(getErrorMessage(error));
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [
    answers,
    assets,
    goals,
    hasLoadedSnapshot,
    integrations,
    importJobs,
    marketPreferences,
    supabase,
    transactions,
    userId,
  ]);

  const safeAssets = useMemo(() => coercePortfolioAssets(assets, []), [assets]);
  const safeIntegrations = useMemo(() => coerceIntegrations(integrations, []), [integrations]);
  const profile = useMemo(() => calculateRiskProfile(answers), [answers]);
  const connectorAttention = useMemo(
    () => getConnectorAttentionSummary(safeIntegrations),
    [safeIntegrations],
  );
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

    try {
      await saveRiskProfileHistory({
        answers,
        profile,
        supabase,
        userId,
      });
      const history = await loadRiskProfileHistory(supabase, userId);
      setRiskHistory(history);
      saveRiskHistory(history);
      setSyncStatus("Cloud synced");
      setSyncMessage("Risk profile saved to history.");
    } catch (error) {
      setSyncStatus("Cloud error");
      setSyncMessage(getErrorMessage(error));
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function handleResetPortfolio() {
    setAssets(derivePortfolioAssetsFromTransactions(portfolioTransactions, portfolioAssets));
    setTransactions(portfolioTransactions);
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio restored to demo holdings.");
  }

  function handleUpdateAsset(assetIndex: number, nextAsset: PortfolioAsset) {
    setAssets((current) =>
      current.map((asset, index) => (index === assetIndex ? nextAsset : asset)),
    );
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio holding updated.");
  }

  function handleAddAsset(nextAsset: PortfolioAsset) {
    setAssets((current) => [nextAsset, ...current]);
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio holding added.");
  }

  function handleImportAssets(nextAssets: PortfolioAsset[]) {
    setAssets(nextAssets);
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio import applied.");
  }

  function handleImportBrokerAssets(nextAssets: PortfolioAsset[], job: ImportJob) {
    setAssets(nextAssets);
    setImportJobs((current) => [job, ...current].slice(0, 20));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Broker holdings sync applied.");
  }

  function handleDeleteAsset(assetIndex: number) {
    setAssets((current) => current.filter((_, index) => index !== assetIndex));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio holding removed.");
  }

  function handleAddTransaction(nextTransaction: PortfolioTransaction) {
    setTransactions((current) => {
      const nextTransactions = [nextTransaction, ...current];
      setAssets((assetsState) =>
        derivePortfolioAssetsFromTransactions(nextTransactions, assetsState),
      );
      return nextTransactions;
    });
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Transaction recorded.");
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
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Transaction removed.");
  }

  function handleRestoreDemoWorkspace() {
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
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage(
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
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Imported workspace data.");
  }

  function handleAddGoal() {
    setGoals((current) => [createWealthGoal(), ...current]);
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Goal added.");
  }

  function handleUpdateGoal(goalId: string, nextGoal: WealthGoal) {
    setGoals((current) => current.map((goal) => (goal.id === goalId ? nextGoal : goal)));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Goal updated.");
  }

  function handleDeleteGoal(goalId: string) {
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Goal removed.");
  }

  function handleAddIntegration(connection: IntegrationConnection) {
    setIntegrations((current) => [connection, ...current]);
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Integration connection added.");
  }

  function handleUpdateIntegration(connectionId: string, nextConnection: IntegrationConnection) {
    setIntegrations((current) =>
      current.map((connection) =>
        connection.id === connectionId ? nextConnection : connection,
      ),
    );
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Integration updated.");
  }

  function handleDeleteIntegration(connectionId: string) {
    setIntegrations((current) =>
      current.filter((connection) => connection.id !== connectionId),
    );
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Integration removed.");
  }

  async function handleRunIntegrationSync(connectionId?: string) {
    const mode = connectionId ? "single" : "all-active";
    const targetConnections = safeIntegrations.filter((connection) =>
      mode === "single"
        ? connection.id === connectionId && connection.status === "active"
        : connection.status === "active",
    );

    if (!targetConnections.length) {
      setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
      setSyncMessage("No active integration sources were available to sync.");
      return;
    }

    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage(
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
      setSyncMessage(
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
      setSyncMessage(
        fallback.syncedConnectionIds.length === 1
          ? `${targetConnections[0].providerName} sync checkpoint recorded locally.`
          : `${fallback.syncedConnectionIds.length} integration sync checkpoints recorded locally.`,
      );
    }
  }

  function handleLogImportJob(job: ImportJob) {
    setImportJobs((current) => [job, ...current].slice(0, 20));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Import job saved.");
  }

  function handleUpdateImportJob(jobId: string, nextJob: ImportJob) {
    setImportJobs((current) =>
      current.map((job) => (job.id === jobId ? nextJob : job)),
    );
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Import job updated.");
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
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Import job reprocessed.");
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
            syncMessage={syncMessage}
            syncStatus={syncStatus}
            userEmail={userEmail}
          />
          {activeView === "dashboard" && (
            <Dashboard
              assets={safeAssets}
              goals={goals}
              healthScore={healthScore}
              integrations={safeIntegrations}
              monthlyGoal={monthlyGoal}
              onNavigate={(view) => setActiveView(view)}
              portfolioTotal={portfolioTotal}
              profile={profile}
            />
          )}
          {activeView === "onboarding" && (
            <Onboarding answers={answers} onChange={setAnswers} profile={profile} />
          )}
          {activeView === "academy" && <Academy />}
          {activeView === "portfolio" && (
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
          )}
          {activeView === "goals" && (
            <Goals
              goals={goals}
              monthlyGoal={monthlyGoal}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
              onUpdateGoal={handleUpdateGoal}
            />
          )}
          {activeView === "history" && (
            <RiskHistory history={riskHistory} profile={profile} />
          )}
          {activeView === "market" && (
            <MarketDashboard
              assets={safeAssets}
              integrations={safeIntegrations}
              marketPreferences={marketPreferences}
              onRunIntegrationSync={handleRunIntegrationSync}
              onUpdatePreferences={setMarketPreferences}
            />
          )}
          {activeView === "mentor" && (
            <MentorPanel answers={answers} assets={safeAssets} profile={profile} />
          )}
          {activeView === "settings" && (
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
              onUpdateMarketPreferences={setMarketPreferences}
              profile={profile}
              riskHistory={riskHistory}
              marketPreferences={marketPreferences}
              syncMessage={syncMessage}
              syncStatus={syncStatus}
              transactions={transactions}
              userEmail={userEmail}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong while syncing.";
}
