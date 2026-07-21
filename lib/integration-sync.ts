import {
  createImportJob,
  type ImportJob,
  type IntegrationConnection,
  type IntegrationSyncEvent,
} from "./local-storage";
import type { BrokerConnection } from "./broker-connections";
import { getBrokerSyncHistory } from "./broker-connections";
import { detectImportSource } from "./import-sources";
import type { InboxConnection } from "./inbox-connections";
import { getInboxSyncHistory } from "./inbox-connections";
import {
  executeProviderSync,
  type ProviderSyncExecutionResult,
} from "./provider-sync-adapters";

export type IntegrationSyncTone = "attention" | "healthy" | "idle";

export type IntegrationWorkflowState = {
  detail: string;
  id:
    | "applied-recently"
    | "auth-pending"
    | "awaiting-email"
    | "awaiting-export"
    | "awaiting-first-sync"
    | "awaiting-statement"
    | "live-sync-due"
    | "live-sync-healthy"
    | "manual-active"
    | "needs-fix"
    | "paused"
    | "retry-needed"
    | "review-ready"
    | "review-staged";
  label: string;
  tone: IntegrationSyncTone;
};

export type IntegrationHealthMetrics = {
  averageImportedFiles: number;
  lastHealthySyncAt: string | null;
  successRate: number;
  totalRuns: number;
  warningStreak: number;
};

export type ConnectorAttentionSummary = {
  actionLabel: string;
  actionView: "market" | "settings";
  badge: string;
  detail: string;
  severity: "healthy" | "warning";
  title: string;
};

export type IntegrationAttentionItem = {
  detail: string;
  id: string;
  providerName: string;
  severity: "error" | "warning";
  statusLabel: string;
};

export type IntegrationActionItem = {
  actionId:
    | "connect-inbox-access"
    | "connect-live-sync"
    | "feed-email-intake"
    | "fix-source"
    | "import-latest-statement"
    | "keep-fallback-import"
    | "reconcile-holdings"
    | "review-import-history"
    | "run-connector-now"
    | "run-first-check"
    | "upload-fresh-export"
    | "upload-latest-statement";
  detail: string;
  emphasis: "high" | "medium";
  label: string;
};

export type IntegrationActivityFilter =
  | "all"
  | "attention"
  | "due"
  | "active"
  | "manual";

export type IntegrationOperationsSummary = {
  activeCount: number;
  attentionCount: number;
  autoCount: number;
  dueNowCount: number;
  manualCount: number;
  pausedCount: number;
};

export type DashboardConnectorAction = {
  channel: IntegrationConnection["channel"];
  detail: string;
  importStrategy: IntegrationConnection["importStrategy"];
  label: string;
  providerId: string;
  providerName: string;
  view: "settings";
};

export type DashboardConnectorKpi = {
  channel: IntegrationConnection["channel"];
  currentIssue: string;
  healthySignal: string;
  importStrategy: IntegrationConnection["importStrategy"];
  lastSyncAt: string | null;
  nextRunAt: string | null;
  providerId: string;
  providerName: string;
  status: IntegrationConnection["status"];
  successRate: number;
  syncDetail: string;
  syncLabel: string;
  tone: IntegrationSyncTone;
  totalRuns: number;
  warningStreak: number;
};

export type DashboardConnectorRecovery = {
  actionId: IntegrationActionItem["actionId"] | "open-workflow";
  detail: string;
  label: string;
};

export type IntegrationSchedulerEntry = {
  cadenceMinutes: number;
  id: string;
  nextRunAt: string | null;
  providerName: string;
  reason: string;
  shouldRunNow: boolean;
  stateLabel: string;
  status: IntegrationConnection["status"];
};

export type IntegrationSchedulerPlan = {
  activeCount: number;
  dueCount: number;
  entries: IntegrationSchedulerEntry[];
  errorCount: number;
  nextRunAt: string | null;
  pausedCount: number;
  readyCount: number;
};

export type ConnectorActivityItem = {
  fetchedMessageCount: number | null;
  id: string;
  importedFileCount: number;
  message: string;
  providerId: string;
  providerName: string;
  sourceType: "broker" | "inbox" | "manual";
  status: "error" | "idle" | "success" | "warning";
  syncedAt: string;
};

export type ConnectorActivitySummary = {
  brokerEventCount: number;
  errorCount: number;
  inboxEventCount: number;
  lastSyncedAt: string | null;
  manualEventCount: number;
  successCount: number;
  totalImportedFiles: number;
  warningCount: number;
};

export type IntegrationTimelineEntry = {
  detectedProviderSummary: string | null;
  id: string;
  importedFileLabel: string;
  message: string;
  status: "error" | "idle" | "success" | "warning";
  statusLabel: string;
  syncedAt: string;
};

export type IntegrationDiagnosticsSummary = {
  providerCue: string;
  schedulerCue: string;
  timeline: IntegrationTimelineEntry[];
};

export type IntegrationSyncBatchMode = "all-active" | "due" | "single";
export type IntegrationSyncBatchOrigin = "manual" | "scheduled";
export type AutoOpenIntegrationActionId = IntegrationActionItem["actionId"] | null;

export type IntegrationSyncBatchResult = {
  executedAt: string;
  importJobs: ImportJob[];
  integrations: IntegrationConnection[];
  mode: IntegrationSyncBatchMode;
  skippedConnectionIds: string[];
  syncedConnectionIds: string[];
};

export type ManualIntegrationReviewOutcome = "applied" | "staged";

export function getIntegrationStrategyLabel(
  strategy: IntegrationConnection["importStrategy"],
) {
  switch (strategy) {
    case "sync-ready":
      return "Live sync lane";
    case "email-forward":
      return "Email intake lane";
    case "csv-upload":
      return "CSV review lane";
    case "statement-upload":
      return "Statement review lane";
    default:
      return "Guided import lane";
  }
}

export function resolveScheduledSyncUserIds(
  requestedUserIds: string[] = [],
  configuredUserIds = "",
) {
  return [...new Set([
    ...requestedUserIds,
    ...configuredUserIds.split(","),
  ].map((value) => value.trim()).filter(Boolean))];
}

