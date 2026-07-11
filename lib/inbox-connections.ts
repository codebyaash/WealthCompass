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
  connection: Partial<InboxConnection> & Pick<InboxConnection, "provider">,
  userId: User["id"],
) {
  return {
    access_token_expires_at: connection.accessTokenExpiresAt ?? null,
    error_message: connection.errorMessage ?? "",
    external_account_id: connection.externalAccountId ?? null,
    last_message_at: connection.lastMessageAt ?? null,
    last_synced_at: connection.lastSyncedAt ?? null,
    metadata: connection.metadata ?? {},
    provider: connection.provider,
    provider_account_email: connection.providerAccountEmail ?? null,
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
  connection: Partial<InboxConnection> & Pick<InboxConnection, "provider">,
) {
  const result = await supabase.from("inbox_connections").upsert(
    mapInboxConnectionToInsert(connection, userId),
    { onConflict: "user_id,provider" },
  );

  if (result.error) throw result.error;
}
