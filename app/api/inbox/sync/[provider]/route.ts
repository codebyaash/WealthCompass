import { NextResponse } from "next/server";
import type { InboxProvider } from "@/lib/inbox-connections";
import {
  appendInboxSyncEvent,
  loadInboxConnectionWithSecrets,
  upsertInboxConnection,
} from "@/lib/inbox-connections";
import { syncInboxConnection } from "@/lib/inbox-sync";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { persistCloudImportJob } from "@/lib/supabase-sync";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  const { provider: rawProvider } = await context.params;
  const provider = normalizeProvider(rawProvider);

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured for inbox sync." }, { status: 503 });
  }

  if (!provider) {
    return NextResponse.json({ error: "Unsupported inbox provider." }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Authorization is required to sync inbox connectors." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) throw error;
    if (!data.user) {
      return NextResponse.json({ error: "Could not verify your Supabase session." }, { status: 401 });
    }

    const connection = await loadInboxConnectionWithSecrets(supabase, data.user.id, provider);

    if (!connection?.accessToken && !connection?.refreshToken) {
      return NextResponse.json({ error: "Connect this inbox provider before running a sync check." }, { status: 400 });
    }

    const sync = await syncInboxConnection({ connection });
    const syncedAt = new Date().toISOString();
    const syncEvent = {
      fetchedMessageCount: sync.fetchedMessageCount,
      id: crypto.randomUUID(),
      importedFileCount: sync.processing?.result.job.assetCount ?? 0,
      message:
        sync.processing?.result.review.summary ??
        "No new statement-like emails were ready for import.",
      status:
        sync.processing?.result.job.assetCount
          ? ("success" as const)
          : sync.fetchedMessageCount > 0
            ? ("warning" as const)
            : ("success" as const),
      syncedAt,
    };

    if (sync.processing) {
      await persistCloudImportJob({
        job: sync.processing.result.job,
        supabase,
        userId: data.user.id,
      });
    }

    await upsertInboxConnection(supabase, data.user.id, {
      ...sync.updatedConnection,
      lastSyncedAt: syncedAt,
      metadata: appendInboxSyncEvent(sync.updatedConnection.metadata, syncEvent),
      provider,
    });

    return NextResponse.json({
      fetchedMessageCount: sync.fetchedMessageCount,
      job: sync.processing?.result.job ?? null,
      result: sync.processing?.result ?? null,
      syncEvent,
      summary:
        sync.processing?.result.review.summary ??
        "No new statement-like emails were ready for import.",
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function normalizeProvider(value: string): InboxProvider | null {
  if (value === "gmail" || value === "outlook") return value;
  return null;
}

function getBearerToken(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Inbox sync failed.";
}
