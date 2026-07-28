import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadStoredMarketSnapshot,
  refreshStoredMarketSnapshot,
} from "../lib/market-snapshot-store";

describe("loadStoredMarketSnapshot", () => {
  it("maps a stored Supabase row back into the market snapshot response shape", async () => {
    const supabase = {
      from() {
        return {
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: {
              created_at: "2026-07-11T00:00:00.000Z",
              holdings_watch: [{ assetName: "Gold ETF", change: 0.2, mappedSymbol: "GLD", signal: "Gold proxy", type: "Gold" }],
              message: "Stored market snapshot.",
              preferred_source: "alpha-vantage",
              sectors: [{ name: "Banks", value: -0.1 }],
              sentiment: "Neutral",
              sentiment_score: 52,
              snapshot_tiles: [{ change: 0.4, name: "Global Equities", signal: "Broad market", value: "24,900" }],
              source: "alpha-vantage-cached",
              updated_at: "2026-07-11T00:05:00.000Z",
            },
            error: null,
          }),
          select() {
            return this;
          },
        };
      },
    } as const;

    const snapshot = await loadStoredMarketSnapshot(supabase as never, "user-1");

    assert.equal(snapshot?.source, "alpha-vantage-cached");
    assert.equal(snapshot?.holdingsWatch.length, 1);
    assert.equal(snapshot?.sentimentScore, 52);
    assert.equal(snapshot?.snapshot[0]?.name, "Global Equities");
  });
});

describe("refreshStoredMarketSnapshot", () => {
  it("builds and upserts a full per-user market snapshot", async () => {
    const operations: Array<{ payload: unknown; table: string }> = [];
    const supabase = {
      from(table: string) {
        return {
          upsert: async (payload: unknown) => {
            operations.push({ payload, table });
            return { error: null };
          },
        };
      },
    } as const;

    const snapshot = await refreshStoredMarketSnapshot({
      apiKey: undefined,
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Gold ETF",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Gold",
          value: 1000,
        },
      ],
      marketPreferences: {
        autoRefresh: true,
        includeHoldingsWatch: true,
        pollingIntervalSeconds: 60,
        preferredSource: "fallback",
        watchlist: [],
      },
      supabase: supabase as never,
      userId: "user-1",
    });

    assert.equal(snapshot.source, "fallback");
    assert.equal(snapshot.holdingsWatch.length, 1);
    assert.equal(operations[0]?.table, "market_snapshots");
    assert.deepEqual(operations[0]?.payload, {
      holdings_watch: snapshot.holdingsWatch,
      message: snapshot.message,
      preferred_source: "fallback",
      sectors: snapshot.sectors,
      sentiment: snapshot.sentiment,
      sentiment_score: snapshot.sentimentScore,
      snapshot_tiles: snapshot.snapshot,
      source: snapshot.source,
      updated_at: snapshot.updatedAt,
      user_id: "user-1",
    });
  });
});
