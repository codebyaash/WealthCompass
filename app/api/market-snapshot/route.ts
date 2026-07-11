import type { PortfolioAsset } from "@/lib/local-storage";
import { NextResponse } from "next/server";
import {
  buildHoldingsWatch,
  buildFallbackMarketResponse,
  fetchMarketSnapshot,
} from "@/lib/market-data";
import {
  loadStoredMarketSnapshot,
  refreshStoredMarketSnapshot,
} from "@/lib/market-snapshot-store";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { loadCloudSnapshot } from "@/lib/supabase-sync";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferredSource = url.searchParams.get("source");
  const forceRefresh = url.searchParams.get("refresh") === "force";
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (isSupabaseConfigured() && accessToken) {
    try {
      const supabase = getSupabaseServerClient(accessToken);
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (!error && data.user) {
        const cloudSnapshot = await loadCloudSnapshot(supabase, data.user.id);
        const effectivePreferences = {
          ...cloudSnapshot.marketPreferences,
          preferredSource:
            preferredSource === "fallback"
              ? "fallback"
              : cloudSnapshot.marketPreferences.preferredSource,
        };

        if (forceRefresh) {
          const refreshed = await refreshStoredMarketSnapshot({
            apiKey,
            assets: cloudSnapshot.assets,
            forceRefresh: true,
            marketPreferences: effectivePreferences,
            supabase,
            userId: data.user.id,
          });

          return NextResponse.json(refreshed);
        }

        const stored = await loadStoredMarketSnapshot(supabase, data.user.id);

        if (stored && stored.snapshot.length > 0) {
          return NextResponse.json(stored);
        }

        const refreshed = await refreshStoredMarketSnapshot({
          apiKey,
          assets: cloudSnapshot.assets,
          marketPreferences: effectivePreferences,
          supabase,
          userId: data.user.id,
        });

        return NextResponse.json(refreshed);
      }
    } catch {
      // Fall back to stateless market snapshots.
    }
  }

  if (preferredSource === "fallback") {
    return NextResponse.json(
      buildFallbackMarketResponse("Fallback-only mode selected from market preferences."),
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      buildFallbackMarketResponse(
        "Fallback market mode is active. Add ALPHA_VANTAGE_API_KEY when you are ready to pull live Alpha Vantage snapshots.",
      ),
    );
  }

  try {
    const snapshot = await fetchMarketSnapshot(apiKey, { forceRefresh });
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message} Falling back to built-in market data.`
        : "Live market snapshot failed. Falling back to built-in market data.";

    return NextResponse.json(buildFallbackMarketResponse(message));
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const payload = (await request.json()) as {
    assets?: PortfolioAsset[];
    preferredSource?: "alpha-vantage" | "fallback";
  };
  const assets = Array.isArray(payload.assets) ? payload.assets : [];

  if (payload.preferredSource === "fallback") {
    const watch = await buildHoldingsWatch(assets);
    return NextResponse.json({ holdingsWatch: watch });
  }

  try {
    const watch = await buildHoldingsWatch(assets, apiKey);
    return NextResponse.json({ holdingsWatch: watch });
  } catch {
    const watch = await buildHoldingsWatch(assets);
    return NextResponse.json({ holdingsWatch: watch });
  }
}

function getBearerToken(header: string | null) {
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
