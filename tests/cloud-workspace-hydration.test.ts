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
      cloudUpdatedAt: null,
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
      cloudUpdatedAt: "2026-07-17T00:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cloud");
    assert.equal(result.resolvedHistory[0]?.id, "risk-1");
    assert.equal(
      result.successMessage,
      "Loaded the freshest mix of your browser and Supabase data.",
    );
  });

  it("treats connector-only cloud state as meaningful saved data", () => {
    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace: null,
      cloudHistory: [],
      cloudSnapshot: {
        ...emptySignedInSnapshot,
        integrations: [
          {
            channel: "broker",
            id: "integration-paytm",
            importStrategy: "statement-upload",
            lastDetectedProviderSummary: "",
            lastImportedFileCount: 0,
            lastSchedulerCheckAt: null,
            lastSchedulerMessage: "Scheduler has not checked this source yet.",
            lastSchedulerStatus: "idle",
            lastSyncAt: null,
            lastSyncOrigin: null,
            lastSyncMessage: "No sync has run yet.",
            lastSyncStatus: "idle",
            notes: "",
            providerId: "paytm-money",
            providerName: "Paytm Money",
            sourceHint: "Upload account statements or CSV exports first.",
            status: "active",
            syncCadenceMinutes: 720,
            syncHistory: [],
          },
        ],
      },
      cloudUpdatedAt: "2026-07-17T00:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.successMessage, "Loaded your saved Supabase data.");
  });

  it("treats risk-history-only cloud state as meaningful saved data", () => {
    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace: null,
      cloudHistory: [makeRiskHistoryItem()],
      cloudSnapshot: emptySignedInSnapshot,
      cloudUpdatedAt: "2026-07-17T00:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.successMessage, "Loaded your saved Supabase data.");
  });

  it("returns the clean-workspace copy when both cloud and cache are effectively empty", () => {
    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace: null,
      cloudHistory: [],
      cloudSnapshot: emptySignedInSnapshot,
      cloudUpdatedAt: null,
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(
      result.successMessage,
      "Signed in with a clean workspace. Add your own portfolio to begin tracking.",
    );
  });

  it("prefers the cached workspace when it is newer than the cloud snapshot", () => {
    const cachedWorkspace = {
      riskHistory: [makeRiskHistoryItem({ id: "risk-cached" })],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 40000,
            id: "goal-cached-newer",
            name: "Cached newer goal",
            priority: "important" as GoalPriority,
            targetAmount: 300000,
            years: 3,
          },
        ],
      },
      updatedAt: "2026-07-17T09:00:00.000Z",
    };
    const cloudSnapshot = {
      ...emptySignedInSnapshot,
      goals: [
        {
          annualReturn: 8,
          currentAmount: 10000,
          id: "goal-cloud-older",
          name: "Cloud older goal",
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
      cloudUpdatedAt: "2026-07-17T08:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, true);
    assert.equal(result.isCachedWorkspaceNewer, true);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cached-newer");
  });

  it("prefers the cloud workspace when it is newer than the cache", () => {
    const cachedWorkspace = {
      riskHistory: [makeRiskHistoryItem({ id: "risk-cached" })],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 40000,
            id: "goal-cached-older",
            name: "Cached older goal",
            priority: "important" as GoalPriority,
            targetAmount: 300000,
            years: 3,
          },
        ],
      },
      updatedAt: "2026-07-17T08:00:00.000Z",
    };
    const cloudSnapshot = {
      ...emptySignedInSnapshot,
      goals: [
        {
          annualReturn: 8,
          currentAmount: 10000,
          id: "goal-cloud-newer",
          name: "Cloud newer goal",
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
      cloudUpdatedAt: "2026-07-17T09:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cloud-newer");
  });

  it("treats newer cloud risk history as fresh cloud workspace data", () => {
    const cachedWorkspace = {
      riskHistory: [
        makeRiskHistoryItem({
          createdAt: "2026-07-17T08:00:00.000Z",
          id: "risk-cached",
        }),
      ],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 40000,
            id: "goal-cached",
            name: "Cached goal",
            priority: "important" as GoalPriority,
            targetAmount: 300000,
            years: 3,
          },
        ],
      },
      updatedAt: "2026-07-17T08:00:00.000Z",
    };

    const cloudHistory = [
      makeRiskHistoryItem({
        createdAt: "2026-07-17T09:30:00.000Z",
        id: "risk-cloud-newer",
      }),
    ];

    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace,
      cloudHistory,
      cloudSnapshot: emptySignedInSnapshot,
      cloudUpdatedAt: "2026-07-17T08:00:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cached");
    assert.equal(result.resolvedHistory[0]?.id, "risk-cloud-newer");
    assert.equal(
      result.successMessage,
      "Loaded the freshest mix of your browser and Supabase data.",
    );
  });

  it("keeps newer cloud snapshot data while preserving newer cached risk history", () => {
    const cachedWorkspace = {
      riskHistory: [
        makeRiskHistoryItem({
          createdAt: "2026-07-17T10:00:00.000Z",
          id: "risk-cached-newer",
        }),
      ],
      snapshot: {
        ...emptySignedInSnapshot,
        goals: [
          {
            annualReturn: 10,
            currentAmount: 10000,
            id: "goal-cached-older",
            name: "Cached goal",
            priority: "important" as GoalPriority,
            targetAmount: 300000,
            years: 3,
          },
        ],
      },
      updatedAt: "2026-07-17T08:00:00.000Z",
    };
    const cloudSnapshot = {
      ...emptySignedInSnapshot,
      goals: [
        {
          annualReturn: 8,
          currentAmount: 50000,
          id: "goal-cloud-newer",
          name: "Cloud goal",
          priority: "essential" as GoalPriority,
          targetAmount: 500000,
          years: 5,
        },
      ],
    };

    const result = resolveHydratedCloudWorkspace({
      cachedWorkspace,
      cloudHistory: [makeRiskHistoryItem({ createdAt: "2026-07-17T09:00:00.000Z", id: "risk-cloud-older" })],
      cloudSnapshot,
      cloudUpdatedAt: "2026-07-17T09:30:00.000Z",
    });

    assert.equal(result.shouldUseCachedWorkspace, false);
    assert.equal(result.resolvedSnapshot.goals[0]?.id, "goal-cloud-newer");
    assert.equal(result.resolvedHistory[0]?.id, "risk-cached-newer");
    assert.equal(
      result.successMessage,
      "Loaded the freshest mix of your browser and Supabase data.",
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
