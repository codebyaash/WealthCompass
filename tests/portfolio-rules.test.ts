import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateRealizedGainFromTransactions,
  calculateLargestHoldingConcentration,
  calculatePortfolioGainPercent,
  derivePortfolioAssetsFromTransactions,
  getAllocationInsights,
  getPortfolioDiversificationScore,
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

const asset = (overrides: Record<string, unknown>) => ({
  gain: 1,
  investedValue: 0,
  name: "Core",
  price: 0,
  quantity: 0,
  source: "Manual",
  type: "Index Fund",
  value: 60000,
  ...overrides,
});

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
          asset({ investedValue: 50000 }),
          asset({ investedValue: 35000, name: "Debt", type: "Debt", value: 40000 }),
        ],
        portfolioTotal: 100000,
      }),
      60,
    );
  });
});

describe("calculatePortfolioGainPercent", () => {
  it("derives portfolio gain from invested value", () => {
    assert.equal(
      calculatePortfolioGainPercent(
        [
          asset({ investedValue: 50000 }),
          asset({ investedValue: 35000, name: "Debt", type: "Debt", value: 40000 }),
        ],
        100000,
      ),
      18,
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
        asset({ investedValue: 50000 }),
        asset({ investedValue: 35000, name: "Debt", type: "Debt", value: 40000 }),
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
        label: "Portfolio return",
        status: "Profitable",
        value: "18%",
      },
      {
        label: "Detail coverage",
        status: "Import quality strong",
        value: "100%",
      },
      {
        label: "Diversification score",
        status: "Improving",
        value: "67/100",
      },
    ]);
  });
});

describe("portfolio analytics helpers", () => {
  it("returns diversification and allocation insights", () => {
    const assets = [
      asset({ investedValue: 50000 }),
      asset({ investedValue: 35000, name: "Debt", type: "Debt", value: 40000 }),
    ];
    const profile = calculateRiskProfile(answers);

    assert.equal(
      getPortfolioDiversificationScore({
        assets,
        portfolioTotal: 100000,
      }),
      67,
    );

    assert.deepEqual(getAllocationInsights({ assets, portfolioTotal: 100000, profile }), [
      {
        bucket: "Cash",
        currentShare: 0,
        status: "Below target",
        suggestedShare: 12,
      },
      {
        bucket: "Debt",
        currentShare: 40,
        status: "Above target",
        suggestedShare: 28,
      },
      {
        bucket: "Index Funds",
        currentShare: 60,
        status: "Above target",
        suggestedShare: 45,
      },
      {
        bucket: "Gold",
        currentShare: 0,
        status: "Below target",
        suggestedShare: 10,
      },
      {
        bucket: "Stocks",
        currentShare: 0,
        status: "Near target",
        suggestedShare: 5,
      },
    ]);
  });
});

describe("derivePortfolioAssetsFromTransactions", () => {
  it("builds live holdings from buys and sells", () => {
    const derived = derivePortfolioAssetsFromTransactions([
      {
        action: "buy",
        amount: 10000,
        assetName: "Nifty 50 Index Fund",
        date: "2026-01-01",
        id: "t1",
        notes: "",
        price: 100,
        quantity: 100,
        source: "Paytm Money",
        type: "Index Fund",
      },
      {
        action: "sell",
        amount: 2750,
        assetName: "Nifty 50 Index Fund",
        date: "2026-02-01",
        id: "t2",
        notes: "",
        price: 110,
        quantity: 25,
        source: "Paytm Money",
        type: "Index Fund",
      },
    ]);

    assert.equal(derived.length, 1);
    assert.equal(derived[0]?.quantity, 75);
    assert.equal(derived[0]?.investedValue, 7500);
    assert.equal(derived[0]?.value, 8250);
  });
});

describe("calculateRealizedGainFromTransactions", () => {
  it("includes sell gains and dividends", () => {
    const realized = calculateRealizedGainFromTransactions([
      {
        action: "buy",
        amount: 10000,
        assetName: "Core Equity",
        date: "2026-01-01",
        id: "t1",
        notes: "",
        price: 100,
        quantity: 100,
        source: "Manual",
        type: "Index Fund",
      },
      {
        action: "sell",
        amount: 2400,
        assetName: "Core Equity",
        date: "2026-03-01",
        id: "t2",
        notes: "",
        price: 120,
        quantity: 20,
        source: "Manual",
        type: "Index Fund",
      },
      {
        action: "dividend",
        amount: 300,
        assetName: "Core Equity",
        date: "2026-03-15",
        id: "t3",
        notes: "",
        price: 0,
        quantity: 0,
        source: "Manual",
        type: "Index Fund",
      },
    ]);

    assert.equal(realized, 700);
  });
});
