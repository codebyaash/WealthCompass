"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { HealthCheck } from "@/components/wealth/health-check";
import { MetricMini } from "@/components/wealth/metric-mini";
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

export function Goals({
  goals,
  monthlyGoal,
  onAddGoal,
  onDeleteGoal,
  onUpdateGoal,
}: {
  goals: WealthGoal[];
  monthlyGoal: number;
  onAddGoal: () => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateGoal: (goalId: string, goal: WealthGoal) => void;
}) {
  const { priorityCount, totalProgress, totalTarget } = getGoalSummary(goals);
  const chartData = getGoalMonthlySplit(goals);
  const planningChecks = getGoalPlanningChecks({
    formatMoney,
    goals,
    monthlyGoal,
    priorityCount,
    totalProgress,
  });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Multi-goal planner</CardTitle>
              <CardDescription>Plan emergency, lifestyle, and long-term goals together.</CardDescription>
            </div>
            <Button type="button" onClick={onAddGoal}>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="grid gap-4">
          {goals.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No goals yet</CardTitle>
                <CardDescription>Add a goal to calculate monthly investing targets.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={onAddGoal}>
                  <Plus className="h-4 w-4" />
                  Add Goal
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
          <Card>
            <CardHeader>
              <CardTitle>Monthly split</CardTitle>
              <CardDescription>Required monthly investment by goal.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
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
            </CardContent>
          </Card>

          <Card>
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

          <Card>
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
              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
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
