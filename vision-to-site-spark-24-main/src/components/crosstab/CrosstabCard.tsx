import { useState, useMemo, useRef, useEffect } from "react";
import { TableProperties, Download, Trash2, ChevronDown, Check } from "lucide-react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { AudienceRecord } from "@/lib/audienceData";
import { applySegmentFilters, type Segment } from "@/lib/segmentData";
import { downloadCrosstabPdf, downloadCrosstabCsv } from "@/lib/reportDownload";

// ─── Column definitions (shared with CrosstabPanel) ───────────────

type ColKey = string;
interface ColDef { key: ColKey; label: string; group: string }

const BASE_COLUMNS: ColDef[] = [
  { key: "gender",                   label: "Gender",           group: "Demographics" },
  { key: "age_group",                label: "Age Group",        group: "Demographics" },
  { key: "household_income_bracket", label: "Income Bracket",   group: "Demographics" },
  { key: "race_ethnicity",           label: "Race/Ethnicity",   group: "Demographics" },
  { key: "facebook_usage",  label: "Facebook",  group: "Social Media" },
  { key: "youtube_usage",   label: "YouTube",   group: "Social Media" },
  { key: "instagram_usage", label: "Instagram", group: "Social Media" },
  { key: "twitter_usage",   label: "Twitter/X", group: "Social Media" },
  { key: "linkedin_usage",  label: "LinkedIn",  group: "Social Media" },
  { key: "snapchat_usage",  label: "Snapchat",  group: "Social Media" },
  { key: "reddit_usage",    label: "Reddit",    group: "Social Media" },
  { key: "tiktok_usage",    label: "TikTok",    group: "Social Media" },
  { key: "interest_live_sports",  label: "Live Sports",     group: "TV Genres" },
  { key: "interest_news",         label: "News",            group: "TV Genres" },
  { key: "interest_crime",        label: "Crime/Detective", group: "TV Genres" },
  { key: "interest_drama",        label: "Drama",           group: "TV Genres" },
  { key: "interest_documentary",  label: "Documentary",     group: "TV Genres" },
  { key: "interest_comedy",       label: "Comedy",          group: "TV Genres" },
  { key: "interest_scifi",        label: "Sci-Fi",          group: "TV Genres" },
  { key: "interest_reality",      label: "Reality",         group: "TV Genres" },
  { key: "interest_talkshows",    label: "Talk Shows",      group: "TV Genres" },
  { key: "uses_tv",         label: "Television", group: "Media Channels" },
  { key: "uses_podcasts",   label: "Podcasts",   group: "Media Channels" },
  { key: "uses_radio",      label: "Radio",      group: "Media Channels" },
  { key: "uses_magazines",  label: "Magazines",  group: "Media Channels" },
  { key: "uses_newspapers", label: "Newspapers", group: "Media Channels" },
  { key: "interest_sports",          label: "Sports",          group: "Interests" },
  { key: "interest_health_wellness", label: "Health/Wellness", group: "Interests" },
  { key: "interest_music",           label: "Music",           group: "Interests" },
  { key: "interest_travel",          label: "Travel",          group: "Interests" },
  { key: "interest_movies",          label: "Movies",          group: "Interests" },
  { key: "interest_nature",          label: "Nature",          group: "Interests" },
  { key: "interest_reading",         label: "Reading",         group: "Interests" },
  { key: "interest_cooking",         label: "Cooking",         group: "Interests" },
  { key: "interest_shopping",        label: "Shopping",        group: "Interests" },
  { key: "interest_fitness",         label: "Fitness",         group: "Interests" },
  { key: "interest_technology",      label: "Technology",      group: "Interests" },
  { key: "interest_finance",         label: "Finance",         group: "Interests" },
  { key: "interest_games",           label: "Games",           group: "Interests" },
  { key: "interest_art",             label: "Art",             group: "Interests" },
  { key: "interest_fashion",         label: "Fashion",         group: "Interests" },
  { key: "value_family",                    label: "Family",            group: "Core Values" },
  { key: "value_working_hard",              label: "Working Hard",      group: "Core Values" },
  { key: "value_financial_responsibility",  label: "Financial Resp.",   group: "Core Values" },
  { key: "value_enjoying_life",             label: "Enjoying Life",     group: "Core Values" },
  { key: "value_healthy_lifestyle",         label: "Healthy Lifestyle", group: "Core Values" },
  { key: "value_self_improvement",          label: "Self-improvement",  group: "Core Values" },
  { key: "value_honesty",                   label: "Honesty",           group: "Core Values" },
  { key: "value_environment",               label: "Environment",       group: "Core Values" },
  { key: "value_looking_good",              label: "Looking Good",      group: "Core Values" },
  { key: "value_wealth",                    label: "Wealth",            group: "Core Values" },
  { key: "is_social_active_daily", label: "Social Active Daily", group: "Derived" },
  { key: "is_high_income",         label: "High Income",         group: "Derived" },
];

const EMPTY = "";

// ─── Props ────────────────────────────────────────────────────────

