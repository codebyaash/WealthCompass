"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  BookOpen,
  Compass,
  Landmark,
  LineChart,
  ShieldCheck,
  SplitSquareVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AcademyCategory = {
  beginnerNote: string;
  bestFor: string;
  horizon: string;
  keyWatchouts: string[];
  liquidity: string;
  name: string;
  risk: string;
  returnStyle: string;
  whenNotIdeal: string;
};

type ComparisonOptionData = {
  bestFor: string;
  effort: string;
  liquidity: string;
  name: string;
  risk: string;
  taxNote: string;
  watchout: string;
};

type ComparisonItem = {
  id: string;
  left: ComparisonOptionData;
  recommendation: string;
  right: ComparisonOptionData;
  title: string;
  winner: string;
};

const categoryLibrary: AcademyCategory[] = [
  {
    beginnerNote: "A simple default choice for long-term wealth because you buy a broad market basket instead of guessing winners.",
    bestFor: "Core long-term investing and retirement-style wealth building",
    horizon: "5+ years",
    keyWatchouts: ["Market falls still happen", "Needs patience during flat years"],
    liquidity: "High",
    name: "Index Funds",
    returnStyle: "Market-linked growth",
    risk: "Medium",
    whenNotIdeal: "Not ideal for money needed in the next 1 to 3 years.",
  },
  {
    beginnerNote: "Useful when you want diversification with SIP-friendly investing and professional fund management.",
    bestFor: "Hands-off equity exposure with automated investing",
    horizon: "5+ years",
    keyWatchouts: ["Expense ratios matter", "Some funds quietly hug the index"],
    liquidity: "High",
    name: "Equity Mutual Funds",
    returnStyle: "Market-linked growth",
    risk: "Medium to high",
    whenNotIdeal: "Weak fit if you do not yet know why you picked active over index.",
  },
  {
    beginnerNote: "Debt funds can help with parking money for shorter goals, but they are not the same as guaranteed bank deposits.",
    bestFor: "Short-to-medium term goals and portfolio stability",
    horizon: "1-3 years",
    keyWatchouts: ["Interest-rate risk exists", "Credit quality matters"],
    liquidity: "Medium to high",
    name: "Debt Funds",
    returnStyle: "Income plus modest price movement",
    risk: "Low to medium",
    whenNotIdeal: "Not ideal if you expect FD-like certainty with no NAV movement.",
  },
  {
    beginnerNote: "Fixed deposits are familiar and predictable, which makes them useful for safety buckets and planned expenses.",
    bestFor: "Capital protection and near-term cash planning",
    horizon: "Months to 3 years",
    keyWatchouts: ["Inflation can reduce real return", "Premature withdrawal may reduce yield"],
    liquidity: "Medium",
    name: "Fixed Deposits",
    returnStyle: "Fixed interest",
    risk: "Low",
    whenNotIdeal: "Weak fit for long-term wealth compounding after tax and inflation.",
  },
  {
    beginnerNote: "Gold is usually a supporting actor in a portfolio, not the main source of compounding.",
    bestFor: "Diversification and stress-period ballast",
    horizon: "3+ years",
    keyWatchouts: ["Can go through long flat periods", "Does not replace an emergency fund"],
    liquidity: "High",
    name: "Gold",
    returnStyle: "Price appreciation without income",
    risk: "Medium",
    whenNotIdeal: "Not ideal as the biggest allocation in a beginner portfolio.",
  },
  {
    beginnerNote: "REITs offer listed real-estate exposure without the ticket size and maintenance burden of physical property.",
    bestFor: "Income-oriented real-estate exposure",
    horizon: "5+ years",
    keyWatchouts: ["Interest-rate sensitivity", "Concentration if overused"],
    liquidity: "High",
    name: "REITs",
    returnStyle: "Yield plus market movement",
    risk: "Medium",
    whenNotIdeal: "Not ideal if you already have too much exposure to one real-estate theme.",
  },
  {
    beginnerNote: "ETFs are efficient and low-cost, but they work best when you are comfortable placing market orders correctly.",
    bestFor: "Low-cost investing with exchange-traded access",
    horizon: "3+ years",
    keyWatchouts: ["Need a demat account", "Intraday price can differ from NAV"],
    liquidity: "Market hours",
    name: "ETFs",
    returnStyle: "Market-linked growth",
    risk: "Medium",
    whenNotIdeal: "Not ideal if order execution still feels confusing.",
  },
  {
    beginnerNote: "Sovereign gold bonds can be better than physical gold for long holding periods if you understand lock-in and price movement.",
    bestFor: "Gold allocation with interest support",
    horizon: "5+ years",
    keyWatchouts: ["Long lock-in mindset needed", "Market price can still swing"],
    liquidity: "Medium",
    name: "Sovereign Gold Bonds",
    returnStyle: "Gold-linked plus fixed coupon",
    risk: "Medium",
    whenNotIdeal: "Weak fit for emergency money or short tactical trading.",
  },
  {
    beginnerNote: "Direct stocks can teach a lot, but they usually belong after your diversification habit is already stable.",
    bestFor: "Research-driven investors who can follow businesses over time",
    horizon: "7+ years",
    keyWatchouts: ["High concentration risk", "Behavior mistakes can hurt more than analysis mistakes"],
    liquidity: "High",
    name: "Direct Stocks",
    returnStyle: "High upside with high variability",
    risk: "High",
    whenNotIdeal: "Not ideal as the first and only investment category for beginners.",
  },
  {
    beginnerNote: "Liquid funds are useful for cash management, but they are still investment products, not current accounts.",
    bestFor: "Emergency fund parking and short idle cash",
    horizon: "Days to 12 months",
    keyWatchouts: ["Return advantage may be modest", "Not a growth engine"],
    liquidity: "High",
    name: "Liquid Funds",
    returnStyle: "Low-volatility income",
    risk: "Low",
    whenNotIdeal: "Not ideal for long-term goals where inflation matters more.",
  },
  {
    beginnerNote: "Hybrid funds reduce allocation decisions for beginners, but you still need to understand what mix you are buying.",
    bestFor: "Investors who want one blended product",
    horizon: "3+ years",
    keyWatchouts: ["Mix can differ a lot across funds", "Can hide risk behind a simple label"],
    liquidity: "High",
    name: "Hybrid Funds",
    returnStyle: "Blended debt and equity outcome",
    risk: "Low to medium",
    whenNotIdeal: "Weak fit if you want full control over debt and equity separately.",
  },
  {
    beginnerNote: "Bonds can be useful for stability and income, but quality, duration, and issuer risk still matter.",
    bestFor: "Income planning and conservative allocations",
    horizon: "2-5 years",
    keyWatchouts: ["Issuer quality matters", "Long-duration bonds react more to rates"],
    liquidity: "Medium",
    name: "Bonds",
    returnStyle: "Coupon income plus price movement",
    risk: "Low to medium",
    whenNotIdeal: "Not ideal if you have not yet learned the basics of interest-rate risk.",
  },
  {
    beginnerNote: "PPF is slow and steady, which is exactly why it can work well as a long-horizon safety bucket.",
    bestFor: "Tax-aware long-term conservative compounding",
    horizon: "15 years+",
    keyWatchouts: ["Lock-in is long", "Not suitable for flexible short-term goals"],
    liquidity: "Low",
    name: "PPF",
    returnStyle: "Government-backed fixed return",
    risk: "Low",
    whenNotIdeal: "Weak fit if you need access before the long lock-in window ends.",
  },
  {
    beginnerNote: "NPS can be useful for retirement structure, but it works best when you intentionally want a retirement-only bucket.",
    bestFor: "Retirement-focused disciplined investing",
    horizon: "10 years+",
    keyWatchouts: ["Exit rules matter", "Product choice inside NPS still matters"],
    liquidity: "Low",
    name: "NPS",
    returnStyle: "Market-linked retirement compounding",
    risk: "Medium",
    whenNotIdeal: "Not ideal for general wealth goals where liquidity matters.",
  },
  {
    beginnerNote: "International funds add geography diversification when you do not want all your equity risk tied to one market.",
    bestFor: "Global diversification beyond domestic equity",
    horizon: "5+ years",
    keyWatchouts: ["Currency can help or hurt", "Fund availability and taxation can change"],
    liquidity: "High",
    name: "International Funds",
    returnStyle: "Global market-linked growth",
    risk: "Medium to high",
    whenNotIdeal: "Weak fit if your domestic core allocation is still not settled.",
  },
  {
    beginnerNote: "Small-cap funds can be rewarding over long periods, but the drawdowns test conviction much harder than large-cap products.",
    bestFor: "Aggressive long-term growth seekers",
    horizon: "7+ years",
    keyWatchouts: ["High volatility", "Can underperform for long stretches"],
    liquidity: "High",
    name: "Small-Cap Funds",
    returnStyle: "High growth with sharper cycles",
    risk: "High",
    whenNotIdeal: "Not ideal as a beginner's first core allocation.",
  },
];

