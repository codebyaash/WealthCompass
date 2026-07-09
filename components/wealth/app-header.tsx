import { Cloud, LogOut, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskProfile } from "@/lib/wealth-rules";

export function AppHeader({
  onSaveRiskHistory,
  onSignOut,
  profile,
  syncMessage,
  syncStatus,
  userEmail,
}: {
  onSaveRiskHistory: () => void;
  onSignOut: () => void;
  profile: RiskProfile;
  syncMessage: string;
  syncStatus: string;
  userEmail: string;
}) {
  return (
    <div className="mb-5 grid gap-4 rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profile.band}</Badge>
            <Badge variant="outline">{profile.personality}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
            Your investment command center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            A beginner-first companion for risk clarity, learning, portfolio tracking,
            and goal planning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
      <div className="flex flex-col justify-between gap-3 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{syncStatus}</p>
            <p className="text-xs leading-5 text-muted-foreground">{syncMessage}</p>
          </div>
        </div>
        {userEmail && <Badge variant="outline">{userEmail}</Badge>}
      </div>
    </div>
  );
}
