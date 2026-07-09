"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Cloud,
  Compass,
  Copy,
  Download,
  Gauge,
  Goal,
  History,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircleQuestion,
  Newspaper,
  Plus,
  Save,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { defaultRiskAnswers, marketNotes, portfolioAssets } from "@/lib/sample-data";
import {
  defaultGoal,
  createRiskHistoryItem,
  loadSnapshot,
  loadRiskHistory,
  saveRiskHistory,
  saveSnapshot,
  type PortfolioAsset,
  type RiskHistoryItem,
  type WealthGoal,
} from "@/lib/local-storage";
import {
  parsePortfolioCsv,
  portfolioAssetsToCsv,
  samplePortfolioCsv,
} from "@/lib/csv-import";
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
  goalLabels,
  type RiskAnswers,
} from "@/lib/wealth-rules";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "onboarding", label: "Onboarding", icon: Compass },
  { id: "academy", label: "Academy", icon: BookOpen },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "goals", label: "Goals", icon: Goal },
  { id: "history", label: "History", icon: History },
  { id: "market", label: "Market", icon: Newspaper },
  { id: "mentor", label: "Mentor", icon: MessageCircleQuestion },
] as const;

const categoryLibrary = [
  {
    name: "Index Funds",
    fit: "Core wealth building",
    risk: "Medium",
    horizon: "5+ years",
    beginnerNote: "A simple way to own a broad market without picking stocks.",
    liquidity: "High",
  },
  {
    name: "Debt Funds",
    fit: "Near-term goals",
    risk: "Low to medium",
    horizon: "1-3 years",
    beginnerNote: "Useful for stability, but returns can still move with rates.",
    liquidity: "Medium to high",
  },
  {
    name: "Gold",
    fit: "Portfolio stabilizer",
    risk: "Medium",
    horizon: "3+ years",
    beginnerNote: "Usually a diversifier, not the main engine of wealth.",
    liquidity: "High",
  },
  {
    name: "Direct Stocks",
    fit: "Experienced investors",
    risk: "High",
    horizon: "7+ years",
    beginnerNote: "Best after you understand diversification and valuation risk.",
    liquidity: "High",
  },
  {
    name: "Fixed Deposits",
    fit: "Capital protection",
    risk: "Low",
    horizon: "Months to 3 years",
    beginnerNote: "Predictable, but inflation can reduce real returns.",
    liquidity: "Medium",
  },
  {
    name: "REITs",
    fit: "Real estate exposure",
    risk: "Medium",
    horizon: "5+ years",
    beginnerNote: "Lets you invest in property-like income without buying a house.",
    liquidity: "High",
  },
];

