import { defaultRiskAnswers, portfolioAssets } from "@/lib/sample-data";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export type PortfolioAsset = {
  name: string;
  type: string;
  value: number;
  gain: number;
};

export type WealthGoal = {
  name: string;
  currentAmount: number;
  targetAmount: number;
  years: number;
  annualReturn: number;
};

export type WealthCompassSnapshot = {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goal: WealthGoal;
};

export type RiskHistoryItem = Pick<
  RiskProfile,
  "band" | "confidence" | "personality" | "score" | "summary"
> & {
  createdAt: string;
  id: string;
};

export const defaultGoal: WealthGoal = {
  name: "Home down payment",
  currentAmount: 150000,
  targetAmount: 1200000,
  years: 5,
  annualReturn: 10,
};

export const defaultSnapshot: WealthCompassSnapshot = {
  answers: defaultRiskAnswers,
  assets: portfolioAssets,
  goal: defaultGoal,
};

const storageKey = "wealthcompass:snapshot:v1";
const riskHistoryKey = "wealthcompass:risk-history:v1";

export function loadSnapshot() {
  if (typeof window === "undefined") return defaultSnapshot;

  const rawSnapshot = window.localStorage.getItem(storageKey);
  if (!rawSnapshot) return defaultSnapshot;

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<WealthCompassSnapshot>;

    return {
      answers: {
        ...defaultSnapshot.answers,
        ...parsedSnapshot.answers,
      },
      assets: parsedSnapshot.assets ?? defaultSnapshot.assets,
      goal: {
        ...defaultSnapshot.goal,
        ...parsedSnapshot.goal,
      },
    };
  } catch {
    return defaultSnapshot;
  }
}

export function saveSnapshot(snapshot: WealthCompassSnapshot) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

export function loadRiskHistory() {
  if (typeof window === "undefined") return [];

  const rawHistory = window.localStorage.getItem(riskHistoryKey);
  if (!rawHistory) return [];

  try {
    return JSON.parse(rawHistory) as RiskHistoryItem[];
  } catch {
    return [];
  }
}

export function saveRiskHistory(history: RiskHistoryItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(riskHistoryKey, JSON.stringify(history));
}

export function createRiskHistoryItem(profile: RiskProfile): RiskHistoryItem {
  return {
    band: profile.band,
    confidence: profile.confidence,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    personality: profile.personality,
    score: profile.score,
    summary: profile.summary,
  };
}
