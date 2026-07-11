import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDashboardAction,
  getGoalPortfolioInsight,
} from "../lib/dashboard-rules";
import type { WealthGoal } from "../lib/local-storage";
import { calculateRiskProfile, type RiskAnswers } from "../lib/wealth-rules";

const formatMoney = (value: number) => `$${value}`;

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

const fundedGoal: WealthGoal = {
  annualReturn: 8,
  currentAmount: 50000,
  id: "goal-test",
  name: "Test goal",
  priority: "important",
  targetAmount: 100000,
  years: 3,
};

const asset = (overrides: Record<string, unknown>) => ({
  gain: 1,
  investedValue: 9000,
  name: "Core",
  price: 100,
  quantity: 100,
  source: "Manual",
  type: "Index Fund",
  value: 10000,
  ...overrides,
});

describe("getDashboardAction", () => {
  it("prioritizes foundation work when confidence is low", () => {
    const profile = calculateRiskProfile({
      ...baseAnswers,
      debtLevel: "heavy",
      emergencyMonths: 1,
    });

    const action = getDashboardAction({
      assets: [],
      formatMoney,
      goalProgress: 0,
      goals: [],
      healthScore: 20,
      monthlyGoal: 0,
      profile,
    });

    assert.equal(action.view, "onboarding");
    assert.equal(action.badge, "Foundation");
  });

  it("points to goal planning when goals are underfunded", () => {
    const action = getDashboardAction({
      assets: [asset({})],
      formatMoney,
      goalProgress: 5,
      goals: [fundedGoal],
      healthScore: 80,
      monthlyGoal: 1200,
      profile: calculateRiskProfile(baseAnswers),
    });

    assert.equal(action.view, "goals");
    assert.match(action.detail, /\$1200/);
  });

  it("falls through to learning when foundation, goals, and tracking are healthy", () => {
    const action = getDashboardAction({
      assets: [
        asset({}),
        asset({ investedValue: 4500, name: "Debt", type: "Debt", value: 5000 }),
        asset({ investedValue: 2800, name: "Gold", type: "Gold", value: 3000 }),
        asset({ investedValue: 2000, name: "Cash", type: "Cash", value: 2000 }),
      ],
      formatMoney,
      goalProgress: 50,
      goals: [fundedGoal],
      healthScore: 85,
      monthlyGoal: 900,
      profile: calculateRiskProfile(baseAnswers),
    });

    assert.equal(action.view, "academy");
    assert.equal(action.badge, "Learning");
  });
});

describe("getGoalPortfolioInsight", () => {
  it("describes the funding gap for early-stage portfolios", () => {
    const insight = getGoalPortfolioInsight({
      goals: [fundedGoal],
      monthlyGoal: 1500,
      portfolioTotal: 15000,
    });

    assert.equal(insight.title, "Funding gap is still the main story");
    assert.match(insight.detail, /₹1,500/);
  });
});
