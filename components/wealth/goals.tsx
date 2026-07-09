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
      </CardContent>
    </Card>
  );
}
