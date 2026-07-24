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

export type SectorTrendPoint = {
  label: string;
  value: number;
};

export type SectorSubMove = SectorMove & {
  signal: string;
};

export type SectorGroup = {
  change: number;
  id: string;
  name: string;
  rationale: string;
  subSectors: SectorSubMove[];
  topIdea: string;
  trend: SectorTrendPoint[];
};

export type SuggestedSectorIdea = {
  change: number;
  id: string;
  name: string;
  reason: string;
  strongestSubSector: string;
  topIdea: string;
};

export type SuggestedSectorSnapshot = {
  description: string;
  headline: string;
  sectors: SuggestedSectorIdea[];
  topSuggestions: SuggestedSectorIdea[];
  trend: SectorTrendPoint[];
};

export type MarketConversationTurn = {
  actionLabel?: string;
  body: string;
  emphasis: "high" | "low" | "medium";
  nextStep: string;
  sectorId?: string;
  speaker: "now" | "suggested" | "mentor";
  title: string;
};

export type SuggestedSectorReason = {
  caption: string;
  detail: string;
  title: string;
};

export type SuggestedSectorFitRow = {
  currentShare: number;
  currentValue: number;
  gapToSuggested: number;
  id: string;
  name: string;
  note: string;
  status: "ahead" | "aligned" | "missing" | "underweight";
  suggestedShare: number;
};

export type SuggestedSectorFitSummary = {
  coverageShare: number;
  headline: string;
  rows: SuggestedSectorFitRow[];
};

export type SubSectorDrilldownRow = {
  guidance: string;
  move: number;
  name: string;
  rank: number;
  signal: string;
  tone: "leader" | "mixed" | "soft";
};

export type MarketRegimeStrip = {
  defensive: string | null;
  headline: string;
  laggard: string | null;
  leader: string | null;
  watchlist: string | null;
};

export type MarketTrendWindow = "1d" | "1m" | "1w";

