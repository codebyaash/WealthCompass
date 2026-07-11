import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendIntegrationSyncEvent,
  buildIntegrationSyncTelemetry,
  buildIntegrationSchedulerPlan,
  createIntegrationSyncEvent,
  createSyncImportJob,
  formatSyncTimeLabel,
  getConnectorAttentionSummary,
  getIntegrationHealthMetrics,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
} from "../lib/integration-sync";
import type { IntegrationConnection } from "../lib/local-storage";

const activeConnection: IntegrationConnection = {
  channel: "broker",
  id: "integration-paytm-money",
  importStrategy: "statement-upload",
  lastDetectedProviderSummary: "",
  lastImportedFileCount: 0,
  lastSyncAt: "2026-07-11T08:00:00.000Z",
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

describe("integration sync helpers", () => {
  it("calculates the next sync timestamp from cadence", () => {
    assert.equal(
      getNextIntegrationSyncAt(activeConnection, new Date("2026-07-11T09:00:00.000Z")),
      "2026-07-11T10:00:00.000Z",
    );
  });

  it("flags overdue and paused connections clearly", () => {
    assert.deepEqual(
      getIntegrationSyncState(activeConnection, new Date("2026-07-11T11:30:00.000Z")),
      {
        detail: "Overdue by 90 min.",
        label: "Due now",
        tone: "attention",
      },
    );

    assert.deepEqual(
      getIntegrationSyncState({
        ...activeConnection,
        status: "paused",
      }),
      {
        detail: "Sync is paused until you resume this source.",
        label: "Paused",
        tone: "idle",
      },
    );
  });

  it("creates an import job from a scheduled sync checkpoint", () => {
    const job = createSyncImportJob(activeConnection, new Date("2026-07-11T10:15:00.000Z"));

    assert.equal(job.providerId, "paytm-money");
    assert.equal(job.providerName, "Paytm Money");
    assert.equal(job.documentKind, "pdf-statement");
    assert.equal(job.status, "received");
    assert.match(job.summary, /exports|statements/i);
  });

  it("builds telemetry from a sync run", () => {
    const telemetry = buildIntegrationSyncTelemetry(
      activeConnection,
      new Date("2026-07-11T10:15:00.000Z"),
    );

    assert.equal(telemetry.lastImportedFileCount, 1);
    assert.equal(telemetry.lastSyncStatus, "success");
    assert.match(telemetry.lastSyncMessage, /statement-driven payload/i);
  });

  it("creates and appends sync events", () => {
    const event = createIntegrationSyncEvent(
      activeConnection,
      new Date("2026-07-11T10:15:00.000Z"),
    );
    const history = appendIntegrationSyncEvent(activeConnection, event);

    assert.equal(history.length, 1);
    assert.equal(history[0].status, "success");
    assert.equal(history[0].importedFileCount, 1);
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

  it("builds a scheduler plan for cron-style connector checks", () => {
    const plan = buildIntegrationSchedulerPlan(
      [
        {
          ...activeConnection,
          id: "ready-source",
          lastSyncAt: null,
          providerName: "Ready Source",
        },
        {
          ...activeConnection,
          id: "overdue-source",
          lastSyncAt: "2026-07-11T07:00:00.000Z",
          providerName: "Overdue Source",
        },
        {
          ...activeConnection,
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
});
