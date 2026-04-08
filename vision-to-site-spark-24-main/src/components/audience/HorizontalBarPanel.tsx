import { useMemo } from "react";
import type { AudienceRecord } from "@/lib/audienceData";

interface BarItem {
  label: string;
  key: keyof AudienceRecord;
}

interface Props {
  title: string;
  items: BarItem[];
  data: AudienceRecord[];
  /** If true, values are boolean fields and we show % of respondents with true */
  booleanMode?: boolean;
}

const HorizontalBarPanel = ({ title, items, data, booleanMode = true }: Props) => {
  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const n = data.length;
    return items
      .map((item) => {
        const count = booleanMode
          ? data.filter((r) => r[item.key] === true).length
          : data.filter((r) => (r[item.key] as number) >= 4).length; // For values 1-5, count 4+5 as "highly value"
        const pct = Math.round((count / n) * 100);
        return { label: item.label, pct, count };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [data, items, booleanMode]);

  if (bars.length === 0) return null;

  const maxPct = Math.max(...bars.map((b) => b.pct), 1);

  return (
    <div className="rounded-xl bg-surface-card border border-surface-card-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] text-hero-muted">% who are highly interested</span>
      </div>
      <div className="space-y-2.5">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-xs text-hero-foreground w-28 flex-shrink-0 truncate">{bar.label}</span>
            <div className="flex-1 h-4 bg-surface-dark rounded-sm overflow-hidden">
              <div
                className="h-full bg-glow-accent rounded-sm transition-all duration-500"
                style={{ width: `${(bar.pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="text-xs text-hero-muted w-10 text-right flex-shrink-0">{bar.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HorizontalBarPanel;
