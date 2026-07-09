import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRiskProfileResponse,
  normalizeRiskProfileRequest,
} from "../lib/risk-profile-api";

describe("normalizeRiskProfileRequest", () => {
  it("coerces number-like values and keeps valid enum fields", () => {
    const answers = normalizeRiskProfileRequest({
      age: "42",
      country: "US",
      debtLevel: "none",
      emergencyMonths: "9",
      experience: "confident",
      horizonYears: "12",
      marketDropResponse: "buy",
      monthlyInvestment: "1500",
      monthlySavings: "2500",
      primaryGoal: "retirement",
      taxAwareness: "high",
      timeAvailable: "high",
    });

    assert.equal(answers.age, 42);
    assert.equal(answers.country, "US");
    assert.equal(answers.debtLevel, "none");
    assert.equal(answers.primaryGoal, "retirement");
    assert.equal(answers.monthlyInvestment, 1500);
  });

  it("defaults invalid enum values and non-finite numbers", () => {
    const answers = normalizeRiskProfileRequest({
      age: Number.NaN,
      debtLevel: "unknown",
      experience: "expert",
      marketDropResponse: "panic",
      monthlySavings: Number.POSITIVE_INFINITY,
      primaryGoal: "lottery",
      taxAwareness: "none",
      timeAvailable: "all-day",
    });

    assert.equal(answers.age, 30);
    assert.equal(answers.debtLevel, "manageable");
    assert.equal(answers.experience, "new");
    assert.equal(answers.marketDropResponse, "wait");
    assert.equal(answers.monthlySavings, 1);
    assert.equal(answers.primaryGoal, "wealth");
    assert.equal(answers.taxAwareness, "low");
    assert.equal(answers.timeAvailable, "medium");
  });
});

describe("createRiskProfileResponse", () => {
  it("returns a complete risk profile from untrusted request data", () => {
    const profile = createRiskProfileResponse({
      emergencyMonths: 8,
      horizonYears: 15,
      marketDropResponse: "buy",
      monthlyInvestment: 1000,
      monthlySavings: 1500,
      primaryGoal: "wealth",
    });

    assert.ok(profile.score >= 0);
    assert.ok(["Conservative", "Balanced", "Growth"].includes(profile.band));
    assert.ok(profile.allocation.length > 0);
    assert.ok(profile.nextActions.length > 0);
  });
});
