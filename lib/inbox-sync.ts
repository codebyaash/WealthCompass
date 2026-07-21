import { processInboundEmail, type InboundEmailPayload } from "./inbound-email";
import {
  getInboxProviderConfig,
  type InboxAccountProfile,
} from "./inbox-oauth";
import type { InboxProvider } from "./inbox-connections";

type InboxConnectionWithSecrets = {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  errorMessage: string;
  externalAccountId: string | null;
  lastMessageAt: string | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
  provider: InboxProvider;
  providerAccountEmail: string | null;
  refreshToken: string | null;
  scopes: string[];
  status: "connected" | "error" | "needs_auth" | "paused";
  syncCursor: string | null;
};

export type InboxSyncResult = {
  fetchedMessageCount: number;
  processing: Awaited<ReturnType<typeof processInboundEmail>> | null;
  updatedConnection: {
    accessToken: string | null;
    accessTokenExpiresAt: string | null;
    errorMessage: string;
    externalAccountId: string | null;
    lastMessageAt: string | null;
    lastSyncedAt: string;
    metadata: Record<string, unknown>;
    provider: InboxProvider;
    providerAccountEmail: string | null;
    refreshToken: string | null;
    scopes: string[];
    status: "connected" | "error" | "needs_auth" | "paused";
    syncCursor: string | null;
  };
};

type InboxSyncCandidate = {
  payload: InboundEmailPayload;
  processing: Awaited<ReturnType<typeof processInboundEmail>>;
};

export async function syncInboxConnection({
  connection,
  now = new Date(),
}: {
  connection: InboxConnectionWithSecrets;
  now?: Date;
}): Promise<InboxSyncResult> {
  const tokens = await ensureInboxAccessToken(connection);
  const messages = await fetchRecentInboxMessages({
    accessToken: tokens.accessToken,
    lastMessageAt: connection.lastMessageAt,
    provider: connection.provider,
  });
  const processedCandidates = await Promise.all(
    messages.map(async (payload) => ({
      payload,
      processing: await processInboundEmail(payload),
    })),
  );
  const bestCandidate = pickBestInboxSyncCandidate(processedCandidates);
  const lastSyncedAt = now.toISOString();

  if (!bestCandidate) {
    return {
      fetchedMessageCount: messages.length,
      processing: null,
      updatedConnection: {
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        errorMessage: "",
        externalAccountId: connection.externalAccountId,
        lastMessageAt: connection.lastMessageAt,
        lastSyncedAt,
        metadata: {
          ...connection.metadata,
          lastInboxCheckOutcome: "No new statement-like emails found.",
        },
        provider: connection.provider,
        providerAccountEmail: connection.providerAccountEmail,
        refreshToken: tokens.refreshToken,
        scopes: connection.scopes,
        status: "connected",
        syncCursor: connection.syncCursor,
      },
    };
  }

  return {
    fetchedMessageCount: messages.length,
    processing: bestCandidate.processing,
    updatedConnection: {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      errorMessage: "",
      externalAccountId: connection.externalAccountId,
      lastMessageAt: bestCandidate.payload.receivedAt ?? connection.lastMessageAt,
      lastSyncedAt,
      metadata: {
        ...connection.metadata,
        lastInboxCheckOutcome: bestCandidate.processing.result.review.summary,
      },
      provider: connection.provider,
      providerAccountEmail: connection.providerAccountEmail,
      refreshToken: tokens.refreshToken,
      scopes: connection.scopes,
      status: "connected",
      syncCursor: bestCandidate.payload.messageId ?? connection.syncCursor,
    },
  };
}

export function pickBestInboxSyncCandidate(
  candidates: InboxSyncCandidate[],
) {
  return [...candidates].sort((left, right) => {
    const assetDelta =
      right.processing.result.job.assetCount - left.processing.result.job.assetCount;
    if (assetDelta !== 0) return assetDelta;

    const qualityDelta =
      right.processing.result.review.qualityScore -
      left.processing.result.review.qualityScore;
    if (qualityDelta !== 0) return qualityDelta;

    const attachmentDelta =
      right.processing.attachmentCount - left.processing.attachmentCount;
    if (attachmentDelta !== 0) return attachmentDelta;

    return (
      Date.parse(right.payload.receivedAt ?? "") -
      Date.parse(left.payload.receivedAt ?? "")
    );
  })[0] ?? null;
}

