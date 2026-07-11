import { NextResponse } from "next/server";
import {
  inboxProviderDescriptors,
  listInboxConnections,
} from "@/lib/inbox-connections";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      connections: [],
      providers: inboxProviderDescriptors,
      status: "local-demo",
    });
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authorization is required to load inbox connections.",
      },
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

    const connections = await listInboxConnections(supabase, data.user.id);

    return NextResponse.json({
      connections,
      providers: inboxProviderDescriptors,
      status: "connected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
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
  return "Could not load inbox connections.";
}
