import type { PortfolioAsset } from "./local-storage";
import {
  calculateLargestHoldingConcentration,
  calculatePortfolioInvestedValue,
} from "./portfolio-rules";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";
import { goalLabels } from "./wealth-rules";

export const mentorQuestions = [
  {
    id: "first-investment",
    label: "What should I start with?",
    title: "First investment plan",
  },
  {
    id: "etf",
    label: "What is an ETF?",
    title: "ETF basics",
  },
  {
    id: "sip",
    label: "What is SIP?",
    title: "SIP discipline",
  },
  {
    id: "emergency",
    label: "Emergency fund first?",
    title: "Emergency fund",
  },
  {
    id: "crash",
    label: "What if markets crash?",
    title: "Market crash plan",
  },
  {
    id: "gold",
    label: "Should I buy gold?",
    title: "Gold allocation",
  },
  {
    id: "allocation",
    label: "Is my allocation sensible?",
    title: "Allocation check",
  },
  {
    id: "debt",
    label: "Invest or clear debt first?",
    title: "Debt versus investing",
  },
  {
    id: "tax",
    label: "What should I track for taxes?",
    title: "Tax hygiene",
  },
  {
    id: "risk",
    label: "Why this risk score?",
    title: "Your risk profile",
  },
] as const;

export type MentorQuestionId = (typeof mentorQuestions)[number]["id"];

export type MentorAnswer = {
  actionTrack: {
    description: string;
    nextMove: string;
    title: string;
  };
  checkpoints: Array<{ label: string; value: string }>;
  explanation: string;
  focusLabel: string;
  followUps: MentorQuestionId[];
  personalNote: string;
  steps: string[];
  summary: string;
};

function getMentorTrack(
  profile: RiskProfile,
  id: "understand" | "rehearse" | "activate",
) {
  const basket = profile.actionBaskets.find((item) => item.id === id) ?? profile.actionBaskets[0];

  return {
    description:
      basket?.description ?? "Use the next coaching track to keep your decisions calmer and clearer.",
    nextMove: basket?.items[0] ?? "Keep the next move simple and repeatable.",
    title: basket?.title ?? "Understand the Plan",
  };
}

