import { NextResponse } from "next/server";
import type { BrokerProvider } from "@/lib/broker-connections";
import {
  buildZerodhaAuthorizationUrl,
  createZerodhaOauthStateCookie,
  isZerodhaConfigured,
} from "@/lib/zerodha-sync";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  const payload = (await request.json()) as {
    provider?: BrokerProvider;
    returnPath?: string;
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured for broker OAuth." }, { status: 503 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Authorization is required to start broker OAuth." }, { status: 401 });
  }

  if (payload.provider !== "zerodha") {
    return NextResponse.json({ error: "Unsupported broker provider." }, { status: 400 });
  }

  if (!isZerodhaConfigured()) {
    return NextResponse.json({
      ok: false,
      provider: "zerodha",
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
    const stateCookie = createZerodhaOauthStateCookie({
      returnPath: payload.returnPath ?? "/auth",
      userId: data.user.id,
    });
    const authUrl = buildZerodhaAuthorizationUrl({
      origin,
      state: stateCookie.state,
    });

    const response = NextResponse.json({
      authUrl,
      ok: true,
      provider: "zerodha",
      status: "ready",
    });
    response.cookies.set("wealthcompass-broker-zerodha-state", stateCookie.cookieValue, {
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
  return "Could not start broker OAuth.";
}
