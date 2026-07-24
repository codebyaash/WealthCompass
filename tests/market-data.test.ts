import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketActionItems,
  buildMarketNowVsSuggestedConversation,
  buildMarketRegimeStrip,
  buildSubSectorDrilldownRows,
  buildTrendWindow,
  buildSuggestedSectorFitSummary,
  buildSectorGroups,
  buildSuggestedSectorReasons,
  buildSuggestedSectorSnapshot,
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
    assert.equal(result.sectors.length, 11);
    assert.deepEqual(result.holdingsWatch, []);
    assert.equal(result.source, "fallback");
  });
});

describe("buildSectorGroups", () => {
  it("expands flat sector moves into sector groups with trends and sub-sectors", () => {
    const groups = buildSectorGroups([
      { name: "Financials", value: -0.2 },
      { name: "Information Technology", value: 0.9 },
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.id, "banks");
    assert.equal(groups[0]?.subSectors.length, 5);
    assert.equal(groups[1]?.trend.length, 5);
  });

  it("keeps utilities distinct from information technology aliases", () => {
    const groups = buildSectorGroups([{ name: "Utilities", value: 0.22 }]);

    assert.equal(groups[0]?.id, "utilities");
    assert.equal(groups[0]?.name, "Utilities");
  });
});

describe("buildSuggestedSectorSnapshot", () => {
  it("returns a ranked suggested-sector view from sector groups and profile context", () => {
    const snapshot = buildSuggestedSectorSnapshot({
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Technology Opportunities Fund",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Equity",
          value: 1000,
        },
      ],
      profileBand: "Balanced",
      sectorGroups: buildSectorGroups([
        { name: "Banks", value: 0.3 },
        { name: "IT", value: 1.1 },
        { name: "Pharma", value: 0.5 },
      ]),
    });

    assert.match(snapshot.headline, /Suggested sectors/i);
    assert.equal(snapshot.sectors.length, 3);
    assert.equal(snapshot.topSuggestions.length, 3);
    assert.equal(snapshot.trend.length, 5);
  });
});

describe("buildMarketNowVsSuggestedConversation", () => {
  it("creates a plain-language now-versus-suggested read from the same market inputs", () => {
    const suggestedSnapshot = buildSuggestedSectorSnapshot({
      assets: [],
      profileBand: "Balanced",
      sectorGroups: buildSectorGroups([
        { name: "Banks", value: 0.3 },
        { name: "IT", value: 1.1 },
        { name: "Pharma", value: 0.5 },
      ]),
    });

    const conversation = buildMarketNowVsSuggestedConversation({
      sectorGroups: buildSectorGroups([
        { name: "Banks", value: 0.3 },
        { name: "IT", value: 1.1 },
        { name: "Pharma", value: 0.5 },
      ]),
      sectorBreadth: {
        advancing: 3,
        declining: 1,
        flat: 0,
        strongest: "IT",
        weakest: "Banks",
      },
      sentiment: "Constructive",
      suggestedSnapshot,
    });

    assert.equal(conversation.length, 3);
    assert.equal(conversation[0]?.title, "Now");
    assert.equal(conversation[1]?.title, "Suggested");
    assert.equal(conversation[0]?.sectorId, "it");
    assert.equal(conversation[1]?.sectorId, suggestedSnapshot.topSuggestions[0]?.id);
    assert.match(conversation[0]?.nextStep ?? "", /check|use/i);
    assert.equal(conversation[1]?.emphasis, "high");
    assert.match(conversation[2]?.body ?? "", /same market data/i);
  });
});

describe("buildSuggestedSectorReasons", () => {
  it("explains why a selected suggested sector fits the current portfolio context", () => {
    const suggested = buildSuggestedSectorSnapshot({
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Technology Opportunities Fund",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Equity",
          value: 1000,
        },
      ],
      profileBand: "Growth",
      sectorGroups: buildSectorGroups([
        { name: "IT", value: 1.1 },
        { name: "Banks", value: 0.3 },
      ]),
    });

    const reasons = buildSuggestedSectorReasons({
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Technology Opportunities Fund",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Equity",
          value: 1000,
        },
      ],
      profileBand: "Growth",
      selectedSector: suggested.sectors[0] ?? null,
    });

    assert.equal(reasons.length, 3);
    assert.match(reasons[0]?.title ?? "", /already own|adds perspective/i);
    assert.match(reasons[1]?.detail ?? "", /growth/i);
  });
});

