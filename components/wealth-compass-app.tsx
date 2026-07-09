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
import { defaultRiskAnswers, portfolioAssets } from "@/lib/sample-data";
import {
  createRiskHistoryItem,
  loadSnapshot,
  loadRiskHistory,
  saveRiskHistory,
  saveSnapshot,
  type PortfolioAsset,
  type RiskHistoryItem,
  type WealthCompassImport,
  type WealthGoal,
  createWealthGoal,
  defaultGoals,
} from "@/lib/local-storage";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  loadCloudSnapshot,
  loadRiskProfileHistory,
  saveCloudSnapshot,
  saveRiskProfileHistory,
} from "@/lib/supabase-sync";
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
    setAnswers(snapshot.answers);
    setAssets(snapshot.assets);
    setGoals(snapshot.goals);
    setRiskHistory(loadRiskHistory());
    setHasLoadedSnapshot(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSnapshot) return;
    saveSnapshot({ answers, assets, goals });
  }, [answers, assets, goals, hasLoadedSnapshot]);

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
        setAnswers(snapshot.answers);
        setAssets(snapshot.assets);
        setGoals(snapshot.goals);
        saveSnapshot(snapshot);
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
          snapshot: { answers, assets, goals },
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
  }, [answers, assets, goals, hasLoadedSnapshot, supabase, userId]);

  const profile = useMemo(() => calculateRiskProfile(answers), [answers]);
  const portfolioTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
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
    setAssets(portfolioAssets);
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

  function handleDeleteAsset(assetIndex: number) {
    setAssets((current) => current.filter((_, index) => index !== assetIndex));
    setSyncStatus(userId ? "Syncing" : isSupabaseConfigured() ? "Local saved" : "Local demo");
    setSyncMessage("Portfolio holding removed.");
  }

  function handleRestoreDemoWorkspace() {
    setAnswers(defaultRiskAnswers);
    setAssets(portfolioAssets);
    setGoals(defaultGoals);
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
    setAnswers(workspace.answers);
    setAssets(workspace.assets);
    setGoals(workspace.goals);
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

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:flex-row lg:py-6">
        <AppSidebar activeView={activeView} onNavigate={setActiveView} />

        <section className="min-w-0 flex-1">
          <AppHeader
            onSaveRiskHistory={handleSaveRiskHistory}
            onSignOut={handleSignOut}
            profile={profile}
            syncMessage={syncMessage}
            syncStatus={syncStatus}
            userEmail={userEmail}
          />
          {activeView === "dashboard" && (
            <Dashboard
              assets={assets}
              goals={goals}
              healthScore={healthScore}
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
              assets={assets}
              onAddAsset={(asset) => setAssets((current) => [asset, ...current])}
              onDeleteAsset={handleDeleteAsset}
              onImportAssets={(importedAssets) =>
                setAssets((current) => [...importedAssets, ...current])
              }
              onResetAssets={handleResetPortfolio}
              onUpdateAsset={handleUpdateAsset}
              portfolioTotal={portfolioTotal}
              profile={profile}
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
          {activeView === "market" && <MarketDashboard />}
          {activeView === "mentor" && (
            <MentorPanel answers={answers} profile={profile} />
          )}
          {activeView === "settings" && (
            <DataSettings
              answers={answers}
              assets={assets}
              goals={goals}
              onImportWorkspace={handleImportWorkspace}
              onResetPortfolio={handleResetPortfolio}
              onRestoreDemoWorkspace={handleRestoreDemoWorkspace}
              profile={profile}
              riskHistory={riskHistory}
              syncMessage={syncMessage}
              syncStatus={syncStatus}
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
