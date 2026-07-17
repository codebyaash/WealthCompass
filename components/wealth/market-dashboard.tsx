"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
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
  getIntegrationSyncState,
  getNextIntegrationSyncAt,
} from "@/lib/integration-sync";
import {
  buildFallbackMarketResponse,
  getMarketPortfolioNote,
  summarizeHoldingsWatch,
  summarizeSectorBreadth,
  type MarketSnapshotResponse,
} from "@/lib/market-data";
import type {
  IntegrationConnection,
  MarketPreferences,
  PortfolioAsset,
} from "@/lib/local-storage";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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

export function MarketDashboard({
  assets,
  integrations,
  marketPreferences,
  onRunIntegrationSync,
  onUpdatePreferences,
}: {
  assets: PortfolioAsset[];
  integrations: IntegrationConnection[];
  marketPreferences: MarketPreferences;
  onRunIntegrationSync: (connectionId?: string) => void;
  onUpdatePreferences: (preferences: MarketPreferences) => void;
}) {
  const [marketData, setMarketData] = useState<MarketSnapshotResponse>(() =>
    buildFallbackMarketResponse("Loading market snapshot."),
  );
  const [isLoading, setIsLoading] = useState(true);
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
  const marketPortfolioNote = useMemo(
    () =>
      getMarketPortfolioNote({
        holdingsWatch: holdingsWatchSummary,
        sectorBreadth,
        sentiment: marketData.sentiment,
      }),
    [holdingsWatchSummary, marketData.sentiment, sectorBreadth],
  );

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
        if (isMounted) {
          setIsLoading(false);
        }
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

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Market Dashboard</CardTitle>
              <CardDescription>{marketData.message}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector movement</CardTitle>
            <CardDescription>
              {isLoading ? "Loading cached market breadth." : "Freshly prepared market breadth snapshot."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketData.sectors}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beginner sentiment</CardTitle>
            <CardDescription>Rule-based interpretation of market breadth.</CardDescription>
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
      </div>

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
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg connector success</p>
                <p className="mt-2 font-semibold">{integrationHealthSummary.averageSuccessRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tracked sync runs</p>
                <p className="mt-2 font-semibold">{integrationHealthSummary.totalRuns}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due now</p>
                <p className="mt-2 font-semibold">{schedulerPlan.dueCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warning streaks</p>
                <p className="mt-2 font-semibold">{integrationHealthSummary.warningConnections}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {schedulerPlan.activeCount} active source{schedulerPlan.activeCount === 1 ? "" : "s"} · {schedulerPlan.readyCount} ready for first run · {schedulerPlan.pausedCount} paused · {schedulerPlan.errorCount} need fixes. Next connector check {formatSyncTimeLabel(schedulerPlan.nextRunAt)}.
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
                        {integration.importStrategy} · every {integration.syncCadenceMinutes} min
                      </p>
                    </div>
                    <Badge
                      variant={syncState.tone === "healthy" ? "secondary" : "outline"}
                    >
                      {syncState.label}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <span>
                      Last sync {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "not yet"}{integration.lastSyncOrigin ? ` · ${integration.lastSyncOrigin}` : ""}
                    </span>
                    <span>
                      Result {integration.lastSyncStatus} · files {integration.lastImportedFileCount}
                    </span>
                    <span>
                      Scheduler {integration.lastSchedulerStatus} · {integration.lastSchedulerCheckAt ? new Date(integration.lastSchedulerCheckAt).toLocaleString() : "not checked yet"}
                    </span>
                    <span>
                      Success {healthMetrics.successRate}% · avg files {healthMetrics.averageImportedFiles.toFixed(1)}
                    </span>
                    <span>
                      Next check {formatSyncTimeLabel(nextSyncAt)}{nextSyncAt ? ` · ${new Date(nextSyncAt).toLocaleString()}` : ""}
                    </span>
                    <span>{syncState.detail}</span>
                    <span>
                      Last healthy sync {healthMetrics.lastHealthySyncAt ? new Date(healthMetrics.lastHealthySyncAt).toLocaleString() : "not yet"}
                      {healthMetrics.warningStreak ? ` · warning streak ${healthMetrics.warningStreak}` : ""}
                    </span>
                    <span>{integration.lastSyncMessage}</span>
                    <span>{integration.lastSchedulerMessage}</span>
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
          <CardDescription>Short notes that translate market noise into useful context.</CardDescription>
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
