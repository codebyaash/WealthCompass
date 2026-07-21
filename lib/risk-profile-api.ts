import { calculateRiskProfile, type RiskAnswers } from "./wealth-rules";

const defaultAnswers: RiskAnswers = {
  age: 30,
  annualIncome: 0,
  country: "",
  dependents: 0,
  incomeStability: "steady",
  debtLevel: "manageable",
  emergencyMonths: 3,
  experience: "new",
  horizonYears: 5,
  liquidityNeeds: "medium",
  marketDropResponse: "wait",
  postLearningDropResponse: "wait",
  decisionStyle: "guided",
  monthlyInvestment: 0,
  monthlySavings: 1,
  primaryGoal: "wealth",
  taxAwareness: "low",
  timeAvailable: "medium",
};

export function normalizeRiskProfileRequest(body: unknown): RiskAnswers {
  const payload = isRecord(body) ? body : {};

  return {
    age: numberOrDefault(payload.age, defaultAnswers.age),
    annualIncome: numberOrDefault(payload.annualIncome, defaultAnswers.annualIncome),
    country: stringOrDefault(payload.country, defaultAnswers.country),
    dependents: numberOrDefault(payload.dependents, defaultAnswers.dependents),
    incomeStability: enumOrDefault(
      payload.incomeStability,
      ["variable", "steady", "very-steady"],
      defaultAnswers.incomeStability,
    ),
    debtLevel: enumOrDefault(payload.debtLevel, ["none", "manageable", "heavy"], defaultAnswers.debtLevel),
    emergencyMonths: numberOrDefault(payload.emergencyMonths, defaultAnswers.emergencyMonths),
    experience: enumOrDefault(payload.experience, ["new", "some", "confident"], defaultAnswers.experience),
    horizonYears: numberOrDefault(payload.horizonYears, defaultAnswers.horizonYears),
    liquidityNeeds: enumOrDefault(
      payload.liquidityNeeds,
      ["high", "medium", "low"],
      defaultAnswers.liquidityNeeds,
    ),
    marketDropResponse: enumOrDefault(
      payload.marketDropResponse,
      ["sell", "wait", "buy"],
      defaultAnswers.marketDropResponse,
    ),
    postLearningDropResponse: enumOrDefault(
      payload.postLearningDropResponse,
      ["sell", "wait", "buy"],
      defaultAnswers.postLearningDropResponse,
    ),
    decisionStyle: enumOrDefault(
      payload.decisionStyle,
      ["hands-off", "guided", "active"],
      defaultAnswers.decisionStyle,
    ),
    monthlyInvestment: numberOrDefault(payload.monthlyInvestment, defaultAnswers.monthlyInvestment),
    monthlySavings: numberOrDefault(payload.monthlySavings, defaultAnswers.monthlySavings),
    primaryGoal: enumOrDefault(
      payload.primaryGoal,
      ["emergency", "home", "retirement", "wealth", "education", "travel"],
      defaultAnswers.primaryGoal,
    ),
    taxAwareness: enumOrDefault(payload.taxAwareness, ["low", "medium", "high"], defaultAnswers.taxAwareness),
    timeAvailable: enumOrDefault(payload.timeAvailable, ["low", "medium", "high"], defaultAnswers.timeAvailable),
  };
}

export function createRiskProfileResponse(body: unknown) {
  return calculateRiskProfile(normalizeRiskProfileRequest(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrDefault(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function enumOrDefault<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}
