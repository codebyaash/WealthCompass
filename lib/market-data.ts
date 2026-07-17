import type { PortfolioAsset } from "./local-storage";

export type MarketTile = {
  change: number;
  name: string;
  signal: string;
  value: string;
};

export type SectorMove = {
  name: string;
  value: number;
};

export type MarketSnapshotResponse = {
  holdingsWatch: HoldingWatchItem[];
  message: string;
  sectors: SectorMove[];
  sentiment: string;
  sentimentScore: number;
  snapshot: MarketTile[];
  source: string;
  updatedAt: string;
};

export type HoldingWatchItem = {
  assetName: string;
  change: number;
  mappedSymbol: string | null;
  signal: string;
  type: string;
};

export type HoldingsWatchSummary = {
  deltaPercent: number;
  deltaValue: number;
  items: Array<
    HoldingWatchItem & {
      indicativeValue: number;
      trackedValue: number;
    }
  >;
  leadMover: string | null;
  lagMover: string | null;
  trackedTotal: number;
  updatedTotal: number;
};

export type SectorBreadthSummary = {
  advancing: number;
  declining: number;
  flat: number;
  strongest: string | null;
  weakest: string | null;
};

type AlphaVantageDailyResponse = {
  "Error Message"?: string;
  "Information"?: string;
  "Meta Data"?: {
    "3. Last Refreshed"?: string;
  };
  "Note"?: string;
  "Time Series (Daily)"?: Record<
    string,
    {
      "4. close"?: string;
    }
  >;
};

type MarketProxy = {
  fallbackChange: number;
  signal: string;
  symbol: string;
};

type FetchMarketSnapshotOptions = {
  fetchDaily?: (symbol: string, apiKey: string) => Promise<AlphaVantageDailyResponse>;
  forceRefresh?: boolean;
  now?: number;
};

type CachedMarketSnapshot = {
  fetchedAt: number;
  snapshot: MarketSnapshotResponse;
  staleUntil: number;
};

type CachedDailySeries = {
  expiresAt: number;
  response: AlphaVantageDailyResponse;
};

const marketProxyRules: Array<{
  proxy: MarketProxy;
  pattern: RegExp;
}> = [
  {
    pattern: /nifty\s*bank|bank\s*nifty|bankbees|bank|financial|psu\s*bank/i,
    proxy: {
      fallbackChange: -0.28,
      signal: "India financials proxy",
      symbol: "BANKBEES.BSE",
    },
  },
  {
    pattern: /gold|goldbees|sovereign\s*gold|sgb/i,
    proxy: {
      fallbackChange: 0.18,
      signal: "Gold proxy",
      symbol: "GLD",
    },
  },
  {
    pattern: /debt|liquid|bond|gilt|overnight|money\s*market|cash|fd|fixed\s*deposit/i,
    proxy: {
      fallbackChange: -0.12,
      signal: "Debt and cash proxy",
      symbol: "IEF",
    },
  },
  {
    pattern: /nifty\s*50|nifty|sensex|index|index\s*fund|niftybees|etf/i,
    proxy: {
      fallbackChange: 0.72,
      signal: "India broad-market proxy",
      symbol: "NIFTYBEES.BSE",
    },
  },
  {
    pattern: /nifty\s*next|midcap|smallcap|flexi\s*cap|large\s*cap|equity|stock|share/i,
    proxy: {
      fallbackChange: 0.62,
      signal: "India equity proxy",
      symbol: "SPY",
    },
  },
  {
    pattern: /it|technology|tech|software/i,
    proxy: {
      fallbackChange: 0.9,
      signal: "Technology proxy",
      symbol: "XLK",
    },
  },
  {
    pattern: /pharma|healthcare|health/i,
    proxy: {
      fallbackChange: 0.6,
      signal: "Healthcare proxy",
      symbol: "XLV",
    },
  },
  {
    pattern: /energy|oil|gas|power|infra|infrastructure/i,
    proxy: {
      fallbackChange: 1.1,
      signal: "Energy and infrastructure proxy",
      symbol: "XLE",
    },
  },
  {
    pattern: /fmcg|consumer|consumption/i,
    proxy: {
      fallbackChange: 0.4,
      signal: "Consumer staples proxy",
      symbol: "XLP",
    },
  },
];