const comparisonLibrary: ComparisonItem[] = [
  {
    id: "etf-mutual-fund",
    title: "ETF vs Mutual Fund",
    left: {
      bestFor: "Investors comfortable placing exchange orders.",
      effort: "Medium",
      liquidity: "Market hours",
      name: "ETF",
      risk: "Market-linked",
      taxNote: "Tax rules generally follow the underlying asset class.",
      watchout: "Bid-ask spread and execution price matter.",
    },
    recommendation:
      "Start with mutual funds for discipline and SIPs. Add ETFs when order placement and costs make intuitive sense.",
    right: {
      bestFor: "Beginners who want simple recurring investing.",
      effort: "Low",
      liquidity: "End-of-day NAV",
      name: "Mutual Fund",
      risk: "Market-linked",
      taxNote: "Tax depends on whether the fund is equity, debt, or hybrid.",
      watchout: "You still need to choose the right category and cost structure.",
    },
    winner: "Mutual Fund",
  },
  {
    id: "fd-debt-fund",
    title: "Fixed Deposit vs Debt Fund",
    left: {
      bestFor: "People who want certainty and easy explanation.",
      effort: "Low",
      liquidity: "Medium",
      name: "Fixed Deposit",
      risk: "Low",
      taxNote: "Interest is usually taxed as income.",
      watchout: "After-tax return may trail inflation.",
    },
    recommendation:
      "Use fixed deposits for certainty first. Consider debt funds when flexibility and post-tax structure matter enough to justify the extra learning.",
    right: {
      bestFor: "Flexible short-to-medium term goal buckets.",
      effort: "Medium",
      liquidity: "Medium to high",
      name: "Debt Fund",
      risk: "Low to medium",
      taxNote: "Tax treatment depends on current debt-fund rules.",
      watchout: "NAV can move because rates and credit spreads move.",
    },
    winner: "Fixed Deposit",
  },
  {
    id: "sip-lumpsum",
    title: "SIP vs Lump Sum",
    left: {
      bestFor: "Monthly earners building a long-term habit.",
      effort: "Low",
      liquidity: "Depends on product",
      name: "SIP",
      risk: "Averages entry timing",
      taxNote: "Each installment can have its own holding period.",
      watchout: "A SIP does not fix a bad product choice.",
    },
    recommendation:
      "Use SIP as the default for beginners. Keep lump sum for surplus cash when your plan and emergency reserve are already in place.",
    right: {
      bestFor: "Large one-time deployable cash with long horizon.",
      effort: "Medium",
      liquidity: "Depends on product",
      name: "Lump Sum",
      risk: "Higher timing risk",
      taxNote: "Holding period usually starts from the investment date.",
      watchout: "A bad entry point can feel emotionally harder to hold.",
    },
    winner: "SIP",
  },
  {
    id: "gold-bonds",
    title: "Gold vs Bonds",
    left: {
      bestFor: "Diversification during stress and inflation fear.",
      effort: "Low",
      liquidity: "High",
      name: "Gold",
      risk: "Medium",
      taxNote: "Tax depends on the format and holding period.",
      watchout: "No regular income and long flat periods are common.",
    },
    recommendation:
      "Use bonds or debt products for planned goals. Keep gold as a diversifier, not a substitute for your safer allocation.",
    right: {
      bestFor: "Stability, cash-flow planning, and nearer goals.",
      effort: "Medium",
      liquidity: "Medium",
      name: "Bonds",
      risk: "Low to medium",
      taxNote: "Interest and capital gains can be taxed differently.",
      watchout: "Quality and duration choices matter a lot.",
    },
    winner: "Bonds",
  },
  {
    id: "reit-property",
    title: "REIT vs Rental Property",
    left: {
      bestFor: "Small-ticket real-estate exposure with liquidity.",
      effort: "Low",
      liquidity: "High",
      name: "REIT",
      risk: "Medium",
      taxNote: "Distributions can have mixed tax treatment.",
      watchout: "Still a market product, not a guaranteed rent cheque.",
    },
    recommendation:
      "Explore REITs first if you want real-estate exposure without property management, large down payments, or concentration risk.",
    right: {
      bestFor: "Investors ready for large capital, loans, and operations.",
      effort: "High",
      liquidity: "Low",
      name: "Rental Property",
      risk: "High concentration",
      taxNote: "Rental income, loan interest, and capital gains all matter.",
      watchout: "Vacancy, maintenance, and legal friction are real work.",
    },
    winner: "REIT",
  },
  {
    id: "index-active",
    title: "Index Fund vs Active Fund",
    left: {
      bestFor: "People who value simplicity, low cost, and broad diversification.",
      effort: "Low",
      liquidity: "High",
      name: "Index Fund",
      risk: "Market-linked",
      taxNote: "Usually follows standard mutual-fund taxation by category.",
      watchout: "You will not outperform the market before costs.",
    },
    recommendation:
      "Index funds are the cleaner default for most beginners. Move to active funds only when you can explain why that manager and style deserve a place.",
    right: {
      bestFor: "Investors willing to track manager quality and style drift.",
      effort: "Medium",
      liquidity: "High",
      name: "Active Fund",
      risk: "Market-linked",
      taxNote: "Tax depends on category, not manager style.",
      watchout: "Higher cost and inconsistency across cycles matter.",
    },
    winner: "Index Fund",
  },
  {
    id: "liquid-savings",
    title: "Liquid Fund vs Savings Account",
    left: {
      bestFor: "Idle cash that may still need quick access.",
      effort: "Low",
      liquidity: "High",
      name: "Liquid Fund",
      risk: "Low",
      taxNote: "Tax depends on current debt-fund treatment.",
      watchout: "Not a guaranteed bank balance substitute.",
    },
    recommendation:
      "Keep operating cash in savings, and move true short idle cash to liquid funds only when the extra setup is worth it.",
    right: {
      bestFor: "Daily transactions and absolute simplicity.",
      effort: "Very low",
      liquidity: "Immediate",
      name: "Savings Account",
      risk: "Low",
      taxNote: "Interest may be taxable with limited deductions available.",
      watchout: "Usually weak return after inflation.",
    },
    winner: "Savings Account",
  },
  {
    id: "ppf-nps",
    title: "PPF vs NPS",
    left: {
      bestFor: "Conservative investors who want predictable long-term discipline.",
      effort: "Low",
      liquidity: "Low",
      name: "PPF",
      risk: "Low",
      taxNote: "Often chosen for tax-efficient long-term compounding.",
      watchout: "Long lock-in means flexibility is limited.",
    },
    recommendation:
      "Choose PPF when capital safety and simplicity matter more. Choose NPS when retirement-only structure and market exposure are part of the plan.",
    right: {
      bestFor: "Retirement builders comfortable with structured lock-ins and market exposure.",
      effort: "Medium",
      liquidity: "Low",
      name: "NPS",
      risk: "Medium",
      taxNote: "Tax treatment and exit structure need to be understood upfront.",
      watchout: "You should not enter NPS without being comfortable with retirement-use constraints.",
    },
    winner: "Depends on goal",
  },
  {
    id: "index-small-cap",
    title: "Index Fund vs Small-Cap Fund",
    left: {
      bestFor: "Beginners who want broad-market discipline and lower decision fatigue.",
      effort: "Low",
      liquidity: "High",
      name: "Index Fund",
      risk: "Medium",
      taxNote: "Tax usually follows standard equity-fund rules.",
      watchout: "You will broadly match the market instead of chasing a hotter segment.",
    },
    recommendation:
      "Use index funds as the base layer first. Add small-cap exposure only after your core plan is stable and you can handle deeper volatility.",
    right: {
      bestFor: "Aggressive investors with long horizons and strong drawdown tolerance.",
      effort: "Medium",
      liquidity: "High",
      name: "Small-Cap Fund",
      risk: "High",
      taxNote: "Usually taxed under equity-fund rules, but check the current category rules.",
      watchout: "Return expectations often tempt investors to over-allocate.",
    },
    winner: "Index Fund",
  },
];

