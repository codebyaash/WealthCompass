import { NextResponse } from "next/server";
import type { InboxProvider } from "@/lib/inbox-connections";
import { upsertInboxConnection } from "@/lib/inbox-connections";
import {
  exchangeInboxOauthCode,
  fetchInboxAccountProfile,
  verifyInboxOauthStateCookie,
} from "@/lib/inbox-oauth";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  const provider = normalizeProvider(rawProvider);

  if (!provider) {
    return redirectWithStatus(request, "/auth?inbox=unsupported-provider");
  }

  if (!isSupabaseAdminConfigured()) {
    return redirectWithStatus(request, "/auth?inbox=missing-admin-config");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const remoteError = url.searchParams.get("error");
  const cookie = request.headers.get("cookie") ?? "";

  if (remoteError) {
    return redirectWithStatus(request, `/auth?inbox=${provider}-denied`);
  }

  if (!code || !state) {
    return redirectWithStatus(request, `/auth?inbox=${provider}-missing-code`);
  }

  const cookieValue = readCookie(cookie, `wealthcompass-inbox-${provider}-state`);
  const verifiedState = verifyInboxOauthStateCookie(cookieValue, state, provider);

  if (!verifiedState) {
    return redirectWithStatus(request, `/auth?inbox=${provider}-state-invalid`);
  }

  try {
    const origin = url.origin;
    const tokens = await exchangeInboxOauthCode({
      code,
      origin,
      provider,
    });
    const profile = await fetchInboxAccountProfile({
      accessToken: tokens.access_token,
      provider,
    });
    const supabase = getSupabaseServiceRoleClient();

    await upsertInboxConnection(supabase, verifiedState.userId, {
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      errorMessage: "",
      externalAccountId: profile.externalAccountId,
      metadata: {
        hasRefreshToken: Boolean(tokens.refresh_token),
      },
      provider,
      providerAccountEmail: profile.email,
      scopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
      status: "connected",
    });

    const response = redirectWithStatus(
      request,
      `${verifiedState.returnPath}?inbox=${provider}-connected`,
    );
    response.cookies.delete(`wealthcompass-inbox-${provider}-state`);
    return response;
  } catch {
    const response = redirectWithStatus(request, `/auth?inbox=${provider}-error`);
    response.cookies.delete(`wealthcompass-inbox-${provider}-state`);
    return response;
  }
}

function normalizeProvider(value: string): InboxProvider | null {
  if (value === "gmail" || value === "outlook") return value;
  return null;
}

function redirectWithStatus(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match?.[1];
}
