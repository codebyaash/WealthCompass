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
  debtLevel: "manageable",
  emergencyMonths: 6,
  experience: "some",
  horizonYears: 8,
  marketDropResponse: "wait",
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
    assert.equal(profile.allocation.reduce((sum, item) => sum + item.value, 0), 100);
    assert.equal(profile.roadmap.length, 6);
  });

  it("flags foundation risk when emergency savings are low and debt is heavy", () => {
    const profile = calculateRiskProfile({
      ...baseAnswers,
      debtLevel: "heavy",
      emergencyMonths: 1,
      marketDropResponse: "sell",
      primaryGoal: "emergency",
    });

    assert.equal(profile.band, "Conservative");
    assert.equal(profile.confidence, "Needs foundation");
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
