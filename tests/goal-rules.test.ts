import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateGoalFundingGap,
  calculateGoalProgress,
  getGoalMilestones,
  getGoalMonthlySplit,
  getGoalPlanningChecks,
  getGoalScenarioRows,
  getGoalSummary,
} from "../lib/goal-rules";
import type { WealthGoal } from "../lib/local-storage";

const goals: WealthGoal[] = [
  {
    annualReturn: 8,
    currentAmount: 20000,
    id: "goal-1",
    name: "Emergency fund",
    priority: "essential",
    targetAmount: 100000,
    years: 2,
  },
  {
    annualReturn: 10,
    currentAmount: 50000,
    id: "goal-2",
    name: "Home",
    priority: "important",
    targetAmount: 400000,
    years: 5,
  },
];

describe("goal progress helpers", () => {
  it("calculates capped goal progress and funding gap", () => {
    assert.equal(calculateGoalProgress(goals[0]), 20);
    assert.equal(calculateGoalFundingGap(goals[0]), 80000);
    assert.equal(
      calculateGoalProgress({
        ...goals[0],
        currentAmount: 150000,
      }),
      100,
    );
  });
});

describe("getGoalSummary", () => {
  it("summarizes total funding and essential goal count", () => {
    assert.deepEqual(getGoalSummary(goals), {
      priorityCount: 1,
      totalCurrent: 70000,
      totalProgress: 14,
      totalTarget: 500000,
    });
  });
});

describe("getGoalMonthlySplit", () => {
  it("creates chart rows with monthly investment requirements", () => {
    const split = getGoalMonthlySplit(goals);

    assert.equal(split.length, 2);
    assert.equal(split[0].name, "Emergency fund");
    assert.ok(split[0].monthly > 0);
  });
});

describe("getGoalPlanningChecks", () => {
  it("returns planning checks rendered by the goal planner", () => {
    assert.deepEqual(
      getGoalPlanningChecks({
        formatMoney: (value) => `$${value}`,
        goals,
        monthlyGoal: 120000,
        priorityCount: 0,
        totalProgress: 5,
      }),
      [
        {
          label: "Monthly commitment",
          status: "Review assumptions",
          value: "$120000",
        },
        {
          label: "Funded today",
          status: "Early stage",
          value: "5%",
        },
        {
          label: "Priority coverage",
          status: "Add an essential goal",
          value: "0",
        },
        {
          label: "Nearest deadline",
          status: "Time-sensitive",
          value: "2y",
        },
        {
          label: "Stretch pressure",
          status: "Targets look realistic",
          value: "0",
        },
      ],
    );
  });
});

describe("goal scenario helpers", () => {
  it("builds scenario rows and milestone ladder", () => {
    const scenarios = getGoalScenarioRows(goals[0]);
    const milestones = getGoalMilestones(goals[0]);

    assert.equal(scenarios.length, 3);
    assert.equal(scenarios[0]?.label, "Conservative");
    assert.ok((scenarios[0]?.monthly ?? 0) >= (scenarios[2]?.monthly ?? 0));

    assert.equal(milestones.length, 4);
    assert.equal(milestones[0]?.label, "25% funded");
    assert.equal(milestones[3]?.targetAmount, 100000);
  });
});
