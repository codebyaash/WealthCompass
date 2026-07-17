import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCloudHydrationLoadingMessage,
  resolveHydratedCloudWorkspace,
  shouldRestoreCachedWorkspaceAfterCloudError,
} from "../lib/cloud-workspace-hydration";
import {
  emptySignedInSnapshot,
  type GoalPriority,
  type PortfolioTransaction,
  type RiskHistoryItem,
} from "../lib/local-storage";

function makeRiskHistoryItem(overrides: Partial<RiskHistoryItem> = {}): RiskHistoryItem {
  return {
    band: "Balanced",
    confidence: "Getting ready",
    createdAt: "2026-07-17T00:00:00.000Z",
    id: "risk-1",
    personality: "Steady Explorer",
    score: 54,
    summary: "Saved profile.",
    ...overrides,
  };
}

describe("getCloudHydrationLoadingMessage", () => {
  it("uses the cached-workspace loading copy when cache is meaningful", () => {
    const message = getCloudHydrationLoadingMessage({
      riskHistory: [makeRiskHistoryItem()],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 25000,
            id: "goal-1",
            name: "Emergency fund",
            priority: "important",
            targetAmount: 100000,
            years: 2,
          },
        ],
      },
    });

    assert.equal(message, "Showing your last saved browser copy while cloud data loads.");
  });

  it("uses the plain cloud-loading copy when there is no meaningful cache", () => {
    assert.equal(
      getCloudHydrationLoadingMessage(null),
      "Loading your Supabase workspace.",
    );
  });
});

describe("resolveHydratedCloudWorkspace", () => {
  it("prefers the cached workspace when cloud comes back effectively empty", () => {
    const cachedWorkspace = {
      riskHistory: [makeRiskHistoryItem()],
      snapshot: {
        ...emptySignedInSnapshot,
        transactions: [
          {
            action: "buy" as PortfolioTransaction["action"],
            amount: 1000,
            assetName: "Index Fund",
            date: "2026-07-16",
            id: "txn-1",
            notes: "",
            price: 100,
            quantity: 10,
            source: "Manual",
            type: "Index Fund",
          },
        ] satisfies PortfolioTransaction[],
      },
    };

    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace,
      cloudHistory: [],
      cloudSnapshot: emptySignedInSnapshot,
    });

    assert.equal(result.shouldUseCachedWorkspace, true);
    assert.equal(result.resolvedSnapshot.transactions.length, 1);
    assert.equal(
      result.successMessage,
      "Loaded your last saved browser copy while cloud data catches up.",
    );
  });

  it("prefers cloud data when cloud returns meaningful workspace data", () => {
    const cachedWorkspace = {
      riskHistory: [makeRiskHistoryItem()],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 8,
            currentAmount: 10000,
            id: "goal-cached",
            name: "Cached goal",
            priority: "important" as GoalPriority,
            targetAmount: 200000,
            years: 4,
          },
        ],
      },
    };
    const cloudSnapshot = {
      ...emptySignedInSnapshot,
      goals: [
        {
          annualReturn: 10,
          currentAmount: 50000,
          id: "goal-cloud",
          name: "Cloud goal",
          priority: "essential" as GoalPriority,
          targetAmount: 500000,
          years: 5,
        },
      ],
    };

    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace,
      cloudHistory: [],
      cloudSnapshot,
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cloud");
    assert.equal(result.successMessage, "Loaded your saved Supabase data.");
  });

  it("returns the clean-workspace copy when both cloud and cache are effectively empty", () => {
    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace: null,
      cloudHistory: [],
      cloudSnapshot: emptySignedInSnapshot,
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(
      result.successMessage,
      "Signed in with a clean workspace. Add your own portfolio to begin tracking.",
    );
  });
});

describe("shouldRestoreCachedWorkspaceAfterCloudError", () => {
  it("returns true when the cached workspace has meaningful user data", () => {
    assert.equal(
      shouldRestoreCachedWorkspaceAfterCloudError({
        riskHistory: [],
        snapshot: {
          ...emptySignedInSnapshot,
          answers: {
            ...emptySignedInSnapshot.answers,
            monthlyInvestment: emptySignedInSnapshot.answers.monthlyInvestment + 1000,
          },
        },
      }),
      true,
    );
  });

  it("returns false for an empty cached workspace", () => {
    assert.equal(
      shouldRestoreCachedWorkspaceAfterCloudError({
        riskHistory: [],
        snapshot: emptySignedInSnapshot,
      }),
      false,
    );
  });
});
