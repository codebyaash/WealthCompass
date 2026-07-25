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
  DatabaseZap,
  Gauge,
  Goal,
  GraduationCap,
  LayoutGrid,
  PlugZap,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
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
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
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
  mentorRevision,
  monthlyGoal,
  onNavigate,
  onOpenMentor,
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
  mentorRevision: number;
  monthlyGoal: number;
  onNavigate: (view: DashboardNavigationTarget) => void;
  onOpenMentor: (request: MentorLaunchRequest) => void;
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
          : "Goal map not started",
      icon: Target,
      label: "Goal pressure",
    },
  ];
  const dashboardMvpLoops = [
    {
      detail: isFreshWorkspace
        ? "Finish onboarding and lock the first risk and intent baseline."
        : "Use the dashboard to decide what deserves attention before you open another page.",
      label: "1. Decide",
    },
    {
      detail: goals.length > 0
        ? "Keep monthly goal pressure and investing rhythm realistic enough to sustain."
        : "Add one real goal or monthly investing rhythm so the plan stops floating.",
      label: "2. Fund",
    },
    {
      detail: integrations.length > 0
        ? "Keep data fresh enough that allocation, goals, and market reads stay believable."
        : "Connect or rehearse one dependable source so the workspace learns from real activity.",
      label: "3. Trust",
    },
  ];
  const dashboardTopStats = [
    {
      detail: isFreshWorkspace ? "Complete onboarding" : "Profile and behavior baseline",
      label: "Readiness",
      value: dashboardReadinessLabel,
    },
    {
      detail: goals.length > 0 ? `${goals.length} goal${goals.length === 1 ? "" : "s"} active` : "No goals active yet",
      label: "Planning load",
      value: formatMoney(monthlyGoal),
    },
    {
      detail:
        integrations.length > 0
          ? `${connectorOperations.activeCount} active source${connectorOperations.activeCount === 1 ? "" : "s"}`
          : "Source lane not started",
      label: "Data trust",
      value:
        connectorAttention.count > 0
          ? `${connectorAttention.count} need review`
          : integrations.length > 0
            ? "Stable"
            : "Not started",
    },
    {
      detail:
        portfolioTotal > 0
          ? `${assets.length} holding${assets.length === 1 ? "" : "s"} tracked`
          : "Holdings not tracked yet",
      label: "Capital base",
      value: formatMoney(portfolioTotal),
    },
  ];
  const dashboardPriorityQueue = [
    isFreshWorkspace
      ? {
          detail:
            "Lock the first risk, intent, and behavior baseline so every other page stops operating on assumptions.",
          label: "Complete onboarding baseline",
          onClick: () => onNavigate("onboarding"),
          section: "Onboarding",
          tone: "urgent" as const,
        }
      : {
          detail: action.reason,
          label: action.cta,
          onClick: () => onNavigate(action.view),
          section: "Today",
          tone: "urgent" as const,
        },
    connectorAttention.count > 0
      ? {
          detail: `${connectorAttention.count} connector or import workflow item${connectorAttention.count === 1 ? "" : "s"} can still distort what the portfolio and market sections are telling you.`,
          label: "Repair data trust first",
          onClick: () =>
            onOpenConnectorFocus({
              section: "connected-sources",
            }),
          section: "Data feeds",
          tone: "watch" as const,
        }
      : integrations.length === 0
        ? {
            detail:
              "Connect one broker, inbox, or statement workflow so the workspace can stay fresh without depending only on manual cleanup.",
            label: "Link the first live source",
            onClick: () =>
              onOpenConnectorFocus({
                section: "connected-sources",
              }),
            section: "Data feeds",
            tone: "watch" as const,
          }
        : {
            detail:
              "Feed health is stable enough that the rest of the dashboard can be trusted more confidently today.",
            label: "Use the live workspace read",
            onClick: () => onNavigate("portfolio"),
            section: "Portfolio",
            tone: "steady" as const,
          },
    goals.length === 0
      ? {
          detail:
            "Add one real goal so the dashboard can turn monthly investing into tradeoffs instead of generic advice.",
          label: "Define the first money goal",
          onClick: () => onNavigate("goals"),
          section: "Goals",
          tone: "steady" as const,
        }
      : fundingGap > 0
        ? {
            detail: `${formatMoney(fundingGap)} of monthly goal pressure is still unfunded beyond the current investing rhythm.`,
            label: "Close the monthly funding gap",
            onClick: () => onNavigate("goals"),
            section: "Goals",
            tone: "watch" as const,
          }
        : portfolioTotal <= 0
          ? {
              detail:
                "Your goals exist, but the portfolio base still needs real holdings before allocation and performance reads become useful.",
              label: "Start the tracked portfolio",
              onClick: () => onNavigate("portfolio"),
              section: "Portfolio",
              tone: "steady" as const,
            }
          : {
              detail:
                "The base is in place, so you can shift from setup toward portfolio review, market study, or mentor guidance.",
              label: "Move into execution quality",
              onClick: () => onNavigate("portfolio"),
              section: "Execution",
              tone: "steady" as const,
            },
  ];
  const dashboardMentorPrompt = [
    `My dashboard next action is "${isFreshWorkspace ? "Complete onboarding" : action.cta}" and my health score is ${healthScore}.`,
    `I have ${goals.length} goals, ${assets.length} holdings, ${integrations.length} connector workflows, and ${importJobs.length} import job records.`,
    totalMonthlyContributions > 0
      ? `${formatMoney(totalMonthlyContributions)} is moving monthly across goals and investing.`
      : "I do not yet have a stable monthly investing rhythm.",
    connectorAttention.count > 0
      ? `${connectorAttention.count} connector or import workflow items currently need attention.`
      : "No connector workflows are asking for attention right now.",
    goals.length > 0
      ? `Goal progress is ${goalProgress}% against a total target of ${formatMoney(totalGoalTarget)}.`
      : "I have not defined any live goals yet.",
    portfolioTotal > 0
      ? `Tracked portfolio value is ${formatMoney(portfolioTotal)}.`
      : "I do not have tracked portfolio value yet.",
    `Help me decide what deserves my attention first across onboarding, portfolio, goals, connectors, and learning.`,
  ].join(" ");
  const dashboardPriorityCards = [
    {
      description: isFreshWorkspace
        ? "Finish your assessment so risk, learning, and suggestions stop being generic."
        : action.reason,
      icon: Compass,
      label: "Today",
      onClick: () => onNavigate(isFreshWorkspace ? "onboarding" : action.view),
      value: isFreshWorkspace ? "Finish setup" : action.cta,
    },
    {
      description:
        portfolioTotal > 0
          ? `${assets.length} tracked holding${assets.length === 1 ? "" : "s"} ready for review.`
          : "Import a statement or add manual holdings to start real allocation tracking.",
      icon: WalletCards,
      label: "Portfolio",
      onClick: () => onNavigate("portfolio"),
      value: portfolioTotal > 0 ? formatMoney(portfolioTotal) : "Add first holding",
    },
    {
      description:
        goals.length > 0
          ? `${goals.length} goal${goals.length === 1 ? "" : "s"} live with ${formatMoney(monthlyGoal)} monthly required.`
          : "Define one real money goal so the planner can guide monthly tradeoffs.",
      icon: Goal,
      label: "Goals",
      onClick: () => onNavigate("goals"),
      value: goals.length > 0 ? `${goalProgress}% funded` : "No live goals",
    },
    {
      description:
        integrations.length > 0
          ? `${connectorAttention.count} feed${connectorAttention.count === 1 ? "" : "s"} need attention across ${integrations.length} source${integrations.length === 1 ? "" : "s"}.`
          : "Connect one broker, inbox, or statement workflow to keep this workspace fresh.",
      icon: DatabaseZap,
      label: "Data feeds",
      onClick: () =>
        onOpenConnectorFocus({
          section: "connected-sources",
        }),
      value:
        integrations.length > 0
          ? connectorAttention.count > 0
            ? `${connectorAttention.count} to review`
            : "Healthy"
          : "No feeds linked",
    },
  ];
  const dashboardQuickJumps = [
    {
      detail: "Assessment, intent, and baseline",
      icon: LayoutGrid,
      label: "Onboarding",
      onClick: () => onNavigate("onboarding"),
    },
    {
      detail: "Holdings, imports, and allocation",
      icon: WalletCards,
      label: "Portfolio",
      onClick: () => onNavigate("portfolio"),
    },
    {
      detail: "Targets and monthly funding plan",
      icon: Goal,
      label: "Goals",
      onClick: () => onNavigate("goals"),
    },
    {
      detail: "Suggested sectors and market view",
      icon: TrendingUp,
      label: "Market",
      onClick: () => onNavigate("market"),
    },
    {
      detail: "Skill building and practice tracks",
      icon: GraduationCap,
      label: "Academy",
      onClick: () => onNavigate("academy"),
    },
    {
      detail: "Questions, clarity, and decision support",
      icon: BookOpen,
      label: "AI mentor",
      onClick: () => onNavigate("mentor"),
    },
  ];
  const dashboardSectionLenses = [
    {
      detail: hasTrajectory
        ? `${transactions.length} transaction row${transactions.length === 1 ? "" : "s"} are shaping the contribution read.`
        : "Transaction coverage is still thin, so the dashboard is leaning more on snapshots than contribution behavior.",
      label: "Portfolio behavior",
      value: hasTrajectory ? "Trajectory live" : "Coverage thin",
    },
    {
      detail: goals.length > 0
        ? `${goalProgress}% total goal progress against ${formatMoney(totalGoalTarget)} of target capital.`
        : "No goal map yet, so the monthly investing story is still missing named destinations.",
      label: "Goal realism",
      value: goals.length > 0 ? formatMoney(monthlyGoal) : "Not started",
    },
    {
      detail:
        connectorAttention.count > 0
          ? `${connectorAttention.count} feed issue${connectorAttention.count === 1 ? "" : "s"} can still distort downstream reads.`
          : integrations.length > 0
            ? "Connector health is stable enough that portfolio and market cards are more trustworthy."
            : "No source lane is linked yet, so data freshness still depends on manual updates.",
      label: "Data freshness",
      value:
        connectorAttention.count > 0
          ? connectorAttention.badge
          : integrations.length > 0
            ? "Stable"
            : "Not started",
    },
  ];
  const dashboardExecutiveLenses = [
    {
      detail: isFreshWorkspace
        ? "The dashboard still needs a real baseline, so onboarding and the first tracked source matter more than deeper optimization."
        : connectorAttention.count > 0
          ? "The workspace is useful, but data quality is still shaping what you can trust downstream."
          : "The workspace is stable enough that decisions can shift from setup toward allocation, goals, and execution.",
      label: "Workspace posture",
      value: dashboardReadinessLabel,
    },
    {
      detail:
        fundingGap > 0
          ? `${formatMoney(fundingGap)} of monthly goal pressure is still unfunded beyond the current investing rhythm.`
          : "Current monthly investing is already covering goal pressure, so new choices can focus more on quality than catch-up.",
      label: "Funding pressure",
      value: fundingGap > 0 ? "Gap to close" : "In range",
    },
    {
      detail:
        connectorAttention.count > 0
          ? "Clear the data blockers before treating portfolio and market reads as fully trustworthy."
          : hasTrajectory
            ? "You have enough transaction path to read behavior, not just static value snapshots."
            : "Transaction coverage is still thin, so the next best import can materially improve how the dashboard reads.",
      label: "Trust anchor",
      value:
        connectorAttention.count > 0
          ? "Review feeds"
          : hasTrajectory
            ? "Behavior read"
            : "Snapshot-heavy",
    },
  ];
  const dashboardWorkingOrder = [
    isFreshWorkspace
      ? "Finish onboarding so the dashboard stops operating on assumptions."
      : `Start with ${action.cta.toLowerCase()} before opening secondary pages.`,
    connectorAttention.count > 0
      ? "Resolve the active connector or import review items before trusting deeper portfolio and market cues."
      : "Use the live data read to decide whether the next move belongs in portfolio, goals, or learning.",
    fundingGap > 0
      ? "Close the monthly funding gap before widening experimentation."
      : "Once the base is stable, use the mentor or academy only to sharpen the next real decision.",
  ];
  const topAllocationBucket = allocationData.reduce<{ name: string; value: number } | null>(
    (leader, item) => {
      if (!leader || item.value > leader.value) return item;
      return leader;
    },
    null,
  );
  const trajectoryHeadline = hasTrajectory
    ? `Built from ${transactions.length} recorded transaction${transactions.length === 1 ? "" : "s"}`
      : portfolioTotal > 0
        ? "Your capital is tracked, but its path is still missing."
      : "Portfolio path not started yet";
  const trajectorySupport = hasTrajectory
    ? "Use the transaction trail to understand how capital has built over time, not just where it sits today."
    : portfolioTotal > 0
      ? "Add dated buys, sells, or statement imports so the dashboard can show how your money has accumulated."
      : "Once you add holdings and transactions, this becomes your investing path instead of a static snapshot.";
  const allocationSupport = allocationData.length
    ? topAllocationBucket
      ? `${topAllocationBucket.name} is currently your largest bucket at ${formatMoney(topAllocationBucket.value)}.`
      : "Allocation is ready for review."
    : "Allocation becomes useful once at least one tracked holding is live.";
  const mentorCtaLabel = "Ask AI mentor";
  const fundingGap = Math.max(monthlyGoal - profile.monthlyInvestment, 0);
  const decisionPressureCards = [
    {
      detail: isFreshWorkspace
        ? "Complete onboarding so the app stops guessing your risk capacity and learning posture."
        : healthScore >= 75
          ? "Your foundation looks steady enough to support execution and learning decisions."
          : "Your current setup still needs foundation work before bigger investing moves feel durable.",
      icon: ShieldCheck,
      label: "Foundation",
      nextStep: isFreshWorkspace
        ? "Finish onboarding"
        : healthScore >= 75
          ? "Keep it stable"
          : "Repair the weak base",
      status: isFreshWorkspace ? "Setup" : healthScore >= 75 ? "Steady" : "Strained",
      value: isFreshWorkspace ? "--" : `${healthScore}/100`,
    },
    {
      detail:
        goals.length === 0
          ? "There is no named destination yet, so monthly investing still lacks a clear landing zone."
          : fundingGap > 0
            ? `${formatMoney(fundingGap)} of goal pressure still sits above the current monthly investing rhythm.`
            : "Your current monthly investing rhythm is at least keeping pace with goal demand.",
      icon: Calculator,
      label: "Funding pressure",
      nextStep:
        goals.length === 0
          ? "Add a first goal"
          : fundingGap > 0
            ? "Resize or prioritize goals"
            : "Maintain the pace",
      status: goals.length === 0 ? "Unmapped" : fundingGap > 0 ? "Tight" : "Covered",
      value:
        goals.length === 0
          ? "No goal map"
          : fundingGap > 0
            ? formatMoney(fundingGap)
            : formatMoney(monthlyGoal),
    },
    {
      detail:
        integrations.length === 0
          ? "The workspace still depends on manual updates, so freshness can drift quietly."
          : connectorAttention.severity === "healthy"
            ? "Connector health is stable enough that downstream views are more trustworthy."
            : "At least one feed needs attention before you lean too hard on allocation or market conclusions.",
      icon: DatabaseZap,
      label: "Data trust",
      nextStep:
        integrations.length === 0
          ? "Link one source"
          : connectorAttention.severity === "healthy"
            ? "Monitor the lane"
            : "Fix the first weak feed",
      status:
        integrations.length === 0
          ? "Manual"
          : connectorAttention.severity === "healthy"
            ? "Healthy"
            : "Needs review",
      value:
        integrations.length === 0
          ? "No feeds linked"
          : `${connectorSchedulerPlan.activeCount} active`,
    },
    {
      detail:
        assets.length === 0
          ? "There is not enough holdings coverage yet to judge allocation with confidence."
          : hasTrajectory
            ? "Holdings and transaction history together are giving you a more complete operating picture."
            : "You have holdings coverage, but transaction history is still too thin for a real contribution path.",
      icon: TrendingUp,
      label: "Coverage",
      nextStep:
        assets.length === 0
          ? "Add first holding"
          : hasTrajectory
            ? "Keep recording activity"
            : "Import dated transactions",
      status: assets.length === 0 ? "Thin" : hasTrajectory ? "Layered" : "Partial",
      value:
        assets.length === 0
          ? "No holdings"
          : hasTrajectory
            ? `${transactions.length} entries`
            : `${assets.length} holdings`,
    },
  ];
  const dashboardConstraintHeadline = isFreshWorkspace
    ? "Right now the main constraint is still setup completeness."
    : fundingGap > 0
      ? "The biggest visible pressure is monthly funding capacity against live goals."
      : connectorAttention.severity !== "healthy"
        ? "The biggest visible risk is data trust, not strategy."
        : hasTrajectory
          ? "Your dashboard is moving from setup into operating mode."
          : "The next unlock is better transaction coverage, not more interpretation.";
  const operatingFlow = [
    {
      detail: isFreshWorkspace
        ? "Finish your baseline so every next step gets personalized."
        : action.trackStep,
      icon: Compass,
      label: "Decide",
      status: isFreshWorkspace ? "Setup" : action.badge,
      value: isFreshWorkspace ? "Assessment first" : action.trackTitle,
    },
    {
      detail:
        goals.length > 0
          ? `${formatMoney(totalGoalCurrent)} of ${formatMoney(totalGoalTarget)} already aligned to goals.`
          : "No goal buckets yet, so monthly investing has nowhere explicit to land.",
      icon: Goal,
      label: "Fund",
      status: goals.length > 0 ? `${goalProgress}% funded` : "No goals",
      value:
        goals.length > 0
          ? `${formatMoney(monthlyGoal)} monthly required`
          : "Define first target",
    },
    {
      detail:
        integrations.length > 0
          ? connectorAttention.detail
          : "No connected source is keeping holdings, imports, or sync health fresh yet.",
      icon: PlugZap,
      label: "Refresh",
      status: integrations.length > 0 ? connectorAttention.badge : "No feeds",
      value:
        integrations.length > 0
          ? `${connectorSchedulerPlan.activeCount} active source${connectorSchedulerPlan.activeCount === 1 ? "" : "s"}`
          : "Link a source",
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
      return `Review ${item.providerName} broker`;
    }

    if (section === "inbox") {
      return `Review ${item.providerName} inbox`;
    }

    return `Review ${item.providerName} workflow`;
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
              <div className="grid gap-3 md:grid-cols-3">
                {dashboardExecutiveLenses.map(({ detail, label, value }) => (
                  <div key={label} className="rounded-md border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {dashboardTopStats.map(({ detail, label, value }) => (
                  <div key={label} className="rounded-md border border-border/70 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 rounded-md border border-border/70 bg-background/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Priority queue</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Use this when you want the shortest path from overview to the next worthwhile move.
                    </p>
                  </div>
                  <Badge variant="outline">{dashboardPriorityQueue.length} active focus</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {dashboardPriorityQueue.map(({ detail, label, onClick, section, tone }) => (
                    <div
                      key={`${section}-${label}`}
                      className="rounded-md border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <Badge
                          variant="outline"
                          className={
                            tone === "urgent"
                              ? "border-amber-500/40 text-amber-600 dark:text-amber-300"
                              : tone === "watch"
                                ? "border-primary/30 text-primary"
                                : "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                          }
                        >
                          {tone === "urgent"
                            ? "Now"
                            : tone === "watch"
                              ? "Next"
                              : "Keep in view"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {section}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onClick}>
                        Open lane
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => onNavigate(isFreshWorkspace ? "onboarding" : action.view)}>
                {isFreshWorkspace ? "Complete onboarding" : action.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <AskMentorLink
                label={mentorCtaLabel}
                mentorPrompt={dashboardMentorPrompt}
                mentorQuestionId="first-investment"
                onOpenMentor={onOpenMentor}
                sourceLabel="Dashboard summary"
              />
              <Button type="button" variant="outline" onClick={() => onNavigate("portfolio")}>
                Review portfolio
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
            <MentorOpenCue
              cueLabel="Still open before moving on"
              description="You already have an open mentor thread that could help you choose the next best move across onboarding, goals, portfolio, or learning."
              mentorRevision={mentorRevision}
              onOpenMentor={onOpenMentor}
              questionIds={["first-investment", "allocation", "sip", "risk"]}
              resumeLabel="Use AI mentor to decide next"
              sourceLabel="Dashboard"
              stuckLabel="Unblock this before your next move"
            />
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                MVP loop
              </p>
              <div className="mt-3 grid gap-2 text-sm text-foreground">
                {dashboardMvpLoops.map((item) => (
                  <div key={item.label} className="rounded-md border border-border/70 bg-background/80 p-3">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Working order
              </p>
              <div className="mt-3 grid gap-3">
                {dashboardWorkingOrder.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-md border border-border/70 bg-background/80 p-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 text-[11px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <p className="text-xs leading-5 text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
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

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Command lanes</CardTitle>
          <CardDescription>
            Use the dashboard in this order so the workspace narrows your focus instead of multiplying it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-3">
          {dashboardMvpLoops.map((item) => (
            <div key={item.label} className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Decision pressure</CardTitle>
          <CardDescription>
            Read the main constraints first, then decide whether the next move belongs in setup, funding, data quality, or execution coverage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What this is for
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Figuring out what is truly constraining progress before you spend energy in the wrong lane.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read first
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {dashboardConstraintHeadline}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Resolve the most strained card below before treating the rest of the board like equal priority.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            {decisionPressureCards.map(({ detail, icon: Icon, label, nextStep, status, value }) => (
              <div key={label} className="rounded-md border border-border/70 bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <Badge variant="outline" className="mt-3">
                  {status}
                </Badge>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
                <div className="mt-3 rounded-md border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Next move
                  </p>
                  <p className="mt-2 text-sm text-foreground">{nextStep}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Today board</CardTitle>
          <CardDescription>
            Start from the highest-leverage move, then jump straight into the part of the workspace that needs you.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Use this page for
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Deciding what deserves attention right now across profile, portfolio, goals, market, and data quality.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best rhythm
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Start with the top board, take one next action, then review the underlying page only when you know why you are going there.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What to avoid
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Treating every card like an equal priority. This page is meant to help you narrow, not widen, your focus.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            {dashboardPriorityCards.map(({ description, icon: Icon, label, onClick, value }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="rounded-md border border-border/70 bg-muted/15 p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/80 p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                <div className="mt-3 rounded-md border bg-background/70 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best next move
                  </p>
                  <p className="mt-2 text-xs leading-5 text-foreground">
                    Review this lane only if it is the tightest constraint on today&apos;s board.
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick jump lane
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Move between onboarding, portfolio, goals, market, learning, and the mentor without hunting through the sidebar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {dashboardQuickJumps.map(({ detail, icon: Icon, label, onClick }) => (
                <QuickAction
                  key={label}
                  detail={detail}
                  icon={Icon}
                  label={label}
                  onClick={onClick}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Operating lenses</CardTitle>
          <CardDescription>
            These three reads tell you whether the next move belongs in portfolio behavior, goal realism, or data freshness.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-3">
          {dashboardSectionLenses.map((item) => (
            <div key={item.label} className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

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
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Why this is first
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    It is the highest-leverage move based on what is currently missing, underfunded, or stale in the workspace.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What to do next
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Finish this move before chasing a lower-priority optimization somewhere else.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    If it feels unclear
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Use the mentor handoff here instead of guessing your way into the wrong workflow.
                  </p>
                </div>
              </div>
            </div>
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
              <AskMentorLink
                label={mentorCtaLabel}
                mentorPrompt={dashboardMentorPrompt}
                mentorQuestionId="first-investment"
                onOpenMentor={onOpenMentor}
                sourceLabel="Dashboard next action"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating flow</CardTitle>
            <CardDescription>
              Work the dashboard in order: decide, fund, then make sure the data is fresh enough to trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">Think of this as the dashboard’s working order</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                First decide what matters, then make sure the money plan is realistic, then confirm the underlying data is fresh enough to trust.
              </p>
            </div>
            {operatingFlow.map(({ detail, icon: Icon, label, status, value }) => (
              <div key={label} className="rounded-md border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-border/70 bg-background/80 p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
            <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAction
                detail="Assessment, profile, and intent"
                icon={Compass}
                label="Update profile"
                onClick={() => onNavigate("onboarding")}
              />
              <QuickAction
                detail="Holdings, imports, and allocation"
                icon={WalletCards}
                label="Track holdings"
                onClick={() => onNavigate("portfolio")}
              />
              <QuickAction
                detail="Targets and monthly plan"
                icon={Goal}
                label="Plan goals"
                onClick={() => onNavigate("goals")}
              />
              <QuickAction
                detail="Coaching tracks and lessons"
                icon={BookOpen}
                label="Keep learning"
                onClick={() => onNavigate("academy")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {!isFreshWorkspace ? (
        <Card>
          <CardHeader>
            <CardTitle>Coaching tracks</CardTitle>
            <CardDescription>
              The same three tracks from onboarding, now anchored to what your portfolio and goals actually look like today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Coaching lens
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    These tracks are your next best learning moves based on risk posture, live goals, and how developed the portfolio already is.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{profile.band || "Profile pending"}</Badge>
                  <Badge variant="outline">{profile.actionBaskets.length} tracks</Badge>
                </div>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
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
                  {basket.items.length > 1 ? (
                    <div className="mt-3 grid gap-2">
                      {basket.items.slice(1, 3).map((item) => (
                        <div key={item} className="rounded-md border border-dashed bg-muted/10 p-3">
                          <p className="text-xs leading-5 text-muted-foreground">{item}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Learn where this track fits
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("academy")}>
                      Review academy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/15 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Primary question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Are contributions building in a steady rhythm, or are we mostly looking at a thin holdings snapshot?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Allocation and import coverage together, so behavior and current mix tell the same story.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  If the path is thin, improve statement or transaction coverage before reading too much into totals.
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What this shows
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Contribution behavior over time, not just today’s portfolio value.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Why it matters
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    It helps separate disciplined investing from market noise and one-off gains.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    If this chart is blank, improve transaction coverage before drawing conclusions from totals alone.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Path status
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">{trajectoryHeadline}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{trajectorySupport}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Why it matters
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  A live trajectory helps you separate contribution discipline from market noise and makes goal planning more grounded.
                </p>
              </div>
            </div>
            <div className="h-72">
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
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => onNavigate("portfolio")}>
                Review portfolio
              </Button>
              <AskMentorLink
                label={`${mentorCtaLabel} about contribution rhythm`}
                mentorPrompt={`My dashboard ${hasTrajectory ? `shows a portfolio trajectory built from ${transactions.length} transactions.` : "does not yet show a portfolio trajectory."} Help me understand what my contribution pattern says and what I should improve next.`}
                mentorQuestionId="sip"
                onOpenMentor={onOpenMentor}
                sourceLabel="Dashboard trajectory"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current allocation</CardTitle>
            <CardDescription>Manual holdings grouped by asset type.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/15 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Primary question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Is this mix intentional for the current stage, or is it drifting because coverage is incomplete?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Trajectory and connector health, so concentration decisions are grounded in fresh source data.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Investigate the holdings behind the biggest slice before reaching for a rebalance instinct.
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Read this as
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    A snapshot of where the real money is sitting across the portfolio right now.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Do not use it as
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    An instruction to rebalance every time one bucket looks larger than expected.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Use it to spot concentration, then review the portfolio page for the holdings driving the mix.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Allocation note
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{allocationSupport}</p>
                </div>
                {topAllocationBucket ? (
                  <Badge variant="outline">{topAllocationBucket.name}</Badge>
                ) : null}
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
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
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => onNavigate("portfolio")}>
                Review allocation
              </Button>
              <AskMentorLink
                label={`${mentorCtaLabel} about allocation mix`}
                mentorPrompt={`My current allocation has ${allocationData.length} bucket${allocationData.length === 1 ? "" : "s"}${topAllocationBucket ? ` and ${topAllocationBucket.name} is the largest at ${formatMoney(topAllocationBucket.value)}.` : "."} Help me understand whether this mix fits my current stage.`}
                mentorQuestionId="allocation"
                onOpenMentor={onOpenMentor}
                sourceLabel="Dashboard allocation"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Goal progress</CardTitle>
            <CardDescription>
              {goals.length
                ? `${goals.length} active goal${goals.length === 1 ? "" : "s"} in the planner.`
                : "Define goals so your monthly investing has named destinations."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/15 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Primary question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Does the monthly plan still fit reality, or are too many goals competing for the same money?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Goal priority and portfolio total together, so pressure and capacity stay in the same frame.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  If pressure is high, prune, stage, or resize before assuming the answer is simply a bigger SIP.
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What this section does
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Connects the money already set aside with the destinations you are trying to fund.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Watch closely
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Monthly pressure, not just total target size. That is usually what makes a plan feel realistic or strained.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    If pressure is too high, prioritize and resize before assuming the answer is simply to invest more.
                  </p>
                </div>
              </div>
            </div>
            {goals.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Funded so far
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatMoney(totalGoalCurrent)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Goal target
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatMoney(totalGoalTarget)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Monthly pressure
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatMoney(monthlyGoal)}
                    </p>
                  </div>
                </div>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={() => onNavigate("goals")}>
                    Review goals
                  </Button>
                  <AskMentorLink
                    label={`${mentorCtaLabel} about goal tradeoffs`}
                    mentorPrompt={`My dashboard shows ${goals.length} active goals, ${goalProgress}% total goal progress, and ${formatMoney(monthlyGoal)} of monthly goal pressure. Help me decide how to prioritize and fund them.`}
                    mentorQuestionId="goal-priority"
                    onOpenMentor={onOpenMentor}
                    sourceLabel="Dashboard goals"
                  />
                </div>
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
            <CardDescription>
              Keep imports reliable before stale holdings or broken syncs turn into bad decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/15 p-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Primary question
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Can the dashboard trust the underlying feed state enough to support the portfolio and market reads?
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read this with
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Import queue and settings cadence together, so you know whether the weak point is sync, review, or provider drift.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Repair the first weak lane, then rerun it once before trusting any fresh dashboard conclusion.
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Why this matters
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Good decisions get worse fast when the portfolio and import feeds are stale or broken.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What to watch
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Due connectors, warning streaks, and import lanes that are drifting from healthy review cycles.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Fix the first weak feed before trusting downstream allocation, market, or dashboard conclusions too much.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={connectorAttention.severity === "healthy" ? "secondary" : "outline"}>
                    {connectorAttention.badge}
                  </Badge>
                  <Badge variant="outline">
                    {connectorSchedulerPlan.activeCount} active
                  </Badge>
                </div>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {integrations.length
                    ? "Trust the data only when the feed layer is healthy."
                    : "Connect a first source so imports stop depending on one-off manual work."}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {integrations.length
                    ? connectorAttention.detail
                    : "Link a broker, inbox, or statement workflow and the dashboard can keep portfolio tracking fresher with less manual cleanup."}
                </p>
              </div>
              <div className="grid gap-2">
                <Button type="button" onClick={() => onOpenConnectorFocus({ section: "connected-sources" })}>
                  Review data feeds
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenConnectorFocus({ section: "import-history" })}>
                  Review import history
                </Button>
              </div>
            </div>
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
                    <div className="grid gap-3 rounded-md border bg-background p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          No connectors match this filter yet
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Try a broader filter, or open Settings to connect the first broker or inbox source for this lane.
                        </p>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Most common reason</p>
                          <p className="mt-1 text-sm font-medium">The filter is too narrow</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Best next move</p>
                          <p className="mt-1 text-sm font-medium">Review data feeds</p>
                        </div>
                      </div>
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
                  Review import history
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
                  <div className="grid gap-3 rounded-md border bg-background p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">No import outcomes yet</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Run a sync plan, inbox check, or statement import to start building review history and replayable decisions.
                      </p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Best first source</p>
                        <p className="mt-1 text-sm font-medium">One statement provider</p>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Why it matters</p>
                        <p className="mt-1 text-sm font-medium">History becomes teachable</p>
                      </div>
                    </div>
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
  detail,
  icon: Icon,
  label,
  onClick,
}: {
  detail: string;
  icon: typeof Compass;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-24 max-w-[220px] items-start justify-between whitespace-normal rounded-md border-border/70 bg-muted/15 p-4 text-left hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="grid gap-3">
        <Icon className="h-4 w-4" />
        <div className="grid gap-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs leading-5 text-muted-foreground">{detail}</span>
        </div>
      </div>
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
