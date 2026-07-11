import { NextResponse } from "next/server";
import {
  executeIntegrationSyncBatch,
  resolveScheduledSyncUserIds,
} from "@/lib/integration-sync";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";
import { loadCloudSnapshot, saveCloudSnapshot } from "@/lib/supabase-sync";

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
        const snapshot = await loadCloudSnapshot(supabase, userId);
        const batch = executeIntegrationSyncBatch(snapshot.integrations, {
          importJobs: snapshot.importJobs,
          mode: "due",
          origin: "scheduled",
        });

        if (snapshot.integrations.length) {
          await saveCloudSnapshot({
            snapshot: {
              ...snapshot,
              importJobs: batch.importJobs,
              integrations: batch.integrations,
            },
            supabase,
            userId,
          });
        }

        if (!batch.syncedConnectionIds.length) {
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
            batch.syncedConnectionIds.length === 1
              ? "1 connector checkpoint was saved."
              : `${batch.syncedConnectionIds.length} connector checkpoints were saved.`,
          ok: true,
          status: "synced",
          syncedConnectionIds: batch.syncedConnectionIds,
          syncedCount: batch.syncedConnectionIds.length,
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
