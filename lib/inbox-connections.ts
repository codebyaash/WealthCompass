import type { SupabaseClient, User } from "@supabase/supabase-js";

export type InboxProvider = "gmail" | "outlook";

export type InboxConnectionStatus =
  | "connected"
  | "error"
  | "needs_auth"
  | "paused";

export type InboxConnection = {
  accessTokenExpiresAt: string | null;
  createdAt: string;
  errorMessage: string;
  externalAccountId: string | null;
  lastMessageAt: string | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
  provider: InboxProvider;
  providerAccountEmail: string | null;
  scopes: string[];
  status: InboxConnectionStatus;
  syncCursor: string | null;
  updatedAt: string;
};

export type InboxConnectionRow = {
  access_token_expires_at: string | null;
  created_at: string;
  error_message: string | null;
  external_account_id: string | null;
  last_message_at: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  provider: InboxProvider;
  provider_account_email: string | null;
  scopes: string[] | null;
  status: InboxConnectionStatus | null;
  sync_cursor: string | null;
  updated_at: string;
};

export type InboxProviderDescriptor = {
  connectLabel: string;
  description: string;
  id: InboxProvider;
  name: string;
  scopes: string[];
};

export type InboxSyncEvent = {
  fetchedMessageCount: number;
  id: string;
  importedFileCount: number;
  message: string;
  status: "error" | "success" | "warning";
  syncedAt: string;
};

export type InboxConnectionHealth = {
  actionLabel: string;
  detail: string;
  readiness: "attention" | "awaiting-auth" | "ready";
  title: string;
};

export type InboxOperationsSummary = {
  attentionCount: number;
  connectedCount: number;
  needsAuthCount: number;
  nextActionLabel: string;
  pausedCount: number;
  providerCoverageLabel: string;
};

export const inboxProviderDescriptors: InboxProviderDescriptor[] = [
  {
    connectLabel: "Connect Gmail",
    description: "Use Google OAuth to let forwarded broker statements land directly in WealthCompass.",
    id: "gmail",
    name: "Gmail",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  },
  {
    connectLabel: "Connect Outlook",
    description: "Use Microsoft OAuth to connect Outlook and pull statement emails into the import pipeline.",
    id: "outlook",
    name: "Outlook",
    scopes: [
      "openid",
      "email",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.Read",
    ],
  },
];

export function getInboxProviderDescriptor(provider: InboxProvider) {
  return inboxProviderDescriptors.find((descriptor) => descriptor.id === provider) ?? null;
}

export function getInboxSyncHistory(connection: InboxConnection | null | undefined) {
  const history = connection?.metadata?.syncHistory;

  if (!Array.isArray(history)) return [];

  return history.filter(isInboxSyncEvent);
}

export function mapInboxConnectionRow(row: InboxConnectionRow): InboxConnection {
  return {
    accessTokenExpiresAt: row.access_token_expires_at,
    createdAt: row.created_at,
    errorMessage: row.error_message ?? "",
    externalAccountId: row.external_account_id,
    lastMessageAt: row.last_message_at,
    lastSyncedAt: row.last_synced_at,
    metadata: row.metadata ?? {},
    provider: row.provider,
    providerAccountEmail: row.provider_account_email,
    scopes: row.scopes ?? [],
    status: row.status ?? "needs_auth",
    syncCursor: row.sync_cursor,
    updatedAt: row.updated_at,
  };
}

export function mapInboxConnectionToInsert(
  connection: Partial<InboxConnection> & Pick<InboxConnection, "provider"> & {
    accessToken?: string | null;
    refreshToken?: string | null;
  },
  userId: User["id"],
) {
  return {
    access_token: connection.accessToken ?? null,
    access_token_expires_at: connection.accessTokenExpiresAt ?? null,
    error_message: connection.errorMessage ?? "",
    external_account_id: connection.externalAccountId ?? null,
    last_message_at: connection.lastMessageAt ?? null,
    last_synced_at: connection.lastSyncedAt ?? null,
    metadata: connection.metadata ?? {},
    provider: connection.provider,
    provider_account_email: connection.providerAccountEmail ?? null,
    refresh_token: connection.refreshToken ?? null,
    scopes: connection.scopes ?? [],
    status: connection.status ?? "needs_auth",
    sync_cursor: connection.syncCursor ?? null,
    updated_at: new Date().toISOString(),
    user_id: userId,
  };
}

