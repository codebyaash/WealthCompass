import type { WealthGoal } from "./local-storage";
import { calculateGoalMonthlyInvestment } from "./wealth-rules";

export type GoalPlanningCheck = {
  label: string;
  status: string;
  value: string;
};

export type GoalScenario = {
  annualReturn: number;
  label: string;
  monthly: number;
};

export type GoalMilestone = {
  label: string;
  monthlyNeeded: number;
  targetAmount: number;
  timeToMilestoneLabel: string;
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

export function getGoalScenarioRows(goal: WealthGoal): GoalScenario[] {
  const scenarios = [
    {
      annualReturn: Math.max(0, goal.annualReturn - 3),
      label: "Conservative",
    },
    {
      annualReturn: goal.annualReturn,
      label: "Base case",
    },
    {
      annualReturn: Math.min(20, goal.annualReturn + 3),
      label: "Stretch",
    },
  ];

  return scenarios.map((scenario) => ({
    ...scenario,
    monthly: calculateGoalMonthlyInvestment({
      ...goal,
      annualReturn: scenario.annualReturn,
    }),
  }));
}

export function getGoalMilestones(goal: WealthGoal): GoalMilestone[] {
  const monthlyContribution = calculateGoalMonthlyInvestment(goal);
  const milestones = [25, 50, 75, 100];

  return milestones.map((percent) => {
    const targetAmount = Number(((goal.targetAmount * percent) / 100).toFixed(0));

    return {
      label: `${percent}% funded`,
      monthlyNeeded: calculateGoalMonthlyInvestment({
        ...goal,
        targetAmount,
      }),
      targetAmount,
      timeToMilestoneLabel: getTimeToTargetLabel({
        annualReturn: goal.annualReturn,
        currentAmount: goal.currentAmount,
        monthlyContribution,
        targetAmount,
      }),
    };
  });
}

export function getGoalPlanningChecks({
  formatMoney,
  goals,
  monthlyGoal,
  priorityCount,
  totalProgress,
}: {
  formatMoney: (value: number) => string;
  goals: WealthGoal[];
  monthlyGoal: number;
  priorityCount: number;
  totalProgress: number;
}): GoalPlanningCheck[] {
  const shortestHorizon = goals.length
    ? Math.min(...goals.map((goal) => goal.years))
    : 0;
  const overExtendedGoals = goals.filter(
    (goal) => calculateGoalMonthlyInvestment(goal) > Math.max(goal.currentAmount * 0.2, 25000),
  ).length;

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
    {
      label: "Nearest deadline",
      status:
        shortestHorizon > 0 && shortestHorizon <= 2
          ? "Time-sensitive"
          : "Room to compound",
      value: shortestHorizon > 0 ? `${shortestHorizon}y` : "--",
    },
    {
      label: "Stretch pressure",
      status: overExtendedGoals > 0 ? "Some goals need a reset" : "Targets look realistic",
      value: `${overExtendedGoals}`,
    },
  ];
}

function getTimeToTargetLabel({
  annualReturn,
  currentAmount,
  monthlyContribution,
  targetAmount,
}: {
  annualReturn: number;
  currentAmount: number;
  monthlyContribution: number;
  targetAmount: number;
}) {
  if (targetAmount <= currentAmount) return "Already there";
  if (monthlyContribution <= 0) return "Needs funding";

  const months = findMonthsToTarget({
    annualReturn,
    currentAmount,
    monthlyContribution,
    targetAmount,
  });

  if (months === null) return "Beyond current plan";
  if (months < 12) return `${months} mo`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths === 0) return `${years} yr`;

  return `${years} yr ${remainingMonths} mo`;
}

function findMonthsToTarget({
  annualReturn,
  currentAmount,
  monthlyContribution,
  targetAmount,
}: {
  annualReturn: number;
  currentAmount: number;
  monthlyContribution: number;
  targetAmount: number;
}) {
  let balance = currentAmount;
  const monthlyRate = annualReturn > 0 ? annualReturn / 100 / 12 : 0;

  for (let month = 1; month <= 600; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;

    if (balance >= targetAmount) {
      return month;
    }
  }

  return null;
}
