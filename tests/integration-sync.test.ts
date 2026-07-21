import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConnectorActivityFeed,
  buildConnectorActivitySummary,
  buildIntegrationDiagnosticsSummary,
  buildIntegrationOperationsSummary,
  appendIntegrationSyncEvent,
  buildIntegrationSyncTelemetry,
  buildIntegrationSchedulerPlan,
  createIntegrationSyncEvent,
  createSyncImportJob,
  executeIntegrationSyncBatch,
  formatSyncTimeLabel,
  getAutoOpenIntegrationAction,
  getConnectorAttentionSummary,
  getIntegrationActionItems,
  getIntegrationAttentionItems,
  getIntegrationHealthMetrics,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
  recordManualIntegrationReview,
  resolveScheduledSyncUserIds,
} from "../lib/integration-sync";
import { executeProviderSync } from "../lib/provider-sync-adapters";
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
        detail: "Live sync lane is paused until you resume this source.",
        label: "Paused",
        tone: "idle",
      },
    );
  });

  it("marks recent connector failures as retry-needed states", () => {
    assert.deepEqual(
      getIntegrationSyncState(
        {
          ...autoConnection,
          lastSyncAt: "2026-07-11T10:45:00.000Z",
          lastSyncMessage: "Latest live holdings check failed.",
          lastSyncStatus: "error",
        },
        new Date("2026-07-11T11:30:00.000Z"),
      ),
      {
        detail: "Latest live check failed 45 min ago. Reconnect and rerun this source before the next cadence window.",
        label: "Retry needed",
        tone: "attention",
      },
    );

    assert.deepEqual(
      getIntegrationSyncState(
        {
          ...activeConnection,
          lastSyncAt: "2026-07-11T10:45:00.000Z",
          lastSyncMessage: "Latest statement review failed.",
          lastSyncStatus: "error",
        },
        new Date("2026-07-11T11:30:00.000Z"),
      ),
      {
        detail: "Latest statement review failed 45 min ago. Upload a fresh statement or transaction summary before retrying.",
        label: "Retry needed",
        tone: "attention",
      },
    );
  });

  it("treats manual import connectors as review lanes instead of overdue syncs", () => {
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
        detail: "Last manual source activity 210 min ago.",
        label: "Manual lane",
        tone: "healthy",
      },
    );

    assert.deepEqual(
      getIntegrationSyncState({
        ...activeConnection,
        lastSyncAt: null,
      }),
      {
        detail: "Waiting for a fresh statement or transaction summary.",
        label: "Awaiting statement",
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

  it("records staged manual sync-plan reviews on the connector", () => {
    const execution = executeProviderSync(activeConnection, {
      fileName: "statement.txt",
      sourceText:
        "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core Fund\t180000\t158000\t734.69",
    });
    const nextConnection = recordManualIntegrationReview(activeConnection, execution, {
      now: new Date("2026-07-17T10:15:00.000Z"),
      outcome: "staged",
    });

    assert.equal(nextConnection.lastSyncOrigin, "manual");
    assert.equal(nextConnection.lastSyncStatus, "success");
    assert.equal(nextConnection.lastImportedFileCount, 1);
    assert.match(nextConnection.lastSyncMessage, /staged in import history/i);
    assert.equal(nextConnection.syncHistory[0]?.status, "success");
  });

  it("records applied manual sync-plan reviews on the connector", () => {
    const execution = executeProviderSync(activeConnection, {
      fileName: "statement.txt",
      sourceText:
        "Scheme Name\tCurrent Value\tInvested Value\tUnits\nIndex Core Fund\t180000\t158000\t734.69",
    });
    const nextConnection = recordManualIntegrationReview(activeConnection, execution, {
      now: new Date("2026-07-17T10:20:00.000Z"),
      outcome: "applied",
    });

    assert.equal(nextConnection.lastSyncOrigin, "manual");
    assert.equal(nextConnection.lastSyncStatus, "success");
    assert.match(nextConnection.lastSyncMessage, /applied to the portfolio/i);
    assert.equal(nextConnection.syncHistory[0]?.importedFileCount, 1);
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

  it("builds a shared connector activity feed ordered by newest event", () => {
    const result = buildConnectorActivityFeed({
      brokerConnections: [
        {
          accessTokenExpiresAt: null,
          accountLabel: "Ash Zerodha",
          createdAt: "2026-07-17T08:00:00.000Z",
          errorMessage: "",
          externalAccountId: "zerodha-1",
          lastSyncedAt: "2026-07-17T09:15:00.000Z",
          metadata: {
            syncHistory: [
              {
                id: "broker-1",
                importedFileCount: 4,
                message: "Zerodha holdings sync completed with 4 live holdings.",
                status: "success",
                syncedAt: "2026-07-17T09:15:00.000Z",
              },
            ],
          },
          provider: "zerodha",
          scopes: [],
          status: "connected",
          updatedAt: "2026-07-17T09:15:00.000Z",
        },
      ],
      inboxConnections: [
        {
          accessTokenExpiresAt: null,
          createdAt: "2026-07-17T06:00:00.000Z",
          errorMessage: "",
          externalAccountId: "gmail-1",
          lastMessageAt: "2026-07-17T09:40:00.000Z",
          lastSyncedAt: "2026-07-17T09:45:00.000Z",
          metadata: {
            syncHistory: [
              {
                fetchedMessageCount: 2,
                id: "inbox-1",
                importedFileCount: 1,
                message: "Imported the latest statement email into the review queue.",
                status: "success",
                syncedAt: "2026-07-17T09:45:00.000Z",
              },
            ],
          },
          provider: "gmail",
          providerAccountEmail: "user@gmail.com",
          scopes: [],
          status: "connected",
          syncCursor: null,
          updatedAt: "2026-07-17T09:45:00.000Z",
        },
      ],
      integrations: [
        {
          ...activeConnection,
          syncHistory: [
            {
              detectedProviderSummary: "Paytm Money guided import path is available.",
              id: "manual-1",
              importedFileCount: 1,
              message: "Sync plan reviewed and applied to the portfolio.",
              status: "success",
              syncedAt: "2026-07-17T09:30:00.000Z",
            },
          ],
        },
      ],
    });

    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((item) => [item.id, item.sourceType]),
      [
        ["inbox-1", "inbox"],
        ["manual-1", "manual"],
        ["broker-1", "broker"],
      ],
    );
    assert.equal(result[0]?.fetchedMessageCount, 2);
    assert.equal(result[1]?.fetchedMessageCount, null);
    assert.equal(result[2]?.providerName, "Ash Zerodha");
  });

  it("limits the shared connector activity feed", () => {
    const result = buildConnectorActivityFeed({
      integrations: [
        {
          ...activeConnection,
          syncHistory: [
            {
              detectedProviderSummary: "first",
              id: "manual-1",
              importedFileCount: 1,
              message: "First",
              status: "success",
              syncedAt: "2026-07-17T09:30:00.000Z",
            },
            {
              detectedProviderSummary: "second",
              id: "manual-2",
              importedFileCount: 1,
              message: "Second",
              status: "warning",
              syncedAt: "2026-07-17T09:00:00.000Z",
            },
          ],
        },
      ],
      limit: 1,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "manual-1");
  });

  it("builds a compact summary from mixed connector activity", () => {
    const summary = buildConnectorActivitySummary([
      {
        fetchedMessageCount: 2,
        id: "inbox-1",
        importedFileCount: 1,
        message: "Imported the latest statement email into the review queue.",
        providerId: "gmail",
        providerName: "Gmail",
        sourceType: "inbox",
        status: "success",
        syncedAt: "2026-07-17T09:45:00.000Z",
      },
      {
        fetchedMessageCount: null,
        id: "manual-1",
        importedFileCount: 2,
        message: "Sync plan reviewed and staged in import history.",
        providerId: "paytm-money",
        providerName: "Paytm Money",
        sourceType: "manual",
        status: "warning",
        syncedAt: "2026-07-17T09:30:00.000Z",
      },
      {
        fetchedMessageCount: null,
        id: "broker-1",
        importedFileCount: 4,
        message: "Zerodha holdings sync completed with 4 live holdings.",
        providerId: "zerodha",
        providerName: "Ash Zerodha",
        sourceType: "broker",
        status: "error",
        syncedAt: "2026-07-17T09:15:00.000Z",
      },
    ]);

    assert.deepEqual(summary, {
      brokerEventCount: 1,
      errorCount: 1,
      inboxEventCount: 1,
      lastSyncedAt: "2026-07-17T09:45:00.000Z",
      manualEventCount: 1,
      successCount: 1,
      totalImportedFiles: 7,
      warningCount: 1,
    });
  });

  it("builds connector diagnostics summaries with fallback cues and ordered timeline events", () => {
    const summary = buildIntegrationDiagnosticsSummary({
      ...activeConnection,
      lastDetectedProviderSummary: "",
      lastSchedulerMessage: "",
      syncHistory: [
        {
          detectedProviderSummary: "",
          id: "older-warning",
          importedFileCount: 0,
          message: "Warning run",
          status: "warning",
          syncedAt: "2026-07-11T09:00:00.000Z",
        },
        {
          detectedProviderSummary: "Paytm Money guided import path is available.",
          id: "latest-success",
          importedFileCount: 2,
          message: "Latest review succeeded.",
          status: "success",
          syncedAt: "2026-07-11T10:00:00.000Z",
        },
      ],
    });

    assert.match(summary.providerCue, /No provider cue recorded yet/i);
    assert.match(summary.schedulerCue, /Scheduler has not recorded a note/i);
    assert.equal(summary.timeline.length, 2);
    assert.equal(summary.timeline[0]?.id, "latest-success");
    assert.equal(summary.timeline[0]?.statusLabel, "Healthy");
    assert.equal(summary.timeline[0]?.importedFileLabel, "2 files");
    assert.equal(
      summary.timeline[0]?.detectedProviderSummary,
      "Paytm Money guided import path is available.",
    );
    assert.equal(summary.timeline[1]?.statusLabel, "Warning");
    assert.equal(summary.timeline[1]?.importedFileLabel, "No imports");
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

  it("builds provider-aware next actions for statement-driven sources", () => {
    const items = getIntegrationActionItems(
      {
        ...activeConnection,
        providerId: "paytm-money",
        providerName: "Paytm Money",
      },
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.equal(items[0]?.label, "Upload latest statement");
    assert.match(items[0]?.detail ?? "", /transaction summary|SIP activity|Paytm Money/i);
  });

  it("builds provider-aware next actions for sync-ready live connectors", () => {
    const items = getIntegrationActionItems(
      {
        ...autoConnection,
        providerId: "zerodha",
        providerName: "Zerodha",
        lastSyncAt: null,
      },
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.equal(items[0]?.label, "Connect live sync");
    assert.equal(items[1]?.label, "Run first check");
  });

  it("prioritizes retry actions after recent connector failures", () => {
    const liveItems = getIntegrationActionItems(
      {
        ...autoConnection,
        lastSyncAt: "2026-07-11T10:45:00.000Z",
        lastSyncStatus: "error",
        providerId: "zerodha",
        providerName: "Zerodha",
      },
      new Date("2026-07-11T11:30:00.000Z"),
    );

    assert.equal(liveItems[0]?.label, "Retry live check");

    const manualItems = getIntegrationActionItems(
      {
        ...activeConnection,
        lastSyncAt: "2026-07-11T10:45:00.000Z",
        lastSyncStatus: "error",
        providerId: "paytm-money",
        providerName: "Paytm Money",
      },
      new Date("2026-07-11T11:30:00.000Z"),
    );

    assert.equal(manualItems[0]?.label, "Retry with fresh statement");
  });

  it("adds inbox guidance for email-forward connectors", () => {
    const items = getIntegrationActionItems(
      {
        ...activeConnection,
        channel: "email",
        importStrategy: "email-forward",
        providerId: "email-forward",
        providerName: "Email Forward",
      },
      new Date("2026-07-11T10:00:00.000Z"),
    );

    assert.equal(items[0]?.label, "Feed email intake");
    assert.equal(items.some((item) => item.label === "Connect inbox access"), true);
  });

  it("prioritizes import-history review actions for staged manual reviews", () => {
    const items = getIntegrationActionItems(
      {
        ...activeConnection,
        lastImportedFileCount: 1,
        lastSyncAt: "2026-07-17T09:00:00.000Z",
        lastSyncMessage: "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
        lastSyncOrigin: "manual",
        lastSyncStatus: "success",
        providerId: "paytm-money",
        providerName: "Paytm Money",
      },
      new Date("2026-07-17T12:00:00.000Z"),
    );

    assert.equal(items[0]?.actionId, "review-import-history");
    assert.equal(items[0]?.label, "Open staged review");
    assert.match(items[0]?.detail ?? "", /staged review|import history/i);
  });

  it("chooses auto-open actions for manual and due connectors", () => {
    assert.equal(
      getAutoOpenIntegrationAction(
        {
          ...activeConnection,
          providerId: "paytm-money",
          providerName: "Paytm Money",
        },
        new Date("2026-07-11T10:00:00.000Z"),
      ),
      "upload-latest-statement",
    );

    assert.equal(
      getAutoOpenIntegrationAction(
        {
          ...activeConnection,
          lastImportedFileCount: 1,
          lastSyncAt: "2026-07-17T09:00:00.000Z",
          lastSyncMessage: "Paytm Money sync plan reviewed and staged in import history using 1 parsed input.",
          lastSyncOrigin: "manual",
          lastSyncStatus: "success",
          providerId: "paytm-money",
          providerName: "Paytm Money",
        },
        new Date("2026-07-17T12:00:00.000Z"),
      ),
      "review-import-history",
    );

    assert.equal(
      getAutoOpenIntegrationAction(
        {
          ...autoConnection,
          providerId: "groww-direct",
          providerName: "Groww Direct",
        },
        new Date("2026-07-11T12:30:00.000Z"),
      ),
      "run-connector-now",
    );
  });

  it("chooses live-sync setup actions when a connector has not run yet", () => {
    assert.equal(
      getAutoOpenIntegrationAction(
        {
          ...autoConnection,
          lastSyncAt: null,
        },
        new Date("2026-07-11T10:00:00.000Z"),
      ),
      "connect-live-sync",
    );
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
    assert.equal(
      plan.entries.find((entry) => entry.id === "ready-source")?.stateLabel,
      "Auth pending",
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
