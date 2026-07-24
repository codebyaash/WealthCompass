"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
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
import { SelectField } from "@/components/wealth/form-fields";

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
  const [marketActionMessage, setMarketActionMessage] = useState(
    "Compare sectors to decide what to study next or save for review.",
  );
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
  const selectedSectorGroup = useMemo(
    () => sectorGroups.find((group) => group.id === selectedSectorId) ?? sectorGroups[0] ?? null,
    [sectorGroups, selectedSectorId],
  );
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
      studySector,
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

  function focusSectorFromSuggestion(sectorId: string) {
    if (!sectorGroups.some((group) => group.id === sectorId)) return;
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

  function handleToggleSectorWatchlist(sectorId: string) {
    const sectorLabel =
      sectorGroups.find((group) => group.id === sectorId)?.name ?? "This sector";

    setSavedWatchlistEntries((current) => {
      const exists = current.some((entry) => entry.sectorId === sectorId);
      const nextEntries = toggleMarketWatchlistSector(sectorId, current);

      setMarketActionMessage(
        exists
          ? `${sectorLabel} removed from your saved market watchlist.`
          : `${sectorLabel} saved to your market watchlist.`,
      );

      return nextEntries;
    });
  }

  function handleMarkSectorReviewed(sectorId: string) {
    setSavedWatchlistEntries((current) => markMarketWatchlistSectorReviewed(sectorId, current));
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
                      Open {reviewQueueSummary.next.sector.name}
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
                <button
                  key={`heat-${sector.id}`}
                  type="button"
                  className={`rounded-md border p-4 text-left transition-colors hover:border-primary/40 ${toneClass}`}
                  onClick={() => setSelectedSectorId(sector.id)}
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
                </button>
              );
            })}
          </div>

          <div className="rounded-md border bg-background">
            <div className="grid grid-cols-[auto_1.2fr_auto_auto_auto] gap-3 border-b px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Rank</span>
              <span>Sector</span>
              <span>Move</span>
              <span>Suggested</span>
              <span>Open</span>
            </div>
            <div className="divide-y">
              {sortedSectorGroups.map((sector, index) => (
                <div
                  key={`rank-${sector.id}`}
                  className="grid grid-cols-[auto_1.2fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm"
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
                  <span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setSelectedSectorId(sector.id)}
                    >
                      View
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Strongest today
              </p>
              <div className="mt-3 grid gap-2">
                {sectorLeaders.strongest.map((sector) => (
                  <button
                    key={`leader-${sector.id}`}
                    type="button"
                    className="rounded-md border bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                    onClick={() => setSelectedSectorId(sector.id)}
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
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weakest today
              </p>
              <div className="mt-3 grid gap-2">
                {sectorLeaders.weakest.map((sector) => (
                  <button
                    key={`laggard-${sector.id}`}
                    type="button"
                    className="rounded-md border bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                    onClick={() => setSelectedSectorId(sector.id)}
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
                  </button>
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
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedSectorSnapshot.sectors.map((sector) => (
                  (() => {
                    const compareRole = getComparisonRoleLabel({
                      compareAutoSync,
                      leftId: compareLeftSectorId,
                      rightId: compareRightSectorId,
                      sectorId: sector.id,
                    });

                    return (
                  <Button
                    key={`overlay-${sector.id}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setSelectedSectorId(sector.id)}
                  >
                    {sector.name}
                    {compareRole ? ` • ${compareLeftSectorId === sector.id ? "lead compare" : "compare"}` : ""}
                  </Button>
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
                <button
                  key={sector.id}
                  type="button"
                  className={`rounded-md border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "bg-background hover:border-primary/40 hover:bg-muted/20"
                  }`}
                  onClick={() => setSelectedSectorId(sector.id)}
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
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                  onClick={() => setSelectedSectorId(quickCompare.primarySector.id)}
                >
                  Open {quickCompare.primarySector.name}
                </Button>
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
                        onClick={() => setSelectedSectorId(compareSummary.studySector.id)}
                      >
                        Open study sector
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleToggleSectorWatchlist(compareSummary.studySector.id)}
                      >
                        {visibleSavedSectorIds.includes(compareSummary.studySector.id)
                          ? "Remove saved sector"
                          : "Save study sector"}
                      </Button>
                    </div>
                  </div>
                </div>
                <p
                  aria-live="polite"
                  className="mt-3 text-xs text-muted-foreground"
                >
                  {marketActionMessage}
                </p>
                <p className="mt-3 text-sm font-medium">
                  {compareSummary.stronger.name} is the stronger live read right now, while{" "}
                  {compareSummary.softer.name} gives you the contrast case.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use this strip to separate market leadership from personal relevance. A sector can
                  be strong on tape but still be less useful for your current portfolio than a
                  slightly softer sector with a clearer fit gap.
                </p>
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
                            onClick={() => setSelectedSectorId(sector.id)}
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

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
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
            </div>
            {selectedSectorId === "all-suggested" ? (
              <div className="grid gap-3">
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
                    <button
                      key={idea.id}
                      type="button"
                      className="rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                      onClick={() => focusSectorFromSuggestion(idea.id)}
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
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedSectorGroup ? (
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{selectedSectorGroup.name} read</p>
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
                          : "Open or pin it into the compare strip if you want a direct side-by-side read."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Take action
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Use this sector as a compare lane, park it on your watchlist, or bring it
                          into a mentor conversation.
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
                          onClick={() => handleToggleSectorWatchlist(selectedSectorGroup.id)}
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
                                focusSectorFromSuggestion(item.sector.id);
                              }}
                            >
                              Open
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
                {savedSectorGroups.map((sector) => {
                  const bestPocket =
                    [...sector.subSectors].sort((left, right) => right.value - left.value)[0]?.name ??
                    "Core names";
                  const savedSectorFitStatus =
                    suggestedSectorFit.rows.find((row) => row.id === sector.id)?.status ?? null;

                  return (
                    <div
                      key={`watch-${sector.id}`}
                      className="rounded-md border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{sector.name}</p>
                            {(() => {
                              const priorityLabel = getSectorPriorityLabel({
                                fitStatus: savedSectorFitStatus,
                                isLeader: sectorBreadth.strongest === sector.name,
                                isSuggested: suggestedSectorIds.has(sector.id),
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
                            {suggestedSectorIds.has(sector.id) ? (
                              <Badge variant="secondary">Suggested</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Strongest pocket: {bestPocket}
                          </p>
                        </div>
                        <Badge variant={sector.change >= 0 ? "secondary" : "outline"}>
                          {sector.change >= 0 ? "+" : ""}
                          {sector.change.toFixed(2)}%
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {sector.rationale}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => focusSectorFromSuggestion(sector.id)}
                        >
                          Open sector
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleToggleSectorWatchlist(sector.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
              {suggestedSectorFit.rows.map((row) => (
                <button
                  key={`fit-${row.id}`}
                  type="button"
                  className="rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                  onClick={() => focusSectorFromSuggestion(row.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.name}</p>
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
                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Tracked value
                      </p>
                      <p className="mt-2 font-medium">
                        ₹{Math.round(row.currentValue).toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gap to suggested: {row.gapToSuggested > 0 ? "+" : ""}
                        {row.gapToSuggested.toFixed(1)} pts
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{row.note}</p>
                  </div>
                </button>
              ))}
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

      <Card>
        <CardHeader>
          <CardTitle>Suggested sectors</CardTitle>
          <CardDescription>
            This is a filtered view of the same live market sector set, reordered so the most useful sectors stand out first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {suggestedSectorSnapshot.sectors.map((idea) => (
              <button
                key={idea.id}
                type="button"
                className={`rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20 ${
                  selectedSectorId === idea.id ? "border-primary/50 bg-muted/20" : ""
                }`}
                onClick={() => focusSectorFromSuggestion(idea.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{idea.name}</p>
                      <Badge variant="outline">
                        {getSectorPriorityLabel({
                          fitStatus:
                            suggestedSectorFit.rows.find((row) => row.id === idea.id)?.status ?? null,
                          isLeader: sectorBreadth.strongest === idea.name,
                          isSuggested: true,
                        })}
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
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {idea.reason}
                </p>
                <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm leading-6">
                  {idea.topIdea}
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-sm font-medium">Top suggestions inside the suggested sectors</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {suggestedSectorSnapshot.topSuggestions.map((idea) => (
                <button
                  key={`top-${idea.id}`}
                  type="button"
                  className={`rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/20 ${
                    selectedSectorId === idea.id ? "border-primary/50 bg-muted/20" : ""
                  }`}
                  onClick={() => focusSectorFromSuggestion(idea.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{idea.strongestSubSector}</p>
                    <Badge variant={idea.change >= 0 ? "secondary" : "outline"}>
                      {idea.change >= 0 ? "+" : ""}
                      {idea.change.toFixed(2)}%
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {idea.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Now vs suggested</CardTitle>
          <CardDescription>
            A plain-English conversation between the live market read and the suggested-sector lens, so users can see what is happening now and what deserves deeper study next.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
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
                {turn.sectorId && turn.actionLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => focusSectorFromSuggestion(turn.sectorId ?? "")}
                  >
                    {turn.actionLabel}
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">{turn.body}</p>
              <div className="mt-3 rounded-md border bg-background/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Next move
                </p>
                <p className="mt-1 text-sm text-foreground">{turn.nextStep}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why this sector is suggested for you</CardTitle>
          <CardDescription>
            A personal read that ties the selected suggested sector back to your current holdings and risk posture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {suggestedSectorReasons.map((reason) => (
            <div key={reason.title} className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {reason.caption}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{reason.title}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{reason.detail}</p>
            </div>
          ))}
          <div className="rounded-md border bg-muted/20 p-4 md:col-span-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Still unsure how this fits your plan?</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Bring this sector, your current holdings, and your risk posture into one mentor conversation.
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

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Sync schedule</CardTitle>
              <CardDescription>
                Keep provider checks and market polling moving on a predictable cadence.
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
                Run active syncs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
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
                      Sync now
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground md:col-span-2">
              No active provider integrations yet. Add a broker or email source in Settings to start scheduling sync checkpoints.
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
            <CardDescription>Best-effort mapping from tracked holdings to live or fallback market proxies.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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
