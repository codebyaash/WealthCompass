"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, ChevronDown, Plus, Target, TimerReset, Trash2 } from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { HealthCheck } from "@/components/wealth/health-check";
import { MetricMini } from "@/components/wealth/metric-mini";
import { MentorOpenCue } from "@/components/wealth/mentor-open-cue";
import { NumberField, SelectField, TextField } from "@/components/wealth/form-fields";
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
import { PageNavigatorBar } from "@/components/wealth/page-navigator-bar";
import { formatMoney } from "@/lib/formatters";
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
import {
  calculateGoalFundingGap,
  getGoalMilestones,
  getGoalScenarioRows,
  calculateGoalProgress,
  getGoalMonthlySplit,
  getGoalPlanningChecks,
  getGoalSummary,
} from "@/lib/goal-rules";
import type { GoalPriority, WealthGoal } from "@/lib/local-storage";
import { calculateGoalMonthlyInvestment } from "@/lib/wealth-rules";

const goalPriorityLabels: Record<GoalPriority, string> = {
  aspirational: "Aspirational",
  essential: "Essential",
  important: "Important",
};

export type GoalsFocusTarget = "goal-list" | "goal-priorities" | "monthly-split";

function getGoalPriorityWeight(priority: GoalPriority) {
  switch (priority) {
    case "essential":
      return 3;
    case "important":
      return 2;
    case "aspirational":
    default:
      return 1;
  }
}