const fallbackSnapshot: MarketTile[] = [
  {
    change: 0.72,
    name: "Global Equities",
    signal: "Broad market strength",
    value: "24,860",
  },
  {
    change: -0.28,
    name: "Financials",
    signal: "Rate-sensitive pause",
    value: "52,140",
  },
  {
    change: 0.18,
    name: "Gold",
    signal: "Defensive demand steady",
    value: "74,200",
  },
  {
    change: -0.12,
    name: "Bonds",
    signal: "Yield stable",
    value: "6.91%",
  },
];

const fallbackSectors: SectorMove[] = [
  { name: "Banks", value: -0.2 },
  { name: "IT", value: 0.9 },
  { name: "FMCG", value: 0.4 },
  { name: "Energy", value: 1.1 },
  { name: "Pharma", value: 0.6 },
];

const ALPHA_VANTAGE_DAILY_TTL_MS = 15 * 60_000;
const MARKET_SNAPSHOT_TTL_MS = 5 * 60_000;
const MARKET_SNAPSHOT_STALE_MS = 60 * 60_000;
const alphaVantageDailyCache = new Map<string, CachedDailySeries>();
const marketSnapshotCache = new Map<string, CachedMarketSnapshot>();

export function calculateMarketSentiment(snapshot: MarketTile[]) {
  const sentimentScore = Math.round(50 + snapshot.reduce((sum, item) => sum + item.change, 0) * 8);
  const sentiment =
    sentimentScore >= 58 ? "Constructive" : sentimentScore <= 44 ? "Cautious" : "Neutral";

  return { sentiment, sentimentScore };
}

export function buildFallbackMarketResponse(message = "Using built-in market snapshot.") {
  const { sentiment, sentimentScore } = calculateMarketSentiment(fallbackSnapshot);

  return {
    holdingsWatch: [],
    message,
    sectors: fallbackSectors,
    sentiment,
    sentimentScore,
    snapshot: fallbackSnapshot,
    source: "fallback",
    updatedAt: new Date().toISOString(),
  } satisfies MarketSnapshotResponse;
}

export function summarizeHoldingsWatch(
  holdingsWatch: HoldingWatchItem[],
  assets: PortfolioAsset[],
): HoldingsWatchSummary {
  const items = holdingsWatch.map((item) => {
    const asset = assets.find(
      (current) => current.name === item.assetName && current.type === item.type,
    );
    const trackedValue = asset?.value ?? 0;
    const indicativeValue = trackedValue * (1 + item.change / 100);

    return {
      ...item,
      indicativeValue,
      trackedValue,
    };
  });

  const trackedTotal = items.reduce((sum, item) => sum + item.trackedValue, 0);
  const updatedTotal = items.reduce((sum, item) => sum + item.indicativeValue, 0);
  const deltaValue = updatedTotal - trackedTotal;
  const deltaPercent =
    trackedTotal > 0 ? Number(((deltaValue / trackedTotal) * 100).toFixed(2)) : 0;
  const sortedByMove = [...items].sort((left, right) => right.change - left.change);

  return {
    deltaPercent,
    deltaValue,
    items,
    lagMover: sortedByMove.at(-1)?.assetName ?? null,
    leadMover: sortedByMove[0]?.assetName ?? null,
    trackedTotal,
    updatedTotal,
  };
}

export function summarizeSectorBreadth(sectors: SectorMove[]): SectorBreadthSummary {
  const sorted = [...sectors].sort((left, right) => right.value - left.value);

  return {
    advancing: sectors.filter((sector) => sector.value > 0).length,
    declining: sectors.filter((sector) => sector.value < 0).length,
    flat: sectors.filter((sector) => sector.value === 0).length,
    strongest: sorted[0]?.name ?? null,
    weakest: sorted.at(-1)?.name ?? null,
  };
}

