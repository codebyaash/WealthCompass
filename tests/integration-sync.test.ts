import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIntegrationOperationsSummary,
  appendIntegrationSyncEvent,
  buildIntegrationSyncTelemetry,
  buildIntegrationSchedulerPlan,
  createIntegrationSyncEvent,
  createSyncImportJob,
  executeIntegrationSyncBatch,
  formatSyncTimeLabel,
  getConnectorAttentionSummary,
  getIntegrationAttentionItems,
  getIntegrationHealthMetrics,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
  resolveScheduledSyncUserIds,
} from "../lib/integration-sync";
import type { IntegrationConnection } from "../lib/local-storage";

const activeConnection: IntegrationConnection = {
  channel: "broker",
  id: "integration-paytm-money",
  importStrategy: "statement-upload",
  lastDetectedProviderSummary: "",
  lastImportedFileCount: 0,
  lastSchedulerCheckAt: null,
  lastSchedulerMessage: "Scheduler has not checked this source yet.",
  lastSchedulerStatus: "idle",
  lastSyncAt: "2026-07-11T08:00:00.000Z",
  lastSyncOrigin: null,
  lastSyncMessage: "No sync has run yet.",
  lastSyncStatus: "idle",
  notes: "Primary broker workflow for guided statement imports.",
  providerId: "paytm-money",
  providerName: "Paytm Money",
  sourceHint: "Upload account statements or CSV exports first.",
  status: "active",
  syncHistory: [],
  syncCadenceMinutes: 120,
};

const autoConnection: IntegrationConnection = {
  ...activeConnection,
  id: "integration-direct",
  importStrategy: "sync-ready",
  providerId: "paytm-money-direct",
  providerName: "Paytm Money Direct",
  sourceHint: "Reserve auth for direct account access.",
  syncCadenceMinutes: 120,
};

