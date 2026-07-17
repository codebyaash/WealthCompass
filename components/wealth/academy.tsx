"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  BookOpen,
  Compass,
  Landmark,
  LineChart,
  Search,
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
  effort: string;
  horizon: string;
  id: string;
  keyWatchouts: string[];
  liquidity: string;
  name: string;
  notFor: string;
  productRole: string;
  returnStyle: string;
  risk: string;
  taxHint: string;
};

type CategoryGroup = {
  categories: AcademyCategory[];
  description: string;
  title: string;
};

const categoryLibrary: AcademyCategory[] = [
  {
    id: "index-funds",
    name: "Index Funds",
    bestFor: "Core long-term wealth building",
    beginnerNote:
      "A strong default because you buy a broad market basket instead of guessing which manager or stock will win next.",
    effort: "Low",
    horizon: "5+ years",
    keyWatchouts: ["Market falls still happen", "Staying invested matters more than timing"],
    liquidity: "High",
    notFor: "Money needed in the next 1 to 3 years.",
    productRole: "Core growth engine",
    returnStyle: "Market-linked growth",
    risk: "Medium",
    taxHint: "Usually follows standard equity-fund taxation when equity-oriented.",
  },
  {
    id: "large-cap-funds",
    name: "Large-Cap Funds",
    bestFor: "Investors who want equity exposure with relatively steadier businesses",
    beginnerNote:
      "Often easier to hold emotionally than smaller-cap products because the underlying companies are larger and usually more familiar.",
    effort: "Low to medium",
    horizon: "5+ years",
    keyWatchouts: ["Can still fall sharply in bear markets", "Some active funds may not justify their fee"],
    liquidity: "High",
    notFor: "Short-term capital parking.",
    productRole: "Core or near-core equity bucket",
    returnStyle: "Market-linked growth",
    risk: "Medium",
    taxHint: "Usually follows equity-fund taxation when categorized as equity.",
  },
  {
    id: "flexi-cap-funds",
    name: "Flexi-Cap Funds",
    bestFor: "Investors who want one active fund with room to move across market caps",
    beginnerNote:
      "Useful when you want manager-led flexibility, but you should still know why you picked active over a simple index base.",
    effort: "Medium",
    horizon: "5+ years",
    keyWatchouts: ["Manager quality matters", "Style drift can change what you actually own"],
    liquidity: "High",
    notFor: "People who want a fully rules-based product with little manager dependence.",
    productRole: "Satellite or blended core",
    returnStyle: "Manager-led market growth",
    risk: "Medium to high",
    taxHint: "Usually follows equity-fund taxation when equity-oriented.",
  },
  {
    id: "equity-mutual-funds",
    name: "Equity Mutual Funds",
    bestFor: "Hands-off equity exposure with SIP-friendly investing",
    beginnerNote:
      "Good for recurring investing, but the category label alone is not enough. Cost, style, and consistency still matter.",
    effort: "Medium",
    horizon: "5+ years",
    keyWatchouts: ["Expense ratios matter", "Too many overlapping funds create clutter"],
    liquidity: "High",
    notFor: "People who have not yet learned basic category differences.",
    productRole: "Broad equity wrapper",
    returnStyle: "Market-linked growth",
    risk: "Medium to high",
    taxHint: "Tax depends on whether the fund is equity, debt, or hybrid.",
  },
  {
    id: "etfs",
    name: "ETFs",
    bestFor: "Low-cost investors comfortable using a demat account",
    beginnerNote:
      "Efficient and flexible, but they work best when you understand order placement, spreads, and exchange trading basics.",
    effort: "Medium",
    horizon: "3+ years",
    keyWatchouts: ["Need a demat account", "Intraday price can differ from NAV"],
    liquidity: "Market hours",
    notFor: "Beginners who still want the simplest SIP experience.",
    productRole: "Low-cost market access",
    returnStyle: "Market-linked growth",
    risk: "Medium",
    taxHint: "Tax treatment usually follows the underlying asset class.",
  },
  {
    id: "international-funds",
    name: "International Funds",
    bestFor: "Global diversification beyond domestic equity",
    beginnerNote:
      "Helpful when you do not want your whole equity story tied to one market, currency, and policy cycle.",
    effort: "Medium",
    horizon: "5+ years",
    keyWatchouts: ["Currency can help or hurt", "Availability and taxation can change"],
    liquidity: "High",
    notFor: "Investors whose domestic core is still unsettled.",
    productRole: "Diversifying equity layer",
    returnStyle: "Global market-linked growth",
    risk: "Medium to high",
    taxHint: "Tax rules can differ from domestic equity categories depending on structure.",
  },
  {
    id: "small-cap-funds",
    name: "Small-Cap Funds",
    bestFor: "Aggressive long-horizon growth seekers",
    beginnerNote:
      "These can deliver exciting long-term outcomes, but they also test conviction much harder during deep drawdowns.",
    effort: "Medium",
    horizon: "7+ years",
    keyWatchouts: ["High volatility", "Can underperform for long stretches"],
    liquidity: "High",
    notFor: "A beginner's first and only equity allocation.",
    productRole: "Aggressive satellite allocation",
    returnStyle: "High growth with sharper cycles",
    risk: "High",
    taxHint: "Usually follows equity-fund taxation, but category rules still matter.",
  },
  {
    id: "hybrid-funds",
    name: "Hybrid Funds",
    bestFor: "Investors who want one product blending debt and equity",
    beginnerNote:
      "Convenient for simplicity, but the actual mix can vary a lot, so you still need to know what blend you bought.",
    effort: "Low to medium",
    horizon: "3+ years",
    keyWatchouts: ["Mix differs a lot across funds", "Simple label can hide meaningful risk"],
    liquidity: "High",
    notFor: "People who want precise control over debt and equity separately.",
    productRole: "Blended all-in-one allocation",
    returnStyle: "Mix of growth and stability",
    risk: "Low to medium",
    taxHint: "Tax depends on the fund's underlying classification.",
  },
  {
    id: "debt-funds",
    name: "Debt Funds",
    bestFor: "Short-to-medium term goals and portfolio stability",
    beginnerNote:
      "Useful for planned capital buckets, but they are not the same thing as guaranteed deposits and can still move with rates and credit spreads.",
    effort: "Medium",
    horizon: "1 to 3 years",
    keyWatchouts: ["Interest-rate risk exists", "Credit quality matters a lot"],
    liquidity: "Medium to high",
    notFor: "Investors expecting FD-like certainty with no NAV movement.",
    productRole: "Stability and planned cash bucket",
    returnStyle: "Income plus modest price movement",
    risk: "Low to medium",
    taxHint: "Debt-fund tax treatment should be checked against current rules.",
  },
  {
    id: "liquid-funds",
    name: "Liquid Funds",
    bestFor: "Emergency reserve parking and short idle cash",
    beginnerNote:
      "These are helpful for cash management, but they are still investment products rather than current-account substitutes.",
    effort: "Low",
    horizon: "Days to 12 months",
    keyWatchouts: ["Return advantage may be modest", "Not a long-term growth engine"],
    liquidity: "High",
    notFor: "Long-term goals where inflation is the main problem.",
    productRole: "Cash management bucket",
    returnStyle: "Low-volatility income",
    risk: "Low",
    taxHint: "Tax usually follows current debt-fund treatment.",
  },
  {
    id: "fixed-deposits",
    name: "Fixed Deposits",
    bestFor: "Capital protection and planned near-term cash use",
    beginnerNote:
      "Predictable, familiar, and emotionally easy to understand, which makes them useful for safety buckets and scheduled expenses.",
    effort: "Very low",
    horizon: "Months to 3 years",
    keyWatchouts: ["Inflation can erode real return", "Premature withdrawal may reduce yield"],
    liquidity: "Medium",
    notFor: "Long-term wealth compounding after tax and inflation.",
    productRole: "Capital preservation bucket",
    returnStyle: "Fixed interest",
    risk: "Low",
    taxHint: "Interest is usually taxed as income.",
  },
  {
    id: "bonds",
    name: "Bonds",
    bestFor: "Income planning and conservative allocations",
    beginnerNote:
      "Bonds can improve stability, but duration, issuer quality, and liquidity are what decide whether they help or surprise you.",
    effort: "Medium",
    horizon: "2 to 5 years",
    keyWatchouts: ["Issuer quality matters", "Longer duration reacts more to rates"],
    liquidity: "Medium",
    notFor: "People who have not yet learned basic interest-rate risk.",
    productRole: "Income and stability layer",
    returnStyle: "Coupon income plus price movement",
    risk: "Low to medium",
    taxHint: "Interest and capital gains can be taxed differently.",
  },
  {
    id: "ppf",
    name: "PPF",
    bestFor: "Tax-aware long-horizon conservative compounding",
    beginnerNote:
      "Slow and steady is the whole point here. It fits when safety and disciplined long-term accumulation matter more than flexibility.",
    effort: "Low",
    horizon: "15 years+",
    keyWatchouts: ["Long lock-in", "Not a flexible bucket for changing goals"],
    liquidity: "Low",
    notFor: "Goals that may need access well before the long lock-in period ends.",
    productRole: "Long-horizon safe compounding bucket",
    returnStyle: "Government-backed fixed return",
    risk: "Low",
    taxHint: "Often chosen for tax-efficient conservative compounding.",
  },
  {
    id: "nps",
    name: "NPS",
    bestFor: "Retirement-focused disciplined investing",
    beginnerNote:
      "Works best when you intentionally want a retirement-only bucket instead of a general-purpose wealth account.",
    effort: "Medium",
    horizon: "10 years+",
    keyWatchouts: ["Exit rules matter", "Underlying option choice still matters"],
    liquidity: "Low",
    notFor: "General wealth goals where flexibility matters more than structure.",
    productRole: "Retirement-dedicated bucket",
    returnStyle: "Market-linked retirement compounding",
    risk: "Medium",
    taxHint: "Exit and tax structure should be understood before you commit.",
  },
  {
    id: "gold",
    name: "Gold",
    bestFor: "Diversification and stress-period ballast",
    beginnerNote:
      "Gold is usually a supporting actor rather than the main compounding engine in a well-built beginner portfolio.",
    effort: "Low",
    horizon: "3+ years",
    keyWatchouts: ["Can go through long flat periods", "No cash flow on its own"],
    liquidity: "High",
    notFor: "The largest allocation in a beginner portfolio.",
    productRole: "Diversifier",
    returnStyle: "Price appreciation without income",
    risk: "Medium",
    taxHint: "Tax depends on whether you hold it as ETF, physical gold, or another format.",
  },
  {
    id: "sovereign-gold-bonds",
    name: "Sovereign Gold Bonds",
    bestFor: "Gold exposure with a long holding mindset",
    beginnerNote:
      "Often better than physical gold for long-term holders if you understand the time horizon and market-price behavior.",
    effort: "Medium",
    horizon: "5+ years",
    keyWatchouts: ["Long lock-in mindset needed", "Market price can still swing"],
    liquidity: "Medium",
    notFor: "Emergency money or short tactical positioning.",
    productRole: "Long-horizon gold diversifier",
    returnStyle: "Gold-linked plus fixed coupon",
    risk: "Medium",
    taxHint: "Tax treatment differs from many plain gold formats, so check current rules.",
  },
  {
    id: "reits",
    name: "REITs",
    bestFor: "Income-oriented real-estate exposure without property operations",
    beginnerNote:
      "A cleaner starting point than physical property when you want listed real-estate exposure without giant ticket sizes.",
    effort: "Medium",
    horizon: "5+ years",
    keyWatchouts: ["Interest-rate sensitivity", "Concentration if overused"],
    liquidity: "High",
    notFor: "Investors who already have too much real-estate concentration elsewhere.",
    productRole: "Yielding diversifier",
    returnStyle: "Yield plus market movement",
    risk: "Medium",
    taxHint: "Distributions can have mixed tax treatment.",
  },
  {
    id: "direct-stocks",
    name: "Direct Stocks",
    bestFor: "Research-driven investors who can follow businesses over time",
    beginnerNote:
      "Direct stocks can be rewarding and educational, but they belong much later than a simple diversified core for most beginners.",
    effort: "High",
    horizon: "7+ years",
    keyWatchouts: ["High concentration risk", "Behavior mistakes can hurt more than analysis mistakes"],
    liquidity: "High",
    notFor: "A first and only investment category.",
    productRole: "High-conviction satellite allocation",
    returnStyle: "High upside with high variability",
    risk: "High",
    taxHint: "Tax depends on holding period and transaction type.",
  },
  {
    id: "savings-account",
    name: "Savings Account",
    bestFor: "Operating cash and immediate access money",
    beginnerNote:
      "This is the simplest home for money that actually needs daily accessibility rather than investment returns.",
    effort: "Very low",
    horizon: "Immediate to short term",
    keyWatchouts: ["Weak return after inflation", "Idle balances can quietly pile up with no plan"],
    liquidity: "Immediate",
    notFor: "Long-term cash that could sit in a more intentional bucket.",
    productRole: "Operating cash",
    returnStyle: "Low bank interest",
    risk: "Low",
    taxHint: "Interest may be taxable, with limited deductions available.",
  },
  {
    id: "rental-property",
    name: "Rental Property",
    bestFor: "Investors ready for large capital, loans, and active ownership",
    beginnerNote:
      "This can be productive wealth, but it is a business-like asset with maintenance, legal, vacancy, and concentration realities.",
    effort: "High",
    horizon: "7+ years",
    keyWatchouts: ["Vacancy and maintenance are real work", "Concentration risk is high"],
    liquidity: "Low",
    notFor: "Investors who want small-ticket diversification and flexibility.",
    productRole: "Concentrated real-asset allocation",
    returnStyle: "Rent plus property appreciation",
    risk: "Medium to high",
    taxHint: "Rental income, borrowing costs, and capital gains all matter.",
  },
];

