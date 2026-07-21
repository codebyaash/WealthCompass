import type {
  PortfolioAsset,
  PortfolioTransaction,
  WealthGoal,
} from "./local-storage";
import { formatMoney } from "./formatters";
import type { RiskProfile } from "./wealth-rules";

export type DashboardView = "academy" | "goals" | "onboarding" | "portfolio";

export type DashboardAction = {
  badge: string;
  cta: string;
  detail: string;
  reason: string;
  trackStep: string;
  trackTitle: string;
  title: string;
  view: DashboardView;
};

export type GoalPortfolioInsight = {
  detail: string;
  title: string;
};

export type PortfolioTrajectoryPoint = {
  month: string;
  value: number;
};

function getBasket(profile: RiskProfile, id: "understand" | "rehearse" | "activate") {
  return profile.actionBaskets.find((basket) => basket.id === id) ?? profile.actionBaskets[0];
}

export function getDashboardAction({
  assets,
  formatMoney,
  goalProgress,
  goals,
  healthScore,
  monthlyGoal,
  profile,
}: {
  assets: PortfolioAsset[];
  formatMoney: (value: number) => string;
  goalProgress: number;
  goals: WealthGoal[];
  healthScore: number;
  monthlyGoal: number;
  profile: RiskProfile;
}): DashboardAction {
  const foundationBasket = getBasket(profile, "activate");
  const planningBasket = getBasket(profile, "understand");
  const trackingBasket = getBasket(profile, "rehearse");
  const learningBasket = getBasket(profile, "understand");

  if (profile.confidence === "Needs foundation") {
    return {
      badge: "Foundation",
      cta: "Review Profile",
      detail: "Emergency savings or debt risk is still limiting how much market risk makes sense.",
      reason: "Risk capacity comes before product selection.",
      trackStep:
        foundationBasket?.items[0] ??
        "Strengthen your cash buffer before taking more market risk.",
      trackTitle: foundationBasket?.title ?? "Put Money to Work",
      title: "Strengthen your foundation first",
      view: "onboarding",
    };
  }

  if (goals.length === 0 || goalProgress < 10) {
    return {
      badge: "Planning",
      cta: "Plan Goals",
      detail: `Your current goal plan needs more funding clarity. The combined monthly target is ${formatMoney(monthlyGoal)}.`,
      reason: "Goals make portfolio decisions easier to evaluate.",
      trackStep:
        planningBasket?.items[0] ?? "Map one real goal to a target amount and target date.",
      trackTitle: planningBasket?.title ?? "Understand the Plan",
      title: "Define the next funding milestone",
      view: "goals",
    };
  }

  if (assets.length < 4 || healthScore < 70) {
    return {
      badge: "Tracking",
      cta: "Review Portfolio",
      detail: "Add or refine holdings so allocation and concentration checks become more useful.",
      reason: "Better tracking creates better recommendations.",
      trackStep:
        trackingBasket?.items[0] ??
        "Practice monthly tracking with one goal, one SIP, and one review checkpoint.",
      trackTitle: trackingBasket?.title ?? "Build Investing Reps",
      title: "Improve portfolio visibility",
      view: "portfolio",
    };
  }

  return {
    badge: "Learning",
    cta: "Open Academy",
    detail: "Your foundation is in good shape. Keep building product knowledge before adding complexity.",
    reason: "The next edge is consistency and understanding.",
    trackStep:
      learningBasket?.items[0] ??
      "Learn why your current allocation fits your present cash-flow and goal profile.",
    trackTitle: learningBasket?.title ?? "Understand the Plan",
    title: "Continue the learning roadmap",
    view: "academy",
  };
}

export function getGoalPortfolioInsight({
  goals,
  monthlyGoal,
  portfolioTotal,
}: {
  goals: WealthGoal[];
  monthlyGoal: number;
  portfolioTotal: number;
}) {
  if (goals.length === 0) {
    return {
      detail: "Create a goal so your current portfolio has a destination, not just a balance.",
      title: "No active destination yet",
    } satisfies GoalPortfolioInsight;
  }

  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const coverage = totalTarget > 0 ? Math.round((portfolioTotal / totalTarget) * 100) : 0;

  if (coverage < 25) {
    return {
      detail: `Your portfolio covers about ${coverage}% of active goal targets. Keep contributions aligned with the ${formatMoney(monthlyGoal)} monthly plan.`,
      title: "Funding gap is still the main story",
    } satisfies GoalPortfolioInsight;
  }

  if (coverage < 60) {
    return {
      detail: `Your portfolio now covers about ${coverage}% of goal targets. This is a good stage to protect emergency and short-term buckets.`,
      title: "Progress is visible, sequencing matters",
    } satisfies GoalPortfolioInsight;
  }

  return {
    detail: `Your portfolio covers about ${coverage}% of current goal targets. Start checking whether concentration and timing still match each goal.`,
    title: "Portfolio and goals are starting to converge",
  } satisfies GoalPortfolioInsight;
}

export function buildPortfolioTrajectory({
  transactions,
  windowMonths = 6,
}: {
  transactions: PortfolioTransaction[];
  windowMonths?: number;
}) {
  if (!transactions.length || windowMonths <= 0) {
    return [] satisfies PortfolioTrajectoryPoint[];
  }

  const datedTransactions = transactions
    .map((transaction) => ({
      ...transaction,
      parsedDate: new Date(transaction.date),
    }))
    .filter((transaction) => !Number.isNaN(transaction.parsedDate.getTime()))
    .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime());

  if (!datedTransactions.length) {
    return [] satisfies PortfolioTrajectoryPoint[];
  }

  const endMonth = new Date(datedTransactions[datedTransactions.length - 1].parsedDate);
  endMonth.setDate(1);
  endMonth.setHours(0, 0, 0, 0);

  const startMonth = new Date(endMonth);
  startMonth.setMonth(startMonth.getMonth() - (windowMonths - 1));

  let runningValue = 0;
  let cursor = 0;
  const points: PortfolioTrajectoryPoint[] = [];

  while (
    cursor < datedTransactions.length &&
    datedTransactions[cursor].parsedDate < startMonth
  ) {
    runningValue += getSignedTransactionAmount(datedTransactions[cursor]);
    cursor += 1;
  }

  for (let offset = 0; offset < windowMonths; offset += 1) {
    const monthStart = new Date(startMonth);
    monthStart.setMonth(startMonth.getMonth() + offset);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(monthStart.getMonth() + 1);

    while (
      cursor < datedTransactions.length &&
      datedTransactions[cursor].parsedDate >= monthStart &&
      datedTransactions[cursor].parsedDate < nextMonthStart
    ) {
      runningValue += getSignedTransactionAmount(datedTransactions[cursor]);
      cursor += 1;
    }

    points.push({
      month: monthStart.toLocaleString("en-US", { month: "short" }),
      value: Math.max(Math.round(runningValue), 0),
    });
  }

  return points;
}

function getSignedTransactionAmount(transaction: PortfolioTransaction) {
  const baseAmount =
    transaction.amount > 0 ? transaction.amount : transaction.quantity * transaction.price;

  if (transaction.action === "sell") return -Math.abs(baseAmount);

  return Math.abs(baseAmount);
}
