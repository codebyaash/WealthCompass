import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWealthGoal,
  defaultSnapshot,
  parseWorkspaceImport,
} from "../lib/local-storage";

describe("parseWorkspaceImport", () => {
  it("imports current workspace JSON with goals and risk history", () => {
    const result = parseWorkspaceImport(
      JSON.stringify({
        answers: {
          ...defaultSnapshot.answers,
          country: "US",
          debtLevel: "none",
          primaryGoal: "retirement",
        },
        assets: [
          {
            gain: "12",
            name: "Index Core",
            type: "Index Fund",
            value: "150000",
          },
        ],
        goals: [
          {
            annualReturn: "8",
            currentAmount: "10000",
            id: "goal-retirement",
            name: "Retirement",
            priority: "essential",
            targetAmount: "2000000",
            years: "20",
          },
        ],
        riskHistory: [
          {
            band: "Growth",
            confidence: "Ready to act",
            createdAt: "2026-07-09T00:00:00.000Z",
            id: "risk-1",
            personality: "Growth Allocator",
            score: 82,
            summary: "Saved profile.",
          },
        ],
      }),
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.data?.answers.country, "US");
    assert.equal(result.data?.assets[0].value, 150000);
    assert.equal(result.data?.goals[0].priority, "essential");
    assert.equal(result.data?.riskHistory[0].band, "Growth");
  });

  it("migrates legacy single-goal exports into the goals array", () => {
    const result = parseWorkspaceImport(
      JSON.stringify({
        answers: defaultSnapshot.answers,
        assets: defaultSnapshot.assets,
        goal: {
          annualReturn: 6,
          currentAmount: 25000,
          name: "Legacy goal",
          targetAmount: 100000,
          years: 2,
        },
      }),
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.data?.goals.length, 1);
    assert.equal(result.data?.goals[0].name, "Legacy goal");
    assert.equal(result.data?.goals[0].priority, "important");
    assert.equal(result.data?.riskHistory.length, 0);
  });

  it("reports invalid JSON and missing required sections", () => {
    assert.deepEqual(parseWorkspaceImport("{").errors, ["JSON is not valid."]);

    const result = parseWorkspaceImport(JSON.stringify({ answers: defaultSnapshot.answers }));

    assert.ok(result.errors.includes("Missing or invalid portfolio assets."));
    assert.ok(result.errors.includes("Missing or invalid goals."));
  });
});

describe("createWealthGoal", () => {
  it("creates a default editable goal with override support", () => {
    const goal = createWealthGoal({
      name: "Education",
      priority: "aspirational",
    });

    assert.equal(goal.name, "Education");
    assert.equal(goal.priority, "aspirational");
    assert.equal(goal.targetAmount, 500000);
    assert.ok(goal.id.length > 0);
  });
});
