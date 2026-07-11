import { createHmac, randomUUID } from "node:crypto";
import {
  inboxProviderDescriptors,
  type InboxProvider,
  type InboxProviderDescriptor,
} from "./inbox-connections";

type InboxOauthConfig = {
  authorizeUrl: string;
  clientId: string;
  clientSecret: string;
  profileUrl: string;
  tokenUrl: string;
};

type InboxOauthCookiePayload = {
  provider: InboxProvider;
  returnPath: string;
  state: string;
  userId: string;
};

export type InboxAccountProfile = {
  email: string | null;
  externalAccountId: string | null;
};

export function getInboxProviderDescriptor(provider: InboxProvider): InboxProviderDescriptor {
  const descriptor = inboxProviderDescriptors.find((item) => item.id === provider);

  if (!descriptor) {
    throw new Error(`Unsupported inbox provider: ${provider}`);
  }

  return descriptor;
}

export function getInboxProviderConfig(provider: InboxProvider): InboxOauthConfig | null {
  if (provider === "gmail") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    return {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId,
      clientSecret,
      profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
      tokenUrl: "https://oauth2.googleapis.com/token",
    };
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_OAUTH_TENANT_ID ?? "common";

  if (!clientId || !clientSecret) return null;

  return {
    authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    clientId,
    clientSecret,
    profileUrl: "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };
}

export function buildInboxRedirectUri(origin: string, provider: InboxProvider) {
  return `${origin}/api/inbox/callback/${provider}`;
}

export function buildInboxAuthorizationUrl({
  origin,
  provider,
  state,
}: {
  origin: string;
  provider: InboxProvider;
  state: string;
}) {
  const config = getInboxProviderConfig(provider);

  if (!config) {
    throw new Error(`${getInboxProviderDescriptor(provider).name} OAuth environment variables are missing.`);
  }

  const descriptor = getInboxProviderDescriptor(provider);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", buildInboxRedirectUri(origin, provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", descriptor.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return url.toString();
}

export function createInboxOauthStateCookie({
  provider,
  returnPath = "/auth",
  userId,
}: {
  provider: InboxProvider;
  returnPath?: string;
  userId: string;
}) {
  const payload: InboxOauthCookiePayload = {
    provider,
    returnPath,
    state: randomUUID(),
    userId,
  };
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);

  return {
    cookieValue: `${encodedPayload}.${signature}`,
    state: payload.state,
  };
}

export function verifyInboxOauthStateCookie(
  cookieValue: string | undefined,
  expectedState: string,
  provider: InboxProvider,
) {
  if (!cookieValue) return null;

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature) return null;
  if (signPayload(encodedPayload) !== signature) return null;

  const payload = decodePayload(encodedPayload);

  if (!payload || payload.state !== expectedState || payload.provider !== provider) {
    return null;
  }

  return payload;
}

export async function exchangeInboxOauthCode({
  code,
  origin,
  provider,
}: {
  code: string;
  origin: string;
  provider: InboxProvider;
}) {
  const config = getInboxProviderConfig(provider);

  if (!config) {
    throw new Error(`${getInboxProviderDescriptor(provider).name} OAuth environment variables are missing.`);
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: buildInboxRedirectUri(origin, provider),
  });

  const response = await fetch(config.tokenUrl, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Could not exchange ${provider} OAuth code.`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };
}

export async function fetchInboxAccountProfile({
  accessToken,
  provider,
}: {
  accessToken: string;
  provider: InboxProvider;
}) {
  const config = getInboxProviderConfig(provider);

  if (!config) {
    throw new Error(`${getInboxProviderDescriptor(provider).name} OAuth environment variables are missing.`);
  }

  const response = await fetch(config.profileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load ${provider} inbox profile.`);
  }

  const data = (await response.json()) as
    | { email?: string; id?: string }
    | { id?: string; mail?: string | null; userPrincipalName?: string | null };

  if (provider === "gmail") {
    return {
      email: "email" in data ? data.email ?? null : null,
      externalAccountId: "id" in data ? data.id ?? null : null,
    } satisfies InboxAccountProfile;
  }

  return {
    email:
      "mail" in data
        ? data.mail ?? data.userPrincipalName ?? null
        : null,
    externalAccountId: "id" in data ? data.id ?? null : null,
  } satisfies InboxAccountProfile;
}

function encodePayload(payload: InboxOauthCookiePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as InboxOauthCookiePayload;
  } catch {
    return null;
  }
}

function signPayload(value: string) {
  const secret =
    process.env.INBOX_OAUTH_STATE_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing INBOX_OAUTH_STATE_SECRET or fallback server secret.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}
