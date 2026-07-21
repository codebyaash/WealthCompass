import { Activity, Cloud, LogOut, Save, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskProfile } from "@/lib/wealth-rules";

export function AppHeader({
  connectorAttention,
  onSaveRiskHistory,
  onSignOut,
  profile,
  showProfileContext = true,
  syncMessage,
  syncStatus,
  userEmail,
}: {
  connectorAttention?: {
    badge: string;
    detail: string;
    severity: "healthy" | "warning";
  };
  onSaveRiskHistory: () => void;
  onSignOut: () => void;
  profile: RiskProfile;
  showProfileContext?: boolean;
  syncMessage: string;
  syncStatus: string;
  userEmail: string;
}) {
  return (
    <div className="mb-6 grid gap-4 rounded-xl border border-border/75 bg-card/92 p-5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.28)] backdrop-blur-sm md:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            WealthCompass Workspace
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
            Your investment command center
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Live planning, portfolio posture, goal progress, and import intelligence in a
            calmer market-style workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <ThemeToggle />
          <Button variant="secondary" className="gap-2">
            <Activity className="h-4 w-4" />
            Market View
          </Button>
          <Button onClick={onSaveRiskHistory}>
            <Save className="h-4 w-4" />
            Save Risk
          </Button>
          {userEmail ? (
            <Button variant="outline" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <Button asChild>
              <a href="/auth">
                <ShieldCheck className="h-4 w-4" />
                Sign In
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/75 bg-background/72 p-4 shadow-sm sm:flex-row sm:items-center">
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
        {userEmail && (
          <Badge variant="outline" className="border-border/80 bg-card/65">
            {userEmail}
          </Badge>
        )}
      </div>
    </div>
  );
}
