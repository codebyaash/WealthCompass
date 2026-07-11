import { NextResponse } from "next/server";
import { loadBrokerConnectionWithSecrets, upsertBrokerConnection } from "@/lib/broker-connections";
import { persistCloudImportJob } from "@/lib/supabase-sync";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { syncZerodhaHoldings } from "@/lib/zerodha-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured for broker sync." }, { status: 503 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Authorization is required to sync broker holdings." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) throw error;
    if (!data.user) {
      return NextResponse.json({ error: "Could not verify your Supabase session." }, { status: 401 });
    }

    const connection = await loadBrokerConnectionWithSecrets(supabase, data.user.id, "zerodha");

    if (!connection?.accessToken) {
      return NextResponse.json({ error: "Connect Zerodha before syncing holdings." }, { status: 400 });
    }

    const sync = await syncZerodhaHoldings({
      accessToken: connection.accessToken,
      accountLabel: connection.accountLabel ?? "Zerodha account",
    });

    await persistCloudImportJob({
      job: sync.job,
      supabase,
      userId: data.user.id,
    });
    await upsertBrokerConnection(supabase, data.user.id, {
      accessToken: connection.accessToken,
      accountLabel: connection.accountLabel,
      errorMessage: "",
      externalAccountId: connection.externalAccountId,
      lastSyncedAt: new Date().toISOString(),
      metadata: connection.metadata,
      provider: "zerodha",
      scopes: connection.scopes,
      status: "connected",
    });

    return NextResponse.json(sync);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function getBearerToken(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Broker sync failed.";
}
