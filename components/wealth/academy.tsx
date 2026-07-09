"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const categoryLibrary = [
  {
    name: "Index Funds",
    fit: "Core wealth building",
    risk: "Medium",
    horizon: "5+ years",
    beginnerNote: "A simple way to own a broad market without picking stocks.",
    liquidity: "High",
  },
  {
    name: "Debt Funds",
    fit: "Near-term goals",
    risk: "Low to medium",
    horizon: "1-3 years",
    beginnerNote: "Useful for stability, but returns can still move with rates.",
    liquidity: "Medium to high",
  },
  {
    name: "Gold",
    fit: "Portfolio stabilizer",
    risk: "Medium",
    horizon: "3+ years",
    beginnerNote: "Usually a diversifier, not the main engine of wealth.",
    liquidity: "High",
  },
  {
    name: "Direct Stocks",
    fit: "Experienced investors",
    risk: "High",
    horizon: "7+ years",
    beginnerNote: "Best after you understand diversification and valuation risk.",
    liquidity: "High",
  },
  {
    name: "Fixed Deposits",
    fit: "Capital protection",
    risk: "Low",
    horizon: "Months to 3 years",
    beginnerNote: "Predictable, but inflation can reduce real returns.",
    liquidity: "Medium",
  },
  {
    name: "REITs",
    fit: "Real estate exposure",
    risk: "Medium",
    horizon: "5+ years",
    beginnerNote: "Lets you invest in property-like income without buying a house.",
    liquidity: "High",
  },
];

const comparisonLibrary = [
  {
    id: "etf-mutual-fund",
    title: "ETF vs Mutual Fund",
    left: {
      name: "ETF",
      effort: "Medium",
      liquidity: "Market hours",
      risk: "Market-linked",
      bestFor: "Investors comfortable placing orders.",
      taxNote: "Tax rules usually follow the underlying asset class.",
    },
    right: {
      name: "Mutual Fund",
      effort: "Low",
      liquidity: "End-of-day NAV",
      risk: "Market-linked",
      bestFor: "Beginners who want automated SIPs.",
      taxNote: "Tax rules depend on equity, debt, or hybrid category.",
    },
    winner: "Mutual Fund",
    recommendation:
      "Start with mutual funds for habit-building, then learn ETFs once order placement feels natural.",
  },
  {
    id: "gold-bonds",
    title: "Gold vs Bonds",
    left: {
      name: "Gold",
      effort: "Low",
      liquidity: "High",
      risk: "Medium",
      bestFor: "Diversification during stress and inflation fear.",
      taxNote: "Tax treatment varies by gold format and holding period.",
    },
    right: {
      name: "Bonds",
      effort: "Medium",
      liquidity: "Medium",
      risk: "Low to medium",
      bestFor: "Stability, income, and near-term goals.",
      taxNote: "Interest and capital gains may be taxed differently.",
    },
    winner: "Bonds",
    recommendation:
      "Use bonds or debt funds for planned goals; keep gold as a small diversifier, not the core.",
  },
  {
    id: "sip-lumpsum",
    title: "SIP vs Lump Sum",
    left: {
      name: "SIP",
      effort: "Low",
      liquidity: "Depends on product",
      risk: "Averages entry risk",
      bestFor: "Monthly income and beginner discipline.",
      taxNote: "Each installment may have its own holding period.",
    },
    right: {
      name: "Lump Sum",
      effort: "Medium",
      liquidity: "Depends on product",
      risk: "Higher timing risk",
      bestFor: "Surplus cash and long horizons.",
      taxNote: "Holding period usually starts from investment date.",
    },
    winner: "SIP",
    recommendation:
      "Use SIPs as the default. Add lump sum only when your emergency fund is ready and your horizon is long.",
  },
  {
    id: "fd-debt-fund",
    title: "FD vs Debt Fund",
    left: {
      name: "Fixed Deposit",
      effort: "Low",
      liquidity: "Medium",
      risk: "Low",
      bestFor: "Certainty and capital protection.",
      taxNote: "Interest is usually taxed as income.",
    },
    right: {
      name: "Debt Fund",
      effort: "Medium",
      liquidity: "Medium to high",
      risk: "Low to medium",
      bestFor: "Flexible short-to-medium term goals.",
      taxNote: "Tax treatment depends on current debt fund rules.",
    },
    winner: "Fixed Deposit",
    recommendation:
      "Use FDs for certainty. Consider debt funds when you understand interest-rate and credit risk.",
  },
  {
    id: "reit-property",
    title: "REIT vs Rental Property",
    left: {
      name: "REIT",
      effort: "Low",
      liquidity: "High",
      risk: "Medium",
      bestFor: "Small-ticket real estate exposure.",
      taxNote: "Distributions can have mixed tax treatment.",
    },
    right: {
      name: "Rental Property",
      effort: "High",
      liquidity: "Low",
      risk: "High concentration",
      bestFor: "Investors ready for large capital and operations.",
      taxNote: "Rental income, loan interest, and capital gains matter.",
    },
    winner: "REIT",
    recommendation:
      "Explore REITs first if you want real estate exposure without a large down payment or management work.",
  },
] as const;

type ComparisonId = (typeof comparisonLibrary)[number]["id"];
type ComparisonOptionData = {
  bestFor: string;
  effort: string;
  liquidity: string;
  name: string;
  risk: string;
  taxNote: string;
};

export function Academy() {
  const [activeComparisonId, setActiveComparisonId] = useState<ComparisonId>(
    comparisonLibrary[0].id,
  );
  const activeComparison =
    comparisonLibrary.find((comparison) => comparison.id === activeComparisonId) ??
    comparisonLibrary[0];

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Investment Academy</CardTitle>
          <CardDescription>Simple categories with risk, horizon, and purpose.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {categoryLibrary.map((category) => (
            <div key={category.name} className="rounded-md border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{category.name}</h3>
                <Badge variant="outline">{category.risk}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{category.fit}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {category.beginnerNote}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Horizon: {category.horizon}</span>
                <span>Liquidity: {category.liquidity}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Investment Comparator</CardTitle>
          <CardDescription>
            Compare beginner choices by fit, risk, effort, liquidity, and tax awareness.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2 md:grid-cols-5">
            {comparisonLibrary.map((comparison) => (
              <Button
                key={comparison.id}
                type="button"
                variant={activeComparison.id === comparison.id ? "default" : "outline"}
                className="h-auto min-h-11 whitespace-normal px-3 text-center leading-5"
                onClick={() => setActiveComparisonId(comparison.id)}
              >
                {comparison.title}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <ComparisonOption option={activeComparison.left} />
            <div className="flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold">
                VS
              </div>
            </div>
            <ComparisonOption option={activeComparison.right} />
          </div>

          <div className="rounded-md border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Beginner pick</Badge>
              <Badge variant="outline">{activeComparison.winner}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {activeComparison.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonOption({
  option,
}: {
  option: ComparisonOptionData;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{option.name}</h3>
        <LineChart className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-4 grid gap-3">
        <ComparisonMetric label="Best for" value={option.bestFor} />
        <ComparisonMetric label="Risk" value={option.risk} />
        <ComparisonMetric label="Effort" value={option.effort} />
        <ComparisonMetric label="Liquidity" value={option.liquidity} />
        <ComparisonMetric label="Tax note" value={option.taxNote} />
      </div>
    </div>
  );
}

function ComparisonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}
