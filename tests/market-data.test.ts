import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHoldingsWatch,
  buildFallbackMarketResponse,
  calculateMarketSentiment,
  fetchMarketSnapshot,
  getMarketPortfolioNote,
  inferMarketProxyForAsset,
  inferMarketSymbolForAsset,
  parseAlphaVantageDailySeries,
  summarizeHoldingsWatch,
  summarizeSectorBreadth,
} from "../lib/market-data";

describe("calculateMarketSentiment", () => {
  it("maps changes to a bounded beginner sentiment summary", () => {
    const result = calculateMarketSentiment([
      { change: 1.5, name: "A", signal: "A", value: "100" },
      { change: 0.5, name: "B", signal: "B", value: "90" },
    ]);

    assert.equal(result.sentiment, "Constructive");
    assert.equal(result.sentimentScore, 66);
  });
});

describe("parseAlphaVantageDailySeries", () => {
  it("parses latest and previous closes into a daily percent move", () => {
    const parsed = parseAlphaVantageDailySeries({
      label: "Global Equities",
      response: {
        "Meta Data": {
          "3. Last Refreshed": "2026-07-11",
        },
        "Time Series (Daily)": {
          "2026-07-11": { "4. close": "510.00" },
          "2026-07-10": { "4. close": "500.00" },
        },
      },
      signal: "Broad market check",
    });

    assert.equal(parsed.change, 2);
    assert.equal(parsed.value, "510");
    assert.equal(parsed.updatedAt, "2026-07-11");
  });
});

describe("buildFallbackMarketResponse", () => {
  it("returns a full fallback payload", () => {
    const result = buildFallbackMarketResponse();

    assert.equal(result.snapshot.length, 4);
    assert.equal(result.sectors.length, 5);
    assert.deepEqual(result.holdingsWatch, []);
    assert.equal(result.source, "fallback");
  });
});

describe("inferMarketSymbolForAsset", () => {
  it("maps Indian broad-market holdings to India-aware proxies", () => {
    assert.equal(
      inferMarketSymbolForAsset({
        gain: 0,
        investedValue: 1000,
        name: "Nifty 50 Index Fund",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "Index Fund",
        value: 1000,
      }),
      "NIFTYBEES.BSE",
    );
  });

  it("maps sector and defensive holdings to useful proxy buckets", () => {
    assert.equal(
      inferMarketSymbolForAsset({
        gain: 0,
        investedValue: 1000,
        name: "Nifty Bank ETF",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "ETF",
        value: 1000,
      }),
      "BANKBEES.BSE",
    );
    assert.equal(
      inferMarketSymbolForAsset({
        gain: 0,
        investedValue: 1000,
        name: "Gold ETF",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "Gold",
        value: 1000,
      }),
      "GLD",
    );
    assert.equal(
      inferMarketSymbolForAsset({
        gain: 0,
        investedValue: 1000,
        name: "Liquid Fund",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "Debt",
        value: 1000,
      }),
      "IEF",
    );
  });

  it("returns fallback labels that explain the proxy choice", () => {
    const proxy = inferMarketProxyForAsset({
      gain: 0,
      investedValue: 1000,
      name: "Flexi Cap Fund",
      price: 100,
      quantity: 10,
      source: "Imported",
      type: "Equity",
      value: 1000,
    });

    assert.equal(proxy?.signal, "India equity proxy");
    assert.equal(proxy?.fallbackChange, 0.62);
  });
});

describe("buildHoldingsWatch", () => {
  it("returns fallback watch entries when no API key is present", async () => {
    const watch = await buildHoldingsWatch([
      {
        gain: 0,
        investedValue: 1000,
        name: "Gold Savings",
        price: 100,
        quantity: 10,
        source: "Imported",
        type: "Gold",
        value: 1000,
      },
    ]);

    assert.equal(watch.length, 1);
    assert.equal(watch[0]?.mappedSymbol, "GLD");
    assert.equal(watch[0]?.signal, "Gold proxy");
  });
});

