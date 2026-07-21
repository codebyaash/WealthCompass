import type { PortfolioAsset, PortfolioTransaction } from "./local-storage";
import type { RiskProfile } from "./wealth-rules";

export type PortfolioHealthCheck = {
  label: string;
  status: string;
  value: string;
};

export type AllocationInsight = {
  bucket: string;
  currentShare: number;
  status: string;
  suggestedShare: number;
};

export type TransactionSummary = {
  buys: number;
  dividends: number;
  realizedGain: number;
  sells: number;
};

type TransactionPosition = {
  investedValue: number;
  latestPrice: number;
  name: string;
  quantity: number;
  source: string;
  type: string;
};

export function calculatePortfolioInvestedValue(assets: PortfolioAsset[]) {
  return assets.reduce((sum, asset) => sum + asset.investedValue, 0);
}

export function calculatePortfolioGainPercent(assets: PortfolioAsset[], portfolioTotal: number) {
  const investedValue = calculatePortfolioInvestedValue(assets);

  if (investedValue <= 0 || portfolioTotal <= 0) return 0;

  return Math.round(((portfolioTotal - investedValue) / investedValue) * 100);
}

export function calculateDetailedHoldingsCoverage(assets: PortfolioAsset[]) {
  if (assets.length === 0) return 0;

  const detailedCount = assets.filter(
    (asset) => asset.investedValue > 0 || asset.quantity > 0 || asset.price > 0,
  ).length;

  return Math.round((detailedCount / assets.length) * 100);
}

export function summarizeTransactions(
  transactions: PortfolioTransaction[],
): TransactionSummary {
  return transactions.reduce<TransactionSummary>(
    (summary, transaction) => {
      if (transaction.action === "buy" || transaction.action === "transfer") {
        summary.buys += transaction.amount;
      }

      if (transaction.action === "sell") {
        summary.sells += transaction.amount;
      }

      if (transaction.action === "dividend") {
        summary.dividends += transaction.amount;
      }

      return summary;
    },
    {
      buys: 0,
      dividends: 0,
      realizedGain: calculateRealizedGainFromTransactions(transactions),
      sells: 0,
    },
  );
}

export function calculateRealizedGainFromTransactions(
  transactions: PortfolioTransaction[],
) {
  const positions = new Map<string, TransactionPosition>();
  let realizedGain = 0;

  for (const transaction of transactions) {
    const key = createTransactionKey(transaction);
    const current =
      positions.get(key) ??
      {
        investedValue: 0,
        latestPrice: transaction.price,
        name: transaction.assetName,
        quantity: 0,
        source: transaction.source,
        type: transaction.type,
      };

    if (transaction.action === "buy" || transaction.action === "transfer") {
      current.quantity += transaction.quantity;
      current.investedValue += transaction.amount;
      current.latestPrice = transaction.price || current.latestPrice;
      positions.set(key, current);
      continue;
    }

    if (transaction.action === "sell") {
      const averageCost =
        current.quantity > 0 ? current.investedValue / current.quantity : 0;
      const costBasis = averageCost * transaction.quantity;

      realizedGain += transaction.amount - costBasis;
      current.quantity = Math.max(0, current.quantity - transaction.quantity);
      current.investedValue = Math.max(0, current.investedValue - costBasis);
      current.latestPrice = transaction.price || current.latestPrice;
      positions.set(key, current);
      continue;
    }

    if (transaction.action === "dividend") {
      realizedGain += transaction.amount;
    }
  }

  return Math.round(realizedGain);
}

