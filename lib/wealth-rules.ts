export type ExperienceLevel = "new" | "some" | "confident";
export type IncomeStability = "variable" | "steady" | "very-steady";
export type LiquidityNeeds = "high" | "medium" | "low";
export type DecisionStyle = "hands-off" | "guided" | "active";
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
  dependents: number;
  incomeStability: IncomeStability;
  emergencyMonths: number;
  debtLevel: "none" | "manageable" | "heavy";
  horizonYears: number;
  liquidityNeeds: LiquidityNeeds;
  marketDropResponse: "sell" | "wait" | "buy";
  postLearningDropResponse: "sell" | "wait" | "buy";
  decisionStyle: DecisionStyle;
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
  potentialScore: number | null;
  potentialBand: "Conservative" | "Balanced" | "Growth" | null;
  intentGap:
    | "knowledge-gap"
    | "steady-caution"
    | "growing-conviction"
    | "aligned";
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
  actionBaskets: Array<{
    id: "understand" | "rehearse" | "activate";
    title: string;
    description: string;
    items: string[];
  }>;
  recommendations: string[];
  nextActions: string[];
};

export function calculateRiskProfile(answers: RiskAnswers): RiskProfile {
  const score = scoreRiskAnswers(answers);
  const band = scoreToBand(score);
  const intentGap = getIntentGap(answers);
  const potentialScore =
    intentGap === "knowledge-gap"
      ? scoreRiskAnswers({
          ...answers,
          marketDropResponse: answers.postLearningDropResponse,
        })
      : null;
  const potentialBand = potentialScore === null ? null : scoreToBand(potentialScore);

  const personality =
    answers.liquidityNeeds === "high" && band !== "Growth"
      ? "Liquidity-First Planner"
      : answers.decisionStyle === "hands-off" && band !== "Growth"
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
    answers.emergencyMonths < 3 ||
    answers.debtLevel === "heavy" ||
    answers.incomeStability === "variable"
      ? "Needs foundation"
      : intentGap === "knowledge-gap"
        ? "Getting ready"
        : answers.experience === "new" || answers.taxAwareness === "low"
          ? "Getting ready"
          : "Ready to act";

  const summary = buildSummary(answers, band, personality, potentialBand, intentGap);

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
    potentialScore,
    potentialBand,
    intentGap,
    personality,
    confidence,
    summary,
    allocation,
    roadmap: buildRoadmap(answers, band),
    actionBaskets: buildActionBaskets(
      answers,
      band,
      confidence,
      intentGap,
      potentialBand,
    ),
    recommendations: buildRecommendations(answers, band),
    nextActions: buildNextActions(answers, confidence),
  };
}

function scoreRiskAnswers(answers: RiskAnswers) {
  let score = 48;

  if (answers.age < 30) score += 10;
  if (answers.age > 50) score -= 8;
  if (answers.emergencyMonths >= 6) score += 10;
  if (answers.emergencyMonths < 3) score -= 14;
  if (answers.incomeStability === "variable") score -= 8;
  if (answers.incomeStability === "very-steady") score += 4;
  if (answers.debtLevel === "heavy") score -= 16;
  if (answers.debtLevel === "none") score += 6;
  if (answers.dependents >= 3) score -= 6;
  else if (answers.dependents > 0) score -= 2;
  if (answers.horizonYears >= 10) score += 12;
  if (answers.horizonYears < 3) score -= 12;
  if (answers.liquidityNeeds === "high") score -= 8;
  if (answers.liquidityNeeds === "low") score += 4;
  if (answers.marketDropResponse === "buy") score += 14;
  if (answers.marketDropResponse === "sell") score -= 18;
  if (
    answers.marketDropResponse === "sell" &&
    (answers.postLearningDropResponse === "wait" ||
      answers.postLearningDropResponse === "buy")
  ) {
    score += 7;
  }
  if (
    answers.marketDropResponse === "wait" &&
    answers.postLearningDropResponse === "buy"
  ) {
    score += 3;
  }
  if (
    answers.marketDropResponse === "sell" &&
    answers.postLearningDropResponse === "sell"
  ) {
    score -= 4;
  }
  if (answers.decisionStyle === "active" && answers.experience === "confident") score += 4;
  if (answers.decisionStyle === "hands-off" && answers.timeAvailable === "low") score -= 2;
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
  return score;
}

function scoreToBand(score: number): RiskProfile["band"] {
  return score < 42 ? "Conservative" : score < 68 ? "Balanced" : "Growth";
}

function responseToRiskLevel(response: RiskAnswers["marketDropResponse"]) {
  if (response === "sell") return 0;
  if (response === "wait") return 1;
  return 2;
}

function getIntentGap(answers: RiskAnswers): RiskProfile["intentGap"] {
  const current = responseToRiskLevel(answers.marketDropResponse);
  const future = responseToRiskLevel(answers.postLearningDropResponse);

  if (future > current) {
    return "knowledge-gap";
  }

  if (current === 0 && future === 0) {
    return "steady-caution";
  }

  if (current === 1 && future === 2) {
    return "growing-conviction";
  }

  return "aligned";
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
  potentialBand: RiskProfile["potentialBand"],
  intentGap: RiskProfile["intentGap"],
) {
  const countryPhrase = answers.country ? ` in ${answers.country}` : "";
  const goal = goalLabels[answers.primaryGoal] ?? "Long-term wealth";
  const dependentsPhrase =
    answers.dependents > 0 ? `, supporting ${answers.dependents} dependents,` : ",";
  const behaviorPhrase =
    intentGap === "knowledge-gap" && potentialBand
      ? ` Right now you would ${answers.marketDropResponse}, but after learning more you expect to ${answers.postLearningDropResponse}, which suggests your long-term fit may be closer to a ${potentialBand.toLowerCase()} profile once knowledge catches up.`
      : answers.marketDropResponse !== answers.postLearningDropResponse
        ? ` Right now you would ${answers.marketDropResponse}, and after learning more you expect to ${answers.postLearningDropResponse}.`
        : ` You expect your crash response to stay ${answers.marketDropResponse} even after learning more.`;

  return `You look like a ${personality.toLowerCase()}${countryPhrase}${dependentsPhrase} ${band.toLowerCase()} risk, focused on ${goal.toLowerCase()}, with ${answers.timeAvailable} weekly learning time and ${answers.incomeStability} income stability.${behaviorPhrase}`;
}

