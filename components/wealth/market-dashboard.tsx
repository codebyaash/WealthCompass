"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const marketSnapshot = [
  {
    change: 0.72,
    name: "Nifty 50",
    signal: "Broad market strength",
    value: "24,860",
  },
  {
    change: -0.28,
    name: "Bank Nifty",
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
    name: "10Y Bond",
    signal: "Yield stable",
    value: "6.91%",
  },
];

const sectorSnapshot = [
  { name: "Banks", value: -0.2 },
  { name: "IT", value: 0.9 },
  { name: "FMCG", value: 0.4 },
  { name: "Energy", value: 1.1 },
  { name: "Pharma", value: 0.6 },
];

const marketExplainers = [
  {
    headline: "Why indexes can rise while some stocks fall",
    explanation:
      "Large indexes are weighted. If a few heavy companies move up, the index can look healthy even when many smaller holdings are flat.",
    action: "Check diversification before reacting to one headline.",
  },
  {
    headline: "What stable bond yields usually mean",
    explanation:
      "A calm yield environment often means debt funds may feel steadier, but credit quality and duration still matter.",
    action: "Match debt investments to goal timing.",
  },
  {
    headline: "Why gold is not a replacement for an emergency fund",
    explanation:
      "Gold can diversify a portfolio, but its price moves. Emergency money should prioritize reliability and access.",
    action: "Keep emergency reserves separate from long-term allocation.",
  },
];

export function MarketDashboard() {
  const sentimentScore = Math.round(
    50 + marketSnapshot.reduce((sum, item) => sum + item.change, 0) * 8,
  );
  const sentiment =
    sentimentScore >= 58 ? "Constructive" : sentimentScore <= 44 ? "Cautious" : "Neutral";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Market Dashboard</CardTitle>
              <CardDescription>
                Manual snapshot with beginner explanations. Live/free APIs can plug in later.
              </CardDescription>
            </div>
            <Badge variant="secondary">{sentiment}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {marketSnapshot.map((item) => (
            <MarketTile key={item.name} item={item} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sector movement</CardTitle>
            <CardDescription>What moved most in this sample snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorSnapshot}>
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
                <span>{sentimentScore}/100</span>
              </div>
              <Progress value={sentimentScore} />
            </div>
            <div className="rounded-md border bg-muted/40 p-4 text-sm leading-6">
              {sentiment === "Constructive"
                ? "Markets look broadly positive, but this is not a signal to abandon your plan. Continue goal-based investing."
                : sentiment === "Cautious"
                  ? "Markets look soft. Beginners should avoid panic selling and revisit asset allocation before acting."
                  : "Markets look mixed. This is a good day to learn, rebalance only if your plan already says so, and avoid impulse trades."}
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}

function MarketTile({
  item,
}: {
  item: (typeof marketSnapshot)[number];
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
