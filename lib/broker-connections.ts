import type { SupabaseClient, User } from "@supabase/supabase-js";

export type BrokerProvider = "zerodha";

export type BrokerConnectionStatus =
  | "connected"
  | "error"
  | "needs_auth"
  | "paused";

export type BrokerConnection = {
  accessTokenExpiresAt: string | null;
  accountLabel: string | null;
  createdAt: string;
  errorMessage: string;
  externalAccountId: string | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
  provider: BrokerProvider;
  scopes: string[];
  status: BrokerConnectionStatus;
  updatedAt: string;
};

export type BrokerConnectionRow = {
  access_token_expires_at: string | null;
  account_label: string | null;
  created_at: string;
  error_message: string | null;
  external_account_id: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  provider: BrokerProvider;
  scopes: string[] | null;
  status: BrokerConnectionStatus | null;
  updated_at: string;
};

export type BrokerProviderDescriptor = {
  connectLabel: string;
  description: string;
  id: BrokerProvider;
  name: string;
  scopes: string[];
};

export type BrokerSyncEvent = {
  id: string;
  importedFileCount: number;
  message: string;
  status: "error" | "success" | "warning";
  syncedAt: string;
};

export const brokerProviderDescriptors: BrokerProviderDescriptor[] = [
  {
    connectLabel: "Connect Zerodha",
    description: "Use Kite Connect to pull live holdings from Zerodha into WealthCompass.",
    id: "zerodha",
    name: "Zerodha Kite",
    scopes: ["holdings.read"],
  },
];

export function getBrokerSyncHistory(connection: BrokerConnection | null | undefined) {
  const history = connection?.metadata?.syncHistory;

  if (!Array.isArray(history)) return [];

  return history.filter(isBrokerSyncEvent);
}

export function mapBrokerConnectionRow(row: BrokerConnectionRow): BrokerConnection {
  return {
    accessTokenExpiresAt: row.access_token_expires_at,
    accountLabel: row.account_label,
    createdAt: row.created_at,
    errorMessage: row.error_message ?? "",
    externalAccountId: row.external_account_id,
    lastSyncedAt: row.last_synced_at,
    metadata: row.metadata ?? {},
    provider: row.provider,
    scopes: row.scopes ?? [],
    status: row.status ?? "needs_auth",
    updatedAt: row.updated_at,
  };
}

export function mapBrokerConnectionToInsert(
  connection: Partial<BrokerConnection> & Pick<BrokerConnection, "provider"> & {
    accessToken?: string | null;
    refreshToken?: string | null;
  },
  userId: User["id"],
) {
  return {
    access_token: connection.accessToken ?? null,
    access_token_expires_at: connection.accessTokenExpiresAt ?? null,
    account_label: connection.accountLabel ?? null,
    error_message: connection.errorMessage ?? "",
    external_account_id: connection.externalAccountId ?? null,
    last_synced_at: connection.lastSyncedAt ?? null,
    metadata: connection.metadata ?? {},
    provider: connection.provider,
    refresh_token: connection.refreshToken ?? null,
    scopes: connection.scopes ?? [],
    status: connection.status ?? "needs_auth",
    updated_at: new Date().toISOString(),
    user_id: userId,
  };
}

export async function listBrokerConnections(
  supabase: SupabaseClient,
  userId: User["id"],
) {
  const result = await supabase
    .from("broker_connections")
    .select(
      "provider, account_label, status, scopes, external_account_id, access_token_expires_at, last_synced_at, error_message, metadata, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<BrokerConnectionRow[]>();

  if (result.error) throw result.error;

  return result.data.map(mapBrokerConnectionRow);
}

export async function loadBrokerConnectionWithSecrets(
  supabase: SupabaseClient,
  userId: User["id"],
  provider: BrokerProvider,
) {
  const result = await supabase
    .from("broker_connections")
    .select(
      "provider, account_label, status, scopes, external_account_id, access_token_expires_at, last_synced_at, error_message, metadata, created_at, updated_at, access_token, refresh_token",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle<
      BrokerConnectionRow & {
        access_token: string | null;
        refresh_token: string | null;
      }
    >();

  if (result.error) throw result.error;
  if (!result.data) return null;

  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
    ...mapBrokerConnectionRow(result.data),
  };
}

export async function upsertBrokerConnection(
  supabase: SupabaseClient,
  userId: User["id"],
  connection: Parameters<typeof mapBrokerConnectionToInsert>[0],
) {
  const result = await supabase.from("broker_connections").upsert(
    mapBrokerConnectionToInsert(connection, userId),
    { onConflict: "user_id,provider" },
  );

  if (result.error) throw result.error;
}

export function appendBrokerSyncEvent(
  metadata: Record<string, unknown>,
  event: BrokerSyncEvent,
) {
  const currentHistory = Array.isArray(metadata.syncHistory)
    ? metadata.syncHistory.filter(isBrokerSyncEvent)
    : [];

  return {
    ...metadata,
    syncHistory: [event, ...currentHistory].slice(0, 6),
  };
}

function isBrokerSyncEvent(value: unknown): value is BrokerSyncEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<BrokerSyncEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.message === "string" &&
    typeof event.syncedAt === "string" &&
    typeof event.importedFileCount === "number" &&
    (event.status === "error" || event.status === "success" || event.status === "warning")
  );
}
