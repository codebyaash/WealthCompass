import type { PortfolioAsset } from "./local-storage";
import type { RiskProfile } from "./wealth-rules";

export type PortfolioHealthCheck = {
  label: string;
  status: string;
  value: string;
};

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
      label: "Tracking habit",
      status: assets.length >= 4 ? "Good start" : "Add more detail",
      value: `${assets.length} assets`,
    },
  ];
}