describe("summarizeHoldingsWatch", () => {
  it("calculates indicative totals and lead movers from watched holdings", () => {
    const summary = summarizeHoldingsWatch(
      [
        {
          assetName: "Gold Savings",
          change: 2,
          mappedSymbol: "GLD",
          signal: "Gold proxy",
          type: "Gold",
        },
        {
          assetName: "Liquid Fund",
          change: -1,
          mappedSymbol: "IEF",
          signal: "Debt proxy",
          type: "Debt",
        },
      ],
      [
        {
          gain: 0,
          investedValue: 1000,
          name: "Gold Savings",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Gold",
          value: 1000,
        },
        {
          gain: 0,
          investedValue: 2000,
          name: "Liquid Fund",
          price: 100,
          quantity: 20,
          source: "Imported",
          type: "Debt",
          value: 2000,
        },
      ],
    );

    assert.equal(summary.trackedTotal, 3000);
    assert.equal(summary.updatedTotal, 3000);
    assert.equal(summary.deltaPercent, 0);
    assert.equal(summary.leadMover, "Gold Savings");
    assert.equal(summary.lagMover, "Liquid Fund");
  });
});

describe("summarizeSectorBreadth", () => {
  it("counts advancing and declining sectors and identifies extremes", () => {
    const summary = summarizeSectorBreadth([
      { name: "Banks", value: -0.2 },
      { name: "IT", value: 0.9 },
      { name: "Energy", value: 1.1 },
      { name: "Pharma", value: 0 },
    ]);

    assert.deepEqual(summary, {
      advancing: 2,
      declining: 1,
      flat: 1,
      strongest: "Energy",
      weakest: "Banks",
    });
  });
});

describe("getMarketPortfolioNote", () => {
  it("flags meaningful positive participation in the watched portfolio", () => {
    const note = getMarketPortfolioNote({
      holdingsWatch: {
        deltaPercent: 1.6,
        deltaValue: 1600,
        items: [],
        lagMover: "Debt Fund",
        leadMover: "Index Core",
        trackedTotal: 100000,
        updatedTotal: 101600,
      },
      sectorBreadth: {
        advancing: 4,
        declining: 1,
        flat: 0,
        strongest: "IT",
        weakest: "Banks",
      },
      sentiment: "Constructive",
    });

    assert.equal(note.title, "Your tracked watch is broadly participating");
    assert.match(note.detail, /Index Core/);
  });
});

describe("fetchMarketSnapshot", () => {
  it("deduplicates repeated Alpha Vantage symbols within one snapshot build", async () => {
    const requestedSymbols: string[] = [];
    const response = {
      "Meta Data": {
        "3. Last Refreshed": "2026-07-11",
      },
      "Time Series (Daily)": {
        "2026-07-11": { "4. close": "101.00" },
        "2026-07-10": { "4. close": "100.00" },
      },
    };

    await fetchMarketSnapshot("test-key-dedupe", {
      fetchDaily: async (symbol) => {
        requestedSymbols.push(symbol);
        return response;
      },
      forceRefresh: true,
      now: 1,
    });

    assert.equal(requestedSymbols.filter((symbol) => symbol === "XLF").length, 1);
    assert.equal(new Set(requestedSymbols).size, requestedSymbols.length);
  });

  it("returns the latest cached live snapshot when a forced refresh fails", async () => {
    const seedResponse = {
      "Meta Data": {
        "3. Last Refreshed": "2026-07-11",
      },
      "Time Series (Daily)": {
        "2026-07-11": { "4. close": "110.00" },
        "2026-07-10": { "4. close": "100.00" },
      },
    };

    await fetchMarketSnapshot("test-key-stale", {
      fetchDaily: async () => seedResponse,
      forceRefresh: true,
      now: 10,
    });

    const stale = await fetchMarketSnapshot("test-key-stale", {
      fetchDaily: async () => {
        throw new Error("Alpha Vantage rate limit reached.");
      },
      forceRefresh: true,
      now: 20,
    });

    assert.equal(stale.source, "alpha-vantage-cached");
    assert.match(stale.message, /cached live snapshot/i);
  });
});
