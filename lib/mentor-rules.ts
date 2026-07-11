import type { PortfolioAsset } from "./local-storage";
import {
  calculateLargestHoldingConcentration,
  calculatePortfolioInvestedValue,
} from "./portfolio-rules";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";
import { goalLabels } from "./wealth-rules";

export const mentorQuestions = [
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
    id: "risk",
    label: "Why this risk score?",
    title: "Your risk profile",
  },
] as const;

export type MentorQuestionId = (typeof mentorQuestions)[number]["id"];

export type MentorAnswer = {
  explanation: string;
  personalNote: string;
  steps: string[];
  summary: string;
};

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

  const answersById: Record<MentorQuestionId, MentorAnswer> = {
    crash: {
      explanation:
        "A market crash is a temporary fall in prices, not automatically a reason to sell. The right response depends on your goal timeline, emergency fund, debt, and risk capacity.",
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
      explanation:
        "An emergency fund is money kept for job loss, medical needs, family support, or urgent repairs. It should be boring, accessible, and separate from investments.",
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
      explanation:
        "An ETF is a basket of securities that trades like a stock. Many ETFs track an index, so one purchase can give exposure to many companies.",
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
    gold: {
      explanation:
        "Gold can diversify a portfolio because it may behave differently from stocks and bonds. It does not produce business earnings, so it is usually a stabilizer, not the main growth engine.",
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
    risk: {
      explanation:
        "Your score combines age, emergency fund, debt, goal horizon, crash response, experience, learning time, and investing rate. It is a planning signal, not a permanent label.",
      personalNote: `Your current result is ${profile.score}/100: ${profile.band}, ${profile.personality}. ${
        portfolioTotal > 0
          ? `Your tracked portfolio is ${formatMoney(portfolioTotal)} with roughly ${gainPercent}% overall gain. `
          : ""
      }The biggest practical next step is: ${profile.nextActions[0].toLowerCase()}.`,
      steps: [
        "Improve foundation before increasing risk.",
        "Match risk to goal timeline.",
        "Recalculate after big life changes.",
      ],
      summary: "Risk capacity is personal and changes with your life.",
    },
    sip: {
      explanation:
        "A SIP is a recurring investment habit. It helps you invest through different market conditions instead of trying to guess the perfect day.",
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
  };

  return answersById[questionId];
}