export function createIntegrationSyncEvent(
  connection: IntegrationConnection,
  now = new Date(),
  execution = executeProviderSync(connection),
): IntegrationSyncEvent {
  const telemetry = buildIntegrationSyncTelemetry(connection, now, execution);

  return {
    detectedProviderSummary: telemetry.lastDetectedProviderSummary,
    id: crypto.randomUUID(),
    importedFileCount: telemetry.lastImportedFileCount,
    message: telemetry.lastSyncMessage,
    status: telemetry.lastSyncStatus,
    syncedAt: telemetry.lastSyncAt,
  };
}

export function buildIntegrationSyncTelemetry(
  connection: IntegrationConnection,
  now = new Date(),
  execution = executeProviderSync(connection),
) {
  const lastSyncStatus =
    execution.connectorStatus === "planned"
      ? "warning"
      : execution.jobStatus === "failed"
        ? "error"
        : "success";

  return {
    lastDetectedProviderSummary: execution.detectedProviderSummary,
    lastImportedFileCount: execution.importedFileCount,
    lastSyncAt: now.toISOString(),
    lastSyncMessage: execution.message,
    lastSyncStatus,
  } satisfies Pick<
    IntegrationConnection,
    | "lastDetectedProviderSummary"
    | "lastImportedFileCount"
    | "lastSyncAt"
    | "lastSyncMessage"
    | "lastSyncStatus"
  >;
}

export function appendIntegrationSyncEvent(
  connection: IntegrationConnection,
  event: IntegrationSyncEvent,
) {
  return [event, ...(connection.syncHistory ?? [])].slice(0, 8);
}

export function recordManualIntegrationReview(
  connection: IntegrationConnection,
  execution: ProviderSyncExecutionResult,
  {
    now = new Date(),
    outcome,
  }: {
    now?: Date;
    outcome: ManualIntegrationReviewOutcome;
  },
) {
  const baseTelemetry = buildIntegrationSyncTelemetry(connection, now, execution);
  const reviewedCount = execution.importedFileCount;
  const reviewedLabel =
    reviewedCount === 1 ? "1 parsed input" : `${reviewedCount} parsed inputs`;
  const lastSyncMessage =
    outcome === "applied"
      ? `${connection.providerName} sync plan reviewed and applied to the portfolio using ${reviewedLabel}.`
      : `${connection.providerName} sync plan reviewed and staged in import history using ${reviewedLabel}.`;
  const event: IntegrationSyncEvent = {
    detectedProviderSummary: baseTelemetry.lastDetectedProviderSummary,
    id: crypto.randomUUID(),
    importedFileCount: baseTelemetry.lastImportedFileCount,
    message: lastSyncMessage,
    status: "success",
    syncedAt: baseTelemetry.lastSyncAt,
  };

  return {
    ...connection,
    ...baseTelemetry,
    lastSyncMessage,
    lastSyncOrigin: "manual" as const,
    lastSyncStatus: "success" as const,
    syncHistory: appendIntegrationSyncEvent(connection, event),
  } satisfies IntegrationConnection;
}

export function getIntegrationHealthMetrics(
  connection: IntegrationConnection,
): IntegrationHealthMetrics {
  const events = connection.syncHistory ?? [];
  const meaningfulEvents = events.filter((event) => event.status !== "idle");
  const successfulEvents = meaningfulEvents.filter((event) => event.status === "success");
  const totalRuns = meaningfulEvents.length;
  const totalFiles = meaningfulEvents.reduce(
    (sum, event) => sum + event.importedFileCount,
    0,
  );

  let warningStreak = 0;
  for (const event of events) {
    if (event.status === "warning" || event.status === "error") {
      warningStreak += 1;
      continue;
    }
    if (event.status === "success") break;
  }

  return {
    averageImportedFiles: totalRuns ? totalFiles / totalRuns : 0,
    lastHealthySyncAt: successfulEvents[0]?.syncedAt ?? null,
    successRate: totalRuns ? Math.round((successfulEvents.length / totalRuns) * 100) : 0,
    totalRuns,
    warningStreak,
  };
}

export function getConnectorAttentionSummary(
  integrations: IntegrationConnection[] = [],
  now = new Date(),
): ConnectorAttentionSummary {
  const activeIntegrations = integrations.filter((integration) => integration.status === "active");

  if (!activeIntegrations.length) {
    return {
      actionLabel: "Add Source",
      actionView: "settings",
      badge: "Setup",
      detail: "No active connectors are feeding the import pipeline yet.",
      severity: "warning",
      title: "Connect your first import source",
    };
  }

  const flagged = activeIntegrations.map((integration) => ({
    health: getIntegrationHealthMetrics(integration),
    integration,
    syncState: getIntegrationSyncState(integration, now),
  }));

  const urgent = flagged.find(
    ({ health, integration, syncState }) =>
      integration.status === "error" ||
      syncState.label === "Due now" ||
      health.warningStreak >= 2,
  );

  if (urgent) {
    return {
      actionLabel: "Open Settings",
      actionView: "settings",
      badge: "Attention",
      detail: `${urgent.integration.providerName} needs review. ${urgent.syncState.detail}`,
      severity: "warning",
      title: "A connector needs attention",
    };
  }

  const warning = flagged.find(
    ({ integration }) => integration.lastSyncStatus === "warning" || integration.lastSyncStatus === "error",
  );

  if (warning) {
    return {
      actionLabel: "Open Market",
      actionView: "market",
      badge: "Monitor",
      detail: `${warning.integration.providerName} is syncing, but recent runs need a closer look.`,
      severity: "warning",
      title: "Watch connector health",
    };
  }

  return {
    actionLabel: "Open Market",
    actionView: "market",
    badge: "Healthy",
    detail: `${activeIntegrations.length} active connector${activeIntegrations.length === 1 ? "" : "s"} are on cadence.`,
    severity: "healthy",
    title: "Connector health looks steady",
  };
}

export function getNextIntegrationSyncAt(
  connection: IntegrationConnection,
  now = new Date(),
) {
  if (connection.status !== "active") return null;
  if (!isAutomaticallySyncedIntegration(connection)) return null;

  const anchor = connection.lastSyncAt
    ? new Date(connection.lastSyncAt)
    : now;

  return new Date(anchor.getTime() + connection.syncCadenceMinutes * 60_000).toISOString();
}

