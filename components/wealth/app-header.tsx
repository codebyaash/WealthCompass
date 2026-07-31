import { Activity, ArrowRight, Cloud, LogOut, Save, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActiveView } from "@/components/wealth/app-sidebar";
import type { RiskProfile } from "@/lib/wealth-rules";

const viewMeta: Record<
  ActiveView,
  {
    eyebrow: string;
    heroTitle: string;
    laneLabel: string;
    summary: string;
    quickActionLabel: string;
    quickActionTarget: ActiveView;
  }
> = {
  academy: {
    eyebrow: "Academy",
    heroTitle: "Build product clarity before you allocate capital",
    laneLabel: "Learning lane",
    quickActionLabel: "Open market lane",
    quickActionTarget: "market",
    summary: "Learn the products, tradeoffs, and category roles before you put fresh capital to work.",
  },
  dashboard: {
    eyebrow: "Dashboard",
    heroTitle: "Run the full investing system from one desk",
    laneLabel: "Command lane",
    quickActionLabel: "Open market lane",
    quickActionTarget: "market",
    summary: "Read the health of the full investing system across risk, portfolio, goals, market context, and execution.",
  },
  goals: {
    eyebrow: "Goals",
    heroTitle: "Turn targets into monthly funding discipline",
    laneLabel: "Planning lane",
    quickActionLabel: "Open dashboard lane",
    quickActionTarget: "dashboard",
    summary: "Turn long-term intentions into monthly funding pressure you can actually sustain and review.",
  },
  history: {
    eyebrow: "History",
    heroTitle: "Review how your investing posture has changed",
    laneLabel: "History lane",
    quickActionLabel: "Open portfolio lane",
    quickActionTarget: "portfolio",
    summary: "Review how your posture, confidence, and investing actions have changed over time.",
  },
  market: {
    eyebrow: "Market",
    heroTitle: "Read sector leadership with a portfolio-first lens",
    laneLabel: "Market lane",
    quickActionLabel: "Open settings lane",
    quickActionTarget: "settings",
    summary: "Read sectors, trends, and suggested market pockets with a steadier portfolio-first lens.",
  },
  mentor: {
    eyebrow: "AI mentor",
    heroTitle: "Turn confusion into one calmer next move",
    laneLabel: "Mentor lane",
    quickActionLabel: "Open dashboard lane",
    quickActionTarget: "dashboard",
    summary: "Ask plain-language questions and turn uncertainty into one calmer, more usable next move.",
  },
  onboarding: {
    eyebrow: "Onboarding",
    heroTitle: "Set the baseline the rest of the app can trust",
    laneLabel: "Baseline lane",
    quickActionLabel: "Open AI mentor",
    quickActionTarget: "mentor",
    summary: "Set your starting point so the rest of the workspace can personalize around your real intent and risk posture.",
  },
  portfolio: {
    eyebrow: "Portfolio",
    heroTitle: "Track capital, imports, and allocation with cleaner context",
    laneLabel: "Portfolio lane",
    quickActionLabel: "Open market lane",
    quickActionTarget: "market",
    summary: "Track imports, allocation, and journal activity without losing sight of the broader plan.",
  },
  settings: {
    eyebrow: "Settings",
    heroTitle: "Protect the workspace and keep every feed trustworthy",
    laneLabel: "Control lane",
    quickActionLabel: "Open market lane",
    quickActionTarget: "market",
    summary: "Manage connectors, backups, and live controls without breaking the operating flow of the desk.",
  },
};

export function AppHeader({
  activeView,
  connectorAttention,
  onNavigate,
  onSaveRiskHistory,
  onSignOut,
  profile,
  showProfileContext = true,
  syncMessage,
  syncStatus,
  userEmail,
}: {
  activeView: ActiveView;
  connectorAttention?: {
    badge: string;
    detail: string;
    severity: "healthy" | "warning";
  };
  onNavigate: (view: ActiveView) => void;
  onSaveRiskHistory: () => void;
  onSignOut: () => void;
  profile: RiskProfile;
  showProfileContext?: boolean;
  syncMessage: string;
  syncStatus: string;
  userEmail: string;
}) {
  const activeViewMeta = viewMeta[activeView];

  return (
    <div className="wealth-panel-strong mb-6 grid gap-4 p-5 md:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            WealthCompass Investment Desk · {activeViewMeta.eyebrow}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {showProfileContext ? (
              <>
                <Badge variant="secondary">{profile.band}</Badge>
                <Badge variant="outline">{profile.personality}</Badge>
              </>
            ) : (
              <Badge variant="secondary">Setup</Badge>
            )}
            {connectorAttention && (
              <Badge
                variant={connectorAttention.severity === "healthy" ? "secondary" : "outline"}
              >
                {connectorAttention.badge}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
            {activeViewMeta.heroTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {activeViewMeta.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <ThemeToggle className="lg:hidden" />
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => onNavigate(activeViewMeta.quickActionTarget)}
          >
            <Activity className="h-4 w-4" />
            {activeViewMeta.quickActionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button onClick={onSaveRiskHistory}>
            <Save className="h-4 w-4" />
            Save checkpoint
          </Button>
          {userEmail ? (
            <Button variant="outline" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Button asChild>
              <a href="/auth">
                <ShieldCheck className="h-4 w-4" />
                Sign in to sync
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="wealth-inset flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{syncStatus}</p>
            <p className="text-xs leading-5 text-muted-foreground">{syncMessage}</p>
            {connectorAttention && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {connectorAttention.detail}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-border/80 bg-card/70">
            {activeViewMeta.laneLabel}: {activeViewMeta.quickActionLabel}
          </Badge>
          {userEmail && (
            <Badge variant="outline" className="border-border/80 bg-card/70">
              {userEmail}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
