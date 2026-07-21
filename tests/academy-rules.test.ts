import test from "node:test";
import assert from "node:assert/strict";
import {
  academyUseCases,
  buildAcademyTrackPlans,
  buildComparisonSummary,
  getAcademyComparisonOptions,
  normalizeComparisonSelection,
} from "../lib/academy-rules";
import { calculateRiskProfile, type RiskAnswers } from "../lib/wealth-rules";

const baseAnswers: RiskAnswers = {
  age: 33,
  annualIncome: 90000,
  country: "US",
  decisionStyle: "guided",
  debtLevel: "manageable",
  dependents: 0,
  emergencyMonths: 6,
  experience: "new",
  horizonYears: 8,
  incomeStability: "steady",
  liquidityNeeds: "medium",
  marketDropResponse: "wait",
  postLearningDropResponse: "buy",
  monthlyInvestment: 900,
  monthlySavings: 2200,
  primaryGoal: "wealth",
  taxAwareness: "medium",
  timeAvailable: "medium",
};

test("academy comparison options exclude the category already selected on the other side", () => {
  const options = getAcademyComparisonOptions("index-funds");

  assert.equal(options.some((option) => option.id === "index-funds"), false);
  assert.equal(options.some((option) => option.id === "etfs"), true);
});

test("normalizeComparisonSelection resolves duplicate picks into two distinct categories", () => {
  const selection = normalizeComparisonSelection("index-funds", "index-funds");

  assert.equal(selection.leftCategory.id, "index-funds");
  assert.notEqual(selection.rightCategory.id, "index-funds");
});

test("buildComparisonSummary favors the more liquid option when roles differ", () => {
  const { leftCategory, rightCategory } = normalizeComparisonSelection("gold", "savings-account");
  const summary = buildComparisonSummary(leftCategory, rightCategory);

  assert.equal(summary.defaultPick, "Savings Account");
  assert.match(summary.recommendation, /liquidity and access matter more/i);
});

test("academy use cases include a broad emergency and short-term shortlist", () => {
  const useCase = academyUseCases.find((item) => item.id === "emergency-and-short-term");

  assert.ok(useCase);
  assert.deepEqual(useCase.categoryIds.slice(0, 3), [
    "savings-account",
    "liquid-funds",
    "overnight-funds",
  ]);
});

test("academy track plans personalize the top learning lanes from profile context", () => {
  const profile = calculateRiskProfile(baseAnswers);
  const plans = buildAcademyTrackPlans({
    answers: baseAnswers,
    profile,
  });

  assert.equal(plans.length, 3);
  assert.equal(plans[0]?.title, "Understand the Plan");
  assert.ok(plans[0]?.useCaseIds.includes("first-long-term-sip"));
  assert.ok(plans[1]?.categoryIds.length > 0);
});

test("academy track plans keep emergency learning visible when foundation is weak", () => {
  const stressedAnswers: RiskAnswers = {
    ...baseAnswers,
    debtLevel: "heavy",
    emergencyMonths: 1,
    primaryGoal: "emergency",
  };
  const plans = buildAcademyTrackPlans({
    answers: stressedAnswers,
    profile: calculateRiskProfile(stressedAnswers),
  });

  assert.ok(plans[0]?.useCaseIds.includes("emergency-and-short-term"));
  assert.ok(plans[2]?.useCaseIds.includes("emergency-and-short-term"));
});