export function getScheduledIntegrationRunAt(
  connection: IntegrationConnection,
  now = new Date(),
) {
  if (connection.status !== "active") return null;
  if (!isAutomaticallySyncedIntegration(connection)) return null;
  if (!connection.lastSyncAt) return now.toISOString();

  return getNextIntegrationSyncAt(connection, now);
}

export function buildIntegrationSchedulerPlan(
  integrations: IntegrationConnection[],
  now = new Date(),
): IntegrationSchedulerPlan {
  const entries = integrations
    .map((integration) => {
      const syncState = getIntegrationWorkflowState(integration, now);
      const nextRunAt = getScheduledIntegrationRunAt(integration, now);
      const shouldRunNow =
        integration.status === "active" &&
        (syncState.id === "auth-pending" || syncState.id === "live-sync-due");

      return {
        cadenceMinutes: integration.syncCadenceMinutes,
        id: integration.id,
        nextRunAt,
        providerName: integration.providerName,
        reason: syncState.detail,
        shouldRunNow,
        stateLabel: syncState.label,
        status: integration.status,
      } satisfies IntegrationSchedulerEntry;
    })
    .sort((left, right) => {
      if (left.shouldRunNow !== right.shouldRunNow) {
        return left.shouldRunNow ? -1 : 1;
      }
      if (!left.nextRunAt && !right.nextRunAt) return left.providerName.localeCompare(right.providerName);
      if (!left.nextRunAt) return 1;
      if (!right.nextRunAt) return -1;
      return left.nextRunAt.localeCompare(right.nextRunAt);
    });
  const activeEntries = entries.filter((entry) => entry.status === "active");
  const dueEntries = entries.filter((entry) => entry.shouldRunNow);

  return {
    activeCount: activeEntries.length,
    dueCount: dueEntries.length,
    entries,
    errorCount: entries.filter((entry) => entry.status === "error").length,
    nextRunAt: activeEntries.find((entry) => entry.nextRunAt)?.nextRunAt ?? null,
    pausedCount: entries.filter((entry) => entry.status === "paused").length,
    readyCount: entries.filter((entry) => entry.stateLabel === "Auth pending").length,
  };
}

export function buildIntegrationOperationsSummary(
  integrations: IntegrationConnection[],
  now = new Date(),
): IntegrationOperationsSummary {
  const activeIntegrations = integrations.filter((integration) => integration.status === "active");
  const pausedCount = integrations.filter((integration) => integration.status === "paused").length;
  const autoCount = activeIntegrations.filter((integration) =>
    isAutomaticallySyncedIntegration(integration),
  ).length;
  const manualCount = activeIntegrations.length - autoCount;
  const dueNowCount = activeIntegrations.filter(
    (integration) => getIntegrationSyncState(integration, now).label === "Due now",
  ).length;
  const attentionCount = getIntegrationAttentionItems(integrations, now).length;

  return {
    activeCount: activeIntegrations.length,
    attentionCount,
    autoCount,
    dueNowCount,
    manualCount,
    pausedCount,
  };
}

export function getIntegrationAttentionItems(
  integrations: IntegrationConnection[],
  now = new Date(),
) {
  const items: IntegrationAttentionItem[] = integrations
    .flatMap<IntegrationAttentionItem>((integration) => {
      const syncState = getIntegrationSyncState(integration, now);
      const health = getIntegrationHealthMetrics(integration);

      if (integration.status === "error") {
        return [
          {
            detail: "Connection needs review before the next import attempt.",
            id: integration.id,
            providerName: integration.providerName,
            severity: "error" as const,
            statusLabel: "Needs fix",
          },
        ];
      }

      if (integration.status === "active" && syncState.label === "Due now") {
        return [
          {
            detail: syncState.detail,
            id: integration.id,
            providerName: integration.providerName,
            severity: "warning" as const,
            statusLabel: "Due now",
          },
        ];
      }

      if (integration.status === "active" && health.warningStreak >= 2) {
        return [
          {
            detail: `${health.warningStreak} recent runs need review before the source drifts further.`,
            id: integration.id,
            providerName: integration.providerName,
            severity: "warning" as const,
            statusLabel: "Warning streak",
          },
        ];
      }

      if (
        integration.status === "active" &&
        integration.lastSyncStatus === "error"
      ) {
        return [
          {
            detail: integration.lastSyncMessage,
            id: integration.id,
            providerName: integration.providerName,
            severity: "warning" as const,
            statusLabel: "Recent error",
          },
        ];
      }

      return [];
    })
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "error" ? -1 : 1;
      }

      return left.providerName.localeCompare(right.providerName);
    });

  return items;
}

export function buildConnectorActivityFeed({
  brokerConnections = [],
  inboxConnections = [],
  integrations = [],
  limit = 8,
}: {
  brokerConnections?: BrokerConnection[];
  inboxConnections?: InboxConnection[];
  integrations?: IntegrationConnection[];
  limit?: number;
}) {
  const integrationItems: ConnectorActivityItem[] = integrations.flatMap((integration) =>
    (integration.syncHistory ?? []).map((event) => ({
      fetchedMessageCount: null,
      id: event.id,
      importedFileCount: event.importedFileCount,
      message: event.message,
      providerId: integration.providerId,
      providerName: integration.providerName,
      sourceType: "manual" as const,
      status: event.status,
      syncedAt: event.syncedAt,
    })),
  );

  const inboxItems: ConnectorActivityItem[] = inboxConnections.flatMap((connection) =>
    getInboxSyncHistory(connection).map((event) => ({
      fetchedMessageCount: event.fetchedMessageCount,
      id: event.id,
      importedFileCount: event.importedFileCount,
      message: event.message,
      providerId: connection.provider,
      providerName:
        connection.provider === "gmail"
          ? "Gmail"
          : connection.provider === "outlook"
            ? "Outlook"
            : connection.provider,
      sourceType: "inbox" as const,
      status: event.status,
      syncedAt: event.syncedAt,
    })),
  );

  const brokerItems: ConnectorActivityItem[] = brokerConnections.flatMap((connection) =>
    getBrokerSyncHistory(connection).map((event) => ({
      fetchedMessageCount: null,
      id: event.id,
      importedFileCount: event.importedFileCount,
      message: event.message,
      providerId: connection.provider,
      providerName: connection.accountLabel || "Zerodha Kite",
      sourceType: "broker" as const,
      status: event.status,
      syncedAt: event.syncedAt,
    })),
  );

  return [...integrationItems, ...inboxItems, ...brokerItems]
    .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt))
    .slice(0, limit);
}

