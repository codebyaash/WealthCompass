export type ExperienceLevel = "new" | "some" | "confident";
export type PrimaryGoal =
  | "emergency"
  | "home"
  | "retirement"
  | "wealth"
  | "education"
  | "travel";

export type RiskAnswers = {
  age: number;
  country: string;
  annualIncome: number;
  emergencyMonths: number;
  debtLevel: "none" | "manageable" | "heavy";
  horizonYears: number;
  marketDropResponse: "sell" | "wait" | "buy";
  experience: ExperienceLevel;
  primaryGoal: PrimaryGoal;
  timeAvailable: "low" | "medium" | "high";
  taxAwareness: "low" | "medium" | "high";
  monthlyInvestment: number;
  monthlySavings: number;
};

export type RiskProfile = {
  score: number;
  band: "Conservative" | "Balanced" | "Growth";
  personality: string;
  confidence: "Needs foundation" | "Getting ready" | "Ready to act";
  summary: string;
  allocation: Array<{ name: string; value: number }>;
  roadmap: Array<{
    week: string;
    topic: string;
    outcome: string;
    format: "Lesson" | "Checklist" | "Practice";
  }>;
  recommendations: string[];
  nextActions: string[];
};

export function calculateRiskProfile(answers: RiskAnswers): RiskProfile {
  let score = 48;

  if (answers.age < 30) score += 10;
  if (answers.age > 50) score -= 8;
  if (answers.emergencyMonths >= 6) score += 10;
  if (answers.emergencyMonths < 3) score -= 14;
  if (answers.debtLevel === "heavy") score -= 16;
  if (answers.debtLevel === "none") score += 6;
  if (answers.horizonYears >= 10) score += 12;
  if (answers.horizonYears < 3) score -= 12;
  if (answers.marketDropResponse === "buy") score += 14;
  if (answers.marketDropResponse === "sell") score -= 18;
  if (answers.experience === "confident") score += 8;
  if (answers.experience === "new") score -= 4;
  if (answers.timeAvailable === "high") score += 4;
  if (answers.timeAvailable === "low") score -= 3;
  if (answers.primaryGoal === "emergency") score -= 10;
  if (answers.primaryGoal === "retirement" || answers.primaryGoal === "wealth") {
    score += 6;
  }
  if (answers.monthlySavings > 0) {
    const investingRate = answers.monthlyInvestment / answers.monthlySavings;
    if (investingRate >= 0.5) score += 6;
    if (investingRate < 0.2) score -= 4;
  }

  score = Math.max(5, Math.min(95, Math.round(score)));

  const band =
    score < 42 ? "Conservative" : score < 68 ? "Balanced" : "Growth";

  const personality =
    answers.timeAvailable === "low" && band !== "Growth"
      ? "Passive ETF Investor"
      : answers.primaryGoal === "emergency"
        ? "Foundation Builder"
        : band === "Conservative"
          ? "Stability Builder"
          : band === "Balanced"
            ? "Steady Explorer"
            : answers.experience === "confident"
              ? "Growth Allocator"
              : "Long-term Growth Investor";

  const confidence =
    answers.emergencyMonths < 3 || answers.debtLevel === "heavy"
      ? "Needs foundation"
      : answers.experience === "new" || answers.taxAwareness === "low"
        ? "Getting ready"
        : "Ready to act";

  const summary = buildSummary(answers, band, personality);

  const allocation =
    band === "Conservative"
      ? [
          { name: "Cash", value: 25 },
          { name: "Debt", value: 45 },
          { name: "Index Funds", value: 20 },
          { name: "Gold", value: 10 },
        ]
      : band === "Balanced"
        ? [
            { name: "Cash", value: 12 },
            { name: "Debt", value: 28 },
            { name: "Index Funds", value: 45 },
            { name: "Gold", value: 10 },
            { name: "Stocks", value: 5 },
          ]
        : [
            { name: "Cash", value: 8 },
            { name: "Debt", value: 17 },
            { name: "Index Funds", value: 50 },
            { name: "Stocks", value: 20 },
            { name: "Gold", value: 5 },
          ];

  return {
    score,
    band,
    personality,
    confidence,
    summary,
    allocation,
    roadmap: buildRoadmap(answers, band),
    recommendations: buildRecommendations(answers, band),
    nextActions: buildNextActions(answers, confidence),
  };
}