const comparisonSelectionLibrary = comparisonLibrary.map((item) => ({
  id: item.id,
  leftName: item.left.name,
  rightName: item.right.name,
  title: item.title,
}));

export function Academy() {
  const [selectedComparisonId, setSelectedComparisonId] = useState(comparisonLibrary[0].id);
  const activeComparison =
    comparisonLibrary.find((comparison) => comparison.id === selectedComparisonId) ??
    comparisonLibrary[0];
  const categoryGroups = useMemo(
    () => ({
      core: categoryLibrary.filter((item) =>
        ["Index Funds", "Equity Mutual Funds", "ETFs", "Hybrid Funds", "International Funds"].includes(item.name),
      ),
      diversifiers: categoryLibrary.filter((item) =>
        ["Gold", "Sovereign Gold Bonds", "REITs"].includes(item.name),
      ),
      stability: categoryLibrary.filter((item) =>
        ["Debt Funds", "Fixed Deposits", "Liquid Funds", "Bonds", "PPF", "NPS"].includes(item.name),
      ),
      advanced: categoryLibrary.filter((item) =>
        ["Direct Stocks", "Small-Cap Funds"].includes(item.name),
      ),
    }),
    [],
  );

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Investment Academy</CardTitle>
          <CardDescription>
            Learn more categories, when they fit, when they do not, and what beginners should notice before investing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <AcademyIntroCard
            icon={<BookOpen className="h-4 w-4 text-primary" />}
            title="Build category clarity"
            text="A product can be good and still be wrong for your goal timing, risk capacity, or learning stage."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Know the downside shape"
            text="Beginners usually need fewer products and better role clarity, not more excitement."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Compare with purpose"
            text="Use the comparator to choose between prebuilt beginner decisions like ETF vs mutual fund or FD vs debt fund."
          />
          <AcademyIntroCard
            icon={<Landmark className="h-4 w-4 text-primary" />}
            title="Use the right bucket"
            text="Some categories are for growth, some are for safety, and some exist mainly to diversify a bigger plan."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beginner Navigation Map</CardTitle>
          <CardDescription>
            A simple way to decide where to look first instead of jumping into every category at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <AcademyIntroCard
            icon={<Compass className="h-4 w-4 text-primary" />}
            title="Start here"
            text="Emergency money, SIP habit, and a core diversified growth category usually come before tactical products."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Add safety next"
            text="Fixed income buckets like FDs, debt funds, bonds, PPF, or liquid funds support shorter goals and emotional stability."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Layer complexity later"
            text="Small-cap funds, direct stocks, REITs, and international exposure work better after the core plan already makes sense."
          />
        </CardContent>
      </Card>

      <CategorySection
        title="Core Growth Categories"
        description="Usually the main compounding engine for long-term goals."
        categories={categoryGroups.core}
      />
      <CategorySection
        title="Stability and Cash Buckets"
        description="Useful for emergency reserves, short goals, and lower-volatility allocations."
        categories={categoryGroups.stability}
      />
      <CategorySection
        title="Diversifiers"
        description="Supporting allocations that can improve balance, not replace the core plan."
        categories={categoryGroups.diversifiers}
      />
      <CategorySection
        title="Advanced or Concentrated Choices"
        description="Better after you have a stable core and can explain the risk you are taking."
        categories={categoryGroups.advanced}
      />

      <Card>
        <CardHeader>
          <CardTitle>Investment Comparator</CardTitle>
          <CardDescription>
            Compare only prebuilt beginner decisions. You select one preset comparison and the app fills both sides for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SplitSquareVertical className="h-4 w-4 text-primary" />
              Select a preset comparison
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">What vs what</span>
                <select
                  value={selectedComparisonId}
                  onChange={(event) => setSelectedComparisonId(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {comparisonSelectionLibrary.map((comparison) => (
                    <option key={comparison.id} value={comparison.id}>
                      {comparison.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hidden items-center justify-center text-xs font-semibold text-muted-foreground md:flex">
                VS
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Left side</p>
                  <p className="font-medium">{activeComparison.left.name}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Right side</p>
                  <p className="font-medium">{activeComparison.right.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-sm font-medium">{activeComparison.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only preset comparisons are available here so the guidance stays structured and relevant for beginners.
            </p>
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
              <Badge variant="secondary">Default pick</Badge>
              <span className="text-sm font-medium">{activeComparison.winner}</span>
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

function AcademyIntroCard({
  icon,
  text,
  title,
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50">
          {icon}
        </div>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function CategorySection({
  categories,
  description,
  title,
}: {
  categories: AcademyCategory[];
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category.name} className="rounded-md border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{category.name}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{category.risk}</Badge>
                <Badge variant="outline">{category.returnStyle}</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">{category.bestFor}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {category.beginnerNote}
            </p>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <span>Horizon: {category.horizon}</span>
              <span>Liquidity: {category.liquidity}</span>
              <span className="md:col-span-2">Not ideal when: {category.whenNotIdeal}</span>
            </div>
            <div className="mt-4 grid gap-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                Key watchouts
              </p>
              {category.keyWatchouts.map((watchout) => (
                <p key={watchout} className="text-xs text-muted-foreground">
                  {watchout}
                </p>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ComparisonOption({ option }: { option: ComparisonOptionData }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{option.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{option.bestFor}</p>
        </div>
        <Badge variant="outline">{option.risk}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <span>Effort: {option.effort}</span>
        <span>Liquidity: {option.liquidity}</span>
        <span>Tax awareness: {option.taxNote}</span>
        <span>Watchout: {option.watchout}</span>
      </div>
    </div>
  );
}