export function getMentorAnswer({
  answers,
  assets = [],
  formatMoney,
  profile,
  questionId,
}: {
  answers: RiskAnswers;
  assets?: PortfolioAsset[];
  formatMoney: (value: number) => string;
  profile: RiskProfile;
  questionId: MentorQuestionId;
}): MentorAnswer {
  const goal = goalLabels[answers.primaryGoal].toLowerCase();
  const emergencyReady = answers.emergencyMonths >= 6;
  const portfolioTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
  const investedValue = calculatePortfolioInvestedValue(assets);
  const concentration = calculateLargestHoldingConcentration({
    assets,
    portfolioTotal,
  });
  const gainPercent =
    investedValue > 0 ? Math.round(((portfolioTotal - investedValue) / investedValue) * 100) : 0;
  const savingsCoverage =
    answers.monthlySavings > 0
      ? Math.round((answers.monthlyInvestment / answers.monthlySavings) * 100)
      : 0;
  const understandTrack = getMentorTrack(profile, "understand");
  const rehearseTrack = getMentorTrack(profile, "rehearse");
  const activateTrack = getMentorTrack(profile, "activate");

  const answersById: Record<MentorQuestionId, MentorAnswer> = {
    allocation: {
      actionTrack: rehearseTrack,
      checkpoints: [
        { label: "Tracked value", value: formatMoney(portfolioTotal) },
        { label: "Largest holding", value: `${concentration}%` },
        { label: "Profile band", value: profile.band },
      ],
      explanation:
        "A sensible allocation is one you can stick with through boring months and bad months. The goal is not to own everything. The goal is to match cash needs, timeline, and risk capacity without letting one bet dominate the story.",
      focusLabel: concentration >= 45 ? "Concentration risk" : "Allocation fit",
      followUps: concentration >= 45 ? ["etf", "crash", "risk"] : ["risk", "gold", "tax"],
      personalNote:
        portfolioTotal <= 0
          ? "You have not added holdings yet, so the right next move is to decide your starter mix before you pick products."
          : concentration >= 45
            ? `One holding is about ${concentration}% of the portfolio. That is enough to make one product drive too much of your emotional experience.`
            : `Your current concentration is about ${concentration}%, which is manageable, but it is still worth checking whether each holding has a clear role.`,
      steps: [
        "Separate emergency money, short-term money, and long-term money first.",
        "Let broad index exposure carry most of the long-term portfolio unless you have a reason to do otherwise.",
        "Review whether any single holding has become too large for its job.",
      ],
      summary: "Allocation should reduce regret, not just chase return.",
    },
    crash: {
      actionTrack:
        profile.intentGap === "knowledge-gap" ? rehearseTrack : understandTrack,
      checkpoints: [
        { label: "Largest holding", value: `${concentration}%` },
        { label: "Emergency fund", value: `${answers.emergencyMonths} months` },
        {
          label: "Crash response",
          value:
            answers.marketDropResponse === answers.postLearningDropResponse
              ? answers.marketDropResponse
              : `${answers.marketDropResponse} -> ${answers.postLearningDropResponse}`,
        },
      ],
      explanation:
        "A market crash is a temporary fall in prices, not automatically a reason to sell. The right response depends on your goal timeline, emergency fund, debt, and risk capacity.",
      focusLabel: "Behavior plan",
      followUps: concentration >= 45 ? ["allocation", "etf", "emergency"] : ["risk", "emergency", "sip"],
      personalNote:
        concentration >= 45
          ? `One holding is about ${concentration}% of your tracked portfolio, so a crash would feel bigger than the headline. Reduce concentration before taking more risk.`
          : profile.band === "Growth"
            ? "Your profile can handle more volatility, but only if your goal timeline remains long and your emergency fund is separate."
            : "Your profile benefits from slower decisions during crashes. Protect cash needs first, then rebalance only if your plan says so.",
      steps: [
        "Do not sell just because prices fell.",
        "Check whether your goal timeline changed.",
        "Rebalance gradually instead of making one emotional trade.",
      ],
      summary: "Crashes test behavior more than knowledge.",
    },
    emergency: {
      actionTrack: activateTrack,
      checkpoints: [
        { label: "Current buffer", value: `${answers.emergencyMonths} months` },
        { label: "Debt level", value: answers.debtLevel },
        { label: "Primary goal", value: goalLabels[answers.primaryGoal] },
      ],
      explanation:
        "An emergency fund is money kept for job loss, medical needs, family support, or urgent repairs. It should be boring, accessible, and separate from investments.",
      focusLabel: emergencyReady ? "Foundation in place" : "Foundation gap",
      followUps: emergencyReady ? ["sip", "first-investment", "risk"] : ["debt", "risk", "sip"],
      personalNote: emergencyReady
        ? "You already have a stronger base than many beginners, so your plan can focus more on consistent investing."
        : `You currently have ${answers.emergencyMonths} months saved. Build toward 6 months before increasing risk for ${goal}.`,
      steps: [
        "Keep it in cash-like or low-risk instruments.",
        "Do not count stocks, gold, or crypto as emergency money.",
        "Review the target whenever expenses change.",
      ],
      summary: "Emergency money protects your investment plan from forced selling.",
    },
    etf: {
      actionTrack: understandTrack,
      checkpoints: [
        { label: "Experience", value: answers.experience },
        { label: "Time available", value: answers.timeAvailable },
        { label: "Largest holding", value: `${concentration}%` },
      ],
      explanation:
        "An ETF is a basket of securities that trades like a stock. Many ETFs track an index, so one purchase can give exposure to many companies.",
      focusLabel: "Product understanding",
      followUps: ["allocation", "first-investment", "risk"],
      personalNote:
        answers.experience === "new"
          ? "Since you marked yourself as new, mutual funds may be easier first. ETFs are useful once order placement feels comfortable."
          : concentration >= 45
            ? "Your holdings look concentrated, which makes broad-market ETFs especially worth comparing for diversification."
            : "Your experience level makes ETFs worth comparing, especially for low-cost index exposure.",
      steps: [
        "Use ETFs for diversified exposure, not quick excitement.",
        "Check liquidity and tracking difference.",
        "Avoid placing orders without understanding market price versus NAV.",
      ],
      summary: "ETFs can be simple, but buying them still requires market-order awareness.",
    },
    "first-investment": {
      actionTrack: activateTrack,
      checkpoints: [
        { label: "Monthly savings", value: formatMoney(answers.monthlySavings) },
        { label: "Monthly investing", value: formatMoney(answers.monthlyInvestment) },
        { label: "Confidence", value: profile.confidence },
      ],
      explanation:
        "Your first investment should be easy to repeat, easy to explain, and hard to panic-sell. For most beginners, that means starting with a simple goal, a modest monthly rule, and broad diversification instead of trying to be clever.",
      focusLabel: "Starter plan",
      followUps: ["sip", "emergency", "risk"],
      personalNote:
        profile.confidence === "Needs foundation"
          ? "Your first move is not really a product choice yet. It is making sure cash cushion and debt pressure do not sabotage the investing habit."
          : answers.experience === "new"
            ? "You do not need a complicated first portfolio. A repeatable broad-market plan is already a strong start."
            : "You likely have enough context to start simply and then refine once your tracking habit is stable.",
      steps: [
        "Choose one goal and one monthly amount you can maintain for a year.",
        "Start with broad exposure instead of multiple overlapping ideas.",
        "Record each contribution so future decisions come from evidence, not memory.",
      ],
      summary: "The best first investment is the one that creates a lasting habit.",
    },
    gold: {
      actionTrack: understandTrack,
      checkpoints: [
        { label: "Profile band", value: profile.band },
        { label: "Current gain", value: `${gainPercent}%` },
        { label: "Goal focus", value: goalLabels[answers.primaryGoal] },
      ],
      explanation:
        "Gold can diversify a portfolio because it may behave differently from stocks and bonds. It does not produce business earnings, so it is usually a stabilizer, not the main growth engine.",
      focusLabel: "Diversifier",
      followUps: ["allocation", "risk", "crash"],
      personalNote:
        profile.band === "Conservative"
          ? "A small gold allocation can fit your stability preference, but emergency reserves still come first."
          : "For your profile, gold is better treated as a small diversifier while growth assets do the long-term heavy lifting.",
      steps: [
        "Keep gold allocation modest.",
        "Prefer transparent formats over emotional purchases.",
        "Do not use gold as a replacement for cash reserves.",
      ],
      summary: "Gold is a diversifier, not a complete plan.",
    },
    debt: {
      actionTrack: activateTrack,
      checkpoints: [
        { label: "Debt level", value: answers.debtLevel },
        { label: "Emergency fund", value: `${answers.emergencyMonths} months` },
        { label: "Monthly investing", value: formatMoney(answers.monthlyInvestment) },
      ],
      explanation:
        "Debt and investing are not enemies, but expensive or stressful debt reduces your real risk capacity. If debt pressure is high, the cleanest return may come from lowering that burden before reaching for more market exposure.",
      focusLabel: answers.debtLevel === "heavy" ? "Debt first" : "Balance both",
      followUps: ["emergency", "risk", "first-investment"],
      personalNote:
        answers.debtLevel === "heavy"
          ? "Your own inputs say debt is heavy, so the plan should protect cash flow before it tries to maximize returns."
          : answers.debtLevel === "none"
            ? "No debt pressure gives you much more freedom to invest consistently."
            : "Manageable debt usually means you can do both, but only if the repayment plan stays explicit.",
      steps: [
        "List high-interest debt separately from low-cost structured debt.",
        "Protect minimum emergency liquidity before making aggressive prepayments.",
        "Choose one explicit split between repayment and investing instead of deciding ad hoc each month.",
      ],
      summary: "Debt changes how much market volatility you can honestly carry.",
    },
    risk: {
      actionTrack:
        profile.intentGap === "knowledge-gap" ? understandTrack : rehearseTrack,
      checkpoints: [
        { label: "Risk score", value: `${profile.score}/100` },
        { label: "Confidence", value: profile.confidence },
        { label: "Tracked value", value: formatMoney(portfolioTotal) },
      ],
      explanation:
        "Your score combines age, emergency fund, debt, goal horizon, crash response, experience, learning time, and investing rate. It is a planning signal, not a permanent label.",
      focusLabel: "Planning signal",
      followUps: ["allocation", "emergency", "crash"],
      personalNote: `Your current result is ${profile.score}/100: ${profile.band}, ${profile.personality}. ${
        portfolioTotal > 0
          ? `Your tracked portfolio is ${formatMoney(portfolioTotal)} with roughly ${gainPercent}% overall gain. `
          : ""
      }The biggest practical next step is: ${rehearseTrack.nextMove.toLowerCase()}.`,
      steps: [
        "Improve foundation before increasing risk.",
        "Match risk to goal timeline.",
        "Recalculate after big life changes.",
      ],
      summary: "Risk capacity is personal and changes with your life.",
    },
    sip: {
      actionTrack: activateTrack,
      checkpoints: [
        { label: "Monthly SIP base", value: formatMoney(answers.monthlyInvestment) },
        { label: "Savings coverage", value: `${savingsCoverage}%` },
        { label: "Primary goal", value: goalLabels[answers.primaryGoal] },
      ],
      explanation:
        "A SIP is a recurring investment habit. It helps you invest through different market conditions instead of trying to guess the perfect day.",
      focusLabel: "Consistency system",
      followUps: ["first-investment", "risk", "tax"],
      personalNote:
        answers.monthlyInvestment > 0
          ? `Your current monthly investment input is ${formatMoney(answers.monthlyInvestment)}, which can become the anchor for your plan${
              portfolioTotal > 0 ? ` alongside your existing ${formatMoney(portfolioTotal)} portfolio` : ""
            }.`
          : "Start with a small amount you can sustain, then increase it as savings become predictable.",
      steps: [
        "Choose the goal first.",
        "Automate a monthly amount.",
        "Increase contributions when income rises.",
      ],
      summary: "SIP is more about discipline than market timing.",
    },
    tax: {
      actionTrack: understandTrack,
      checkpoints: [
        { label: "Tax awareness", value: answers.taxAwareness },
        { label: "Transactions", value: `${assets.length} holdings` },
        { label: "Tracking mode", value: portfolioTotal > 0 ? "Active" : "Starting" },
      ],
      explanation:
        "Tax readiness starts with clean records, not last-minute panic. Even before optimization, you want dates, amounts, instrument names, and a habit of keeping statements together so future filing is not a reconstruction exercise.",
      focusLabel: answers.taxAwareness === "low" ? "Need basics" : "Stay organized",
      followUps: ["sip", "allocation", "risk"],
      personalNote:
        answers.taxAwareness === "low"
          ? "You marked tax awareness as low, so the win here is simple record-keeping before you worry about advanced optimization."
          : "You already know enough to benefit from cleaner tracking and periodic review instead of year-end scrambling.",
      steps: [
        "Keep every statement, contract note, and dividend record in one place.",
        "Track buy dates and amounts so gains are understandable later.",
        "Review taxes as part of portfolio hygiene, not as a once-a-year surprise.",
      ],
      summary: "Good tax behavior is mostly good record behavior.",
    },
  };

  return answersById[questionId];
}

export function getSuggestedMentorQuestions({
  answers,
  assets = [],
}: {
  answers: RiskAnswers;
  assets?: PortfolioAsset[];
}) {
  const portfolioTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
  const concentration = calculateLargestHoldingConcentration({
    assets,
    portfolioTotal,
  });

  if (answers.emergencyMonths < 3 || answers.debtLevel === "heavy") {
    return ["emergency", "debt", "risk"] satisfies MentorQuestionId[];
  }

  if (portfolioTotal <= 0) {
    return ["first-investment", "sip", "risk"] satisfies MentorQuestionId[];
  }

  if (concentration >= 45) {
    return ["allocation", "crash", "etf"] satisfies MentorQuestionId[];
  }

  if (answers.taxAwareness === "low") {
    return ["tax", "sip", "allocation"] satisfies MentorQuestionId[];
  }

  return ["risk", "allocation", "crash"] satisfies MentorQuestionId[];
}
