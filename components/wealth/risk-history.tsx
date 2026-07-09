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
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Risk profile history</CardTitle>
          <CardDescription>
            Saved snapshots help show how a user&apos;s plan changes as their life changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {history.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{profile.band}</Badge>
                <Badge variant="outline">{profile.confidence}</Badge>
              </div>
              <p className="mt-3 font-semibold">{profile.personality}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use Save Risk in the header to store the current profile here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 rounded-md border bg-background p-4 md:grid-cols-[120px_1fr_auto]"
              >
                <div>
                  <p className="text-2xl font-semibold">{item.score}</p>
                  <p className="text-xs text-muted-foreground">Risk score</p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{item.band}</Badge>
                    <Badge variant="outline">{item.confidence}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{item.personality}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground md:text-right">
                  {formatDate(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
