import {
  Area,
  AreaChart,
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
  Compass,
  Gauge,
  Goal,
  PlugZap,
  ShieldCheck,
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
import { Progress } from "@/components/ui/progress";
import { Roadmap } from "@/components/wealth/roadmap";
import {
  buildPortfolioTrajectory,
  getDashboardAction,
  getGoalPortfolioInsight,
} from "@/lib/dashboard-rules";
import { formatMoney } from "@/lib/formatters";
import { getConnectorAttentionSummary } from "@/lib/integration-sync";
import { marketNotes } from "@/lib/sample-data";
import { calculateGoalMonthlyInvestment, type RiskProfile } from "@/lib/wealth-rules";
import type {
  IntegrationConnection,
  PortfolioAsset,
  PortfolioTransaction,
  WealthGoal,
} from "@/lib/local-storage";
import type { ActiveView } from "@/components/wealth/app-sidebar";

export type DashboardNavigationTarget = ActiveView;

const colors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const goalPriorityLabels: Record<WealthGoal["priority"], string> = {
  aspirational: "Aspirational",
  essential: "Essential",
  important: "Important",
};

export function Dashboard({
  assets,
  goals,
  healthScore,
  integrations,
  monthlyGoal,
  onNavigate,
  portfolioTotal,
  profile,
  transactions,
}: {
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  healthScore: number;
  integrations: IntegrationConnection[];
  monthlyGoal: number;
  onNavigate: (view: DashboardNavigationTarget) => void;
  portfolioTotal: number;
  profile: RiskProfile;
  transactions: PortfolioTransaction[];
}) {
  const totalGoalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalGoalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const goalProgress = totalGoalTarget > 0
    ? Math.round((totalGoalCurrent / totalGoalTarget) * 100)
    : 0;
  const allocationData = assets.reduce<Array<{ name: string; value: number }>>((items, asset) => {
    const existingItem = items.find((item) => item.name === asset.type);
    if (existingItem) {
      existingItem.value += asset.value;
      return items;
    }

    return [...items, { name: asset.type, value: asset.value }];
  }, []);
  const action = getDashboardAction({
    assets,
    formatMoney,
    goalProgress,
    goals,
    healthScore,
    monthlyGoal,
    profile,
  });
  const goalInsight = getGoalPortfolioInsight({
    goals,
    monthlyGoal,
    portfolioTotal,
  });
  const connectorAttention = getConnectorAttentionSummary(integrations);
  const isFreshWorkspace =
    portfolioTotal <= 0 &&
    goals.length === 0 &&
    assets.length === 0 &&
    integrations.length === 0;
  const trajectoryData = buildPortfolioTrajectory({ transactions });
  const hasTrajectory = trajectoryData.some((point) => point.value > 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Gauge}
          label="Risk Score"
          value={isFreshWorkspace ? "--" : `${profile.score}/100`}
          detail={isFreshWorkspace ? "Complete onboarding" : profile.band}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Health Score"
          value={isFreshWorkspace ? "--" : `${healthScore}/100`}
          detail={isFreshWorkspace ? "Complete onboarding" : "Foundation check"}
        />
        <MetricCard
          icon={WalletCards}
          label="Tracked Value"
          value={formatMoney(portfolioTotal)}
          detail={isFreshWorkspace ? "No holdings yet" : "Manual entries"}
        />
        <MetricCard
          icon={Calculator}
          label="Goal SIP"
          value={formatMoney(monthlyGoal)}
          detail={isFreshWorkspace ? "No goals yet" : "Monthly target"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Next best action</CardTitle>
            <CardDescription>
              {isFreshWorkspace
                ? "Start with onboarding, then add your first holding or goal."
                : action.reason}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{isFreshWorkspace ? "Setup" : action.badge}</Badge>
                <Badge variant="outline">
                  {isFreshWorkspace ? "Getting started" : profile.confidence}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold">
                {isFreshWorkspace ? "Build your first real workspace" : action.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isFreshWorkspace
                  ? "Complete onboarding, connect or import holdings, and add at least one goal so the dashboard can personalize around your actual data."
                  : action.detail}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={() => onNavigate(isFreshWorkspace ? "onboarding" : action.view)}>
                {isFreshWorkspace ? "Complete onboarding" : action.cta}
              </Button>
              <Button type="button" variant="outline" onClick={() => onNavigate("mentor")}>
                Ask Mentor
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump into the most common MVP workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              icon={Compass}
              label="Update profile"
              onClick={() => onNavigate("onboarding")}
            />
            <QuickAction
              icon={WalletCards}
              label="Track holdings"
              onClick={() => onNavigate("portfolio")}
            />
            <QuickAction
              icon={Goal}
              label="Plan goals"
              onClick={() => onNavigate("goals")}
            />
            <QuickAction
              icon={BookOpen}
              label="Keep learning"
              onClick={() => onNavigate("academy")}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio trajectory</CardTitle>
            <CardDescription>
              {hasTrajectory
                ? "Net invested capital built from recorded transactions."
                : "Manual tracking with CSV, statement, and PDF import support."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {hasTrajectory ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData}>
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
            ) : portfolioTotal > 0 ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm leading-6 text-muted-foreground">
                Your holdings are tracked, but the trajectory needs transaction history. Add manual transactions or import a statement with dated activity to unlock the chart.
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm leading-6 text-muted-foreground">
                Add holdings or import statements to start building your portfolio history.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current allocation</CardTitle>
            <CardDescription>Manual holdings grouped by asset type.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
            {allocationData.length ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} dataKey="value" innerRadius={54} outerRadius={86} paddingAngle={3}>
                        {allocationData.map((entry, index) => (
                          <Cell key={entry.name} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid content-center gap-3">
                  {allocationData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: colors[index % colors.length] }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatMoney(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="md:col-span-2 flex min-h-64 items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm leading-6 text-muted-foreground">
                Allocation will appear after you add your first tracked holding.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Goal progress</CardTitle>
            <CardDescription>{goals.length} active goals in the planner.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {goals.length ? (
              <>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{formatMoney(totalGoalCurrent)}</span>
                    <span>{formatMoney(totalGoalTarget)}</span>
                  </div>
                  <Progress value={goalProgress} />
                </div>
                <div className="grid gap-3">
                  {goals.slice(0, 3).map((goal) => (
                    <div key={goal.id} className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{goal.name}</p>
                        <Badge variant="outline">{goalPriorityLabels[goal.priority]}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatMoney(calculateGoalMonthlyInvestment(goal))} monthly target
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-sm font-medium">{goalInsight.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{goalInsight.detail}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => onNavigate("goals")}>
                  Open Goals
                </Button>
              </>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm leading-6 text-muted-foreground">
                Add your first goal to see progress, funding targets, and planning insights here.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connector health</CardTitle>
            <CardDescription>Keep imports reliable before stale data turns into bad decisions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={connectorAttention.severity === "healthy" ? "secondary" : "outline"}>
                  {connectorAttention.badge}
                </Badge>
              </div>
              <p className="mt-3 text-base font-semibold">{connectorAttention.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {connectorAttention.detail}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={() => onNavigate(connectorAttention.actionView)}>
                <PlugZap className="h-4 w-4" />
                {connectorAttention.actionLabel}
              </Button>
              <Button type="button" variant="outline" onClick={() => onNavigate("portfolio")}>
                Review Imports
              </Button>
            </div>
            {marketNotes.slice(0, 2).map((note) => (
              <div key={note} className="rounded-md border bg-muted/40 p-3 text-sm leading-6">
                {note}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {!isFreshWorkspace && <Roadmap profile={profile} />}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Compass;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-20 flex-col gap-2 whitespace-normal text-center"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
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
