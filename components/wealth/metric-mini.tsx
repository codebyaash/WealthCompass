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
    <div className="wealth-data-card min-h-[104px]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold leading-tight tracking-normal text-foreground">{value}</p>
      {caption ? (
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
