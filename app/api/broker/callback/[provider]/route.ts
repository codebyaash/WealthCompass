import { NextResponse } from "next/server";
import { upsertBrokerConnection } from "@/lib/broker-connections";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";
import {
  exchangeZerodhaRequestToken,
  verifyZerodhaOauthStateCookie,
} from "@/lib/zerodha-sync";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (provider !== "zerodha") {
    return redirectWithStatus(request, "/auth?broker=unsupported-provider");
  }

  if (!isSupabaseAdminConfigured()) {
    return redirectWithStatus(request, "/auth?broker=missing-admin-config");
  }

  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") ?? "";

  if (!requestToken || !state) {
    return redirectWithStatus(request, "/auth?broker=zerodha-missing-code");
  }

  const cookieValue = readCookie(cookie, "wealthcompass-broker-zerodha-state");
  const verifiedState = verifyZerodhaOauthStateCookie(cookieValue, state);

  if (!verifiedState) {
    return redirectWithStatus(request, "/auth?broker=zerodha-state-invalid");
  }

  try {
    const session = await exchangeZerodhaRequestToken({
      requestToken,
    });
    const supabase = getSupabaseServiceRoleClient();

    await upsertBrokerConnection(supabase, verifiedState.userId, {
      accessToken: session.access_token ?? null,
      accountLabel: session.user_name ?? session.email ?? "Zerodha account",
      errorMessage: "",
      externalAccountId: session.user_id ?? null,
      metadata: {
        publicToken: session.public_token ?? null,
      },
      provider: "zerodha",
      scopes: ["holdings.read"],
      status: "connected",
    });

    const response = redirectWithStatus(request, `${verifiedState.returnPath}?broker=zerodha-connected`);
    response.cookies.delete("wealthcompass-broker-zerodha-state");
    return response;
  } catch {
    const response = redirectWithStatus(request, "/auth?broker=zerodha-error");
    response.cookies.delete("wealthcompass-broker-zerodha-state");
    return response;
  }
}

function redirectWithStatus(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match?.[1];
}
