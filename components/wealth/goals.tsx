"use client";

import { useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Plus, Target, TimerReset, Trash2 } from "lucide-react";
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

  return (
    <div className="grid gap-5">
      <Card
        ref={prioritiesRef}
        className="overflow-hidden border-border/70 bg-card/95 shadow-sm"
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
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{goals.length || 0} goals</Badge>
            <Badge variant="outline">{priorityCount} essential</Badge>
            <Badge variant="outline">{totalProgress}% funded</Badge>
          </div>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Multi-goal planner</CardTitle>
              <CardDescription>Plan emergency, lifestyle, and long-term goals together.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={onAddGoal}>
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <MetricMini label="Monthly target" value={formatMoney(monthlyGoal)} />
          <MetricMini label="Total target" value={formatMoney(totalTarget)} />
          <MetricMini label="Progress" value={`${totalProgress}%`} />
          <MetricMini label="Essential goals" value={`${priorityCount}`} />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Planning posture</CardTitle>
          <CardDescription>{planningHeadline}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
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
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>No goals yet</CardTitle>
                <CardDescription>
                  Add one real goal to unlock monthly targets, scenario checks, and funding milestones.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
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
          <Card ref={monthlySplitRef} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>Monthly split</CardTitle>
              <CardDescription>Required monthly investment by goal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
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

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>Planning checks</CardTitle>
              <CardDescription>Rule-based warnings for unrealistic timelines.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {planningChecks.map((check) => (
                <HealthCheck key={check.label} {...check} />
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>Funding posture</CardTitle>
              <CardDescription>Read the plan before the plan reads you.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
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
  const progress = calculateGoalProgress(goal);
  const monthlyInvestment = calculateGoalMonthlyInvestment(goal);
  const fundingGap = calculateGoalFundingGap(goal);
  const scenarios = getGoalScenarioRows(goal);
  const milestones = getGoalMilestones(goal);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{goalPriorityLabels[goal.priority]}</Badge>
              <Badge variant="outline">{progress}% funded</Badge>
            </div>
            <CardTitle>{goal.name}</CardTitle>
            <CardDescription>{formatMoney(monthlyInvestment)} required monthly</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>{formatMoney(goal.currentAmount)}</span>
            <span>{formatMoney(goal.targetAmount)}</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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
        <div className="grid gap-3 md:grid-cols-3">
          <MetricMini label="Monthly SIP" value={formatMoney(monthlyInvestment)} />
          <MetricMini label="Funding gap" value={formatMoney(fundingGap)} />
          <MetricMini label="Timeline" value={`${goal.years} years`} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Scenario view</p>
              <p className="mt-1 text-xs text-muted-foreground">
                See how sensitive the monthly requirement is to return assumptions.
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
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Milestone ladder</p>
              <p className="mt-1 text-xs text-muted-foreground">
                What this plan implies before the finish line arrives.
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
      </CardContent>
    </Card>
  );
}
