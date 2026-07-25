import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RiskProfile } from "@/lib/wealth-rules";

export function Roadmap({
  compact = false,
  profile,
}: {
  compact?: boolean;
  profile: RiskProfile;
}) {
  const roadmapIntroCards = [
    {
      label: "What this is for",
      detail:
        "Use the roadmap to build enough understanding to make the next money decision with more confidence, not to finish content for its own sake.",
    },
    {
      label: "How to use it",
      detail:
        "Take one lane at a time, then bring the learning back into portfolio, goals, market, or mentor instead of keeping it theoretical.",
    },
    {
      label: "Best outcome",
      detail:
        "A roadmap week is working when it reduces one real hesitation and makes the next action feel calmer and more specific.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning roadmap</CardTitle>
        <CardDescription>
          Personalized from onboarding answers and meant to support the next real investing move.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          {roadmapIntroCards.map((item) => (
            <div key={item.label} className="rounded-md border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-4"}>
          {profile.roadmap.map((item, index) => (
            <div key={item.week} className="rounded-md border bg-background p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{item.week}</Badge>
                <Badge variant="outline">{item.format}</Badge>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </p>
              <p className="mt-1 font-semibold">{item.topic}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.outcome}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
