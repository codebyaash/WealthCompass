import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateLargestHoldingConcentration,
  getPortfolioHealthChecks,
  getSuggestedIndexFundCore,
} from "../lib/portfolio-rules";
import { calculateRiskProfile, type RiskAnswers } from "../lib/wealth-rules";

const answers: RiskAnswers = {
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

describe("calculateLargestHoldingConcentration", () => {
  it("returns zero for empty portfolios", () => {
    assert.equal(
      calculateLargestHoldingConcentration({
        assets: [],
        portfolioTotal: 0,
      }),
      0,
    );
  });

  it("calculates largest holding concentration as a percentage", () => {
    assert.equal(
      calculateLargestHoldingConcentration({
        assets: [
          { gain: 1, name: "Core", type: "Index Fund", value: 60000 },
          { gain: 1, name: "Debt", type: "Debt", value: 40000 },
        ],
        portfolioTotal: 100000,
      }),
      60,
    );
  });
});

describe("getSuggestedIndexFundCore", () => {
  it("extracts the recommended index fund allocation from the risk profile", () => {
    assert.equal(getSuggestedIndexFundCore(calculateRiskProfile(answers)), 45);
  });
});

describe("getPortfolioHealthChecks", () => {
  it("returns the portfolio checks rendered by the tracker", () => {
    const checks = getPortfolioHealthChecks({
      assets: [
        { gain: 1, name: "Core", type: "Index Fund", value: 60000 },
        { gain: 1, name: "Debt", type: "Debt", value: 40000 },
      ],
      portfolioTotal: 100000,
      profile: calculateRiskProfile(answers),
    });

    assert.deepEqual(checks, [
      {
        label: "Largest holding",
        status: "Needs attention",
        value: "60%",
      },
      {
        label: "Suggested index fund core",
        status: "On track",
        value: "45%",
      },
      {
        label: "Tracking habit",
        status: "Add more detail",
        value: "2 assets",
      },
    ]);
  });
});
