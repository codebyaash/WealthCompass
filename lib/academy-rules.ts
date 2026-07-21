export type AcademyCategory = {
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

export type CategoryGroup = {
  categories: AcademyCategory[];
  description: string;
  title: string;
};

export type AcademyUseCase = {
  id: string;
  categoryIds: string[];
  description: string;
  title: string;
};

import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type AcademyTrackPlan = {
  categoryIds: string[];
  description: string;
  id: "understand" | "rehearse" | "activate";
  title: string;
  useCaseIds: string[];
};

export const categoryLibrary: AcademyCategory[] = [
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
    id: "elss-funds",
    name: "ELSS Funds",
    bestFor: "Tax-saving investors who can accept equity risk and lock-in",
    beginnerNote:
      "Useful only when the tax break and 3-year lock-in actually fit your plan. It should not replace learning what fund you own.",
    effort: "Medium",
    horizon: "3+ years",
    keyWatchouts: ["Tax benefit should not override suitability", "Lock-in can feel painful if chosen casually"],
    liquidity: "Low",
    notFor: "Money that may be needed before the lock-in ends.",
    productRole: "Tax-saving equity bucket",
    returnStyle: "Market-linked growth",
    risk: "Medium to high",
    taxHint: "Chosen mainly for tax-saving under the current eligible framework.",
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
    id: "balanced-advantage-funds",
    name: "Balanced Advantage Funds",
    bestFor: "Investors who want a smoother ride than full-equity exposure",
    beginnerNote:
      "These can reduce behavioral stress, but the dynamic allocation logic is still a strategy bet that you should understand.",
    effort: "Low to medium",
    horizon: "3+ years",
    keyWatchouts: ["Allocation shifts are manager- and model-driven", "Lower stress does not mean no downside"],
    liquidity: "High",
    notFor: "People who want transparent fixed allocation rules.",
    productRole: "Managed volatility allocation",
    returnStyle: "Moderated growth",
    risk: "Low to medium",
    taxHint: "Tax treatment depends on current classification and structure.",
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
    id: "corporate-bond-funds",
    name: "Corporate Bond Funds",
    bestFor: "Investors who want a more defined higher-quality debt sleeve",
    beginnerNote:
      "These can be cleaner than broad debt buckets when you want a narrower credit profile, but duration and rate sensitivity still matter.",
    effort: "Medium",
    horizon: "2 to 4 years",
    keyWatchouts: ["Still sensitive to rate moves", "Not a replacement for instant-access money"],
    liquidity: "Medium to high",
    notFor: "Emergency funds that need daily certainty.",
    productRole: "Higher-quality debt sleeve",
    returnStyle: "Income plus duration movement",
    risk: "Low to medium",
    taxHint: "Tax usually follows current debt-fund treatment.",
  },
  {
    id: "target-maturity-funds",
    name: "Target Maturity Funds",
    bestFor: "Goal-based debt investors matching cash flow timing to a maturity year",
    beginnerNote:
      "Most useful when you know when the money is needed and want a clearer maturity path than an open-ended debt sleeve.",
    effort: "Medium",
    horizon: "2 to 10 years",
    keyWatchouts: ["Works best when maturity matches the goal date", "Interim price swings can still happen"],
    liquidity: "Market hours",
    notFor: "Cash buckets that need flexible withdrawals at any time.",
    productRole: "Time-matched debt planning",
    returnStyle: "Yield carry with maturity alignment",
    risk: "Low to medium",
    taxHint: "Tax treatment should be checked against current bond-fund rules.",
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
    id: "overnight-funds",
    name: "Overnight Funds",
    bestFor: "Very short-term cash parking with minimal duration risk",
    beginnerNote:
      "A narrow but useful category when the job is simply to hold money briefly with less rate sensitivity than broader debt buckets.",
    effort: "Low",
    horizon: "Days to a few months",
    keyWatchouts: ["Not built for meaningful long-term growth", "Can be overused when a savings or liquid bucket is enough"],
    liquidity: "High",
    notFor: "Long-horizon savings goals.",
    productRole: "Ultra-short cash parking",
    returnStyle: "Very low-volatility income",
    risk: "Low",
    taxHint: "Tax generally follows current debt-fund treatment.",
  },
  {
    id: "arbitrage-funds",
    name: "Arbitrage Funds",
    bestFor: "Short-term parking when you want a low-volatility market-linked wrapper",
    beginnerNote:
      "These are often chosen for tax reasons or parking money, but the category is still strategy-driven and not a universal cash substitute.",
    effort: "Medium",
    horizon: "6 to 18 months",
    keyWatchouts: ["Return can be modest and inconsistent", "Works differently from plain debt or savings products"],
    liquidity: "High",
    notFor: "Anyone who wants the simplest possible emergency cash bucket.",
    productRole: "Tax-aware short-term parking",
    returnStyle: "Spread-capture with low volatility",
    risk: "Low",
    taxHint: "Often selected because tax treatment may differ from debt buckets under current rules.",
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

export const categoryGroups: CategoryGroup[] = [
  {
    title: "Core Growth Categories",
    description: "Usually the main compounding engines for long-horizon goals.",
    categories: pickCategories([
      "index-funds",
      "large-cap-funds",
      "flexi-cap-funds",
      "equity-mutual-funds",
      "etfs",
      "international-funds",
      "elss-funds",
    ]),
  },
  {
    title: "Stability and Cash Buckets",
    description: "Useful for emergency reserves, short goals, and lower-volatility planning.",
    categories: pickCategories([
      "debt-funds",
      "corporate-bond-funds",
      "target-maturity-funds",
      "liquid-funds",
      "overnight-funds",
      "arbitrage-funds",
      "fixed-deposits",
      "bonds",
      "ppf",
      "nps",
      "savings-account",
    ]),
  },
  {
    title: "Diversifiers",
    description: "Supporting allocations that can improve balance without replacing the core plan.",
    categories: pickCategories(["hybrid-funds", "balanced-advantage-funds", "gold", "sovereign-gold-bonds", "reits"]),
  },
  {
    title: "Advanced or Concentrated Choices",
    description: "Better after the core plan is stable and you can explain the extra risk.",
    categories: pickCategories(["small-cap-funds", "direct-stocks", "rental-property"]),
  },
];

export const academyUseCases: AcademyUseCase[] = [
  {
    id: "first-long-term-sip",
    title: "First long-term SIP",
    description: "Start with broad products that are easy to hold, easy to explain, and hard to overcomplicate.",
    categoryIds: ["index-funds", "large-cap-funds", "hybrid-funds"],
  },
  {
    id: "emergency-and-short-term",
    title: "Emergency and short-term money",
    description: "Protect accessibility first. Growth is a lower priority than timing certainty here.",
    categoryIds: ["savings-account", "liquid-funds", "overnight-funds", "fixed-deposits"],
  },
  {
    id: "tax-aware-conservative",
    title: "Tax-aware conservative planning",
    description: "Use tax wrappers only when the lock-in and purpose actually match the job.",
    categoryIds: ["ppf", "nps", "elss-funds", "arbitrage-funds"],
  },
  {
    id: "goal-dated-debt",
    title: "Money tied to a known date",
    description: "When the withdrawal year matters, match the bucket to the timetable instead of chasing extra return.",
    categoryIds: ["target-maturity-funds", "corporate-bond-funds", "debt-funds", "fixed-deposits"],
  },
  {
    id: "diversification-layer",
    title: "Portfolio diversification layer",
    description: "These are supporting sleeves, not replacements for a clean core allocation.",
    categoryIds: ["international-funds", "gold", "sovereign-gold-bonds", "reits"],
  },
  {
    id: "high-conviction-satellite",
    title: "Higher-risk satellite ideas",
    description: "Add these only after your core, cash, and goal buckets are already doing their jobs.",
    categoryIds: ["small-cap-funds", "direct-stocks", "rental-property"],
  },
];

export const quickComparePairs = [
  ["index-funds", "equity-mutual-funds"],
  ["etfs", "equity-mutual-funds"],
  ["hybrid-funds", "balanced-advantage-funds"],
  ["fixed-deposits", "debt-funds"],
  ["liquid-funds", "savings-account"],
  ["arbitrage-funds", "liquid-funds"],
  ["target-maturity-funds", "fixed-deposits"],
  ["gold", "bonds"],
  ["ppf", "nps"],
  ["reits", "rental-property"],
  ["index-funds", "small-cap-funds"],
] as const;

export function getAcademyComparisonOptions(excludeId?: string) {
  return categoryLibrary
    .filter((item) => item.id !== excludeId)
    .map((item) => ({ id: item.id, label: item.name }));
}

export function getCategoryById(categoryId: string) {
  return categoryLibrary.find((item) => item.id === categoryId) ?? categoryLibrary[0];
}

export function normalizeComparisonSelection(leftId: string, rightId: string) {
  const left = getCategoryById(leftId);
  const right = getCategoryById(rightId);

  if (left.id !== right.id) {
    return { leftCategory: left, rightCategory: right };
  }

  const fallbackRight = categoryLibrary.find((item) => item.id !== left.id) ?? left;

  return { leftCategory: left, rightCategory: fallbackRight };
}

export function buildComparisonSummary(left: AcademyCategory, right: AcademyCategory) {
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
    defaultPick = left.name;
    recommendation = `If liquidity and access matter more right now, ${left.name} is the easier fit. If the real goal is long-horizon compounding or diversification, ${right.name} may still belong in a different bucket.`;
  } else if (liquidityRank < 0) {
    defaultPick = right.name;
    recommendation = `If liquidity and access matter more right now, ${right.name} is the easier fit. If the real goal is long-horizon compounding or diversification, ${left.name} may still belong in a different bucket.`;
  }

  return {
    defaultPick,
    leftEdge: `${left.name} stands out when you need ${left.productRole.toLowerCase()} with ${left.effort.toLowerCase()} effort and ${left.horizon.toLowerCase()} commitment.`,
    recommendation,
    rightEdge: `${right.name} stands out when you need ${right.productRole.toLowerCase()} with ${right.effort.toLowerCase()} effort and ${right.horizon.toLowerCase()} commitment.`,
  };
}

export function buildAcademyTrackPlans({
  answers,
  profile,
}: {
  answers: RiskAnswers;
  profile: RiskProfile;
}): AcademyTrackPlan[] {
  const needsFoundation = profile.confidence === "Needs foundation";
  const retirementLikeGoal =
    answers.primaryGoal === "retirement" || answers.primaryGoal === "wealth";
  const taxNeedsAttention = answers.taxAwareness === "low";
  const wantsGlobalDiversification = profile.band !== "Conservative";

  const understandUseCases = [
    needsFoundation ? "emergency-and-short-term" : "first-long-term-sip",
    taxNeedsAttention ? "tax-aware-conservative" : "goal-dated-debt",
  ];
  if (wantsGlobalDiversification) {
    understandUseCases.push("diversification-layer");
  }

  const rehearseUseCases = [
    "first-long-term-sip",
    wantsGlobalDiversification ? "diversification-layer" : "goal-dated-debt",
  ];

  const activateUseCases = [
    needsFoundation ? "emergency-and-short-term" : "first-long-term-sip",
    retirementLikeGoal ? "tax-aware-conservative" : "goal-dated-debt",
  ];
  if (profile.band === "Growth") {
    activateUseCases.push("high-conviction-satellite");
  }

  return [
    {
      id: "understand",
      title: "Understand the Plan",
      description:
        "Start with the categories that explain your current plan, so the labels stop feeling abstract.",
      useCaseIds: uniqueIds(understandUseCases),
      categoryIds: collectCategoryIdsFromUseCases(understandUseCases),
    },
    {
      id: "rehearse",
      title: "Build Investing Reps",
      description:
        "Practice comparing similar-looking products so you can tell role, risk, and effort apart before money is on the line.",
      useCaseIds: uniqueIds(rehearseUseCases),
      categoryIds: collectCategoryIdsFromUseCases(rehearseUseCases),
    },
    {
      id: "activate",
      title: "Put Money to Work",
      description:
        "Use the shortlist that is most usable right now, based on your goal timing and current readiness.",
      useCaseIds: uniqueIds(activateUseCases),
      categoryIds: collectCategoryIdsFromUseCases(activateUseCases),
    },
  ];
}

function pickCategories(categoryIds: string[]) {
  return categoryIds
    .map((categoryId) => categoryLibrary.find((item) => item.id === categoryId))
    .filter((category): category is AcademyCategory => Boolean(category));
}

function scoreLiquidity(liquidity: string) {
  const value = liquidity.toLowerCase();

  if (value.includes("immediate")) return 5;
  if (value.includes("high")) return 4;
  if (value.includes("market hours")) return 3;
  if (value.includes("medium")) return 2;
  return 1;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function collectCategoryIdsFromUseCases(useCaseIds: string[]) {
  const ids = uniqueIds(useCaseIds)
    .map((useCaseId) => academyUseCases.find((item) => item.id === useCaseId))
    .flatMap((useCase) => useCase?.categoryIds ?? []);

  return uniqueIds(ids).slice(0, 5);
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
