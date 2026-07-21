"use client";

import { useEffect, useMemo, useState } from "react";
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
  ArrowRight,
  BookOpen,
  Calculator,
  Compass,
  Gauge,
  Goal,
  PlugZap,
  ShieldCheck,
  Target,
  TrendingUp,
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
import {
  buildDashboardImportOutcomes,
  getImportJobFlowMeta,
  getImportJobOutcomeStats,
} from "@/lib/import-job-flow";
import {
  buildDashboardConnectorKpis,
  buildIntegrationDiagnosticsSummary,
  buildIntegrationSchedulerPlan,
  buildIntegrationOperationsSummary,
  filterAndSortIntegrations,
  formatSyncTimeLabel,
  getConnectorAttentionSummary,
  getDashboardConnectorRecovery,
  getDashboardConnectorActions,
  getIntegrationHealthMetrics,
  getIntegrationStrategyLabel,
  type DashboardConnectorRecovery,
  type IntegrationActivityFilter,
} from "@/lib/integration-sync";
import { calculateGoalMonthlyInvestment, type RiskProfile } from "@/lib/wealth-rules";
import type {
  ImportJob,
  IntegrationConnection,
  PortfolioAsset,
  PortfolioTransaction,
  WealthGoal,
} from "@/lib/local-storage";
import type { ActiveView } from "@/components/wealth/app-sidebar";
import type { DataSettingsFocusRequest, DataSettingsFocusSection } from "@/components/wealth/data-settings";

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

const dashboardRecoveryResultStorageKey = "wealthcompass:dashboard-recovery-result:v1";
const dashboardConnectorLaunchStorageKey = "wealthcompass:dashboard-connector-launch:v1";
const dashboardImportReviewStorageKey = "wealthcompass:dashboard-import-review:v1";
const dashboardConnectorRunStorageKey = "wealthcompass:dashboard-connector-run:v1";
const dashboardRecoveryResultTtlMs = 90_000;

