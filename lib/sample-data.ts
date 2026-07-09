import { calculateRiskProfile, type RiskAnswers } from "@/lib/wealth-rules";

export const defaultRiskAnswers: RiskAnswers = {
  age: 29,
  country: "India",
  annualIncome: 1200000,
  emergencyMonths: 4,
  debtLevel: "manageable",
  horizonYears: 8,
  marketDropResponse: "wait",
  experience: "new",
  primaryGoal: "home",
  timeAvailable: "medium",
  taxAwareness: "low",
  monthlyInvestment: 12000,
  monthlySavings: 30000,
};

export const defaultProfile = calculateRiskProfile(defaultRiskAnswers);

export const portfolioAssets = [
  { name: "Nifty 50 Index", type: "Index Fund", value: 180000, gain: 14 },
  { name: "Flexi Cap Fund", type: "Mutual Fund", value: 92000, gain: 8 },
  { name: "Gold ETF", type: "Gold", value: 42000, gain: 5 },
  { name: "Liquid Fund", type: "Debt", value: 65000, gain: 3 },
  { name: "Cash Reserve", type: "Cash", value: 85000, gain: 0 },
];

export const marketNotes = [
  "Broad indexes are slightly positive, led by banks and consumer stocks.",
  "Gold is flat as investors wait for interest-rate signals.",
  "Debt funds remain useful for near-term goals and emergency reserves.",
];
