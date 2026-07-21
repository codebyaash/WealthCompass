import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateGoalMonthlyInvestment,
  calculateRiskProfile,
  type RiskAnswers,
} from "../lib/wealth-rules";

const baseAnswers: RiskAnswers = {
  age: 35,
  annualIncome: 100000,
  country: "US",
  decisionStyle: "guided",
  debtLevel: "manageable",
  dependents: 0,
  emergencyMonths: 6,
  experience: "some",
  horizonYears: 8,
  incomeStability: "steady",
  liquidityNeeds: "medium",
  marketDropResponse: "wait",
  postLearningDropResponse: "buy",
  monthlyInvestment: 1000,
  monthlySavings: 2500,
  primaryGoal: "wealth",
  taxAwareness: "medium",
  timeAvailable: "medium",
};

describe("calculateRiskProfile", () => {
  it("returns a balanced profile for a stable middle case", () => {
    const profile = calculateRiskProfile(baseAnswers);

    assert.equal(profile.band, "Balanced");
    assert.equal(profile.personality, "Steady Explorer");
    assert.equal(profile.potentialBand, "Growth");
    assert.equal(profile.intentGap, "knowledge-gap");
    assert.equal(profile.allocation.reduce((sum, item) => sum + item.value, 0), 100);
    assert.equal(profile.roadmap.length, 6);
    assert.equal(profile.actionBaskets.length, 3);
  });

  it("flags foundation risk when emergency savings are low and debt is heavy", () => {
    const profile = calculateRiskProfile({
      ...baseAnswers,
      debtLevel: "heavy",
      emergencyMonths: 1,
      marketDropResponse: "sell",
      postLearningDropResponse: "sell",
      primaryGoal: "emergency",
    });

    assert.equal(profile.band, "Conservative");
    assert.equal(profile.confidence, "Needs foundation");
    assert.equal(profile.potentialScore, null);
    assert.equal(profile.intentGap, "steady-caution");
    assert.match(profile.recommendations[0], /debt|emergency/i);
  });

  it("caps aggressive profiles at 95", () => {
    const profile = calculateRiskProfile({
      ...baseAnswers,
      age: 25,
      debtLevel: "none",
      experience: "confident",
      horizonYears: 30,
      marketDropResponse: "buy",
      postLearningDropResponse: "buy",
      monthlyInvestment: 5000,
      monthlySavings: 6000,
      primaryGoal: "retirement",
      taxAwareness: "high",
      timeAvailable: "high",
    });

    assert.equal(profile.score, 95);
    assert.equal(profile.band, "Growth");
    assert.ok(profile.nextActions.includes("Estimate retirement corpus with conservative assumptions"));
  });

  it("shows a higher potential score when risk hesitation is mostly a knowledge gap", () => {
    const profile = calculateRiskProfile({
      ...baseAnswers,
      age: 29,
      experience: "new",
      marketDropResponse: "sell",
      postLearningDropResponse: "buy",
    });

    assert.equal(profile.intentGap, "knowledge-gap");
    assert.ok(profile.potentialScore !== null);
    assert.ok((profile.potentialScore ?? 0) > profile.score);
    assert.equal(profile.actionBaskets[0].title, "Understand the Plan");
    assert.match(profile.actionBaskets[2].items[0], /starter-sized SIP|cash buffer|scale/i);
  });
});

describe("calculateGoalMonthlyInvestment", () => {
  it("returns zero when current amount can already meet the target", () => {
    const monthly = calculateGoalMonthlyInvestment({
      annualReturn: 8,
      currentAmount: 1000000,
      targetAmount: 500000,
      years: 5,
    });

    assert.equal(monthly, 0);
  });

  it("uses straight-line savings when expected return is zero", () => {
    const monthly = calculateGoalMonthlyInvestment({
      annualReturn: 0,
      currentAmount: 100000,
      targetAmount: 220000,
      years: 2,
    });

    assert.equal(monthly, 5000);
  });
});
