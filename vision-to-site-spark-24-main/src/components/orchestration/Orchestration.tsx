import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Target, Radio, Tv, BarChart2, Zap, Loader2, Key, AlertTriangle,
  ChevronDown, Check, Users, Download, RefreshCw, ToggleLeft, ToggleRight,
  Save, BookOpen, Trash2, Copy, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import { loadSegments, applySegmentFilters, type Segment } from "@/lib/segmentData";
import { getAnthropicKey, setAnthropicKey, deleteAnthropicKey } from "@/lib/anthropicNlp";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { StratTab, StrategySection, StrategyOutput, PlatformPlanRow, MonthBudget, MediaPlanResult } from "@/lib/orchestrationTypes";
import { loadSavedPlans, saveOrchestrationPlan, deleteSavedPlan, type SavedOrchestration } from "@/lib/orchestrationStorage";
import { downloadOrchestrationPdf } from "@/lib/reportDownload";

// ─── Platform definitions ─────────────────────────────────────────

interface PlatformDef {
  id: string;
  label: string;
  icon: string;
  baseCpm: number;
  reachFactor: number;
  ctr: number;
  formats: string;
  color: string;
  affinityKey: (keyof AudienceRecord) | null;
}

const PLATFORMS: PlatformDef[] = [
  { id: "meta",        label: "Meta (FB+IG)",        icon: "📘", baseCpm: 8.50,  reachFactor: 0.72, ctr: 0.009, formats: "Feed, Stories, Reels, Carousel",              color: "#1877F2", affinityKey: "facebook_usage" },
  { id: "google",      label: "Google Display",       icon: "🟡", baseCpm: 3.20,  reachFactor: 0.85, ctr: 0.008, formats: "Display, Responsive, Gmail",                  color: "#4285F4", affinityKey: "is_social_active_daily" },
  { id: "youtube",     label: "YouTube",              icon: "▶️", baseCpm: 12.50, reachFactor: 0.78, ctr: 0.004, formats: "Pre-roll, Bumpers, Masthead",                  color: "#FF0000", affinityKey: "youtube_usage" },
  { id: "programmatic",label: "Programmatic / CTV",   icon: "📡", baseCpm: 18.00, reachFactor: 0.68, ctr: 0.003, formats: "Display, Video, CTV, Audio, DOOH",             color: "#6366f1", affinityKey: "uses_tv" },
  { id: "tiktok",      label: "TikTok",               icon: "🎵", baseCpm: 9.50,  reachFactor: 0.42, ctr: 0.008, formats: "In-Feed, TopView, Branded Hashtag",            color: "#69C9D0", affinityKey: "tiktok_usage" },
  { id: "linkedin",    label: "LinkedIn",             icon: "💼", baseCpm: 28.00, reachFactor: 0.35, ctr: 0.005, formats: "Sponsored Content, InMail, Display",           color: "#0A66C2", affinityKey: "linkedin_usage" },
  { id: "spotify",     label: "Spotify / Audio",      icon: "🎧", baseCpm: 22.00, reachFactor: 0.38, ctr: 0.003, formats: "Audio, Podcast Ads, Overlay",                  color: "#1DB954", affinityKey: "uses_podcasts" },
  { id: "pinterest",   label: "Pinterest",            icon: "📌", baseCpm: 6.80,  reachFactor: 0.29, ctr: 0.006, formats: "Promoted Pins, Shopping, Video",               color: "#E60023", affinityKey: "instagram_usage" },
  { id: "snapchat",    label: "Snapchat",             icon: "👻", baseCpm: 7.20,  reachFactor: 0.31, ctr: 0.007, formats: "Snap Ads, Stories, AR Lenses",                 color: "#FFFC00", affinityKey: "snapchat_usage" },
  { id: "linear_tv",   label: "Linear TV / OTT",      icon: "📺", baseCpm: 35.00, reachFactor: 0.61, ctr: 0.002, formats: "Broadcast, Cable, Streaming, OTT",             color: "#FF6B35", affinityKey: "uses_tv" },
];

// ─── Types ────────────────────────────────────────────────────────

interface PlatformState {
  id: string;
  label: string;
  icon: string;
  color: string;
  formats: string;
  cpm: number;
  reachFactor: number;
  ctr: number;
  affinity: number;   // 0-100 %
  enabled: boolean;
  allocation: number; // 0-100 %
}

// ─── Helpers ─────────────────────────────────────────────────────

const US_ADULTS = 260_000_000;

function boolPct(data: AudienceRecord[], key: keyof AudienceRecord): number {
  if (!data.length) return 50;
  return Math.round(data.filter((r) => r[key] === true).length / data.length * 100);
}

function getPlatformAffinity(data: AudienceRecord[], p: PlatformDef): number {
  if (!p.affinityKey) return 50;
  const raw = boolPct(data, p.affinityKey);
  if (p.id === "pinterest") return Math.round(raw * 0.45);
  if (p.id === "google") return Math.min(88, Math.round(raw * 0.8 + 18));
  return raw;
}

