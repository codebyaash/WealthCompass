import type { PortfolioAsset, WealthGoal } from "./local-storage";
import { defaultSnapshot } from "./local-storage";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type ProfileRow = {
  age: number | null;
  annual_income: number | null;
  country: string | null;
  debt_level: RiskAnswers["debtLevel"] | null;
  emergency_months: number | null;
  experience: RiskAnswers["experience"] | null;
  horizon_years: number | null;
  market_drop_response: RiskAnswers["marketDropResponse"] | null;
  monthly_investment: number | null;
  monthly_savings: number | null;
  primary_goal: RiskAnswers["primaryGoal"] | null;
  tax_awareness: RiskAnswers["taxAwareness"] | null;
  time_available: RiskAnswers["timeAvailable"] | null;
};

export type PortfolioRow = {
  asset_type: string;
  current_value: number;
  gain_percent: number | null;
  name: string;
};

export type GoalRow = {
  current_amount: number;
  expected_return: number;
  id: string;
  name: string;
  priority: WealthGoal["priority"] | null;
  target_amount: number;
  years: number;
};

export type RiskProfileHistoryRow = {
  band: RiskProfile["band"];
  confidence: RiskProfile["confidence"] | null;
  created_at: string;
  id: string;
  personality: string;
  score: number;
  summary: string | null;
};

export function mapAnswersToProfile(answers: RiskAnswers) {
  return {
    age: answers.age,
    annual_income: answers.annualIncome,
    country: answers.country,
    debt_level: answers.debtLevel,
    emergency_months: answers.emergencyMonths,
    experience: answers.experience,
    horizon_years: answers.horizonYears,
    market_drop_response: answers.marketDropResponse,
    monthly_investment: answers.monthlyInvestment,
    monthly_savings: answers.monthlySavings,
    primary_goal: answers.primaryGoal,
    tax_awareness: answers.taxAwareness,
    time_available: answers.timeAvailable,
  };
}

export function mapProfileToAnswers(row: ProfileRow): RiskAnswers {
  return {
    ...defaultSnapshot.answers,
    age: row.age ?? defaultSnapshot.answers.age,
    annualIncome: row.annual_income ?? defaultSnapshot.answers.annualIncome,
    country: row.country ?? defaultSnapshot.answers.country,
    debtLevel: row.debt_level ?? defaultSnapshot.answers.debtLevel,
    emergencyMonths:
      row.emergency_months ?? defaultSnapshot.answers.emergencyMonths,
    experience: row.experience ?? defaultSnapshot.answers.experience,
    horizonYears: row.horizon_years ?? defaultSnapshot.answers.horizonYears,
    marketDropResponse:
      row.market_drop_response ?? defaultSnapshot.answers.marketDropResponse,
    monthlyInvestment:
      row.monthly_investment ?? defaultSnapshot.answers.monthlyInvestment,
    monthlySavings: row.monthly_savings ?? defaultSnapshot.answers.monthlySavings,
    primaryGoal: row.primary_goal ?? defaultSnapshot.answers.primaryGoal,
    taxAwareness: row.tax_awareness ?? defaultSnapshot.answers.taxAwareness,
    timeAvailable: row.time_available ?? defaultSnapshot.answers.timeAvailable,
  };
}

export function mapPortfolioRowToAsset(row: PortfolioRow): PortfolioAsset {
  return {
    gain: row.gain_percent ?? 0,
    name: row.name,
    type: row.asset_type,
    value: row.current_value,
  };
}

export function mapAssetToPortfolioInsert(asset: PortfolioAsset, userId: string) {
  return {
    asset_type: asset.type,
    current_value: asset.value,
    gain_percent: asset.gain,
    name: asset.name,
    user_id: userId,
  };
}

export function mapGoalRowToGoal(row: GoalRow): WealthGoal {
  return {
    annualReturn: row.expected_return,
    currentAmount: row.current_amount,
    id: row.id,
    name: row.name,
    priority: row.priority ?? "important",
    targetAmount: row.target_amount,
    years: row.years,
  };
}

export function mapGoalToInsert(goal: WealthGoal, userId: string) {
  return {
    current_amount: goal.currentAmount,
    expected_return: goal.annualReturn,
    name: goal.name,
    priority: goal.priority,
    target_amount: goal.targetAmount,
    user_id: userId,
    years: goal.years,
  };
}

export function mapRiskProfileHistoryRow(row: RiskProfileHistoryRow) {
  return {
    band: row.band,
    confidence: row.confidence ?? "Getting ready",
    createdAt: row.created_at,
    id: row.id,
    personality: row.personality,
    score: row.score,
    summary: row.summary ?? "Saved risk profile snapshot.",
  };
}
