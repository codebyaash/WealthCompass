import { NextResponse } from "next/server";
import { resolveScheduledSyncUserIds } from "@/lib/integration-sync";
import { refreshStoredMarketSnapshot } from "@/lib/market-snapshot-store";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";
import { loadCloudSnapshot } from "@/lib/supabase-sync";

export const dynamic = "force-dynamic";

type ScheduledMarketPayload = {
  userIds?: string[];
};

export async function GET(request: Request) {
  return runScheduledMarketRefresh(request);
}

export async function POST(request: Request) {
  let payload: ScheduledMarketPayload = {};

  try {
    payload = (await request.json()) as ScheduledMarketPayload;
  } catch {
    payload = {};
  }

  return runScheduledMarketRefresh(request, payload);
}

async function runScheduledMarketRefresh(
  request: Request,
  payload: ScheduledMarketPayload = {},
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
    process.env.WEALTHCOMPASS_MARKET_USER_IDS ?? "",
  );

  if (!userIds.length) {
    return NextResponse.json(
      {
        error: "No scheduled market refresh user IDs were configured.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const refreshedAt = new Date().toISOString();

  const results = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { snapshot } = await loadCloudSnapshot(supabase, userId);
        const refreshed = await refreshStoredMarketSnapshot({
          apiKey,
          assets: snapshot.assets,
          forceRefresh: true,
          marketPreferences: snapshot.marketPreferences,
          supabase,
          userId,
        });

        return {
          ok: true,
          source: refreshed.source,
          updatedAt: refreshed.updatedAt,
          userId,
        };
      } catch (error) {
        return {
          error: getErrorMessage(error),
          ok: false,
          userId,
        };
      }
    }),
  );

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    refreshedAt,
    results,
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
  return "Scheduled market refresh failed.";
}
