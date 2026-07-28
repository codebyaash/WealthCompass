"use client";

import { Badge } from "@/components/ui/badge";

export type PageNavigatorOption = [string, string];

export function PageNavigatorBar({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: PageNavigatorOption[];
  value: string;
}) {
  const activeLabel =
    options.find(([optionValue]) => optionValue === value)?.[1] ?? "Section";

  return (
    <div className="sticky top-3 z-20">
      <div className="wealth-panel-strong rounded-lg border border-border/80 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{label}</Badge>
              <span className="text-[11px] leading-5 text-muted-foreground">
                {activeLabel}
              </span>
            </div>
          </div>
          <select
            aria-label={`${label} quick navigation`}
            className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map(([optionValue, labelText]) => (
              <option key={optionValue} value={optionValue}>
                {labelText}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