export function buildConnectorActivitySummary(
  items: ConnectorActivityItem[],
): ConnectorActivitySummary {
  return items.reduce<ConnectorActivitySummary>(
    (summary, item) => {
      if (item.sourceType === "broker") {
        summary.brokerEventCount += 1;
      } else if (item.sourceType === "inbox") {
        summary.inboxEventCount += 1;
      } else {
        summary.manualEventCount += 1;
      }

      if (item.status === "success") {
        summary.successCount += 1;
      } else if (item.status === "warning") {
        summary.warningCount += 1;
      } else if (item.status === "error") {
        summary.errorCount += 1;
      }

      summary.totalImportedFiles += item.importedFileCount;

      if (!summary.lastSyncedAt || item.syncedAt > summary.lastSyncedAt) {
        summary.lastSyncedAt = item.syncedAt;
      }

      return summary;
    },
    {
      brokerEventCount: 0,
      errorCount: 0,
      inboxEventCount: 0,
      lastSyncedAt: null,
      manualEventCount: 0,
      successCount: 0,
      totalImportedFiles: 0,
      warningCount: 0,
    },
  );
}

export function buildIntegrationDiagnosticsSummary(
  connection: IntegrationConnection,
  { limit = 3 }: { limit?: number } = {},
): IntegrationDiagnosticsSummary {
  const providerCue = connection.lastDetectedProviderSummary.trim()
    ? connection.lastDetectedProviderSummary.trim()
    : "No provider cue recorded yet. Run the next review so parser and provider-detection notes have fresh material.";
  const schedulerCue = connection.lastSchedulerMessage.trim()
    ? connection.lastSchedulerMessage.trim()
    : "Scheduler has not recorded a note for this source yet.";
  const timeline = [...(connection.syncHistory ?? [])]
    .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt))
    .slice(0, limit)
    .map((event) => ({
      detectedProviderSummary: event.detectedProviderSummary.trim() || null,
      id: event.id,
      importedFileLabel:
        event.importedFileCount === 0
          ? "No imports"
          : `${event.importedFileCount} ${event.importedFileCount === 1 ? "file" : "files"}`,
      message: event.message,
      status: event.status,
      statusLabel: getConnectorEventStatusLabel(event.status),
      syncedAt: event.syncedAt,
    }));

  return {
    providerCue,
    schedulerCue,
    timeline,
  };
}

export function getIntegrationActionItems(
  connection: IntegrationConnection,
  now = new Date(),
): IntegrationActionItem[] {
  const syncState = getIntegrationWorkflowState(connection, now);
  const actions: IntegrationActionItem[] = [];

  if (connection.status === "error") {
    actions.push({
      actionId: "fix-source",
      detail: "Review the connector configuration, then retry the source after the latest failure is understood.",
      emphasis: "high",
      label: "Fix source",
    });
  }

  if (syncState.id === "retry-needed") {
    if (connection.importStrategy === "sync-ready") {
      actions.push({
        actionId: "run-connector-now",
        detail: "Retry the live holdings check now so this connector can get back onto a healthy cadence.",
        emphasis: "high",
        label: "Retry live check",
      });
    } else if (connection.importStrategy === "email-forward") {
      actions.push({
        actionId: "feed-email-intake",
        detail: "Feed a cleaner forwarded statement into the email intake lane before retrying this provider.",
        emphasis: "high",
        label: "Retry email intake",
      });
    } else if (connection.importStrategy === "csv-upload") {
      actions.push({
        actionId: "upload-fresh-export",
        detail: "Pull a fresh broker export before retrying this review lane.",
        emphasis: "high",
        label: "Retry with fresh export",
      });
    } else {
      actions.push({
        actionId:
          connection.providerId === "paytm-money"
            ? "upload-latest-statement"
            : "import-latest-statement",
        detail:
          connection.providerId === "paytm-money"
            ? "Upload a fresh Paytm Money statement or transaction summary before retrying this review lane."
            : "Upload a fresh statement or copied table before retrying this review lane.",
        emphasis: "high",
        label:
          connection.providerId === "paytm-money"
            ? "Retry with fresh statement"
            : "Retry guided import",
      });
    }
  }

  if (syncState.id === "review-staged") {
    actions.push({
      actionId: "review-import-history",
      detail: "Open the staged review in import history and decide whether to apply the parsed holdings or transactions.",
      emphasis: "high",
      label: "Open staged review",
    });
  } else if (syncState.id === "review-ready") {
    actions.push({
      actionId: "review-import-history",
      detail: "Open import history to review the latest parsed source before anything drifts or gets replaced.",
      emphasis: "high",
      label: "Review parsed import",
    });
  } else if (syncState.id === "applied-recently") {
    actions.push({
      actionId: "review-import-history",
      detail: "Reopen the latest applied review if you want to verify what was merged into the tracked portfolio.",
      emphasis: "medium",
      label: "Open applied review",
    });
  }

  const shouldAppendFirstCheckAfterLaneAction =
    syncState.id === "auth-pending" && connection.importStrategy === "sync-ready";

  if (syncState.id === "live-sync-due") {
    actions.push({
      actionId: "run-connector-now",
      detail: syncState.detail,
      emphasis: "high",
      label: "Run connector now",
    });
  } else if (syncState.id === "auth-pending" && !shouldAppendFirstCheckAfterLaneAction) {
    actions.push({
      actionId: "run-first-check",
      detail: "This source has not had its first successful run yet.",
      emphasis: "medium",
      label: "Run first check",
    });
  }

  if (connection.importStrategy === "sync-ready") {
    actions.push({
      actionId:
        connection.providerId === "zerodha" ? "connect-live-sync" : "keep-fallback-import",
      detail:
        connection.providerId === "zerodha"
          ? syncState.id === "auth-pending"
            ? "Connect Kite and run the first live holdings check, then compare it against a manual export."
            : "Keep Kite connected and compare the next live holdings check against a fallback export when something looks off."
          : "Keep the manual fallback lane available until direct account auth is fully implemented for this provider.",
      emphasis: "high",
      label:
        connection.providerId === "zerodha" ? "Connect live sync" : "Keep fallback import",
    });
  } else if (connection.importStrategy === "email-forward") {
    actions.push({
      actionId: "feed-email-intake",
      detail:
        syncState.id === "awaiting-email"
          ? "Forward the next statement email with attachment text so the inbox lane has fresh material to parse."
          : "Use forwarded statement emails with attachment text so provider review has both the body and the holdings payload.",
      emphasis: "high",
      label: "Feed email intake",
    });
  } else if (connection.importStrategy === "csv-upload") {
    actions.push({
      actionId: "upload-fresh-export",
      detail:
        syncState.id === "awaiting-export"
          ? "Pull the latest export file before the next review so value columns and holding names stay current."
          : "Pull a fresh export before each import review so value columns and holdings names stay current.",
      emphasis: "high",
      label: "Upload fresh export",
    });
  } else {
    actions.push({
      actionId:
        connection.providerId === "paytm-money"
          ? "upload-latest-statement"
          : "import-latest-statement",
      detail:
        connection.providerId === "paytm-money"
          ? syncState.id === "awaiting-statement"
            ? "Upload the latest Paytm Money statement or transaction summary so holdings and SIP activity can be reviewed together."
            : "Use the latest Paytm Money statement or transaction summary so both holdings and SIP activity can be reviewed together."
          : syncState.id === "awaiting-statement"
            ? "Upload a fresh statement PDF or copied table so this guided-import lane has a current source."
            : "Use a recent statement PDF or copied table to keep this guided-import lane current.",
      emphasis: "high",
      label:
        connection.providerId === "paytm-money"
          ? "Upload latest statement"
          : "Import latest statement",
    });
  }

  if (connection.channel === "email") {
    actions.push({
      actionId: "connect-inbox-access",
      detail: "If OAuth is available, connect inbox access so forwarding and manual pasting do not stay the only ingestion path.",
      emphasis: "medium",
      label: "Connect inbox access",
    });
  }

  if (connection.channel === "registrar") {
    actions.push({
      actionId: "reconcile-holdings",
      detail: "Use this source as a periodic reconciliation layer against broker-reported mutual fund positions.",
      emphasis: "medium",
      label: "Reconcile holdings",
    });
  }

  if (shouldAppendFirstCheckAfterLaneAction) {
    actions.push({
      actionId: "run-first-check",
      detail: "This source has not had its first successful run yet.",
      emphasis: "medium",
      label: "Run first check",
    });
  }

  return actions.slice(0, 3);
}

