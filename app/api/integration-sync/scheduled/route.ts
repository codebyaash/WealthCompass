import { NextResponse } from "next/server";
import {
  appendBrokerSyncEvent,
  loadBrokerConnectionWithSecrets,
  upsertBrokerConnection,
} from "@/lib/broker-connections";
import {
  executeIntegrationSyncBatch,
  resolveScheduledSyncUserIds,
} from "@/lib/integration-sync";
import { applyRuntimeBrokerSyncResult } from "@/lib/runtime-connector-sync";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";
import { loadCloudSnapshot, saveCloudSnapshot } from "@/lib/supabase-sync";
import { syncZerodhaHoldings } from "@/lib/zerodha-sync";

export const dynamic = "force-dynamic";

type ScheduledSyncPayload = {
  userIds?: string[];
};

export async function GET(request: Request) {
  return runScheduledSync(request);
}

export async function POST(request: Request) {
  let payload: ScheduledSyncPayload = {};

  try {
    payload = (await request.json()) as ScheduledSyncPayload;
  } catch {
    payload = {};
  }

  return runScheduledSync(request, payload);
}

async function runScheduledSync(
  request: Request,
  payload: ScheduledSyncPayload = {},
) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error: "Missing Supabase admin configuration.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const userIds = resolveScheduledSyncUserIds(
    payload.userIds,
    process.env.WEALTHCOMPASS_SYNC_USER_IDS ?? "",
  );

  if (!userIds.length) {
    return NextResponse.json(
      {
        error: "No scheduled sync user IDs were configured.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  const scheduledAt = new Date().toISOString();

  const results = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { snapshot } = await loadCloudSnapshot(supabase, userId);
        const liveSchedulerMessage = "Scheduler ran 1 live connector sync.";
        let nextSnapshot = snapshot;
        let liveSyncedConnectionIds: string[] = [];

        for (const connection of snapshot.integrations) {
          if (
            connection.providerId !== "zerodha" ||
            connection.importStrategy !== "sync-ready" ||
            connection.status !== "active"
          ) {
            continue;
          }

          const brokerConnection = await loadBrokerConnectionWithSecrets(
            supabase,
            userId,
            "zerodha",
          );

          if (!brokerConnection?.accessToken || brokerConnection.status !== "connected") {
            continue;
          }

          const sync = await syncZerodhaHoldings({
            accessToken: brokerConnection.accessToken,
            accountLabel: brokerConnection.accountLabel ?? "Zerodha account",
          });
          const syncedAt = new Date().toISOString();
          const applied = applyRuntimeBrokerSyncResult({
            connection,
            currentImportJobs: nextSnapshot.importJobs,
            origin: "scheduled",
            payload: sync,
            schedulerMessage: liveSchedulerMessage,
            syncedAt,
          });

          nextSnapshot = {
            ...nextSnapshot,
            assets: applied.nextAssets,
            importJobs: applied.nextImportJobs,
            integrations: nextSnapshot.integrations.map((integration) =>
              integration.id === connection.id ? applied.nextConnection : integration
            ),
          };
          liveSyncedConnectionIds = [...liveSyncedConnectionIds, connection.id];

          await upsertBrokerConnection(supabase, userId, {
            accessToken: brokerConnection.accessToken,
            accountLabel: brokerConnection.accountLabel,
            errorMessage: "",
            externalAccountId: brokerConnection.externalAccountId,
            lastSyncedAt: syncedAt,
            metadata: appendBrokerSyncEvent(brokerConnection.metadata, {
              id: crypto.randomUUID(),
              importedFileCount: sync.assets.length,
              message: sync.job.summary,
              status: sync.assets.length ? "success" : "warning",
              syncedAt,
            }),
            provider: "zerodha",
            scopes: brokerConnection.scopes,
            status: "connected",
          });
        }

        const remainingIntegrations = nextSnapshot.integrations.filter(
          (integration) => !liveSyncedConnectionIds.includes(integration.id),
        );
        const batch = executeIntegrationSyncBatch(remainingIntegrations, {
          importJobs: nextSnapshot.importJobs,
          mode: "due",
          origin: "scheduled",
        });

        const mergedSyncedConnectionIds = [
          ...liveSyncedConnectionIds,
          ...batch.syncedConnectionIds.filter(
            (connectionId) => !liveSyncedConnectionIds.includes(connectionId),
          ),
        ];
        const mergedSnapshot = {
          ...nextSnapshot,
          importJobs: batch.importJobs,
          integrations: nextSnapshot.integrations.map((integration) =>
            liveSyncedConnectionIds.includes(integration.id)
              ? integration
              : batch.integrations.find((candidate) => candidate.id === integration.id) ??
                integration,
          ),
        };

        if (mergedSnapshot.integrations.length) {
          await saveCloudSnapshot({
            snapshot: mergedSnapshot,
            supabase,
            userId,
          });
        }

        if (!mergedSyncedConnectionIds.length) {
          return {
            message: snapshot.integrations.length
              ? "Scheduler checked this user and nothing was due."
              : "No connector sources were configured for this user.",
            ok: true,
            status: "idle",
            syncedCount: 0,
            userId,
          };
        }

        return {
          executedAt: batch.executedAt,
          message:
            mergedSyncedConnectionIds.length === 1
              ? "1 connector sync was saved."
              : `${mergedSyncedConnectionIds.length} connector syncs were saved.`,
          ok: true,
          status: "synced",
          syncedConnectionIds: mergedSyncedConnectionIds,
          syncedCount: mergedSyncedConnectionIds.length,
          userId,
        };
      } catch (error) {
        console.error("Scheduled integration sync failed", { error, userId });

        return {
          message: getErrorMessage(error),
          ok: false,
          status: "error",
          syncedCount: 0,
          userId,
        };
      }
    }),
  );

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    results,
    scheduledAt,
    userCount: userIds.length,
  });
}

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Scheduled sync failed.";
}
