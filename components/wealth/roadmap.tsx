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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning roadmap</CardTitle>
        <CardDescription>Personalized from onboarding answers.</CardDescription>
      </CardHeader>
      <CardContent className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-4"}>
        {profile.roadmap.map((item) => (
          <div key={item.week} className="rounded-md border bg-background p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{item.week}</Badge>
              <Badge variant="outline">{item.format}</Badge>
            </div>
            <p className="mt-3 font-semibold">{item.topic}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.outcome}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
