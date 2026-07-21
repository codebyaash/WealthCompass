import { ArrowRight, Clock3, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import type { RiskHistoryItem } from "@/lib/local-storage";
import type { RiskProfile } from "@/lib/wealth-rules";

export function RiskHistory({
  history,
  profile,
}: {
  history: RiskHistoryItem[];
  profile: RiskProfile;
}) {
  const latestSaved = history[0] ?? null;
  const earliestSaved = history[history.length - 1] ?? null;
  const scoreChange =
    latestSaved && earliestSaved && history.length > 1
      ? latestSaved.score - earliestSaved.score
      : 0;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Risk journey</CardTitle>
          <CardDescription>
            Track how confidence, risk comfort, and planning posture change as your investing setup improves.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 rounded-md border bg-muted/30 p-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{profile.band}</Badge>
                <Badge variant="outline">{profile.confidence}</Badge>
                <Badge variant="outline">{profile.personality}</Badge>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {history.length > 0
                    ? "Your saved profile history now shows how your investing posture is evolving."
                    : "Save snapshots as your thinking changes, and this page turns into a useful decision timeline."}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {history.length > 0
                    ? "Use the timeline below to spot whether changes are gradual, confidence-led, or triggered by a life event or portfolio milestone."
                    : "Right now we only have the live profile. Save it from the header after meaningful changes like finishing onboarding again, updating goals, or revisiting your risk stance."}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">1. Save the moment</p>
                  <p className="mt-1 text-sm font-semibold">Store meaningful changes</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Save after a real shift in goals, confidence, savings base, or market behavior.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">2. Compare direction</p>
                  <p className="mt-1 text-sm font-semibold">Look for score and band drift</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    The timeline is most useful when you read change across multiple saves, not one number alone.
                  </p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">3. Adjust the plan</p>
                  <p className="mt-1 text-sm font-semibold">Use history as coaching context</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    A stronger profile should lead to clearer action, not just a higher score.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-md border bg-background p-4">
                <p className="text-sm font-medium">Current read</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{profile.score}/100</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{profile.summary}</p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="text-sm font-medium">Saved trend</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {history.length > 1
                    ? `${scoreChange > 0 ? "+" : ""}${scoreChange} points from first to latest save`
                    : history.length === 1
                      ? "One saved checkpoint so far"
                      : "No saved checkpoints yet"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {history.length > 1
                    ? `From ${earliestSaved?.band} on ${formatDate(earliestSaved?.createdAt ?? "")} to ${latestSaved?.band} on ${formatDate(latestSaved?.createdAt ?? "")}.`
                    : "Use Save Risk in the header to start building a useful timeline."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <HistoryMetric
              label="Saved checkpoints"
              value={String(history.length)}
              caption={history.length ? "Progress timeline is active" : "No snapshots yet"}
            />
            <HistoryMetric
              label="Latest saved score"
              value={latestSaved ? `${latestSaved.score}` : `${profile.score}`}
              caption={latestSaved ? latestSaved.band : "Current profile only"}
            />
            <HistoryMetric
              label="Score change"
              value={
                history.length > 1 ? `${scoreChange > 0 ? "+" : ""}${scoreChange}` : "0"
              }
              caption={history.length > 1 ? "First save to latest" : "Need at least two saves"}
            />
            <HistoryMetric
              label="Last saved"
              value={latestSaved ? formatDate(latestSaved.createdAt) : "Not yet"}
              caption={latestSaved ? latestSaved.confidence : "Use Save Risk"}
            />
          </div>

          {history.length === 0 ? (
            <div className="rounded-md border bg-background p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{profile.band}</Badge>
                <Badge variant="outline">{profile.confidence}</Badge>
              </div>
              <p className="mt-3 font-semibold">{profile.personality}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Save the current profile from the header after a meaningful change. Once you have a few checkpoints, this page becomes a real progress timeline instead of a single score.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {history.map((item, index) => {
                const previous = history[index + 1] ?? null;
                const delta = previous ? item.score - previous.score : null;

                return (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-md border bg-background p-4 md:grid-cols-[132px_1fr_220px]"
                  >
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-2xl font-semibold text-foreground">{item.score}</p>
                      <p className="text-xs text-muted-foreground">Saved score</p>
                      {delta !== null ? (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          {delta >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-primary" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-primary" />
                          )}
                          <span>
                            {delta > 0 ? "+" : ""}
                            {delta} vs previous
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="h-4 w-4 text-primary" />
                          <span>First saved checkpoint</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{item.band}</Badge>
                        <Badge variant="outline">{item.confidence}</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-foreground">{item.personality}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">Checkpoint context</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                      </div>
                      {previous ? (
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <span>{previous.band}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span>{item.band}</span>
                          </p>
                          <p>
                            Confidence moved from {previous.confidence} to {item.confidence}.
                          </p>
                          <p>
                            Score change {delta && delta > 0 ? "+" : ""}
                            {delta ?? 0} since the prior save.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs leading-5 text-muted-foreground">
                          This is the earliest saved profile in the timeline, so later checkpoints will use it as a comparison anchor.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryMetric({
  caption,
  label,
  value,
}: {
  caption: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</p>
    </div>
  );
}