export function getAutoOpenIntegrationAction(
  connection: IntegrationConnection,
  now = new Date(),
): AutoOpenIntegrationActionId {
  if (
    connection.importStrategy === "sync-ready" &&
    !connection.lastSyncAt
  ) {
    return "connect-live-sync";
  }

  const actions = getIntegrationActionItems(connection, now);
  const preferredActionIds: IntegrationActionItem["actionId"][] = [
    "connect-live-sync",
    "run-connector-now",
    "run-first-check",
    "review-import-history",
    "upload-latest-statement",
    "import-latest-statement",
    "upload-fresh-export",
    "feed-email-intake",
    "fix-source",
    "reconcile-holdings",
  ];

  for (const actionId of preferredActionIds) {
    if (actions.some((action) => action.actionId === actionId)) {
      return actionId;
    }
  }

  return null;
}

export function filterAndSortIntegrations(
  integrations: IntegrationConnection[],
  {
    filter = "all",
    query = "",
    now = new Date(),
  }: {
    filter?: IntegrationActivityFilter;
    query?: string;
    now?: Date;
  } = {},
) {
  const normalizedQuery = query.trim().toLowerCase();

  return integrations
    .filter((integration) => {
      const syncState = getIntegrationWorkflowState(integration, now);
      const health = getIntegrationHealthMetrics(integration);
      const isAutomatic = isAutomaticallySyncedIntegration(integration);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "attention"
            ? integration.status === "error" ||
              syncState.id === "live-sync-due" ||
              health.warningStreak >= 2 ||
              integration.lastSyncStatus === "error"
            : filter === "due"
              ? integration.status === "active" &&
                (syncState.id === "live-sync-due" || syncState.id === "auth-pending")
              : filter === "active"
                ? integration.status === "active" && isAutomatic
                : integration.status === "active" && !isAutomatic;

      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      return [
        integration.providerName,
        integration.providerId,
        integration.channel,
        integration.importStrategy,
        integration.sourceHint,
        integration.notes,
        integration.lastSyncMessage,
        integration.lastDetectedProviderSummary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => compareIntegrations(left, right, now));
}

export function getDashboardConnectorActions(
  integrations: IntegrationConnection[],
  now = new Date(),
) {
  return filterAndSortIntegrations(integrations, { now })
    .flatMap((integration) =>
      getIntegrationActionItems(integration, now)
        .slice(0, 1)
        .map((action) => ({
          channel: integration.channel,
          detail: action.detail,
          importStrategy: integration.importStrategy,
          label: action.label,
          providerId: integration.providerId,
          providerName: integration.providerName,
          view: "settings" as const,
        })),
    )
    .slice(0, 3);
}

export function buildDashboardConnectorKpis(
  integrations: IntegrationConnection[],
  {
    filter = "all",
    limit = 4,
    now = new Date(),
  }: {
    filter?: IntegrationActivityFilter;
    limit?: number;
    now?: Date;
  } = {},
) {
  return filterAndSortIntegrations(integrations, { filter, now })
    .map((integration) => {
      const health = getIntegrationHealthMetrics(integration);
      const workflowState = getIntegrationWorkflowState(integration, now);
      const syncState = {
        detail: workflowState.detail,
        label: workflowState.label,
        tone: workflowState.tone,
      };

      return {
        channel: integration.channel,
        currentIssue: getDashboardConnectorIssueSummary(integration, workflowState, health),
        healthySignal: getDashboardConnectorHealthySummary(integration, workflowState, health),
        importStrategy: integration.importStrategy,
        lastSyncAt: integration.lastSyncAt,
        nextRunAt: getNextIntegrationSyncAt(integration, now),
        providerId: integration.providerId,
        providerName: integration.providerName,
        status: integration.status,
        successRate: health.successRate,
        syncDetail: syncState.detail,
        syncLabel: syncState.label,
        tone: syncState.tone,
        totalRuns: health.totalRuns,
        warningStreak: health.warningStreak,
      } satisfies DashboardConnectorKpi;
    })
    .slice(0, limit);
}

function getDashboardConnectorHealthySummary(
  integration: IntegrationConnection,
  workflowState: IntegrationWorkflowState,
  health: IntegrationHealthMetrics,
) {
  if (workflowState.id === "applied-recently") {
    return integration.lastSyncMessage || "The latest reviewed import was applied to the portfolio.";
  }

  if (workflowState.id === "review-staged") {
    return "A reviewed import is staged and ready for a final apply decision.";
  }

  if (workflowState.id === "review-ready") {
    return "A parsed source is ready for review before anything is merged.";
  }

  if (health.lastHealthySyncAt) {
    return `Last healthy run ${new Date(health.lastHealthySyncAt).toLocaleString()}.`;
  }

  if (
    workflowState.id === "awaiting-statement" ||
    workflowState.id === "awaiting-export" ||
    workflowState.id === "awaiting-email"
  ) {
    return "No recent reviewed import has been saved for this lane yet.";
  }

  if (integration.lastSyncStatus === "success" && integration.lastSyncMessage) {
    return integration.lastSyncMessage;
  }

  if (health.totalRuns > 0 && health.successRate > 0) {
    return `${health.successRate}% success across ${health.totalRuns} run${health.totalRuns === 1 ? "" : "s"}.`;
  }

  return "No completed healthy run yet.";
}

function getDashboardConnectorIssueSummary(
  integration: IntegrationConnection,
  workflowState: IntegrationWorkflowState,
  health: IntegrationHealthMetrics,
) {
  if (integration.status === "error" && integration.lastSyncMessage) {
    return integration.lastSyncMessage;
  }

  if (integration.lastSyncStatus === "error" && integration.lastSyncMessage) {
    return integration.lastSyncMessage;
  }

  if (health.warningStreak >= 2) {
    return `${health.warningStreak} recent run${health.warningStreak === 1 ? "" : "s"} need review before this source drifts further.`;
  }

  switch (workflowState.id) {
    case "auth-pending":
      return "Direct auth is still pending, so the first live holdings check has not happened yet.";
    case "awaiting-email":
    case "awaiting-export":
    case "awaiting-statement":
      return workflowState.detail;
    case "review-staged":
      return "A reviewed import is waiting in history for the final apply step.";
    case "review-ready":
      return "A parsed source is waiting for review before it can be applied.";
    case "applied-recently":
      return "The latest reviewed import was applied successfully. Reopen history if you want to verify the merge.";
    default:
      break;
  }

  if (workflowState.tone === "attention") {
    return workflowState.detail;
  }

  return "No immediate issue flagged.";
}

export function getDashboardConnectorRecovery(
  integration: IntegrationConnection,
  now = new Date(),
): DashboardConnectorRecovery {
  const syncState = getIntegrationWorkflowState(integration, now);
  const health = getIntegrationHealthMetrics(integration);
  const nextAction = getIntegrationActionItems(integration, now)[0];

  if (integration.status === "error") {
    return {
      actionId: nextAction?.actionId ?? "fix-source",
      detail: nextAction?.detail ?? "Review the connector setup before attempting another import run.",
      label: nextAction?.label ?? "Fix source",
    };
  }

  if (integration.lastSyncStatus === "error") {
    return {
      actionId: nextAction?.actionId ?? "open-workflow",
      detail:
        nextAction?.detail ??
        "Use the recommended connector workflow to re-run this provider with a fresh input.",
      label: nextAction?.label ?? "Retry source",
    };
  }

  if (health.warningStreak >= 2) {
    return {
      actionId: nextAction?.actionId ?? "open-workflow",
      detail:
        nextAction?.detail ??
        "Review the latest warning streak now so the source does not drift into stale data.",
      label: nextAction?.label ?? "Review warnings",
    };
  }

  if (syncState.id === "live-sync-due" || syncState.id === "auth-pending") {
    return {
      actionId: nextAction?.actionId ?? "run-connector-now",
      detail:
        nextAction?.detail ??
        "Run the next connector check now to keep this source current.",
      label: nextAction?.label ?? "Run connector now",
    };
  }

  if (
    syncState.id === "review-staged" ||
    syncState.id === "review-ready" ||
    syncState.id === "applied-recently"
  ) {
    const reviewAction = getIntegrationActionItems(integration, now).find(
      (action) => action.actionId === "review-import-history",
    );

    return {
      actionId: reviewAction?.actionId ?? "open-workflow",
      detail:
        reviewAction?.detail ??
        "Open import history to review the latest saved connector outcome for this provider.",
      label: reviewAction?.label ?? "Review import history",
    };
  }

  if (integration.importStrategy === "email-forward") {
    return {
      actionId: "feed-email-intake",
      detail: "Keep forwarded statement emails flowing so inbox intake has fresh material to parse.",
      label: "Feed email intake",
    };
  }

  if (integration.importStrategy === "sync-ready") {
    return {
      actionId: "run-connector-now",
      detail: "Keep the live-sync lane healthy, then compare the next payload against import history.",
      label: "Run connector now",
    };
  }

  return {
    actionId: nextAction?.actionId ?? "open-workflow",
    detail: "Use the next guided import step for this provider whenever a fresh statement or export arrives.",
    label: nextAction?.label ?? "Open workflow",
  };
}

function compareIntegrations(
  left: IntegrationConnection,
  right: IntegrationConnection,
  now: Date,
) {
  const leftPriority = getIntegrationPriority(left, now);
  const rightPriority = getIntegrationPriority(right, now);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftNextRun = getScheduledIntegrationRunAt(left, now);
  const rightNextRun = getScheduledIntegrationRunAt(right, now);

  if (leftNextRun && rightNextRun && leftNextRun !== rightNextRun) {
    return leftNextRun.localeCompare(rightNextRun);
  }

  if (leftNextRun && !rightNextRun) return -1;
  if (!leftNextRun && rightNextRun) return 1;

  return left.providerName.localeCompare(right.providerName);
}

function getIntegrationPriority(
  connection: IntegrationConnection,
  now: Date,
) {
  const syncState = getIntegrationWorkflowState(connection, now);
  const health = getIntegrationHealthMetrics(connection);

  if (connection.status === "error") return 0;
  if (syncState.id === "live-sync-due") return 1;
  if (syncState.id === "auth-pending") return 2;
  if (health.warningStreak >= 2 || connection.lastSyncStatus === "error") return 3;
  if (connection.status === "active" && isAutomaticallySyncedIntegration(connection)) return 4;
  if (connection.status === "active") return 5;
  if (connection.status === "paused") return 6;
  return 7;
}

function getConnectorEventStatusLabel(status: ConnectorActivityItem["status"]) {
  switch (status) {
    case "success":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Failed";
    default:
      return "Idle";
  }
}

export function executeIntegrationSyncBatch(
  integrations: IntegrationConnection[],
  {
    connectionId,
    importJobs = [],
    mode = "all-active",
    now = new Date(),
    origin = "manual",
  }: {
    connectionId?: string;
    importJobs?: ImportJob[];
    mode?: IntegrationSyncBatchMode;
    now?: Date;
    origin?: IntegrationSyncBatchOrigin;
  } = {},
): IntegrationSyncBatchResult {
  const schedulerPlan = buildIntegrationSchedulerPlan(integrations, now);
  const activeIds = new Set(
    integrations
      .filter((integration) => integration.status === "active")
      .map((integration) => integration.id),
  );
  const dueIds = new Set(
    schedulerPlan.entries
      .filter((entry) => entry.shouldRunNow)
      .map((entry) => entry.id),
  );

  const targetIds = new Set(
    integrations
      .filter((integration) => {
        if (!activeIds.has(integration.id)) return false;
        if (mode === "single") return integration.id === connectionId;
        if (mode === "due") return dueIds.has(integration.id);
        return true;
      })
      .map((integration) => integration.id),
  );

  const skippedConnectionIds = integrations
    .filter((integration) => {
      if (mode === "single" && integration.id !== connectionId) return false;
      if (mode === "due" && !dueIds.has(integration.id)) return false;
      if (mode === "all-active" && integration.status !== "active") return false;
      return !targetIds.has(integration.id);
    })
    .map((integration) => integration.id);

  const executionById = new Map(
    integrations
      .filter((integration) => targetIds.has(integration.id))
      .map((integration) => [integration.id, executeProviderSync(integration)]),
  );
  const executedAt = now.toISOString();
  const schedulerMessage =
    targetIds.size === 0
      ? "Scheduler checked this source and nothing was due."
      : targetIds.size === 1
        ? "Scheduler ran 1 due connector."
        : `Scheduler ran ${targetIds.size} due connectors.`;

  const nextIntegrations = integrations.map((integration) => {
    const execution = executionById.get(integration.id);

    if (!execution) {
      if (origin !== "scheduled") return integration;

      return {
        ...integration,
        lastSchedulerCheckAt: executedAt,
        lastSchedulerMessage: schedulerMessage,
        lastSchedulerStatus: "idle" as const,
      };
    }

    const event = createIntegrationSyncEvent(integration, now, execution);

    return {
      ...integration,
      lastSchedulerCheckAt: origin === "scheduled" ? executedAt : integration.lastSchedulerCheckAt,
      lastSchedulerMessage:
        origin === "scheduled"
          ? schedulerMessage
          : integration.lastSchedulerMessage,
      lastSchedulerStatus:
        origin === "scheduled"
          ? ("success" as const)
          : integration.lastSchedulerStatus,
      lastSyncOrigin: origin,
      ...buildIntegrationSyncTelemetry(integration, now, execution),
      syncHistory: appendIntegrationSyncEvent(integration, event),
    };
  });

  const nextImportJobs = [
    ...integrations
      .filter((integration) => targetIds.has(integration.id))
      .map((integration) =>
        createSyncImportJob(
          integration,
          now,
          executionById.get(integration.id),
        ),
      ),
    ...importJobs,
  ].slice(0, 20);

  return {
    executedAt,
    importJobs: nextImportJobs,
    integrations: nextIntegrations,
    mode,
    skippedConnectionIds,
    syncedConnectionIds: [...targetIds],
  };
}

export function getIntegrationSyncState(
  connection: IntegrationConnection,
  now = new Date(),
): Pick<IntegrationWorkflowState, "detail" | "label" | "tone"> {
  const workflowState = getIntegrationWorkflowState(connection, now);

  return {
    detail: workflowState.detail,
    label: workflowState.label,
    tone: workflowState.tone,
  };
}

export function getIntegrationWorkflowState(
  connection: IntegrationConnection,
  now = new Date(),
): IntegrationWorkflowState {
  if (connection.status === "error") {
    return {
      detail: getErroredIntegrationDetail(connection),
      id: "needs-fix",
      label: "Needs fix",
      tone: "attention",
    };
  }

  if (connection.status === "paused") {
    return {
      detail: getPausedIntegrationDetail(connection),
      id: "paused",
      label: "Paused",
      tone: "idle",
    };
  }

  if (!connection.lastSyncAt) {
    if (isAutomaticallySyncedIntegration(connection)) {
      return {
        detail: "Direct auth and the first account fetch still need to run.",
        id: "auth-pending",
        label: "Auth pending",
        tone: "attention",
      };
    }

    return getManualAwaitingState(connection);
  }

  const lastSync = new Date(connection.lastSyncAt);
  const elapsedMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60_000);

  if (connection.lastSyncStatus === "error") {
    return {
      detail: getRetryNeededDetail(connection, elapsedMinutes),
      id: "retry-needed",
      label: "Retry needed",
      tone: "attention",
    };
  }

  if (!isAutomaticallySyncedIntegration(connection)) {
    if (
      connection.lastSyncOrigin === "manual" &&
      /applied to the portfolio/i.test(connection.lastSyncMessage)
    ) {
      return {
        detail: `Last manual review was applied ${elapsedMinutes} min ago.`,
        id: "applied-recently",
        label: "Applied",
        tone: "healthy",
      };
    }

    if (
      connection.lastSyncOrigin === "manual" &&
      /staged in import history/i.test(connection.lastSyncMessage)
    ) {
      return {
        detail: `A reviewed import is staged from ${elapsedMinutes} min ago.`,
        id: "review-staged",
        label: "Review staged",
        tone: "healthy",
      };
    }

    if (connection.lastImportedFileCount > 0) {
      return {
        detail: `A fresh parsed source is ready from ${elapsedMinutes} min ago.`,
        id: "review-ready",
        label: "Review ready",
        tone: "healthy",
      };
    }

    return {
      detail: `Last manual source activity ${elapsedMinutes} min ago.`,
      id: "manual-active",
      label: "Manual lane",
      tone: "healthy",
    };
  }

  if (elapsedMinutes >= connection.syncCadenceMinutes) {
    return {
      detail: `Overdue by ${elapsedMinutes - connection.syncCadenceMinutes} min.`,
      id: "live-sync-due",
      label: "Due now",
      tone: "attention",
    };
  }

  return {
    detail: `Last live check ${elapsedMinutes} min ago.`,
    id: "live-sync-healthy",
    label: "On cadence",
    tone: "healthy",
  };
}

export function formatSyncTimeLabel(syncAt: string | null, now = new Date()) {
  if (!syncAt) return "Not scheduled";

  const target = new Date(syncAt);
  const deltaMinutes = Math.round((target.getTime() - now.getTime()) / 60_000);

  if (deltaMinutes <= 0) return "Due now";
  if (deltaMinutes < 60) return `In ${deltaMinutes} min`;

  const hours = Math.floor(deltaMinutes / 60);
  const minutes = deltaMinutes % 60;

  return minutes ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
}

export function createSyncImportJob(
  connection: IntegrationConnection,
  now = new Date(),
  execution = executeProviderSync(connection),
): ImportJob {
  const iso = now.toISOString();
  const detectedSource = detectImportSource({ text: connection.providerName });
  const syncFileName = `${connection.providerId}-${iso.slice(0, 16).replace(/[:T]/g, "-")}.sync`;

  return createImportJob({
    createdAt: iso,
    documentKind: mapImportStrategyToDocumentKind(connection.importStrategy),
    duplicateCount: execution.reviewedWarnings.some((warning) => /duplicate/i.test(warning)) ? 1 : 0,
    fileName: syncFileName,
    lastActionAt: iso,
    notes: `${execution.message} ${connection.sourceHint}`,
    parserProfileId: detectedSource?.id ?? connection.providerId,
    providerConfidence: detectedSource ? "medium" : "low",
    providerId: connection.providerId,
    providerName: connection.providerName,
    rowWarnings: execution.reviewedWarnings,
    status: execution.jobStatus,
    summary: execution.summary,
  });
}

function mapImportStrategyToDocumentKind(
  strategy: IntegrationConnection["importStrategy"],
) {
  switch (strategy) {
    case "email-forward":
      return "email-statement";
    case "statement-upload":
      return "pdf-statement";
    case "csv-upload":
      return "broker-export";
    case "sync-ready":
      return "table-export";
    default:
      return "unclassified";
  }
}

function isAutomaticallySyncedIntegration(connection: IntegrationConnection) {
  return connection.importStrategy === "sync-ready";
}

function getErroredIntegrationDetail(connection: IntegrationConnection) {
  switch (connection.importStrategy) {
    case "sync-ready":
      return "Live connector auth or holdings sync needs review before the next account fetch.";
    case "email-forward":
      return "Email intake needs review before the next forwarded statement can be trusted.";
    case "csv-upload":
      return "Export review needs attention before the next broker file is processed.";
    case "statement-upload":
    default:
      return "Statement review needs attention before the next import attempt.";
  }
}

function getPausedIntegrationDetail(connection: IntegrationConnection) {
  switch (connection.importStrategy) {
    case "sync-ready":
      return "Live sync lane is paused until you resume this source.";
    case "email-forward":
      return "Email intake lane is paused until you resume this source.";
    case "csv-upload":
      return "CSV review lane is paused until you resume this source.";
    case "statement-upload":
    default:
      return "Statement review lane is paused until you resume this source.";
  }
}

function getRetryNeededDetail(
  connection: IntegrationConnection,
  elapsedMinutes: number,
) {
  switch (connection.importStrategy) {
    case "sync-ready":
      return `Latest live check failed ${elapsedMinutes} min ago. Reconnect and rerun this source before the next cadence window.`;
    case "email-forward":
      return `Latest email intake run failed ${elapsedMinutes} min ago. Feed a cleaner forwarded statement or reconnect inbox access before retrying.`;
    case "csv-upload":
      return `Latest export review failed ${elapsedMinutes} min ago. Pull a fresh broker export before retrying this lane.`;
    case "statement-upload":
    default:
      return `Latest statement review failed ${elapsedMinutes} min ago. Upload a fresh statement or transaction summary before retrying.`;
  }
}

function getManualAwaitingState(
  connection: IntegrationConnection,
): IntegrationWorkflowState {
  switch (connection.importStrategy) {
    case "email-forward":
      return {
        detail: "Waiting for a forwarded statement email or attachment.",
        id: "awaiting-email",
        label: "Awaiting email",
        tone: "idle",
      };
    case "csv-upload":
      return {
        detail: "Waiting for a fresh broker export file.",
        id: "awaiting-export",
        label: "Awaiting export",
        tone: "idle",
      };
    case "statement-upload":
      return {
        detail: "Waiting for a fresh statement or transaction summary.",
        id: "awaiting-statement",
        label: "Awaiting statement",
        tone: "idle",
      };
    default:
      return {
        detail: "Waiting for the next manual source input.",
        id: "awaiting-statement",
        label: "Awaiting source",
        tone: "idle",
      };
  }
}
