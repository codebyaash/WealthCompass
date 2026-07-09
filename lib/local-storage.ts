import { defaultRiskAnswers, portfolioAssets } from "./sample-data";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type PortfolioAsset = {
  name: string;
  type: string;
  value: number;
  gain: number;
};

export type GoalPriority = "essential" | "important" | "aspirational";

export type WealthGoal = {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  years: number;
  annualReturn: number;
  priority: GoalPriority;
};

export type WealthCompassSnapshot = {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goals: WealthGoal[];
};

export type WealthCompassImport = WealthCompassSnapshot & {
  riskHistory: RiskHistoryItem[];
};

export type RiskHistoryItem = Pick<
  RiskProfile,
  "band" | "confidence" | "personality" | "score" | "summary"
> & {
  createdAt: string;
  id: string;
};

export const defaultGoal: WealthGoal = {
  id: "goal-home-down-payment",
  name: "Home down payment",
  currentAmount: 150000,
  targetAmount: 1200000,
  years: 5,
  annualReturn: 10,
  priority: "important",
};

export const defaultGoals: WealthGoal[] = [
  defaultGoal,
  {
    id: "goal-emergency-fund",
    name: "Emergency fund",
    currentAmount: 80000,
    targetAmount: 300000,
    years: 2,
    annualReturn: 5,
    priority: "essential",
  },
];

export const defaultSnapshot: WealthCompassSnapshot = {
  answers: defaultRiskAnswers,
  assets: portfolioAssets,
  goals: defaultGoals,
};

const storageKey = "wealthcompass:snapshot:v1";
const riskHistoryKey = "wealthcompass:risk-history:v1";

export function loadSnapshot() {
  if (typeof window === "undefined") return defaultSnapshot;

  const rawSnapshot = window.localStorage.getItem(storageKey);
  if (!rawSnapshot) return defaultSnapshot;

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as Partial<WealthCompassSnapshot> & {
      goal?: Partial<WealthGoal>;
    };

    return {
      answers: {
        ...defaultSnapshot.answers,
        ...parsedSnapshot.answers,
      },
      assets: parsedSnapshot.assets ?? defaultSnapshot.assets,
      goals: normalizeGoals(parsedSnapshot.goals ?? parsedSnapshot.goal) ?? defaultSnapshot.goals,
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

export function parseWorkspaceImport(rawJson: string): {
  data?: WealthCompassImport;
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { errors: ["JSON is not valid."] };
  }

  if (!isRecord(parsed)) {
    return { errors: ["Workspace import must be a JSON object."] };
  }

  const answers = normalizeRiskAnswers(parsed.answers);
  const assets = normalizePortfolioAssets(parsed.assets);
  const goals = normalizeGoals(parsed.goals ?? parsed.goal);
  const riskHistory = normalizeRiskHistory(parsed.riskHistory);

  if (!answers) errors.push("Missing or invalid onboarding answers.");
  if (!assets) errors.push("Missing or invalid portfolio assets.");
  if (!goals) errors.push("Missing or invalid goals.");
  if (!riskHistory) errors.push("Risk history must be an array when provided.");

  if (errors.length || !answers || !assets || !goals || !riskHistory) {
    return { errors };
  }

  return {
    data: {
      answers,
      assets,
      goals,
      riskHistory,
    },
    errors: [],
  };
}

export function createWealthGoal(overrides: Partial<WealthGoal> = {}): WealthGoal {
  return {
    annualReturn: defaultGoal.annualReturn,
    currentAmount: 0,
    id: createGoalId(),
    name: "New goal",
    priority: "important",
    targetAmount: 500000,
    years: 5,
    ...overrides,
  };
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

function normalizeRiskAnswers(value: unknown): RiskAnswers | null {
  if (!isRecord(value)) return null;

  return {
    age: numberOrDefault(value.age, defaultSnapshot.answers.age),
    annualIncome: numberOrDefault(value.annualIncome, defaultSnapshot.answers.annualIncome),
    country: stringOrDefault(value.country, defaultSnapshot.answers.country),
    debtLevel: enumOrDefault(value.debtLevel, ["none", "manageable", "heavy"], defaultSnapshot.answers.debtLevel),
    emergencyMonths: numberOrDefault(value.emergencyMonths, defaultSnapshot.answers.emergencyMonths),
    experience: enumOrDefault(value.experience, ["new", "some", "confident"], defaultSnapshot.answers.experience),
    horizonYears: numberOrDefault(value.horizonYears, defaultSnapshot.answers.horizonYears),
    marketDropResponse: enumOrDefault(value.marketDropResponse, ["sell", "wait", "buy"], defaultSnapshot.answers.marketDropResponse),
    monthlyInvestment: numberOrDefault(value.monthlyInvestment, defaultSnapshot.answers.monthlyInvestment),
    monthlySavings: numberOrDefault(value.monthlySavings, defaultSnapshot.answers.monthlySavings),
    primaryGoal: enumOrDefault(
      value.primaryGoal,
      ["emergency", "home", "retirement", "wealth", "education", "travel"],
      defaultSnapshot.answers.primaryGoal,
    ),
    taxAwareness: enumOrDefault(value.taxAwareness, ["low", "medium", "high"], defaultSnapshot.answers.taxAwareness),
    timeAvailable: enumOrDefault(value.timeAvailable, ["low", "medium", "high"], defaultSnapshot.answers.timeAvailable),
  };
}

function normalizePortfolioAssets(value: unknown): PortfolioAsset[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((asset) => ({
      gain: numberOrDefault(asset.gain, 0),
      name: stringOrDefault(asset.name, "Unnamed holding"),
      type: stringOrDefault(asset.type, "Other"),
      value: numberOrDefault(asset.value, 0),
    }))
    .filter((asset) => asset.name.trim() && asset.value >= 0);
}

function normalizeGoals(value: unknown): WealthGoal[] | null {
  if (Array.isArray(value)) {
    const goals = value.map(normalizeGoal).filter((goal): goal is WealthGoal => Boolean(goal));
    return goals.length ? goals : [];
  }

  const goal = normalizeGoal(value);
  return goal ? [goal] : null;
}

function normalizeGoal(value: unknown): WealthGoal | null {
  if (!isRecord(value)) return null;

  return {
    annualReturn: numberOrDefault(value.annualReturn, defaultGoal.annualReturn),
    currentAmount: numberOrDefault(value.currentAmount, defaultGoal.currentAmount),
    id: stringOrDefault(value.id, createGoalId()),
    name: stringOrDefault(value.name, defaultGoal.name),
    priority: enumOrDefault(value.priority, ["essential", "important", "aspirational"], defaultGoal.priority),
    targetAmount: numberOrDefault(value.targetAmount, defaultGoal.targetAmount),
    years: numberOrDefault(value.years, defaultGoal.years),
  };
}

function normalizeRiskHistory(value: unknown): RiskHistoryItem[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  return value.filter(isRecord).map((item) => ({
    band: enumOrDefault(item.band, ["Conservative", "Balanced", "Growth"], "Balanced"),
    confidence: enumOrDefault(
      item.confidence,
      ["Needs foundation", "Getting ready", "Ready to act"],
      "Getting ready",
    ),
    createdAt: stringOrDefault(item.createdAt, new Date().toISOString()),
    id: stringOrDefault(item.id, crypto.randomUUID()),
    personality: stringOrDefault(item.personality, "Steady Explorer"),
    score: numberOrDefault(item.score, 50),
    summary: stringOrDefault(item.summary, "Imported risk profile snapshot."),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrDefault(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function enumOrDefault<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function createGoalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `goal-${Date.now()}`;
}