export async function listInboxConnections(
  supabase: SupabaseClient,
  userId: User["id"],
) {
  const result = await supabase
    .from("inbox_connections")
    .select(
      "provider, provider_account_email, status, scopes, external_account_id, access_token_expires_at, sync_cursor, last_synced_at, last_message_at, error_message, metadata, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<InboxConnectionRow[]>();

  if (result.error) throw result.error;

  return result.data.map(mapInboxConnectionRow);
}

export async function upsertInboxConnection(
  supabase: SupabaseClient,
  userId: User["id"],
  connection: Partial<InboxConnection> & Pick<InboxConnection, "provider"> & {
    accessToken?: string | null;
    refreshToken?: string | null;
  },
) {
  const result = await supabase.from("inbox_connections").upsert(
    mapInboxConnectionToInsert(connection, userId),
    { onConflict: "user_id,provider" },
  );

  if (result.error) throw result.error;
}

export async function loadInboxConnectionWithSecrets(
  supabase: SupabaseClient,
  userId: User["id"],
  provider: InboxProvider,
) {
  const result = await supabase
    .from("inbox_connections")
    .select(
      "provider, provider_account_email, status, scopes, external_account_id, access_token_expires_at, sync_cursor, last_synced_at, last_message_at, error_message, metadata, created_at, updated_at, access_token, refresh_token",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle<
      InboxConnectionRow & {
        access_token: string | null;
        refresh_token: string | null;
      }
    >();

  if (result.error) throw result.error;
  if (!result.data) return null;

  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
    ...mapInboxConnectionRow(result.data),
  };
}

export function getInboxConnectionHealth(
  provider: InboxProviderDescriptor,
  connection: InboxConnection | null | undefined,
): InboxConnectionHealth {
  const syncHistory = getInboxSyncHistory(connection);

  if (!connection) {
    return {
      actionLabel: provider.connectLabel,
      detail: `${provider.name} is not connected yet, so statement emails still need to be forwarded or pasted manually.`,
      readiness: "awaiting-auth",
      title: "Waiting for OAuth setup",
    };
  }

  switch (connection.status) {
    case "connected":
      return {
        actionLabel: `Refresh ${provider.name}`,
        detail: syncHistory[0]?.message
          ?? (connection.lastMessageAt
            ? `${provider.name} is connected and has seen statement activity recently.`
            : `${provider.name} is connected and ready for the next statement email.`),
        readiness: "ready",
        title: "Ready to ingest statement mail",
      };
    case "paused":
      return {
        actionLabel: `Reconnect ${provider.name}`,
        detail:
          connection.errorMessage ||
          `${provider.name} was paused, so inbox imports will stay idle until access is resumed.`,
        readiness: "attention",
        title: "Paused and waiting on reconnect",
      };
    case "error":
      return {
        actionLabel: `Reconnect ${provider.name}`,
        detail:
          connection.errorMessage ||
          `${provider.name} needs attention before inbox imports can continue cleanly.`,
        readiness: "attention",
        title: "Needs attention",
      };
    default:
      return {
        actionLabel: provider.connectLabel,
        detail: `${provider.name} has not finished OAuth yet, so the import lane still depends on manual forwarding or uploads.`,
        readiness: "awaiting-auth",
        title: "Waiting for OAuth setup",
      };
  }
}

export function buildInboxOperationsSummary(
  providers: InboxProviderDescriptor[],
  connections: InboxConnection[],
): InboxOperationsSummary {
  const connectedCount = connections.filter((connection) => connection.status === "connected").length;
  const attentionCount = connections.filter(
    (connection) => connection.status === "error" || connection.status === "paused",
  ).length;
  const pausedCount = connections.filter((connection) => connection.status === "paused").length;
  const needsAuthCount = Math.max(
    providers.length - connectedCount - attentionCount,
    0,
  );

  let nextActionLabel = "Connect an inbox provider";
  if (attentionCount > 0) {
    nextActionLabel = "Reconnect the provider that needs attention";
  } else if (connectedCount > 0) {
    nextActionLabel =
      connectedCount === providers.length
        ? "Inbox connectors are fully covered"
        : "Connect the next inbox provider";
  }

  return {
    attentionCount,
    connectedCount,
    needsAuthCount,
    nextActionLabel,
    pausedCount,
    providerCoverageLabel:
      connectedCount === 0
        ? "No inbox providers connected yet"
        : `${connectedCount}/${providers.length} inbox provider${providers.length === 1 ? "" : "s"} connected`,
  };
}

export function appendInboxSyncEvent(
  metadata: Record<string, unknown>,
  event: InboxSyncEvent,
) {
  const currentHistory = Array.isArray(metadata.syncHistory)
    ? metadata.syncHistory.filter(isInboxSyncEvent)
    : [];

  return {
    ...metadata,
    syncHistory: [event, ...currentHistory].slice(0, 6),
  };
}

function isInboxSyncEvent(value: unknown): value is InboxSyncEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<InboxSyncEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.message === "string" &&
    typeof event.syncedAt === "string" &&
    typeof event.fetchedMessageCount === "number" &&
    typeof event.importedFileCount === "number" &&
    (event.status === "error" || event.status === "success" || event.status === "warning")
  );
}
