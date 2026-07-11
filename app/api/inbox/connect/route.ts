import { NextResponse } from "next/server";
import {
  buildInboxAuthorizationUrl,
  createInboxOauthStateCookie,
  getInboxProviderConfig,
} from "@/lib/inbox-oauth";
import type { InboxProvider } from "@/lib/inbox-connections";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  const payload = (await request.json()) as {
    provider?: InboxProvider;
    returnPath?: string;
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: "Supabase is not configured for inbox OAuth.",
      },
      { status: 503 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authorization is required to start inbox OAuth.",
      },
      { status: 401 },
    );
  }

  const provider = payload.provider;
  if (provider !== "gmail" && provider !== "outlook") {
    return NextResponse.json({ error: "Unsupported inbox provider." }, { status: 400 });
  }

  if (!getInboxProviderConfig(provider)) {
    return NextResponse.json({
      ok: false,
      provider,
      status: "needs_configuration",
    });
  }

  try {
    const supabase = getSupabaseServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) throw error;
    if (!data.user) {
      return NextResponse.json({ error: "Could not verify your Supabase session." }, { status: 401 });
    }

    const origin = new URL(request.url).origin;
    const stateCookie = createInboxOauthStateCookie({
      provider,
      returnPath: payload.returnPath ?? "/auth",
      userId: data.user.id,
    });
    const authUrl = buildInboxAuthorizationUrl({
      origin,
      provider,
      state: stateCookie.state,
    });

    const response = NextResponse.json({
      authUrl,
      ok: true,
      provider,
      status: "ready",
    });
    response.cookies.set(`wealthcompass-inbox-${provider}-state`, stateCookie.cookieValue, {
      httpOnly: true,
      maxAge: 60 * 10,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
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
  return "Could not start inbox OAuth.";
}