export function Goals({
  focusRequest,
  focusRequestKey,
  goals,
  mentorRevision,
  monthlyGoal,
  onAddGoal,
  onDeleteGoal,
  onOpenMentor,
  onUpdateGoal,
}: {
  focusRequest?: GoalsFocusTarget | null;
  focusRequestKey?: number;
  goals: WealthGoal[];
  mentorRevision: number;
  monthlyGoal: number;
  onAddGoal: () => void;
  onDeleteGoal: (goalId: string) => void;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  onUpdateGoal: (goalId: string, goal: WealthGoal) => void;
}) {
  const [navigatorValue, setNavigatorValue] = useState("goals-overview");
  const { priorityCount, totalCurrent, totalProgress, totalTarget } = getGoalSummary(goals);
  const chartData = getGoalMonthlySplit(goals);
  const planningChecks = getGoalPlanningChecks({
    formatMoney,
    goals,
    monthlyGoal,
    priorityCount,
    totalProgress,
  });
  const goalWithHighestMonthlyNeed = goals.reduce<WealthGoal | null>((current, goal) => {
    if (!current) return goal;
    return calculateGoalMonthlyInvestment(goal) > calculateGoalMonthlyInvestment(current)
      ? goal
      : current;
  }, null);
  const nearestDeadlineGoal = goals.reduce<WealthGoal | null>((current, goal) => {
    if (!current) return goal;
    if (goal.years !== current.years) {
      return goal.years < current.years ? goal : current;
    }
    return getGoalPriorityWeight(goal.priority) > getGoalPriorityWeight(current.priority)
      ? goal
      : current;
  }, null);
  const lowestProgressGoal = goals.reduce<WealthGoal | null>((current, goal) => {
    if (!current) return goal;
    return calculateGoalProgress(goal) < calculateGoalProgress(current) ? goal : current;
  }, null);
  const essentialShare = goals.length
    ? Math.round((priorityCount / goals.length) * 100)
    : 0;
  const planningHeadline =
    goals.length === 0
      ? "Start with one real goal, not five vague ones"
      : totalProgress < 10
        ? "Your goal map exists, now it needs sequencing"
        : totalProgress < 40
          ? "Progress is visible, so funding order matters more"
          : "The plan is taking shape, now keep it realistic and consistent";
  const planningDetail =
    goals.length === 0
      ? "A simple first goal with a target amount, timeline, and rough return assumption is enough to make the planner useful."
      : totalProgress < 10
        ? "This stage is mostly about choosing which goal deserves the first serious monthly commitment."
        : totalProgress < 40
          ? "You have enough momentum now that essential goals and shorter deadlines should stay clearly ahead of aspirational ones."
          : "This is where you keep the plan honest by checking stretch assumptions, deadlines, and contribution load.";
  const planningReadinessLabel =
    goals.length === 0
      ? "Setup in progress"
      : totalProgress < 10
        ? "Needs sequencing"
      : totalProgress < 40
        ? "Funding in motion"
        : "Plan taking shape";
  const goalsVerdictLabel =
    goals.length === 0
      ? "Goal plan is still forming"
      : totalProgress < 10
        ? "Sequencing matters more than optimization"
        : priorityCount === 0
          ? "Priority discipline is still missing"
          : "Plan is active and ready for pressure testing";
  const goalsVerdictToneClass =
    goals.length === 0
      ? "border-border bg-muted/30"
      : totalProgress < 10 || priorityCount === 0
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";
  const goalsVerdictBadgeVariant =
    goals.length > 0 && totalProgress >= 10 && priorityCount > 0 ? "secondary" : "outline";
  const goalsVerdictDetail =
    goals.length === 0
      ? "One real goal is enough to turn this page from theory into a usable planning surface."
      : totalProgress < 10
        ? "At this stage the highest-value move is deciding which goal truly deserves the first steady monthly commitment."
        : priorityCount === 0
          ? "The plan has numbers, but it still needs a clear distinction between essential and optional goals before monthly tradeoffs become trustworthy."
          : "The structure is good enough now that scenario stress, monthly split, and planning checks can actually guide decisions.";
  const goalsTopStats = [
    {
      label: "Goal count",
      value: `${goals.length}`,
      detail:
        goals.length > 0
          ? `${priorityCount} essential goal${priorityCount === 1 ? "" : "s"} in the stack.`
          : "No active goals yet.",
    },
    {
      label: "Essential share",
      value: goals.length ? `${essentialShare}%` : "0%",
      detail:
        goals.length > 0
          ? "Shows how much of the plan is non-negotiable."
          : "This becomes useful once priorities are marked.",
    },
    {
      label: "Monthly pressure",
      value: formatMoney(monthlyGoal),
      detail:
        monthlyGoal > 0
          ? "Current combined monthly contribution pace."
          : "Still unclear until targets and timelines are real.",
    },
    {
      label: "Plan progress",
      value: `${totalProgress}%`,
      detail:
        goals.length > 0
          ? "Whole-plan progress, not just one goal."
          : "Progress appears once the first goal is defined.",
    },
  ];
  const goalsOperatingLenses = [
    {
      label: "Funding strain",
      value: goalWithHighestMonthlyNeed
        ? goalWithHighestMonthlyNeed.name
        : "Not visible",
      detail: goalWithHighestMonthlyNeed
        ? `${formatMoney(calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed))} per month is the heaviest single ask.`
        : "The biggest monthly strain shows up once goals have real detail.",
    },
    {
      label: "Deadline pressure",
      value: nearestDeadlineGoal ? nearestDeadlineGoal.name : "Unknown",
      detail: nearestDeadlineGoal
        ? `${nearestDeadlineGoal.years} year${nearestDeadlineGoal.years === 1 ? "" : "s"} left on the nearest goal.`
        : "Deadline tension becomes clearer after timelines are filled in.",
    },
    {
      label: "Weakest progress",
      value: lowestProgressGoal ? lowestProgressGoal.name : "--",
      detail: lowestProgressGoal
        ? `${calculateGoalProgress(lowestProgressGoal)}% funded right now.`
        : "Once multiple goals exist, this highlights what is falling behind.",
    },
  ];
  const monthlySplitVerdictLabel =
    goals.length === 0
      ? "No split yet"
      : goalWithHighestMonthlyNeed &&
          calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed) > monthlyGoal * 0.5
        ? "One goal is dominating the monthly load"
        : "Monthly split is readable";
  const monthlySplitVerdictToneClass =
    goals.length === 0
      ? "border-border bg-muted/30"
      : goalWithHighestMonthlyNeed &&
          calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed) > monthlyGoal * 0.5
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";
  const monthlySplitVerdictBadgeVariant =
    goals.length > 0 &&
    (!goalWithHighestMonthlyNeed ||
      calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed) <= monthlyGoal * 0.5)
      ? "secondary"
      : "outline";
  const planningChecksLead = planningChecks[0] ?? null;
  const planningChecksVerdictLabel =
    planningChecks.length === 0
      ? "Stress checks are waiting on more detail"
      : planningChecksLead &&
          `${planningChecksLead.status} ${planningChecksLead.label}`.toLowerCase().includes("healthy")
        ? "Plan stress looks manageable"
        : planningChecksLead
          ? `${planningChecksLead.label} should be cleared first`
          : "Plan stress needs review";
  const planningChecksVerdictToneClass =
    planningChecks.length === 0
      ? "border-border bg-muted/30"
      : planningChecksLead &&
          `${planningChecksLead.status} ${planningChecksLead.label}`.toLowerCase().includes("healthy")
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-sky-500/30 bg-sky-500/10";
  const planningChecksVerdictBadgeVariant =
    planningChecks.length > 0 &&
    planningChecksLead &&
    `${planningChecksLead.status} ${planningChecksLead.label}`.toLowerCase().includes("healthy")
      ? "secondary"
      : "outline";
  const fundingPostureVerdictLabel =
    goals.length === 0
      ? "Funding posture not visible yet"
      : priorityCount === 0
        ? "Priority posture is still fuzzy"
        : essentialShare >= 50
          ? "Essentials are leading the stack"
          : "Optional goals may be competing too early";
  const fundingPostureVerdictToneClass =
    goals.length === 0
      ? "border-border bg-muted/30"
      : priorityCount === 0 || essentialShare < 50
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";
  const fundingPostureBadgeVariant =
    goals.length > 0 && priorityCount > 0 && essentialShare >= 50 ? "secondary" : "outline";
  const goalsMentorPrompt =
    goals.length > 0
      ? [
          `I have ${goals.length} active goals and a combined monthly goal pace of ${formatMoney(monthlyGoal)}.`,
          `The current planning read is "${planningHeadline}".`,
          priorityCount > 0
            ? `${priorityCount} goals are marked essential.`
            : "I have not marked any goals essential yet.",
          goalWithHighestMonthlyNeed
            ? `The heaviest monthly goal is ${goalWithHighestMonthlyNeed.name} at ${formatMoney(calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed))} per month.`
            : null,
          nearestDeadlineGoal
            ? `The nearest deadline goal is ${nearestDeadlineGoal.name} with ${nearestDeadlineGoal.years} years left.`
            : null,
          lowestProgressGoal
            ? `The least-funded goal right now is ${lowestProgressGoal.name} at ${calculateGoalProgress(lowestProgressGoal)}% progress.`
            : null,
          "Help me decide what to fund first, what can wait, and what looks unrealistic.",
        ]
          .filter(Boolean)
          .join(" ")
      : "I have not added any goals yet. Help me choose the first real goal I should define so this planner becomes useful.";
  const prioritiesRef = useRef<HTMLDivElement | null>(null);
  const goalListRef = useRef<HTMLDivElement | null>(null);
  const monthlySplitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusRequest) return;

    window.requestAnimationFrame(() => {
      (
        {
          "goal-list": goalListRef,
          "goal-priorities": prioritiesRef,
          "monthly-split": monthlySplitRef,
        } satisfies Record<GoalsFocusTarget, typeof prioritiesRef>
      )[focusRequest]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [focusRequest, focusRequestKey]);

  const scrollToPriorities = () => {
    prioritiesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToMonthlySplit = () => {
    monthlySplitRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const goalsPriorityQueue = [
    goals.length === 0
      ? {
          action: "add-goal" as const,
          detail:
            "One real goal with a number and timeline is enough to turn this page from theory into a useful monthly plan.",
          label: "Add the first real goal",
          section: "Goal list",
          tone: "urgent" as const,
        }
      : totalProgress < 10
        ? {
            action: "priorities" as const,
            detail:
              "The plan exists, but it still needs a clear funding order before monthly pressure becomes trustworthy.",
            label: "Sequence the goal stack",
            section: "Priorities",
            tone: "urgent" as const,
          }
        : {
            action: "priorities" as const,
            detail: planningDetail,
            label: "Keep the goal stack realistic",
            section: "Planning posture",
            tone: "urgent" as const,
          },
    goalWithHighestMonthlyNeed
      ? {
          action: "monthly-split" as const,
          detail: `${goalWithHighestMonthlyNeed.name} is asking for ${formatMoney(calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed))} per month, which is currently the heaviest single strain in the plan.`,
          label: "Review the biggest monthly ask",
          section: "Monthly split",
          tone: "watch" as const,
        }
      : {
          action: "add-goal" as const,
          detail:
            "Once goals have target amounts and timelines, the biggest monthly pressure point will appear here.",
          label: "Build a visible monthly split",
          section: "Monthly split",
          tone: "watch" as const,
        },
    planningChecks[0]
      ? {
          action: "monthly-split" as const,
          detail: planningChecks[0].status,
          label: `Clear ${planningChecks[0].label.toLowerCase()}`,
          section: "Planning checks",
          tone:
            `${planningChecks[0].status} ${planningChecks[0].label}`.toLowerCase().includes(
              "healthy",
            ) ||
            `${planningChecks[0].status} ${planningChecks[0].label}`.toLowerCase().includes(
              "good",
            )
              ? ("steady" as const)
              : ("watch" as const),
        }
      : {
          action: "monthly-split" as const,
          detail:
            "Checks become more useful as soon as multiple goals are competing for the same monthly cash flow.",
          label: "Watch for planning strain",
          section: "Checks",
          tone: "steady" as const,
        },
  ];

  const handlePriorityQueueAction = (
    action: "add-goal" | "priorities" | "monthly-split",
  ) => {
    if (action === "add-goal") {
      onAddGoal();
      return;
    }

    if (action === "priorities") {
      scrollToPriorities();
      return;
    }

    scrollToMonthlySplit();
  };

  const goalsNavigatorOptions = [
    ["goals-overview", "Overview: goal pressure"],
    ["goals-priorities", "Overview: priority order"],
    ["goals-list", "Editor: goal list"],
    ["goals-monthly-split", "Funding: monthly split"],
    ["goals-planning-checks", "Checks: plan stress"],
    ["goals-funding-posture", "Read: funding posture"],
  ] as Array<[string, string]>;

  const handleGoalsNavigatorChange = (value: string) => {
    setNavigatorValue(value);
    if (value === "goals-overview" || value === "goals-priorities") {
      prioritiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (value === "goals-list") {
      goalListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (value === "goals-monthly-split") {
      monthlySplitRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document.getElementById(value)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-5">
      <Card
        id="goals-overview"
        ref={prioritiesRef}
        className="wealth-panel-strong overflow-hidden"
      >
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Goal planning desk</Badge>
              <Badge variant="outline">{planningReadinessLabel}</Badge>
              <Badge variant="outline">{goals.length || 0} goals</Badge>
              <Badge variant="outline">{totalProgress}% funded</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Give every rupee a destination before goals start competing in the dark.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This page works best when each goal has a real amount, a real timeline, and a clear priority. Once that is in place, monthly pressure, scenario drift, and milestone pacing become much easier to judge.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Step 1
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">Define the real goals</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Start with the goals you genuinely intend to fund, not every nice-to-have idea at once.
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Step 2
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">Sequence by importance and time</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Essential and near-term goals should become visible before aspirational goals compete for the same monthly cash flow.
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Step 3
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">Stress the monthly pace</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Use the split, scenarios, and checks to see whether the plan still feels livable in the real world.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  Goal load
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {goals.length > 0
                    ? `${goals.length} active goals are sharing ${formatMoney(monthlyGoal)} of monthly funding pressure.`
                    : "No active goals yet, so the planner is waiting on the first real target."}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <TimerReset className="h-3.5 w-3.5" />
                  Sequence risk
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {priorityCount > 0
                    ? `${priorityCount} essential goal${priorityCount === 1 ? "" : "s"} should stay ahead of aspirational funding.`
                    : "Mark the truly non-negotiable goals first so the plan can sequence them correctly."}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Funding pace
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {monthlyGoal > 0
                    ? `${formatMoney(monthlyGoal)} per month is the current combined contribution pace.`
                  : "Monthly pace is still unclear because the goals need more detail."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {goalsTopStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-border/70 bg-background/80 p-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.detail}</p>
                </div>
              ))}
            </div>
            <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${goalsVerdictToneClass}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Plan verdict</p>
                  <Badge variant={goalsVerdictBadgeVariant}>{goalsVerdictLabel}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{goalsVerdictDetail}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best operating move
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {goals.length === 0
                    ? "Add one real goal first"
                    : totalProgress < 10
                      ? "Sequence the stack before stretching the math"
                      : priorityCount === 0
                        ? "Mark essential goals before trusting the pace"
                        : "Pressure-test the monthly plan"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {goals.length === 0
                    ? "A single real goal creates the baseline the rest of the page can reason from."
                    : totalProgress < 10
                      ? "The order of funding matters more right now than marginal return assumptions."
                      : priorityCount === 0
                        ? "Without priority discipline, a numerically neat plan can still be strategically weak."
                        : "Once the stack is honest, monthly split and plan stress become the right places to challenge it."}
                </p>
              </div>
            </div>
            <div className="grid gap-3 rounded-md border border-border/70 bg-background/80 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Action lanes</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Use this when you want the shortest route from a goal overview to the next planning move.
                  </p>
                </div>
                <Badge variant="outline">{goalsPriorityQueue.length} active focus</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {goalsPriorityQueue.map(({ action, detail, label, section, tone }) => (
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => handlePriorityQueueAction(action)}
                    >
                      Open next lane
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" data-testid="goals-header-add" onClick={onAddGoal}>
                <Plus className="h-4 w-4" />
                Add goal
                <ArrowRight className="h-4 w-4" />
              </Button>
              <AskMentorLink
                label="Ask AI mentor how to prioritize goals"
                mentorPrompt={goalsMentorPrompt}
                mentorQuestionId="sip"
                onOpenMentor={onOpenMentor}
                sourceLabel="Goals prioritization"
              />
            </div>
            <MentorOpenCue
              cueLabel="Still open before funding"
              description="You already have an open mentor thread that could help you sequence this goal plan before committing more monthly money."
              mentorRevision={mentorRevision}
              onOpenMentor={onOpenMentor}
              questionIds={["sip", "first-investment", "risk"]}
              resumeLabel="Refine this with AI mentor"
              sourceLabel="Goals"
              stuckLabel="Unblock this before funding further"
            />
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Planner read
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">{planningHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{planningDetail}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {goals.length === 0
                  ? "Start with one goal you truly intend to fund in the next 12 months."
                  : planningChecks[0]?.status ??
                    "Tighten the highest-priority goal first, then make sure the monthly number still feels livable."}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Do not confuse
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                A long goal list is not a real plan. The plan becomes useful only when amount, timeline, and monthly funding order are honest.
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Working order
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                <li>Protect essential and near-term goals before stretching into aspirational ones.</li>
                <li>Make the monthly number livable first, then optimize for faster outcomes.</li>
                <li>Let lower-priority goals wait if the plan starts feeling tight too early.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <PageNavigatorBar
        label="Goals navigator"
        options={goalsNavigatorOptions}
        value={navigatorValue}
        onChange={handleGoalsNavigatorChange}
      />

      <Card id="goals-list" ref={goalListRef} className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{goals.length || 0} goals</Badge>
            <Badge variant="outline">{priorityCount} essential</Badge>
            <Badge variant="outline">{totalProgress}% funded</Badge>
          </div>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Editor: goal list</CardTitle>
              <CardDescription>Plan essential, lifestyle, and long-term goals in one funding stack.</CardDescription>
            </div>
            <Button type="button" onClick={onAddGoal}>
              <Plus className="h-4 w-4" />
              Add goal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${
            goals.length === 0
              ? "border-sky-500/30 bg-sky-500/10"
              : priorityCount === 0
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
          }`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Goal list verdict</p>
                <Badge variant={goals.length === 0 ? "outline" : "secondary"}>
                  {goals.length === 0
                    ? "Start with one real goal"
                    : priorityCount === 0
                      ? "Priority posture still needs work"
                      : "Goal stack is usable"}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {goals.length === 0
                  ? "You only need one real goal with an amount and a date to turn this page from blank planning into a useful funding model."
                  : priorityCount === 0
                    ? "The list has goals, but nothing is clearly marked essential yet, so the stack can still hide poor sequencing."
                    : "The list is now strong enough to compare funding tradeoffs, scenario ranges, and milestone pacing with more confidence."}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best operating move
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {goals.length === 0
                  ? "Add the first goal with a real date"
                  : priorityCount === 0
                    ? "Mark what is truly essential first"
                    : "Pressure-test the heaviest monthly ask"}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {goals.length === 0
                  ? "The first goal should be the one you genuinely expect to fund, not the one that sounds most ambitious."
                  : priorityCount === 0
                    ? "Priority works best when it reflects what must be protected before lifestyle or optional goals start competing."
                    : "Once the stack is real, the biggest monthly ask usually tells you where the plan will either hold or start bending."}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricMini label="Monthly target" value={formatMoney(monthlyGoal)} />
            <MetricMini label="Total target" value={formatMoney(totalTarget)} />
            <MetricMini label="Progress" value={`${totalProgress}%`} />
            <MetricMini label="Essential goals" value={`${priorityCount}`} />
          </div>
        </CardContent>
      </Card>

      <Card className="wealth-panel-strong overflow-hidden">
        <CardHeader>
          <CardTitle>Overview: goal pressure</CardTitle>
          <CardDescription>{planningHeadline}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-md border bg-muted/20 p-4 xl:col-span-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Use this lane for
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Understanding whether the plan is coherent before you over-optimize individual goals.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Watch closely
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Monthly pressure, essential share, and whether short timelines are colliding with weak funding.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Fix sequencing and realism first, then refine return assumptions and milestone pacing.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 xl:col-span-2 xl:grid-cols-3">
            {goalsOperatingLenses.map((lens) => (
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
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm leading-6 text-muted-foreground">{planningDetail}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  1. Protect first
                </p>
                <p className="mt-2 text-sm leading-6">
                  Emergency, near-term, and non-negotiable goals should be visible before lifestyle goals compete for the same money.
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  2. Date the goal
                </p>
                <p className="mt-2 text-sm leading-6">
                  A goal without a timeline becomes a wish list. The year matters as much as the amount.
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  3. Stress the plan
                </p>
                <p className="mt-2 text-sm leading-6">
                  Use the scenario view to see whether the monthly number still feels livable when returns are less generous.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Money already assigned
              </p>
              <p className="mt-2 text-lg font-semibold">{formatMoney(totalCurrent)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Already working toward active goals
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Essential share
              </p>
              <p className="mt-2 text-lg font-semibold">{essentialShare}%</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Of active goals marked essential
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Planner read
              </p>
              <p className="mt-2 text-sm leading-6">
                {goals.length === 0
                  ? "Start with one goal you genuinely intend to fund in the next 12 months."
                  : monthlyGoal > 0
                    ? `${formatMoney(monthlyGoal)} per month is the current combined pace across all active goals.`
                    : "Your current goals still need target and timeline detail before a useful monthly pace appears."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div ref={goalListRef} className="grid gap-4">
          {goals.length === 0 ? (
            <Card className="wealth-panel-strong overflow-hidden">
              <CardHeader>
                <CardTitle>Start with one real goal</CardTitle>
                <CardDescription>
                  Add one real goal to unlock monthly targets, scenario checks, and funding milestones.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 rounded-md border border-sky-500/30 bg-sky-500/10 p-4 md:grid-cols-[1fr_0.9fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">First-goal verdict</p>
                      <Badge variant="outline">You are one real input away</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      This page does not need a perfect life plan. It needs one goal with a believable amount and a believable date so the rest of the funding math can become concrete.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/70 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Best operating move
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">Pick the goal you already care about funding</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      A useful first goal usually has emotional reality behind it: buffer, home, retirement base, or another commitment you already know matters.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">Best first pick</p>
                    <p className="mt-1 text-sm font-medium">Choose the most real goal</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Start with the goal you are most likely to fund consistently, not the most impressive one.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">Keep it useful</p>
                    <p className="mt-1 text-sm font-medium">Use a number and a date</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      A rough target amount and realistic timeline are enough to unlock a meaningful monthly plan.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">Best next move</p>
                    <p className="mt-1 text-sm font-medium">Let one goal anchor the plan</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Once the first goal is in place, the rest of the page becomes much easier to trust and compare.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-sm font-medium">Emergency buffer</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Best first goal when cash resilience still feels thin.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-sm font-medium">Home down payment</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Good when the amount is known and the timeline is real.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-sm font-medium">Retirement base</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Good for long-horizon compounding even if the final number is rough today.
                    </p>
                  </div>
                </div>
                <AskMentorLink
                  label="Ask AI mentor what first goal to add"
                  mentorPrompt="I do not have any goals yet. Help me pick the first goal that will make my financial plan feel concrete instead of vague."
                  mentorQuestionId="first-investment"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Goals first real goal"
                />
                <Button type="button" data-testid="goals-empty-add" onClick={onAddGoal}>
                  <Plus className="h-4 w-4" />
                  Add your first goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            goals.map((goal) => (
              <GoalEditor
                key={goal.id}
                goal={goal}
                onDelete={() => onDeleteGoal(goal.id)}
                onUpdate={(nextGoal) => onUpdateGoal(goal.id, nextGoal)}
              />
            ))
          )}
        </div>

        <div className="grid gap-5">
          <Card id="goals-monthly-split" ref={monthlySplitRef} className="wealth-panel-strong overflow-hidden">
            <CardHeader>
              <CardTitle>Funding: monthly split</CardTitle>
              <CardDescription>See which goals are competing for the same monthly money.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${monthlySplitVerdictToneClass}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Monthly split verdict</p>
                    <Badge variant={monthlySplitVerdictBadgeVariant}>{monthlySplitVerdictLabel}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {goals.length === 0
                      ? "The split becomes useful once at least one goal has a real amount and timeline."
                      : goalWithHighestMonthlyNeed &&
                          calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed) > monthlyGoal * 0.5
                        ? `${goalWithHighestMonthlyNeed.name} is taking more than half of the visible monthly pace, which usually means the timeline, target, or priority deserves a second look.`
                        : "No single goal is overwhelming the monthly split right now, so the plan is easier to sequence calmly."}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Best operating move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {goalWithHighestMonthlyNeed
                      ? `Interrogate ${goalWithHighestMonthlyNeed.name} first`
                      : "Define goals before reading the split"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    The goal with the largest monthly ask is usually where the whole plan either becomes realistic or starts quietly distorting itself.
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
                      The monthly load each goal is asking from the same pool of money.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      What to notice
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Which single goal is crowding out the others, and whether the combined pace still feels realistic.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Best move
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      If one bar dominates, revisit that goal’s amount, timeline, or priority before forcing the whole plan to stretch around it.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AskMentorLink
                  label="Ask AI mentor if this split is realistic"
                  mentorPrompt={
                    goals.length > 0
                      ? [
                          `My current goal plan needs about ${formatMoney(monthlyGoal)} per month in total.`,
                          goalWithHighestMonthlyNeed
                            ? `${goalWithHighestMonthlyNeed.name} alone needs ${formatMoney(calculateGoalMonthlyInvestment(goalWithHighestMonthlyNeed))} per month.`
                            : null,
                          nearestDeadlineGoal
                            ? `${nearestDeadlineGoal.name} is the nearest deadline goal at ${nearestDeadlineGoal.years} years.`
                            : null,
                          "Tell me whether this monthly split looks realistic and where I should simplify first.",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : "I have no active goals yet. Help me understand what a realistic first monthly split usually looks like."
                  }
                  mentorQuestionId="sip"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Goals monthly split"
                />
              </div>
              <div className="h-72">
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
                  <Bar dataKey="monthly" radius={[6, 6, 0, 0]} fill="var(--color-chart-2)" />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card id="goals-planning-checks" className="wealth-panel-strong overflow-hidden">
            <CardHeader>
              <CardTitle>Checks: plan stress</CardTitle>
              <CardDescription>Catch timelines, assumptions, and funding loads that are drifting out of range.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${planningChecksVerdictToneClass}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Plan stress verdict</p>
                    <Badge variant={planningChecksVerdictBadgeVariant}>{planningChecksVerdictLabel}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {planningChecksLead
                      ? planningChecksLead.status
                      : "Once timelines, targets, and priorities are real enough, the first planning strain will show up here."}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Best operating move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {planningChecksLead
                      ? `Clear ${planningChecksLead.label.toLowerCase()} first`
                      : "Add detail before stress-testing"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    The first strained assumption usually matters more than the rest because it distorts every other goal decision around it.
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
                      Checks that catch timelines, funding loads, or return assumptions that are drifting out of range.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      How to read it
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Treat these as early warning lights, not final judgments on whether a goal is possible.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Best move
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Fix the most strained assumption first, then recheck whether the overall plan still feels livable.
                    </p>
                  </div>
                </div>
              </div>
              {planningChecks.map((check) => (
                <HealthCheck key={check.label} {...check} />
              ))}
            </CardContent>
          </Card>

          <Card id="goals-funding-posture" className="wealth-panel-strong overflow-hidden">
            <CardHeader>
              <CardTitle>Read: funding posture</CardTitle>
              <CardDescription>Read the plan before the plan reads you.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${fundingPostureVerdictToneClass}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Funding posture verdict</p>
                    <Badge variant={fundingPostureBadgeVariant}>{fundingPostureVerdictLabel}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {goals.length === 0
                      ? "Funding posture only becomes meaningful once the stack contains real goals."
                      : priorityCount === 0
                        ? "The plan can still look orderly while hiding poor sequencing if nothing has been marked essential."
                        : essentialShare >= 50
                          ? "The stack is giving meaningful room to non-negotiable goals before stretching into optional ones."
                          : "The current goal mix may be letting optional ambitions compete too early with the goals that matter most."}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Best operating move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {goals.length === 0
                      ? "Build the first funding stack"
                      : priorityCount === 0
                        ? "Mark essential goals first"
                        : essentialShare >= 50
                          ? "Keep essentials protected while refining the pace"
                          : "Move essential goals ahead of aspirational strain"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Goal posture gets stronger when the plan protects what truly matters before it starts chasing everything that sounds good.
                  </p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      What it means
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      This is the overall temperament of the plan, not just the arithmetic.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Good sign
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Essential goals are protected and the monthly load still feels sustainable.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bad sign
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Aspirational goals are competing too early or the average monthly need is already uncomfortable.
                    </p>
                  </div>
                </div>
              </div>
              <MetricMini
                label="Avg monthly per goal"
                value={goals.length ? formatMoney(Math.round(monthlyGoal / goals.length)) : formatMoney(0)}
              />
              <MetricMini
                label="Essential goal share"
                value={goals.length ? `${Math.round((priorityCount / goals.length) * 100)}%` : "0%"}
              />
              <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                Essential goals should usually be funded before aspirational ones start competing for the same monthly cash flow.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GoalEditor({
  goal,
  onDelete,
  onUpdate,
}: {
  goal: WealthGoal;
  onDelete: () => void;
  onUpdate: (goal: WealthGoal) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const progress = calculateGoalProgress(goal);
  const monthlyInvestment = calculateGoalMonthlyInvestment(goal);
  const fundingGap = calculateGoalFundingGap(goal);
  const scenarios = getGoalScenarioRows(goal);
  const milestones = getGoalMilestones(goal);
  const goalVerdictLabel =
    progress >= 75
      ? "Goal is structurally in good shape"
      : fundingGap > goal.targetAmount * 0.25
        ? "Funding pressure is still heavy"
        : goal.years <= 3
          ? "Timeline discipline matters here"
          : "Goal is progressing, but still needs support";
  const goalVerdictToneClass =
    progress >= 75
      ? "border-emerald-500/30 bg-emerald-500/10"
      : fundingGap > goal.targetAmount * 0.25
        ? "border-amber-500/30 bg-amber-500/10"
        : goal.years <= 3
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-border bg-muted/30";
  const goalVerdictBadgeVariant =
    progress >= 75 ? "secondary" : "outline";
  const goalVerdictDetail =
    progress >= 75
      ? "This goal is already carrying a healthy amount of progress, so the job is mostly keeping the plan honest rather than rescuing it."
      : fundingGap > goal.targetAmount * 0.25
        ? "A large remaining gap means the monthly pace and timeline should be challenged before this goal quietly distorts the rest of the plan."
        : goal.years <= 3
          ? "Short timelines magnify every assumption, so small changes to pace or target realism matter more here."
          : "This goal is moving, but it still needs a clear decision on whether funding pace, timing, or priority is the main lever.";
  const baseScenario = scenarios[1] ?? scenarios[0] ?? null;
  const stressScenario = scenarios[0] ?? null;
  const optimisticScenario = scenarios[scenarios.length - 1] ?? null;
  const scenarioSpread =
    stressScenario && optimisticScenario
      ? optimisticScenario.monthly - stressScenario.monthly
      : 0;
  const scenarioVerdictLabel =
    scenarioSpread >= monthlyInvestment * 0.35
      ? "Monthly need is sensitive to assumptions"
      : "Scenario range looks manageable";
  const scenarioVerdictToneClass =
    scenarioSpread >= monthlyInvestment * 0.35
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-emerald-500/30 bg-emerald-500/5";
  const scenarioVerdictBadgeVariant =
    scenarioSpread >= monthlyInvestment * 0.35 ? "outline" : "secondary";
  const milestoneLead = milestones[0] ?? null;
  const milestoneVerdictLabel =
    milestoneLead
      ? `First milestone is ${milestoneLead.timeToMilestoneLabel}`
      : "Milestones appear once the goal has enough detail";
  const nextEditCue =
    fundingGap > goal.targetAmount * 0.25
      ? {
          label: "Adjust the funding pace",
          detail: "The remaining gap is still heavy relative to the target, so monthly contribution is the first lever worth challenging.",
        }
      : goal.years <= 3
        ? {
            label: "Recheck the timeline",
            detail: "Short timelines amplify every assumption, so even a small date change can calm the whole plan.",
          }
        : goal.priority === "aspirational"
          ? {
              label: "Recheck priority",
              detail: "If this goal is quietly competing with essentials, the stack may need cleaner sequencing before more funding math.",
            }
          : {
              label: "Stress the return assumption",
              detail: "The core structure is decent, so the next useful check is whether the expected return is making the goal look easier than it really is.",
            };
  const summaryLine = [
    `${formatMoney(monthlyInvestment)} / month`,
    `${goal.years} year${goal.years === 1 ? "" : "s"}`,
    `${progress}% funded`,
  ].join(" · ");
  const goalFormGuide = [
    {
      label: "Goal identity",
      detail: "Name and priority tell the planner what this goal is and whether it must be protected before optional goals.",
    },
    {
      label: "Funding math",
      detail: "Current amount and target amount decide the visible gap you are asking the plan to close.",
    },
    {
      label: "Timeline and assumptions",
      detail: "Years remaining and expected return decide how much pressure lands on the monthly number.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{goalPriorityLabels[goal.priority]}</Badge>
                <Badge variant="outline">{progress}% funded</Badge>
              </div>
              <CardTitle>{goal.name}</CardTitle>
              <CardDescription>{summaryLine}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded((current) => !current)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                {isExpanded ? "Hide details" : "Show details"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recommended next edit
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{nextEditCue.label}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{nextEditCue.detail}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick read
              </p>
              <p className="mt-2 text-sm text-foreground">
                {fundingGap > 0
                  ? `${formatMoney(fundingGap)} still needs to be bridged to reach this target.`
                  : "The funding gap is closed on paper, so realism and consistency matter more than raw pace."}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      {isExpanded ? <CardContent className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="wealth-stat-tile p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              This goal asks for
            </p>
            <p className="mt-2 text-sm text-foreground">
              {formatMoney(monthlyInvestment)} per month on the current base-case path.
            </p>
          </div>
          <div className="wealth-stat-tile p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Watch closely
            </p>
            <p className="mt-2 text-sm text-foreground">
              Whether the timeline is too aggressive for the funding gap you still have left.
            </p>
          </div>
          <div className="wealth-stat-tile p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Best move
            </p>
            <p className="mt-2 text-sm text-foreground">
              Adjust amount, years, or priority until this goal fits the rest of the plan without distorting it.
            </p>
          </div>
        </div>
        <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${goalVerdictToneClass}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Goal verdict</p>
              <Badge variant={goalVerdictBadgeVariant}>{goalVerdictLabel}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{goalVerdictDetail}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best operating move
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {fundingGap > 0
                ? "Challenge the monthly pace before anything else"
                : progress >= 75
                  ? "Keep the goal consistent and realistic"
                  : "Adjust one planning lever at a time"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {fundingGap > 0
                ? "A goal with a visible remaining gap usually gets clearer faster when you test contribution pace and timeline before tweaking smaller details."
                : progress >= 75
                  ? "The main risk here is becoming overconfident with assumptions rather than underfunding the goal."
                  : "Changing amount, years, and priority all at once makes it harder to tell what actually improved the plan."}
            </p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>{formatMoney(goal.currentAmount)}</span>
            <span>{formatMoney(goal.targetAmount)}</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {goalFormGuide.map((item) => (
              <div key={item.label} className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Goal identity</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Make the goal easy to recognize and easy to sequence against the rest of your plan.
                </p>
              </div>
              <TextField
                label="Goal name"
                value={goal.name}
                onChange={(value) => onUpdate({ ...goal, name: value })}
              />
              <SelectField
                label="Priority"
                value={goal.priority}
                options={Object.entries(goalPriorityLabels)}
                onChange={(value) => onUpdate({ ...goal, priority: value as GoalPriority })}
              />
            </div>
            <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Funding math</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  These two numbers decide how far away the finish line still is.
                </p>
              </div>
              <NumberField
                label="Current amount"
                value={goal.currentAmount}
                onChange={(value) => onUpdate({ ...goal, currentAmount: value })}
              />
              <NumberField
                label="Target amount"
                value={goal.targetAmount}
                onChange={(value) => onUpdate({ ...goal, targetAmount: value })}
              />
            </div>
            <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Timeline and assumptions</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This is where monthly pressure usually rises or falls the fastest.
                </p>
              </div>
              <NumberField
                label="Years remaining"
                value={goal.years}
                onChange={(value) => onUpdate({ ...goal, years: value })}
              />
              <NumberField
                label="Expected annual return %"
                value={goal.annualReturn}
                onChange={(value) => onUpdate({ ...goal, annualReturn: value })}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricMini label="Monthly SIP" value={formatMoney(monthlyInvestment)} />
          <MetricMini label="Funding gap" value={formatMoney(fundingGap)} />
          <MetricMini label="Timeline" value={`${goal.years} years`} />
        </div>
        <div className="wealth-inset grid gap-3 p-3 md:grid-cols-3">
          <div className="wealth-stat-tile p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Goal posture
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {progress >= 75 ? "Well funded" : progress >= 40 ? "On the way" : "Needs more support"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Use this as the quick read before changing priority or timeline.
            </p>
          </div>
          <div className="wealth-stat-tile p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Biggest lever
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {fundingGap > 0 ? "Monthly contribution" : "Time and return assumptions"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Small timeline changes and unrealistic return assumptions can distort the monthly number fast.
            </p>
          </div>
          <div className="wealth-stat-tile p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best next move
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              Adjust one variable at a time
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Change amount, years, or priority one by one so you can see what actually improves the goal.
            </p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="wealth-muted-block grid gap-3 p-3">
            <div>
              <p className="text-sm font-medium">Scenario view</p>
              <p className="mt-1 text-xs text-muted-foreground">
                See how sensitive the monthly requirement is to return assumptions.
              </p>
            </div>
            <div className={`grid gap-2 rounded-md border p-3 text-xs ${scenarioVerdictToneClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Scenario verdict</p>
                <Badge variant={scenarioVerdictBadgeVariant}>{scenarioVerdictLabel}</Badge>
              </div>
              <p className="leading-5 text-muted-foreground">
                {scenarioSpread >= monthlyInvestment * 0.35
                  ? "Small return-assumption changes are moving the monthly ask meaningfully, so this goal should be judged with extra realism."
                  : "The scenario range is not wildly distorting the monthly ask, which makes the base plan easier to trust."}
              </p>
            </div>
            <div className="grid gap-2">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.label}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{scenario.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {scenario.annualReturn}% annual return
                    </p>
                  </div>
                  <Badge variant="secondary">{formatMoney(scenario.monthly)}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="wealth-muted-block grid gap-3 p-3">
            <div>
              <p className="text-sm font-medium">Milestone ladder</p>
              <p className="mt-1 text-xs text-muted-foreground">
                What this plan implies before the finish line arrives.
              </p>
            </div>
            <div className="grid gap-2 rounded-md border border-border/70 bg-background/70 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Milestone verdict</p>
                <Badge variant="outline">{milestoneVerdictLabel}</Badge>
              </div>
              <p className="leading-5 text-muted-foreground">
                {milestoneLead
                  ? `${milestoneLead.label} is the first checkpoint to keep honest. If that step already feels stretched, the finish-line math probably does too.`
                  : "Once the goal has enough usable detail, milestone pacing will show whether the path to the target actually feels believable."}
              </p>
            </div>
            <div className="grid gap-2">
              {milestones.map((milestone) => (
                <div
                  key={milestone.label}
                  className="grid gap-1 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{milestone.label}</p>
                    <Badge variant="outline">{formatMoney(milestone.targetAmount)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Base plan pace: {milestone.timeToMilestoneLabel} · Needs {formatMoney(milestone.monthlyNeeded)} monthly if this were the only milestone target.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent> : null}
    </Card>
  );
}