export function derivePortfolioAssetsFromTransactions(
  transactions: PortfolioTransaction[],
  fallbackAssets: PortfolioAsset[] = [],
) {
  const positions = new Map<string, TransactionPosition>();

  for (const transaction of [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  )) {
    const key = createTransactionKey(transaction);
    const current =
      positions.get(key) ??
      {
        investedValue: 0,
        latestPrice:
          transaction.price ||
          fallbackAssets.find((asset) => createAssetKey(asset) === key)?.price ||
          0,
        name: transaction.assetName,
        quantity: 0,
        source: transaction.source,
        type: normalizeTransactionHoldingType(transaction.assetName, transaction.type),
      };

    if (transaction.action === "buy" || transaction.action === "transfer") {
      current.quantity += transaction.quantity;
      current.investedValue += transaction.amount;
      current.latestPrice = transaction.price || current.latestPrice;
      current.source = transaction.source;
      positions.set(key, current);
      continue;
    }

    if (transaction.action === "sell") {
      const averageCost =
        current.quantity > 0 ? current.investedValue / current.quantity : 0;
      const quantityToRemove = Math.min(current.quantity, transaction.quantity);

      current.quantity -= quantityToRemove;
      current.investedValue = Math.max(
        0,
        current.investedValue - averageCost * quantityToRemove,
      );
      current.latestPrice = transaction.price || current.latestPrice;
      positions.set(key, current);
      continue;
    }
  }

  return Array.from(positions.values())
    .filter((position) => position.quantity > 0)
    .map((position) => {
      const fallbackAsset = fallbackAssets.find(
        (asset) => createAssetKey(asset) === createAssetKey(position),
      );
      const price = fallbackAsset?.price || position.latestPrice;
      const investedValue = Number(position.investedValue.toFixed(2));
      const marketDerivedValue = Number((position.quantity * price).toFixed(2));
      const value =
        !fallbackAsset && Math.abs(marketDerivedValue - investedValue) <= 1
          ? investedValue
          : marketDerivedValue;

      return {
        gain:
          investedValue > 0
            ? Number((((value - investedValue) / investedValue) * 100).toFixed(2))
            : 0,
        investedValue,
        name: position.name,
        price,
        quantity: Number(position.quantity.toFixed(2)),
        source: `${position.source} · transaction-derived`,
        type: normalizeTransactionHoldingType(position.name, position.type),
        value,
      } satisfies PortfolioAsset;
    })
    .sort((left, right) => right.value - left.value);
}

export function resolveSnapshotPortfolioAssets(
  transactions: PortfolioTransaction[],
  savedAssets: PortfolioAsset[] = [],
) {
  if (savedAssets.length > 0) {
    return savedAssets;
  }

  if (transactions.length === 0) {
    return savedAssets;
  }

  return derivePortfolioAssetsFromTransactions(transactions, savedAssets);
}

export function calculateLargestHoldingConcentration({
  assets,
  portfolioTotal,
}: {
  assets: PortfolioAsset[];
  portfolioTotal: number;
}) {
  if (portfolioTotal <= 0 || assets.length === 0) return 0;

  const largestHolding = assets.reduce(
    (largest, asset) => (asset.value > largest.value ? asset : largest),
    assets[0],
  );

  return Math.round((largestHolding.value / portfolioTotal) * 100);
}

export function getSuggestedIndexFundCore(profile: RiskProfile) {
  return profile.allocation.find((item) => item.name === "Index Funds")?.value ?? 0;
}

export function getPortfolioDiversificationScore({
  assets,
  portfolioTotal,
}: {
  assets: PortfolioAsset[];
  portfolioTotal: number;
}) {
  if (assets.length === 0 || portfolioTotal <= 0) return 0;

  const uniqueTypes = new Set(assets.map((asset) => asset.type)).size;
  const concentration = calculateLargestHoldingConcentration({ assets, portfolioTotal });
  const investedValue = calculatePortfolioInvestedValue(assets);
  const cashShare = assets
    .filter((asset) => asset.type.toLowerCase().includes("cash"))
    .reduce((sum, asset) => sum + asset.value, 0) / portfolioTotal;

  let score = 35;
  score += Math.min(25, uniqueTypes * 6);
  score += concentration <= 25 ? 20 : concentration <= 40 ? 10 : 0;
  score += investedValue > 0 ? 10 : 0;
  score += cashShare <= 0.25 ? 10 : cashShare <= 0.45 ? 5 : 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getAllocationInsights({
  assets,
  portfolioTotal,
  profile,
}: {
  assets: PortfolioAsset[];
  portfolioTotal: number;
  profile: RiskProfile;
}) {
  if (portfolioTotal <= 0 || assets.length === 0) return [];

  const grouped = new Map<string, number>();

  for (const asset of assets) {
    const bucket = mapAssetTypeToSuggestedBucket(asset.type);
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + asset.value);
  }

  return profile.allocation
    .map((target) => {
      const currentValue = grouped.get(target.name) ?? 0;
      const currentShare = Math.round((currentValue / portfolioTotal) * 100);
      const drift = currentShare - target.value;

      return {
        bucket: target.name,
        currentShare,
        status:
          Math.abs(drift) <= 5
            ? "Near target"
            : drift > 5
              ? "Above target"
              : "Below target",
        suggestedShare: target.value,
      } satisfies AllocationInsight;
    })
    .filter((item) => item.currentShare > 0 || item.suggestedShare > 0);
}

