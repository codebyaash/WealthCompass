import {
  createImportJob,
  type ImportJob,
  type IntegrationConnection,
  type IntegrationSyncEvent,
} from "./local-storage";
import { detectImportSource } from "./import-sources";
import { executeProviderSync } from "./provider-sync-adapters";

export type IntegrationSyncTone = "attention" | "healthy" | "idle";

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

export type IntegrationSyncBatchMode = "all-active" | "due" | "single";
export type IntegrationSyncBatchOrigin = "manual" | "scheduled";

export type IntegrationSyncBatchResult = {
  executedAt: string;
  importJobs: ImportJob[];
  integrations: IntegrationConnection[];
  mode: IntegrationSyncBatchMode;
  skippedConnectionIds: string[];
  syncedConnectionIds: string[];
};

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
  if (!connection.lastSyncAt) return now.toISOString();

  return getNextIntegrationSyncAt(connection, now);
}

export function buildIntegrationSchedulerPlan(
  integrations: IntegrationConnection[],
  now = new Date(),
): IntegrationSchedulerPlan {
  const entries = integrations
    .map((integration) => {
      const syncState = getIntegrationSyncState(integration, now);
      const nextRunAt = getScheduledIntegrationRunAt(integration, now);
      const shouldRunNow =
        integration.status === "active" &&
        (syncState.label === "Ready" || syncState.label === "Due now");

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
    readyCount: activeEntries.filter((entry) => entry.stateLabel === "Ready").length,
  };
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
): {
  detail: string;
  label: string;
  tone: IntegrationSyncTone;
} {
  if (connection.status === "error") {
    return {
      detail: "Connection needs review before the next import attempt.",
      label: "Needs fix",
      tone: "attention",
    };
  }

  if (connection.status === "paused") {
    return {
      detail: "Sync is paused until you resume this source.",
      label: "Paused",
      tone: "idle",
    };
  }

  if (!connection.lastSyncAt) {
    return {
      detail: "Ready for the first sync run.",
      label: "Ready",
      tone: "attention",
    };
  }

  const lastSync = new Date(connection.lastSyncAt);
  const elapsedMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60_000);

  if (elapsedMinutes >= connection.syncCadenceMinutes) {
    return {
      detail: `Overdue by ${elapsedMinutes - connection.syncCadenceMinutes} min.`,
      label: "Due now",
      tone: "attention",
    };
  }

  return {
    detail: `Last check ${elapsedMinutes} min ago.`,
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