const comparisonLibrary = [
  {
    id: "etf-mutual-fund",
    title: "ETF vs Mutual Fund",
    left: {
      name: "ETF",
      effort: "Medium",
      liquidity: "Market hours",
      risk: "Market-linked",
      bestFor: "Investors comfortable placing orders.",
      taxNote: "Tax rules usually follow the underlying asset class.",
    },
    right: {
      name: "Mutual Fund",
      effort: "Low",
      liquidity: "End-of-day NAV",
      risk: "Market-linked",
      bestFor: "Beginners who want automated SIPs.",
      taxNote: "Tax rules depend on equity, debt, or hybrid category.",
    },
    winner: "Mutual Fund",
    recommendation: "Start with mutual funds for habit-building, then learn ETFs once order placement feels natural.",
  },
  {
    id: "gold-bonds",
    title: "Gold vs Bonds",
    left: {
      name: "Gold",
      effort: "Low",
      liquidity: "High",
      risk: "Medium",
      bestFor: "Diversification during stress and inflation fear.",
      taxNote: "Tax treatment varies by gold format and holding period.",
    },
    right: {
      name: "Bonds",
      effort: "Medium",
      liquidity: "Medium",
      risk: "Low to medium",
      bestFor: "Stability, income, and near-term goals.",
      taxNote: "Interest and capital gains may be taxed differently.",
    },
    winner: "Bonds",
    recommendation: "Use bonds or debt funds for planned goals; keep gold as a small diversifier, not the core.",
  },
  {
    id: "sip-lumpsum",
    title: "SIP vs Lump Sum",
    left: {
      name: "SIP",
      effort: "Low",
      liquidity: "Depends on product",
      risk: "Averages entry risk",
      bestFor: "Monthly income and beginner discipline.",
      taxNote: "Each installment may have its own holding period.",
    },
    right: {
      name: "Lump Sum",
      effort: "Medium",
      liquidity: "Depends on product",
      risk: "Higher timing risk",
      bestFor: "Surplus cash and long horizons.",
      taxNote: "Holding period usually starts from investment date.",
    },
    winner: "SIP",
    recommendation: "Use SIPs as the default. Add lump sum only when your emergency fund is ready and your horizon is long.",
  },
  {
    id: "fd-debt-fund",
    title: "FD vs Debt Fund",
    left: {
      name: "Fixed Deposit",
      effort: "Low",
      liquidity: "Medium",
      risk: "Low",
      bestFor: "Certainty and capital protection.",
      taxNote: "Interest is usually taxed as income.",
    },
    right: {
      name: "Debt Fund",
      effort: "Medium",
      liquidity: "Medium to high",
      risk: "Low to medium",
      bestFor: "Flexible short-to-medium term goals.",
      taxNote: "Tax treatment depends on current debt fund rules.",
    },
    winner: "Fixed Deposit",
    recommendation: "Use FDs for certainty. Consider debt funds when you understand interest-rate and credit risk.",
  },
  {
    id: "reit-property",
    title: "REIT vs Rental Property",
    left: {
      name: "REIT",
      effort: "Low",
      liquidity: "High",
      risk: "Medium",
      bestFor: "Small-ticket real estate exposure.",
      taxNote: "Distributions can have mixed tax treatment.",
    },
    right: {
      name: "Rental Property",
      effort: "High",
      liquidity: "Low",
      risk: "High concentration",
      bestFor: "Investors ready for large capital and operations.",
      taxNote: "Rental income, loan interest, and capital gains matter.",
    },
    winner: "REIT",
    recommendation: "Explore REITs first if you want real estate exposure without a large down payment or management work.",
  },
] as const;

const performanceData = [
  { month: "Jan", value: 380000 },
  { month: "Feb", value: 392000 },
  { month: "Mar", value: 386000 },
  { month: "Apr", value: 415000 },
  { month: "May", value: 432000 },
  { month: "Jun", value: 464000 },
];

const marketSnapshot = [
  {
    change: 0.72,
    name: "Nifty 50",
    signal: "Broad market strength",
    value: "24,860",
  },
  {
    change: -0.28,
    name: "Bank Nifty",
    signal: "Rate-sensitive pause",
    value: "52,140",
  },
  {
    change: 0.18,
    name: "Gold",
    signal: "Defensive demand steady",
    value: "74,200",
  },
  {
    change: -0.12,
    name: "10Y Bond",
    signal: "Yield stable",
    value: "6.91%",
  },
];

const sectorSnapshot = [
  { name: "Banks", value: -0.2 },
  { name: "IT", value: 0.9 },
  { name: "FMCG", value: 0.4 },
  { name: "Energy", value: 1.1 },
  { name: "Pharma", value: 0.6 },
];

const marketExplainers = [
  {
    headline: "Why indexes can rise while some stocks fall",
    explanation:
      "Large indexes are weighted. If a few heavy companies move up, the index can look healthy even when many smaller holdings are flat.",
    action: "Check diversification before reacting to one headline.",
  },
  {
    headline: "What stable bond yields usually mean",
    explanation:
      "A calm yield environment often means debt funds may feel steadier, but credit quality and duration still matter.",
    action: "Match debt investments to goal timing.",
  },
  {
    headline: "Why gold is not a replacement for an emergency fund",
    explanation:
      "Gold can diversify a portfolio, but its price moves. Emergency money should prioritize reliability and access.",
    action: "Keep emergency reserves separate from long-term allocation.",
  },
];

const mentorQuestions = [
  {
    id: "etf",
    label: "What is an ETF?",
    title: "ETF basics",
  },
  {
    id: "sip",
    label: "What is SIP?",
    title: "SIP discipline",
  },
  {
    id: "emergency",
    label: "Emergency fund first?",
    title: "Emergency fund",
  },
  {
    id: "crash",
    label: "What if markets crash?",
    title: "Market crash plan",
  },
  {
    id: "gold",
    label: "Should I buy gold?",
    title: "Gold allocation",
  },
  {
    id: "risk",
    label: "Why this risk score?",
    title: "Your risk profile",
  },
] as const;

