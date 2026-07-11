import { NextResponse } from "next/server";
import {
  brokerProviderDescriptors,
  listBrokerConnections,
} from "@/lib/broker-connections";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      connections: [],
      providers: brokerProviderDescriptors,
      status: "local-demo",
    });
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authorization is required to load broker connections." },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) throw error;
    if (!data.user) {
      return NextResponse.json({ error: "Could not verify your Supabase session." }, { status: 401 });
    }

    const connections = await listBrokerConnections(supabase, data.user.id);

    return NextResponse.json({
      connections,
      providers: brokerProviderDescriptors,
      status: "connected",
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
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
  return "Could not load broker connections.";
}
