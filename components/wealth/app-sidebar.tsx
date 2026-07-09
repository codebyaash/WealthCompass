import {
  BookOpen,
  Compass,
  Goal,
  History,
  LayoutDashboard,
  MessageCircleQuestion,
  Newspaper,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "onboarding", label: "Onboarding", icon: Compass },
  { id: "academy", label: "Academy", icon: BookOpen },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "goals", label: "Goals", icon: Goal },
  { id: "history", label: "History", icon: History },
  { id: "market", label: "Market", icon: Newspaper },
  { id: "mentor", label: "Mentor", icon: MessageCircleQuestion },
  { id: "settings", label: "Settings", icon: Settings },
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
    <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64">
      <nav className="flex h-full flex-col rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold">WealthCompass</p>
            <p className="text-xs text-muted-foreground">Find your financial direction.</p>
          </div>
        </div>
        <Separator className="my-3" />
        <div className="grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => onNavigate(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
        <div className="mt-auto rounded-md border bg-muted/60 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Free MVP mode</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Rule-based guidance, local autosave, Supabase-ready schema.
          </p>
        </div>
      </nav>
    </aside>
  );
}
