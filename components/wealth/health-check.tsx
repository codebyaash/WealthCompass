import { Badge } from "@/components/ui/badge";

export function HealthCheck({
  label,
  status,
  value,
}: {
  label: string;
  status: string;
  value: string;
}) {
  const tone = getHealthCheckTone(status);

  return (
    <div className={`flex items-center justify-between gap-4 rounded-md border bg-background p-3 ${tone.containerClassName}`}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      <Badge variant="secondary" className={tone.badgeClassName}>
        {value}
      </Badge>
    </div>
  );
}

function getHealthCheckTone(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("needs") ||
    normalized.includes("low") ||
    normalized.includes("concentr") ||
    normalized.includes("under") ||
    normalized.includes("missing")
  ) {
    return {
      badgeClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      containerClassName: "border-amber-500/30",
    };
  }

  if (
    normalized.includes("good") ||
    normalized.includes("healthy") ||
    normalized.includes("on track") ||
    normalized.includes("strong")
  ) {
    return {
      badgeClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      containerClassName: "border-emerald-500/30",
    };
  }

  return {
    badgeClassName: "",
    containerClassName: "",
  };
}