async function ensureInboxAccessToken(
  connection: InboxConnectionWithSecrets,
): Promise<{
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
}> {
  const expiresAt = connection.accessTokenExpiresAt
    ? Date.parse(connection.accessTokenExpiresAt)
    : null;
  const now = Date.now();
  const stillValid =
    connection.accessToken &&
    (expiresAt === null || expiresAt - now > 120_000);

  if (stillValid) {
    const accessToken = connection.accessToken;

    if (!accessToken) {
      throw new Error("Inbox access is missing. Reconnect the inbox provider.");
    }

    return {
      accessToken,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshToken: connection.refreshToken,
    };
  }

  if (!connection.refreshToken) {
    throw new Error("Inbox access expired and no refresh token is available. Reconnect the inbox provider.");
  }

  const config = getInboxProviderConfig(connection.provider);
  if (!config) {
    throw new Error("Inbox OAuth environment variables are missing.");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });

  const response = await fetch(config.tokenUrl, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Could not refresh ${connection.provider} inbox access.`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  return {
    accessToken: payload.access_token,
    accessTokenExpiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
    refreshToken: payload.refresh_token ?? connection.refreshToken,
  };
}

async function fetchRecentInboxMessages({
  accessToken,
  lastMessageAt,
  provider,
}: {
  accessToken: string;
  lastMessageAt: string | null;
  provider: InboxProvider;
}) {
  const messages =
    provider === "gmail"
      ? await fetchRecentGmailMessages({ accessToken, lastMessageAt })
      : await fetchRecentOutlookMessages({ accessToken, lastMessageAt });

  return messages.filter((message) => isLikelyStatementMessage(message)).slice(0, 5);
}

async function fetchRecentGmailMessages({
  accessToken,
  lastMessageAt,
}: {
  accessToken: string;
  lastMessageAt: string | null;
}) {
  const afterDate = lastMessageAt ? new Date(lastMessageAt) : null;
  const query = buildInboxStatementQuery(afterDate);
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", "6");
  listUrl.searchParams.set("q", query);

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    throw new Error("Could not list Gmail messages.");
  }

  const listPayload = (await listResponse.json()) as {
    messages?: Array<{ id: string }>;
  };
  const messageIds = listPayload.messages?.map((message) => message.id) ?? [];

  const messages = await Promise.all(
    messageIds.map((messageId) => fetchGmailMessage({ accessToken, messageId })),
  );

  return messages.filter((message) => {
    if (!message.receivedAt || !afterDate) return true;
    return Date.parse(message.receivedAt) > afterDate.getTime();
  });
}

async function fetchGmailMessage({
  accessToken,
  messageId,
}: {
  accessToken: string;
  messageId: string;
}): Promise<InboundEmailPayload> {
  const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  messageUrl.searchParams.set("format", "full");

  const response = await fetch(messageUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not load Gmail message details.");
  }

  const payload = (await response.json()) as GmailMessagePayload;
  const headers = payload.payload?.headers ?? [];
  const subject = findHeader(headers, "subject") ?? "Inbox message";
  const from = findHeader(headers, "from") ?? "unknown@example.com";
  const html = collectGmailBody(payload.payload, "text/html");
  const text = collectGmailBody(payload.payload, "text/plain") ?? payload.snippet ?? "";
  const attachmentParts = flattenGmailParts(payload.payload).filter(
    (part) => part.filename && isSupportedAttachment(part.mimeType),
  );
  const attachments = await Promise.all(
    attachmentParts.slice(0, 3).map(async (part) => ({
      base64:
        part.body?.data ??
        (part.body?.attachmentId
          ? await fetchGmailAttachment({
              accessToken,
              attachmentId: part.body.attachmentId,
              messageId,
            })
          : undefined),
      contentType: part.mimeType,
      fileName: part.filename || "gmail-attachment.txt",
    })),
  );

  return {
    attachments: attachments.filter((attachment) => Boolean(attachment.base64)),
    from,
    html: html ?? undefined,
    messageId,
    receivedAt: payload.internalDate
      ? new Date(Number(payload.internalDate)).toISOString()
      : undefined,
    subject,
    text,
  };
}

async function fetchGmailAttachment({
  accessToken,
  attachmentId,
  messageId,
}: {
  accessToken: string;
  attachmentId: string;
  messageId: string;
}) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { data?: string };
  return payload.data ? payload.data.replace(/-/g, "+").replace(/_/g, "/") : undefined;
}

async function fetchRecentOutlookMessages({
  accessToken,
  lastMessageAt,
}: {
  accessToken: string;
  lastMessageAt: string | null;
}) {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/messages?$top=6&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,body,bodyPreview,from,hasAttachments,internetMessageId",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Could not list Outlook messages.");
  }

  const payload = (await response.json()) as {
    value?: OutlookMessagePayload[];
  };
  const afterDate = lastMessageAt ? Date.parse(lastMessageAt) : null;
  const messages = await Promise.all(
    (payload.value ?? []).map(async (message) => {
      const attachments = message.hasAttachments
        ? await fetchOutlookAttachments({ accessToken, messageId: message.id })
        : [];

      return {
        attachments,
        from: message.from?.emailAddress?.address ?? "unknown@example.com",
        html: message.body?.contentType === "html" ? message.body.content : undefined,
        messageId: message.id,
        receivedAt: message.receivedDateTime,
        subject: message.subject ?? "Inbox message",
        text:
          message.body?.contentType === "text"
            ? message.body.content
            : message.bodyPreview ?? "",
      } satisfies InboundEmailPayload;
    }),
  );

  return messages.filter((message) => {
    if (!message.receivedAt || afterDate === null) return true;
    return Date.parse(message.receivedAt) > afterDate;
  });
}

async function fetchOutlookAttachments({
  accessToken,
  messageId,
}: {
  accessToken: string;
  messageId: string;
}) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$top=4`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    value?: Array<{
      contentBytes?: string;
      contentType?: string;
      name?: string;
      "@odata.type"?: string;
    }>;
  };

  return (payload.value ?? [])
    .filter((attachment) => attachment.contentBytes && isSupportedAttachment(attachment.contentType))
    .map((attachment) => ({
      base64: attachment.contentBytes,
      contentType: attachment.contentType,
      fileName: attachment.name ?? "outlook-attachment.txt",
    }));
}