const categoryGroups: CategoryGroup[] = [
  {
    title: "Core Growth Categories",
    description: "Usually the main compounding engines for long-horizon goals.",
    categories: categoryLibrary.filter((item) =>
      [
        "index-funds",
        "large-cap-funds",
        "flexi-cap-funds",
        "equity-mutual-funds",
        "etfs",
        "international-funds",
      ].includes(item.id),
    ),
  },
  {
    title: "Stability and Cash Buckets",
    description: "Useful for emergency reserves, short goals, and lower-volatility planning.",
    categories: categoryLibrary.filter((item) =>
      ["debt-funds", "liquid-funds", "fixed-deposits", "bonds", "ppf", "nps", "savings-account"].includes(
        item.id,
      ),
    ),
  },
  {
    title: "Diversifiers",
    description: "Supporting allocations that can improve balance without replacing the core plan.",
    categories: categoryLibrary.filter((item) =>
      ["gold", "sovereign-gold-bonds", "reits"].includes(item.id),
    ),
  },
  {
    title: "Advanced or Concentrated Choices",
    description: "Better after the core plan is stable and you can explain the extra risk.",
    categories: categoryLibrary.filter((item) =>
      ["small-cap-funds", "direct-stocks", "rental-property"].includes(item.id),
    ),
  },
];

