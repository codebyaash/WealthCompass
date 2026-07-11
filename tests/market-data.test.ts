import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHoldingsWatch,
  buildFallbackMarketResponse,
  calculateMarketSentiment,
  inferMarketProxyForAsset,
  inferMarketSymbolForAsset,
  parseAlphaVantageDailySeries,
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