function buildInboxStatementQuery(afterDate: Date | null) {
  const query = [
    afterDate ? `after:${Math.floor(afterDate.getTime() / 1000)}` : "newer_than:30d",
    "(statement OR holdings OR portfolio OR mutual fund OR SIP OR folio OR demat)",
    "-category:promotions",
  ];

  return query.join(" ");
}

function isLikelyStatementMessage(message: InboundEmailPayload) {
  const haystack = [
    message.subject,
    message.from,
    message.text,
    message.html,
    ...(message.attachments ?? []).map((attachment) => attachment.fileName),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return /statement|holdings|portfolio|mutual fund|sip|folio|demat|cams|groww|paytm|zerodha|kfintech/.test(
    haystack,
  );
}

function isSupportedAttachment(contentType?: string) {
  return (
    contentType === "application/pdf" ||
    contentType === "text/plain" ||
    contentType === "text/html" ||
    contentType === "text/csv"
  );
}

function findHeader(
  headers: Array<{ name?: string; value?: string }>,
  name: string,
) {
  return headers.find((header) => header.name?.toLowerCase() === name)?.value ?? null;
}

function collectGmailBody(
  payload: GmailMessagePart | undefined,
  mimeType: "text/html" | "text/plain",
): string | null {
  const part = flattenGmailParts(payload).find(
    (item) => item.mimeType === mimeType && item.body?.data,
  );

  if (!part?.body?.data) return null;
  return decodeBase64Url(part.body.data);
}

function flattenGmailParts(payload: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!payload) return [];

  return [
    payload,
    ...(payload.parts ?? []).flatMap((part) => flattenGmailParts(part)),
  ];
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

type GmailMessagePart = {
  body?: {
    attachmentId?: string;
    data?: string;
  };
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  mimeType?: string;
  parts?: GmailMessagePart[];
};

type GmailMessagePayload = {
  id: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  snippet?: string;
};

type OutlookMessagePayload = {
  body?: {
    content: string;
    contentType: "html" | "text";
  };
  bodyPreview?: string;
  from?: {
    emailAddress?: InboxAccountProfile & {
      address?: string | null;
    };
  };
  hasAttachments?: boolean;
  id: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  subject?: string;
};