const colors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type ActiveView = (typeof navItems)[number]["id"];
type ComparisonId = (typeof comparisonLibrary)[number]["id"];
type MentorQuestionId = (typeof mentorQuestions)[number]["id"];
type ComparisonOptionData = {
  bestFor: string;
  effort: string;
  liquidity: string;
  name: string;
  risk: string;
  taxNote: string;
};
type SyncStatus = "Local demo" | "Local saved" | "Loading cloud" | "Syncing" | "Cloud synced" | "Cloud error";

export function WealthCompassApp() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [answers, setAnswers] = useState<RiskAnswers>(defaultRiskAnswers);
  const [assets, setAssets] = useState<PortfolioAsset[]>(portfolioAssets);
  const [goal, setGoal] = useState<WealthGoal>(defaultGoal);
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
    setGoal(snapshot.goal);
    setRiskHistory(loadRiskHistory());
    setHasLoadedSnapshot(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSnapshot) return;
    saveSnapshot({ answers, assets, goal });
  }, [answers, assets, goal, hasLoadedSnapshot]);

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
        setGoal(snapshot.goal);
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
          snapshot: { answers, assets, goal },
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
  }, [answers, assets, goal, hasLoadedSnapshot, supabase, userId]);

  const profile = useMemo(() => calculateRiskProfile(answers), [answers]);
  const portfolioTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
  const monthlyGoal = calculateGoalMonthlyInvestment(goal);
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

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:flex-row lg:py-6">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64">
          <nav className="flex h-full flex-col rounded-lg border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">WealthCompass</p>
                <p className="text-xs text-muted-foreground">Find your financial direction.</p>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="grid gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeView === item.id ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setActiveView(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
            <div className="mt-auto rounded-md border bg-muted/60 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Free MVP mode</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Rule-based guidance, local autosave, Supabase-ready schema.
              </p>
            </div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <Header
            onSaveRiskHistory={handleSaveRiskHistory}
            onSignOut={handleSignOut}
            profile={profile}
            syncMessage={syncMessage}
            syncStatus={syncStatus}
            userEmail={userEmail}
          />
          {activeView === "dashboard" && (
            <Dashboard
              healthScore={healthScore}
              monthlyGoal={monthlyGoal}
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
              onImportAssets={(importedAssets) =>
                setAssets((current) => [...importedAssets, ...current])
              }
              onResetAssets={() => setAssets(portfolioAssets)}
              portfolioTotal={portfolioTotal}
              profile={profile}
            />
          )}
          {activeView === "goals" && (
            <Goals goal={goal} monthlyGoal={monthlyGoal} onChange={setGoal} />
          )}
          {activeView === "history" && (
            <RiskHistory history={riskHistory} profile={profile} />
          )}
          {activeView === "market" && <MarketDashboard />}
          {activeView === "mentor" && (
            <MentorPanel answers={answers} profile={profile} />
          )}
        </section>
      </div>
    </main>
  );
}

