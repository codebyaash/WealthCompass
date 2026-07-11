import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  buildFallbackMarketResponse,
  buildHoldingsWatch,
  fetchMarketSnapshot,
  type HoldingWatchItem,
  type MarketSnapshotResponse,
} from "./market-data";
import type { MarketPreferences, PortfolioAsset } from "./local-storage";

export type StoredMarketSnapshotRow = {
  created_at: string;
  holdings_watch: HoldingWatchItem[] | null;
  message: string | null;
  preferred_source: MarketPreferences["preferredSource"] | null;
  sectors: MarketSnapshotResponse["sectors"] | null;
  sentiment: string | null;
  sentiment_score: number | null;
  snapshot_tiles: MarketSnapshotResponse["snapshot"] | null;
  source: string | null;
  updated_at: string;
};

export async function loadStoredMarketSnapshot(
  supabase: SupabaseClient,
  userId: User["id"],
) {
  const result = await supabase
    .from("market_snapshots")
    .select(
      "source, preferred_source, message, sentiment, sentiment_score, snapshot_tiles, sectors, holdings_watch, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<StoredMarketSnapshotRow>();

  if (result.error) throw result.error;
  if (!result.data) return null;

  return mapStoredMarketSnapshotRow(result.data);
}

export async function refreshStoredMarketSnapshot({
  apiKey,
  assets,
  forceRefresh = false,
  marketPreferences,
  supabase,
  userId,
}: {
  apiKey?: string;
  assets: PortfolioAsset[];
  forceRefresh?: boolean;
  marketPreferences: MarketPreferences;
  supabase: SupabaseClient;
  userId: User["id"];
}) {
  const preferredSource = marketPreferences.preferredSource;
  const baseSnapshot =
    preferredSource === "fallback"
      ? buildFallbackMarketResponse("Fallback-only mode selected from market preferences.")
      : apiKey
        ? await fetchMarketSnapshot(apiKey, { forceRefresh })
        : buildFallbackMarketResponse(
            "Fallback market mode is active. Add ALPHA_VANTAGE_API_KEY when you are ready to pull live Alpha Vantage snapshots.",
          );

  const holdingsWatch = marketPreferences.includeHoldingsWatch
    ? await buildHoldingsWatch(
        assets,
        preferredSource === "fallback" ? undefined : apiKey,
      )
    : [];

  const snapshot: MarketSnapshotResponse = {
    ...baseSnapshot,
    holdingsWatch,
  };

  const result = await supabase.from("market_snapshots").upsert(
    {
      holdings_watch: snapshot.holdingsWatch,
      message: snapshot.message,
      preferred_source: preferredSource,
      sectors: snapshot.sectors,
      sentiment: snapshot.sentiment,
      sentiment_score: snapshot.sentimentScore,
      snapshot_tiles: snapshot.snapshot,
      source: snapshot.source,
      updated_at: snapshot.updatedAt,
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (result.error) throw result.error;

  return snapshot;
}

function mapStoredMarketSnapshotRow(row: StoredMarketSnapshotRow): MarketSnapshotResponse {
  return {
    holdingsWatch: row.holdings_watch ?? [],
    message: row.message ?? "Loaded saved market snapshot.",
    sectors: row.sectors ?? [],
    sentiment: row.sentiment ?? "Neutral",
    sentimentScore: row.sentiment_score ?? 50,
    snapshot: row.snapshot_tiles ?? [],
    source: row.source ?? "fallback",
    updatedAt: row.updated_at,
  };
}