function buildInitialPlatformStates(data: AudienceRecord[]): PlatformState[] {
  const states = PLATFORMS.map((p) => ({
    id: p.id, label: p.label, icon: p.icon, color: p.color, formats: p.formats,
    cpm: p.baseCpm, reachFactor: p.reachFactor, ctr: p.ctr,
    affinity: getPlatformAffinity(data, p),
    enabled: true,
    allocation: 0,
  }));
  // Distribute allocation proportional to affinity
  const total = states.reduce((s, p) => s + p.affinity, 0);
  let remaining = 100;
  states.forEach((p, i) => {
    if (i === states.length - 1) { p.allocation = remaining; return; }
    p.allocation = Math.round(p.affinity / total * 100);
    remaining -= p.allocation;
  });
  return states;
}

function rebalanceAllocations(states: PlatformState[]): PlatformState[] {
  const enabled = states.filter((p) => p.enabled);
  const total = enabled.reduce((s, p) => s + p.allocation, 0);
  if (total === 0 || enabled.length === 0) return states;
  let remaining = 100;
  return states.map((p, i) => {
    if (!p.enabled) return { ...p, allocation: 0 };
    const isLast = states.filter((x) => x.enabled).at(-1)?.id === p.id;
    const alloc = isLast ? remaining : Math.round(p.allocation / total * 100);
    remaining -= alloc;
    return { ...p, allocation: alloc };
  });
}

function getMonthsBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const s = new Date(start); const e = new Date(end);
  const months: string[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) {
    months.push(cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function computeMediaPlan(
  budget: number,
  platforms: PlatformState[],
  targetFrequency: number,
  targetReach: number,
  flightStart: string,
  flightEnd: string,
): MediaPlanResult {
  const enabled = platforms.filter((p) => p.enabled && p.allocation > 0);
  let totalImpressions = 0;
  let totalSpend = 0;
  let maxReach = 0;

  const rows: PlatformPlanRow[] = enabled.map((p) => {
    const spend = budget * p.allocation / 100;
    const impressions = spend / p.cpm * 1000;
    const addressable = US_ADULTS * (targetReach / 100) * (p.affinity / 100) * p.reachFactor;
    const reach = Math.min(impressions / Math.max(targetFrequency, 1), addressable);
    const frequency = impressions / Math.max(reach, 1);
    const clicks = impressions * p.ctr;
    const cpc = spend / Math.max(clicks, 1);
    totalImpressions += impressions;
    totalSpend += spend;
    maxReach = Math.max(maxReach, reach);
    return { id: p.id, platform: p.label, icon: p.icon, color: p.color, allocationPct: p.allocation, spend, impressions, reach, frequency, cpm: p.cpm, clicks, cpc };
  });

  const blendedCpm = totalSpend / Math.max(totalImpressions / 1000, 1);
  const avgFrequency = totalImpressions / Math.max(maxReach, 1);
  const months = getMonthsBetween(flightStart, flightEnd);
  const monthlyBudget = months.length > 0 ? totalSpend / months.length : 0;

  const monthlyFlighting: MonthBudget[] = months.map((month) => {
    const row: MonthBudget = { month, total: monthlyBudget };
    enabled.forEach((p) => { row[p.id] = monthlyBudget * p.allocation / 100; });
    return row;
  });

  return { totalBudget: budget, totalImpressions, addressableReach: maxReach, avgFrequency, blendedCpm, platforms: rows, monthlyFlighting };
}

function fmt$(n: number) { return "$" + (n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toFixed(2)); }
function fmtN(n: number) { return n >= 1_000_000_000 ? (n / 1_000_000_000).toFixed(1) + "B" : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "K" : Math.round(n).toLocaleString(); }

function buildAudienceProfile(data: AudienceRecord[], label: string): string {
  const n = data.length;
  if (!n) return "No audience data.";
  const pct = (k: keyof AudienceRecord) => boolPct(data, k);
  const ageCounts: Record<string, number> = {};
  data.forEach((r) => { ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1; });
  const topAge = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const interests = [
    ["Sports","interest_sports"],["Health/Wellness","interest_health_wellness"],
    ["Travel","interest_travel"],["Fitness","interest_fitness"],
    ["Technology","interest_technology"],["Music","interest_music"],
  ].map(([l, k]) => ({ l, p: pct(k as keyof AudienceRecord) }))
   .sort((a, b) => b.p - a.p).slice(0, 4).map((i) => `${i.l} ${i.p}%`).join(", ");
  return [
    `Audience: ${label} · n=${n}`,
    `Female ${Math.round(data.filter(r=>r.gender==="Female").length/n*100)}%, Male ${Math.round(data.filter(r=>r.gender==="Male").length/n*100)}%`,
    `Top age: ${topAge}  High income: ${pct("is_high_income")}%  Daily social: ${pct("is_social_active_daily")}%`,
    `Top interests: ${interests}`,
    `Facebook ${pct("facebook_usage")}%  YouTube ${pct("youtube_usage")}%  Instagram ${pct("instagram_usage")}%  TikTok ${pct("tiktok_usage")}%`,
    `Uses TV: ${pct("uses_tv")}%  Podcasts: ${pct("uses_podcasts")}%  LinkedIn: ${pct("linkedin_usage")}%`,
  ].filter(Boolean).join("\n");
}

function exportCsv(plan: MediaPlanResult, productName: string) {
  const head = ["Platform","Allocation %","Budget","Impressions","Reach","Frequency","CPM","Clicks","CPC"];
  const rows = plan.platforms.map((p) => [
    p.platform, p.allocationPct.toFixed(1)+"%", fmt$(p.spend),
    fmtN(p.impressions), fmtN(p.reach), p.frequency.toFixed(1)+"x",
    fmt$(p.cpm), fmtN(p.clicks), fmt$(p.cpc),
  ]);
  const csv = [
    `"Product","${productName}"`,
    `"Total Budget","${fmt$(plan.totalBudget)}"`,
    `"Total Impressions","${fmtN(plan.totalImpressions)}"`,
    `"Blended CPM","${fmt$(plan.blendedCpm)}"`,
    "",
    head.map(h => `"${h}"`).join(","),
    ...rows.map(r => r.map(c => `"${c}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `MediaPlan_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Audience Selector ────────────────────────────────────────────

const AudienceSelector = ({ segments, selectedId, onChange, count }: {
  segments: Segment[]; selectedId: string | null;
  onChange: (id: string | null) => void; count: number;
}) => {
  const [open, setOpen] = useState(false);
  const selected = segments.find((s) => s.id === selectedId);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-surface-card-border bg-surface-dark text-xs text-hero-foreground hover:border-glow-primary/50 transition-colors w-full">
        <Users className="h-3.5 w-3.5 text-hero-muted shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? `${selected.icon} ${selected.name}` : <span className="text-hero-muted">All Respondents</span>}
        </span>
        <span className="text-hero-muted text-[10px] font-mono shrink-0">n={count.toLocaleString()}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-hero-muted transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-full rounded-lg border border-surface-card-border bg-surface-card shadow-xl overflow-hidden">
          <button onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-surface-dark/50">
            <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", !selectedId ? "bg-glow-primary border-glow-primary" : "border-surface-card-border")}>
              {!selectedId && <Check className="h-2.5 w-2.5 text-white" />}
            </span>
            <span className="text-hero-foreground font-medium">All Respondents</span>
          </button>
          {segments.map((seg) => (
            <button key={seg.id} onClick={() => { onChange(seg.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-dark/50">
              <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", selectedId === seg.id ? "bg-glow-primary border-glow-primary" : "border-surface-card-border")}>
                {selectedId === seg.id && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="text-hero-foreground truncate">{seg.icon} {seg.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Strategy Output Renderer ─────────────────────────────────────

const StrategyPanel = ({ output, running, onGenerate, label, disabled }: {
  output: StrategyOutput | null; running: boolean;
  onGenerate: () => void; label: string; disabled: boolean;
}) => (
  <div className="space-y-5">
    <div className="flex justify-end">
      <Button onClick={onGenerate} disabled={running || disabled}
        className="bg-glow-primary hover:bg-glow-primary/90 text-white gap-2 h-9">
        {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Zap className="h-4 w-4" /> Generate {label}</>}
      </Button>
    </div>
    {running && (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
        <span className="text-sm text-hero-muted">Crafting {label.toLowerCase()}…</span>
      </div>
    )}
    {!running && !output && (
      <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-surface-card-border rounded-xl bg-surface-dark/20 text-center">
        <span className="text-hero-muted text-sm">Fill in the brief above, then click Generate {label}.</span>
      </div>
    )}
    {output && !running && (
      <div className="space-y-5">
        {/* Headline banner */}
        <div className="rounded-xl bg-glow-primary/10 border border-glow-primary/30 px-5 py-4">
          <p className="text-glow-primary font-bold text-base">{output.headline}</p>
          <p className="text-hero-foreground/80 text-sm mt-1.5">{output.summary}</p>
        </div>
        {/* Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {output.sections.map((sec, i) => (
            <div key={i} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
              <h4 className="text-xs font-bold text-glow-primary uppercase tracking-wider">{sec.title}</h4>
              <p className="text-xs text-hero-foreground/80 leading-relaxed">{sec.body}</p>
              {sec.bullets?.length > 0 && (
                <ul className="space-y-1.5">
                  {sec.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-hero-foreground/70">
                      <span className="w-1 h-1 rounded-full bg-glow-primary mt-1.5 shrink-0" />{b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ─── Media Plan Tab ───────────────────────────────────────────────

const MediaPlanTab = ({ audienceData, audienceLabel, productName, apiKey, onNeedKey, onPlanChange }: {
  audienceData: AudienceRecord[]; audienceLabel: string;
  productName: string; apiKey: string | null; onNeedKey: () => void;
  onPlanChange?: (plan: MediaPlanResult | null, rationale: string | null) => void;
}) => {
  const [budget, setBudget] = useState(500000);
  const [flightStart, setFlightStart] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [flightEnd, setFlightEnd] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 4);
    return d.toISOString().slice(0, 10);
  });
  const [campaignGoal, setCampaignGoal] = useState("Brand Awareness");
  const [targetFrequency, setTargetFrequency] = useState(5);
  const [targetReach, setTargetReach] = useState(60);
  const [platforms, setPlatforms] = useState<PlatformState[]>([]);
  const [plan, setPlan] = useState<MediaPlanResult | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Re-init platforms when audience changes
  useEffect(() => {
    if (audienceData.length) {
      setPlatforms(buildInitialPlatformStates(audienceData));
      setPlan(null); setRationale(null);
    }
  }, [audienceData]);

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled, allocation: p.enabled ? 0 : p.allocation } : p);
      return rebalanceAllocations(next);
    });
  };

  const updateCpm = (id: string, val: number) => {
    setPlatforms((prev) => prev.map((p) => p.id === id ? { ...p, cpm: Math.max(0.5, val) } : p));
  };

  const updateAlloc = (id: string, val: number) => {
    setPlatforms((prev) => {
      const total = prev.filter(p => p.enabled && p.id !== id).reduce((s, p) => s + p.allocation, 0);
      const clamped = Math.max(0, Math.min(100, val));
      const remaining = Math.max(0, 100 - clamped);
      const others = prev.filter(p => p.enabled && p.id !== id);
      const othersTotal = others.reduce((s, p) => s + p.allocation, 0);
      return prev.map((p) => {
        if (p.id === id) return { ...p, allocation: clamped };
        if (!p.enabled) return p;
        return { ...p, allocation: othersTotal > 0 ? Math.round(p.allocation / othersTotal * remaining) : Math.round(remaining / others.length) };
      });
    });
  };

  const generate = async () => {
    const result = computeMediaPlan(budget, platforms, targetFrequency, targetReach, flightStart, flightEnd);
    setPlan(result);
    setRationale(null);
    onPlanChange?.(result, null);
    setRunning(true);
    if (!apiKey) { onNeedKey(); setRunning(false); return; }
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `Write a 3-4 sentence strategic rationale for this media plan allocation. Be specific about why each major platform was prioritised based on audience data.
Audience: ${audienceLabel} · n=${audienceData.length}
Campaign goal: ${campaignGoal}
Product: ${productName || "(unspecified)"}
Platform allocations: ${result.platforms.map(p => `${p.platform} ${p.allocationPct}%`).join(", ")}
Total budget: ${fmt$(budget)}  Flight: ${flightStart} to ${flightEnd}`,
          }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const rat = data.content?.[0]?.text?.trim() ?? null;
        setRationale(rat);
        onPlanChange?.(result, rat);
      }
    } catch { /* non-fatal */ }
    setRunning(false);
  };

  if (!platforms.length) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Campaign parameters */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-4">
        <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Campaign Parameters</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-hero-muted uppercase tracking-wider">Total Budget</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-hero-muted">$</span>
              <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))}
                className="pl-6 bg-hero border-surface-card-border text-hero-foreground text-sm h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-hero-muted uppercase tracking-wider">Flight Start</label>
            <Input type="date" value={flightStart} onChange={(e) => setFlightStart(e.target.value)}
              className="bg-hero border-surface-card-border text-hero-foreground text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-hero-muted uppercase tracking-wider">Flight End</label>
            <Input type="date" value={flightEnd} onChange={(e) => setFlightEnd(e.target.value)}
              className="bg-hero border-surface-card-border text-hero-foreground text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-hero-muted uppercase tracking-wider">Campaign Goal</label>
            <select value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-surface-card-border bg-hero text-hero-foreground text-xs">
              {["Brand Awareness","Consideration","Conversion / DR","Retention"].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-hero-muted uppercase tracking-wider">Target Frequency</label>
              <span className="text-xs font-mono text-glow-primary">{targetFrequency}× / week</span>
            </div>
            <input type="range" min={1} max={20} value={targetFrequency} onChange={(e) => setTargetFrequency(Number(e.target.value))}
              className="w-full accent-[#004638]" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-hero-muted uppercase tracking-wider">Target Reach</label>
              <span className="text-xs font-mono text-glow-primary">{targetReach}%</span>
            </div>
            <input type="range" min={10} max={90} value={targetReach} onChange={(e) => setTargetReach(Number(e.target.value))}
              className="w-full accent-[#004638]" />
          </div>
        </div>
      </div>

      {/* Platform table */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-card-border flex items-center justify-between">
          <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Platform CPM & Allocation</h4>
          <span className="text-[10px] text-hero-muted">Allocation must sum to 100% · Audience affinity auto-weighted</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-card-border bg-surface-dark/30">
                <th className="text-left px-4 py-2.5 text-hero-muted font-medium">Platform</th>
                <th className="text-center px-3 py-2.5 text-hero-muted font-medium">On</th>
                <th className="text-center px-3 py-2.5 text-hero-muted font-medium">Audience Affinity</th>
                <th className="text-center px-3 py-2.5 text-hero-muted font-medium">CPM ($)</th>
                <th className="text-center px-3 py-2.5 text-hero-muted font-medium">Allocation %</th>
                <th className="text-left px-3 py-2.5 text-hero-muted font-medium">Formats</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.id} className={cn("border-b border-surface-card-border transition-colors",
                  p.enabled ? "hover:bg-surface-dark/20" : "opacity-40")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{p.icon}</span>
                      <span className="text-hero-foreground font-medium">{p.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => togglePlatform(p.id)} className="text-xl leading-none">
                      {p.enabled
                        ? <span className="text-glow-primary">◉</span>
                        : <span className="text-hero-muted/40">○</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-surface-dark overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.affinity}%`, backgroundColor: p.color }} />
                      </div>
                      <span className="text-hero-muted tabular-nums">{p.affinity}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input type="number" value={p.cpm} step={0.5} min={0.5}
                      onChange={(e) => updateCpm(p.id, parseFloat(e.target.value) || p.cpm)}
                      disabled={!p.enabled}
                      className="w-16 text-center bg-hero border border-surface-card-border rounded px-1.5 py-1 text-hero-foreground text-xs" />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input type="number" value={p.allocation} min={0} max={100}
                      onChange={(e) => updateAlloc(p.id, parseInt(e.target.value) || 0)}
                      disabled={!p.enabled}
                      className="w-16 text-center bg-hero border border-surface-card-border rounded px-1.5 py-1 text-hero-foreground text-xs" />
                  </td>
                  <td className="px-3 py-2.5 text-hero-muted text-[10px]">{p.formats}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-dark/30">
                <td colSpan={4} className="px-4 py-2.5 text-xs text-hero-muted font-medium">Total Allocation</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("text-xs font-bold tabular-nums",
                    Math.abs(platforms.filter(p=>p.enabled).reduce((s,p)=>s+p.allocation,0) - 100) <= 1 ? "text-green-400" : "text-red-400")}>
                    {platforms.filter(p=>p.enabled).reduce((s,p)=>s+p.allocation,0)}%
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Button onClick={generate} disabled={running}
        className="w-full bg-glow-primary hover:bg-glow-primary/90 text-white font-semibold h-11 gap-2">
        {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating Plan…</> : <><BarChart2 className="h-4 w-4" /> Generate Media Plan</>}
      </Button>

      {/* Results */}
      {plan && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total Budget", value: fmt$(plan.totalBudget) },
              { label: "Total Impressions", value: fmtN(plan.totalImpressions) },
              { label: "Addressable Reach", value: fmtN(plan.addressableReach) },
              { label: "Avg Frequency", value: plan.avgFrequency.toFixed(1) + "×" },
              { label: "Blended CPM", value: fmt$(plan.blendedCpm) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-surface-card border border-surface-card-border p-4 text-center">
                <div className="text-lg font-bold text-glow-primary">{k.value}</div>
                <div className="text-[10px] text-hero-muted uppercase tracking-wider mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Allocation table */}
          <div className="rounded-xl bg-surface-card border border-surface-card-border overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-card-border flex items-center justify-between">
              <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Platform Allocation</h4>
              <Button size="sm" variant="outline" onClick={() => exportCsv(plan, productName)}
                className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-card-border bg-surface-dark/30">
                    {["Platform","Alloc %","Budget","Impressions","Reach","Freq","CPM","Clicks","CPC"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-hero-muted font-medium text-center first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.platforms.map((p) => (
                    <tr key={p.id} className="border-b border-surface-card-border hover:bg-surface-dark/20">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-hero-foreground font-medium">{p.icon} {p.platform}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-glow-primary font-mono">{p.allocationPct}%</td>
                      <td className="px-3 py-2.5 text-center text-hero-foreground">{fmt$(p.spend)}</td>
                      <td className="px-3 py-2.5 text-center text-hero-foreground">{fmtN(p.impressions)}</td>
                      <td className="px-3 py-2.5 text-center text-hero-foreground">{fmtN(p.reach)}</td>
                      <td className="px-3 py-2.5 text-center text-hero-muted">{p.frequency.toFixed(1)}×</td>
                      <td className="px-3 py-2.5 text-center text-hero-muted">{fmt$(p.cpm)}</td>
                      <td className="px-3 py-2.5 text-center text-hero-foreground">{fmtN(p.clicks)}</td>
                      <td className="px-3 py-2.5 text-center text-hero-muted">{fmt$(p.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly flighting chart */}
          {plan.monthlyFlighting.length > 0 && (
            <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
              <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Monthly Flighting</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={plan.monthlyFlighting} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmt$(v)} tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} />
                  {plan.platforms.map((p) => (
                    <Bar key={p.id} dataKey={p.id} stackId="stack" fill={p.color} name={p.platform} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {plan.platforms.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-[10px] text-hero-muted">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.platform}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Rationale */}
          {running && !rationale && (
            <div className="flex items-center gap-2 text-xs text-hero-muted p-4 rounded-xl border border-surface-card-border">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-glow-primary" />
              Generating strategic rationale…
            </div>
          )}
          {rationale && (
            <div className="rounded-xl border border-glow-primary/20 bg-glow-primary/5 p-5 space-y-2">
              <h4 className="text-xs font-semibold text-glow-primary uppercase tracking-wider">Strategic Rationale</h4>
              <p className="text-sm text-hero-foreground/80 leading-relaxed">{rationale}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Saved Plans List ─────────────────────────────────────────────

const TAB_LABEL_MAP: Record<string, string> = {
  brand: "Brand Strategy", comms: "Communications", ads: "Ad Tactics",
};

const SavedPlansList = ({
  plans, onView, onClone, onDelete, onPdf,
}: {
  plans: SavedOrchestration[];
  onView: (p: SavedOrchestration) => void;
  onClone: (p: SavedOrchestration) => void;
  onDelete: (id: string) => void;
  onPdf: (p: SavedOrchestration) => void;
}) => {
  if (!plans.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <BookOpen className="h-10 w-10 text-hero-muted/30 stroke-1" />
      <p className="text-hero-muted text-sm">No saved plans yet. Generate outputs and click Save.</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {plans.map((p) => {
        const generatedTabs = Object.keys(p.outputs).filter((k) => p.outputs[k as StratTab]);
        return (
          <div key={p.id} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3 hover:border-glow-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-hero-foreground line-clamp-1">{p.productName || "(Untitled)"}</p>
                <p className="text-xs text-hero-muted mt-0.5">{p.productCategory || "—"} · {p.audienceLabel} · n={p.audienceCount.toLocaleString()}</p>
              </div>
              <span className="text-[10px] text-hero-muted/60 shrink-0">{new Date(p.savedAt).toLocaleDateString()}</span>
            </div>
            {p.businessObjective && (
              <p className="text-xs text-hero-foreground/70 line-clamp-2 italic">"{p.businessObjective}"</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {generatedTabs.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-glow-primary/10 text-glow-primary text-[10px] font-medium border border-glow-primary/20">
                  ✓ {TAB_LABEL_MAP[t] || t}
                </span>
              ))}
              {p.mediaPlan && (
                <span className="px-2 py-0.5 rounded-full bg-glow-primary/10 text-glow-primary text-[10px] font-medium border border-glow-primary/20">
                  ✓ Media Plan
                </span>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onView(p)}
                className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <BookOpen className="h-3 w-3" /> View
              </Button>
              <Button size="sm" variant="outline" onClick={() => onClone(p)}
                className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <Copy className="h-3 w-3" /> Clone
              </Button>
              <Button size="sm" variant="outline" onClick={() => onPdf(p)}
                className="border-surface-card-border text-hero-muted hover:text-glow-primary gap-1.5 text-xs h-7">
                <FileText className="h-3 w-3" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(p.id)}
                className="border-surface-card-border text-hero-muted hover:text-red-400 gap-1.5 text-xs h-7">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const TABS: { id: StratTab; label: string; icon: typeof Target; genLabel: string }[] = [
  { id: "brand",  label: "Brand Strategy",     icon: Target,   genLabel: "Brand Strategy" },
  { id: "comms",  label: "Communications",      icon: Radio,    genLabel: "Comms Strategy" },
  { id: "ads",    label: "Ad Tactics",          icon: Tv,       genLabel: "Ad Tactics" },
  { id: "media",  label: "Media Plan",          icon: BarChart2, genLabel: "Media Plan" },
];

const STRATEGY_PROMPTS: Record<string, { system: string }> = {
  brand: {
    system: `You are a senior brand strategist. Generate a comprehensive brand strategy. Return ONLY valid JSON with no markdown:
{"headline":"<8-10 word strategic direction>","summary":"<2-3 sentences>","sections":[{"title":"Core Positioning","body":"<2-3 sentences>","bullets":["...","...","..."]},{"title":"Target Audience Frame","body":"...","bullets":["...","...","..."]},{"title":"Brand Personality & Tone","body":"...","bullets":["...","...","..."]},{"title":"Key Messages","body":"...","bullets":["...","...","..."]},{"title":"Competitive Differentiation","body":"...","bullets":["...","...","..."]}]}`,
  },
  comms: {
    system: `You are a communications strategist. Generate a channel communications strategy. Return ONLY valid JSON with no markdown:
{"headline":"<8-10 word comms direction>","summary":"<2-3 sentences>","sections":[{"title":"Channel Strategy","body":"...","bullets":["...","...","..."]},{"title":"Content Pillars","body":"...","bullets":["...","...","..."]},{"title":"Messaging by Channel","body":"...","bullets":["...","...","..."]},{"title":"Audience Journey","body":"...","bullets":["...","...","..."]},{"title":"Tone & Voice","body":"...","bullets":["...","...","..."]}]}`,
  },
  ads: {
    system: `You are a senior advertising strategist. Generate specific ad tactics and creative direction. Return ONLY valid JSON with no markdown:
{"headline":"<8-10 word creative direction>","summary":"<2-3 sentences>","sections":[{"title":"Creative Direction","body":"...","bullets":["...","...","..."]},{"title":"Format Recommendations by Platform","body":"...","bullets":["...","...","..."]},{"title":"Call to Action Strategy","body":"...","bullets":["...","...","..."]},{"title":"Testing & Optimisation Priorities","body":"...","bullets":["...","...","..."]},{"title":"Creative Do's and Don'ts","body":"...","bullets":["...","...","..."]}]}`,
  },
};

const Orchestration = () => {
  const [allData, setAllData] = useState<AudienceRecord[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  // View: new plan or saved plans
  const [mainView, setMainView] = useState<"new" | "saved">("new");
  const [savedPlans, setSavedPlans] = useState<SavedOrchestration[]>([]);

  const refreshSaved = () => setSavedPlans(loadSavedPlans());
  useEffect(() => { refreshSaved(); }, []);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const segmentSets = useMemo<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const seg of segments) {
      const idxs = applySegmentFilters(allData, seg.filters, { gender: [], age: [], income: [] });
      m.set(seg.id, new Set(idxs.map((i) => String(allData[i].respondent_id))));
    }
    return m;
  }, [allData, segments]);
  const audienceData = useMemo(() => {
    if (!selectedSegmentId) return allData;
    const s = segmentSets.get(selectedSegmentId);
    return s ? allData.filter((r) => s.has(String(r.respondent_id))) : allData;
  }, [allData, selectedSegmentId, segmentSets]);
  const audienceLabel = useMemo(() => {
    if (!selectedSegmentId) return "All Respondents";
    const seg = segments.find((s) => s.id === selectedSegmentId);
    return seg ? `${seg.icon} ${seg.name}` : "Selected Segment";
  }, [selectedSegmentId, segments]);

  // Brief
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [businessObjective, setBusinessObjective] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<StratTab>("brand");
  const [outputs, setOutputs] = useState<Partial<Record<StratTab, StrategyOutput | null>>>({});
  const [running, setRunning] = useState<Partial<Record<StratTab, boolean>>>({});

  // Media plan state (lifted from MediaPlanTab via callback)
  const [currentMediaPlan, setCurrentMediaPlan] = useState<MediaPlanResult | null>(null);
  const [currentRationale, setCurrentRationale] = useState<string | null>(null);

  // API key
  const [apiKey, setApiKeyState] = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Save feedback
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    setSegments(loadSegments());
    loadAudienceData().then((d) => { setAllData(d); setLoading(false); });
  }, []);

  const handleSaveKey = () => {
    const t = keyInput.trim();
    if (!t || !t.startsWith("sk-ant-")) { setKeyError("Please enter a valid Anthropic API key (starts with sk-ant-)"); return; }
    setAnthropicKey(t); setApiKeyState(t); setKeyInput(""); setKeyError(null); setShowKeyDialog(false);
  };

  const handleSave = () => {
    const cleanOutputs: Partial<Record<StratTab, StrategyOutput>> = {};
    (["brand", "comms", "ads"] as const).forEach((t) => {
      if (outputs[t]) cleanOutputs[t] = outputs[t]!;
    });
    saveOrchestrationPlan({
      productName, productCategory, productDescription, businessObjective,
      audienceLabel, audienceCount: audienceData.length,
      outputs: cleanOutputs,
      mediaPlan: currentMediaPlan ?? undefined,
      rationale: currentRationale ?? undefined,
    });
    refreshSaved();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleView = (p: SavedOrchestration) => {
    setProductName(p.productName);
    setProductCategory(p.productCategory);
    setProductDescription(p.productDescription);
    setBusinessObjective(p.businessObjective);
    setOutputs(p.outputs as Partial<Record<StratTab, StrategyOutput | null>>);
    setCurrentMediaPlan(p.mediaPlan ?? null);
    setCurrentRationale(p.rationale ?? null);
    setMainView("new");
    setActiveTab("brand");
  };

  const handleClone = (p: SavedOrchestration) => {
    setProductName(p.productName ? p.productName + " (copy)" : "");
    setProductCategory(p.productCategory);
    setProductDescription(p.productDescription);
    setBusinessObjective(p.businessObjective);
    setOutputs({});
    setCurrentMediaPlan(null);
    setCurrentRationale(null);
    setMainView("new");
    setActiveTab("brand");
  };

  const handleDelete = (id: string) => {
    deleteSavedPlan(id);
    refreshSaved();
  };

  const handlePdfFromSaved = (p: SavedOrchestration) => {
    downloadOrchestrationPdf({
      productName: p.productName,
      productCategory: p.productCategory,
      productDescription: p.productDescription,
      businessObjective: p.businessObjective,
      audienceLabel: p.audienceLabel,
      audienceCount: p.audienceCount,
      outputs: p.outputs as Partial<Record<string, StrategyOutput>>,
      mediaPlan: p.mediaPlan,
      rationale: p.rationale,
    });
  };

  const handleDownloadPdf = () => {
    const cleanOutputs: Partial<Record<string, StrategyOutput>> = {};
    (["brand", "comms", "ads"] as const).forEach((t) => {
      if (outputs[t]) cleanOutputs[t] = outputs[t]!;
    });
    downloadOrchestrationPdf({
      productName, productCategory, productDescription, businessObjective,
      audienceLabel, audienceCount: audienceData.length,
      outputs: cleanOutputs,
      mediaPlan: currentMediaPlan ?? undefined,
      rationale: currentRationale ?? undefined,
    });
  };

  const hasAnyOutput = Object.values(outputs).some(Boolean) || !!currentMediaPlan;

  const generateStrategy = useCallback(async (type: "brand" | "comms" | "ads") => {
    if (!productDescription.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setRunning((r) => ({ ...r, [type]: true }));
    setOutputs((o) => ({ ...o, [type]: null }));
    setApiError(null);
    const profile = buildAudienceProfile(audienceData, audienceLabel);
    const userMsg = `Audience: ${audienceLabel} (${audienceData.length} respondents)\n${profile}\n\nProduct/Service: ${productName || "(untitled)"}\nCategory: ${productCategory || "(none)"}\nDescription: ${productDescription}\nBusiness objective: ${businessObjective || "(none)"}`;
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: STRATEGY_PROMPTS[type].system, messages: [{ role: "user", content: userMsg }] }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        if (resp.status === 401) { deleteAnthropicKey(); setApiKeyState(null); throw new Error("Invalid API key."); }
        throw new Error(b?.error?.message || `API error ${resp.status}`);
      }
      const data = await resp.json();
      const raw = data.content?.[0]?.text ?? "";
      const json = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
      setOutputs((o) => ({ ...o, [type]: JSON.parse(json) as StrategyOutput }));
    } catch (err: any) {
      if (err.message?.includes("Invalid API key")) setShowKeyDialog(true);
      setApiError(err.message || "Something went wrong.");
    } finally {
      setRunning((r) => ({ ...r, [type]: false }));
    }
  }, [productDescription, apiKey, audienceData, audienceLabel, productName, productCategory, businessObjective]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top-level view toggle */}
      <div className="flex items-center gap-2 border-b border-surface-card-border pb-3">
        <button onClick={() => setMainView("new")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
            mainView === "new" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          New Plan
        </button>
        <button onClick={() => setMainView("saved")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
            mainView === "saved" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          Saved Plans
          {savedPlans.length > 0 && (
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full",
              mainView === "saved" ? "bg-white/20 text-white" : "bg-surface-dark text-hero-muted")}>
              {savedPlans.length}
            </span>
          )}
        </button>
      </div>

      {mainView === "saved" ? (
        <SavedPlansList
          plans={savedPlans}
          onView={handleView}
          onClone={handleClone}
          onDelete={handleDelete}
          onPdf={handlePdfFromSaved}
        />
      ) : (
        <>
          {/* Brief + audience */}
          <div className="rounded-xl bg-surface-card border border-surface-card-border p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider">Product / Service Brief</h3>
              <div className="flex items-center gap-2">
                {hasAnyOutput && (
                  <>
                    <Button size="sm" variant="outline" onClick={handleDownloadPdf}
                      className="border-surface-card-border text-hero-muted hover:text-glow-primary gap-1.5 text-xs h-7">
                      <FileText className="h-3 w-3" /> PDF
                    </Button>
                    <Button size="sm" onClick={handleSave}
                      className={cn("gap-1.5 text-xs h-7 transition-colors",
                        savedFeedback
                          ? "bg-green-600/20 text-green-400 border border-green-600/30"
                          : "bg-glow-primary/10 text-glow-primary border border-glow-primary/30 hover:bg-glow-primary/20")}>
                      <Save className="h-3 w-3" />
                      {savedFeedback ? "Saved!" : "Save"}
                    </Button>
                  </>
                )}
                <div className="w-56">
                  <AudienceSelector segments={segments} selectedId={selectedSegmentId} onChange={setSelectedSegmentId} count={audienceData.length} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-hero-muted uppercase tracking-wider">Product / Brand Name</label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Nike Air Max 2025"
                  className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-hero-muted uppercase tracking-wider">Category / Industry</label>
                <Input value={productCategory} onChange={(e) => setProductCategory(e.target.value)} placeholder="e.g. Footwear, Streaming"
                  className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-hero-muted uppercase tracking-wider">Business Objective</label>
                <Input value={businessObjective} onChange={(e) => setBusinessObjective(e.target.value)} placeholder="e.g. Drive trial, launch to new segment"
                  className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-hero-muted uppercase tracking-wider">Description <span className="text-destructive">*</span></label>
              <Textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe the product/service: features, benefits, price point, positioning, and what makes it different."
                rows={3} className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm resize-none" />
            </div>
            {!apiKey && (
              <button onClick={() => setShowKeyDialog(true)}
                className="flex items-center gap-2 text-xs text-glow-accent hover:underline">
                <Key className="h-3.5 w-3.5" /> Set Anthropic API key to enable AI generation
              </button>
            )}
            {apiError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{apiError}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-surface-card-border">
            <div className="flex gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={cn("flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                      activeTab === tab.id ? "border-glow-primary text-glow-primary" : "border-transparent text-hero-muted hover:text-hero-foreground")}>
                    <Icon className="h-3.5 w-3.5" />{tab.label}
                    {tab.id !== "media" && outputs[tab.id] && (
                      <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-glow-primary text-white text-[9px]">✓</Badge>
                    )}
                    {tab.id === "media" && currentMediaPlan && (
                      <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-glow-primary text-white text-[9px]">✓</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div>
            {(["brand","comms","ads"] as const).map((t) => activeTab === t && (
              <StrategyPanel key={t}
                output={outputs[t] ?? null}
                running={!!running[t]}
                onGenerate={() => generateStrategy(t)}
                label={TABS.find(x=>x.id===t)!.genLabel}
                disabled={!productDescription.trim()}
              />
            ))}
            {activeTab === "media" && (
              <MediaPlanTab
                audienceData={audienceData}
                audienceLabel={audienceLabel}
                productName={productName}
                apiKey={apiKey}
                onNeedKey={() => setShowKeyDialog(true)}
                onPlanChange={(plan, rat) => { setCurrentMediaPlan(plan); setCurrentRationale(rat); }}
              />
            )}
          </div>
        </>
      )}

      {/* API key dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-glow-primary" />Anthropic API Key</DialogTitle>
            <DialogDescription className="text-hero-muted">Required for AI-generated strategies. Stored locally in your browser only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input type="password" placeholder="sk-ant-api03-..." value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted" />
            {keyError && <p className="text-xs text-destructive">{keyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowKeyDialog(false)} className="text-hero-muted">Cancel</Button>
            <Button onClick={handleSaveKey} className="bg-glow-primary/20 text-glow-primary hover:bg-glow-primary/30 border border-glow-primary/40">Save Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orchestration;