export function Dashboard({
  assets,
  goals,
  healthScore,
  integrations,
  importJobs,
  monthlyGoal,
  onNavigate,
  onOpenConnectorFocus,
  onRunIntegrationSync,
  portfolioTotal,
  profile,
  transactions,
}: {
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  healthScore: number;
  integrations: IntegrationConnection[];
  importJobs: ImportJob[];
  monthlyGoal: number;
  onNavigate: (view: DashboardNavigationTarget) => void;
  onOpenConnectorFocus: (request: DataSettingsFocusRequest) => void;
  onRunIntegrationSync: (connectionId?: string) => void | Promise<void>;
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
  const connectorSchedulerPlan = buildIntegrationSchedulerPlan(integrations);
  const connectorOperations = buildIntegrationOperationsSummary(integrations);
  const connectorMetrics = integrations.map(getIntegrationHealthMetrics);
  const averageConnectorSuccess = connectorMetrics.length
    ? Math.round(
        connectorMetrics.reduce((sum, metric) => sum + metric.successRate, 0) /
          connectorMetrics.length,
      )
    : 0;
  const connectorWarningCount = connectorMetrics.filter(
    (metric) => metric.warningStreak > 0,
  ).length;
  const connectorActions = getDashboardConnectorActions(integrations);
  const [connectorFilter, setConnectorFilter] = useState<IntegrationActivityFilter>("all");
  const [expandedDiagnosticsProviderId, setExpandedDiagnosticsProviderId] = useState<string | null>(null);
  const [recentConnectorLaunch, setRecentConnectorLaunch] = useState<{
    detail: string;
    key: string;
  } | null>(null);
  const [recentImportReview, setRecentImportReview] = useState<{
    detail: string;
    jobId: string;
  } | null>(null);
  const [recentConnectorRun, setRecentConnectorRun] = useState<{
    detail: string;
    providerId: string;
  } | null>(null);
  const [recentRecoveryResult, setRecentRecoveryResult] = useState<{
    detail: string;
    providerId: string;
    tone: "info" | "success" | "warning";
  } | null>(null);
  const isFreshWorkspace =
    portfolioTotal <= 0 &&
    goals.length === 0 &&
    assets.length === 0 &&
    integrations.length === 0;
  const trajectoryData = buildPortfolioTrajectory({ transactions });
  const hasTrajectory = trajectoryData.some((point) => point.value > 0);
  const filteredConnectorKpis = buildDashboardConnectorKpis(integrations, {
    filter: connectorFilter,
    limit: 4,
  });
  const filteredConnectorCount = filterAndSortIntegrations(integrations, {
    filter: connectorFilter,
  }).length;
  const importOutcomes = buildDashboardImportOutcomes(importJobs, 3);
  const totalMonthlyContributions = monthlyGoal + profile.monthlyInvestment;
  const dashboardReadinessLabel = isFreshWorkspace
    ? "Setup in progress"
    : connectorAttention.severity === "healthy"
      ? "Live workspace"
      : "Needs review";
  const dashboardHeadline = isFreshWorkspace
    ? "Set your base, then start tracking real money decisions."
    : "See what needs attention, what is compounding, and where to act next.";
  const dashboardSubhead = isFreshWorkspace
    ? "Finish onboarding, add a first holding or goal, and connect one data source so the dashboard can personalize around your actual investing setup."
    : "Your dashboard brings risk posture, holdings, goals, and import health into one operating view so you can stay in flow.";
  const dashboardFocusItems = [
    {
      detail: isFreshWorkspace ? "Complete your assessment and risk baseline." : action.trackTitle,
      icon: Compass,
      label: "Focus",
    },
    {
      detail:
        totalMonthlyContributions > 0
          ? `${formatMoney(totalMonthlyContributions)} moving monthly`
          : "Add a monthly investing rhythm",
      icon: TrendingUp,
      label: "Monthly flow",
    },
    {
      detail:
        goals.length > 0
          ? `${goals.length} live goal${goals.length === 1 ? "" : "s"} in motion`
          : "No active goals yet",
      icon: Target,
      label: "Goal pressure",
    },
  ];
  const latestImportJobByProviderId = useMemo(() => {
    const nextMap = new Map<string, ImportJob>();

    for (const job of importJobs) {
      if (!job.providerId) continue;
      const current = nextMap.get(job.providerId);
      if (!current || job.createdAt > current.createdAt) {
        nextMap.set(job.providerId, job);
      }
    }

    return nextMap;
  }, [importJobs]);
  const integrationByProviderId = useMemo(
    () =>
      new Map(
        integrations.map((integration) => [integration.providerId, integration]),
      ),
    [integrations],
  );

  function getConnectorFocusSection(item: {
    channel: IntegrationConnection["channel"];
    importStrategy: IntegrationConnection["importStrategy"];
    providerId: string;
  }): DataSettingsFocusSection {
    if (item.providerId === "zerodha") return "broker";
    if (item.channel === "email" || item.importStrategy === "email-forward") return "inbox";
    return "connected-sources";
  }

  function getConnectorWorkflowLabel(item: {
    channel: IntegrationConnection["channel"];
    importStrategy: IntegrationConnection["importStrategy"];
    providerId: string;
    providerName: string;
  }) {
    const section = getConnectorFocusSection(item);

    if (section === "broker") {
      return `Open ${item.providerName} broker`;
    }

    if (section === "inbox") {
      return `Open ${item.providerName} inbox`;
    }

    return `Open ${item.providerName} workflow`;
  }

  function openConnectorWorkflow(item: {
    channel: IntegrationConnection["channel"];
    importStrategy: IntegrationConnection["importStrategy"];
    providerId: string;
    providerName: string;
  }) {
    setRecentConnectorLaunch({
      detail: getConnectorLaunchDetail(item),
      key: buildConnectorLaunchKey(item),
    });
    onOpenConnectorFocus({
      providerId: item.providerId,
      providerName: item.providerName,
      section: getConnectorFocusSection(item),
    });
  }

  function getConnectorLaunchDetail(item: {
    channel: IntegrationConnection["channel"];
    importStrategy: IntegrationConnection["importStrategy"];
    providerId: string;
    providerName: string;
  }) {
    const section = getConnectorFocusSection(item);

    if (section === "broker") {
      return "Opened the broker lane and prepared the next live-sync step.";
    }

    if (section === "inbox") {
      return "Opened the inbox lane and prepared the next email-ingestion step.";
    }

    return "Opened the source workflow and prepared the next guided import step.";
  }

  function buildConnectorLaunchKey(item: {
    providerId: string;
    providerName: string;
    label?: string;
  }) {
    return `${item.providerId}-${item.label ?? item.providerName}`;
  }

  function openImportHistoryReview(outcome: {
    detail: string;
    id: string;
    primaryActionId: "apply-portfolio" | "none" | "open-sync-plan";
    providerName: string;
  }) {
    setRecentImportReview({
      detail: `Opened import history and focused the latest ${outcome.providerName} review.`,
      jobId: outcome.id,
    });
    onOpenConnectorFocus({
      importAction: outcome.primaryActionId,
      jobId: outcome.id,
      providerName: outcome.providerName,
      section: "import-history",
    });
  }

  function canRunConnectorFromDashboard(item: {
    providerId: string;
    status: IntegrationConnection["status"];
  }) {
    return item.status === "active";
  }

  function runConnectorFromDashboard(item: {
    providerId: string;
    providerName: string;
    status: IntegrationConnection["status"];
  }) {
    if (!canRunConnectorFromDashboard(item)) return;

    setRecentConnectorRun({
      detail: `${item.providerName} sync checkpoint started from the dashboard.`,
      providerId: item.providerId,
    });
    void onRunIntegrationSync(
      integrations.find((integration) => integration.providerId === item.providerId)?.id,
    );
  }

  function toggleDiagnostics(providerId: string) {
    setExpandedDiagnosticsProviderId((current) =>
      current === providerId ? null : providerId,
    );
  }

  function handleRecoveryAction(
    integration: IntegrationConnection,
    recovery: DashboardConnectorRecovery,
  ) {
    if (recovery.actionId === "run-connector-now" || recovery.actionId === "run-first-check") {
      if (!canRunConnectorFromDashboard(integration)) {
        setRecentRecoveryResult({
          detail: "No active source is available for a connector run right now.",
          providerId: integration.providerId,
          tone: "warning",
        });
        return;
      }

      setRecentRecoveryResult({
        detail: `${recovery.label} started from the diagnostics panel.`,
        providerId: integration.providerId,
        tone: "success",
      });
      runConnectorFromDashboard({
        providerId: integration.providerId,
        providerName: integration.providerName,
        status: integration.status,
      });
      return;
    }

    if (recovery.actionId === "review-import-history") {
      setRecentRecoveryResult({
        detail: `${recovery.label} opened import history for ${integration.providerName}.`,
        providerId: integration.providerId,
        tone: "info",
      });
      onOpenConnectorFocus({
        providerId: integration.providerId,
        providerName: integration.providerName,
        section: "import-history",
      });
      return;
    }

    setRecentRecoveryResult({
      detail: `${recovery.label} opened the recommended workflow for ${integration.providerName}.`,
      providerId: integration.providerId,
      tone: "info",
    });
    openConnectorWorkflow({
      channel: integration.channel,
      importStrategy: integration.importStrategy,
      providerId: integration.providerId,
      providerName: integration.providerName,
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const launchValue = window.localStorage.getItem(dashboardConnectorLaunchStorageKey);
      if (launchValue) {
        const parsedLaunch = JSON.parse(launchValue) as {
          detail: string;
          expiresAt: number;
          key: string;
        };

        if (parsedLaunch.expiresAt > Date.now()) {
          setRecentConnectorLaunch({
            detail: parsedLaunch.detail,
            key: parsedLaunch.key,
          });
        } else {
          window.localStorage.removeItem(dashboardConnectorLaunchStorageKey);
        }
      }

      const importReviewValue = window.localStorage.getItem(dashboardImportReviewStorageKey);
      if (importReviewValue) {
        const parsedImportReview = JSON.parse(importReviewValue) as {
          detail: string;
          expiresAt: number;
          jobId: string;
        };

        if (parsedImportReview.expiresAt > Date.now()) {
          setRecentImportReview({
            detail: parsedImportReview.detail,
            jobId: parsedImportReview.jobId,
          });
        } else {
          window.localStorage.removeItem(dashboardImportReviewStorageKey);
        }
      }

      const connectorRunValue = window.localStorage.getItem(dashboardConnectorRunStorageKey);
      if (connectorRunValue) {
        const parsedConnectorRun = JSON.parse(connectorRunValue) as {
          detail: string;
          expiresAt: number;
          providerId: string;
        };

        if (parsedConnectorRun.expiresAt > Date.now()) {
          setRecentConnectorRun({
            detail: parsedConnectorRun.detail,
            providerId: parsedConnectorRun.providerId,
          });
        } else {
          window.localStorage.removeItem(dashboardConnectorRunStorageKey);
        }
      }

      const rawValue = window.localStorage.getItem(dashboardRecoveryResultStorageKey);
      if (!rawValue) return;

      const parsed = JSON.parse(rawValue) as {
        detail: string;
        expiresAt: number;
        providerId: string;
        tone: "info" | "success" | "warning";
      };

      if (parsed.expiresAt <= Date.now()) {
        window.localStorage.removeItem(dashboardRecoveryResultStorageKey);
        return;
      }

      setRecentRecoveryResult({
        detail: parsed.detail,
        providerId: parsed.providerId,
        tone: parsed.tone,
      });
    } catch {
      window.localStorage.removeItem(dashboardRecoveryResultStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!recentConnectorLaunch) {
      window.localStorage.removeItem(dashboardConnectorLaunchStorageKey);
      return;
    }

    window.localStorage.setItem(
      dashboardConnectorLaunchStorageKey,
      JSON.stringify({
        detail: recentConnectorLaunch.detail,
        expiresAt: Date.now() + dashboardRecoveryResultTtlMs,
        key: recentConnectorLaunch.key,
      }),
    );
  }, [recentConnectorLaunch]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!recentImportReview) {
      window.localStorage.removeItem(dashboardImportReviewStorageKey);
      return;
    }

    window.localStorage.setItem(
      dashboardImportReviewStorageKey,
      JSON.stringify({
        detail: recentImportReview.detail,
        expiresAt: Date.now() + dashboardRecoveryResultTtlMs,
        jobId: recentImportReview.jobId,
      }),
    );
  }, [recentImportReview]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!recentConnectorRun) {
      window.localStorage.removeItem(dashboardConnectorRunStorageKey);
      return;
    }

    window.localStorage.setItem(
      dashboardConnectorRunStorageKey,
      JSON.stringify({
        detail: recentConnectorRun.detail,
        expiresAt: Date.now() + dashboardRecoveryResultTtlMs,
        providerId: recentConnectorRun.providerId,
      }),
    );
  }, [recentConnectorRun]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!recentRecoveryResult) {
      window.localStorage.removeItem(dashboardRecoveryResultStorageKey);
      return;
    }

    window.localStorage.setItem(
      dashboardRecoveryResultStorageKey,
      JSON.stringify({
        detail: recentRecoveryResult.detail,
        expiresAt: Date.now() + dashboardRecoveryResultTtlMs,
        providerId: recentRecoveryResult.providerId,
        tone: recentRecoveryResult.tone,
      }),
    );
  }, [recentRecoveryResult]);

  useEffect(() => {
    if (!recentConnectorLaunch) return;

    const timeoutId = window.setTimeout(() => {
      setRecentConnectorLaunch((current) =>
        current?.key === recentConnectorLaunch.key ? null : current,
      );
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [recentConnectorLaunch]);

  useEffect(() => {
    if (!recentImportReview) return;

    const timeoutId = window.setTimeout(() => {
      setRecentImportReview((current) =>
        current?.jobId === recentImportReview.jobId ? null : current,
      );
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [recentImportReview]);

  useEffect(() => {
    if (!recentConnectorRun) return;

    const timeoutId = window.setTimeout(() => {
      setRecentConnectorRun((current) =>
        current?.providerId === recentConnectorRun.providerId ? null : current,
      );
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [recentConnectorRun]);

  useEffect(() => {
    if (!recentRecoveryResult) return;

    const timeoutId = window.setTimeout(() => {
      setRecentRecoveryResult((current) =>
        current?.providerId === recentRecoveryResult.providerId ? null : current,
      );
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [recentRecoveryResult]);

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Your investment command center</Badge>
              <Badge variant="outline">{dashboardReadinessLabel}</Badge>
              <Badge variant="outline">
                {isFreshWorkspace ? "No linked data yet" : `${assets.length} tracked holdings`}
              </Badge>
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    {dashboardHeadline}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {dashboardSubhead}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 pt-1 md:grid-cols-3">
                {dashboardFocusItems.map(({ detail, icon: Icon, label }) => (
                  <div key={label} className="rounded-md border border-border/70 bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => onNavigate(isFreshWorkspace ? "onboarding" : action.view)}>
                {isFreshWorkspace ? "Complete onboarding" : action.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onNavigate("portfolio")}>
                Open portfolio
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenConnectorFocus({
                    section: "connected-sources",
                  })}
              >
                Review data feeds
              </Button>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Today&apos;s operating note
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">
                {isFreshWorkspace ? "Build your first real investing workspace" : action.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isFreshWorkspace
                  ? "The dashboard becomes far more useful once onboarding, goals, and at least one tracked source are in place."
                  : action.reason}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Capital rhythm
                </p>
                <Badge variant="outline">
                  {profile.band || "Pending profile"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Monthly investing</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatMoney(profile.monthlyInvestment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Goal SIP pressure</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatMoney(monthlyGoal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {!isFreshWorkspace ? (
                  <Badge variant="outline">{action.trackTitle}</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-lg font-semibold">
                {isFreshWorkspace ? "Build your first real workspace" : action.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isFreshWorkspace
                  ? "Complete onboarding, connect or import holdings, and add at least one goal so the dashboard can personalize around your actual data."
                  : action.detail}
              </p>
              {!isFreshWorkspace ? (
                <div className="mt-3 rounded-md border bg-background/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Best next move
                  </p>
                  <p className="mt-2 text-sm leading-6">{action.trackStep}</p>
                </div>
              ) : null}
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

      {!isFreshWorkspace ? (
        <Card>
          <CardHeader>
            <CardTitle>Coaching tracks</CardTitle>
            <CardDescription>
              The same three tracks from onboarding, now anchored to your live workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-3">
            {profile.actionBaskets.map((basket) => (
              <div key={basket.id} className="rounded-md border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{basket.title}</p>
                  <Badge variant="outline">{basket.items.length} ideas</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {basket.description}
                </p>
                <div className="mt-3 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Start here
                  </p>
                  <p className="mt-2 text-sm leading-6">{basket.items[0]}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-muted/40 p-4 md:col-span-2">
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
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Connector snapshot
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg success</p>
                    <p className="mt-1 font-semibold">{averageConnectorSuccess}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due now</p>
                    <p className="mt-1 font-semibold">{connectorSchedulerPlan.dueCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Warning streaks</p>
                    <p className="mt-1 font-semibold">{connectorWarningCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Scheduler
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {connectorSchedulerPlan.activeCount} active source{connectorSchedulerPlan.activeCount === 1 ? "" : "s"} · {connectorSchedulerPlan.readyCount} first check{connectorSchedulerPlan.readyCount === 1 ? "" : "s"} pending · {connectorSchedulerPlan.pausedCount} paused · {connectorSchedulerPlan.errorCount} need fixes.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Next connector check {formatSyncTimeLabel(connectorSchedulerPlan.nextRunAt)}.
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-4 md:col-span-2">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                      Provider KPIs
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Filter the connector lanes that matter right now, then jump into settings when one drifts.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {filteredConnectorCount} shown
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["all", `All ${integrations.length}`],
                    ["attention", `Attention ${connectorOperations.attentionCount}`],
                    ["due", `Due ${connectorOperations.dueNowCount}`],
                    ["active", `Auto ${connectorOperations.autoCount}`],
                    ["manual", `Manual ${connectorOperations.manualCount}`],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={connectorFilter === value ? "secondary" : "outline"}
                      onClick={() => setConnectorFilter(value as IntegrationActivityFilter)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2">
                  {filteredConnectorKpis.length ? (
                    filteredConnectorKpis.map((item) => {
                      const integration = integrationByProviderId.get(item.providerId) ?? null;
                      const diagnosticsOpen = expandedDiagnosticsProviderId === item.providerId;
                      const recovery = integration
                        ? getDashboardConnectorRecovery(integration)
                        : null;
                      const diagnosticsSummary = integration
                        ? buildIntegrationDiagnosticsSummary(integration)
                        : null;
                      const latestImportJob = latestImportJobByProviderId.get(item.providerId) ?? null;
                      const latestImportMeta = latestImportJob
                        ? getImportJobFlowMeta(latestImportJob)
                        : null;
                      const latestImportStats = latestImportJob
                        ? getImportJobOutcomeStats(latestImportJob)
                        : null;

                      return (
                        <div
                          key={`${item.providerId}-${item.syncLabel}`}
                          className="rounded-md border bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{item.providerName}</p>
                              <Badge variant="outline">{item.channel}</Badge>
                              <Badge variant="outline">
                                {getIntegrationStrategyLabel(item.importStrategy)}
                              </Badge>
                              <Badge
                                variant={
                                  item.tone === "healthy"
                                    ? "secondary"
                                    : item.tone === "attention"
                                      ? "outline"
                                      : "outline"
                                }
                              >
                                {item.syncLabel}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.totalRuns > 0 ? `${item.successRate}% success` : "No runs yet"}
                            </p>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {item.syncDetail}
                          </p>
                          {recentConnectorLaunch?.key === buildConnectorLaunchKey(item) ? (
                            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                                Workflow opened
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {recentConnectorLaunch.detail}
                              </p>
                            </div>
                          ) : null}
                          {recentConnectorRun?.providerId === item.providerId ? (
                            <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                                Sync started
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {recentConnectorRun.detail}
                              </p>
                            </div>
                          ) : null}
                          {recentRecoveryResult?.providerId === item.providerId ? (
                            <div
                              className={`mt-2 rounded-md p-3 ${
                                recentRecoveryResult.tone === "success"
                                  ? "border border-emerald-500/30 bg-emerald-500/5"
                                  : recentRecoveryResult.tone === "warning"
                                    ? "border border-amber-500/30 bg-amber-500/5"
                                    : "border border-primary/30 bg-primary/5"
                              }`}
                            >
                              <p
                                className={`text-[11px] font-medium uppercase tracking-wide ${
                                  recentRecoveryResult.tone === "success"
                                    ? "text-emerald-700"
                                    : recentRecoveryResult.tone === "warning"
                                      ? "text-amber-700"
                                      : "text-primary"
                                }`}
                              >
                                {recentRecoveryResult.tone === "success"
                                  ? "Recovery started"
                                  : recentRecoveryResult.tone === "warning"
                                    ? "Recovery blocked"
                                    : "Workflow opened"}
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {recentRecoveryResult.detail}
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-3">
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Last good signal
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {item.healthySignal}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                Current issue
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {item.currentIssue}
                              </p>
                            </div>
                          </div>
                          {diagnosticsOpen && integration ? (
                            <div className="mt-2 grid gap-2 rounded-md border bg-muted/20 p-3">
                              {recovery ? (
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                    Best recovery move
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    <span className="font-medium text-foreground">{recovery.label}:</span>{" "}
                                    {recovery.detail}
                                  </p>
                                  <div className="mt-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRecoveryAction(integration, recovery)}
                                    >
                                      {recovery.label}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                  Last sync detail
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                  {integration.lastSyncMessage}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                  Scheduler note
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                  {diagnosticsSummary?.schedulerCue}
                                </p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                    Import lane
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {integration.sourceHint}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                    Provider cue
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {diagnosticsSummary?.providerCue}
                                  </p>
                                </div>
                              </div>
                              {diagnosticsSummary?.timeline.length ? (
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                    Recent connector timeline
                                  </p>
                                  <div className="mt-2 grid gap-2">
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
                                </div>
                              ) : null}
                              {latestImportJob && latestImportMeta && latestImportStats ? (
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                      Latest saved review
                                    </p>
                                    <Badge variant={latestImportMeta.badgeVariant}>
                                      {latestImportMeta.label}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {latestImportMeta.detail}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                    <span>{latestImportStats.fileLabel}</span>
                                    <span>{latestImportStats.holdingsLabel}</span>
                                    <span>{latestImportStats.transactionsLabel}</span>
                                    <span>{latestImportStats.duplicatesLabel}</span>
                                    <span>{latestImportStats.ocrLabel}</span>
                                  </div>
                                </div>
                              ) : null}
                              {integration.notes ? (
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                                    Operator note
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {integration.notes}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            <span>
                              Last sync {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : "not yet"}
                            </span>
                            <span>
                              Next check {formatSyncTimeLabel(item.nextRunAt)}
                            </span>
                            <span>
                              {item.warningStreak ? `Warning streak ${item.warningStreak}` : item.importStrategy}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleDiagnostics(item.providerId)}
                            >
                              {diagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={!canRunConnectorFromDashboard(item)}
                              onClick={() => runConnectorFromDashboard(item)}
                            >
                              Run now
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openConnectorWorkflow(item)}
                            >
                              {getConnectorWorkflowLabel(item)}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onOpenConnectorFocus({
                                  providerId: item.providerId,
                                  providerName: item.providerName,
                                  section: "import-history",
                                })}
                            >
                              Review history
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
                      No connectors match the current filter yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {connectorActions.length ? (
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Provider next moves
                </p>
                <div className="mt-3 grid gap-2">
                  {connectorActions.map((action) => (
                    <div
                      key={`${action.providerName}-${action.label}`}
                      className="flex flex-col justify-between gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {action.providerName}: {action.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {action.detail}
                        </p>
                        {recentConnectorLaunch?.key === buildConnectorLaunchKey(action) ? (
                          <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                              Workflow opened
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                              {recentConnectorLaunch.detail}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openConnectorWorkflow(action)}
                      >
                        {getConnectorWorkflowLabel(action)}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                    Recent import outcomes
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    See what the last statement reviews produced, then jump straight into history when something needs another pass.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onOpenConnectorFocus({
                      section: "import-history",
                    })}
                >
                  Open history
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {importOutcomes.length ? (
                  importOutcomes.map((outcome) => (
                    <div
                      key={outcome.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{outcome.providerName}</p>
                          <Badge variant={outcome.badgeVariant}>{outcome.label}</Badge>
                          <Badge variant="outline">{outcome.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(outcome.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {outcome.detail}
                      </p>
                      {recentImportReview?.jobId === outcome.id ? (
                        <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                            Review opened
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            {recentImportReview.detail}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{outcome.fileLabel}</span>
                        <span>{outcome.holdingsLabel}</span>
                        <span>{outcome.transactionsLabel}</span>
                        <span>{outcome.duplicatesLabel}</span>
                        <span>{outcome.ocrLabel}</span>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openImportHistoryReview(outcome)}
                        >
                          {outcome.primaryActionLabel}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
                    No import outcomes yet. Run a sync plan, inbox check, or statement import to start building review history.
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={() => onNavigate(connectorAttention.actionView)}>
                <PlugZap className="h-4 w-4" />
                {connectorAttention.actionLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenConnectorFocus({
                    section: "import-history",
                  })}
              >
                Review Imports
              </Button>
            </div>
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
      className="h-24 items-start justify-between whitespace-normal rounded-md border-border/70 bg-muted/15 p-4 text-left hover:bg-muted/30"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
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
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardDescription>
        <div className="rounded-md border border-border/70 bg-muted/20 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