interface CrosstabCardProps {
  index: number;
  allData: AudienceRecord[];
  segments: Segment[];
  onDelete: () => void;
  canDelete: boolean;
}

// ─── Segment multi-select dropdown ───────────────────────────────

interface SegmentSelectorProps {
  segments: Segment[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  totalCount: number;
  filteredCount: number;
}

const SegmentSelector = ({ segments, selectedIds, onChange, totalCount, filteredCount }: SegmentSelectorProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const label = selectedIds.length === 0
    ? "All Data"
    : selectedIds.length === 1
      ? (segments.find((s) => s.id === selectedIds[0])?.name ?? "1 segment")
      : `${selectedIds.length} segments`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-surface-card-border bg-surface-dark text-xs text-hero-foreground hover:border-glow-primary/50 transition-colors min-w-[140px]"
      >
        <span className="flex-1 text-left truncate">
          {selectedIds.length === 0
            ? <span className="text-hero-muted">All Data</span>
            : <span>{label}</span>}
        </span>
        <span className="text-hero-muted text-[10px] font-mono shrink-0">
          n={filteredCount.toLocaleString()}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-hero-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 rounded-lg border border-surface-card-border bg-surface-card shadow-xl overflow-hidden">
          {/* All Data option */}
          <button
            onClick={() => { onChange([]); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-surface-dark/50 transition-colors"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedIds.length === 0 ? "bg-glow-primary border-glow-primary" : "border-surface-card-border"}`}>
              {selectedIds.length === 0 && <Check className="h-2.5 w-2.5 text-white" />}
            </span>
            <span className="text-hero-foreground font-medium">All Data</span>
            <span className="ml-auto text-hero-muted font-mono">{totalCount.toLocaleString()}</span>
          </button>

          {segments.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] text-hero-muted uppercase tracking-wider border-t border-surface-card-border bg-surface-dark/30">
                Segments (union if multiple)
              </div>
              <div className="max-h-56 overflow-y-auto">
                {segments.map((seg) => {
                  const checked = selectedIds.includes(seg.id);
                  return (
                    <button
                      key={seg.id}
                      onClick={() => toggle(seg.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-dark/50 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-glow-primary border-glow-primary" : "border-surface-card-border"}`}>
                        {checked && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="text-hero-foreground truncate">{seg.icon} {seg.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── CrosstabCard ─────────────────────────────────────────────────

const CrosstabCard = ({ index, allData, segments, onDelete, canDelete }: CrosstabCardProps) => {
  const [rowCol, setRowCol] = useState<ColKey>(EMPTY);
  const [colCol, setColCol] = useState<ColKey>(EMPTY);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);

  // Build per-segment membership sets
  const segmentSets = useMemo<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    if (!segments?.length || !allData?.length) return m;
    for (const seg of segments) {
      const idxs = applySegmentFilters(allData, seg.filters, { gender: [], age: [], income: [] });
      m.set(seg.id, new Set(idxs.map((i) => String(allData[i].respondent_id))));
    }
    return m;
  }, [allData, segments]);

  // Filter allData by selected segments (union)
  const data = useMemo(() => {
    if (selectedSegmentIds.length === 0) return allData;
    const union = new Set<string>();
    selectedSegmentIds.forEach((id) => {
      segmentSets.get(id)?.forEach((rid) => union.add(rid));
    });
    return allData.filter((r) => union.has(String(r.respondent_id)));
  }, [allData, selectedSegmentIds, segmentSets]);

  // Audience label
  const audienceLabel = useMemo(() => {
    if (selectedSegmentIds.length === 0) return "All Data";
    if (selectedSegmentIds.length === 1) {
      const seg = segments.find((s) => s.id === selectedSegmentIds[0]);
      return seg ? `${seg.icon} ${seg.name}` : "1 Segment";
    }
    return `${selectedSegmentIds.length} Segments (union)`;
  }, [selectedSegmentIds, segments]);

  // Full column list
  const ALL_COLUMNS = useMemo<ColDef[]>(() => {
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
      return segmentSets.get(segId)?.has(String(record.respondent_id))
        ? "In Segment"
        : "Not in Segment";
    }
    const v = record[key as keyof AudienceRecord];
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };

  const crosstab = useMemo(() => {
    if (!rowCol || !colCol) return null;
    const rowVals = new Set<string>();
    const colVals = new Set<string>();
    const counts: Record<string, Record<string, number>> = {};

    data.forEach((r) => {
      const rv = getVal(r, rowCol);
      const cv = getVal(r, colCol);
      rowVals.add(rv); colVals.add(cv);
      if (!counts[rv]) counts[rv] = {};
      counts[rv][cv] = (counts[rv][cv] || 0) + 1;
    });

    const sort = (arr: string[]) => arr.sort((a, b) => {
      if (a === "In Segment") return -1;
      if (b === "In Segment") return 1;
      return a.localeCompare(b);
    });

    const rows = sort(Array.from(rowVals));
    const cols = sort(Array.from(colVals));
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    rows.forEach((r) => { rowTotals[r] = cols.reduce((s, c) => s + (counts[r]?.[c] || 0), 0); });
    cols.forEach((c) => { colTotals[c] = rows.reduce((s, r) => s + (counts[r]?.[c] || 0), 0); });

    return { rows, cols, counts, rowTotals, colTotals, grand: data.length };
  }, [data, rowCol, colCol, segmentSets]);

  const renderSelect = (value: ColKey, onChange: (v: ColKey) => void, exclude: ColKey, placeholder: string) => (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? EMPTY : v)}>
      <SelectTrigger className="w-44 h-9 text-xs bg-surface-dark border-surface-card-border text-hero-foreground">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-surface-card border-surface-card-border max-h-64">
        <SelectItem value="__none__" className="text-hero-muted text-xs italic">— Select variable —</SelectItem>
        {Object.entries(
          ALL_COLUMNS.filter((c) => c.key !== exclude).reduce((acc, c) => {
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

  const rowLabel = ALL_COLUMNS.find((c) => c.key === rowCol)?.label || "Row Variable";
  const colLabel = ALL_COLUMNS.find((c) => c.key === colCol)?.label || "Column Variable";
  const bothSelected = rowCol !== EMPTY && colCol !== EMPTY && crosstab !== null;

  return (
    <div className="rounded-xl bg-surface-card border border-surface-card-border overflow-hidden">
      {/* Card header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-card-border bg-surface-dark/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-glow-primary uppercase tracking-widest bg-glow-primary/10 border border-glow-primary/30 rounded px-2 py-0.5">
            #{index + 1}
          </span>
          {bothSelected && (
            <span className="text-xs text-hero-muted">{rowLabel} × {colLabel}</span>
          )}
        </div>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-hero-muted hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Controls row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Audience / segment selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-hero-muted whitespace-nowrap">Audience:</span>
            <SegmentSelector
              segments={segments}
              selectedIds={selectedSegmentIds}
              onChange={setSelectedSegmentIds}
              totalCount={allData.length}
              filteredCount={data.length}
            />
          </div>

          <div className="w-px h-6 bg-surface-card-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-hero-muted whitespace-nowrap">Rows:</span>
            {renderSelect(rowCol, setRowCol, colCol, "Select row variable")}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-hero-muted whitespace-nowrap">Cols:</span>
            {renderSelect(colCol, setColCol, rowCol, "Select col variable")}
          </div>

          {bothSelected && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCrosstabCsv({
                  crosstab: { rowLabel, colLabel, ...crosstab },
                  audienceLabel,
                })}
                className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-8"
              >
                <Download className="h-3 w-3" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCrosstabPdf({
                  crosstab: { rowLabel, colLabel, ...crosstab },
                  audienceLabel,
                  title: `Cross-Tab #${index + 1}`,
                })}
                className="border-glow-primary/40 text-glow-primary hover:bg-glow-primary/10 gap-1.5 text-xs h-8"
              >
                <Download className="h-3 w-3" /> PDF
              </Button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!bothSelected && (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center border border-dashed border-surface-card-border rounded-xl bg-surface-dark/20">
            <TableProperties className="h-9 w-9 text-hero-muted/30 stroke-1" />
            <p className="text-hero-foreground font-medium text-sm">No variables selected</p>
            <p className="text-hero-muted text-xs max-w-xs">
              Choose a row and column variable to generate a cross-tabulation.
              {segments?.length ? " Segments can be used as audience filters or as variables." : ""}
            </p>
          </div>
        )}

        {/* Table */}
        {bothSelected && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-surface-card-border">
                  <TableHead className="text-hero-foreground text-xs font-semibold sticky left-0 bg-surface-card z-10">
                    {rowLabel} \ {colLabel}
                  </TableHead>
                  {crosstab.cols.map((c) => (
                    <TableHead key={c} className="text-hero-muted text-xs text-center whitespace-nowrap">{c}</TableHead>
                  ))}
                  <TableHead className="text-glow-accent text-xs text-center font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crosstab.rows.map((row) => (
                  <TableRow key={row} className="border-surface-card-border hover:bg-surface-dark/30">
                    <TableCell className="text-hero-foreground text-xs font-medium sticky left-0 bg-surface-card z-10">{row}</TableCell>
                    {crosstab.cols.map((col) => {
                      const val = crosstab.counts[row]?.[col] || 0;
                      const p = crosstab.rowTotals[row] ? Math.round((val / crosstab.rowTotals[row]) * 100) : 0;
                      return (
                        <TableCell key={col} className="text-center text-xs">
                          <span className="text-hero-foreground">{val}</span>
                          <span className="text-hero-muted ml-1">({p}%)</span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center text-xs font-semibold text-glow-accent">
                      {crosstab.rowTotals[row]}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-surface-card-border bg-surface-dark/20">
                  <TableCell className="text-glow-accent text-xs font-semibold sticky left-0 bg-surface-dark/20 z-10">Total</TableCell>
                  {crosstab.cols.map((col) => (
                    <TableCell key={col} className="text-center text-xs font-semibold text-glow-accent">
                      {crosstab.colTotals[col]}
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-xs font-bold text-glow-primary">
                    {crosstab.grand}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrosstabCard;
