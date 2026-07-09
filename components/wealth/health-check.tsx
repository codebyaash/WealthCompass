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
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      <Badge variant="secondary">{value}</Badge>
    </div>
  );
}