function buildActionBaskets(
  answers: RiskAnswers,
  band: RiskProfile["band"],
  confidence: RiskProfile["confidence"],
  intentGap: RiskProfile["intentGap"],
  potentialBand: RiskProfile["potentialBand"],
): RiskProfile["actionBaskets"] {
  const understand = [
    `Learn why a ${band.toLowerCase()} allocation fits your present cash-flow and goal profile.`,
    "Understand the difference between SIPs, index funds, debt funds, and emergency cash.",
    "Review how market falls affect diversified portfolios before changing your plan in a panic.",
  ];

  const rehearse = [
    "Create a one-page investing rulebook for what to do during market rises, falls, and salary changes.",
    "Practice monthly tracking with one goal, one SIP, and one review checkpoint.",
    "Rehearse rebalancing decisions on paper before doing them with real money.",
  ];

  const activate = [
    "Set up your core monthly investing rule and automate the first contribution.",
    "Map one real goal to a target amount and target date.",
    "Review your allocation once a quarter instead of reacting to daily price moves.",
  ];

  if (answers.emergencyMonths < 6) {
    understand.unshift("Learn the order of operations: cash buffer first, then higher-risk investing.");
    activate.unshift("Redirect part of monthly investing into emergency reserves until you reach a safer runway.");
  }

  if (answers.debtLevel === "heavy") {
    rehearse.unshift("Practice ranking debts by interest rate and required payment before increasing equity exposure.");
    activate.unshift("Attack high-interest debt before adding aggressive market risk.");
  }

  if (answers.decisionStyle === "hands-off") {
    rehearse.push("Test a simple two-fund or three-fund setup so investing stays easy to maintain.");
    activate.push("Prefer automated SIPs and broad diversified funds over research-heavy ideas.");
  }

  if (answers.taxAwareness === "low") {
    understand.push("Learn the tax basics for your main account types before choosing complex products.");
  }

  if (answers.dependents > 0) {
    activate.push("Review family protection, insurance cover, and goal buffers before stretching risk.");
  }

  if (intentGap === "knowledge-gap" && potentialBand) {
    understand.unshift(
      `Your current caution looks more like missing reps than true low-risk intent; learn what a ${potentialBand.toLowerCase()} investor is actually expected to tolerate.`,
    );
    rehearse.unshift(
      "Run a small test allocation for 2-3 months so you can feel volatility with limited emotional and money risk.",
    );
    activate.unshift(
      "Start with a starter-sized SIP now, then scale toward your potential risk profile after a few calm review cycles.",
    );
  }

  if (confidence === "Needs foundation") {
    activate.unshift("Keep your first moves simple: cash buffer, debt cleanup, and one starter investing habit.");
  }

  if (answers.primaryGoal === "retirement") {
    understand.push("Learn how retirement investing differs from short-term goal saving.");
    activate.push("Estimate a retirement corpus range before increasing monthly contributions.");
  }

  return [
    {
      id: "understand",
      title: "Understand the Plan",
      description: "Build clarity before you ask money decisions to carry emotional weight.",
      items: understand,
    },
    {
      id: "rehearse",
      title: "Build Investing Reps",
      description: "Practice the behavior, not just the theory, so your future decisions get steadier.",
      items: rehearse,
    },
    {
      id: "activate",
      title: "Put Money to Work",
      description: "Take the next real actions that fit your current readiness and cash reality.",
      items: activate,
    },
  ];
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

  if (answers.incomeStability === "variable") {
    recs.unshift("Keep a larger cash buffer because your income can vary month to month.");
  }

  if (answers.debtLevel === "heavy") {
    recs.unshift("Prioritize high-interest debt before aggressive investing.");
  }

  if (answers.liquidityNeeds === "high") {
    recs.push("Favor liquid, easy-to-access instruments until near-term cash needs settle.");
  }

  if (
    answers.marketDropResponse === "sell" &&
    answers.postLearningDropResponse !== "sell"
  ) {
    recs.push("Your answers suggest today’s caution may be partly a knowledge gap, so education and a written crash plan can matter more than forcing higher risk too early.");
  }

  if (
    answers.marketDropResponse === "sell" &&
    answers.postLearningDropResponse === "sell"
  ) {
    recs.push("Even after learning more, you still prefer capital stability, so your plan should respect lower risk intent rather than push aggressive equity exposure.");
  }

  if (answers.dependents > 0) {
    recs.push("Protect dependents with stronger emergency, insurance, and goal buffers before taking extra risk.");
  }

  if (answers.decisionStyle === "hands-off") {
    recs.push("Lean on automated SIPs and simpler diversified funds instead of research-heavy portfolios.");
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

  if (answers.dependents > 0) {
    actions.unshift("Review protection and emergency coverage for family obligations");
  }

  if (answers.incomeStability === "variable") {
    actions.unshift("Separate stable monthly investing from irregular surplus cash");
  }

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