export function getMarketPortfolioNote({
  holdingsWatch,
  sectorBreadth,
  sentiment,
}: {
  holdingsWatch: HoldingsWatchSummary;
  sectorBreadth: SectorBreadthSummary;
  sentiment: string;
}) {
  if (holdingsWatch.trackedTotal <= 0) {
    return {
      detail: "Add holdings to compare your tracked portfolio with the current market tone.",
      title: "No portfolio-linked market read yet",
    };
  }

  if (Math.abs(holdingsWatch.deltaPercent) >= 1) {
    return {
      detail: `Your watched holdings are moving about ${holdingsWatch.deltaPercent > 0 ? "+" : ""}${holdingsWatch.deltaPercent.toFixed(2)}% on a best-effort basis, led by ${holdingsWatch.deltaPercent > 0 ? holdingsWatch.leadMover ?? "the strongest proxy" : holdingsWatch.lagMover ?? "the weakest proxy"}.`,
      title:
        holdingsWatch.deltaPercent > 0
          ? "Your tracked watch is broadly participating"
          : "Your tracked watch is feeling the softness",
    };
  }

  if (sectorBreadth.advancing >= sectorBreadth.declining + 2) {
    return {
      detail: `Breadth is positive with ${sectorBreadth.advancing} advancing sectors versus ${sectorBreadth.declining} laggards. ${sectorBreadth.strongest ? `${sectorBreadth.strongest} is leading.` : ""}`.trim(),
      title: "The market is stronger than the headlines alone suggest",
    };
  }

  if (sentiment === "Cautious") {
    return {
      detail: `Breadth is soft and ${sectorBreadth.weakest ? `${sectorBreadth.weakest} is the weakest pocket right now.` : "several sectors are lagging."} Use this as a prompt to review allocation, not as a prompt to improvise trades.`,
      title: "This is more of a risk-check day than an action day",
    };
  }

  return {
    detail: "Market conditions look mixed, so staying close to your plan matters more than squeezing meaning out of every tick.",
    title: "Nothing urgent is demanding a portfolio change",
  };
}

export function parseAlphaVantageDailySeries({
  label,
  response,
  signal,
  symbol,
  style = "currency",
}: {
  label: string;
  response: AlphaVantageDailyResponse;
  signal: string;
  symbol?: string;
  style?: "currency" | "percent";
}) {
  const series = response["Time Series (Daily)"];

  if (!series) {
    throw new Error(response.Note ?? `Missing daily series for ${label}.`);
  }

  const dates = Object.keys(series).sort((left, right) => right.localeCompare(left));
  const latest = dates[0];
  const previous = dates[1] ?? dates[0];
  const latestClose = Number(series[latest]?.["4. close"]);
  const previousClose = Number(series[previous]?.["4. close"]);

  if (!Number.isFinite(latestClose) || !Number.isFinite(previousClose) || previousClose === 0) {
    throw new Error(`Missing close values for ${label}.`);
  }

  return {
    change: Number((((latestClose - previousClose) / previousClose) * 100).toFixed(2)),
    name: label,
    signal,
    symbol,
    updatedAt: response["Meta Data"]?.["3. Last Refreshed"] ?? latest,
    value:
      style === "percent"
        ? `${latestClose.toFixed(2)}%`
        : latestClose.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          }),
  };
}

export async function fetchMarketSnapshot(
  apiKey: string,
  {
    fetchDaily = fetchAlphaVantageDaily,
    forceRefresh = false,
    now = Date.now(),
  }: FetchMarketSnapshotOptions = {},
) {
  const snapshotSources = [
    { label: "Global Equities", signal: "Broad market check", symbol: "SPY" },
    { label: "Financials", signal: "Rate-sensitive pulse", symbol: "XLF" },
    { label: "Gold", signal: "Defensive demand", symbol: "GLD" },
    { label: "Bonds", signal: "Duration mood", symbol: "IEF" },
  ];
  const sectorSources = [
    { label: "Banks", symbol: "XLF" },
    { label: "IT", symbol: "XLK" },
    { label: "FMCG", symbol: "XLP" },
    { label: "Energy", symbol: "XLE" },
    { label: "Pharma", symbol: "XLV" },
  ];

  const cachedSnapshot = marketSnapshotCache.get(apiKey);

  if (!forceRefresh && cachedSnapshot && cachedSnapshot.fetchedAt + MARKET_SNAPSHOT_TTL_MS > now) {
    return cachedSnapshot.snapshot;
  }

  const uniqueSymbols = [...new Set([
    ...snapshotSources.map((item) => item.symbol),
    ...sectorSources.map((item) => item.symbol),
  ])];

  try {
    const responses = new Map(
      await Promise.all(
        uniqueSymbols.map(async (symbol) => [
          symbol,
          await fetchDaily(symbol, apiKey),
        ] as const),
      ),
    );

    const snapshot = snapshotSources.map((item) =>
      parseAlphaVantageDailySeries({
        label: item.label,
        response: responses.get(item.symbol) ?? {},
        signal: item.signal,
      }),
    );

    const sectors = sectorSources.map((item) => {
      const parsed = parseAlphaVantageDailySeries({
        label: item.label,
        response: responses.get(item.symbol) ?? {},
        signal: item.label,
      });

      return {
        name: item.label,
        value: parsed.change,
      };
    });

    const { sentiment, sentimentScore } = calculateMarketSentiment(snapshot);
    const nextSnapshot = {
      holdingsWatch: [],
      message: forceRefresh
        ? "Fresh live market snapshot loaded from Alpha Vantage."
        : "Live market snapshot loaded from Alpha Vantage.",
      sectors,
      sentiment,
      sentimentScore,
      snapshot,
      source: "alpha-vantage",
      updatedAt:
        snapshot.map((item) => item.updatedAt).sort().at(-1) ?? new Date(now).toISOString(),
    } satisfies MarketSnapshotResponse;

    marketSnapshotCache.set(apiKey, {
      fetchedAt: now,
      snapshot: nextSnapshot,
      staleUntil: now + MARKET_SNAPSHOT_STALE_MS,
    });

    return nextSnapshot;
  } catch (error) {
    if (cachedSnapshot && cachedSnapshot.staleUntil > now) {
      return {
        ...cachedSnapshot.snapshot,
        message: `${getMarketErrorMessage(error)} Showing the latest cached live snapshot while Alpha Vantage recovers.`,
        source: "alpha-vantage-cached",
      } satisfies MarketSnapshotResponse;
    }

    throw error;
  }
}

