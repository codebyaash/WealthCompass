export function MetricMini({
  caption,
  label,
  value,
}: {
  caption?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-background/78 p-4 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.26)] backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-normal">{value}</p>
      {caption ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