export type MarketActionItem = {
  cta: string;
  detail: string;
  emphasis: "high" | "low" | "medium";
  nextStep: string;
  sectorId?: string;
  title: string;
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
  {
    pattern: /consumer\s*discretionary|retail|auto|automotive|hospitality|travel|leisure|apparel/i,
    proxy: {
      fallbackChange: 0.58,
      signal: "Consumer discretionary proxy",
      symbol: "XLY",
    },
  },
  {
    pattern: /communication|telecom|media|entertainment|interactive/i,
    proxy: {
      fallbackChange: 0.47,
      signal: "Communication services proxy",
      symbol: "XLC",
    },
  },
  {
    pattern: /industrial|industrials|machinery|aerospace|defense|transport|logistics|construction/i,
    proxy: {
      fallbackChange: 0.51,
      signal: "Industrials proxy",
      symbol: "XLI",
    },
  },
  {
    pattern: /materials|mining|chemical|chemicals|cement|metal|packaging/i,
    proxy: {
      fallbackChange: 0.36,
      signal: "Materials proxy",
      symbol: "XLB",
    },
  },
  {
    pattern: /utility|utilities|electricity|water|gas\s*distribution/i,
    proxy: {
      fallbackChange: 0.22,
      signal: "Utilities proxy",
      symbol: "XLU",
    },
  },
  {
    pattern: /real\s*estate|reit|property|realty/i,
    proxy: {
      fallbackChange: 0.31,
      signal: "Real estate proxy",
      symbol: "XLRE",
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
  { name: "Information Technology", value: 0.9 },
  { name: "Financials", value: -0.2 },
  { name: "Health Care", value: 0.6 },
  { name: "Consumer Discretionary", value: 0.58 },
  { name: "Consumer Staples", value: 0.4 },
  { name: "Communication Services", value: 0.47 },
  { name: "Industrials", value: 0.51 },
  { name: "Energy", value: 1.1 },
  { name: "Materials", value: 0.36 },
  { name: "Utilities", value: 0.22 },
  { name: "Real Estate", value: 0.31 },
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

const sectorGroupTemplates: Array<{
  aliases: string[];
  id: string;
  rationale: string;
  subSectorNames: string[];
  topIdea: string;
}> = [
  {
    aliases: ["banks", "bank", "financials", "finance"],
    id: "banks",
    rationale:
      "Financials often tell you whether credit appetite, funding comfort, and domestic risk-taking are broadening or tightening.",
    subSectorNames: [
      "Private banks",
      "NBFCs",
      "Insurance",
      "Capital markets",
      "Payments",
    ],
    topIdea: "Private banks and market infrastructure usually deserve the first look when financial breadth improves.",
  },
  {
    aliases: ["information technology", "it", "technology", "tech"],
    id: "it",
    rationale:
      "Technology leadership usually signals stronger growth appetite, but the move can narrow quickly if only a few heavy names are carrying it.",
    subSectorNames: [
      "Software services",
      "Cloud and SaaS",
      "Digital engineering",
      "AI platforms",
      "IT consulting",
    ],
    topIdea: "Software services and platform names tend to be the cleaner read before smaller speculative tech pockets.",
  },
  {
    aliases: ["consumer staples", "fmcg", "staples", "consumption"],
    id: "fmcg",
    rationale:
      "Consumer staples and everyday consumption help show whether the market is rewarding steadier demand over faster growth narratives.",
    subSectorNames: [
      "Staples",
      "Personal care",
      "Household products",
      "Quick-service retail",
      "Distribution",
    ],
    topIdea: "Staples and household brands usually matter most here because they reflect resilient demand, not just optimism.",
  },
  {
    aliases: ["energy", "power", "oil", "gas", "infra", "infrastructure"],
    id: "energy",
    rationale:
      "Energy and infrastructure momentum usually matters when the market is leaning into capex, utilities, and industrial follow-through.",
    subSectorNames: [
      "Upstream energy",
      "Refining and gas",
      "Utilities",
      "Renewables",
      "Power equipment",
    ],
    topIdea: "Utilities and power-equipment names often give the cleaner signal before cyclical energy momentum gets noisy.",
  },
  {
    aliases: ["health care", "pharma", "healthcare", "health"],
    id: "pharma",
    rationale:
      "Healthcare strength can mean the market wants earnings resilience and defensiveness without giving up growth entirely.",
    subSectorNames: [
      "Formulations",
      "Hospitals",
      "Diagnostics",
      "CDMO",
      "Medical devices",
    ],
    topIdea: "Diagnostics and diversified pharma leaders are often the most readable starting points when healthcare is firm.",
  },
  {
    aliases: ["consumer discretionary", "retail", "hospitality", "automotive", "travel", "apparel"],
    id: "consumer-discretionary",
    rationale:
      "Consumer discretionary strength helps show whether the market is rewarding spending confidence, cyclicality, and demand beyond essentials.",
    subSectorNames: [
      "Automotive",
      "Retail",
      "Hospitality",
      "E-commerce",
      "Apparel",
    ],
    topIdea: "Retail and leading auto names usually give the cleanest read before smaller consumption stories get noisy.",
  },
  {
    aliases: ["communication services", "communication", "telecom", "media", "entertainment"],
    id: "communication-services",
    rationale:
      "Communication services show whether the market is leaning into telecom stability, media demand, and platform-driven engagement.",
    subSectorNames: [
      "Telecom",
      "Media networks",
      "Streaming",
      "Interactive media",
      "Digital advertising",
    ],
    topIdea: "Telecom leaders and scalable interactive-media platforms are usually the cleaner first read in this sector.",
  },
  {
    aliases: ["industrials", "industrial", "machinery", "aerospace", "defense", "transportation"],
    id: "industrials",
    rationale:
      "Industrials often tell you whether capex, logistics, and broader economic activity are getting market support.",
    subSectorNames: [
      "Aerospace and defense",
      "Machinery",
      "Construction",
      "Transportation",
      "Logistics",
    ],
    topIdea: "Machinery and transport leaders usually offer the best first look before smaller capital-goods stories get crowded.",
  },
  {
    aliases: ["materials", "mining", "chemicals", "construction materials", "packaging"],
    id: "materials",
    rationale:
      "Materials help show whether commodity demand and industrial follow-through are being rewarded across the market.",
    subSectorNames: [
      "Mining",
      "Chemicals",
      "Construction materials",
      "Metals",
      "Packaging",
    ],
    topIdea: "Chemicals and diversified materials names are often the clearest place to start before narrower commodity pockets.",
  },
  {
    aliases: ["utilities", "utility", "electricity", "water", "gas"],
    id: "utilities",
    rationale:
      "Utilities often matter when the market wants steadier cash flows, regulated earnings, and lower-volatility leadership.",
    subSectorNames: [
      "Electric utilities",
      "Water utilities",
      "Gas distribution",
      "Power transmission",
      "Renewable utilities",
    ],
    topIdea: "Electric and regulated utility leaders usually deserve the first read because they reflect stability better than speculative power themes.",
  },
  {
    aliases: ["real estate", "realty", "reit", "property"],
    id: "real-estate",
    rationale:
      "Real estate shows how the market is treating property-linked cash flows, financing conditions, and yield-sensitive assets.",
    subSectorNames: [
      "Developers",
      "Commercial REITs",
      "Residential property",
      "Warehousing",
      "Property management",
    ],
    topIdea: "REIT-like cash-flow stories and stronger property operators are usually the cleanest place to begin here.",
  },
];

function clampChange(value: number) {
  return Number(Math.max(-3.5, Math.min(3.5, value)).toFixed(2));
}

function toSectorId(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSectorAlias(normalizedName: string, alias: string) {
  const escapedAlias = escapeRegExp(alias.trim().toLowerCase()).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escapedAlias}([^a-z0-9]|$)`, "i").test(normalizedName);
}

function getSectorTemplate(name: string) {
  const normalized = name.trim().toLowerCase();

  return (
    sectorGroupTemplates.find((template) =>
      template.aliases.some((alias) => matchesSectorAlias(normalized, alias)),
    ) ?? null
  );
}

function buildSectorTrend(change: number, seed: number): SectorTrendPoint[] {
  const offsets = [-0.48, -0.21, 0.14, -0.08, 0];

  return ["5D", "4D", "3D", "2D", "Today"].map((label, index) => ({
    label,
    value: clampChange(change + offsets[index]! + seed * 0.03),
  }));
}

function buildSubSectorMoves({
  change,
  name,
  seed,
  template,
}: {
  change: number;
  name: string;
  seed: number;
  template: NonNullable<ReturnType<typeof getSectorTemplate>>;
}): SectorSubMove[] {
  const offsets = [0.28, -0.12, 0.18, -0.08, 0.05];

  return template.subSectorNames.map((subSectorName, index) => ({
    name: subSectorName,
    signal: `${name} sub-sector pulse`,
    value: clampChange(change + offsets[index]! + seed * 0.02),
  }));
}

export function buildSectorGroups(sectors: SectorMove[]): SectorGroup[] {
  return sectors.map((sector, index) => {
    const template = getSectorTemplate(sector.name);
    const seed = index + 1;

    if (template) {
      return {
        change: sector.value,
        id: template.id,
        name: sector.name,
        rationale: template.rationale,
        subSectors: buildSubSectorMoves({
          change: sector.value,
          name: sector.name,
          seed,
          template,
        }),
        topIdea: template.topIdea,
        trend: buildSectorTrend(sector.value, seed),
      } satisfies SectorGroup;
    }

    return {
      change: sector.value,
      id: toSectorId(sector.name),
      name: sector.name,
      rationale:
        "This sector is worth reading as part of broader breadth, even if it is not one of the preset sector families yet.",
      subSectors: [
        { name: "Leaders", signal: `${sector.name} sub-sector pulse`, value: clampChange(sector.value + 0.2) },
        { name: "Core names", signal: `${sector.name} sub-sector pulse`, value: clampChange(sector.value - 0.1) },
        { name: "Emerging pocket", signal: `${sector.name} sub-sector pulse`, value: clampChange(sector.value + 0.06) },
      ],
      topIdea: `Start with the strongest and most liquid names inside ${sector.name} before exploring thinner pockets.`,
      trend: buildSectorTrend(sector.value, seed),
    } satisfies SectorGroup;
  });
}

export function buildSuggestedSectorSnapshot({
  assets,
  profileBand,
  sectorGroups,
}: {
  assets: PortfolioAsset[];
  profileBand: string;
  sectorGroups: SectorGroup[];
}): SuggestedSectorSnapshot {
  const holdingsText = assets.map((asset) => `${asset.name} ${asset.type}`.toLowerCase()).join(" ");
  const normalizedBand = profileBand.trim().toLowerCase();

  const scoredIdeas = sectorGroups
    .map((group) => {
      let score = group.change;

      if (holdingsText.includes(group.id) || holdingsText.includes(group.name.toLowerCase())) {
        score += 0.35;
      }

      if (normalizedBand.includes("aggressive") || normalizedBand.includes("growth")) {
        if (group.id === "it" || group.id === "energy") score += 0.3;
      }

      if (normalizedBand.includes("cautious") || normalizedBand.includes("balanced")) {
        if (group.id === "fmcg" || group.id === "pharma" || group.id === "banks") score += 0.22;
      }

      return {
        change: group.change,
        id: group.id,
        name: group.name,
        rationale: group.rationale,
        score,
        strongestSubSector:
          [...group.subSectors].sort((left, right) => right.value - left.value)[0]?.name ??
          "Core names",
        topIdea: group.topIdea,
      };
    })
    .sort((left, right) => right.score - left.score);

  const sectors = scoredIdeas.slice(0, Math.min(4, scoredIdeas.length)).map((idea) => ({
    change: idea.change,
    id: idea.id,
    name: idea.name,
    reason: idea.rationale,
    strongestSubSector: idea.strongestSubSector,
    topIdea: idea.topIdea,
  }));

  const topSuggestions = [...sectors].sort((left, right) => right.change - left.change).slice(0, 3);
  const averageTrend = sectorGroups.length
    ? ["5D", "4D", "3D", "2D", "Today"].map((label, index) => ({
        label,
        value: Number(
          (
            sectors.reduce((sum, sector) => {
              const group = sectorGroups.find((item) => item.id === sector.id);
              return sum + (group?.trend[index]?.value ?? group?.change ?? 0);
            }, 0) / Math.max(1, sectors.length)
          ).toFixed(2),
        ),
      }))
    : [];

  return {
    description:
      "These are the sector pockets that currently look most worth understanding first, based on breadth, trend strength, and your current profile context.",
    headline:
      sectors.length > 0
        ? "Suggested sectors worth reading first"
        : "Sector suggestions will appear once market breadth is available",
    sectors,
    topSuggestions,
    trend: averageTrend,
  };
}

export function buildSuggestedSectorReasons({
  assets,
  profileBand,
  selectedSector,
}: {
  assets: PortfolioAsset[];
  profileBand: string;
  selectedSector: SuggestedSectorIdea | null;
}): SuggestedSectorReason[] {
  if (!selectedSector) {
    return [
      {
        caption: "No sector selected yet",
        detail:
          "Choose a suggested sector to see why it fits your current holdings mix and risk posture.",
        title: "Pick a sector to personalize the read",
      },
    ];
  }

  const holdingsText = assets.map((asset) => `${asset.name} ${asset.type}`.toLowerCase()).join(" ");
  const normalizedBand = profileBand.trim().toLowerCase();
  const hasMatchingExposure =
    holdingsText.includes(selectedSector.name.toLowerCase()) ||
    holdingsText.includes(selectedSector.strongestSubSector.toLowerCase()) ||
    (selectedSector.id === "it" && /technology|tech|software/.test(holdingsText)) ||
    (selectedSector.id === "banks" && /bank|financial/.test(holdingsText)) ||
    (selectedSector.id === "pharma" && /pharma|health/.test(holdingsText)) ||
    (selectedSector.id === "fmcg" && /consumer|staples|fmcg/.test(holdingsText)) ||
    (selectedSector.id === "energy" && /energy|power|infra|oil|gas/.test(holdingsText));

  const exposureReason: SuggestedSectorReason = hasMatchingExposure
    ? {
        caption: "Already visible in your holdings",
        detail: `Parts of your current holdings already lean toward ${selectedSector.name.toLowerCase()} themes, so this suggestion helps you understand an area that is already influencing your portfolio.`,
        title: "This matches what you already own",
      }
    : {
        caption: "Useful comparison gap",
        detail: `You do not seem heavily exposed to ${selectedSector.name.toLowerCase()} right now, which makes this a helpful comparison sector rather than a confirmation sector.`,
        title: "This adds perspective to your current mix",
      };

  const bandReason: SuggestedSectorReason =
    normalizedBand.includes("growth")
      ? {
          caption: "Fits a growth-style posture",
          detail: `${selectedSector.name} makes sense to monitor because growth-oriented profiles benefit from understanding where leadership and risk appetite are broadening.`,
          title: "Your profile can handle more growth context",
        }
      : normalizedBand.includes("conservative")
        ? {
            caption: "Keeps a cautious lens",
            detail: `${selectedSector.name} is being suggested as a learning lens, not as a push toward aggressive action. The goal is to understand leadership while staying aligned with a more cautious posture.`,
            title: "This is about understanding, not chasing",
          }
        : {
            caption: "Balanced profiles need comparisons",
            detail: `${selectedSector.name} is useful because balanced investors often benefit most from comparing leadership sectors without overcommitting to them.`,
            title: "This fits a balanced decision style",
          };

  const actionReason: SuggestedSectorReason = {
    caption: `Start with ${selectedSector.strongestSubSector}`,
    detail: selectedSector.topIdea,
    title: "The cleanest place to begin is inside the sector",
  };

  return [exposureReason, bandReason, actionReason];
}

function inferSectorGroupIdForAsset(asset: PortfolioAsset) {
  const text = `${asset.name} ${asset.type}`.trim().toLowerCase();
  const matchedTemplate = sectorGroupTemplates.find((template) =>
    template.aliases.some((alias) => matchesSectorAlias(text, alias)),
  );

  if (matchedTemplate) return matchedTemplate.id;

  if (/large\s*cap/.test(text)) return "banks";
  if (/mid\s*cap/.test(text)) return "industrials";
  if (/small\s*cap/.test(text)) return "consumer-discretionary";
  if (/index\s*fund|broad\s*market|nifty|sensex/.test(text)) return "banks";

  return null;
}

export function buildSuggestedSectorFitSummary({
  assets,
  suggestedSnapshot,
}: {
  assets: PortfolioAsset[];
  suggestedSnapshot: SuggestedSectorSnapshot;
}): SuggestedSectorFitSummary {
  const totalPortfolioValue = assets.reduce((sum, asset) => sum + Math.max(asset.value, 0), 0);
  const weightedSuggestions = suggestedSnapshot.sectors.map((sector, index) => ({
    ...sector,
    weight: Math.max(1, suggestedSnapshot.sectors.length - index),
  }));
  const totalSuggestedWeight = weightedSuggestions.reduce((sum, sector) => sum + sector.weight, 0);
  const exposureBySector = assets.reduce<Record<string, number>>((accumulator, asset) => {
    const sectorId = inferSectorGroupIdForAsset(asset);
    if (!sectorId) return accumulator;

    accumulator[sectorId] =
      (accumulator[sectorId] ?? 0) + Math.max(asset.value, asset.investedValue, 0);
    return accumulator;
  }, {});

  const rows = weightedSuggestions.map((sector) => {
    const currentValue = exposureBySector[sector.id] ?? 0;
    const currentShare =
      totalPortfolioValue > 0 ? Number(((currentValue / totalPortfolioValue) * 100).toFixed(1)) : 0;
    const suggestedShare =
      totalSuggestedWeight > 0
        ? Number(((sector.weight / totalSuggestedWeight) * 100).toFixed(1))
        : 0;
    const gapToSuggested = Number((suggestedShare - currentShare).toFixed(1));

    let status: SuggestedSectorFitRow["status"] = "aligned";
    let note = "Your current exposure is in the same neighborhood as the suggested read.";

    if (currentShare === 0) {
      status = "missing";
      note =
        "This theme is absent from the current tracked portfolio, so it is a learning watch before it becomes a portfolio decision.";
    } else if (gapToSuggested >= 8) {
      status = "underweight";
      note =
        "The suggested market lens is giving this more weight than your current portfolio currently does.";
    } else if (gapToSuggested <= -8) {
      status = "ahead";
      note =
        "You already have meaningful exposure here, so the job is monitoring discipline more than adding more.";
    }

    return {
      currentShare,
      currentValue,
      gapToSuggested,
      id: sector.id,
      name: sector.name,
      note,
      status,
      suggestedShare,
    } satisfies SuggestedSectorFitRow;
  });

  const coverageShare = Number(rows.reduce((sum, row) => sum + row.currentShare, 0).toFixed(1));
  const headline =
    rows[0]?.status === "missing"
      ? `You are not currently exposed to ${rows[0].name}, even though it is the strongest suggested lens right now.`
      : rows[0]?.status === "underweight"
        ? `${rows[0].name} looks lighter in your portfolio than the current suggested-sector read would imply.`
        : rows[0]
          ? `${rows[0].name} is already visible in your portfolio, so use the market page to manage conviction rather than chase it.`
          : "Suggested sectors will compare against your portfolio once both holdings and live sector data are available.";

  return {
    coverageShare,
    headline,
    rows,
  };
}

export function buildSubSectorDrilldownRows(subSectors: SectorSubMove[]): SubSectorDrilldownRow[] {
  return [...subSectors]
    .sort((left, right) => right.value - left.value)
    .map((subSector, index) => {
      const tone: SubSectorDrilldownRow["tone"] =
        subSector.value >= 0.45 ? "leader" : subSector.value <= -0.15 ? "soft" : "mixed";
      const guidance =
        tone === "leader"
          ? "Leadership pocket. Good place to learn what is actually carrying the sector."
          : tone === "soft"
            ? "Softer pocket. Useful for checking where the sector story is not broad yet."
            : "Middle read. Often the best area for deciding whether strength is broadening.";

      return {
        guidance,
        move: subSector.value,
        name: subSector.name,
        rank: index + 1,
        signal: subSector.signal,
        tone,
      } satisfies SubSectorDrilldownRow;
    });
}

export function buildMarketRegimeStrip({
  sectorGroups,
  suggestedSnapshot,
}: {
  sectorGroups: SectorGroup[];
  suggestedSnapshot: SuggestedSectorSnapshot;
}): MarketRegimeStrip {
  const sortedGroups = [...sectorGroups].sort((left, right) => right.change - left.change);
  const leader = sortedGroups[0]?.name ?? null;
  const laggard = sortedGroups.at(-1)?.name ?? null;
  const defensiveCandidate = sortedGroups.find((group) =>
    ["fmcg", "pharma", "utilities"].includes(group.id),
  );
  const watchlist = suggestedSnapshot.topSuggestions[0]?.name ?? null;
  const defensive = defensiveCandidate?.name ?? null;

  const headline = leader
    ? `${leader} is leading the tape, ${laggard ?? "the weakest sectors"} is lagging, and ${watchlist ?? "the suggested watchlist"} is the first place to study next.`
    : "Market regime will appear once sector breadth is available.";

  return {
    defensive,
    headline,
    laggard,
    leader,
    watchlist,
  };
}

export function buildTrendWindow(
  trend: SectorTrendPoint[],
  window: MarketTrendWindow,
): SectorTrendPoint[] {
  if (window === "1d") {
    const baseValue = trend.at(-2)?.value ?? trend[0]?.value ?? 0;
    const endValue = trend.at(-1)?.value ?? baseValue;

    return [
      { label: "Open", value: Number((baseValue - 0.18).toFixed(2)) },
      { label: "Mid", value: Number((((baseValue + endValue) / 2) - 0.05).toFixed(2)) },
      { label: "Now", value: endValue },
    ];
  }

  if (window === "1m") {
    const start = trend[0]?.value ?? 0;
    const end = trend.at(-1)?.value ?? start;
    const midpoint = Number((((start + end) / 2) + 0.08).toFixed(2));

    return [
      { label: "W1", value: Number((start - 0.22).toFixed(2)) },
      { label: "W2", value: start },
      { label: "W3", value: midpoint },
      { label: "W4", value: Number((end - 0.06).toFixed(2)) },
      { label: "Now", value: end },
    ];
  }

  return trend;
}

export function buildMarketActionItems({
  marketTrackTitle,
  regime,
  selectedSector,
  selectedSuggestedSector,
  sentiment,
  suggestedFit,
}: {
  marketTrackTitle: string;
  regime: MarketRegimeStrip;
  selectedSector?: SectorGroup | null;
  selectedSuggestedSector?: SuggestedSectorIdea | null;
  sentiment: string;
  suggestedFit: SuggestedSectorFitSummary;
}): MarketActionItem[] {
  const missingRow = suggestedFit.rows.find((row) => row.status === "missing");
  const underweightRow = suggestedFit.rows.find((row) => row.status === "underweight");
  const aheadRow = suggestedFit.rows.find((row) => row.status === "ahead");
  const selectedSectorName = selectedSector?.name ?? null;
  const selectedSectorId = selectedSector?.id;

  const studySectorId = selectedSuggestedSector?.id ?? missingRow?.id ?? underweightRow?.id ?? selectedSectorId;
  const studyTarget =
    selectedSuggestedSector?.name ??
    missingRow?.name ??
    underweightRow?.name ??
    regime.watchlist ??
    selectedSectorName ??
    regime.leader;
  const watchSectorId =
    (!selectedSuggestedSector && selectedSectorId && selectedSectorId !== studySectorId
      ? selectedSectorId
      : undefined) ?? aheadRow?.id;
  const watchTarget =
    (!selectedSuggestedSector && selectedSectorName
      ? selectedSectorName
      : undefined) ??
    regime.laggard ??
    aheadRow?.name ??
    regime.defensive ??
    "the weaker sector pocket";
  const restraintCue =
    sentiment === "Constructive"
      ? "Do not confuse a supportive tape with a reason to abandon your allocation plan."
      : sentiment === "Cautious"
        ? "Do not let softer breadth push you into panic changes before checking your real portfolio mix."
        : "Do not treat mixed tape as a demand to act. Use it as a reading day first.";

  return [
    {
      cta: studyTarget ? `Study ${studyTarget}` : "Study the suggested leaders",
      detail: studyTarget
        ? `${studyTarget} is the best place to build understanding next because it is either underrepresented in your portfolio or the clearest suggested follow-through from the current market read.`
        : "Start with the strongest suggested sector before comparing it with your existing holdings.",
      emphasis: "high",
      nextStep: studyTarget
        ? `Open ${studyTarget} and review the trend plus strongest sub-sector before making any allocation call.`
        : "Start by opening the strongest suggested sector and reading it as a study topic, not a trade trigger.",
      sectorId: studySectorId,
      title: "Study next",
    },
    {
      cta: watchTarget ? `Watch ${watchTarget}` : "Watch the laggards",
      detail: watchTarget
        ? `${watchTarget} is useful as a watchlist lane because it tells you where breadth is weakening, where your current exposure may already be ahead, or where the market is not confirming the leadership story.`
        : "Keep one weaker area in view so you can tell whether the market move is broadening or narrowing.",
      emphasis: "medium",
      nextStep: watchTarget
        ? `Keep ${watchTarget} visible on your watchlist and revisit it only if the trend strengthens or your current exposure changes.`
        : "Use one weaker pocket as a market health check rather than chasing every leadership swing.",
      sectorId: watchSectorId,
      title: "Watch, don’t chase",
    },
    {
      cta: `Stay anchored to ${marketTrackTitle.toLowerCase()}`,
      detail: restraintCue,
      emphasis: "low",
      nextStep: selectedSectorName
        ? `Use ${selectedSectorName} as context for learning, then return to your broader plan before acting.`
        : `Re-center on ${marketTrackTitle.toLowerCase()} before you make any impulsive move from this page.`,
      sectorId: selectedSectorId ?? studySectorId ?? watchSectorId,
      title: "Do nothing impulsive",
    },
  ];
}

export function buildMarketNowVsSuggestedConversation({
  sectorGroups,
  sectorBreadth,
  sentiment,
  suggestedSnapshot,
}: {
  sectorGroups: SectorGroup[];
  sectorBreadth: SectorBreadthSummary;
  sentiment: string;
  suggestedSnapshot: SuggestedSectorSnapshot;
}): MarketConversationTurn[] {
  const currentLeader = sectorBreadth.strongest ?? "the current leaders";
  const currentLaggard = sectorBreadth.weakest ?? "the weaker sectors";
  const topSuggested = suggestedSnapshot.topSuggestions[0];
  const secondSuggested = suggestedSnapshot.topSuggestions[1];
  const currentLeaderSectorId =
    sectorGroups.find((group) => group.name === sectorBreadth.strongest)?.id ?? undefined;

  return [
    {
      actionLabel: currentLeaderSectorId ? `Open ${currentLeader}` : undefined,
      body:
        sentiment === "Constructive"
          ? `${currentLeader} is leading the tape right now, while ${currentLaggard} is lagging. Breadth is supportive, so the market read is about where strength is actually broadening.`
          : sentiment === "Cautious"
            ? `${currentLeader} is still standing out, but breadth is softer and ${currentLaggard} is weighing on the overall tone. The immediate read is more about resilience than excitement.`
            : `${currentLeader} is still the strongest pocket today, but the overall market read is mixed and ${currentLaggard} shows where confidence is thinning out.`,
      emphasis: sentiment === "Constructive" ? "medium" : "high",
      nextStep:
        sentiment === "Constructive"
          ? `Check whether ${currentLeader} leadership is broadening before you chase it.`
          : `Use ${currentLeader} as a resilience check, not a green light to add risk quickly.`,
      sectorId: currentLeaderSectorId,
      speaker: "now",
      title: "Now",
    },
    {
      actionLabel: topSuggested ? `Study ${topSuggested.name}` : undefined,
      body: topSuggested
        ? `${topSuggested.name} is the most useful sector to study next, with ${topSuggested.strongestSubSector} standing out first.${secondSuggested ? ` After that, ${secondSuggested.name} is the next clean area to compare.` : ""}`
        : "Suggested sectors will show up here once the market breadth view has enough context.",
      emphasis: topSuggested ? "high" : "low",
      nextStep: topSuggested
        ? `Spend your next study block on ${topSuggested.name}${secondSuggested ? `, then pressure-test it against ${secondSuggested.name}` : ""}.`
        : "Wait for stronger sector context before building a study queue from suggestions.",
      sectorId: topSuggested?.id,
      speaker: "suggested",
      title: "Suggested",
    },
    {
      actionLabel: topSuggested ? `Compare with ${topSuggested.name}` : undefined,
      body: topSuggested
        ? `Treat the suggested view as a guided lens on the same market data, not a different feed. The job is to compare today's live leader with ${topSuggested.name.toLowerCase()} and decide whether it deserves deeper study, not a rushed trade.`
        : "Use the suggested view as a calmer follow-through layer on top of the live market read once it appears.",
      emphasis: "low",
      nextStep: topSuggested
        ? `Compare your current holdings with ${topSuggested.name} before changing allocation.`
        : "Use this card as a process reminder while the suggested lens fills in.",
      sectorId: topSuggested?.id,
      speaker: "mentor",
      title: "How to use both",
    },
  ];
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
    { label: "Information Technology", symbol: "XLK" },
    { label: "Financials", symbol: "XLF" },
    { label: "Health Care", symbol: "XLV" },
    { label: "Consumer Discretionary", symbol: "XLY" },
    { label: "Consumer Staples", symbol: "XLP" },
    { label: "Communication Services", symbol: "XLC" },
    { label: "Industrials", symbol: "XLI" },
    { label: "Energy", symbol: "XLE" },
    { label: "Materials", symbol: "XLB" },
    { label: "Utilities", symbol: "XLU" },
    { label: "Real Estate", symbol: "XLRE" },
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
