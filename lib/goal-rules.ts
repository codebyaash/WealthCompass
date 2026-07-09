import type { WealthGoal } from "./local-storage";
import { calculateGoalMonthlyInvestment } from "./wealth-rules";

export type GoalPlanningCheck = {
  label: string;
  status: string;
  value: string;
};

export function calculateGoalProgress(goal: WealthGoal) {
  if (goal.targetAmount <= 0) return 0;

  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
}

export function calculateGoalFundingGap(goal: WealthGoal) {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

export function getGoalSummary(goals: WealthGoal[]) {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
  const priorityCount = goals.filter((goal) => goal.priority === "essential").length;

  return {
    priorityCount,
    totalCurrent,
    totalProgress,
    totalTarget,
  };
}

export function getGoalMonthlySplit(goals: WealthGoal[]) {
  return goals.map((goal) => ({
    monthly: calculateGoalMonthlyInvestment(goal),
    name: goal.name,
  }));
}

export function getGoalPlanningChecks({
  formatMoney,
  monthlyGoal,
  priorityCount,
  totalProgress,
}: {
  formatMoney: (value: number) => string;
  monthlyGoal: number;
  priorityCount: number;
  totalProgress: number;
}): GoalPlanningCheck[] {
  return [
    {
      label: "Monthly commitment",
      status: monthlyGoal > 100000 ? "Review assumptions" : "Looks workable",
      value: formatMoney(monthlyGoal),
    },
    {
      label: "Funded today",
      status: totalProgress < 10 ? "Early stage" : "Building momentum",
      value: `${totalProgress}%`,
    },
    {
      label: "Priority coverage",
      status: priorityCount ? "Essentials included" : "Add an essential goal",
      value: `${priorityCount}`,
    },
  ];
}
