import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AudienceRecord } from "@/lib/audienceData";
import { applySegmentFilters, type Segment } from "@/lib/segmentData";

// ─── Types ───────────────────────────────────────────────────────

// Keys are either real record fields or "__seg__<segId>"
type ColKey = string;

interface ColDef { key: ColKey; label: string; group: string }

// ─── Base columns ─────────────────────────────────────────────────

const BASE_COLUMNS: ColDef[] = [
  { key: "age_group",                 label: "Age Group",           group: "Demographics" },
  { key: "gender",                    label: "Gender",              group: "Demographics" },
  { key: "household_income_bracket",  label: "Income Bracket",      group: "Demographics" },
  { key: "race_ethnicity",            label: "Race/Ethnicity",      group: "Demographics" },
  { key: "is_high_income",            label: "High Income",         group: "Derived" },
  { key: "is_social_active_daily",    label: "Social Active Daily", group: "Derived" },
];

const AGE_ORDER = ["18-24","25-34","35-44","45-54","55-64","65+"];
const INC_ORDER = ["Under $25K","$25K-$49K","$50K-$74K","$75K-$99K","$100K-$149K","$150K+"];

const PALETTE = [
  "#004638","#F5A825","#3B82F6","#8B5CF6","#EC4899",
  "#10B981","#F97316","#EF4444","#06B6D4","#84CC16",
];

const TICK_COLOR = "#6b7280";
const GRID_COLOR = "#e5e7eb";

// ─── Helpers ─────────────────────────────────────────────────────

function getFieldOrder(key: ColKey): string[] | null {
  if (key === "age_group") return AGE_ORDER;
  if (key === "household_income_bracket") return INC_ORDER;
  return null;
}

function labelBoolean(v: string) {
  if (v === "true")  return "Yes";
  if (v === "false") return "No";
  return v;
}

// ─── Component ───────────────────────────────────────────────────

interface Props {
  data: AudienceRecord[];
  allData?: AudienceRecord[];
  segments?: Segment[];
}

const StackedBarChart = ({ data, allData, segments }: Props) => {
  const [primaryKey, setPrimaryKey] = useState<ColKey>("age_group");
  const [secondaryKey, setSecondaryKey] = useState<ColKey>("gender");

  // Per-segment membership sets: segId → Set of respondent_id strings
  const segmentSets = useMemo<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    if (!segments?.length || !allData?.length) return m;
    for (const seg of segments) {
      const idxs = applySegmentFilters(allData, seg.filters, { gender: [], age: [], income: [] });
      const ids = new Set(idxs.map((i) => String(allData[i].respondent_id)));
      m.set(seg.id, ids);
    }
    return m;
  }, [allData, segments]);

  // Build full column list: base + one entry per segment
  const columns = useMemo<ColDef[]>(() => {
    if (!segments?.length) return BASE_COLUMNS;
    const segCols: ColDef[] = segments.map((seg) => ({
      key: `__seg__${seg.id}`,
      label: `${seg.icon} ${seg.name}`,
      group: "Segments",
    }));
    return [...BASE_COLUMNS, ...segCols];
  }, [segments]);

  const getVal = (record: AudienceRecord, key: ColKey): string => {
    if (key.startsWith("__seg__")) {
      const segId = key.replace("__seg__", "");
      const inSeg = segmentSets.get(segId)?.has(String(record.respondent_id));
      return inSeg ? "In Segment" : "Not in Segment";
    }
    const v = record[key as keyof AudienceRecord];
    return labelBoolean(String(v));
  };

  const { chartData, secondaryCols } = useMemo(() => {
    if (!data.length) return { chartData: [], secondaryCols: [] };

    const secSet = new Set<string>();
    data.forEach((r) => secSet.add(getVal(r, secondaryKey)));
    // Put "In Segment" first for segment cols
    const secVals = Array.from(secSet).sort((a, b) => {
      if (a === "In Segment") return -1;
      if (b === "In Segment") return 1;
      return a.localeCompare(b);
    });

    const priSet = new Set<string>();
    data.forEach((r) => priSet.add(getVal(r, primaryKey)));

    const order = getFieldOrder(primaryKey);
    const priVals = order
      ? order.filter((v) => priSet.has(v)).concat(Array.from(priSet).filter((v) => !order.includes(v)))
      : Array.from(priSet).sort((a, b) => {
          if (a === "In Segment") return -1;
          if (b === "In Segment") return 1;
          return a.localeCompare(b);
        });

    const counts: Record<string, Record<string, number>> = {};
    data.forEach((r) => {
      const pv = getVal(r, primaryKey);
      const sv = getVal(r, secondaryKey);
      if (!counts[pv]) counts[pv] = {};
      counts[pv][sv] = (counts[pv][sv] || 0) + 1;
    });

    const chartData = priVals.map((pv) => {
      const row: Record<string, string | number> = { name: pv };
      secVals.forEach((sv) => { row[sv] = counts[pv]?.[sv] || 0; });
      return row;
    });

    return { chartData, secondaryCols: secVals };
  }, [data, primaryKey, secondaryKey, segmentSets]);

  const primaryLabel  = columns.find((c) => c.key === primaryKey)?.label  || primaryKey;
  const secondaryLabel = columns.find((c) => c.key === secondaryKey)?.label || secondaryKey;

  const tooltipStyle = {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: 12,
    color: "#004638",
  };

  const renderSelect = (value: ColKey, onChange: (v: ColKey) => void, exclude: ColKey) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44 h-8 text-xs bg-surface-dark border-surface-card-border text-hero-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-surface-card border-surface-card-border max-h-64">
        {Object.entries(
          columns.filter((c) => c.key !== exclude).reduce((acc, c) => {
            (acc[c.group] = acc[c.group] || []).push(c);
            return acc;
          }, {} as Record<string, ColDef[]>)
        ).map(([group, items]) => (
          <SelectGroup key={group}>
            <SelectLabel className="text-hero-muted text-[10px] uppercase tracking-wider">{group}</SelectLabel>
            {items.map((c) => (
              <SelectItem key={c.key} value={c.key} className="text-hero-foreground text-xs">{c.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="rounded-xl bg-surface-card border border-surface-card-border p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider">Stacked Bar Chart</h3>
          <p className="text-xs text-hero-muted mt-0.5">{primaryLabel} broken down by {secondaryLabel}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-hero-muted whitespace-nowrap">Primary:</span>
            {renderSelect(primaryKey, setPrimaryKey, secondaryKey)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-hero-muted whitespace-nowrap">Breakdown:</span>
            {renderSelect(secondaryKey, setSecondaryKey, primaryKey)}
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="name" tick={{ fill: TICK_COLOR, fontSize: 11 }} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#004638", fontSize: 11 }}>{v}</span>} />
            {secondaryCols.map((sv, i) => (
              <Bar
                key={sv}
                dataKey={sv}
                stackId="stack"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === secondaryCols.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StackedBarChart;