describe("integration sync helpers", () => {
  it("calculates the next sync timestamp from cadence", () => {
    assert.equal(
      getNextIntegrationSyncAt(autoConnection, new Date("2026-07-11T09:00:00.000Z")),
      "2026-07-11T10:00:00.000Z",
    );
  });

  it("flags overdue and paused connections clearly", () => {
    assert.deepEqual(
      getIntegrationSyncState(autoConnection, new Date("2026-07-11T11:30:00.000Z")),
      {
        detail: "Overdue by 90 min.",
        label: "Due now",
        tone: "attention",
      },
    );

    assert.deepEqual(
      getIntegrationSyncState({
        ...autoConnection,
        status: "paused",
      }),
      {
        detail: "Sync is paused until you resume this source.",
        label: "Paused",
        tone: "idle",
      },
    );
  });

  it("treats manual import connectors as on-demand instead of overdue", () => {
    assert.equal(
      getNextIntegrationSyncAt(
        activeConnection,
        new Date("2026-07-11T09:00:00.000Z"),
      ),
      null,
    );

    assert.deepEqual(
      getIntegrationSyncState(
        activeConnection,
        new Date("2026-07-11T11:30:00.000Z"),
      ),
      {
        detail: "Last import activity 210 min ago.",
        label: "On demand",
        tone: "healthy",
      },
    );

    assert.deepEqual(
      getIntegrationSyncState({
        ...activeConnection,
        lastSyncAt: null,
      }),
      {
        detail: "Runs when you upload a fresh statement.",
        label: "On demand",
        tone: "idle",
      },
    );
  });

  it("creates an import job from a scheduled sync checkpoint", () => {
    const job = createSyncImportJob(autoConnection, new Date("2026-07-11T10:15:00.000Z"));

    assert.equal(job.providerId, "paytm-money-direct");
    assert.equal(job.providerName, "Paytm Money Direct");
    assert.equal(job.documentKind, "table-export");
    assert.equal(job.status, "received");
    assert.match(job.summary, /direct|auth|fetch/i);
  });

  it("builds telemetry from a sync run", () => {
    const telemetry = buildIntegrationSyncTelemetry(
      autoConnection,
      new Date("2026-07-11T10:15:00.000Z"),
    );

    assert.equal(telemetry.lastImportedFileCount, 0);
    assert.equal(telemetry.lastSyncStatus, "warning");
    assert.match(telemetry.lastSyncMessage, /direct-sync lane|auth is still pending/i);
  });

  it("creates and appends sync events", () => {
    const event = createIntegrationSyncEvent(
      autoConnection,
      new Date("2026-07-11T10:15:00.000Z"),
    );
    const history = appendIntegrationSyncEvent(activeConnection, event);

    assert.equal(history.length, 1);
    assert.equal(history[0].status, "warning");
    assert.equal(history[0].importedFileCount, 0);
  });

  it("aggregates connector health metrics from sync history", () => {
    const metrics = getIntegrationHealthMetrics({
      ...activeConnection,
      syncHistory: [
        {
          detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
          id: "sync-warning",
          importedFileCount: 0,
          message: "Connector auth is still pending.",
          status: "warning",
          syncedAt: "2026-07-11T11:00:00.000Z",
        },
        {
          detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
          id: "sync-success-2",
          importedFileCount: 2,
          message: "Reviewed 2 import inputs through the guided pipeline.",
          status: "success",
          syncedAt: "2026-07-11T10:00:00.000Z",
        },
        {
          detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
          id: "sync-success-1",
          importedFileCount: 1,
          message: "Reviewed 1 import input through the guided pipeline.",
          status: "success",
          syncedAt: "2026-07-11T09:00:00.000Z",
        },
      ],
    });

    assert.equal(metrics.totalRuns, 3);
    assert.equal(metrics.successRate, 67);
    assert.equal(metrics.averageImportedFiles, 1);
    assert.equal(metrics.warningStreak, 1);
    assert.equal(metrics.lastHealthySyncAt, "2026-07-11T10:00:00.000Z");
  });

  it("prioritizes connector attention summaries", () => {
    const summary = getConnectorAttentionSummary([
      {
        ...activeConnection,
        syncHistory: [
          {
            detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
            id: "sync-warning",
            importedFileCount: 0,
            message: "Connector auth is still pending.",
            status: "warning",
            syncedAt: "2026-07-11T11:00:00.000Z",
          },
          {
            detectedProviderSummary: "Paytm Money guided import path is available for statement PDFs and exports.",
            id: "sync-warning-2",
            importedFileCount: 0,
            message: "Second warning.",
            status: "warning",
            syncedAt: "2026-07-11T10:00:00.000Z",
          },
        ],
      },
    ]);

    assert.equal(summary.badge, "Attention");
    assert.equal(summary.actionView, "settings");
    assert.equal(summary.severity, "warning");
  });

  it("formats next-sync timing labels for the UI", () => {
    assert.equal(
      formatSyncTimeLabel(
        "2026-07-11T10:45:00.000Z",
        new Date("2026-07-11T10:15:00.000Z"),
      ),
      "In 30 min",
    );
    assert.equal(
      formatSyncTimeLabel(
        "2026-07-11T12:15:00.000Z",
        new Date("2026-07-11T10:15:00.000Z"),
      ),
      "In 2h",
    );
  });

  it("builds a compact operations summary for settings", () => {
    const summary = buildIntegrationOperationsSummary(
      [
        {
          ...autoConnection,
          id: "due-source",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
        },
        {
          ...activeConnection,
          id: "manual-source",
        },
        {
          ...activeConnection,
          id: "paused-source",
          status: "paused",
        },
      ],
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.deepEqual(summary, {
      activeCount: 2,
      attentionCount: 1,
      autoCount: 1,
      dueNowCount: 1,
      manualCount: 1,
      pausedCount: 1,
    });
  });

  it("lists the highest-priority attention items first", () => {
    const items = getIntegrationAttentionItems(
      [
        {
          ...autoConnection,
          id: "warning-source",
          providerName: "Warning Source",
          syncHistory: [
            {
              detectedProviderSummary: "",
              id: "warn-1",
              importedFileCount: 0,
              message: "Recent warning",
              status: "warning",
              syncedAt: "2026-07-11T10:00:00.000Z",
            },
            {
              detectedProviderSummary: "",
              id: "warn-2",
              importedFileCount: 0,
              message: "Older warning",
              status: "warning",
              syncedAt: "2026-07-11T09:00:00.000Z",
            },
          ],
        },
        {
          ...autoConnection,
          id: "error-source",
          providerName: "Error Source",
          status: "error",
        },
      ],
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.equal(items[0]?.providerName, "Error Source");
    assert.equal(items[0]?.severity, "error");
    assert.equal(items[1]?.statusLabel, "Due now");
  });

  it("builds a scheduler plan for cron-style connector checks", () => {
    const plan = buildIntegrationSchedulerPlan(
      [
        {
          ...activeConnection,
          ...autoConnection,
          id: "ready-source",
          lastSyncAt: null,
          providerName: "Ready Source",
        },
        {
          ...autoConnection,
          id: "overdue-source",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
          providerName: "Overdue Source",
        },
        {
          ...autoConnection,
          id: "future-source",
          lastSyncAt: "2026-07-11T09:30:00.000Z",
          providerName: "Future Source",
        },
        {
          ...activeConnection,
          id: "paused-source",
          providerName: "Paused Source",
          status: "paused",
        },
      ],
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.equal(plan.activeCount, 3);
    assert.equal(plan.dueCount, 2);
    assert.equal(plan.pausedCount, 1);
    assert.equal(plan.readyCount, 1);
    assert.deepEqual(
      plan.entries.filter((entry) => entry.shouldRunNow).map((entry) => entry.id),
      ["overdue-source", "ready-source"],
    );
    assert.equal(plan.nextRunAt, "2026-07-11T09:00:00.000Z");
  });

  it("executes only due connectors when running a scheduled batch", () => {
    const result = executeIntegrationSyncBatch(
      [
        {
          ...activeConnection,
          ...autoConnection,
          id: "due-source",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
          providerName: "Due Source",
        },
        {
          ...autoConnection,
          id: "future-source",
          lastSyncAt: "2026-07-11T09:45:00.000Z",
          providerName: "Future Source",
        },
        {
          ...activeConnection,
          id: "paused-source",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
          providerName: "Paused Source",
          status: "paused",
        },
      ],
      {
        importJobs: [],
        mode: "due",
        now: new Date("2026-07-11T10:00:00.000Z"),
        origin: "scheduled",
      },
    );

    assert.deepEqual(result.syncedConnectionIds, ["due-source"]);
    assert.deepEqual(result.skippedConnectionIds, []);
    assert.equal(result.importJobs.length, 1);
    assert.equal(result.importJobs[0].providerName, "Due Source");
    assert.equal(result.integrations[0].lastSyncOrigin, "scheduled");
    assert.equal(result.integrations[0].lastSchedulerCheckAt, "2026-07-11T10:00:00.000Z");
    assert.equal(result.integrations[0].lastSchedulerStatus, "success");
    assert.equal(result.integrations[0].lastSyncAt, "2026-07-11T10:00:00.000Z");
    assert.equal(result.integrations[0].syncHistory.length, 1);
    assert.equal(result.integrations[1].lastSchedulerCheckAt, "2026-07-11T10:00:00.000Z");
    assert.equal(result.integrations[1].lastSchedulerStatus, "idle");
    assert.equal(result.integrations[1].lastSyncAt, "2026-07-11T09:45:00.000Z");
  });

  it("does not schedule statement-upload connectors in due batches", () => {
    const result = executeIntegrationSyncBatch(
      [
        {
          ...activeConnection,
          id: "manual-groww",
          importStrategy: "statement-upload",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
          providerName: "Groww",
        },
      ],
      {
        importJobs: [],
        mode: "due",
        now: new Date("2026-07-11T10:00:00.000Z"),
        origin: "scheduled",
      },
    );

    assert.deepEqual(result.syncedConnectionIds, []);
    assert.equal(result.importJobs.length, 0);
    assert.equal(result.integrations[0].lastSchedulerStatus, "idle");
  });

  it("merges configured and requested user IDs for scheduled syncs", () => {
    const userIds = resolveScheduledSyncUserIds(
      [" user-1 ", "user-2"],
      "user-2, user-3, , user-1",
    );

    assert.deepEqual(userIds, ["user-1", "user-2", "user-3"]);
  });
});