export async function buildHoldingsWatch(
  assets: PortfolioAsset[],
  apiKey?: string,
) {
  const watchTargets = assets
    .map((asset) => ({
      asset,
      symbol: inferMarketSymbolForAsset(asset),
    }))
    .filter((item): item is { asset: PortfolioAsset; symbol: string } => Boolean(item.symbol))
    .slice(0, 4);

  if (watchTargets.length === 0) {
    return [];
  }

  if (!apiKey) {
    return watchTargets.map(({ asset, symbol }) => ({
      assetName: asset.name,
      change: fallbackChangeForAsset(asset),
      mappedSymbol: symbol,
      signal: inferMarketProxyForAsset(asset)?.signal ?? "Fallback holding map",
      type: asset.type,
    }));
  }

  return Promise.all(
    watchTargets.map(async ({ asset, symbol }) => {
      try {
        const response = await fetchAlphaVantageDaily(symbol, apiKey);
        const parsed = parseAlphaVantageDailySeries({
          label: asset.name,
          response,
          signal: `${asset.type} watch`,
          symbol,
        });

        return {
          assetName: asset.name,
          change: parsed.change,
          mappedSymbol: symbol,
          signal: `${asset.type} watch`,
          type: asset.type,
        } satisfies HoldingWatchItem;
      } catch {
        return {
          assetName: asset.name,
          change: fallbackChangeForAsset(asset),
          mappedSymbol: symbol,
          signal: inferMarketProxyForAsset(asset)?.signal ?? "Fallback holding map",
          type: asset.type,
        } satisfies HoldingWatchItem;
      }
    }),
  );
}

export function inferMarketSymbolForAsset(asset: PortfolioAsset) {
  return inferMarketProxyForAsset(asset)?.symbol ?? null;
}

export function inferMarketProxyForAsset(asset: PortfolioAsset): MarketProxy | null {
  const normalized = `${asset.name} ${asset.type}`.toLowerCase();
  const rule = marketProxyRules.find((item) => item.pattern.test(normalized));

  return rule?.proxy ?? null;
}

function fallbackChangeForAsset(asset: PortfolioAsset) {
  const proxy = inferMarketProxyForAsset(asset);

  return proxy?.fallbackChange ?? 0;
}

async function fetchAlphaVantageDaily(symbol: string, apiKey: string) {
  const cacheKey = `${apiKey}:${symbol}`;
  const now = Date.now();
  const cached = alphaVantageDailyCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.response;
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Market request failed for ${symbol}.`);
  }

  const payload = (await response.json()) as AlphaVantageDailyResponse;

  if (payload.Note?.trim()) {
    throw new Error("Alpha Vantage rate limit reached.");
  }

  if (payload.Information?.trim()) {
    throw new Error(payload.Information);
  }

  if (payload["Error Message"]?.trim()) {
    throw new Error(payload["Error Message"]);
  }

  alphaVantageDailyCache.set(cacheKey, {
    expiresAt: now + ALPHA_VANTAGE_DAILY_TTL_MS,
    response: payload,
  });

  return payload;
}

function getMarketErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Live market snapshot could not be refreshed.";
}
