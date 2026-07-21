import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDashboardConnectorKpis,
  getDashboardConnectorRecovery,
  getDashboardConnectorActions,
} from "../lib/integration-sync";
import type { IntegrationConnection } from "../lib/local-storage";

function makeIntegration(
  overrides: Partial<IntegrationConnection> & Pick<IntegrationConnection, "id" | "providerId" | "providerName">,
): IntegrationConnection {
  return {
    channel: "broker",
    importStrategy: "statement-upload",
    lastDetectedProviderSummary: "",
    lastImportedFileCount: 0,
    lastSchedulerCheckAt: null,
    lastSchedulerMessage: "",
    lastSchedulerStatus: "idle",
    lastSyncAt: null,
    lastSyncOrigin: null,
    lastSyncMessage: "",
    lastSyncStatus: "idle",
    notes: "",
    sourceHint: "",
    status: "active",
    syncCadenceMinutes: 60,
    syncHistory: [],
    ...overrides,
  };
}

describe("getDashboardConnectorActions", () => {
  it("surfaces the highest-priority connector follow-ups first", () => {
    const actions = getDashboardConnectorActions(
      [
        makeIntegration({
          id: "paytm",
          providerId: "paytm-money",
          providerName: "Paytm Money",
        }),
        makeIntegration({
          id: "zerodha",
          providerId: "zerodha",
          providerName: "Zerodha",
          importStrategy: "sync-ready",
          lastSyncAt: "2026-07-17T09:00:00.000Z",
        }),
      ],
      new Date("2026-07-17T12:00:00.000Z"),
    );

    assert.equal(actions.length > 0, true);
    assert.equal(actions[0]?.providerName, "Zerodha");
    assert.match(actions[0]?.label ?? "", /run connector now|connect live sync/i);
    assert.equal(actions[0]?.providerId, "zerodha");
    assert.equal(actions[0]?.importStrategy, "sync-ready");
  });
});

describe("buildDashboardConnectorKpis", () => {
  it("returns provider KPI rows in priority order for the selected filter", () => {
    const rows = buildDashboardConnectorKpis(
      [
        makeIntegration({
          id: "manual-paytm",
          providerId: "paytm-money",
          providerName: "Paytm Money",
          syncHistory: [
            {
              detectedProviderSummary: "Paytm Money guided import path is available.",
              id: "manual-sync-1",
              importedFileCount: 1,
              message: "Statement review applied successfully.",
              status: "success",
              syncedAt: "2026-07-17T09:00:00.000Z",
            },
          ],
        }),
        makeIntegration({
          id: "due-zerodha",
          providerId: "zerodha",
          providerName: "Zerodha",
          importStrategy: "sync-ready",
          lastSyncAt: "2026-07-17T08:00:00.000Z",
          syncHistory: [
            {
              detectedProviderSummary: "Direct sync remains staged until live auth is ready.",
              id: "zerodha-warning-1",
              importedFileCount: 0,
              message: "Recent live check needs follow-up.",
              status: "warning",
              syncedAt: "2026-07-17T08:00:00.000Z",
            },
          ],
        }),
      ],
      {
        filter: "due",
        now: new Date("2026-07-17T12:00:00.000Z"),
      },
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.providerName, "Zerodha");
    assert.equal(rows[0]?.syncLabel, "Due now");
    assert.equal(rows[0]?.tone, "attention");
    assert.match(rows[0]?.healthySignal ?? "", /last healthy run|no completed healthy run yet/i);
    assert.match(rows[0]?.currentIssue ?? "", /due|review|drifts further|recent live check/i);
  });

  it("uses workflow-aware summaries for staged manual reviews", () => {
    const rows = buildDashboardConnectorKpis(
      [
        makeIntegration({
          id: "paytm-staged",
          lastImportedFileCount: 1,
          lastSyncAt: "2026-07-17T09:00:00.000Z",
          lastSyncMessage:
            "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
          lastSyncOrigin: "manual",
          lastSyncStatus: "success",
          providerId: "paytm-money",
          providerName: "Paytm Money",
        }),
      ],
      {
        now: new Date("2026-07-18T12:00:00.000Z"),
      },
    );

    assert.equal(rows[0]?.syncLabel, "Review staged");
    assert.match(rows[0]?.healthySignal ?? "", /staged and ready|ready for a final apply/i);
    assert.match(rows[0]?.currentIssue ?? "", /waiting in history|final apply/i);
  });

  it("uses workflow-aware summaries for auth-pending live connectors", () => {
    const rows = buildDashboardConnectorKpis(
      [
        makeIntegration({
          id: "zerodha-auth",
          importStrategy: "sync-ready",
          providerId: "zerodha",
          providerName: "Zerodha",
        }),
      ],
      {
        now: new Date("2026-07-18T12:00:00.000Z"),
      },
    );

    assert.equal(rows[0]?.syncLabel, "Auth pending");
    assert.match(rows[0]?.healthySignal ?? "", /no completed healthy run yet/i);
    assert.match(rows[0]?.currentIssue ?? "", /direct auth is still pending|first live holdings check/i);
  });
});

describe("getDashboardConnectorRecovery", () => {
  it("recommends a provider-aware recovery move for recent connector errors", () => {
    const recovery = getDashboardConnectorRecovery(
      makeIntegration({
        id: "paytm",
        providerId: "paytm-money",
        providerName: "Paytm Money",
        lastSyncAt: "2026-07-17T09:00:00.000Z",
        lastSyncMessage: "Latest statement import failed and needs another review pass.",
        lastSyncStatus: "error",
      }),
      new Date("2026-07-17T12:00:00.000Z"),
    );

    assert.match(
      recovery.label,
      /retry with fresh statement|retry guided import|upload latest statement|import latest statement/i,
    );
    assert.match(recovery.detail, /statement|import/i);
  });

  it("routes staged manual reviews toward import history", () => {
    const recovery = getDashboardConnectorRecovery(
      makeIntegration({
        id: "paytm-staged",
        lastImportedFileCount: 1,
        lastSyncAt: "2026-07-17T09:00:00.000Z",
        lastSyncMessage:
          "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
        lastSyncOrigin: "manual",
        lastSyncStatus: "success",
        providerId: "paytm-money",
        providerName: "Paytm Money",
      }),
      new Date("2026-07-17T12:00:00.000Z"),
    );

    assert.equal(recovery.actionId, "review-import-history");
    assert.match(recovery.label, /open staged review|review import history/i);
    assert.match(recovery.detail, /import history|staged/i);
  });
});
