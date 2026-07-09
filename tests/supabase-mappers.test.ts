import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapAnswersToProfile,
  mapAssetToPortfolioInsert,
  mapGoalRowToGoal,
  mapGoalToInsert,
  mapPortfolioRowToAsset,
  mapProfileToAnswers,
  mapRiskProfileHistoryRow,
  type ProfileRow,
} from "../lib/supabase-mappers";
import { defaultSnapshot, type WealthGoal } from "../lib/local-storage";
import type { RiskAnswers } from "../lib/wealth-rules";

const answers: RiskAnswers = {
  age: 40,
  annualIncome: 150000,
  country: "US",
  debtLevel: "none",
  emergencyMonths: 9,
  experience: "confident",
  horizonYears: 12,
  marketDropResponse: "buy",
  monthlyInvestment: 2500,
  monthlySavings: 5000,
  primaryGoal: "retirement",
  taxAwareness: "high",
  timeAvailable: "high",
};

describe("profile mappers", () => {
  it("maps app risk answers to a Supabase profile row shape", () => {
    assert.deepEqual(mapAnswersToProfile(answers), {
      age: 40,
      annual_income: 150000,
      country: "US",
      debt_level: "none",
      emergency_months: 9,
      experience: "confident",
      horizon_years: 12,
      market_drop_response: "buy",
      monthly_investment: 2500,
      monthly_savings: 5000,
      primary_goal: "retirement",
      tax_awareness: "high",
      time_available: "high",
    });
  });

  it("maps nullable Supabase profile values back to app defaults", () => {
    const row: ProfileRow = {
      age: null,
      annual_income: 90000,
      country: null,
      debt_level: null,
      emergency_months: null,
      experience: "some",
      horizon_years: 6,
      market_drop_response: null,
      monthly_investment: null,
      monthly_savings: 2000,
      primary_goal: "home",
      tax_awareness: null,
      time_available: "low",
    };

    const mapped = mapProfileToAnswers(row);

    assert.equal(mapped.age, defaultSnapshot.answers.age);
    assert.equal(mapped.annualIncome, 90000);
    assert.equal(mapped.country, defaultSnapshot.answers.country);
    assert.equal(mapped.experience, "some");
    assert.equal(mapped.primaryGoal, "home");
    assert.equal(mapped.timeAvailable, "low");
  });
});

describe("portfolio mappers", () => {
  it("maps portfolio rows and insert payloads", () => {
    const asset = mapPortfolioRowToAsset({
      asset_type: "Index Fund",
      current_value: 150000,
      gain_percent: null,
      name: "Index Core",
    });

    assert.deepEqual(asset, {
      gain: 0,
      name: "Index Core",
      type: "Index Fund",
      value: 150000,
    });

    assert.deepEqual(mapAssetToPortfolioInsert(asset, "user-1"), {
      asset_type: "Index Fund",
      current_value: 150000,
      gain_percent: 0,
      name: "Index Core",
      user_id: "user-1",
    });
  });
});

describe("goal mappers", () => {
  const goal: WealthGoal = {
    annualReturn: 7,
    currentAmount: 10000,
    id: "goal-1",
    name: "Education",
    priority: "essential",
    targetAmount: 500000,
    years: 8,
  };

  it("maps goal rows and insert payloads", () => {
    assert.deepEqual(
      mapGoalRowToGoal({
        current_amount: 10000,
        expected_return: 7,
        id: "goal-1",
        name: "Education",
        priority: null,
        target_amount: 500000,
        years: 8,
      }),
      {
        ...goal,
        priority: "important",
      },
    );

    assert.deepEqual(mapGoalToInsert(goal, "user-1"), {
      current_amount: 10000,
      expected_return: 7,
      name: "Education",
      priority: "essential",
      target_amount: 500000,
      user_id: "user-1",
      years: 8,
    });
  });
});

describe("risk history mappers", () => {
  it("maps nullable risk history fields to app defaults", () => {
    assert.deepEqual(
      mapRiskProfileHistoryRow({
        band: "Balanced",
        confidence: null,
        created_at: "2026-07-09T00:00:00.000Z",
        id: "risk-1",
        personality: "Steady Explorer",
        score: 58,
        summary: null,
      }),
      {
        band: "Balanced",
        confidence: "Getting ready",
        createdAt: "2026-07-09T00:00:00.000Z",
        id: "risk-1",
        personality: "Steady Explorer",
        score: 58,
        summary: "Saved risk profile snapshot.",
      },
    );
  });
});