function buildRoadmap(answers: RiskAnswers, band: RiskProfile["band"]) {
  const firstTopic =
    answers.experience === "new" ? "Emergency fund basics" : "Portfolio audit";
  const goalTopic =
    answers.primaryGoal === "home"
      ? "Down payment planning"
      : answers.primaryGoal === "retirement"
        ? "Retirement buckets"
        : answers.primaryGoal === "education"
          ? "Education goal planning"
          : "Goal-based investing";

  return [
    {
      week: "Week 1",
      topic: firstTopic,
      outcome: "Know what must be protected before investing.",
      format: "Checklist" as const,
    },
    {
      week: "Week 2",
      topic: "Mutual funds, index funds, and ETFs",
      outcome: "Understand low-cost diversification.",
      format: "Lesson" as const,
    },
    {
      week: "Week 3",
      topic: band === "Growth" ? "Stocks without stock picking" : "Debt and bonds",
      outcome: "Match investment types to your risk profile.",
      format: "Lesson" as const,
    },
    {
      week: "Week 4",
      topic: goalTopic,
      outcome: "Convert life goals into monthly investing targets.",
      format: "Practice" as const,
    },
    {
      week: "Week 5",
      topic: "Taxes and account hygiene",
      outcome: "Learn what to track before tax season surprises you.",
      format: "Checklist" as const,
    },
    {
      week: "Week 6",
      topic: "Rebalancing",
      outcome: "Know when to adjust without reacting emotionally.",
      format: "Practice" as const,
    },
  ];
}

function buildSummary(
  answers: RiskAnswers,
  band: RiskProfile["band"],
  personality: string,
) {
  const countryPhrase = answers.country ? ` in ${answers.country}` : "";
  const goal = goalLabels[answers.primaryGoal] ?? "Long-term wealth";

  return `You look like a ${personality.toLowerCase()}${countryPhrase}: ${band.toLowerCase()} risk, focused on ${goal.toLowerCase()}, with ${answers.timeAvailable} weekly learning time.`;
}

function buildRecommendations(
  answers: RiskAnswers,
  band: RiskProfile["band"],
) {
  const recs = [
    `Start with a ${band.toLowerCase()} allocation and review it every quarter.`,
    "Use manual tracking first; connect broker data after the habit is clear.",
  ];

  if (answers.emergencyMonths < 6) {
    recs.unshift("Build a 6-month emergency fund before increasing market risk.");
  }

  if (answers.debtLevel === "heavy") {
    recs.unshift("Prioritize high-interest debt before aggressive investing.");
  }

  if (answers.taxAwareness === "low") {
    recs.push("Add tax basics to your learning path before choosing complex products.");
  }

  if (answers.timeAvailable === "low") {
    recs.push("Favor simple recurring investments over research-heavy strategies.");
  }

  return recs;
}

function buildNextActions(
  answers: RiskAnswers,
  confidence: RiskProfile["confidence"],
) {
  if (confidence === "Needs foundation") {
    return [
      "Finish emergency fund and debt checklist",
      "Track expenses for one month",
      "Start with learning modules before adding risky assets",
    ];
  }

  const actions = [
    "Create one goal with target amount and date",
    "Add current holdings manually",
    "Set a monthly investing rule",
  ];

  if (answers.primaryGoal === "retirement") {
    actions.push("Estimate retirement corpus with conservative assumptions");
  }

  return actions;
}

export const goalLabels: Record<PrimaryGoal, string> = {
  emergency: "Emergency fund",
  home: "Home down payment",
  retirement: "Retirement",
  wealth: "Long-term wealth",
  education: "Education",
  travel: "Travel",
};

export function calculateGoalMonthlyInvestment({
  currentAmount,
  targetAmount,
  years,
  annualReturn,
}: {
  currentAmount: number;
  targetAmount: number;
  years: number;
  annualReturn: number;
}) {
  const months = Math.max(1, years * 12);
  const monthlyRate = annualReturn / 100 / 12;
  const futureCurrent = currentAmount * (1 + monthlyRate) ** months;
  const gap = Math.max(0, targetAmount - futureCurrent);

  if (monthlyRate === 0) return Math.round(gap / months);

  return Math.round(
    gap / (((1 + monthlyRate) ** months - 1) / monthlyRate),
  );
}