function Header({
  onSaveRiskHistory,
  onSignOut,
  profile,
  syncMessage,
  syncStatus,
  userEmail,
}: {
  onSaveRiskHistory: () => void;
  onSignOut: () => void;
  profile: ReturnType<typeof calculateRiskProfile>;
  syncMessage: string;
  syncStatus: SyncStatus;
  userEmail: string;
}) {
  return (
    <div className="mb-5 grid gap-4 rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profile.band}</Badge>
            <Badge variant="outline">{profile.personality}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
            Your investment command center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            A beginner-first companion for risk clarity, learning, portfolio tracking,
            and goal planning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSaveRiskHistory}>
            <Save className="h-4 w-4" />
            Save Risk
          </Button>
          {userEmail ? (
            <Button variant="outline" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <Button asChild>
              <a href="/auth">
                <ShieldCheck className="h-4 w-4" />
                Sign In
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-3 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{syncStatus}</p>
            <p className="text-xs leading-5 text-muted-foreground">{syncMessage}</p>
          </div>
        </div>
        {userEmail && <Badge variant="outline">{userEmail}</Badge>}
      </div>
    </div>
  );
}

function Dashboard({
  healthScore,
  monthlyGoal,
  portfolioTotal,
  profile,
}: {
  healthScore: number;
  monthlyGoal: number;
  portfolioTotal: number;
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Gauge} label="Risk Score" value={`${profile.score}/100`} detail={profile.band} />
        <MetricCard icon={ShieldCheck} label="Health Score" value={`${healthScore}/100`} detail="Foundation check" />
        <MetricCard icon={WalletCards} label="Tracked Value" value={formatMoney(portfolioTotal)} detail="Manual entries" />
        <MetricCard icon={Calculator} label="Goal SIP" value={formatMoney(monthlyGoal)} detail="Monthly target" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio trajectory</CardTitle>
            <CardDescription>Manual tracking today, broker and CSV import later.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="wealth" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Area type="monotone" dataKey="value" stroke="var(--color-chart-1)" fill="url(#wealth)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today in plain English</CardTitle>
            <CardDescription>Beginner market context without noise.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {marketNotes.map((note) => (
              <div key={note} className="rounded-md border bg-muted/40 p-3 text-sm leading-6">
                {note}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Roadmap profile={profile} />
    </div>
  );
}

function MarketDashboard() {
  const sentimentScore = Math.round(
    50 + marketSnapshot.reduce((sum, item) => sum + item.change, 0) * 8,
  );
  const sentiment =
    sentimentScore >= 58 ? "Constructive" : sentimentScore <= 44 ? "Cautious" : "Neutral";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Market Dashboard</CardTitle>
              <CardDescription>
                Manual snapshot with beginner explanations. Live/free APIs can plug in later.
              </CardDescription>
            </div>
            <Badge variant="secondary">{sentiment}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {marketSnapshot.map((item) => (
            <MarketTile key={item.name} item={item} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector movement</CardTitle>
            <CardDescription>What moved most in this sample snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorSnapshot}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beginner sentiment</CardTitle>
            <CardDescription>Rule-based interpretation of market breadth.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Market mood</span>
                <span>{sentimentScore}/100</span>
              </div>
              <Progress value={sentimentScore} />
            </div>
            <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
              {sentiment === "Constructive"
                ? "Markets look broadly positive, but this is not a signal to abandon your plan. Continue goal-based investing."
                : sentiment === "Cautious"
                  ? "Markets look soft. Beginners should avoid panic selling and revisit asset allocation before acting."
                  : "Markets look mixed. This is a good day to learn, rebalance only if your plan already says so, and avoid impulse trades."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Market explained simply</CardTitle>
          <CardDescription>Short notes that translate market noise into useful context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {marketExplainers.map((item) => (
            <div key={item.headline} className="rounded-md border bg-background p-4">
              <p className="font-semibold">{item.headline}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.explanation}
              </p>
              <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                {item.action}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MarketTile({
  item,
}: {
  item: (typeof marketSnapshot)[number];
}) {
  const isPositive = item.change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{item.name}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
        <Icon className={isPositive ? "h-4 w-4 text-primary" : "h-4 w-4 text-destructive"} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge variant={isPositive ? "secondary" : "outline"}>
          {isPositive ? "+" : ""}
          {item.change.toFixed(2)}%
        </Badge>
        <span className="text-right text-xs text-muted-foreground">{item.signal}</span>
      </div>
    </div>
  );
}

function MentorPanel({
  answers,
  profile,
}: {
  answers: RiskAnswers;
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  const [activeQuestionId, setActiveQuestionId] = useState<MentorQuestionId>(
    mentorQuestions[0].id,
  );
  const activeQuestion =
    mentorQuestions.find((question) => question.id === activeQuestionId) ??
    mentorQuestions[0];
  const answer = getMentorAnswer(activeQuestion.id, answers, profile);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Investment Mentor</CardTitle>
          <CardDescription>
            Rule-based explanations now, AI-powered personalization later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {mentorQuestions.map((question) => (
            <Button
              key={question.id}
              type="button"
              variant={activeQuestion.id === question.id ? "default" : "outline"}
              className="h-auto min-h-11 justify-start whitespace-normal text-left leading-5"
              onClick={() => setActiveQuestionId(question.id)}
            >
              <MessageCircleQuestion className="h-4 w-4 shrink-0" />
              {question.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.personality}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
          </div>
          <CardTitle>{activeQuestion.title}</CardTitle>
          <CardDescription>{answer.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
            {answer.explanation}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {answer.steps.map((step) => (
              <div key={step} className="rounded-md border bg-background p-3">
                <CheckCircle2 className="mb-3 h-4 w-4 text-primary" />
                <p className="text-sm leading-6">{step}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-background p-4">
            <p className="text-sm font-medium">Personal note</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.personalNote}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Onboarding({
  answers,
  onChange,
  profile,
}: {
  answers: RiskAnswers;
  onChange: (answers: RiskAnswers) => void;
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  const [step, setStep] = useState(0);
  const update = <K extends keyof RiskAnswers>(key: K, value: RiskAnswers[K]) => {
    onChange({ ...answers, [key]: value });
  };
  const steps = ["Profile", "Risk", "Plan"];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tell WealthCompass about yourself</CardTitle>
          <CardDescription>Answers turn into risk, personality, roadmap, and next actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid grid-cols-3 gap-2">
            {steps.map((label, index) => (
              <Button
                key={label}
                type="button"
                variant={step === index ? "default" : "outline"}
                onClick={() => setStep(index)}
              >
                {label}
              </Button>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Country"
                  value={answers.country}
                  onChange={(value) => update("country", value)}
                />
                <NumberField label="Age" value={answers.age} onChange={(value) => update("age", value)} />
                <NumberField
                  label="Annual income"
                  value={answers.annualIncome}
                  onChange={(value) => update("annualIncome", value)}
                />
                <NumberField
                  label="Monthly savings"
                  value={answers.monthlySavings}
                  onChange={(value) => update("monthlySavings", value)}
                />
                <NumberField
                  label="Monthly investment"
                  value={answers.monthlyInvestment}
                  onChange={(value) => update("monthlyInvestment", value)}
                />
                <NumberField
                  label="Emergency fund months"
                  value={answers.emergencyMonths}
                  onChange={(value) => update("emergencyMonths", value)}
                />
              </div>
              <SegmentedControl
                label="Primary goal"
                value={answers.primaryGoal}
                options={Object.entries(goalLabels)}
                onChange={(value) => update("primaryGoal", value as RiskAnswers["primaryGoal"])}
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <SegmentedControl
                label="Debt level"
                value={answers.debtLevel}
                options={[
                  ["none", "None"],
                  ["manageable", "Manageable"],
                  ["heavy", "Heavy"],
                ]}
                onChange={(value) => update("debtLevel", value as RiskAnswers["debtLevel"])}
              />
              <SegmentedControl
                label="If investments dropped 25%"
                value={answers.marketDropResponse}
                options={[
                  ["sell", "Sell"],
                  ["wait", "Wait"],
                  ["buy", "Buy more"],
                ]}
                onChange={(value) =>
                  update("marketDropResponse", value as RiskAnswers["marketDropResponse"])
                }
              />
              <SegmentedControl
                label="Experience"
                value={answers.experience}
                options={[
                  ["new", "New"],
                  ["some", "Some"],
                  ["confident", "Confident"],
                ]}
                onChange={(value) => update("experience", value as RiskAnswers["experience"])}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <NumberField
                label="Goal horizon years"
                value={answers.horizonYears}
                onChange={(value) => update("horizonYears", value)}
              />
              <SegmentedControl
                label="Weekly learning time"
                value={answers.timeAvailable}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) => update("timeAvailable", value as RiskAnswers["timeAvailable"])}
              />
              <SegmentedControl
                label="Tax awareness"
                value={answers.taxAwareness}
                options={[
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                ]}
                onChange={(value) => update("taxAwareness", value as RiskAnswers["taxAwareness"])}
              />
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              disabled={step === steps.length - 1}
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profile.confidence}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
          </div>
          <CardTitle>{profile.personality}</CardTitle>
          <CardDescription>{profile.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Risk score</span>
              <span>{profile.score}/100</span>
            </div>
            <Progress value={profile.score} />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={profile.allocation} dataKey="value" innerRadius={56} outerRadius={88} paddingAngle={3}>
                  {profile.allocation.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Recommended next actions</p>
            {profile.nextActions.map((action) => (
              <div key={action} className="flex gap-3 rounded-md border bg-background p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{action}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Why this plan</p>
            {profile.recommendations.map((recommendation) => (
              <div key={recommendation} className="rounded-md border bg-muted/40 p-3 text-sm leading-6">
                {recommendation}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        min={0}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map(([id, text]) => (
          <Button
            key={id}
            type="button"
            variant={value === id ? "default" : "outline"}
            className="h-auto min-h-10 whitespace-normal text-center leading-5"
            onClick={() => onChange(id)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Academy() {
  const [activeComparisonId, setActiveComparisonId] = useState<ComparisonId>(
    comparisonLibrary[0].id,
  );
  const activeComparison =
    comparisonLibrary.find((comparison) => comparison.id === activeComparisonId) ??
    comparisonLibrary[0];

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Investment Academy</CardTitle>
          <CardDescription>Simple categories with risk, horizon, and purpose.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {categoryLibrary.map((category) => (
            <div key={category.name} className="rounded-md border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{category.name}</h3>
                <Badge variant="outline">{category.risk}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{category.fit}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {category.beginnerNote}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Horizon: {category.horizon}</span>
                <span>Liquidity: {category.liquidity}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Investment Comparator</CardTitle>
          <CardDescription>Compare beginner choices by fit, risk, effort, liquidity, and tax awareness.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2 md:grid-cols-5">
            {comparisonLibrary.map((comparison) => (
              <Button
                key={comparison.id}
                type="button"
                variant={activeComparison.id === comparison.id ? "default" : "outline"}
                className="h-auto min-h-11 whitespace-normal px-3 text-center leading-5"
                onClick={() => setActiveComparisonId(comparison.id)}
              >
                {comparison.title}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <ComparisonOption option={activeComparison.left} />
            <div className="flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold">
                VS
              </div>
            </div>
            <ComparisonOption option={activeComparison.right} />
          </div>

          <div className="rounded-md border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Beginner pick</Badge>
              <Badge variant="outline">{activeComparison.winner}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {activeComparison.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonOption({
  option,
}: {
  option: ComparisonOptionData;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{option.name}</h3>
        <LineChart className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-4 grid gap-3">
        <ComparisonMetric label="Best for" value={option.bestFor} />
        <ComparisonMetric label="Risk" value={option.risk} />
        <ComparisonMetric label="Effort" value={option.effort} />
        <ComparisonMetric label="Liquidity" value={option.liquidity} />
        <ComparisonMetric label="Tax note" value={option.taxNote} />
      </div>
    </div>
  );
}

function ComparisonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function Portfolio({
  assets,
  onAddAsset,
  onImportAssets,
  onResetAssets,
  portfolioTotal,
  profile,
}: {
  assets: PortfolioAsset[];
  onAddAsset: (asset: PortfolioAsset) => void;
  onImportAssets: (assets: PortfolioAsset[]) => void;
  onResetAssets: () => void;
  portfolioTotal: number;
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  const [draftAsset, setDraftAsset] = useState<PortfolioAsset>({
    name: "New index fund",
    type: "Index Fund",
    value: 25000,
    gain: 0,
  });
  const [csvText, setCsvText] = useState(samplePortfolioCsv);
  const [csvMessage, setCsvMessage] = useState("Paste CSV with name, type, value, gain.");
  const exportedCsv = useMemo(() => portfolioAssetsToCsv(assets), [assets]);

  const chartData = assets.map((asset) => ({
    name: asset.type,
    value: asset.value,
  }));
  const largestHolding = assets.reduce(
    (largest, asset) => (asset.value > largest.value ? asset : largest),
    assets[0],
  );
  const concentration =
    portfolioTotal > 0 && largestHolding ? Math.round((largestHolding.value / portfolioTotal) * 100) : 0;
  const suggestedEquity =
    profile.allocation.find((item) => item.name === "Index Funds")?.value ?? 0;

  function handleCsvImport() {
    const result = parsePortfolioCsv(csvText);

    if (!result.assets.length) {
      setCsvMessage(result.errors.join(" "));
      return;
    }

    onImportAssets(result.assets);
    setCsvMessage(
      result.errors.length
        ? `Imported ${result.assets.length} holdings. ${result.errors.join(" ")}`
        : `Imported ${result.assets.length} holdings.`,
    );
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
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
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
                  onAddAsset(draftAsset);
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Add one holding</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Manual entry is useful for quick edits and demo data.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Asset name"
                value={draftAsset.name}
                onChange={(value) => setDraftAsset({ ...draftAsset, name: value })}
              />
              <TextField
                label="Type"
                value={draftAsset.type}
                onChange={(value) => setDraftAsset({ ...draftAsset, type: value })}
              />
              <NumberField
                label="Current value"
                value={draftAsset.value}
                onChange={(value) => setDraftAsset({ ...draftAsset, value })}
              />
              <NumberField
                label="Gain %"
                value={draftAsset.gain}
                onChange={(value) => setDraftAsset({ ...draftAsset, gain: value })}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">CSV import</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Columns: name, type, value, gain. Values stay local unless Supabase sync is active.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleCsvImport}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </div>
            <textarea
              className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
            />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-muted-foreground">{csvMessage}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onResetAssets}>
                Reset demo data
              </Button>
            </div>
          </div>

          {assets.map((asset, index) => (
            <div
              key={`${asset.name}-${asset.type}-${index}`}
              className="flex items-center justify-between gap-4 rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{asset.name}</p>
                <p className="text-sm text-muted-foreground">{asset.type}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(asset.value)}</p>
                <p className="text-sm text-primary">+{asset.gain}%</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Current allocation</CardTitle>
            <CardDescription>Compare real holdings with your suggested mix.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-3)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio health checks</CardTitle>
            <CardDescription>Rule-based review before AI review exists.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <HealthCheck
              label="Largest holding"
              value={`${concentration}%`}
              status={concentration > 40 ? "Needs attention" : "Healthy"}
            />
            <HealthCheck
              label="Suggested index fund core"
              value={`${suggestedEquity}%`}
              status={suggestedEquity >= 40 ? "On track" : "Conservative"}
            />
            <HealthCheck
              label="Tracking habit"
              value={`${assets.length} assets`}
              status={assets.length >= 4 ? "Good start" : "Add more detail"}
            />
          </CardContent>
        </Card>
        <Roadmap profile={profile} compact />
      </div>
    </div>
  );
}

function HealthCheck({
  label,
  status,
  value,
}: {
  label: string;
  status: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      <Badge variant="secondary">{value}</Badge>
    </div>
  );
}

function Goals({
  goal,
  monthlyGoal,
  onChange,
}: {
  goal: WealthGoal;
  monthlyGoal: number;
  onChange: (goal: WealthGoal) => void;
}) {
  const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Goal planner</CardTitle>
          <CardDescription>Turn a life goal into a monthly investing target.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Goal name</Label>
            <Input value={goal.name} onChange={(event) => onChange({ ...goal, name: event.target.value })} />
          </div>
          <NumberField label="Current amount" value={goal.currentAmount} onChange={(value) => onChange({ ...goal, currentAmount: value })} />
          <NumberField label="Target amount" value={goal.targetAmount} onChange={(value) => onChange({ ...goal, targetAmount: value })} />
          <NumberField label="Years remaining" value={goal.years} onChange={(value) => onChange({ ...goal, years: value })} />
          <NumberField label="Expected annual return %" value={goal.annualReturn} onChange={(value) => onChange({ ...goal, annualReturn: value })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{goal.name}</CardTitle>
          <CardDescription>{progress}% funded today</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>{formatMoney(goal.currentAmount)}</span>
              <span>{formatMoney(goal.targetAmount)}</span>
            </div>
            <Progress value={progress} />
          </div>
          <div className="rounded-lg border bg-muted/40 p-5">
            <p className="text-sm text-muted-foreground">Required monthly investment</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(monthlyGoal)}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricMini label="Timeline" value={`${goal.years} years`} />
            <MetricMini label="Return assumption" value={`${goal.annualReturn}%`} />
            <MetricMini label="Funding gap" value={formatMoney(Math.max(0, goal.targetAmount - goal.currentAmount))} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskHistory({
  history,
  profile,
}: {
  history: RiskHistoryItem[];
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Risk profile history</CardTitle>
          <CardDescription>
            Saved snapshots help show how a user's plan changes as their life changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {history.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{profile.band}</Badge>
                <Badge variant="outline">{profile.confidence}</Badge>
              </div>
              <p className="mt-3 font-semibold">{profile.personality}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use Save Risk in the header to store the current profile here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 rounded-md border bg-background p-4 md:grid-cols-[120px_1fr_auto]"
              >
                <div>
                  <p className="text-2xl font-semibold">{item.score}</p>
                  <p className="text-xs text-muted-foreground">Risk score</p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{item.band}</Badge>
                    <Badge variant="outline">{item.confidence}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{item.personality}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground md:text-right">
                  {formatDate(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function Roadmap({
  compact = false,
  profile,
}: {
  compact?: boolean;
  profile: ReturnType<typeof calculateRiskProfile>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning roadmap</CardTitle>
        <CardDescription>Personalized from onboarding answers.</CardDescription>
      </CardHeader>
      <CardContent className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-4"}>
        {profile.roadmap.map((item) => (
          <div key={item.week} className="rounded-md border bg-background p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{item.week}</Badge>
              <Badge variant="outline">{item.format}</Badge>
            </div>
            <p className="mt-3 font-semibold">{item.topic}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.outcome}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function getMentorAnswer(
  questionId: (typeof mentorQuestions)[number]["id"],
  answers: RiskAnswers,
  profile: ReturnType<typeof calculateRiskProfile>,
) {
  const goal = goalLabels[answers.primaryGoal].toLowerCase();
  const emergencyReady = answers.emergencyMonths >= 6;

  const answersById = {
    crash: {
      explanation:
        "A market crash is a temporary fall in prices, not automatically a reason to sell. The right response depends on your goal timeline, emergency fund, debt, and risk capacity.",
      personalNote:
        profile.band === "Growth"
          ? "Your profile can handle more volatility, but only if your goal timeline remains long and your emergency fund is separate."
          : "Your profile benefits from slower decisions during crashes. Protect cash needs first, then rebalance only if your plan says so.",
      steps: [
        "Do not sell just because prices fell.",
        "Check whether your goal timeline changed.",
        "Rebalance gradually instead of making one emotional trade.",
      ],
      summary: "Crashes test behavior more than knowledge.",
    },
    emergency: {
      explanation:
        "An emergency fund is money kept for job loss, medical needs, family support, or urgent repairs. It should be boring, accessible, and separate from investments.",
      personalNote: emergencyReady
        ? "You already have a stronger base than many beginners, so your plan can focus more on consistent investing."
        : `You currently have ${answers.emergencyMonths} months saved. Build toward 6 months before increasing risk for ${goal}.`,
      steps: [
        "Keep it in cash-like or low-risk instruments.",
        "Do not count stocks, gold, or crypto as emergency money.",
        "Review the target whenever expenses change.",
      ],
      summary: "Emergency money protects your investment plan from forced selling.",
    },
    etf: {
      explanation:
        "An ETF is a basket of securities that trades like a stock. Many ETFs track an index, so one purchase can give exposure to many companies.",
      personalNote:
        answers.experience === "new"
          ? "Since you marked yourself as new, mutual funds may be easier first. ETFs are useful once order placement feels comfortable."
          : "Your experience level makes ETFs worth comparing, especially for low-cost index exposure.",
      steps: [
        "Use ETFs for diversified exposure, not quick excitement.",
        "Check liquidity and tracking difference.",
        "Avoid placing orders without understanding market price versus NAV.",
      ],
      summary: "ETFs can be simple, but buying them still requires market-order awareness.",
    },
    gold: {
      explanation:
        "Gold can diversify a portfolio because it may behave differently from stocks and bonds. It does not produce business earnings, so it is usually a stabilizer, not the main growth engine.",
      personalNote:
        profile.band === "Conservative"
          ? "A small gold allocation can fit your stability preference, but emergency reserves still come first."
          : "For your profile, gold is better treated as a small diversifier while growth assets do the long-term heavy lifting.",
      steps: [
        "Keep gold allocation modest.",
        "Prefer transparent formats over emotional purchases.",
        "Do not use gold as a replacement for cash reserves.",
      ],
      summary: "Gold is a diversifier, not a complete plan.",
    },
    risk: {
      explanation:
        "Your score combines age, emergency fund, debt, goal horizon, crash response, experience, learning time, and investing rate. It is a planning signal, not a permanent label.",
      personalNote: `Your current result is ${profile.score}/100: ${profile.band}, ${profile.personality}. The biggest practical next step is: ${profile.nextActions[0].toLowerCase()}.`,
      steps: [
        "Improve foundation before increasing risk.",
        "Match risk to goal timeline.",
        "Recalculate after big life changes.",
      ],
      summary: "Risk capacity is personal and changes with your life.",
    },
    sip: {
      explanation:
        "A SIP is a recurring investment habit. It helps you invest through different market conditions instead of trying to guess the perfect day.",
      personalNote:
        answers.monthlyInvestment > 0
          ? `Your current monthly investment input is ${formatMoney(answers.monthlyInvestment)}, which can become the anchor for your plan.`
          : "Start with a small amount you can sustain, then increase it as savings become predictable.",
      steps: [
        "Choose the goal first.",
        "Automate a monthly amount.",
        "Increase contributions when income rises.",
      ],
      summary: "SIP is more about discipline than market timing.",
    },
  };

  return answersById[questionId];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong while syncing.";
}