const quickComparePairs = [
  ["index-funds", "equity-mutual-funds"],
  ["etfs", "equity-mutual-funds"],
  ["fixed-deposits", "debt-funds"],
  ["liquid-funds", "savings-account"],
  ["gold", "bonds"],
  ["ppf", "nps"],
  ["reits", "rental-property"],
  ["index-funds", "small-cap-funds"],
] as const;

export function Academy() {
  const [searchQuery, setSearchQuery] = useState("");
  const [leftCategoryId, setLeftCategoryId] = useState("index-funds");
  const [rightCategoryId, setRightCategoryId] = useState("equity-mutual-funds");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) {
      return categoryGroups;
    }

    return categoryGroups
      .map((group) => ({
        ...group,
        categories: group.categories.filter((category) =>
          [
            category.name,
            category.bestFor,
            category.beginnerNote,
            category.productRole,
            category.returnStyle,
            category.risk,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.categories.length > 0);
  }, [normalizedQuery]);

  const comparisonOptions = useMemo(
    () => categoryLibrary.map((item) => ({ id: item.id, label: item.name })),
    [],
  );

  const leftCategory =
    categoryLibrary.find((item) => item.id === leftCategoryId) ?? categoryLibrary[0];
  const rightCategory =
    categoryLibrary.find((item) => item.id === rightCategoryId) ?? categoryLibrary[1];
  const comparisonSummary = buildComparisonSummary(leftCategory, rightCategory);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Investment Academy</CardTitle>
          <CardDescription>
            Learn the main beginner categories, the job each one plays, when it fits, and where it can quietly go wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AcademyIntroCard
            icon={<BookOpen className="h-4 w-4 text-primary" />}
            title="Build category clarity"
            text="A product can be good and still be wrong for your goal timing, risk capacity, or learning stage."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Understand role first"
            text="Beginners usually need clearer bucket roles and cleaner defaults, not more products."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Compare intentionally"
            text="Pick any two categories and compare them directly instead of relying on a fixed preset list."
          />
          <AcademyIntroCard
            icon={<Landmark className="h-4 w-4 text-primary" />}
            title="Avoid role confusion"
            text="Growth, safety, liquidity, and diversification are different jobs. Mixing them causes bad product decisions."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beginner Navigation Map</CardTitle>
          <CardDescription>
            A simpler order of operations before you wander into every product rabbit hole.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <AcademyIntroCard
            icon={<Compass className="h-4 w-4 text-primary" />}
            title="Start with a core"
            text="Emergency money, a basic SIP habit, and one diversified long-term growth category usually come first."
          />
          <AcademyIntroCard
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Add safety on purpose"
            text="FDs, debt funds, liquid funds, bonds, PPF, and savings buckets solve stability and timing problems."
          />
          <AcademyIntroCard
            icon={<LineChart className="h-4 w-4 text-primary" />}
            title="Layer complexity later"
            text="Small-cap funds, direct stocks, REITs, property, and global sleeves work better after the core already makes sense."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Finder</CardTitle>
          <CardDescription>
            Search by product name, role, or beginner use case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Search categories</span>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Index funds, retirement, short-term goals, diversification..."
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
        </CardContent>
      </Card>

      {filteredGroups.map((group) => (
        <CategorySection
          key={group.title}
          title={group.title}
          description={group.description}
          categories={group.categories}
        />
      ))}

      {!filteredGroups.length ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            No academy categories matched that search yet. Try a product name, a goal type, or a role like growth, safety, or liquidity.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Investment Comparator</CardTitle>
          <CardDescription>
            Choose any two categories and compare them directly. You are no longer limited to only prebuilt pairs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SplitSquareVertical className="h-4 w-4 text-primary" />
              Compare what vs what
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Left side</span>
                <select
                  value={leftCategoryId}
                  onChange={(event) => setLeftCategoryId(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {comparisonOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hidden items-center justify-center text-xs font-semibold text-muted-foreground md:flex">
                VS
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Right side</span>
                <select
                  value={rightCategoryId}
                  onChange={(event) => setRightCategoryId(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {comparisonOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickComparePairs.map(([leftId, rightId]) => {
                const left = categoryLibrary.find((item) => item.id === leftId);
                const right = categoryLibrary.find((item) => item.id === rightId);

                if (!left || !right) return null;

                return (
                  <button
                    key={`${leftId}-${rightId}`}
                    type="button"
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      setLeftCategoryId(leftId);
                      setRightCategoryId(rightId);
                    }}
                  >
                    {left.name} vs {right.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <ComparisonOption option={leftCategory} emphasis={comparisonSummary.leftEdge} />
            <div className="flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold">
                VS
              </div>
            </div>
            <ComparisonOption option={rightCategory} emphasis={comparisonSummary.rightEdge} />
          </div>

          <div className="rounded-md border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Beginner read</Badge>
              <span className="text-sm font-medium">{comparisonSummary.defaultPick}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {comparisonSummary.recommendation}
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
          <div key={category.id} className="rounded-md border bg-background p-4">
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
              <span>Role: {category.productRole}</span>
              <span>Effort: {category.effort}</span>
              <span>Horizon: {category.horizon}</span>
              <span>Liquidity: {category.liquidity}</span>
              <span className="md:col-span-2">Tax note: {category.taxHint}</span>
              <span className="md:col-span-2">Not ideal when: {category.notFor}</span>
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

function ComparisonOption({
  option,
  emphasis,
}: {
  option: AcademyCategory;
  emphasis: string;
}) {
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
        <span>Role: {option.productRole}</span>
        <span>Effort: {option.effort}</span>
        <span>Liquidity: {option.liquidity}</span>
        <span>Horizon: {option.horizon}</span>
        <span>Tax note: {option.taxHint}</span>
        <span>Watchout: {option.keyWatchouts[0]}</span>
      </div>
      <div className="mt-4 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground">
          Beginner edge
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{emphasis}</p>
      </div>
    </div>
  );
}

function buildComparisonSummary(left: AcademyCategory, right: AcademyCategory) {
  if (left.id === right.id) {
    return {
      defaultPick: "Same category selected",
      leftEdge: `${left.name} is being compared with itself, so the main job is to decide whether this category belongs in your plan at all.`,
      recommendation:
        `You selected ${left.name} on both sides. Use this view as a category audit: confirm the goal, time horizon, risk, and product role before you invest.`,
      rightEdge: `${right.name} fits the exact same role here, so the better question becomes whether you need this category or a different bucket entirely.`,
    };
  }

  const liquidityRank = scoreLiquidity(left.liquidity) - scoreLiquidity(right.liquidity);
  const effortRank = scoreEffort(left.effort) - scoreEffort(right.effort);
  const riskRank = scoreRisk(left.risk) - scoreRisk(right.risk);

  let defaultPick = "Depends on goal";
  let recommendation = `${left.name} and ${right.name} solve different jobs. Choose based on the bucket you are trying to build, not which label sounds stronger.`;

  if (left.productRole === right.productRole) {
    defaultPick =
      effortRank <= 0 && riskRank <= 0
        ? left.name
        : effortRank > 0 && riskRank >= 0
          ? right.name
          : "Depends on goal";
    recommendation =
      defaultPick === "Depends on goal"
        ? `${left.name} and ${right.name} play similar roles, so the decision comes down to how much complexity, volatility, and manager dependence you want to accept.`
        : `For most beginners, ${defaultPick} is the cleaner starting point because it asks less of you while still doing the same broad job.`;
  } else if (liquidityRank > 0) {
    defaultPick = right.name;
    recommendation = `If liquidity and access matter more right now, ${right.name} is the easier fit. If the real goal is long-horizon compounding or diversification, ${left.name} may still belong in a different bucket.`;
  } else if (liquidityRank < 0) {
    defaultPick = left.name;
    recommendation = `If liquidity and access matter more right now, ${left.name} is the easier fit. If the real goal is long-horizon compounding or diversification, ${right.name} may still belong in a different bucket.`;
  }

  return {
    defaultPick,
    leftEdge: `${left.name} stands out when you need ${left.productRole.toLowerCase()} with ${left.effort.toLowerCase()} effort and ${left.horizon.toLowerCase()} commitment.`,
    recommendation,
    rightEdge: `${right.name} stands out when you need ${right.productRole.toLowerCase()} with ${right.effort.toLowerCase()} effort and ${right.horizon.toLowerCase()} commitment.`,
  };
}

function scoreLiquidity(liquidity: string) {
  const value = liquidity.toLowerCase();

  if (value.includes("immediate")) return 5;
  if (value.includes("high")) return 4;
  if (value.includes("market hours")) return 3;
  if (value.includes("medium")) return 2;
  return 1;
}

function scoreEffort(effort: string) {
  const value = effort.toLowerCase();

  if (value.includes("very low")) return 1;
  if (value.includes("low")) return 2;
  if (value.includes("medium")) return 3;
  return 4;
}

function scoreRisk(risk: string) {
  const value = risk.toLowerCase();

  if (value.includes("low") && !value.includes("medium")) return 1;
  if (value.includes("low to medium")) return 2;
  if (value.includes("medium")) return 3;
  if (value.includes("medium to high")) return 4;
  return 5;
}
