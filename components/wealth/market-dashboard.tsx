"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Compass, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { AskMentorLink } from "@/components/wealth/ask-mentor-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  buildIntegrationSchedulerPlan,
  formatSyncTimeLabel,
  getIntegrationHealthMetrics,
  getIntegrationStrategyLabel,
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
} from "@/lib/integration-sync";
import {
  buildMarketNowVsSuggestedConversation,
  buildSectorGroups,
  buildSuggestedSectorReasons,
  buildSuggestedSectorSnapshot,
  buildFallbackMarketResponse,
  buildMarketRegimeStrip,
  buildMarketActionItems,
  buildTrendWindow,
  buildSubSectorDrilldownRows,
  getMarketPortfolioNote,
  buildSuggestedSectorFitSummary,
  summarizeHoldingsWatch,
  summarizeSectorBreadth,
  type MarketTrendWindow,
  type MarketSnapshotResponse,
} from "@/lib/market-data";
import type {
  IntegrationConnection,
  MarketPreferences,
  PortfolioAsset,
} from "@/lib/local-storage";
import {
  loadMarketWatchlist,
  markMarketWatchlistSectorReviewed,
  type MarketWatchlistEntry,
  toggleMarketWatchlistSector,
} from "@/lib/market-watchlist";
import type { MentorLaunchRequest } from "@/lib/mentor-chat";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { RiskProfile } from "@/lib/wealth-rules";
import { SegmentedControl, SelectField } from "@/components/wealth/form-fields";

const marketExplainers = [
  {
    action: "Check diversification before reacting to one headline.",
    explanation:
      "Large indexes are weighted. If a few heavy companies move up, the index can look healthy even when many smaller holdings are flat.",
    headline: "Why indexes can rise while some stocks fall",
  },
  {
    action: "Match debt investments to goal timing.",
    explanation:
      "A calm yield environment often means debt funds may feel steadier, but credit quality and duration still matter.",
    headline: "What stable bond yields usually mean",
  },
  {
    action: "Keep emergency reserves separate from long-term allocation.",
    explanation:
      "Gold can diversify a portfolio, but its price moves. Emergency money should prioritize reliability and access.",
    headline: "Why gold is not a replacement for an emergency fund",
  },
];

const fallbackMarketTrack = {
  description: "Use the market page to compare live breadth with your own plan.",
  id: "understand" as const,
  items: [
    "Start with market breadth, then compare it with your own holdings before changing anything.",
  ],
  title: "Market context",
};

type MarketActionTone = "neutral" | "open" | "save" | "remove";
type MarketPriorityAction =
  | "open-overview"
  | "open-fit"
  | "open-compare"
  | "open-trends"
  | "open-operations"
  | "review-next"
  | "focus-top-suggested";
type MarketSectionId =
  | "heatmap"
  | "overview"
  | "compare"
  | "trends"
  | "conversation"
  | "fit"
  | "operations";

function resolveDistinctSectorIds(
  sectorIds: string[],
  primaryId: string | null,
  secondaryId: string | null,
) {
  if (sectorIds.length === 0) {
    return { primaryId: null, secondaryId: null };
  }

  const safePrimary = primaryId && sectorIds.includes(primaryId) ? primaryId : sectorIds[0]!;
  const secondaryPool = sectorIds.filter((sectorId) => sectorId !== safePrimary);
  const safeSecondary =
    secondaryId && secondaryPool.includes(secondaryId)
      ? secondaryId
      : secondaryPool[0] ?? safePrimary;

  return {
    primaryId: safePrimary,
    secondaryId: safeSecondary,
  };
}

function getComparisonRoleLabel({
  compareAutoSync,
  leftId,
  rightId,
  sectorId,
}: {
  compareAutoSync: boolean;
  leftId: string | null;
  rightId: string | null;
  sectorId: string;
}) {
  if (leftId === sectorId) {
    return compareAutoSync ? "Following compare" : "Pinned compare";
  }

  if (rightId === sectorId) {
    return "Compare pair";
  }

  return null;
}

function getSectorPriorityLabel({
  isLeader,
  fitStatus,
  isSuggested,
}: {
  fitStatus?: "ahead" | "aligned" | "missing" | "underweight" | null;
  isLeader: boolean;
  isSuggested: boolean;
}) {
  if (isLeader || fitStatus === "missing" || fitStatus === "underweight") {
    return "Study";
  }

  if (isSuggested || fitStatus === "aligned") {
    return "Watch";
  }

  return "Context";
}

