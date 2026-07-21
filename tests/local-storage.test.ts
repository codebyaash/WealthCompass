import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createImportJob,
  createIntegrationConnection,
  createWealthGoal,
  defaultSnapshot,
  emptySignedInSnapshot,
  loadSnapshot,
  loadSignedInWorkspaceCache,
  parseWorkspaceImport,
  saveSignedInWorkspaceCache,
  workspaceHasMeaningfulUserData,
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
            investedValue: "130000",
            name: "Index Core",
            price: "125",
            quantity: "1200",
            source: "Imported",
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
        integrations: [
          {
            channel: "broker",
            id: "integration-1",
            importStrategy: "statement-upload",
            lastDetectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
            lastImportedFileCount: "2",
            lastSyncAt: "2026-07-10T00:00:00.000Z",
            lastSyncMessage: "Latest statement review completed.",
            lastSyncStatus: "success",
            notes: "Tracked source",
            providerId: "paytm-money",
            providerName: "Paytm Money",
            sourceHint: "Upload broker statements",
            status: "active",
            syncHistory: [
              {
                detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
                id: "sync-1",
                importedFileCount: "2",
                message: "Latest statement review completed.",
                status: "success",
                syncedAt: "2026-07-10T00:00:00.000Z",
              },
            ],
            syncCadenceMinutes: "60",
          },
        ],
        marketPreferences: {
          autoRefresh: true,
          includeHoldingsWatch: false,
          pollingIntervalSeconds: "120",
          preferredSource: "fallback",
        },
        transactions: [
          {
            action: "buy",
            amount: "25000",
            assetName: "Index Core",
            date: "2026-07-10",
            id: "txn-1",
            notes: "Imported lot",
            price: "125",
            quantity: "200",
            source: "Imported",
            type: "Index Fund",
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
    assert.equal(result.data?.assets[0].investedValue, 130000);
    assert.equal(result.data?.goals[0].priority, "essential");
    assert.equal(result.data?.integrations[0].providerId, "paytm-money");
    assert.equal(result.data?.integrations[0].lastImportedFileCount, 2);
    assert.equal(result.data?.integrations[0].lastSyncStatus, "success");
    assert.equal(result.data?.integrations[0].syncHistory[0].importedFileCount, 2);
    assert.equal(result.data?.importJobs.length, defaultSnapshot.importJobs.length);
    assert.equal(result.data?.marketPreferences.preferredSource, "fallback");
    assert.equal(result.data?.marketPreferences.pollingIntervalSeconds, 120);
    assert.equal(result.data?.transactions[0].assetName, "Index Core");
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
    assert.equal(result.data?.integrations.length, defaultSnapshot.integrations.length);
    assert.equal(
      result.data?.marketPreferences.pollingIntervalSeconds,
      defaultSnapshot.marketPreferences.pollingIntervalSeconds,
    );
    assert.equal(result.data?.transactions.length, 0);
    assert.equal(result.data?.riskHistory.length, 0);
  });

  it("reports invalid JSON and missing required sections", () => {
    assert.deepEqual(parseWorkspaceImport("{").errors, ["JSON is not valid."]);

    const result = parseWorkspaceImport(JSON.stringify({ answers: defaultSnapshot.answers }));

    assert.ok(result.errors.includes("Missing or invalid portfolio assets."));
    assert.ok(result.errors.includes("Missing or invalid goals."));
  });
});

describe("createIntegrationConnection", () => {
  it("creates an editable integration record with overrides", () => {
    const connection = createIntegrationConnection({
      providerId: "gmail",
      providerName: "Gmail",
      status: "active",
    });

    assert.equal(connection.providerName, "Gmail");
    assert.equal(connection.lastSchedulerStatus, "idle");
    assert.equal(connection.lastSyncOrigin, null);
    assert.equal(connection.lastSyncStatus, "idle");
    assert.deepEqual(connection.syncHistory, []);
    assert.equal(connection.status, "active");
    assert.ok(connection.id.length > 0);
  });
});

