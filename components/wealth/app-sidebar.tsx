import {
  Activity,
  BookOpen,
  Compass,
  Goal,
  History,
  LayoutDashboard,
  MessageCircleQuestion,
  Newspaper,
  Settings,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, detail: "Command center" },
  { id: "onboarding", label: "Onboarding", icon: Compass, detail: "Baseline and intent" },
  { id: "academy", label: "Academy", icon: BookOpen, detail: "Learn and compare" },
  { id: "portfolio", label: "Portfolio", icon: WalletCards, detail: "Holdings and imports" },
  { id: "goals", label: "Goals", icon: Goal, detail: "Targets and funding" },
  { id: "history", label: "History", icon: History, detail: "Progress trail" },
  { id: "market", label: "Market", icon: Newspaper, detail: "Sectors and trends" },
  { id: "mentor", label: "AI Mentor", icon: MessageCircleQuestion, detail: "Ask and clarify" },
  { id: "settings", label: "Settings", icon: Settings, detail: "Connectors and control" },
] as const;

export type ActiveView = (typeof navItems)[number]["id"];

export function AppSidebar({
  activeView,
  onNavigate,
}: {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[17rem] xl:w-[18rem]">
      <nav className="flex h-full flex-col rounded-xl border border-border/75 bg-card/88 p-4 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.28)] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Investor Operating System
          </p>
          <ThemeToggle className="hidden h-9 w-9 lg:inline-flex" />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/72 px-3 py-3 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_rgba(13,148,136,0.95)]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-normal">WealthCompass</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Financial clarity with market rhythm.
            </p>
          </div>
        </div>
        <Separator className="my-4 bg-border/70" />
        <div className="mb-3 px-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Command lanes
          </p>
        </div>
        <div className="grid gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? "secondary" : "ghost"}
                className={
                  activeView === item.id
                    ? "h-auto justify-start rounded-lg border border-white/80 bg-secondary/95 px-3 py-3 shadow-sm"
                    : "h-auto justify-start rounded-lg px-3 py-3"
                }
                onClick={() => onNavigate(item.id)}
              >
                <div className="flex items-start gap-3 text-left">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium leading-5">{item.label}</p>
                    <p className="text-[11px] leading-4 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        <div className="mt-auto rounded-lg border border-primary/20 bg-linear-to-br from-primary/10 via-background/88 to-secondary/75 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Desk posture</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use the shell in this order: understand your baseline, track real money, then widen into markets, learning, and guidance.
          </p>
        </div>
      </nav>
    </aside>
  );
}
