import type { PortfolioAsset } from "@/lib/local-storage";
import { NextResponse } from "next/server";
import {
  buildHoldingsWatch,
  buildFallbackMarketResponse,
  fetchMarketSnapshot,
} from "@/lib/market-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferredSource = url.searchParams.get("source");
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

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
    const snapshot = await fetchMarketSnapshot(apiKey);
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
