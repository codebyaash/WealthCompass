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
  const roadmapLeadStep = profile.roadmap[0] ?? null;
  const roadmapFinalStep =
    profile.roadmap.length > 0 ? profile.roadmap[profile.roadmap.length - 1] : null;
  const roadmapVerdictLabel =
    profile.confidence === "Needs foundation"
      ? "Roadmap should reduce hesitation first"
      : profile.confidence === "Getting ready"
        ? "Roadmap should convert learning into readiness"
        : "Roadmap should turn readiness into repeatable action";
  const roadmapVerdictToneClass =
    profile.confidence === "Needs foundation"
      ? "border-amber-500/30 bg-amber-500/10"
      : profile.confidence === "Getting ready"
        ? "border-sky-500/30 bg-sky-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";
  const roadmapVerdictBadgeVariant =
    profile.confidence === "Ready to act" ? "secondary" : "outline";
  const roadmapVerdictDetail =
    profile.confidence === "Needs foundation"
      ? "The best roadmap outcome right now is not speed. It is removing one or two reasons the next money decision still feels fragile."
      : profile.confidence === "Getting ready"
        ? "This roadmap should move knowledge into practical confidence, so the user can recognize what to do before the next real portfolio or market decision."
        : "The roadmap is most useful when it keeps action disciplined, not when it sends the user back into endless learning loops.";
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
  const roadmapStepCards = profile.roadmap.map((item, index) => {
    const stepKind =
      index === 0 ? "Start here" : index === profile.roadmap.length - 1 ? "Bring it into action" : "Build confidence";
    const unlockLabel =
      index === 0
        ? "What this unlocks"
        : index === profile.roadmap.length - 1
          ? "Why this closes the loop"
          : "Why this comes next";
    const unlockDetail =
      index === 0
        ? "This step gives the rest of the roadmap a safer base, so later decisions rest on something solid instead of urgency."
        : index === profile.roadmap.length - 1
          ? "This step should leave the user more able to act in the live app, not just explain concepts back."
          : "This step matters because it connects the previous lesson to a more practical investing decision.";
    const stepToneClass =
      item.format === "Checklist"
        ? "border-amber-500/30 bg-amber-500/5"
        : item.format === "Practice"
          ? "border-sky-500/30 bg-sky-500/5"
          : "border-emerald-500/30 bg-emerald-500/5";

    return {
      ...item,
      index,
      stepKind,
      stepToneClass,
      unlockDetail,
      unlockLabel,
    };
  });

  return (
    <Card className="wealth-panel-strong overflow-hidden">
      <CardHeader>
        <CardTitle>Learning roadmap</CardTitle>
        <CardDescription>
          Personalized from onboarding answers and meant to support the next real investing move.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          {roadmapIntroCards.map((item) => (
            <div key={item.label} className="wealth-chart-frame p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className={`grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_0.9fr] ${roadmapVerdictToneClass}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Roadmap verdict</p>
              <Badge variant={roadmapVerdictBadgeVariant}>{roadmapVerdictLabel}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{roadmapVerdictDetail}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best operating move
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {roadmapLeadStep
                ? `Start with ${roadmapLeadStep.topic}`
                : "Roadmap steps will appear after onboarding"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {roadmapFinalStep
                ? `The sequence should ultimately make ${roadmapFinalStep.topic.toLowerCase()} feel like a natural next action instead of a future aspiration.`
                : "Once the profile is ready, this lane should point to one next learning move rather than many equal options."}
            </p>
          </div>
        </div>
        <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-4"}>
          {roadmapStepCards.map((item) => (
            <div key={item.week} className="wealth-data-card p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{item.week}</Badge>
                <Badge variant="outline">{item.format}</Badge>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step {item.index + 1}
              </p>
              <p className="mt-1 font-semibold">{item.topic}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.stepKind}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.outcome}</p>
              <div className={`mt-3 grid gap-2 rounded-md border p-3 text-xs ${item.stepToneClass}`}>
                <p className="font-medium text-foreground">{item.unlockLabel}</p>
                <p className="leading-5 text-muted-foreground">{item.unlockDetail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