describe("createImportJob", () => {
  it("creates an import job with sensible defaults", () => {
    const job = createImportJob({
      fileName: "statement.pdf",
      providerName: "CAMS",
      status: "reviewed",
    });

    assert.equal(job.fileName, "statement.pdf");
    assert.equal(job.documentId.length > 0, true);
    assert.equal(job.documentStoragePath, null);
    assert.deepEqual(job.normalizationApplied, []);
    assert.equal(job.normalizedText, "");
    assert.equal(job.providerName, "CAMS");
    assert.deepEqual(job.reviewedCorrections, []);
    assert.deepEqual(job.rowWarnings, []);
    assert.equal(job.status, "reviewed");
    assert.equal(job.rawText, "");
    assert.ok(job.id.length > 0);
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

describe("signed-in workspace cache", () => {
  it("stores and restores a user-scoped workspace cache entry", () => {
    const storage = new Map<string, string>();
    const previousWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem(key: string) {
            return storage.get(key) ?? null;
          },
          removeItem(key: string) {
            storage.delete(key);
          },
          setItem(key: string, value: string) {
            storage.set(key, value);
          },
        },
      },
    });

    try {
      saveSignedInWorkspaceCache({
        riskHistory: [
          {
            band: "Balanced",
            confidence: "Getting ready",
            createdAt: "2026-07-15T00:00:00.000Z",
            id: "risk-1",
            personality: "Steady Explorer",
            score: 54,
            summary: "Saved locally.",
          },
        ],
        snapshot: {
          ...emptySignedInSnapshot,
          answers: {
            ...emptySignedInSnapshot.answers,
            country: "India",
          },
          goals: [
            {
              annualReturn: 10,
              currentAmount: 50000,
              id: "goal-1",
              name: "House",
              priority: "important",
              targetAmount: 500000,
              years: 4,
            },
          ],
        },
        userId: "user-1",
      });

      const cached = loadSignedInWorkspaceCache("user-1");

      assert.equal(cached?.snapshot.answers.country, "India");
      assert.equal(cached?.snapshot.goals[0]?.name, "House");
      assert.equal(cached?.riskHistory[0]?.personality, "Steady Explorer");
      assert.equal(cached?.userId, "user-1");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});

describe("loadSnapshot", () => {
  it("uses the provided clean fallback when storage is empty", () => {
    const storage = new Map<string, string>();
    const previousWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem(key: string) {
            return storage.get(key) ?? null;
          },
          removeItem(key: string) {
            storage.delete(key);
          },
          setItem(key: string, value: string) {
            storage.set(key, value);
          },
        },
      },
    });

    try {
      const snapshot = loadSnapshot(emptySignedInSnapshot);

      assert.deepEqual(snapshot, emptySignedInSnapshot);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });

  it("keeps sparse auth-aware snapshots clean instead of backfilling demo sections", () => {
    const storage = new Map<string, string>();
    const previousWindow = globalThis.window;

    storage.set(
      "wealthcompass:snapshot:v1",
      JSON.stringify({
        answers: {
          ...emptySignedInSnapshot.answers,
          country: "India",
        },
      }),
    );

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem(key: string) {
            return storage.get(key) ?? null;
          },
          removeItem(key: string) {
            storage.delete(key);
          },
          setItem(key: string, value: string) {
            storage.set(key, value);
          },
        },
      },
    });

    try {
      const snapshot = loadSnapshot(emptySignedInSnapshot);

      assert.equal(snapshot.answers.country, "India");
      assert.deepEqual(snapshot.assets, []);
      assert.deepEqual(snapshot.goals, []);
      assert.deepEqual(snapshot.integrations, []);
      assert.deepEqual(snapshot.importJobs, []);
      assert.deepEqual(snapshot.transactions, []);
      assert.deepEqual(snapshot.marketPreferences, emptySignedInSnapshot.marketPreferences);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});

describe("workspaceHasMeaningfulUserData", () => {
  it("returns false for the empty signed-in baseline", () => {
    assert.equal(workspaceHasMeaningfulUserData(emptySignedInSnapshot, []), false);
  });

  it("returns true when profile answers differ from the empty baseline", () => {
    assert.equal(
      workspaceHasMeaningfulUserData(
        {
          ...emptySignedInSnapshot,
          answers: {
            ...emptySignedInSnapshot.answers,
            monthlyInvestment: emptySignedInSnapshot.answers.monthlyInvestment + 500,
          },
        },
        [],
      ),
      true,
    );
  });
});
