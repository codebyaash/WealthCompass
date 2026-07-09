import type { PortfolioAsset, WealthGoal } from "./local-storage";
import type { RiskProfile } from "./wealth-rules";

export type DashboardView = "academy" | "goals" | "onboarding" | "portfolio";

export type DashboardAction = {
  badge: string;
  cta: string;
  detail: string;
  reason: string;
  title: string;
  view: DashboardView;
};

export function getDashboardAction({
  assets,
  formatMoney,
  goalProgress,
  goals,
  healthScore,
  monthlyGoal,
  profile,
}: {
  assets: PortfolioAsset[];
  formatMoney: (value: number) => string;
  goalProgress: number;
  goals: WealthGoal[];
  healthScore: number;
  monthlyGoal: number;
  profile: RiskProfile;
}): DashboardAction {
  if (profile.confidence === "Needs foundation") {
    return {
      badge: "Foundation",
      cta: "Review Profile",
      detail: "Emergency savings or debt risk is still limiting how much market risk makes sense.",
      reason: "Risk capacity comes before product selection.",
      title: "Strengthen your foundation first",
      view: "onboarding",
    };
  }

  if (goals.length === 0 || goalProgress < 10) {
    return {
      badge: "Planning",
      cta: "Plan Goals",
      detail: `Your current goal plan needs more funding clarity. The combined monthly target is ${formatMoney(monthlyGoal)}.`,
      reason: "Goals make portfolio decisions easier to evaluate.",
      title: "Define the next funding milestone",
      view: "goals",
    };
  }

  if (assets.length < 4 || healthScore < 70) {
    return {
      badge: "Tracking",
      cta: "Review Portfolio",
      detail: "Add or refine holdings so allocation and concentration checks become more useful.",
      reason: "Better tracking creates better recommendations.",
      title: "Improve portfolio visibility",
      view: "portfolio",
    };
  }

  return {
    badge: "Learning",
    cta: "Open Academy",
    detail: "Your foundation is in good shape. Keep building product knowledge before adding complexity.",
    reason: "The next edge is consistency and understanding.",
    title: "Continue the learning roadmap",
    view: "academy",
  };
}