export function getPortfolioHealthChecks({
  assets,
  portfolioTotal,
  profile,
}: {
  assets: PortfolioAsset[];
  portfolioTotal: number;
  profile: RiskProfile;
}): PortfolioHealthCheck[] {
  const concentration = calculateLargestHoldingConcentration({ assets, portfolioTotal });
  const suggestedIndexFundCore = getSuggestedIndexFundCore(profile);
  const gainPercent = calculatePortfolioGainPercent(assets, portfolioTotal);
  const detailCoverage = calculateDetailedHoldingsCoverage(assets);
  const diversificationScore = getPortfolioDiversificationScore({ assets, portfolioTotal });

  return [
    {
      label: "Largest holding",
      status: concentration > 40 ? "Needs attention" : "Healthy",
      value: `${concentration}%`,
    },
    {
      label: "Suggested index fund core",
      status: suggestedIndexFundCore >= 40 ? "On track" : "Conservative",
      value: `${suggestedIndexFundCore}%`,
    },
    {
      label: "Portfolio return",
      status: gainPercent >= 0 ? "Profitable" : "Underwater",
      value: `${gainPercent}%`,
    },
    {
      label: "Detail coverage",
      status: detailCoverage >= 75 ? "Import quality strong" : "Add more cost basis",
      value: `${detailCoverage}%`,
    },
    {
      label: "Diversification score",
      status:
        diversificationScore >= 75
          ? "Balanced mix"
          : diversificationScore >= 55
            ? "Improving"
            : "Needs variety",
      value: `${diversificationScore}/100`,
    },
  ];
}

function mapAssetTypeToSuggestedBucket(type: string) {
  const normalized = type.trim().toLowerCase();

  if (
    normalized.includes("index") ||
    normalized.includes("etf") ||
    normalized.includes("large-cap") ||
    normalized.includes("international")
  ) {
    return "Index Funds";
  }

  if (
    normalized.includes("stock") ||
    normalized.includes("small-cap") ||
    normalized.includes("flexi")
  ) {
    return "Stocks";
  }

  if (
    normalized.includes("debt") ||
    normalized.includes("bond") ||
    normalized.includes("liquid") ||
    normalized.includes("fd") ||
    normalized.includes("ppf") ||
    normalized.includes("nps")
  ) {
    return "Debt";
  }

  if (normalized.includes("gold")) {
    return "Gold";
  }

  if (normalized.includes("cash")) {
    return "Cash";
  }

  return "Stocks";
}

function createAssetKey(asset: Pick<PortfolioAsset, "name" | "type">) {
  return `${asset.name.trim().toLowerCase()}::${asset.type.trim().toLowerCase()}`;
}

function createTransactionKey(
  transaction: Pick<PortfolioTransaction, "assetName" | "type">,
) {
  return `${transaction.assetName.trim().toLowerCase()}::${normalizeTransactionHoldingType(
    transaction.assetName,
    transaction.type,
  )
    .trim()
    .toLowerCase()}`;
}

function normalizeTransactionHoldingType(assetName: string, type: string) {
  const normalizedType = type.trim();
  const lowerName = assetName.trim().toLowerCase();
  const lowerType = normalizedType.toLowerCase();

  if (
    lowerName.includes("small cap") &&
    (lowerType === "mutual fund" || lowerType === "other" || lowerType === "imported holding")
  ) {
    return "Equity - Small Cap";
  }

  if (
    lowerName.includes("mid cap") &&
    (lowerType === "mutual fund" || lowerType === "other" || lowerType === "imported holding")
  ) {
    return "Equity - Mid Cap";
  }

  if (
    lowerName.includes("large cap") &&
    (lowerType === "mutual fund" || lowerType === "other" || lowerType === "imported holding")
  ) {
    return "Equity - Large Cap";
  }

  if (
    lowerName.includes("liquid") &&
    (lowerType === "mutual fund" || lowerType === "other" || lowerType === "imported holding")
  ) {
    return "Debt";
  }

  if (
    lowerName.includes("gold") &&
    (lowerType === "mutual fund" || lowerType === "other" || lowerType === "imported holding")
  ) {
    return "Gold";
  }

  return normalizedType;
}
