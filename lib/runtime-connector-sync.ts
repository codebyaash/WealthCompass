import {
  appendIntegrationSyncEvent,
  type IntegrationSyncBatchOrigin,
  type IntegrationSyncTone,
} from "./integration-sync";
import type {
  ImportJob,
  IntegrationConnection,
  PortfolioAsset,
} from "./local-storage";

export type RuntimeBrokerSyncResponse = {
  assets: PortfolioAsset[];
  job: ImportJob;
  providerAccountLabel: string;
};

export function getRuntimeSyncEndpoint(
  connection: Pick<IntegrationConnection, "importStrategy" | "providerId">,
) {
  if (
    connection.providerId === "zerodha" &&
    connection.importStrategy === "sync-ready"
  ) {
    return "/api/broker/sync/zerodha";
  }

  return null;
}

export function applyRuntimeBrokerSyncResult({
  connection,
  currentImportJobs,
  origin = "manual",
  payload,
  schedulerMessage,
  syncedAt = new Date().toISOString(),
}: {
  connection: IntegrationConnection;
  currentImportJobs: ImportJob[];
  origin?: IntegrationSyncBatchOrigin;
  payload: RuntimeBrokerSyncResponse;
  schedulerMessage?: string;
  syncedAt?: string;
}) {
  const syncTone: IntegrationSyncTone = payload.assets.length ? "healthy" : "idle";
  const syncStatus = payload.assets.length ? "success" : "warning";
  const syncMessage = payload.job.summary;
  const syncEvent = {
    detectedProviderSummary: payload.job.summary,
    id: crypto.randomUUID(),
    importedFileCount: payload.assets.length,
    message: syncMessage,
    status: syncStatus,
    syncedAt,
  } as const;

  return {
    nextAssets: payload.assets,
    nextConnection: {
      ...connection,
      lastDetectedProviderSummary: payload.job.summary,
      lastImportedFileCount: payload.assets.length,
      lastSchedulerCheckAt:
        origin === "scheduled" ? syncedAt : connection.lastSchedulerCheckAt,
      lastSchedulerMessage:
        origin === "scheduled"
          ? schedulerMessage ?? "Scheduler ran a live connector sync."
          : connection.lastSchedulerMessage,
      lastSchedulerStatus:
        origin === "scheduled" ? "success" : connection.lastSchedulerStatus,
      lastSyncAt: syncedAt,
      lastSyncMessage: syncMessage,
      lastSyncOrigin: origin,
      lastSyncStatus: syncStatus,
      syncHistory: appendIntegrationSyncEvent(connection, syncEvent),
    } satisfies IntegrationConnection,
    nextImportJobs: [payload.job, ...currentImportJobs].slice(0, 20),
    statusMessage:
      syncTone === "healthy"
        ? `Synced ${payload.assets.length} holding${
            payload.assets.length === 1 ? "" : "s"
          } from ${payload.providerAccountLabel}.`
        : `Checked ${payload.providerAccountLabel}, but no holdings were returned.`,
  };
}