describe("buildSuggestedSectorFitSummary", () => {
  it("shows where the current portfolio is missing or underweight versus suggested sectors", () => {
    const suggestedSnapshot = buildSuggestedSectorSnapshot({
      assets: [],
      profileBand: "Balanced",
      sectorGroups: buildSectorGroups([
        { name: "Information Technology", value: 1.2 },
        { name: "Health Care", value: 0.8 },
        { name: "Financials", value: 0.4 },
      ]),
    });

    const fit = buildSuggestedSectorFitSummary({
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Large Cap Banking Fund",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Equity",
          value: 1000,
        },
      ],
      suggestedSnapshot,
    });

    assert.equal(fit.rows.length, 3);
    assert.equal(fit.rows[0]?.id, "it");
    assert.equal(fit.rows[0]?.status, "missing");
    assert.equal(fit.rows[2]?.id, "banks");
    assert.equal(fit.rows[2]?.status, "ahead");
    assert.ok(fit.coverageShare > 0);
  });
});

describe("buildSubSectorDrilldownRows", () => {
  it("sorts sub-sectors by strength and labels their tone", () => {
    const rows = buildSubSectorDrilldownRows([
      { name: "Payments", signal: "sub-sector pulse", value: 0.05 },
      { name: "Private banks", signal: "sub-sector pulse", value: 0.72 },
      { name: "Insurance", signal: "sub-sector pulse", value: -0.22 },
    ]);

    assert.equal(rows[0]?.name, "Private banks");
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[0]?.tone, "leader");
    assert.equal(rows[2]?.name, "Insurance");
    assert.equal(rows[2]?.tone, "soft");
  });
});

describe("buildMarketRegimeStrip", () => {
  it("summarizes the current leader, defensive pocket, laggard, and watchlist sector", () => {
    const sectorGroups = buildSectorGroups([
      { name: "Information Technology", value: 1.2 },
      { name: "Health Care", value: 0.5 },
      { name: "Financials", value: -0.3 },
    ]);
    const suggestedSnapshot = buildSuggestedSectorSnapshot({
      assets: [],
      profileBand: "Balanced",
      sectorGroups,
    });

    const regime = buildMarketRegimeStrip({
      sectorGroups,
      suggestedSnapshot,
    });

    assert.equal(regime.leader, "Information Technology");
    assert.equal(regime.defensive, "Health Care");
    assert.equal(regime.laggard, "Financials");
    assert.ok(regime.watchlist);
    assert.match(regime.headline, /leading the tape/i);
  });
});

describe("buildMarketActionItems", () => {
  it("turns the market regime and fit gaps into study, watch, and restraint actions", () => {
    const sectorGroups = buildSectorGroups([
      { name: "Information Technology", value: 1.2 },
      { name: "Health Care", value: 0.5 },
      { name: "Financials", value: -0.3 },
    ]);
    const suggestedSnapshot = buildSuggestedSectorSnapshot({
      assets: [],
      profileBand: "Balanced",
      sectorGroups,
    });
    const fit = buildSuggestedSectorFitSummary({
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Large Cap Banking Fund",
          price: 100,
          quantity: 10,
          source: "Imported",
          type: "Equity",
          value: 1000,
        },
      ],
      suggestedSnapshot,
    });
    const regime = buildMarketRegimeStrip({
      sectorGroups,
      suggestedSnapshot,
    });

    const actions = buildMarketActionItems({
      marketTrackTitle: "Market context",
      regime,
      selectedSector: sectorGroups[0] ?? null,
      selectedSuggestedSector: suggestedSnapshot.topSuggestions[0] ?? null,
      sentiment: "Constructive",
      suggestedFit: fit,
    });

    assert.equal(actions.length, 3);
    assert.equal(actions[0]?.title, "Study next");
    assert.match(actions[0]?.cta ?? "", /Study/);
    assert.match(actions[0]?.nextStep ?? "", /Open/i);
    assert.ok(actions[0]?.sectorId);
    assert.equal(actions[1]?.title, "Watch, don’t chase");
    assert.equal(actions[2]?.title, "Do nothing impulsive");
  });
});

describe("buildTrendWindow", () => {
  it("reshapes the same sector trend into day, week, and month views", () => {
    const trend = [
      { label: "5D", value: 0.2 },
      { label: "4D", value: 0.4 },
      { label: "3D", value: 0.6 },
      { label: "2D", value: 0.8 },
      { label: "Today", value: 1.1 },
    ];

    assert.equal(buildTrendWindow(trend, "1w").length, 5);
    assert.equal(buildTrendWindow(trend, "1d")[0]?.label, "Open");
    assert.equal(buildTrendWindow(trend, "1d").at(-1)?.label, "Now");
    assert.equal(buildTrendWindow(trend, "1m")[0]?.label, "W1");
    assert.equal(buildTrendWindow(trend, "1m").length, 5);
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