function getSectorPriorityBadgeClass(label: string) {
  if (label === "Study") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (label === "Watch") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function getSectorPriorityReason({
  fitStatus,
  isLeader,
  isSuggested,
  sectorName,
}: {
  fitStatus?: "ahead" | "aligned" | "missing" | "underweight" | null;
  isLeader: boolean;
  isSuggested: boolean;
  sectorName: string;
}) {
  if (isLeader) {
    return `${sectorName} is in Study because it is leading the live market move right now.`;
  }

  if (fitStatus === "missing" || fitStatus === "underweight") {
    return `${sectorName} is in Study because it highlights a portfolio fit gap worth understanding before acting.`;
  }

  if (isSuggested || fitStatus === "aligned") {
    return `${sectorName} is in Watch because it is relevant now, but it is more useful as an active tracking lane than an urgent move.`;
  }

  return `${sectorName} is in Context because it helps frame the market without being a front-of-queue focus for you right now.`;
}

export function MarketDashboard({
  assets,
  integrations,
  marketPreferences,
  onOpenMentor,
  onRunIntegrationSync,
  onUpdatePreferences,
  profile,
}: {
  assets: PortfolioAsset[];
  integrations: IntegrationConnection[];
  marketPreferences: MarketPreferences;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  onRunIntegrationSync: (connectionId?: string) => void;
  onUpdatePreferences: (preferences: MarketPreferences) => void;
  profile: RiskProfile;
}) {
  const [marketData, setMarketData] = useState<MarketSnapshotResponse>(() =>
    buildFallbackMarketResponse("Loading market snapshot."),
  );
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const activeIntegrations = useMemo(
    () => integrations.filter((integration) => integration.status === "active"),
    [integrations],
  );
  const schedulerPlan = useMemo(
    () => buildIntegrationSchedulerPlan(integrations),
    [integrations],
  );
  const integrationHealthSummary = useMemo(() => {
    const metrics = activeIntegrations.map(getIntegrationHealthMetrics);
    const totalRuns = metrics.reduce((sum, item) => sum + item.totalRuns, 0);
    const averageSuccessRate = metrics.length
      ? Math.round(metrics.reduce((sum, item) => sum + item.successRate, 0) / metrics.length)
      : 0;
    const warningConnections = metrics.filter((item) => item.warningStreak > 0).length;

    return {
      averageSuccessRate,
      totalRuns,
      warningConnections,
    };
  }, [activeIntegrations]);
  const nextMarketRefreshAt = useMemo(() => {
    if (!marketPreferences.autoRefresh || !lastRefreshedAt) return null;

    return new Date(
      new Date(lastRefreshedAt).getTime() +
        Math.max(30, marketPreferences.pollingIntervalSeconds) * 1000,
    ).toISOString();
  }, [lastRefreshedAt, marketPreferences.autoRefresh, marketPreferences.pollingIntervalSeconds]);
  const holdingsWatchSummary = useMemo(() => {
    return summarizeHoldingsWatch(marketData.holdingsWatch, assets);
  }, [assets, marketData.holdingsWatch]);
  const sectorBreadth = useMemo(
    () => summarizeSectorBreadth(marketData.sectors),
    [marketData.sectors],
  );
  const sectorGroups = useMemo(
    () => buildSectorGroups(marketData.sectors),
    [marketData.sectors],
  );
  const suggestedSectorSnapshot = useMemo(
    () =>
      buildSuggestedSectorSnapshot({
        assets,
        profileBand: profile.band,
        sectorGroups,
      }),
    [assets, profile.band, sectorGroups],
  );
  const marketConversation = useMemo(
    () =>
      buildMarketNowVsSuggestedConversation({
        sectorGroups,
        sectorBreadth,
        sentiment: marketData.sentiment,
        suggestedSnapshot: suggestedSectorSnapshot,
      }),
    [marketData.sentiment, sectorBreadth, sectorGroups, suggestedSectorSnapshot],
  );
  const marketRegime = useMemo(
    () =>
      buildMarketRegimeStrip({
        sectorGroups,
        suggestedSnapshot: suggestedSectorSnapshot,
      }),
    [sectorGroups, suggestedSectorSnapshot],
  );
  const suggestedSectorFit = useMemo(
    () =>
      buildSuggestedSectorFitSummary({
        assets,
        suggestedSnapshot: suggestedSectorSnapshot,
      }),
    [assets, suggestedSectorSnapshot],
  );
  const [selectedSectorId, setSelectedSectorId] = useState<string>("all-suggested");
  const [trendWindow, setTrendWindow] = useState<MarketTrendWindow>("1w");
  const [compareLeftSectorId, setCompareLeftSectorId] = useState<string | null>(null);
  const [compareRightSectorId, setCompareRightSectorId] = useState<string | null>(null);
  const [compareAutoSync, setCompareAutoSync] = useState(true);
  const [savedWatchlistEntries, setSavedWatchlistEntries] = useState<MarketWatchlistEntry[]>([]);
  const [watchlistFilter, setWatchlistFilter] = useState<"all" | "review-now" | "suggested">(
    "all",
  );
  const watchlistLaneRefs = useRef<
    Record<"reviewed" | "study-now" | "watch", HTMLDivElement | null>
  >({
    reviewed: null,
    "study-now": null,
    watch: null,
  });
  const marketSectionRefs = useRef<Record<MarketSectionId, HTMLDivElement | null>>({
    compare: null,
    conversation: null,
    fit: null,
    heatmap: null,
    operations: null,
    overview: null,
    trends: null,
  });
  const [marketActionFeedback, setMarketActionFeedback] = useState<{
    message: string;
    tone: MarketActionTone;
  }>({
    message: "Compare sectors to decide what to study next or save for review.",
    tone: "neutral",
  });
  const marketPortfolioNote = useMemo(
    () =>
      getMarketPortfolioNote({
        holdingsWatch: holdingsWatchSummary,
        sectorBreadth,
        sentiment: marketData.sentiment,
      }),
    [holdingsWatchSummary, marketData.sentiment, sectorBreadth],
  );
  const marketTrack =
    profile.actionBaskets?.find((basket) => basket.id === "understand") ??
    profile.actionBaskets?.[0] ??
    fallbackMarketTrack;
  const marketFocusHeadline =
    holdingsWatchSummary.trackedTotal > 0
      ? "Watch the market through your portfolio, not through random headlines"
      : "Use the market page for context, not for impulsive action";
  const marketFocusDetail =
    holdingsWatchSummary.trackedTotal > 0
      ? "You already have tracked assets, so today’s useful question is how the market tone interacts with your actual mix, not whether one sector is exciting."
      : "Until the portfolio is mapped in, this page is mainly here to build pattern recognition: breadth, sentiment, sector leadership, and why none of them should override your plan alone.";
  const marketStatusCards = [
    {
      detail:
        marketData.sentiment === "Constructive"
          ? "Breadth is supportive, so this is a good session for planned study and calm comparison."
          : marketData.sentiment === "Cautious"
            ? "Breadth is softer, so this is a better session for resilience checks than for fresh conviction."
            : "The tape is mixed, which makes comparison and context more valuable than prediction.",
      label: "Market posture",
      value: marketData.sentiment,
    },
    {
      detail:
        holdingsWatchSummary.trackedTotal > 0
          ? `${holdingsWatchSummary.trackedCount} tracked holding${holdingsWatchSummary.trackedCount === 1 ? "" : "s"} are feeding the live market lens.`
          : "Add more tracked holdings if you want the market page to feel more personal than generic.",
      label: "Portfolio link",
      value:
        holdingsWatchSummary.trackedTotal > 0
          ? `${holdingsWatchSummary.deltaPercent >= 0 ? "+" : ""}${holdingsWatchSummary.deltaPercent.toFixed(2)}% watch`
          : "Needs mapping",
    },
    {
      detail:
        reviewQueueSummary.reviewNow.length > 0
          ? `${reviewQueueSummary.reviewNow.length} saved sector${reviewQueueSummary.reviewNow.length === 1 ? "" : "s"} deserve a fresh look before they go stale.`
          : "Your saved sector queue does not have anything urgent waiting for review.",
      label: "Watchlist pressure",
      value:
        reviewQueueSummary.reviewNow.length > 0
          ? `${reviewQueueSummary.reviewNow.length} review now`
          : "Clear",
    },
    {
      detail: marketPreferences.autoRefresh
        ? `Polling every ${marketPreferences.pollingIntervalSeconds} seconds with ${marketPreferences.preferredSource} as the source mode.`
        : `Auto refresh is paused, so this page will stay stable until you refresh or reopen it.`,
      label: "Refresh posture",
      value: marketPreferences.autoRefresh ? "Live loop" : "Manual",
    },
  ];
  const marketJumpCards = [
    {
      badge: topSuggestedSector ? topSuggestedSector.name : "Suggested lens",
      detail: "Review the reordered sector view that mixes live market leadership with your own fit gaps.",
      sectionId: "fit" as const,
      title: "Suggested sectors",
    },
    {
      badge: selectedSectorId === "all-suggested" ? "All suggested" : selectedSectorGroup?.name ?? "Selected",
      detail: "Jump straight into the sector explorer and sub-sector drilldown for the current focus lane.",
      sectionId: "trends" as const,
      title: "Trend explorer",
    },
    {
      badge: compareLeftSector && compareRightSector ? "Comparison loaded" : "Ready",
      detail: "Use the compare strip when two sectors both look relevant and you need a sharper read.",
      sectionId: "compare" as const,
      title: "Compare sectors",
    },
    {
      badge: marketConversation[0]?.title ?? "Now vs suggested",
      detail: "Read the plain-English market conversation when the tape feels noisier than your conviction.",
      sectionId: "conversation" as const,
      title: "Guided conversation",
    },
  ];
  const selectedSectorGroup = useMemo(
    () => sectorGroups.find((group) => group.id === selectedSectorId) ?? sectorGroups[0] ?? null,
    [sectorGroups, selectedSectorId],
  );
  const marketActionBannerClassName =
    marketActionFeedback.tone === "open"
      ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300"
      : marketActionFeedback.tone === "save"
        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
        : marketActionFeedback.tone === "remove"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
          : "border-border bg-background text-muted-foreground";
  const sectorSelectorOptions = useMemo(
    () => [
      ["all-suggested", "All suggested sectors"],
      ...sectorGroups.map((group) => [group.id, group.name] as [string, string]),
    ],
    [sectorGroups],
  );
  const sectorOnlySelectorOptions = useMemo(
    () => sectorGroups.map((group) => [group.id, group.name] as [string, string]),
    [sectorGroups],
  );
  const visibleTrendSeries = useMemo(
    () =>
      buildTrendWindow(
        selectedSectorId === "all-suggested"
          ? suggestedSectorSnapshot.trend
          : selectedSectorGroup?.trend ?? [],
        trendWindow,
      ),
    [selectedSectorGroup, selectedSectorId, suggestedSectorSnapshot.trend, trendWindow],
  );
  const selectedSuggestedSector =
    selectedSectorId === "all-suggested"
      ? null
      : suggestedSectorSnapshot.sectors.find((idea) => idea.id === selectedSectorId) ?? null;
  const topSuggestedSector = suggestedSectorSnapshot.topSuggestions[0] ?? null;
  const secondSuggestedSector = suggestedSectorSnapshot.topSuggestions[1] ?? null;
  const trendExplorerSummary = useMemo(() => {
    const firstPoint = visibleTrendSeries[0]?.value ?? 0;
    const lastPoint = visibleTrendSeries[visibleTrendSeries.length - 1]?.value ?? firstPoint;
    const delta = lastPoint - firstPoint;
    const focusLabel =
      selectedSectorId === "all-suggested"
        ? "Suggested sector basket"
        : selectedSectorGroup?.name ?? "Selected sector";
    const strongestPocket =
      selectedSectorId === "all-suggested"
        ? topSuggestedSector?.strongestSubSector ?? "Suggested leaders"
        : selectedSectorGroup?.subSectors[0]?.name ?? "Core names";
    const windowLabel =
      trendWindow === "1d" ? "Intraday read" : trendWindow === "1w" ? "Weekly read" : "Monthly read";
    const directionLabel =
      delta > 0.35 ? "Building strength" : delta < -0.35 ? "Losing strength" : "Moving sideways";
    const directionDetail =
      delta > 0.35
        ? `${focusLabel} is improving through this ${windowLabel.toLowerCase()}, so use the chart to confirm whether strength is broadening.`
        : delta < -0.35
          ? `${focusLabel} is softening through this ${windowLabel.toLowerCase()}, so read it as a context cue before reacting.`
          : `${focusLabel} is relatively balanced through this ${windowLabel.toLowerCase()}, which makes comparison more useful than conviction.`;
    const actionTitle =
      selectedSectorId === "all-suggested"
        ? "Review one suggested lane"
        : selectedSuggestedSector
          ? "Compare before acting"
          : "Use as context first";
    const actionDetail =
      selectedSectorId === "all-suggested"
        ? "Use this combined trend to decide which suggested sector deserves your first deeper read."
        : selectedSuggestedSector
          ? "This chart is most useful when you compare today’s tape with your portfolio-fit gap before making a move."
          : "This chart is better for learning the market backdrop than forcing an allocation idea right away.";

    return {
      actionDetail,
      actionTitle,
      delta,
      directionDetail,
      directionLabel,
      focusLabel,
      strongestPocket,
      windowLabel,
    };
  }, [
    selectedSectorGroup,
    selectedSectorId,
    selectedSuggestedSector,
    topSuggestedSector,
    trendWindow,
    visibleTrendSeries,
  ]);
  const marketOperatingLenses = [
    {
      label: "Active lane",
      value:
        selectedSectorId === "all-suggested"
          ? "Suggested basket"
          : selectedSectorGroup?.name ?? "Pick a sector",
      detail:
        selectedSectorId === "all-suggested"
          ? "You are reading the curated sector basket instead of one isolated lane."
          : selectedSectorPriority
            ? `${selectedSectorPriority} this lane before deciding whether it deserves compare or watchlist space.`
            : "Choose one sector to turn the market page into a more specific read.",
    },
    {
      label: "Best comparison",
      value:
        quickCompare?.primarySector.name && quickCompare?.secondarySector.name
          ? `${quickCompare.primarySector.name} vs ${quickCompare.secondarySector.name}`
          : "Compare pending",
      detail:
        quickCompare?.detail ??
        "Once sectors are loaded, this points you to the cleanest next comparison.",
    },
    {
      label: "Review pressure",
      value:
        reviewQueueSummary.reviewNow.length > 0
          ? `${reviewQueueSummary.reviewNow.length} sector${reviewQueueSummary.reviewNow.length === 1 ? "" : "s"}`
          : "Clear",
      detail:
        reviewQueueSummary.reviewNow.length > 0
          ? "Saved sectors are waiting for a fresh pass before they turn into stale bookmarks."
          : "No saved sector currently needs an urgent revisit.",
    },
  ];
  const marketWorkingOrder = [
    "Read breadth first so one hot sector does not hijack your session.",
    "Review one lane, then compare only when two ideas both still look relevant.",
    "Save sectors for follow-up, not as a reaction to every strong move.",
  ];
  const marketPriorityQueue = [
    sectorBreadth.advanceRatio < 45
      ? {
          action: "open-overview" as const,
          detail:
            "Breadth is soft enough that context matters more than conviction right now. Start with the broad market read before drilling into a single lane.",
          label: "Read market breadth first",
          section: "Overview",
          tone: "urgent" as const,
        }
      : topSuggestedSector
        ? {
            action: "focus-top-suggested" as const,
            detail: `${topSuggestedSector.name} is the clearest suggested starting point right now, so it is the best lane to open before you widen the study session.`,
            label: `Open ${topSuggestedSector.name}`,
            section: "Suggested sectors",
            tone: "urgent" as const,
          }
        : {
            action: "open-trends" as const,
            detail:
              "Open the sector explorer first so the live tape turns into one focused lane instead of a scattered market read.",
            label: "Open the trend explorer",
            section: "Trends",
            tone: "urgent" as const,
          },
    reviewQueueSummary.next
      ? {
          action: "review-next" as const,
          detail: `${reviewQueueSummary.next.sector.name} is already saved and due for review, which is usually a better next move than chasing a brand-new sector idea.`,
          label: `Review ${reviewQueueSummary.next.sector.name}`,
          section: "Watchlist",
          tone: "watch" as const,
        }
      : quickCompare
        ? {
            action: "open-compare" as const,
            detail: `${quickCompare.primarySector.name} vs ${quickCompare.secondarySector.name} is the cleanest next comparison if you need to separate tape strength from actual portfolio fit.`,
            label: "Load the best comparison",
            section: "Compare",
            tone: "watch" as const,
          }
        : {
            action: "open-fit" as const,
            detail:
              "Use the fit view to separate genuinely relevant sectors from the ones that are only loud today.",
            label: "Review portfolio fit gaps",
            section: "Fit",
            tone: "watch" as const,
          },
    marketPreferences.autoRefresh
      ? {
          action: "open-operations" as const,
          detail: `The page is polling every ${marketPreferences.pollingIntervalSeconds} seconds, so keep one eye on the feed posture before over-trusting a single print.`,
          label: "Check the live feed posture",
          section: "Operations",
          tone: "steady" as const,
        }
      : {
          action: "open-operations" as const,
          detail:
            "Refresh is manual right now, so use the operations lane to decide whether the snapshot is fresh enough for a serious read.",
          label: "Check snapshot freshness",
          section: "Operations",
          tone: "steady" as const,
        },
  ];
  const marketActionItems = useMemo(
    () =>
      buildMarketActionItems({
        marketTrackTitle: marketTrack.title,
        regime: marketRegime,
        selectedSector: selectedSectorId === "all-suggested" ? null : selectedSectorGroup,
        selectedSuggestedSector,
        sentiment: marketData.sentiment,
        suggestedFit: suggestedSectorFit,
      }),
    [
      marketData.sentiment,
      marketRegime,
      marketTrack.title,
      selectedSectorGroup,
      selectedSectorId,
      selectedSuggestedSector,
      suggestedSectorFit,
    ],
  );
  const suggestedSectorReasons = useMemo(
    () =>
      buildSuggestedSectorReasons({
        assets,
        profileBand: profile.band,
        selectedSector: selectedSuggestedSector,
      }),
    [assets, profile.band, selectedSuggestedSector],
  );
  const selectedSubSectorDrilldown = useMemo(
    () => buildSubSectorDrilldownRows(selectedSectorGroup?.subSectors ?? []),
    [selectedSectorGroup],
  );
  const marketMentorQuestionId =
    selectedSectorId === "all-suggested" ? "allocation" : "etf";
  const sortedSectorGroups = useMemo(
    () => [...sectorGroups].sort((left, right) => right.change - left.change),
    [sectorGroups],
  );
  const sectorLeaders = useMemo(
    () => ({
      strongest: sortedSectorGroups.slice(0, 3),
      weakest: [...sortedSectorGroups].slice(-3).reverse(),
    }),
    [sortedSectorGroups],
  );
  const suggestedSectorIds = useMemo(
    () => new Set(suggestedSectorSnapshot.sectors.map((idea) => idea.id)),
    [suggestedSectorSnapshot.sectors],
  );
  const availableSectorIds = useMemo(
    () => new Set(sectorGroups.map((group) => group.id)),
    [sectorGroups],
  );
  const visibleSavedSectorIds = useMemo(
    () =>
      savedWatchlistEntries
        .map((entry) => entry.sectorId)
        .filter((sectorId) => availableSectorIds.has(sectorId)),
    [availableSectorIds, savedWatchlistEntries],
  );
  const visibleSavedWatchlistEntries = useMemo(
    () =>
      savedWatchlistEntries.filter((entry) => availableSectorIds.has(entry.sectorId)),
    [availableSectorIds, savedWatchlistEntries],
  );
  const savedSectorGroups = useMemo(
    () =>
      visibleSavedSectorIds
        .map((sectorId) => sectorGroups.find((group) => group.id === sectorId) ?? null)
        .filter((group): group is NonNullable<typeof group> => group !== null),
    [sectorGroups, visibleSavedSectorIds],
  );
  const savedWatchlistEntryMap = useMemo(
    () => new Map(visibleSavedWatchlistEntries.map((entry) => [entry.sectorId, entry])),
    [visibleSavedWatchlistEntries],
  );
  const savedWatchlistSummary = useMemo(() => {
    if (!savedSectorGroups.length) return null;

    const aligned = savedSectorGroups.filter((sector) => suggestedSectorIds.has(sector.id));
    const watchOnly = savedSectorGroups.filter((sector) => !suggestedSectorIds.has(sector.id));
    const strongest = [...savedSectorGroups].sort((left, right) => right.change - left.change)[0] ?? null;
    const weakest = [...savedSectorGroups].sort((left, right) => left.change - right.change)[0] ?? null;

    return {
      aligned,
      strongest,
      watchOnly,
      weakest,
    };
  }, [savedSectorGroups, suggestedSectorIds]);
  const savedWatchlistQueue = useMemo(() => {
    if (!savedSectorGroups.length) return [];

    return [...savedSectorGroups]
      .map((sector) => {
        const isSuggested = suggestedSectorIds.has(sector.id);
        const bestPocket =
          [...sector.subSectors].sort((left, right) => right.value - left.value)[0]?.name ??
          "Core names";

        if (isSuggested && sector.change >= 0.35) {
          return {
            bucket: "study-now" as const,
            bucketLabel: "Study now",
            detail:
              "This sector is both currently suggested and showing enough live strength to deserve a proper learning pass.",
            reviewedAt: savedWatchlistEntryMap.get(sector.id)?.reviewedAt ?? null,
            sector,
            bestPocket,
          };
        }

        if (isSuggested || sector.change >= 0) {
          return {
            bucket: "keep-watching" as const,
            bucketLabel: "Keep watching",
            detail:
              "This still belongs on your screen, but it looks more like a monitored theme than an immediate deep-dive priority.",
            reviewedAt: savedWatchlistEntryMap.get(sector.id)?.reviewedAt ?? null,
            sector,
            bestPocket,
          };
        }

        return {
          bucket: "background-only" as const,
          bucketLabel: "Background only",
          detail:
            "Keep this in peripheral view for context, but it does not need much attention unless the regime changes.",
          reviewedAt: savedWatchlistEntryMap.get(sector.id)?.reviewedAt ?? null,
          sector,
          bestPocket,
        };
      })
      .sort((left, right) => {
        const leftNeedsReview = left.reviewedAt === null ? 1 : 0;
        const rightNeedsReview = right.reviewedAt === null ? 1 : 0;
        if (leftNeedsReview !== rightNeedsReview) return rightNeedsReview - leftNeedsReview;

        const leftReviewedAt = left.reviewedAt ? new Date(left.reviewedAt).getTime() : 0;
        const rightReviewedAt = right.reviewedAt ? new Date(right.reviewedAt).getTime() : 0;
        if (leftReviewedAt !== rightReviewedAt) return leftReviewedAt - rightReviewedAt;

        return right.sector.change - left.sector.change;
      });
  }, [savedSectorGroups, savedWatchlistEntryMap, suggestedSectorIds]);
  const reviewQueueSummary = useMemo(() => {
    const now = new Date("2026-07-22T00:00:00.000+05:30").getTime();
    const reviewNow = savedWatchlistQueue.filter((item) => {
      if (item.reviewedAt === null) return true;
      const reviewedAt = new Date(item.reviewedAt).getTime();
      const ageInDays = (now - reviewedAt) / (1000 * 60 * 60 * 24);
      return ageInDays >= 7;
    });

    return {
      next: reviewNow[0] ?? null,
      reviewNow,
    };
  }, [savedWatchlistQueue]);
  const savedWatchlistQueueWithStatus = useMemo(() => {
    const now = new Date("2026-07-22T00:00:00.000+05:30").getTime();

    return savedWatchlistQueue.map((item) => {
      if (item.reviewedAt === null) {
        return {
          ...item,
          reviewStatus: "new" as const,
          reviewStatusLabel: "New",
        };
      }

      const reviewedAt = new Date(item.reviewedAt).getTime();
      const ageInDays = (now - reviewedAt) / (1000 * 60 * 60 * 24);

      if (ageInDays >= 7) {
        return {
          ...item,
          reviewStatus: "overdue" as const,
          reviewStatusLabel: "Overdue",
        };
      }

      return {
        ...item,
        reviewStatus: "recent" as const,
        reviewStatusLabel: "Reviewed recently",
      };
    });
  }, [savedWatchlistQueue]);
  const marketSectionJumpActions = [
    ["heatmap", "Heatmap"],
    ["overview", "Overview"],
    ["compare", "Compare"],
    ["trends", "Trends"],
    ["conversation", "Now vs suggested"],
    ["fit", "Why it fits"],
    ["operations", "Ops"],
  ] as const;
  const savedWatchlistStatusCounts = useMemo(() => {
    return {
      newCount: savedWatchlistQueueWithStatus.filter((item) => item.reviewStatus === "new").length,
      overdueCount: savedWatchlistQueueWithStatus.filter((item) => item.reviewStatus === "overdue")
        .length,
      suggestedCount: savedWatchlistQueueWithStatus.filter((item) =>
        suggestedSectorIds.has(item.sector.id),
      ).length,
    };
  }, [savedWatchlistQueueWithStatus, suggestedSectorIds]);
  const filteredSavedWatchlistQueue = useMemo(() => {
    if (watchlistFilter === "review-now") {
      return savedWatchlistQueueWithStatus.filter(
        (item) => item.reviewStatus === "new" || item.reviewStatus === "overdue",
      );
    }

    if (watchlistFilter === "suggested") {
      return savedWatchlistQueueWithStatus.filter((item) => suggestedSectorIds.has(item.sector.id));
    }

    return savedWatchlistQueueWithStatus;
  }, [savedWatchlistQueueWithStatus, suggestedSectorIds, watchlistFilter]);
  const groupedSavedWatchlistSections = useMemo(() => {
    const studyNow = filteredSavedWatchlistQueue.filter(
      (item) => item.bucket === "study-now" && item.reviewStatus !== "recent",
    );
    const watch = filteredSavedWatchlistQueue.filter(
      (item) => item.bucket !== "study-now" && item.reviewStatus !== "recent",
    );
    const reviewed = filteredSavedWatchlistQueue.filter((item) => item.reviewStatus === "recent");

    return [
      {
        description:
          "These are the saved sectors that still deserve a focused learning pass before they fade into background noise.",
        empty:
          watchlistFilter === "review-now"
            ? "Nothing currently needs a fresh study pass."
            : "No saved sectors are sitting in the study-now lane right now.",
        key: "study-now",
        label: "Study now",
        rows: studyNow,
      },
      {
        description:
          "These sectors are worth keeping in rotation, but they do not need your deepest attention right now.",
        empty:
          watchlistFilter === "review-now"
            ? "Nothing is waiting in the lighter watch lane right now."
            : "No saved sectors are in the active watch lane right now.",
        key: "watch",
        label: "Watch",
        rows: watch,
      },
      {
        description:
          "These were reviewed recently, so they can stay parked here until the regime changes or you want another pass.",
        empty:
          watchlistFilter === "review-now"
            ? "Nothing has been reviewed recently inside this filtered view."
            : "Nothing has been marked reviewed recently yet.",
        key: "reviewed",
        label: "Reviewed",
        rows: reviewed,
      },
    ] as const;
  }, [filteredSavedWatchlistQueue, watchlistFilter]);
  const compareLeftSector = useMemo(
    () => sectorGroups.find((group) => group.id === compareLeftSectorId) ?? null,
    [compareLeftSectorId, sectorGroups],
  );
  const compareRightSector = useMemo(
    () => sectorGroups.find((group) => group.id === compareRightSectorId) ?? null,
    [compareRightSectorId, sectorGroups],
  );
  const compareLeftFit = useMemo(
    () => suggestedSectorFit.rows.find((row) => row.id === compareLeftSectorId) ?? null,
    [compareLeftSectorId, suggestedSectorFit.rows],
  );
  const compareRightFit = useMemo(
    () => suggestedSectorFit.rows.find((row) => row.id === compareRightSectorId) ?? null,
    [compareRightSectorId, suggestedSectorFit.rows],
  );
  const selectedSectorFit = useMemo(
    () =>
      selectedSectorId === "all-suggested"
        ? null
        : suggestedSectorFit.rows.find((row) => row.id === selectedSectorId) ?? null,
    [selectedSectorId, suggestedSectorFit.rows],
  );
  const selectedSectorPriority = useMemo(() => {
    if (!selectedSectorGroup) return null;

    return getSectorPriorityLabel({
      fitStatus: selectedSectorFit?.status ?? null,
      isLeader: sectorBreadth.strongest === selectedSectorGroup.name,
      isSuggested: Boolean(selectedSuggestedSector),
    });
  }, [
    sectorBreadth.strongest,
    selectedSectorFit?.status,
    selectedSectorGroup,
    selectedSuggestedSector,
  ]);
  const currentLeaderSectorGroup = useMemo(
    () => sectorGroups.find((group) => group.name === sectorBreadth.strongest) ?? null,
    [sectorBreadth.strongest, sectorGroups],
  );
  const topSuggestedSectorGroup = useMemo(
    () => sectorGroups.find((group) => group.id === topSuggestedSector?.id) ?? null,
    [sectorGroups, topSuggestedSector?.id],
  );
  const secondSuggestedSectorGroup = useMemo(
    () => sectorGroups.find((group) => group.id === secondSuggestedSector?.id) ?? null,
    [sectorGroups, secondSuggestedSector?.id],
  );
  const topSuggestedFit = useMemo(
    () =>
      topSuggestedSector ? suggestedSectorFit.rows.find((row) => row.id === topSuggestedSector.id) ?? null : null,
    [suggestedSectorFit.rows, topSuggestedSector],
  );
  const quickCompare = useMemo(() => {
    const primarySector = selectedSectorId === "all-suggested" ? topSuggestedSectorGroup : selectedSectorGroup;
    const primaryFit = selectedSectorId === "all-suggested" ? topSuggestedFit : selectedSectorFit;
    const secondarySector =
      !primarySector || primarySector.id !== topSuggestedSectorGroup?.id
        ? topSuggestedSectorGroup
        : secondSuggestedSectorGroup;
    const secondaryFit =
      secondarySector?.id === topSuggestedSectorGroup?.id
        ? topSuggestedFit
        : secondarySector
          ? suggestedSectorFit.rows.find((row) => row.id === secondarySector.id) ?? null
          : null;

    if (!primarySector || !secondarySector) return null;

    const primaryGap = primaryFit?.gapToSuggested ?? 0;
    const secondaryGap = secondaryFit?.gapToSuggested ?? 0;
    const strongerSector = primarySector.change >= secondarySector.change ? primarySector : secondarySector;
    const biggerGapSector =
      primaryGap >= secondaryGap ? primaryFit?.name ?? primarySector.name : secondaryFit?.name ?? secondarySector.name;

    return {
      biggerGapSector,
      detail:
        selectedSectorId === "all-suggested"
          ? `${primarySector.name} is the cleanest suggested starting point right now. Compare it with ${secondarySector.name} to see whether the next useful study lane is another suggested leader or just market context.`
          : `${primarySector.name} is your active read. Compare it with ${secondarySector.name} so you can separate what is strong on tape from what still has the more useful fit gap for your portfolio.`,
      headline:
        selectedSectorId === "all-suggested"
          ? `${primarySector.name} is the best default sector to open next.`
          : `${primarySector.name} vs ${secondarySector.name} is the clearest next comparison from your current selection.`,
      primaryFit,
      primarySector,
      secondaryFit,
      secondarySector,
      strongerSector,
    };
  }, [
    secondSuggestedSectorGroup,
    selectedSectorFit,
    selectedSectorGroup,
    selectedSectorId,
    suggestedSectorFit.rows,
    topSuggestedFit,
    topSuggestedSectorGroup,
  ]);
  const compareSummary = useMemo(() => {
    if (!compareLeftSector || !compareRightSector) return null;

    const stronger =
      compareLeftSector.change >= compareRightSector.change ? compareLeftSector : compareRightSector;
    const softer =
      stronger.id === compareLeftSector.id ? compareRightSector : compareLeftSector;
    const moveGap = Number(Math.abs(compareLeftSector.change - compareRightSector.change).toFixed(2));
    const strongerFit = stronger.id === compareLeftSector.id ? compareLeftFit : compareRightFit;
    const softerFit = softer.id === compareLeftSector.id ? compareLeftFit : compareRightFit;
    const strongerPriority = getSectorPriorityLabel({
      fitStatus: strongerFit?.status ?? null,
      isLeader: sectorBreadth.strongest === stronger.name,
      isSuggested: suggestedSectorIds.has(stronger.id),
    });
    const softerPriority = getSectorPriorityLabel({
      fitStatus: softerFit?.status ?? null,
      isLeader: sectorBreadth.strongest === softer.name,
      isSuggested: suggestedSectorIds.has(softer.id),
    });
    const takeaway =
      strongerPriority === softerPriority
        ? `${strongerPriority} both sectors, but start with ${stronger.name} because it has the stronger live momentum.`
        : `${strongerPriority} ${stronger.name} first, keep ${softer.name} on ${softerPriority.toLowerCase()}.`;
    const studySector =
      strongerPriority === "Study"
        ? stronger
        : softerPriority === "Study"
          ? softer
          : stronger;
    const studyVerdict =
      strongerPriority === "Study" && softerPriority !== "Study"
        ? `${stronger.name} is the better study lane right now because it combines market strength with a more urgent portfolio-use case.`
        : softerPriority === "Study" && strongerPriority !== "Study"
          ? `${softer.name} is the better study lane right now because the fit gap matters more than the stronger tape move.`
          : `Start with ${studySector.name}, then use the other sector as a contrast read instead of trying to act on both.`;
    const trackSector = studySector.id === stronger.id ? softer : stronger;
    const trackVerdict =
      trackSector.id === stronger.id
        ? `${trackSector.name} is worth tracking for market leadership, but it does not need to become your first move.`
        : `${trackSector.name} is worth tracking as the comparison lane so you can keep perspective on what the leader is doing.`;
    const restraintVerdict =
      strongerPriority === "Study" && softerPriority === "Study"
        ? "Do not treat this comparison like a reason to widen exposure immediately. Learn the sector structure first, then decide slowly."
        : `Do not chase ${stronger.name} just because it is stronger on tape today. Use the fit and sub-sector read before changing anything.`;

    return {
      fitLead:
        (compareLeftFit?.gapToSuggested ?? Number.NEGATIVE_INFINITY) >=
        (compareRightFit?.gapToSuggested ?? Number.NEGATIVE_INFINITY)
          ? compareLeftFit?.name ?? compareLeftSector.name
          : compareRightFit?.name ?? compareRightSector.name,
      moveGap,
      softerPriority,
      softer,
      stronger,
      strongerPriority,
      studyVerdict,
      studySector,
      takeawayTone:
        studySector.id === stronger.id
          ? "momentum-with-fit"
          : "fit-over-momentum",
      trackSector,
      trackVerdict,
      restraintVerdict,
      takeaway,
    };
  }, [
    compareLeftFit,
    compareLeftSector,
    compareRightFit,
    compareRightSector,
    sectorBreadth.strongest,
    suggestedSectorIds,
  ]);
  const selectedSectorCompareRole = useMemo(
    () =>
      selectedSectorId === "all-suggested"
        ? null
        : getComparisonRoleLabel({
            compareAutoSync,
            leftId: compareLeftSectorId,
            rightId: compareRightSectorId,
            sectorId: selectedSectorId,
          }),
    [compareAutoSync, compareLeftSectorId, compareRightSectorId, selectedSectorId],
  );

  function focusSectorFromSuggestion(
    sectorId: string,
    source: "compare" | "watchlist" | "suggested" | "explorer" | "review-queue" = "explorer",
  ) {
    if (!sectorGroups.some((group) => group.id === sectorId)) return;
    const sectorLabel =
      sectorGroups.find((group) => group.id === sectorId)?.name ?? "This sector";

    setMarketActionFeedback({
      message:
        source === "compare"
          ? `Opened ${sectorLabel} from the sector comparison view.`
          : source === "watchlist"
            ? `Opened ${sectorLabel} from your saved market watchlist.`
            : source === "suggested"
              ? `Opened ${sectorLabel} from the suggested sector view.`
              : source === "review-queue"
                ? `Opened ${sectorLabel} from the market review queue.`
                : `Opened ${sectorLabel} from the sector explorer.`,
      tone: "open",
    });
    setSelectedSectorId(sectorId);
  }

  function handleManualCompareSelection(side: "left" | "right", sectorId: string) {
    setCompareAutoSync(false);
    if (side === "left") {
      setCompareLeftSectorId(sectorId);
      return;
    }
    setCompareRightSectorId(sectorId);
  }

  function handleToggleSectorWatchlist(
    sectorId: string,
    source: "compare" | "explorer" | "watchlist" | "suggested" = "explorer",
  ) {
    const sectorLabel =
      sectorGroups.find((group) => group.id === sectorId)?.name ?? "This sector";

    setSavedWatchlistEntries((current) => {
      const exists = current.some((entry) => entry.sectorId === sectorId);
      const nextEntries = toggleMarketWatchlistSector(sectorId, current);

      const addedMessage =
        source === "compare"
          ? `${sectorLabel} saved for review from this sector comparison.`
          : source === "suggested"
            ? `${sectorLabel} saved from the suggested sector view.`
            : source === "watchlist"
              ? `${sectorLabel} added back to your saved market watchlist.`
              : `${sectorLabel} saved from the sector explorer.`;
      const removedMessage =
        source === "compare"
          ? `${sectorLabel} removed from your saved market watchlist after this comparison.`
          : source === "suggested"
            ? `${sectorLabel} removed from your saved list from the suggested sector view.`
            : source === "watchlist"
              ? `${sectorLabel} removed from your saved market watchlist.`
              : `${sectorLabel} removed from your saved list from the sector explorer.`;

      setMarketActionFeedback({
        message: exists ? removedMessage : addedMessage,
        tone: exists ? "remove" : "save",
      });

      return nextEntries;
    });
  }

  function handleMarkSectorReviewed(sectorId: string) {
    setSavedWatchlistEntries((current) => markMarketWatchlistSectorReviewed(sectorId, current));
    const sectorLabel =
      sectorGroups.find((group) => group.id === sectorId)?.name ?? "This sector";
    setMarketActionFeedback({
      message: `${sectorLabel} marked as reviewed for now.`,
      tone: "save",
    });
  }

  function openWatchlistLane(lane: "reviewed" | "study-now" | "watch") {
    watchlistLaneRefs.current[lane]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMarketActionFeedback({
      message:
        lane === "study-now"
          ? "Jumped to the Study now lane in your saved market watchlist."
          : lane === "watch"
            ? "Jumped to the Watch lane in your saved market watchlist."
            : "Jumped to the Reviewed lane in your saved market watchlist.",
      tone: "open",
    });
  }

  function loadConversationComparison(focusSectorId: string) {
    const focusSector = sectorGroups.find((group) => group.id === focusSectorId) ?? null;
    if (!focusSector) return;

    const primarySector = currentLeaderSectorGroup ?? focusSector;
    const secondarySector =
      primarySector.id !== focusSector.id
        ? focusSector
        : topSuggestedSectorGroup && topSuggestedSectorGroup.id !== primarySector.id
          ? topSuggestedSectorGroup
          : secondSuggestedSectorGroup && secondSuggestedSectorGroup.id !== primarySector.id
            ? secondSuggestedSectorGroup
            : null;

    if (!secondarySector) {
      focusSectorFromSuggestion(focusSector.id, "compare");
      return;
    }

    setCompareAutoSync(false);
    setCompareLeftSectorId(primarySector.id);
    setCompareRightSectorId(secondarySector.id);
    setMarketActionFeedback({
      message: `Loaded ${primarySector.name} vs ${secondarySector.name} into the sector comparison strip.`,
      tone: "open",
    });
  }

  function openMarketSection(sectionId: MarketSectionId, label: string) {
    marketSectionRefs.current[sectionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMarketActionFeedback({
      message: `Opened ${label.toLowerCase()} on the market page.`,
      tone: "open",
    });
  }

  function handleMarketPriorityAction(action: MarketPriorityAction) {
    switch (action) {
      case "open-overview":
        openMarketSection("overview", "Overview");
        return;
      case "open-fit":
        openMarketSection("fit", "Why it fits");
        return;
      case "open-compare":
        openMarketSection("compare", "Compare");
        return;
      case "open-trends":
        openMarketSection("trends", "Trends");
        return;
      case "open-operations":
        openMarketSection("operations", "Ops");
        return;
      case "review-next":
        if (reviewQueueSummary.next) {
          handleMarkSectorReviewed(reviewQueueSummary.next.sector.id);
          focusSectorFromSuggestion(reviewQueueSummary.next.sector.id, "review-queue");
        }
        return;
      case "focus-top-suggested":
        if (topSuggestedSector) {
          focusSectorFromSuggestion(topSuggestedSector.id, "suggested");
        }
        return;
      default:
        return;
    }
  }

  useEffect(() => {
    setSavedWatchlistEntries(loadMarketWatchlist());
  }, []);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | null = null;

    async function loadMarketSnapshot() {
      try {
        const supabase = getSupabaseBrowserClient();
        const session = supabase ? await supabase.auth.getSession() : null;
        const accessToken = session?.data.session?.access_token;
        const response = await fetch(
          `/api/market-snapshot?source=${marketPreferences.preferredSource}&refresh=${refreshNonce > 0 ? "force" : "auto"}`,
          {
            cache: "no-store",
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          },
        );
        const data = normalizeMarketSnapshotResponse(await response.json());
        const watchData = marketPreferences.includeHoldingsWatch
          ? normalizeHoldingsWatchResponse(
              await (
                await fetch("/api/market-snapshot", {
                  body: JSON.stringify({
                    assets,
                    preferredSource: marketPreferences.preferredSource,
                  }),
                  cache: "no-store",
                  headers: { "Content-Type": "application/json" },
                  method: "POST",
                })
              ).json(),
            )
          : { holdingsWatch: [] };

        if (!isMounted) return;
        setMarketData({
          ...data,
          holdingsWatch: watchData.holdingsWatch,
        });
        setLastRefreshedAt(new Date().toISOString());
      } catch {
        if (!isMounted) return;
        setMarketData(
          buildFallbackMarketResponse(
            "Market route is unavailable right now. Showing fallback snapshot.",
          ),
        );
      } finally {
        // no-op: the dashboard now keeps rendering with fallback data while live refresh settles
      }
    }

    void loadMarketSnapshot();

    if (marketPreferences.autoRefresh) {
      intervalId = window.setInterval(
        () => void loadMarketSnapshot(),
        Math.max(30, marketPreferences.pollingIntervalSeconds) * 1000,
      );
    }

    return () => {
      isMounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [
    assets,
    marketPreferences.autoRefresh,
    marketPreferences.includeHoldingsWatch,
    marketPreferences.pollingIntervalSeconds,
    marketPreferences.preferredSource,
    refreshNonce,
  ]);

  useEffect(() => {
    if (!sectorSelectorOptions.some(([value]) => value === selectedSectorId)) {
      setSelectedSectorId("all-suggested");
    }
  }, [sectorSelectorOptions, selectedSectorId]);

  useEffect(() => {
    const resolved = resolveDistinctSectorIds(
      sectorGroups.map((group) => group.id),
      compareLeftSectorId,
      compareRightSectorId,
    );

    if (
      resolved.primaryId !== compareLeftSectorId ||
      resolved.secondaryId !== compareRightSectorId
    ) {
      setCompareLeftSectorId(resolved.primaryId);
      setCompareRightSectorId(resolved.secondaryId);
    }
  }, [compareLeftSectorId, compareRightSectorId, sectorGroups]);

  useEffect(() => {
    if (!compareAutoSync || !quickCompare) return;

    if (
      compareLeftSectorId !== quickCompare.primarySector.id ||
      compareRightSectorId !== quickCompare.secondarySector.id
    ) {
      setCompareLeftSectorId(quickCompare.primarySector.id);
      setCompareRightSectorId(quickCompare.secondarySector.id);
    }
  }, [
    compareAutoSync,
    compareLeftSectorId,
    compareRightSectorId,
    quickCompare,
  ]);

  useEffect(() => {
    if (savedWatchlistEntries.length === visibleSavedWatchlistEntries.length) return;
    setSavedWatchlistEntries(visibleSavedWatchlistEntries);
  }, [savedWatchlistEntries.length, visibleSavedWatchlistEntries]);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{marketData.sentiment}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
            <Badge variant="outline">{marketTrack.title}</Badge>
          </div>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Market Dashboard</CardTitle>
              <CardDescription>{marketData.message}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {reviewQueueSummary.reviewNow.length ? (
                <>
                  <Badge variant="secondary">
                    Review now {reviewQueueSummary.reviewNow.length}
                  </Badge>
                  {reviewQueueSummary.next ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        handleMarkSectorReviewed(reviewQueueSummary.next?.sector.id ?? "");
                        focusSectorFromSuggestion(reviewQueueSummary.next?.sector.id ?? "");
                      }}
                    >
                      Review {reviewQueueSummary.next.sector.name}
                    </Button>
                  ) : null}
                </>
              ) : null}
              <Badge variant="secondary">{marketData.sentiment}</Badge>
              <Badge variant="outline">{marketData.source}</Badge>
              <Badge variant={marketPreferences.autoRefresh ? "secondary" : "outline"}>
                {marketPreferences.autoRefresh
                  ? `${marketPreferences.pollingIntervalSeconds}s polling`
                  : "manual refresh"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 rounded-md border bg-muted/30 p-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm font-medium">{marketFocusHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {marketFocusDetail}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    1. Read breadth
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    Check whether strength is broad or being carried by a few heavy sectors.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    2. Check your mix
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    Compare the market tone with your tracked holdings before changing anything.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    3. Stay on-plan
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    Use this page to inform rebalancing and learning, not to manufacture trades.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next move
                </p>
                <p className="mt-2 text-sm leading-6">{marketTrack.items[0]}</p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Market read
                </p>
                <p className="mt-2 text-sm leading-6">
                  {marketData.sentiment === "Constructive"
                    ? "Breadth is supportive. Good time to stick with planned contributions rather than chase heat."
                    : marketData.sentiment === "Cautious"
                      ? "Breadth is softer. Useful time to review allocation resilience and emotional readiness."
                      : "The tape is mixed. Best use of this screen is interpretation, not prediction."}
                </p>
                <div className="mt-3">
                  <AskMentorLink
                    label="Ask AI mentor about this market read"
                    mentorPrompt={`The current market tone is ${marketData.sentiment}. ${marketPortfolioNote.title}. Help me understand what matters for my portfolio and risk fit right now.`}
                    mentorQuestionId="allocation"
                    onOpenMentor={onOpenMentor}
                    sourceLabel="Market live read"
                    contextLabel="Review this live market tone"
                    contextNote="Use the current market sentiment, breadth, and holdings-watch context from the market page."
                    returnState={{ view: "market", target: selectedSectorId }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border bg-background p-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {marketStatusCards.map((item) => (
                <div key={item.label} className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              {marketJumpCards.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => openMarketSection(item.sectionId, item.title)}
                  className="rounded-md border bg-muted/10 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <Badge variant="outline">{item.badge}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-md border border-border/70 bg-background/80 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Priority queue</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use this when you want the shortest route from market context to the next useful study or compare move.
                </p>
              </div>
              <Badge variant="outline">{marketPriorityQueue.length} active focus</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {marketPriorityQueue.map(({ action, detail, label, section, tone }) => (
                <div
                  key={`${section}-${label}`}
                  className="rounded-md border border-border/70 bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <Badge
                      variant="outline"
                      className={
                        tone === "urgent"
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-300"
                          : tone === "watch"
                            ? "border-primary/30 text-primary"
                            : "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                      }
                    >
                      {tone === "urgent"
                        ? "Now"
                        : tone === "watch"
                          ? "Next"
                          : "Keep in view"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {section}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handleMarketPriorityAction(action)}
                  >
                    Open lane
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3 md:grid-cols-3">
              {marketOperatingLenses.map((lens) => (
                <div
                  key={lens.label}
                  className="rounded-md border border-border/70 bg-background p-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {lens.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{lens.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{lens.detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Working order
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
                {marketWorkingOrder.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border bg-background p-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-medium">Explorer controls</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Pick the market lens you want to inspect first, then decide whether this is a study lane, a compare lane, or just context.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Sector lens"
                value={selectedSectorId}
                options={sectorSelectorOptions}
                onChange={setSelectedSectorId}
              />
              <SegmentedControl
                label="Trend lens"
                options={[
                  ["1d", "Day"],
                  ["1w", "Week"],
                  ["1m", "Month"],
                ]}
                value={trendWindow}
                onChange={(value) => setTrendWindow(value as MarketTrendWindow)}
              />
            </div>
          </div>
          <div className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                First question
              </p>
              <p className="mt-2 text-sm text-foreground">
                Is this lane useful because it is leading the tape, because it fits your portfolio gap, or just because it is noisy today?
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Read this with
              </p>
              <p className="mt-2 text-sm text-foreground">
                Use sector lens, trend lens, and compare together before treating any move as an allocation idea.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best move
              </p>
              <p className="mt-2 text-sm text-foreground">
                Review one lane, then either compare it or save it. Do not try to process the whole market at once.
              </p>
            </div>
          </div>
          <div className="rounded-md border bg-background p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Market workspace guide</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Move through the page in order: scan the tape, compare the fit, read the trend,
                  then decide what to save or study.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {marketSectionJumpActions.map(([sectionId, label]) => (
                  <Button
                    key={sectionId}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => openMarketSection(sectionId as MarketSectionId, label)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-background p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium">Today on market</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Start with the highest-signal lane, then jump directly into the section that can sharpen your next decision.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reviewQueueSummary.next ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      handleMarkSectorReviewed(reviewQueueSummary.next?.sector.id ?? "");
                      focusSectorFromSuggestion(reviewQueueSummary.next?.sector.id ?? "");
                    }}
                  >
                    Review {reviewQueueSummary.next.sector.name}
                  </Button>
                ) : null}
                <AskMentorLink
                  label="Ask AI mentor"
                  mentorPrompt={`From the market page, help me decide what deserves my attention first between live breadth, suggested sectors, my review queue, and my tracked holdings watch.`}
                  mentorQuestionId="allocation"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Market summary"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => openMarketSection("heatmap", "Heatmap")}
                className="rounded-md border border-border/70 bg-muted/15 p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Market tone
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{marketData.sentiment}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/80 p-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {marketData.sentiment === "Constructive"
                    ? "Breadth is supportive, so this is a good read-and-compare session, not a chase session."
                    : marketData.sentiment === "Cautious"
                      ? "Breadth is softer, so use this page to check resilience and fit gaps before reacting."
                      : "The tape is mixed, which makes comparison and context more useful than conviction."}
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  topSuggestedSector
                    ? focusSectorFromSuggestion(topSuggestedSector.id, "suggested")
                    : openMarketSection("fit", "Why it fits")
                }
                className="rounded-md border border-border/70 bg-muted/15 p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Best fit
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {topSuggestedSector?.name ?? "Suggested sectors"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/80 p-2">
                    <Compass className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {topSuggestedSector
                    ? `${topSuggestedSector.name} is the cleanest suggested opening read from your current market-and-fit picture.`
                    : "Use the suggested-sector lens to find the first sector worth understanding more deeply."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => openMarketSection("operations", "Ops")}
                className="rounded-md border border-border/70 bg-muted/15 p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Review queue
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {reviewQueueSummary.reviewNow.length > 0
                        ? `${reviewQueueSummary.reviewNow.length} to review`
                        : "Clear for now"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/80 p-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {reviewQueueSummary.reviewNow.length
                    ? `${reviewQueueSummary.reviewNow.length} saved sector${reviewQueueSummary.reviewNow.length === 1 ? "" : "s"} deserve fresh review before they go stale in your watchlist.`
                    : "Your saved watchlist does not have any overdue review lanes right now."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => openMarketSection("overview", "Overview")}
                className="rounded-md border border-border/70 bg-muted/15 p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Portfolio link
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {holdingsWatchSummary.trackedTotal > 0
                        ? `${holdingsWatchSummary.deltaPercent >= 0 ? "+" : ""}${holdingsWatchSummary.deltaPercent.toFixed(2)}% watch`
                        : "Add tracked holdings"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/80 p-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {holdingsWatchSummary.trackedTotal > 0
                    ? `${holdingsWatchSummary.trackedCount} tracked holding${holdingsWatchSummary.trackedCount === 1 ? "" : "s"} are already feeding the market lens.`
                    : "Map more of the portfolio so this page can compare live market tone with your actual holdings."}
                </p>
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-md border bg-muted/30 p-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Live market loop</p>
                <p className="text-xs text-muted-foreground">
                  {activeIntegrations.length} active integration sources and {marketPreferences.preferredSource} market source selected.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRefreshNonce((current) => current + 1)}
              >
                Refresh now
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onUpdatePreferences({
                    ...marketPreferences,
                    autoRefresh: !marketPreferences.autoRefresh,
                  })
                }
              >
                {marketPreferences.autoRefresh ? "Pause polling" : "Resume polling"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Refreshed {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : "not yet"}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {marketData.snapshot.map((item) => (
              <MarketTile key={item.name} item={item} />
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{marketData.sentiment}</Badge>
              <Badge variant="outline">
                {sectorBreadth.advancing} up / {sectorBreadth.declining} down
              </Badge>
              {holdingsWatchSummary.trackedTotal > 0 && (
                <Badge variant="outline">
                  Watch {holdingsWatchSummary.deltaPercent >= 0 ? "+" : ""}
                  {holdingsWatchSummary.deltaPercent.toFixed(2)}%
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm font-medium">{marketPortfolioNote.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {marketPortfolioNote.detail}
            </p>
          </div>
          <div className="rounded-md border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              {marketRegime.leader ? <Badge variant="secondary">Leader: {marketRegime.leader}</Badge> : null}
              {marketRegime.defensive ? (
                <Badge variant="outline">Defensive: {marketRegime.defensive}</Badge>
              ) : null}
              {marketRegime.laggard ? <Badge variant="outline">Laggard: {marketRegime.laggard}</Badge> : null}
              {marketRegime.watchlist ? (
                <Badge variant="outline">Watch next: {marketRegime.watchlist}</Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium">Sector regime</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {marketRegime.headline}
            </p>
          </div>
        </CardContent>
      </Card>

      <div ref={(node) => {
        marketSectionRefs.current.heatmap = node;
      }}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Sector heatmap and ranking</CardTitle>
              <CardDescription>
                A faster scan of all sectors by strength, tone, and suggested relevance before you
                open a single sector in detail.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{sectorBreadth.advancing} advancing</Badge>
              <Badge variant="outline">{sectorBreadth.declining} declining</Badge>
              <Badge variant="outline">{sectorBreadth.flat} flat</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Scan first
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Start with the strongest and weakest lanes before reading any one sector in detail.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                That tells you whether the tape is broad, concentrated, or rolling over unevenly.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best use
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Review sectors to learn structure. Load compare when two lanes both look relevant.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The save action is for follow-up, not for turning every move into a trade candidate.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Current cue
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {sectorBreadth.strongest ?? "Leader pending"} is leading while {sectorBreadth.weakest ?? "laggards"} are softest.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Use that spread to decide whether you are looking at healthy breadth or a narrow move.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sortedSectorGroups.map((sector, index) => {
              const toneClass =
                sector.change >= 0.75
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : sector.change >= 0.2
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : sector.change <= -0.2
                      ? "border-rose-500/30 bg-rose-500/8"
                      : "border-border bg-background";

              return (
                <div
                  key={`heat-${sector.id}`}
                  className={`rounded-md border p-4 transition-colors hover:border-primary/40 ${toneClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Rank #{index + 1}
                      </p>
                      <p className="mt-2 font-medium">{sector.name}</p>
                    </div>
                    <Badge variant={sector.change >= 0 ? "secondary" : "outline"}>
                      {sector.change >= 0 ? "+" : ""}
                      {sector.change.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedSectorIds.has(sector.id) ? (
                      <Badge variant="secondary">Suggested</Badge>
                    ) : null}
                    {sectorBreadth.strongest === sector.name ? (
                      <Badge variant="outline">Top momentum</Badge>
                    ) : null}
                    {sectorBreadth.weakest === sector.name ? (
                      <Badge variant="outline">Weakest tone</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground line-clamp-3">
                    {sector.topIdea}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setSelectedSectorId(sector.id)}
                    >
                      Review sector
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => loadConversationComparison(sector.id)}
                    >
                      Load compare
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => handleToggleSectorWatchlist(sector.id, "explorer")}
                    >
                      {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save lane"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-md border bg-background">
            <div className="grid grid-cols-[auto_1.2fr_auto_auto_auto] gap-3 border-b px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid-cols-[auto_1.2fr_auto_auto_auto_auto_auto]">
              <span>Rank</span>
              <span>Sector</span>
              <span>Move</span>
              <span>Suggested</span>
              <span className="hidden md:inline">View</span>
              <span className="hidden md:inline">Compare</span>
              <span className="hidden md:inline">Save</span>
              <span className="md:hidden">Actions</span>
            </div>
            <div className="divide-y">
              {sortedSectorGroups.map((sector, index) => (
                <div
                  key={`rank-${sector.id}`}
                  className="grid grid-cols-[auto_1.2fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm md:grid-cols-[auto_1.2fr_auto_auto_auto_auto_auto]"
                >
                  <span className="font-medium text-muted-foreground">{index + 1}</span>
                  <div>
                    <p className="font-medium">{sector.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Strongest pocket:{" "}
                      {[...sector.subSectors].sort((left, right) => right.value - left.value)[0]?.name ??
                        "Core names"}
                    </p>
                  </div>
                  <span
                    className={
                      sector.change >= 0 ? "font-medium text-emerald-600" : "font-medium text-rose-600"
                    }
                  >
                    {sector.change >= 0 ? "+" : ""}
                    {sector.change.toFixed(2)}%
                  </span>
                  <span>
                    {suggestedSectorIds.has(sector.id) ? (
                      <Badge variant="secondary">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-2 md:contents">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setSelectedSectorId(sector.id)}
                    >
                      Review sector
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => loadConversationComparison(sector.id)}
                    >
                      Load compare
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => handleToggleSectorWatchlist(sector.id, "explorer")}
                    >
                      {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save lane"}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <div ref={(node) => {
        marketSectionRefs.current.overview = node;
      }}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>All sectors at a glance</CardTitle>
              <CardDescription>
                Scan the full market first, then dive into the sectors that look strongest,
                weakest, or most relevant for your plan.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{sectorGroups.length} sectors tracked</Badge>
              <Badge variant="outline">
                {suggestedSectorSnapshot.sectors.length} suggested for deeper study
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-background p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Use this overview to pick one lane, not five</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The point here is to turn the full market into one clean next read: a leader, a best-fit sector, or a caution lane.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {topSuggestedSector ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => focusSectorFromSuggestion(topSuggestedSector.id, "suggested")}
                  >
                    Review {topSuggestedSector.name}
                  </Button>
                ) : null}
                {secondSuggestedSector ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => loadConversationComparison(secondSuggestedSector.id)}
                  >
                    Load compare
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                First question
              </p>
              <p className="mt-2 text-sm text-foreground">
                Is the strongest lane also the most relevant lane for your portfolio, or is it just the loudest move on the screen?
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Read this with
              </p>
              <p className="mt-2 text-sm text-foreground">
                Pair market leaders with suggested sectors and your holdings watch before deciding what deserves real attention.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best move
              </p>
              <p className="mt-2 text-sm text-foreground">
                Pick one leader, one best-fit lane, and one caution lane. That is enough for a useful market session.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best momentum right now
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {currentLeaderSectorGroup?.name ?? sectorBreadth.strongest ?? "Market leader"}
                </p>
                {currentLeaderSectorGroup ? (
                  <Badge variant="secondary">
                    +{currentLeaderSectorGroup.change.toFixed(2)}%
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start here when you want to understand what is actually leading the tape before
                chasing single names.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best fit for your plan
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {topSuggestedSector?.name ?? suggestedSectorSnapshot.sectors[0]?.name ?? "Suggested sectors"}
                </p>
                {topSuggestedSector ? (
                  <Badge
                    variant="outline"
                    className={getSectorPriorityBadgeClass(
                      getSectorPriorityLabel({
                        fitStatus: topSuggestedSector.fitStatus,
                        isLeader: sectorBreadth.strongest === topSuggestedSector.name,
                        isSuggested: true,
                      }),
                    )}
                  >
                    {getSectorPriorityLabel({
                      fitStatus: topSuggestedSector.fitStatus,
                      isLeader: sectorBreadth.strongest === topSuggestedSector.name,
                      isSuggested: true,
                    })}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use this as your first suggested-sector read when you want the market view to stay
                connected to your current portfolio and risk posture.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Be careful around
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-medium">{sectorBreadth.weakest ?? "The weakest pocket"}</p>
                {sectorLeaders.weakest[0] ? (
                  <Badge variant="outline">
                    {sectorLeaders.weakest[0].change >= 0 ? "+" : ""}
                    {sectorLeaders.weakest[0].change.toFixed(2)}%
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Treat this as a review lane, not an impulse lane. Compare it before acting so you
                can tell whether weakness is isolated or part of a broader risk-off move.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Strongest today
              </p>
              <div className="mt-3 grid gap-2">
                {sectorLeaders.strongest.map((sector) => (
                  <div
                    key={`leader-${sector.id}`}
                    className="rounded-md border bg-background px-3 py-3"
                  >
                    {(() => {
                      const compareRole = getComparisonRoleLabel({
                        compareAutoSync,
                        leftId: compareLeftSectorId,
                        rightId: compareRightSectorId,
                        sectorId: sector.id,
                      });

                      return compareRole ? (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={compareLeftSectorId === sector.id ? "secondary" : "outline"}>
                            {compareRole}
                          </Badge>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{sector.name}</p>
                      <Badge variant="secondary">+{sector.change.toFixed(2)}%</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Strongest pocket: {sector.subSectors[0]?.name ?? "Core names"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelectedSectorId(sector.id)}
                      >
                        Review sector
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => loadConversationComparison(sector.id)}
                      >
                        Load compare
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleToggleSectorWatchlist(sector.id, "overview")}
                      >
                        {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save lane"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weakest today
              </p>
              <div className="mt-3 grid gap-2">
                {sectorLeaders.weakest.map((sector) => (
                  <div
                    key={`laggard-${sector.id}`}
                    className="rounded-md border bg-background px-3 py-3"
                  >
                    {(() => {
                      const compareRole = getComparisonRoleLabel({
                        compareAutoSync,
                        leftId: compareLeftSectorId,
                        rightId: compareRightSectorId,
                        sectorId: sector.id,
                      });

                      return compareRole ? (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={compareLeftSectorId === sector.id ? "secondary" : "outline"}>
                            {compareRole}
                          </Badge>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{sector.name}</p>
                      <Badge variant="outline">
                        {sector.change >= 0 ? "+" : ""}
                        {sector.change.toFixed(2)}%
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Watch whether weakness is isolated or part of broader risk-off behavior.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelectedSectorId(sector.id)}
                      >
                        Review sector
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => loadConversationComparison(sector.id)}
                      >
                        Load compare
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleToggleSectorWatchlist(sector.id, "overview")}
                      >
                        {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save lane"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested overlay
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                These sectors are the overlap between the live market read and what looks most
                useful for your current holdings and risk posture.
              </p>
              <div className="mt-3 grid gap-2">
                {suggestedSectorSnapshot.sectors.map((sector) => (
                  (() => {
                    const compareRole = getComparisonRoleLabel({
                      compareAutoSync,
                      leftId: compareLeftSectorId,
                      rightId: compareRightSectorId,
                      sectorId: sector.id,
                    });

                    return (
                      <div
                        key={`overlay-${sector.id}`}
                        className="rounded-md border bg-background px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{sector.name}</p>
                          {compareRole ? (
                            <Badge
                              variant={compareLeftSectorId === sector.id ? "secondary" : "outline"}
                            >
                              {compareLeftSectorId === sector.id ? "Lead compare" : compareRole}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Suggested</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Use this as a suggested-sector shortcut when the live tape and your fit
                          table overlap.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelectedSectorId(sector.id)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => loadConversationComparison(sector.id)}
                          >
                            Compare
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleToggleSectorWatchlist(sector.id, "suggested-overlay")}
                          >
                            {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save"}
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sortedSectorGroups.map((sector) => {
              const strongestSubSector =
                [...sector.subSectors].sort((left, right) => right.value - left.value)[0]?.name ??
                "Core names";
              const isSuggested = suggestedSectorIds.has(sector.id);
              const isSelected = selectedSectorId === sector.id;
              const compareRole = getComparisonRoleLabel({
                compareAutoSync,
                leftId: compareLeftSectorId,
                rightId: compareRightSectorId,
                sectorId: sector.id,
              });

              return (
                <div
                  key={sector.id}
                  className={`rounded-md border p-4 ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "bg-background"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {compareRole ? (
                      <Badge variant={compareLeftSectorId === sector.id ? "secondary" : "outline"}>
                        {compareRole}
                      </Badge>
                    ) : null}
                    {isSelected && selectedSectorCompareRole ? (
                      <Badge variant="outline">Active explorer sector</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sector.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Best read: {strongestSubSector}
                      </p>
                    </div>
                    <Badge variant={sector.change >= 0 ? "secondary" : "outline"}>
                      {sector.change >= 0 ? "+" : ""}
                      {sector.change.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isSuggested ? <Badge variant="secondary">Suggested</Badge> : null}
                    {sectorBreadth.strongest === sector.name ? (
                      <Badge variant="outline">Lead strength</Badge>
                    ) : null}
                    {sectorBreadth.weakest === sector.name ? (
                      <Badge variant="outline">Current laggard</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground line-clamp-3">
                    {sector.rationale}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setSelectedSectorId(sector.id)}
                    >
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => loadConversationComparison(sector.id)}
                    >
                      Compare
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => handleToggleSectorWatchlist(sector.id, "overview-grid")}
                    >
                      {visibleSavedSectorIds.includes(sector.id) ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </div>

      <div ref={(node) => {
        marketSectionRefs.current.compare = node;
      }}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Sector comparison strip</CardTitle>
              <CardDescription>
                Put two sectors side by side to compare trend strength, sub-sector leadership,
                and how each one fits your current portfolio.
              </CardDescription>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={compareAutoSync ? "secondary" : "outline"}>
                  {compareAutoSync ? "Following explorer" : "Pinned comparison"}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setCompareAutoSync((current) => !current)}
                >
                  {compareAutoSync ? "Pin this comparison" : "Follow selected sector"}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="w-full md:w-56">
                <SelectField
                  label="Left sector"
                  value={compareLeftSectorId ?? ""}
                  options={sectorOnlySelectorOptions}
                  onChange={(value) => handleManualCompareSelection("left", value)}
                />
              </div>
              <div className="w-full md:w-56">
                <SelectField
                  label="Right sector"
                  value={compareRightSectorId ?? ""}
                  options={sectorOnlySelectorOptions}
                  onChange={(value) => handleManualCompareSelection("right", value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pick two lanes
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Start with the selected sector and one useful contrast lane.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The best comparison is usually leader vs best fit, or best fit vs caution lane.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Read the difference
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Separate tape strength from portfolio usefulness.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                One sector can be stronger today while another still has the more relevant fit gap for your plan.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Decide one next move
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Review one sector, save one lane, or just learn and leave it there.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The compare strip is here to improve judgment, not to force an allocation change.
              </p>
            </div>
          </div>
          {quickCompare ? (
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {selectedSectorId === "all-suggested" ? "Suggested default" : "Current selection"}
                </Badge>
                <Badge variant="outline">{quickCompare.strongerSector.name} leads on tape</Badge>
                <Badge variant="outline">
                  {quickCompare.biggerGapSector} has the bigger fit gap
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{quickCompare.headline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {quickCompare.detail}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  {
                    fit: quickCompare.primaryFit,
                    label: selectedSectorId === "all-suggested" ? "Start here" : "Selected sector",
                    sector: quickCompare.primarySector,
                  },
                  {
                    fit: quickCompare.secondaryFit,
                    label: "Suggested comparison",
                    sector: quickCompare.secondarySector,
                  },
                ].map(({ fit, label, sector }) => (
                  <div key={`quick-compare-${sector.id}`} className="rounded-md border bg-background p-4">
                    {(() => {
                      const priorityLabel = getSectorPriorityLabel({
                        fitStatus: fit?.status ?? null,
                        isLeader: sectorBreadth.strongest === sector.name,
                        isSuggested: suggestedSectorIds.has(sector.id),
                      });

                      return (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getSectorPriorityBadgeClass(priorityLabel)}
                          >
                            {priorityLabel}
                          </Badge>
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-1 font-medium">{sector.name}</p>
                      </div>
                      <Badge variant={sector.change >= 0 ? "secondary" : "outline"}>
                        {sector.change >= 0 ? "+" : ""}
                        {sector.change.toFixed(2)}%
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {fit
                        ? `Current ${fit.currentShare.toFixed(1)}% vs suggested ${fit.suggestedShare.toFixed(1)}%`
                        : "Use this one as market context even if it is not part of the suggested fit table."}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setCompareAutoSync(false);
                    setCompareLeftSectorId(quickCompare.primarySector.id);
                    setCompareRightSectorId(quickCompare.secondarySector.id);
                  }}
                >
                  Load into comparison strip
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    focusSectorFromSuggestion(quickCompare.primarySector.id, "compare")
                  }
                >
                  Open {quickCompare.primarySector.name}
                </Button>
                <AskMentorLink
                  label="Ask AI mentor to compare these sectors"
                  mentorPrompt={`Compare ${quickCompare.primarySector.name} and ${quickCompare.secondarySector.name} for me. Tell me which one is stronger right now, which one fits my portfolio gap better, and what I should do next without overreacting.`}
                  mentorQuestionId="allocation"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Market quick compare"
                  contextLabel="Compare the current market pair"
                  contextNote="Use the quick comparison strip from the market page."
                  returnState={{ view: "market", target: quickCompare.primarySector.id }}
                />
              </div>
            </div>
          ) : null}
          {compareSummary ? (
            <>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{compareSummary.stronger.name} leads</Badge>
                  <Badge variant="outline">{compareSummary.moveGap.toFixed(2)} pts gap</Badge>
                  <Badge variant="outline">{compareSummary.fitLead} has the bigger fit gap</Badge>
                  <Badge
                    variant="outline"
                    className={
                      compareSummary.takeawayTone === "fit-over-momentum"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    }
                  >
                    {compareSummary.takeawayTone === "fit-over-momentum"
                      ? "Fit over tape"
                      : "Tape and fit align"}
                  </Badge>
                </div>
                <div className="mt-3 rounded-md border bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Compare takeaway
                      </p>
                      <p className="mt-1 text-sm font-medium">{compareSummary.takeaway}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          focusSectorFromSuggestion(compareSummary.studySector.id, "compare")
                        }
                      >
                        Open study sector
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          handleToggleSectorWatchlist(compareSummary.studySector.id, "compare")
                        }
                      >
                        {visibleSavedSectorIds.includes(compareSummary.studySector.id)
                          ? "Remove saved sector"
                          : "Save study sector"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Live leader
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.stronger.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compareSummary.moveGap.toFixed(2)} pts stronger on the day
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bigger fit gap
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.fitLead}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      More useful for spotting what your portfolio may still be missing
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Start with
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.studySector.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compareSummary.studyVerdict}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Watch closely
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.trackSector.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compareSummary.trackVerdict}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium">
                  {compareSummary.stronger.name} is the stronger live read right now, while{" "}
                  {compareSummary.softer.name} gives you the contrast case.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use this strip to separate market leadership from personal relevance. A sector can
                  be strong on tape but still be less useful for your current portfolio than a
                  slightly softer sector with a clearer fit gap.
                </p>
                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Study first
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.studySector.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {compareSummary.studyVerdict}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Track actively
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.trackSector.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {compareSummary.trackVerdict}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Do not chase
                    </p>
                    <p className="mt-2 text-sm font-medium">{compareSummary.stronger.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {compareSummary.restraintVerdict}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {[
                  { fit: compareLeftFit, sector: compareLeftSector },
                  { fit: compareRightFit, sector: compareRightSector },
                ].map(({ fit, sector }) => {
                  const bestPocket =
                    [...sector.subSectors].sort((left, right) => right.value - left.value)[0] ??
                    null;
                  const weakestPocket =
                    [...sector.subSectors].sort((left, right) => left.value - right.value)[0] ??
                    null;
                  const priorityLabel = getSectorPriorityLabel({
                    fitStatus: fit?.status ?? null,
                    isLeader: sectorBreadth.strongest === sector.name,
                    isSuggested: suggestedSectorIds.has(sector.id),
                  });
                  const priorityReason = getSectorPriorityReason({
                    fitStatus: fit?.status ?? null,
                    isLeader: sectorBreadth.strongest === sector.name,
                    isSuggested: suggestedSectorIds.has(sector.id),
                    sectorName: sector.name,
                  });

                  return (
                    <div key={`compare-${sector.id}`} className="rounded-md border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{sector.name}</p>
                            <Badge
                              variant="outline"
                              className={getSectorPriorityBadgeClass(priorityLabel)}
                            >
                              {priorityLabel}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Trend today {sector.change >= 0 ? "+" : ""}
                            {sector.change.toFixed(2)}%
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {compareSummary.stronger.id === sector.id
                              ? "This side is winning on live momentum."
                              : compareSummary.fitLead === sector.name
                                ? "This side carries the bigger portfolio-fit gap."
                                : "Use this side as the contrast lane in the decision."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {suggestedSectorIds.has(sector.id) ? (
                            <Badge variant="secondary">Suggested</Badge>
                          ) : (
                            <Badge variant="outline">Market only</Badge>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => focusSectorFromSuggestion(sector.id, "compare")}
                          >
                            Open sector
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Why this priority
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {priorityReason}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Best pocket
                          </p>
                          <p className="mt-2 font-medium">{bestPocket?.name ?? "Core names"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {bestPocket ? `${bestPocket.value >= 0 ? "+" : ""}${bestPocket.value.toFixed(2)}%` : "No pulse yet"}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Weakest pocket
                          </p>
                          <p className="mt-2 font-medium">{weakestPocket?.name ?? "Core names"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {weakestPocket ? `${weakestPocket.value >= 0 ? "+" : ""}${weakestPocket.value.toFixed(2)}%` : "No pulse yet"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Comparison role
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {compareSummary.studySector.id === sector.id
                              ? "Study first"
                              : compareSummary.trackSector.id === sector.id
                                ? "Track actively"
                                : "Contrast lane"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {compareSummary.studySector.id === sector.id
                              ? "This is the better place to start learning before making a move."
                              : compareSummary.trackSector.id === sector.id
                                ? "Keep this sector visible in your compare strip and watchlist."
                                : "Useful for judging whether strength is real or just more obvious."}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            What stands out
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {compareSummary.stronger.id === sector.id
                              ? "Momentum advantage"
                              : compareSummary.fitLead === sector.name
                                ? "Fit-gap advantage"
                                : "Reference case"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {compareSummary.stronger.id === sector.id
                              ? "Live tape is stronger here, but that still needs context before action."
                              : compareSummary.fitLead === sector.name
                                ? "This one better exposes where your current allocation may be thin."
                                : "Use this side to pressure-test the stronger headline move."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Portfolio fit
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {fit
                            ? `Current ${fit.currentShare.toFixed(1)}% vs suggested ${fit.suggestedShare.toFixed(1)}%`
                            : "This sector is not one of the current suggested sectors."}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {fit?.note ??
                            "Use this as a market-context comparison even if it is not one of the top suggested sectors right now."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <AskMentorLink
                label="Ask AI mentor to compare these sectors"
                mentorPrompt={
                  compareLeftSector && compareRightSector
                    ? `Compare ${compareLeftSector.name} and ${compareRightSector.name} for me using the market page. Which one is stronger right now, which one fits my portfolio gap better, and what should I learn from the difference?`
                    : "Help me compare two sectors from the market page."
                }
                mentorQuestionId="allocation"
                onOpenMentor={onOpenMentor}
                sourceLabel="Market sector comparison"
                contextLabel="Compare two market sectors"
                contextNote="Use the sector comparison strip to contrast live strength, sub-sector leadership, and current portfolio fit."
                returnState={{ view: "market", target: selectedSectorId }}
              />
            </>
          ) : (
            <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
              Sector comparison will appear once sector data is available.
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div ref={(node) => {
          marketSectionRefs.current.trends = node;
        }}>
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <CardTitle>Sector trends explorer</CardTitle>
                <CardDescription>
                  {selectedSectorId === "all-suggested"
                    ? "See the combined market trend for the sectors currently most worth understanding."
                    : "Select a sector to read its recent trend and the sub-sectors carrying it."}
                </CardDescription>
              </div>
              <div className="w-full md:w-60">
                <SelectField
                  label="Sector"
                  value={selectedSectorId}
                  options={sectorSelectorOptions}
                  onChange={setSelectedSectorId}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedSectorId === "all-suggested"
                      ? `${suggestedSectorSnapshot.sectors.length} suggested`
                      : selectedSectorGroup?.name ?? "Sector"}
                  </Badge>
                  <Badge variant="outline">
                    {selectedSectorId === "all-suggested"
                      ? "overview"
                      : `${selectedSectorGroup?.change.toFixed(2) ?? "0.00"}%`}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                  {([
                    ["1d", "1D"],
                    ["1w", "1W"],
                    ["1m", "1M"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        trendWindow === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => setTrendWindow(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Window read
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {trendExplorerSummary.delta >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    )}
                    <p className="text-sm font-medium">
                      {trendExplorerSummary.windowLabel}: {trendExplorerSummary.directionLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trendExplorerSummary.directionDetail}
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Strongest signal
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                    <p className="text-sm font-medium">{trendExplorerSummary.strongestPocket}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This is the first pocket to read when you want to know what is actually
                    carrying the move instead of just reacting to the headline sector label.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best use of this chart
                  </p>
                  <p className="mt-2 text-sm font-medium">{trendExplorerSummary.actionTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trendExplorerSummary.actionDetail}
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleTrendSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                    />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-chart-2)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 rounded-md border bg-background px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Chart reading note
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the {trendExplorerSummary.windowLabel.toLowerCase()} to judge pace, then use
                  the comparison strip and sub-sector drilldown to decide whether the move deserves
                  attention, study, or restraint.
                </p>
              </div>
            </div>
            <div
              aria-live="polite"
              className={`rounded-md border border-dashed px-3 py-2 text-xs ${marketActionBannerClassName}`}
            >
              {marketActionFeedback.message}
            </div>
            {selectedSectorId === "all-suggested" ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Today&apos;s market read
                    </p>
                    <p className="mt-2 text-sm font-medium">{marketData.sentiment}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sectorBreadth.advancing} sectors are up and {sectorBreadth.declining} are down.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {marketData.sentiment === "Constructive"
                        ? "Breadth is supportive, so use this as a good day to learn leadership without confusing it for a buy signal."
                        : marketData.sentiment === "Cautious"
                          ? "Tone is softer, so read the suggested sectors as study lanes and keep reactions slow."
                          : "The tape is mixed, which makes comparison and context more useful than quick conviction."}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Best place to start
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {topSuggestedSector?.name ?? "Suggested sectors overview"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {topSuggestedSector
                        ? `Strongest pocket: ${topSuggestedSector.strongestSubSector}`
                        : "Review a sector below to see its leading pocket."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {topSuggestedSector
                        ? `${topSuggestedSector.name} is the clearest first read because it currently combines useful relevance with a stronger market signal.`
                        : "The overview combines the suggested sectors so you can decide where to open first."}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      What to do next
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {marketRegime.watchlist
                        ? `Watch ${marketRegime.watchlist} without chasing it`
                        : "Compare the leader with your current fit"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {marketRegime.strongest
                        ? `${marketRegime.strongest} is leading the tape right now.`
                        : "Sector leadership will surface here once the snapshot settles."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Review one suggested sector first, then use the comparison strip to separate what is strong on tape from what is actually useful for your portfolio.
                    </p>
                  </div>
                </div>
                <div className="rounded-md border bg-background p-4">
                  <p className="text-sm font-medium">{suggestedSectorSnapshot.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {suggestedSectorSnapshot.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedSectorSnapshot.sectors.map((idea) => (
                      <Button
                        key={`ingested-${idea.id}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => focusSectorFromSuggestion(idea.id)}
                      >
                        {idea.name}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <AskMentorLink
                      label="Ask AI mentor about suggested sectors"
                      mentorPrompt={
                        suggestedSectorSnapshot.topSuggestions[0]
                          ? `Why is ${suggestedSectorSnapshot.topSuggestions[0].name} being suggested for me ahead of other sectors, and how should I compare it with my current holdings?`
                          : "Help me understand how to use the suggested sector view on the market page."
                      }
                      mentorQuestionId="allocation"
                      onOpenMentor={onOpenMentor}
                      sourceLabel="Market suggested sectors"
                      contextLabel="Understand the suggested sector lens"
                      contextNote="Use the suggested sectors view as a filtered read of the same live market sector set."
                      returnState={{ view: "market", target: "all-suggested" }}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {suggestedSectorSnapshot.topSuggestions.map((idea) => (
                    <div
                      key={idea.id}
                      className="rounded-md border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{idea.name}</p>
                            {(() => {
                              const priorityLabel = getSectorPriorityLabel({
                                fitStatus:
                                  suggestedSectorFit.rows.find((row) => row.id === idea.id)?.status ??
                                  null,
                                isLeader: sectorBreadth.strongest === idea.name,
                                isSuggested: true,
                              });

                              return (
                                <Badge
                                  variant="outline"
                                  className={getSectorPriorityBadgeClass(priorityLabel)}
                                >
                                  {priorityLabel}
                                </Badge>
                              );
                            })()}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Strongest pocket: {idea.strongestSubSector}
                          </p>
                        </div>
                        <Badge variant={idea.change >= 0 ? "secondary" : "outline"}>
                          {idea.change >= 0 ? "+" : ""}
                          {idea.change.toFixed(2)}%
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {idea.topIdea}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => focusSectorFromSuggestion(idea.id)}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => loadConversationComparison(idea.id)}
                        >
                          Compare
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleToggleSectorWatchlist(idea.id, "suggested-trend")}
                        >
                          {visibleSavedSectorIds.includes(idea.id) ? "Saved" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedSectorGroup ? (
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{selectedSectorGroup.name} decision workspace</p>
                      {selectedSuggestedSector ? (
                        <Badge variant="secondary">Suggested focus</Badge>
                      ) : null}
                      {selectedSectorPriority ? (
                        <Badge
                          variant="outline"
                          className={getSectorPriorityBadgeClass(selectedSectorPriority)}
                        >
                          {selectedSectorPriority}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Market strength
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSectorGroup.change >= 0 ? "+" : ""}
                        {selectedSectorGroup.change.toFixed(2)}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sectorBreadth.strongest === selectedSectorGroup.name
                          ? "Current market leader"
                          : sectorBreadth.weakest === selectedSectorGroup.name
                            ? "Current laggard"
                            : "Part of the live market tape"}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Portfolio fit
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSectorFit
                          ? `${selectedSectorFit.currentShare.toFixed(1)}% now vs ${selectedSectorFit.suggestedShare.toFixed(1)}% suggested`
                          : "Context-only sector"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSectorFit
                          ? selectedSectorFit.note
                          : "Useful for market context even if it is outside the suggested-fit table."}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Comparison role
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSectorCompareRole ?? "Not in compare strip"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSectorCompareRole
                          ? compareAutoSync
                            ? "The compare strip is currently following this sector."
                            : "This sector is currently part of the pinned comparison."
                          : "Review it or pin it into the compare strip if you want a direct side-by-side read."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Why this matters now
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {sectorBreadth.strongest === selectedSectorGroup.name
                          ? "Leadership is live"
                          : selectedSectorFit?.status === "missing" ||
                              selectedSectorFit?.status === "underweight"
                            ? "Fit gap is visible"
                            : "Useful as context"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sectorBreadth.strongest === selectedSectorGroup.name
                          ? "Study the structure before mistaking market strength for an automatic buy signal."
                          : selectedSectorFit?.status === "missing" ||
                              selectedSectorFit?.status === "underweight"
                            ? "The sector is relevant because your portfolio may be lighter here than your suggested posture."
                            : "Keep it in view to compare against stronger and weaker lanes before acting."}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Strongest pocket
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSubSectorDrilldown[0]?.name ?? "Core read"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSubSectorDrilldown[0]?.guidance ??
                          "This is the first pocket to read when you want to know what is carrying the move."}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Best use today
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSectorPriority === "Track actively"
                          ? "Track actively"
                          : selectedSectorPriority === "Study first"
                            ? "Study before acting"
                            : selectedSectorPriority === "Hold, do not chase"
                              ? "Do not chase"
                              : "Use as context"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSectorPriority === "Track actively"
                          ? "Keep this sector in your compare strip and watchlist so you can follow it with intention."
                          : selectedSectorPriority === "Study first"
                            ? "Learn the structure and sub-sector breadth first, then decide whether it deserves a place in your plan."
                            : selectedSectorPriority === "Hold, do not chase"
                              ? "Read it, compare it, and resist turning short-term tape into a rushed allocation."
                              : "Let this sector sharpen your market understanding even if it does not demand a move today."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Suggested next move
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Review it in compare, save it to your watchlist, or pull AI Mentor in when
                          you want help separating signal from noise.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setCompareAutoSync(false);
                            setCompareLeftSectorId(selectedSectorGroup.id);
                            setCompareRightSectorId(
                              quickCompare?.secondarySector.id === selectedSectorGroup.id
                                ? quickCompare.primarySector.id
                                : quickCompare?.secondarySector.id ??
                                    topSuggestedSectorGroup?.id ??
                                    selectedSectorGroup.id,
                            );
                          }}
                        >
                          Compare now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() =>
                            handleToggleSectorWatchlist(selectedSectorGroup.id, "explorer")
                          }
                        >
                          {visibleSavedSectorIds.includes(selectedSectorGroup.id)
                            ? "Remove watchlist"
                            : "Save to watchlist"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <AskMentorLink
                        label={`Ask AI mentor about ${selectedSectorGroup.name}`}
                        mentorPrompt={`Why is ${selectedSectorGroup.name} relevant for me right now, and how should I read its ${selectedSectorGroup.subSectors[0]?.name ?? "sub-sector"} strength without overreacting?`}
                        mentorQuestionId={marketMentorQuestionId}
                        onOpenMentor={onOpenMentor}
                        sourceLabel="Market sector explorer"
                        contextLabel={`Review ${selectedSectorGroup.name} from the market explorer`}
                        contextNote={`Carry the ${selectedSectorGroup.name} trend, sub-sector pulse, and suggested-sector context into the conversation.`}
                        returnState={{ view: "market", target: selectedSectorGroup.id }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Why now
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {sectorBreadth.strongest === selectedSectorGroup.name
                        ? `${selectedSectorGroup.name} deserves study now because it is leading the live tape.`
                        : selectedSectorFit?.status === "missing" || selectedSectorFit?.status === "underweight"
                          ? `${selectedSectorGroup.name} matters now because it highlights a portfolio fit gap.`
                          : `${selectedSectorGroup.name} is more useful as a watchlist and context lane than an urgent allocation move.`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sectorBreadth.strongest === selectedSectorGroup.name
                        ? "Use the strength as a reason to learn the sector structure first, not as a cue to chase performance."
                        : selectedSectorFit?.status === "missing" || selectedSectorFit?.status === "underweight"
                          ? "The live market is helping you notice where your current exposure may be thin, but that still calls for understanding before action."
                          : "Keep this sector in view so you can compare it with stronger leaders and see whether it becomes more relevant later."}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {selectedSectorGroup.rationale}
                  </p>
                  <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm leading-6">
                    {selectedSectorGroup.topIdea}
                  </div>
                </div>
                <div className="rounded-md border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Sub-sector drilldown</p>
                    <Badge variant="outline">
                      {selectedSubSectorDrilldown[0]?.name ?? "Core read"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Read this first
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSubSectorDrilldown[0]?.name ?? "Core read"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSubSectorDrilldown[0]?.signal ??
                          "Start with the leading pocket to see what is actually carrying the sector."}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Breadth check
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {selectedSubSectorDrilldown.filter((row) => row.tone === "leader").length} leading /{" "}
                        {selectedSubSectorDrilldown.filter((row) => row.tone === "soft").length} soft
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        More leading pockets usually means the move is broadening. More soft pockets
                        means strength may still be narrow.
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Read order
                      </p>
                      <p className="mt-2 text-sm font-medium">Leader → mixed → soft</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        That order helps you tell whether this is a durable sector move or a thin
                        burst carried by only a few names.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {selectedSubSectorDrilldown.map((subSector) => (
                      <div
                        key={`${selectedSectorGroup.id}-${subSector.name}`}
                        className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[auto_1fr_auto]"
                      >
                        <div className="rounded-md border bg-background px-3 py-2 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Rank
                          </p>
                          <p className="mt-1 font-semibold">{subSector.rank}</p>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{subSector.name}</p>
                            <Badge
                              variant={
                                subSector.tone === "leader"
                                  ? "secondary"
                                  : subSector.tone === "soft"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {subSector.tone === "leader"
                                ? "Leading pocket"
                                : subSector.tone === "soft"
                                  ? "Soft pocket"
                                  : "Mixed pocket"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{subSector.signal}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {subSector.guidance}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Move
                          </p>
                          <p className="mt-1 font-semibold">
                            {subSector.move >= 0 ? "+" : ""}
                            {subSector.move.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                    Read the leading pocket first, then compare it with the mixed and softer pockets.
                    That tells you whether the sector move is broadening or being carried by a narrow
                    set of names.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                Sector breadth will appear here once the market snapshot loads.
              </div>
          )}
        </CardContent>
      </Card>
        </div>

        <Card>
            <CardHeader>
              <CardTitle>Beginner sentiment</CardTitle>
              <CardDescription>
                A simple interpretation layer so the market tone feels usable instead of abstract.
              </CardDescription>
            </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Market mood</span>
                <span>{marketData.sentimentScore}/100</span>
              </div>
              <Progress value={marketData.sentimentScore} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Strongest sector</p>
                <p className="mt-2 font-semibold">{sectorBreadth.strongest ?? "N/A"}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Weakest sector</p>
                <p className="mt-2 font-semibold">{sectorBreadth.weakest ?? "N/A"}</p>
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
              {marketData.sentiment === "Constructive"
                ? "Markets look broadly positive, but this is not a signal to abandon your plan. Continue goal-based investing."
                : marketData.sentiment === "Cautious"
                  ? "Markets look soft. Beginners should avoid panic selling and revisit asset allocation before acting."
                  : "Markets look mixed. This is a good day to learn, rebalance only if your plan already says so, and avoid impulse trades."}
            </div>
            <p className="text-xs text-muted-foreground">
              Updated {new Date(marketData.updatedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Market actions</CardTitle>
            <CardDescription>
              Three concrete moves from this screen: what to study, what to watch, and what not to
              overreact to.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {marketActionItems.map((item) => (
              <div
                key={item.title}
                className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <Badge
                      variant={
                        item.emphasis === "high"
                          ? "secondary"
                          : item.emphasis === "medium"
                            ? "outline"
                            : "outline"
                      }
                    >
                      {item.cta}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Next move
                    </p>
                    <p className="mt-1 text-sm text-foreground">{item.nextStep}</p>
                  </div>
                </div>
                <div className="flex items-start md:justify-end">
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        if (item.sectorId) {
                          focusSectorFromSuggestion(item.sectorId);
                        }
                      }}
                      disabled={!item.sectorId}
                    >
                      {item.title === "Do nothing impulsive" ? "Re-center" : "Open"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        openWatchlistLane(
                          item.title === "Study next"
                            ? "study-now"
                            : item.title === "Watch, don’t chase"
                              ? "watch"
                              : "reviewed",
                        )
                      }
                    >
                      {item.title === "Study next"
                        ? "Review study lane"
                        : item.title === "Watch, don’t chase"
                          ? "Review watch lane"
                          : "Review saved lane"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <AskMentorLink
              label="Ask AI mentor what I should do with this market"
              mentorPrompt={`From the market page, turn the current regime into clear next steps for me. Tell me what to study next, what to keep on watch, and what I should avoid doing impulsively with my portfolio right now.`}
              mentorQuestionId="allocation"
              onOpenMentor={onOpenMentor}
              sourceLabel="Market action panel"
              contextLabel="Turn the market read into next steps"
              contextNote="Use the market actions panel to convert the current regime into practical, non-impulsive next moves."
              returnState={{ view: "market", target: selectedSectorId }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved market watchlist</CardTitle>
            <CardDescription>
              Keep sectors you want to revisit without turning every strong move into a trade.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {savedSectorGroups.length && savedWatchlistSummary ? (
              <>
                <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <p className="text-sm font-medium text-foreground">This is your steady study queue</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      The watchlist is for revisiting sectors with intention. It should help you keep learning threads alive across sessions, not turn every strong move into something you feel forced to act on.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Review pressure</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {savedWatchlistStatusCounts.newCount + savedWatchlistStatusCounts.overdueCount} due now
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        New and overdue lanes deserve a fresh look before they quietly go stale.
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Suggested overlap</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {savedWatchlistSummary.aligned.length} aligned with suggested
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        These are the saved sectors the current suggested lens is still reinforcing right now.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium">Review queue</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        This ranks saved sectors by what deserves focused learning now versus what
                        can stay in lighter rotation.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {
                          savedWatchlistQueue.filter((item) => item.bucket === "study-now").length
                        }{" "}
                        study now
                      </Badge>
                      <Badge variant="outline">
                        {
                          savedWatchlistQueue.filter((item) => item.bucket === "keep-watching").length
                        }{" "}
                        keep watching
                      </Badge>
                      <Badge variant="outline">
                        {
                          savedWatchlistQueue.filter((item) => item.bucket === "background-only").length
                        }{" "}
                        background only
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {([
                      {
                        count: savedWatchlistQueueWithStatus.length,
                        label: "all",
                        value: "all",
                      },
                      {
                        count:
                          savedWatchlistStatusCounts.newCount +
                          savedWatchlistStatusCounts.overdueCount,
                        label: "review now",
                        value: "review-now",
                      },
                      {
                        count: savedWatchlistStatusCounts.suggestedCount,
                        label: "suggested",
                        value: "suggested",
                      },
                    ] as const).map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          watchlistFilter === chip.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                        onClick={() => setWatchlistFilter(chip.value)}
                      >
                        {chip.count} {chip.label}
                      </button>
                    ))}
                    {watchlistFilter !== "all" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => setWatchlistFilter("all")}
                      >
                        Back to all
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {filteredSavedWatchlistQueue.length ? (
                      filteredSavedWatchlistQueue.map((item) => (
                        <div
                          key={`queue-${item.sector.id}`}
                          className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[auto_1fr_auto]"
                        >
                          <div className="flex items-start">
                            <Badge
                              variant={
                                item.bucket === "study-now"
                                  ? "secondary"
                                  : item.bucket === "keep-watching"
                                    ? "outline"
                                    : "outline"
                              }
                            >
                              {item.bucketLabel}
                            </Badge>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.sector.name}</p>
                              {(() => {
                                const priorityLabel = getSectorPriorityLabel({
                                  fitStatus:
                                    suggestedSectorFit.rows.find(
                                      (row) => row.id === item.sector.id,
                                    )?.status ?? null,
                                  isLeader: sectorBreadth.strongest === item.sector.name,
                                  isSuggested: suggestedSectorIds.has(item.sector.id),
                                });

                                return (
                                  <Badge
                                    variant="outline"
                                    className={getSectorPriorityBadgeClass(priorityLabel)}
                                  >
                                    {priorityLabel}
                                  </Badge>
                                );
                              })()}
                              {suggestedSectorIds.has(item.sector.id) ? (
                                <Badge variant="secondary">Suggested</Badge>
                              ) : null}
                              <Badge
                                variant={
                                  item.reviewStatus === "new"
                                    ? "secondary"
                                    : item.reviewStatus === "overdue"
                                      ? "outline"
                                      : "outline"
                                }
                              >
                                {item.reviewStatusLabel}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Strongest pocket: {item.bestPocket}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {item.detail}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.reviewedAt
                                ? `Last reviewed ${new Date(item.reviewedAt).toLocaleString()}`
                                : "Not reviewed yet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start justify-end gap-2">
                            <Badge variant={item.sector.change >= 0 ? "secondary" : "outline"}>
                              {item.sector.change >= 0 ? "+" : ""}
                              {item.sector.change.toFixed(2)}%
                            </Badge>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                handleMarkSectorReviewed(item.sector.id);
                                focusSectorFromSuggestion(item.sector.id, "review-queue");
                              }}
                            >
                              Review sector
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                        {watchlistFilter === "review-now"
                          ? "Nothing is due for review right now."
                          : watchlistFilter === "suggested"
                            ? "No saved sectors are currently aligned with the suggested view."
                            : "No saved sectors match this filter yet."}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Aligned with suggestions
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {savedWatchlistSummary.aligned.length} of {savedSectorGroups.length} saved sectors
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      These are the saved sectors that the live suggested view is still reinforcing
                      right now.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {savedWatchlistSummary.aligned.length ? (
                        savedWatchlistSummary.aligned.map((sector) => (
                          <Badge key={`aligned-${sector.id}`} variant="secondary">
                            {sector.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">None currently aligned</Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Watch-only saves
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {savedWatchlistSummary.watchOnly.length} still worth observing
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      These are on your list for context, but they are not in the current suggested
                      overlay.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {savedWatchlistSummary.watchOnly.length ? (
                        savedWatchlistSummary.watchOnly.map((sector) => (
                          <Badge key={`watch-only-${sector.id}`} variant="outline">
                            {sector.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">All saved sectors are aligned</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Strongest saved sector
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {savedWatchlistSummary.strongest?.name ?? "No saved sectors"}
                      </p>
                      {savedWatchlistSummary.strongest ? (
                        <Badge variant="secondary">
                          {savedWatchlistSummary.strongest.change >= 0 ? "+" : ""}
                          {savedWatchlistSummary.strongest.change.toFixed(2)}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Softest saved sector
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {savedWatchlistSummary.weakest?.name ?? "No saved sectors"}
                      </p>
                      {savedWatchlistSummary.weakest ? (
                        <Badge variant="outline">
                          {savedWatchlistSummary.weakest.change >= 0 ? "+" : ""}
                          {savedWatchlistSummary.weakest.change.toFixed(2)}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4">
                  {groupedSavedWatchlistSections.map((section) => (
                    <div
                      key={section.key}
                      ref={(node) => {
                        watchlistLaneRefs.current[section.key] = node;
                      }}
                      className="rounded-md border bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{section.label}</p>
                            <Badge variant="outline">{section.rows.length}</Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {section.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {section.rows.length ? (
                          section.rows.map((item) => {
                            const sector = item.sector;
                            const savedSectorFitStatus =
                              suggestedSectorFit.rows.find((row) => row.id === sector.id)?.status ??
                              null;
                            const priorityLabel = getSectorPriorityLabel({
                              fitStatus: savedSectorFitStatus,
                              isLeader: sectorBreadth.strongest === sector.name,
                              isSuggested: suggestedSectorIds.has(sector.id),
                            });

                            return (
                              <div
                                key={`watch-${section.key}-${sector.id}`}
                                className="rounded-md border bg-background p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{sector.name}</p>
                                      <Badge
                                        variant="outline"
                                        className={getSectorPriorityBadgeClass(priorityLabel)}
                                      >
                                        {priorityLabel}
                                      </Badge>
                                      {suggestedSectorIds.has(sector.id) ? (
                                        <Badge variant="secondary">Suggested</Badge>
                                      ) : null}
                                      <Badge
                                        variant={
                                          item.reviewStatus === "new"
                                            ? "secondary"
                                            : item.reviewStatus === "overdue"
                                              ? "outline"
                                              : "outline"
                                        }
                                      >
                                        {item.reviewStatusLabel}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Strongest pocket: {item.bestPocket}
                                    </p>
                                  </div>
                                  <Badge variant={sector.change >= 0 ? "secondary" : "outline"}>
                                    {sector.change >= 0 ? "+" : ""}
                                    {sector.change.toFixed(2)}%
                                  </Badge>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                  {item.detail}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {item.reviewedAt
                                    ? `Last reviewed ${new Date(item.reviewedAt).toLocaleString()}`
                                    : "Not reviewed yet"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => focusSectorFromSuggestion(sector.id, "watchlist")}
                                  >
                                    Open sector
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => handleMarkSectorReviewed(sector.id)}
                                  >
                                    Mark reviewed
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => handleToggleSectorWatchlist(sector.id, "watchlist")}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                            {section.empty}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <AskMentorLink
                  label="Ask AI mentor about my watchlist"
                  mentorPrompt={`Review my saved sector watchlist from the market page and tell me what deserves learning focus, what is just worth tracking, and what should not push me into impulsive action.`}
                  mentorQuestionId="allocation"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Market watchlist"
                  contextLabel="Review saved market watchlist"
                  contextNote="Use the user’s saved market sectors as a steady study list, not a trade trigger."
                  returnState={{ view: "market", target: selectedSectorId }}
                />
              </>
            ) : (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                Save sectors from the explorer to build a market watchlist you can come back to.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current vs suggested sector fit</CardTitle>
            <CardDescription>
              Compare what the live market says is worth studying with what your tracked
              portfolio is already carrying.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-medium text-foreground">This is the portfolio relevance layer</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use this after the market read, not before it. The goal is to see where the live market is reinforcing your current mix, exposing a gap, or simply adding context to what you already hold.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Coverage read</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {suggestedSectorFit.coverageShare.toFixed(1)}% already represented
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This tells you how much of the suggested lens your tracked portfolio already covers today.
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Gap pressure</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {suggestedSectorFit.rows.filter((row) => row.status === "missing").length} missing lanes
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Missing or underweight lanes are a cue for learning and planning first, not for impulsive filling.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {suggestedSectorFit.coverageShare.toFixed(1)}% already represented
                </Badge>
                <Badge variant="outline">
                  {suggestedSectorFit.rows.filter((row) => row.status === "missing").length} missing
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{suggestedSectorFit.headline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The point is not to mirror the suggested sectors one-for-one. It is to spot where
                the live market lens is reinforcing your current mix, where it is exposing a gap,
                and where you may already have enough concentration.
              </p>
            </div>
            <div className="grid gap-3">
              {suggestedSectorFit.rows.map((row) => {
                const laneLabel =
                  row.status === "missing" || row.status === "underweight"
                    ? "Study now"
                    : row.status === "ahead"
                      ? "Hold, do not chase"
                      : "Keep watching";
                const deltaLabel =
                  row.gapToSuggested === 0
                    ? "On target"
                    : `${row.gapToSuggested > 0 ? "+" : ""}${row.gapToSuggested.toFixed(1)} pts`;

                return (
                  <button
                    key={`fit-${row.id}`}
                    type="button"
                    className="rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                    onClick={() => focusSectorFromSuggestion(row.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{row.name}</p>
                          <Badge variant="outline" className="border-primary/30 bg-primary/5">
                            {laneLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Current {row.currentShare.toFixed(1)}% vs suggested {row.suggestedShare.toFixed(1)}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          row.status === "aligned"
                            ? "secondary"
                            : row.status === "ahead"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {row.status === "missing"
                          ? "Missing"
                          : row.status === "underweight"
                            ? "Underweight"
                            : row.status === "ahead"
                              ? "Already ahead"
                              : "In range"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-muted/20 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Tracked value
                          </p>
                          <p className="mt-2 font-medium">
                            ₹{Math.round(row.currentValue).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fit delta
                          </p>
                          <p className="mt-2 font-medium">{deltaLabel}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{laneLabel}</p>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{row.note}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <AskMentorLink
              label="Ask AI mentor about my sector gaps"
              mentorPrompt={
                suggestedSectorFit.rows[0]
                  ? `Compare my current portfolio exposure with the suggested sectors on the market page. Start with ${suggestedSectorFit.rows[0].name} and explain whether this is a learning gap, an allocation gap, or just a watchlist theme for me.`
                  : "Help me compare my current holdings with the suggested sectors on the market page."
              }
              mentorQuestionId="allocation"
              onOpenMentor={onOpenMentor}
              sourceLabel="Market current vs suggested fit"
              contextLabel="Review portfolio sector gaps"
              contextNote="Use the market page sector-fit card to explain current exposure versus suggested sectors."
              returnState={{ view: "market", target: selectedSectorId }}
            />
          </CardContent>
        </Card>
      </div>

      <div ref={(node) => {
        marketSectionRefs.current.conversation = node;
      }}>
      <Card>
        <CardHeader>
          <CardTitle>Suggested sectors</CardTitle>
          <CardDescription>
            This is the same live market map, reordered to highlight the sectors that look most relevant for your next learning and allocation review.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-medium text-foreground">Use this as your shortlist, not your conclusion</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The suggested view is a reordered version of the same live sector map. It helps you decide what deserves study, comparison, or simple watchlist space without pretending every strong sector needs action.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Best opening lane</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {topSuggestedSector?.name ?? "Suggested lens"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {topSuggestedSector
                    ? `${topSuggestedSector.name} is the cleanest first read because it currently combines fit relevance with a stronger market signal.`
                    : "Review the top of this list first when you want the fastest useful next read."}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Decision rule</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Review one, compare two, save a few</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Start by opening one sector, load compare only when two both look relevant, and save only the lanes you genuinely want to revisit.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step 1
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Shortlist one or two lanes</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Start with sectors tagged for study or active tracking instead of trying to process the whole list at once.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step 2
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Compare before acting</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Load a sector into compare when two ideas both look good or when the market move feels stronger than your conviction.
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step 3
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Save the lane if it still matters</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use the watchlist for sectors worth revisiting, not for every strong move you notice during one session.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {suggestedSectorSnapshot.sectors.map((idea) => {
              const fitRow = suggestedSectorFit.rows.find((row) => row.id === idea.id) ?? null;
              const priorityLabel = getSectorPriorityLabel({
                fitStatus: fitRow?.status ?? null,
                isLeader: sectorBreadth.strongest === idea.name,
                isSuggested: true,
              });
              const decisionLabel =
                priorityLabel === "Study"
                  ? "Study first"
                  : priorityLabel === "Watch"
                    ? "Track actively"
                    : "Use as context";

              return (
                <button
                  key={idea.id}
                  type="button"
                  className={`rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20 ${
                    selectedSectorId === idea.id ? "border-primary/50 bg-muted/20" : ""
                  }`}
                  onClick={() => focusSectorFromSuggestion(idea.id, "suggested")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{idea.name}</p>
                        <Badge
                          variant="outline"
                          className={getSectorPriorityBadgeClass(priorityLabel)}
                        >
                          {priorityLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Best read: {idea.strongestSubSector}
                      </p>
                    </div>
                    <Badge variant={idea.change >= 0 ? "secondary" : "outline"}>
                      {idea.change >= 0 ? "+" : ""}
                      {idea.change.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Best use
                      </p>
                      <p className="mt-2 text-sm font-medium">{decisionLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fitRow
                          ? `${fitRow.currentShare.toFixed(1)}% now vs ${fitRow.suggestedShare.toFixed(1)}% suggested`
                          : "Use as a market learning lane"}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Why this matters
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {idea.reason}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm leading-6">
                    {idea.topIdea}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Top suggestions inside the suggested sectors</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Treat this as the fast-entry shortlist when you want the clearest next sectors to open, compare, or save.
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {suggestedSectorSnapshot.topSuggestions.map((idea) => {
                const fitRow = suggestedSectorFit.rows.find((row) => row.id === idea.id) ?? null;
                const priorityLabel = getSectorPriorityLabel({
                  fitStatus: fitRow?.status ?? null,
                  isLeader: sectorBreadth.strongest === idea.name,
                  isSuggested: true,
                });
                const shortlistLabel =
                  priorityLabel === "Study"
                    ? "Review this first"
                    : priorityLabel === "Watch"
                      ? "Track this next"
                      : "Keep as context";

                return (
                  <div
                    key={`top-${idea.id}`}
                    className={`rounded-md border bg-background p-3 ${
                      selectedSectorId === idea.id ? "border-primary/50 bg-muted/20" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{idea.name}</p>
                          <Badge
                            variant="outline"
                            className={getSectorPriorityBadgeClass(priorityLabel)}
                          >
                            {priorityLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Strongest pocket: {idea.strongestSubSector}
                        </p>
                      </div>
                      <Badge variant={idea.change >= 0 ? "secondary" : "outline"}>
                        {idea.change >= 0 ? "+" : ""}
                        {idea.change.toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="mt-3 rounded-md border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Shortlist use
                      </p>
                      <p className="mt-2 text-sm font-medium">{shortlistLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fitRow
                          ? `${fitRow.currentShare.toFixed(1)}% now vs ${fitRow.suggestedShare.toFixed(1)}% suggested`
                          : "Use as a quick market-learning lane"}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => focusSectorFromSuggestion(idea.id, "suggested")}
                      >
                        Review sector
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => loadConversationComparison(idea.id)}
                      >
                        Load compare
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleToggleSectorWatchlist(idea.id, "suggested-shortlist")}
                      >
                        {visibleSavedSectorIds.includes(idea.id) ? "Saved" : "Save lane"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <div ref={(node) => {
        marketSectionRefs.current.fit = node;
      }}>
      <Card>
        <CardHeader>
          <CardTitle>Now vs suggested</CardTitle>
          <CardDescription>
            A plain-English conversation between what the market is doing now and what deserves deeper study next, so the user can separate signal from impulse.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-medium text-foreground">This is the interpretation layer</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Use this conversation when the live tape, suggested sectors, and your portfolio fit are all saying slightly different things and you want a calmer read of what actually matters.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">What it should answer</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Study, track, or leave alone</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Each note here should help you separate genuine follow-up from normal market noise.
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Best next move</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {marketConversation[0]?.sectorId ? "Review the first useful lane" : "Use compare or mentor"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Start with the first note that still feels actionable, then either open the lane, load compare, or ask AI Mentor if the takeaway still feels fuzzy.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Read it as
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">A guided market discussion</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Use it for
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Understanding whether to study, track, or simply note a move.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best next action
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Review the lane, load compare, or ask the mentor when the takeaway still feels fuzzy.
                </p>
              </div>
            </div>
          </div>
          {marketConversation.map((turn) => (
            <div
              key={turn.title}
              className={`rounded-md border p-4 ${
                turn.speaker === "now"
                  ? "mr-8 bg-background"
                  : turn.speaker === "suggested"
                    ? "ml-8 bg-muted/20"
                    : "bg-muted/30"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    turn.speaker === "mentor"
                      ? "secondary"
                      : turn.speaker === "suggested"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {turn.title}
                </Badge>
                <Badge
                  variant={
                    turn.emphasis === "high"
                      ? "default"
                      : turn.emphasis === "medium"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {turn.emphasis === "high"
                    ? "Actively review"
                    : turn.emphasis === "medium"
                      ? "Keep an eye"
                      : "Use as context"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">{turn.body}</p>
              <div className="mt-3 rounded-md border bg-background/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Takeaway
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {turn.emphasis === "high"
                    ? "This deserves an active read before you ignore or chase it."
                    : turn.emphasis === "medium"
                      ? "Keep this in view and use it to improve your comparison, not your impulse."
                      : "Treat this as background context that sharpens your next decision."}
                </p>
              </div>
              <div className="mt-3 rounded-md border bg-background/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Next move
                </p>
                <p className="mt-1 text-sm text-foreground">{turn.nextStep}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {turn.sectorId && turn.actionLabel ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => focusSectorFromSuggestion(turn.sectorId ?? "")}
                    >
                      {turn.actionLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => loadConversationComparison(turn.sectorId ?? "")}
                    >
                      Load compare
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleToggleSectorWatchlist(turn.sectorId ?? "", "conversation")}
                    >
                      {visibleSavedSectorIds.includes(turn.sectorId ?? "") ? "Saved" : "Save lane"}
                    </Button>
                  </>
                ) : null}
                <AskMentorLink
                  label="Ask AI mentor"
                  mentorPrompt={
                    turn.sectorId
                      ? `Help me understand this market note about ${turn.title}. What should I do with it, and how should I compare it with my current holdings?`
                      : `Help me understand this market note: ${turn.title}. What should I do with it next?`
                  }
                  mentorQuestionId="allocation"
                  onOpenMentor={onOpenMentor}
                  sourceLabel="Market now vs suggested"
                  contextLabel={`Review market note: ${turn.title}`}
                  contextNote={turn.body}
                  returnState={{ view: "market", target: turn.sectorId ?? selectedSectorId }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>

      <div ref={(node) => {
        marketSectionRefs.current.operations = node;
      }}>
      <Card>
        <CardHeader>
          <CardTitle>Why this sector is suggested for you</CardTitle>
          <CardDescription>
            A personal read that ties the selected suggested sector back to your current holdings, current gaps, and risk posture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-4 md:col-span-3">
            <div className="mb-4 rounded-md border bg-background p-4">
              <p className="text-sm font-medium text-foreground">How to use this section</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Read this after you shortlist a sector. It explains whether the suggestion is about a real allocation gap, a learning opportunity, or simply a theme worth tracking for context.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested focus
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedSuggestedSector?.name ?? "Suggested sector lens"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSuggestedSector
                    ? `Strongest pocket: ${selectedSuggestedSector.strongestSubSector}`
                    : "Choose a suggested sector to see the strongest pocket and fit reasons here."}
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Why it surfaced
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedSuggestedSector
                    ? "Market signal plus personal fit"
                    : "Suggested sectors align live tape with portfolio relevance"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSuggestedSector
                    ? "This suggestion is not just about momentum. It surfaced because the live market read overlaps with your current allocation picture."
                    : "Use this area to understand why a sector is being highlighted for your plan instead of just being strong on the day."}
                </p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best use
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedSuggestedSector ? "Learn, compare, then act" : "Use as a fit guide"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Let these reasons explain the fit first, then use the compare strip and mentor handoff if the move still feels unclear.
                </p>
              </div>
            </div>
          </div>
          {suggestedSectorReasons.map((reason) => (
            <div key={reason.title} className="rounded-md border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{reason.caption}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{reason.title}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{reason.detail}</p>
            </div>
          ))}
          <div className="rounded-md border bg-muted/20 p-4 md:col-span-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Still unsure how this fits your plan?</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Bring this sector, your current holdings, and your risk posture into one mentor conversation so the next move becomes clearer and less reactive.
                </p>
              </div>
              <AskMentorLink
                label="Ask AI mentor why this fits me"
                mentorPrompt={
                  selectedSuggestedSector
                    ? `Why is ${selectedSuggestedSector.name} being suggested for me given my current holdings, risk profile, and goal direction?`
                    : "Help me understand how suggested sectors should connect to my holdings, goals, and risk profile."
                }
                mentorQuestionId="allocation"
                onOpenMentor={onOpenMentor}
                sourceLabel="Market personalized suggestion"
                contextLabel="Understand why this sector fits your profile"
                contextNote="Use the personalized suggested-sector explanation from the market page."
                returnState={{ view: "market", target: selectedSectorId }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Sync schedule</CardTitle>
              <CardDescription>
                Keep provider checks and market polling moving on a predictable cadence so the workspace stays trustworthy without constant manual refreshing.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={schedulerPlan.dueCount ? "secondary" : "outline"}>
                Scheduler due {schedulerPlan.dueCount}
              </Badge>
              <Badge variant="outline">
                Next market poll {formatSyncTimeLabel(nextMarketRefreshAt)}
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={() => onRunIntegrationSync()}>
                Run due syncs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-background p-4 md:col-span-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ops posture</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {schedulerPlan.dueCount > 0 ? `${schedulerPlan.dueCount} syncs due` : "On cadence"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use this only to keep the data layer trustworthy. It should support the market view, not become the main thing you stare at.
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Market refresh</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {marketPreferences.autoRefresh ? `Every ${marketPreferences.pollingIntervalSeconds}s` : "Manual"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Faster polling feels more live, but stable demos often benefit from slower or manual refresh.
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Best next move</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {schedulerPlan.dueCount > 0 ? "Run due syncs, then return to the market read" : "Leave this alone unless something is stale"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The goal is calm reliability. If nothing is stale, spend your attention on sectors and portfolio fit instead.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-4 md:col-span-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What this is
                </p>
                <p className="mt-2 text-sm text-foreground">
                  The reliability layer behind your market and import views.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What to watch
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Due checks, warning streaks, and sources that have drifted out of rhythm.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Best move
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Run due syncs when something is stale, then return to the watchlist and compare views.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-4 md:col-span-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Connector health
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg connector success</p>
                    <p className="mt-1 font-semibold">{integrationHealthSummary.averageSuccessRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tracked sync runs</p>
                    <p className="mt-1 font-semibold">{integrationHealthSummary.totalRuns}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Warning streaks</p>
                    <p className="mt-1 font-semibold">{integrationHealthSummary.warningConnections}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Scheduler
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Due now</p>
                    <p className="mt-1 font-semibold">{schedulerPlan.dueCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">First checks pending</p>
                    <p className="mt-1 font-semibold">{schedulerPlan.readyCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next connector check</p>
                    <p className="mt-1 font-semibold">{formatSyncTimeLabel(schedulerPlan.nextRunAt)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  Source state
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {schedulerPlan.activeCount} active source{schedulerPlan.activeCount === 1 ? "" : "s"} · {schedulerPlan.pausedCount} paused · {schedulerPlan.errorCount} need fixes.
                </p>
                {schedulerPlan.dueCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {schedulerPlan.entries
                      .filter((entry) => entry.shouldRunNow)
                      .slice(0, 4)
                      .map((entry) => (
                        <Badge key={entry.id} variant="outline">
                          {entry.providerName}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {activeIntegrations.length ? (
            activeIntegrations.map((integration) => {
              const syncState = getIntegrationSyncState(integration);
              const healthMetrics = getIntegrationHealthMetrics(integration);
              const nextSyncAt = getNextIntegrationSyncAt(integration);

              return (
                <div key={integration.id} className="rounded-md border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{integration.providerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getIntegrationStrategyLabel(integration.importStrategy)} · every {integration.syncCadenceMinutes} min
                      </p>
                    </div>
                    <Badge
                      variant={syncState.tone === "healthy" ? "secondary" : "outline"}
                    >
                      {syncState.label}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          Current read
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {syncState.detail}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          Health
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <p>
                            Success rate {healthMetrics.successRate}% · avg files {healthMetrics.averageImportedFiles.toFixed(1)}
                          </p>
                          <p>
                            Last healthy sync {healthMetrics.lastHealthySyncAt ? new Date(healthMetrics.lastHealthySyncAt).toLocaleString() : "not yet"}
                            {healthMetrics.warningStreak ? ` · streak ${healthMetrics.warningStreak}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          Schedule
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <p>
                            Next check {formatSyncTimeLabel(nextSyncAt)}{nextSyncAt ? ` · ${new Date(nextSyncAt).toLocaleString()}` : ""}
                          </p>
                          <p>
                            Scheduler {integration.lastSchedulerStatus} · {integration.lastSchedulerCheckAt ? new Date(integration.lastSchedulerCheckAt).toLocaleString() : "not checked yet"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <span>
                        Last sync {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "not yet"}{integration.lastSyncOrigin ? ` · ${integration.lastSyncOrigin}` : ""}
                      </span>
                      <span>
                        Result {integration.lastSyncStatus} · files {integration.lastImportedFileCount}
                      </span>
                      <span>{integration.lastSyncMessage}</span>
                      <span>{integration.lastSchedulerMessage}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRunIntegrationSync(integration.id)}
                    >
                      Run connector
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid gap-4 rounded-md border bg-background p-4 md:col-span-2">
              <div>
                <p className="text-sm font-medium text-foreground">No active market connectors yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The market page still works without live connectors, but scheduled sync checkpoints and provider-aware import flow only start once a broker or inbox source is connected.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Start here</p>
                  <p className="mt-1 text-sm font-medium">Connect one reliable source</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    One good broker feed or forwarded statement inbox is usually enough to make this page feel live.
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Use this page meanwhile</p>
                  <p className="mt-1 text-sm font-medium">Study sectors and fit</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Suggested sectors, trend windows, and the now-vs-suggested view still help without a connector.
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Best next move</p>
                  <p className="mt-1 text-sm font-medium">Review Settings and wire a source</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Once connected, this section turns into a proper sync board instead of a static readiness note.
                  </p>
                </div>
              </div>
              <AskMentorLink
                label="Ask AI mentor which market source to connect first"
                mentorPrompt="I want this market page to feel more useful. Help me decide whether I should connect a broker feed, an email statement source, or just study sectors first."
                mentorQuestionId="allocation"
                onOpenMentor={onOpenMentor}
                sourceLabel="Market connector empty state"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market explained simply</CardTitle>
          <CardDescription>
            Short notes that help you learn what matters without turning every move into a signal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-4 md:col-span-3">
            <p className="text-sm font-medium text-foreground">Use this as your calm-down layer</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              If the heatmap, compare strip, or suggested sectors feel noisy, come here first. These notes are meant to translate the page back into simple investing language.
            </p>
          </div>
          {marketExplainers.map((item) => (
            <div key={item.headline} className="rounded-md border bg-background p-4">
              <p className="font-semibold">{item.headline}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.explanation}
              </p>
              <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                {item.action}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {marketData.holdingsWatch.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your holdings watch</CardTitle>
            <CardDescription>
              Best-effort mapping from tracked holdings to live or fallback market proxies, so you can see what your portfolio is feeling today without treating every proxy move as a trade call.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What this shows
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    A live pulse check on what your tracked holdings are broadly experiencing.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    What it is not
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    It is not a direct buy or sell signal for every fund or stock you hold.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Best move
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Use it to decide what deserves a closer look, then open the sector view or ask the mentor.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Tracked watch total</p>
                <p className="mt-2 text-2xl font-semibold">
                  {holdingsWatchSummary.trackedTotal.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Indicative live total</p>
                <p className="mt-2 text-2xl font-semibold">
                  {holdingsWatchSummary.updatedTotal.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Indicative move</p>
                <p className="mt-2 text-2xl font-semibold">
                  {holdingsWatchSummary.deltaValue >= 0 ? "+" : ""}
                  {holdingsWatchSummary.deltaValue.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {holdingsWatchSummary.deltaPercent >= 0 ? "+" : ""}
                  {holdingsWatchSummary.deltaPercent.toFixed(2)}%
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Leading / lagging</p>
                <p className="mt-2 text-sm font-semibold">
                  {holdingsWatchSummary.leadMover ?? "N/A"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weakest {holdingsWatchSummary.lagMover ?? "N/A"}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            {holdingsWatchSummary.items.map((item, index) => (
              <div key={`${item.assetName}-${item.mappedSymbol ?? "fallback"}-${index}`} className="rounded-md border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.assetName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type} {item.mappedSymbol ? `· ${item.mappedSymbol}` : ""}
                    </p>
                  </div>
                  <Badge variant={item.change >= 0 ? "secondary" : "outline"}>
                    {item.change >= 0 ? "+" : ""}
                    {item.change.toFixed(2)}%
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.signal}</p>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <span>
                    Tracked {item.trackedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span>
                    Indicative {item.indicativeValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            ))}
            </div>
            <AskMentorLink
              label="Ask AI mentor about my holdings watch"
              mentorPrompt="Use my holdings watch from the market page to explain what deserves attention, what is just noise, and how I should connect these moves back to my long-term plan."
              mentorQuestionId="allocation"
              onOpenMentor={onOpenMentor}
              sourceLabel="Market holdings watch"
              contextLabel="Review holdings watch against the market"
              contextNote="Use the holdings watch to separate meaningful portfolio context from normal day-to-day market movement."
              returnState={{ view: "market", target: selectedSectorId }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MarketTile({
  item,
}: {
  item: MarketSnapshotResponse["snapshot"][number];
}) {
  const isPositive = item.change >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{item.name}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
        <Icon className={isPositive ? "h-4 w-4 text-primary" : "h-4 w-4 text-destructive"} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge variant={isPositive ? "secondary" : "outline"}>
          {isPositive ? "+" : ""}
          {item.change.toFixed(2)}%
        </Badge>
        <span className="text-right text-xs text-muted-foreground">{item.signal}</span>
      </div>
    </div>
  );
}

function normalizeMarketSnapshotResponse(payload: unknown): MarketSnapshotResponse {
  if (!isRecord(payload)) {
    return buildFallbackMarketResponse(
      "Market response was incomplete. Showing fallback snapshot.",
    );
  }

  const fallback = buildFallbackMarketResponse(
    "Market response was incomplete. Showing fallback snapshot.",
  );

  return {
    holdingsWatch: Array.isArray(payload.holdingsWatch)
      ? payload.holdingsWatch.filter(isHoldingWatchItem)
      : fallback.holdingsWatch,
    message: typeof payload.message === "string" ? payload.message : fallback.message,
    sectors: Array.isArray(payload.sectors)
      ? payload.sectors.filter(isSectorMove)
      : fallback.sectors,
    sentiment: typeof payload.sentiment === "string" ? payload.sentiment : fallback.sentiment,
    sentimentScore:
      typeof payload.sentimentScore === "number"
        ? payload.sentimentScore
        : fallback.sentimentScore,
    snapshot: Array.isArray(payload.snapshot)
      ? payload.snapshot.filter(isMarketTile)
      : fallback.snapshot,
    source: typeof payload.source === "string" ? payload.source : fallback.source,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt,
  };
}

function normalizeHoldingsWatchResponse(payload: unknown): {
  holdingsWatch: MarketSnapshotResponse["holdingsWatch"];
} {
  if (!isRecord(payload) || !Array.isArray(payload.holdingsWatch)) {
    return { holdingsWatch: [] };
  }

  return {
    holdingsWatch: payload.holdingsWatch.filter(isHoldingWatchItem),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMarketTile(value: unknown): value is MarketSnapshotResponse["snapshot"][number] {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.signal === "string" &&
    typeof value.value === "string" &&
    typeof value.change === "number"
  );
}

function isSectorMove(value: unknown): value is MarketSnapshotResponse["sectors"][number] {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.value === "number"
  );
}

function isHoldingWatchItem(
  value: unknown,
): value is MarketSnapshotResponse["holdingsWatch"][number] {
  return (
    isRecord(value) &&
    typeof value.assetName === "string" &&
    typeof value.change === "number" &&
    typeof value.signal === "string" &&
    typeof value.type === "string" &&
    (typeof value.mappedSymbol === "string" || value.mappedSymbol === null)
  );
}
