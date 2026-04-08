import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit2, ChevronRight, Sparkles, Users, HexagonIcon, Key, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import {
  loadSegments, saveSegments,
  applySegmentFilters, parseSegmentNL,
  GENDER_OPTIONS, AGE_OPTIONS, INCOME_OPTIONS,
  RULE_COLUMNS,
  type Segment, type SegmentFilter, type RefinementState,
} from "@/lib/segmentData";
import {
  getAnthropicKey, setAnthropicKey,
  parseSegmentWithAnthropic,
} from "@/lib/anthropicNlp";

// ─── Refinement chip group ────────────────────────────────────────

const RefinementGroup = ({
  label, options, active, onSelect,
}: {
  label: string;
  options: { label: string; values: string[] }[];
  active: string[];
  onSelect: (values: string[]) => void;
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-hero-muted uppercase tracking-wider w-16 flex-shrink-0">{label}</span>
    {options.map((o) => {
      const isActive = JSON.stringify(o.values.sort()) === JSON.stringify([...active].sort());
      return (
        <button
          key={o.label}
          onClick={() => onSelect(o.values)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            isActive
              ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
              : "border-surface-card-border text-hero-muted hover:border-glow-primary/50 hover:text-hero-foreground"
          )}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// ─── Segment card ─────────────────────────────────────────────────

const SegmentCard = ({
  segment, size, total, isActive, onSelect,
}: {
  segment: Segment; size: number; total: number; isActive: boolean; onSelect: () => void;
}) => {
  const pct = total > 0 ? ((size / total) * 100).toFixed(1) : "0";
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-xl border-2 p-5 cursor-pointer transition-all hover:-translate-y-0.5",
        isActive
          ? "border-glow-primary bg-glow-primary/5 shadow-md"
          : "border-surface-card-border bg-surface-card hover:border-glow-primary/40"
      )}
    >
      {isActive && (
        <span className="absolute top-3 right-3 text-[10px] font-bold bg-glow-primary text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          Active
        </span>
      )}
      <div className="text-3xl mb-2">{segment.icon}</div>
      <div className="font-bold text-hero-foreground text-base mb-1">{segment.name}</div>
      <div className="text-xs text-hero-muted leading-relaxed mb-3">{segment.desc}</div>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded bg-surface-dark border border-surface-card-border font-medium" style={{ color: segment.color || "hsl(var(--glow-primary))" }}>
          n={size.toLocaleString()}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-surface-dark border border-surface-card-border text-hero-muted">
          {pct}% of universe
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-surface-dark border border-surface-card-border text-hero-muted capitalize">
          {segment.method}
        </span>
      </div>
    </div>
  );
};

// ─── Rule row ─────────────────────────────────────────────────────

const RuleRow = ({
  filter, index, onUpdate, onRemove,
}: {
  filter: SegmentFilter;
  index: number;
  onUpdate: (idx: number, f: SegmentFilter) => void;
  onRemove: (idx: number) => void;
}) => {
  const col = RULE_COLUMNS.find((c) => c.field === filter.field) || RULE_COLUMNS[0];

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-dark border border-surface-card-border">
      {/* Column selector */}
      <select
        value={filter.field}
        onChange={(e) => onUpdate(index, { field: e.target.value as any, op: "in", values: [] })}
        className="flex-1 bg-surface-card border border-surface-card-border text-hero-foreground text-xs rounded-lg px-3 py-2 outline-none focus:border-glow-primary/60"
      >
        {RULE_COLUMNS.map((c) => (
          <option key={c.field} value={c.field}>{c.label}</option>
        ))}
      </select>

      {/* Value checkboxes (categorical) or op toggle (bool) */}
      <div className="flex-[2] flex flex-wrap gap-2">
        {col.type === "cat" && col.values?.map((v) => {
          const checked = filter.values.includes(v.v);
          return (
            <label key={v.v} className="flex items-center gap-1.5 text-xs text-hero-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...filter.values, v.v]
                    : filter.values.filter((x) => x !== v.v);
                  onUpdate(index, { ...filter, op: "in", values: next });
                }}
                className="accent-[hsl(var(--glow-primary))] w-3 h-3"
              />
              {v.l}
            </label>
          );
        })}
        {col.type === "bool" && (
          <div className="flex gap-2">
            {(["is_true", "is_false"] as const).map((op) => (
              <button
                key={op}
                onClick={() => onUpdate(index, { ...filter, op, values: [] })}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  filter.op === op
                    ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                    : "border-surface-card-border text-hero-muted hover:border-glow-primary/40"
                )}
              >
                {op === "is_true" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onRemove(index)} className="text-hero-muted hover:text-destructive p-1 mt-0.5">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ─── Segment form (create / edit) ─────────────────────────────────

const ICON_OPTIONS = ["👥", "💼", "🏃", "💰", "📱", "🎮", "✈️", "🎵", "🍳", "📚", "🏡", "💊", "🐾", "⚽", "🎨", "🛍️"];
const COLOR_OPTIONS = ["#004638", "#F5A825", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316", "#EF4444"];

const SegmentForm = ({
  initial, onSave, onCancel, data, apiKey, onNeedApiKey,
}: {
  initial: Partial<Segment> | null;
  onSave: (seg: Segment) => void;
  onCancel: () => void;
  data: AudienceRecord[];
  apiKey: string | null;
  onNeedApiKey: () => void;
}) => {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.desc || "");
  const [icon, setIcon] = useState(initial?.icon || "👥");
  const [color, setColor] = useState(initial?.color || "#004638");
  const [method, setMethod] = useState<"rules" | "nl">(initial?.method || "rules");
  const [filters, setFilters] = useState<SegmentFilter[]>(initial?.filters || []);
  const [nlText, setNlText] = useState(initial?.nlText || "");
  const [nlParsing, setNlParsing] = useState(false);
  const [nlParseError, setNlParseError] = useState<string | null>(null);

  const parseNLWithAI = async () => {
    if (!nlText.trim()) return;
    if (!apiKey) { onNeedApiKey(); return; }
    setNlParsing(true);
    setNlParseError(null);
    try {
      const result = await parseSegmentWithAnthropic(nlText, apiKey);
      if (result && result.length > 0) {
        setFilters(result);
        setMethod("rules");
      } else {
        setNlParseError("AI couldn't parse filters — try rephrasing.");
      }
    } catch (err: any) {
      setNlParseError(err.message || "Failed to parse with AI.");
    } finally {
      setNlParsing(false);
    }
  };

  const previewIndices = useMemo(() => {
    if (!data.length) return [];
    const f = method === "nl" ? parseSegmentNL(nlText) : filters;
    return applySegmentFilters(data, f, { gender: [], age: [], income: [] });
  }, [data, method, filters, nlText]);

  const handleSave = () => {
    if (!name.trim()) return;
    const f = method === "nl" ? parseSegmentNL(nlText) : filters;
    onSave({
      id: initial?.id || `seg_${Date.now()}`,
      name: name.trim(),
      desc: desc.trim(),
      icon, color, method,
      filters: f,
      nlText: method === "nl" ? nlText : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-surface-card-border bg-surface-card p-6 space-y-5">
      <h3 className="text-sm font-bold text-hero-foreground uppercase tracking-wider">
        {initial?.id ? "Edit Segment" : "New Segment"}
      </h3>

      {/* Name + icon + color */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-hero-muted uppercase tracking-wider">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fitness Enthusiasts"
            className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-hero-muted uppercase tracking-wider">Description</label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description"
            className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm" />
        </div>
      </div>

      {/* Icon picker */}
      <div className="space-y-1.5">
        <label className="text-xs text-hero-muted uppercase tracking-wider">Icon</label>
        <div className="flex gap-2 flex-wrap">
          {ICON_OPTIONS.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)}
              className={cn("text-xl w-9 h-9 rounded-lg border transition-colors flex items-center justify-center",
                icon === ic ? "border-glow-primary bg-glow-primary/10" : "border-surface-card-border hover:border-glow-primary/40")}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="space-y-1.5">
        <label className="text-xs text-hero-muted uppercase tracking-wider">Accent Color</label>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c ? "border-hero-foreground scale-110" : "border-transparent")}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* Method tabs */}
      <div className="space-y-3">
        <label className="text-xs text-hero-muted uppercase tracking-wider">Definition Method</label>
        <div className="flex gap-2">
          {(["rules", "nl"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={cn("px-4 py-1.5 rounded-full text-xs font-medium border transition-colors",
                method === m ? "bg-glow-primary/10 border-glow-primary text-glow-primary" : "border-surface-card-border text-hero-muted hover:border-glow-primary/40")}>
              {m === "rules" ? "Rule Builder" : "Natural Language"}
            </button>
          ))}
        </div>

        {/* Rule builder */}
        {method === "rules" && (
          <div className="space-y-2">
            {filters.map((f, i) => (
              <RuleRow key={i} filter={f} index={i}
                onUpdate={(idx, nf) => setFilters((prev) => prev.map((x, j) => j === idx ? nf : x))}
                onRemove={(idx) => setFilters((prev) => prev.filter((_, j) => j !== idx))}
              />
            ))}
            <Button size="sm" variant="outline" onClick={() => setFilters((prev) => [...prev, { field: "gender", op: "in", values: [] }])}
              className="border-surface-card-border text-hero-muted hover:text-hero-foreground text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
            </Button>
          </div>
        )}

        {/* NL builder */}
        {method === "nl" && (
          <div className="space-y-2">
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-glow-primary/60" />
              <Input
                value={nlText}
                onChange={(e) => { setNlText(e.target.value); setNlParseError(null); }}
                placeholder='e.g. "Young women who use Instagram and are interested in fitness"'
                className="pl-10 bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm"
                onKeyDown={(e) => e.key === "Enter" && parseNLWithAI()}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={parseNLWithAI} disabled={nlParsing || !nlText.trim()}
                className="bg-glow-primary/10 border border-glow-primary/40 text-glow-primary hover:bg-glow-primary/20 text-xs h-7">
                {nlParsing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {nlParsing ? "Parsing…" : "Parse with AI"}
              </Button>
              {!apiKey && (
                <button onClick={onNeedApiKey} className="text-xs text-glow-accent hover:underline flex items-center gap-1">
                  <Key className="h-3 w-3" /> Set API Key
                </button>
              )}
              {nlParseError && <span className="text-xs text-destructive">{nlParseError}</span>}
            </div>
            <p className="text-xs text-hero-muted">AI will convert your description into rules. Or save as-is and rules will be inferred automatically.</p>
          </div>
        )}
      </div>

      {/* Preview count */}
      {(filters.length > 0 || nlText.trim()) && (
        <div className="text-xs font-medium" style={{ color: color }}>
          Preview: {previewIndices.length.toLocaleString()} respondents ({data.length > 0 ? ((previewIndices.length / data.length) * 100).toFixed(1) : 0}% of universe)
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={!name.trim()}
          className="bg-glow-primary text-white hover:bg-glow-primary/90 text-xs">
          {initial?.id ? "Save Changes" : "Create Segment"}
        </Button>
        <Button variant="ghost" onClick={onCancel} className="text-hero-muted text-xs">Cancel</Button>
      </div>
    </div>
  );
};

// ─── Main AudienceBuilder ─────────────────────────────────────────

type BuilderMode = "segments" | "custom" | "manage";

interface AudienceBuilderProps {
  onAudienceChange?: (indices: number[], description: string) => void;
}

const AudienceBuilder = ({ onAudienceChange }: AudienceBuilderProps) => {
  const [mode, setMode] = useState<BuilderMode>("segments");
  const [segments, setSegments] = useState<Segment[]>(loadSegments);
  const [data, setData] = useState<AudienceRecord[]>([]);
  const [activeSegId, setActiveSegId] = useState<string | null>(null);
  const [refinement, setRefinement] = useState<RefinementState>({ gender: [], age: [], income: [] });
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customNL, setCustomNL] = useState("");
  const [customFilters, setCustomFilters] = useState<SegmentFilter[]>([]);
  const [customMode, setCustomMode] = useState<"nl" | "rules">("nl");
  const [customNLParsing, setCustomNLParsing] = useState(false);
  const [customNLError, setCustomNLError] = useState<string | null>(null);

  // API key state (shared with Audience Search)
  const [apiKey, setApiKeyState] = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed || !trimmed.startsWith("sk-ant-")) {
      setKeyError("Please enter a valid Anthropic API key (starts with sk-ant-)");
      return;
    }
    setAnthropicKey(trimmed);
    setApiKeyState(trimmed);
    setKeyInput("");
    setKeyError(null);
    setShowKeyDialog(false);
  };

  const parseCustomNLWithAI = async () => {
    if (!customNL.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setCustomNLParsing(true);
    setCustomNLError(null);
    try {
      const result = await parseSegmentWithAnthropic(customNL, apiKey);
      if (result && result.length > 0) {
        setCustomFilters(result);
        setCustomMode("rules");
      } else {
        setCustomNLError("AI couldn't parse filters — try rephrasing.");
      }
    } catch (err: any) {
      setCustomNLError(err.message || "Failed to parse with AI.");
    } finally {
      setCustomNLParsing(false);
    }
  };

  useEffect(() => {
    loadAudienceData().then(setData);
  }, []);

  // Compute segment sizes
  const segmentSizes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const seg of segments) {
      map[seg.id] = applySegmentFilters(data, seg.filters, { gender: [], age: [], income: [] }).length;
    }
    return map;
  }, [segments, data]);

  // Active audience indices (segment + refinement)
  const activeAudience = useMemo(() => {
    if (!activeSegId) return [];
    const seg = segments.find((s) => s.id === activeSegId);
    if (!seg) return [];
    return applySegmentFilters(data, seg.filters, refinement);
  }, [activeSegId, segments, data, refinement]);

  // Custom audience indices
  const customAudience = useMemo(() => {
    if (customMode === "nl") {
      const f = parseSegmentNL(customNL);
      return f.length ? applySegmentFilters(data, f, { gender: [], age: [], income: [] }) : [];
    }
    return customFilters.length ? applySegmentFilters(data, customFilters, { gender: [], age: [], income: [] }) : [];
  }, [customMode, customNL, customFilters, data]);

  const handleSelectSegment = (id: string) => {
    setActiveSegId(id);
    setRefinement({ gender: [], age: [], income: [] });
    const seg = segments.find((s) => s.id === id);
    if (seg && onAudienceChange) {
      const indices = applySegmentFilters(data, seg.filters, { gender: [], age: [], income: [] });
      onAudienceChange(indices, seg.name);
    }
  };

  useEffect(() => {
    if (!activeSegId || !onAudienceChange) return;
    const seg = segments.find((s) => s.id === activeSegId);
    if (seg) onAudienceChange(activeAudience, seg.name);
  }, [activeAudience]);

  const handleSaveSegment = (seg: Segment) => {
    const updated = editingSegment
      ? segments.map((s) => s.id === seg.id ? seg : s)
      : [...segments, seg];
    setSegments(updated);
    saveSegments(updated);
    setShowForm(false);
    setEditingSegment(null);
  };

  const handleDeleteSegment = (id: string) => {
    const updated = segments.filter((s) => s.id !== id);
    setSegments(updated);
    saveSegments(updated);
    if (activeSegId === id) setActiveSegId(null);
  };

  const activeSeg = segments.find((s) => s.id === activeSegId);
  const refinedDesc = activeSeg
    ? [activeSeg.name, ...[
        refinement.gender.length ? refinement.gender.join("/") : null,
        refinement.age.length ? refinement.age[0] + (refinement.age.length > 1 ? `–${refinement.age[refinement.age.length - 1]}` : "") : null,
        refinement.income.length ? refinement.income[0] : null,
      ].filter(Boolean)].join(" · ")
    : "";

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-surface-dark rounded-xl p-1 w-fit border border-surface-card-border">
        {(["segments", "custom", "manage"] as BuilderMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === m ? "bg-surface-card text-glow-primary shadow-sm border border-surface-card-border" : "text-hero-muted hover:text-hero-foreground")}>
            {m === "segments" ? "⬡ Segments" : m === "custom" ? "◎ Custom Audience" : "⚙ Manage"}
          </button>
        ))}
      </div>

      {/* ── SEGMENTS MODE ── */}
      {mode === "segments" && (
        <div className="space-y-6">
          {segments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-surface-card-border bg-surface-dark/40 flex flex-col items-center justify-center py-20 gap-4 text-center">
              <HexagonIcon className="h-10 w-10 text-hero-muted/30 stroke-1" />
              <div>
                <p className="text-hero-foreground font-medium">No segments defined yet</p>
                <p className="text-hero-muted text-sm mt-1">Switch to Manage to create your first segment</p>
              </div>
              <Button onClick={() => { setMode("manage"); setShowForm(true); }}
                className="bg-glow-accent text-white hover:bg-glow-accent/90 font-semibold tracking-wide uppercase text-xs px-6">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Segment
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {segments.map((seg) => (
                  <SegmentCard key={seg.id} segment={seg}
                    size={segmentSizes[seg.id] ?? 0}
                    total={data.length}
                    isActive={seg.id === activeSegId}
                    onSelect={() => handleSelectSegment(seg.id)}
                  />
                ))}
              </div>

              {/* Refinement panel */}
              {activeSegId && (
                <div className="rounded-xl border border-surface-card-border bg-surface-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-hero-foreground uppercase tracking-widest">Refine Segment</span>
                    <button onClick={() => setRefinement({ gender: [], age: [], income: [] })}
                      className="text-xs text-hero-muted hover:text-hero-foreground underline">Clear</button>
                  </div>
                  <RefinementGroup label="Gender" options={GENDER_OPTIONS} active={refinement.gender}
                    onSelect={(v) => setRefinement((r) => ({ ...r, gender: v }))} />
                  <RefinementGroup label="Age" options={AGE_OPTIONS} active={refinement.age}
                    onSelect={(v) => setRefinement((r) => ({ ...r, age: v }))} />
                  <RefinementGroup label="Income" options={INCOME_OPTIONS} active={refinement.income}
                    onSelect={(v) => setRefinement((r) => ({ ...r, income: v }))} />
                </div>
              )}

              {/* Result bar */}
              {activeSegId && (
                <div className="rounded-xl border border-glow-primary/30 bg-glow-primary/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs text-hero-muted uppercase tracking-wider mb-1">Active Audience</div>
                    <div className="font-bold text-hero-foreground">{refinedDesc}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-black text-glow-primary">{activeAudience.length.toLocaleString()}</div>
                      <div className="text-xs text-hero-muted">
                        {data.length > 0 ? ((activeAudience.length / data.length) * 100).toFixed(1) : 0}% of {data.length.toLocaleString()} respondents
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CUSTOM AUDIENCE MODE ── */}
      {mode === "custom" && (
        <div className="space-y-5">
          <div className="flex gap-2">
            {(["nl", "rules"] as const).map((m) => (
              <button key={m} onClick={() => setCustomMode(m)}
                className={cn("px-4 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  customMode === m ? "bg-glow-primary/10 border-glow-primary text-glow-primary" : "border-surface-card-border text-hero-muted hover:border-glow-primary/40")}>
                {m === "nl" ? "Natural Language" : "Rule Builder"}
              </button>
            ))}
          </div>

          {customMode === "nl" && (
            <div className="space-y-3">
              <div className="relative">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-glow-primary/60" />
                <Input value={customNL} onChange={(e) => { setCustomNL(e.target.value); setCustomNLError(null); }}
                  placeholder='e.g. "Young women who use Instagram and are interested in fitness"'
                  className="pl-10 h-12 bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
                  onKeyDown={(e) => e.key === "Enter" && parseCustomNLWithAI()} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={parseCustomNLWithAI} disabled={customNLParsing || !customNL.trim()}
                  className="bg-glow-primary/10 border border-glow-primary/40 text-glow-primary hover:bg-glow-primary/20 text-xs h-8">
                  {customNLParsing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  {customNLParsing ? "Parsing…" : "Parse with AI"}
                </Button>
                {!apiKey && (
                  <button onClick={() => setShowKeyDialog(true)} className="text-xs text-glow-accent hover:underline flex items-center gap-1">
                    <Key className="h-3 w-3" /> Set API Key
                  </button>
                )}
                {customNLError && <span className="text-xs text-destructive">{customNLError}</span>}
              </div>
              <p className="text-xs text-hero-muted">AI converts your description into rules. Or save as-is to use the description directly.</p>
            </div>
          )}

          {customMode === "rules" && (
            <div className="space-y-2">
              {customFilters.map((f, i) => (
                <RuleRow key={i} filter={f} index={i}
                  onUpdate={(idx, nf) => setCustomFilters((prev) => prev.map((x, j) => j === idx ? nf : x))}
                  onRemove={(idx) => setCustomFilters((prev) => prev.filter((_, j) => j !== idx))}
                />
              ))}
              <Button size="sm" variant="outline" onClick={() => setCustomFilters((prev) => [...prev, { field: "gender", op: "in", values: [] }])}
                className="border-surface-card-border text-hero-muted hover:text-hero-foreground text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
              </Button>
            </div>
          )}

          {/* Result */}
          {customAudience.length > 0 && (
            <div className="rounded-xl border border-glow-primary/30 bg-glow-primary/5 px-5 py-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-hero-muted uppercase tracking-wider mb-1">Custom Audience</div>
                <div className="font-medium text-hero-foreground text-sm">{customNL || `${customFilters.length} rule${customFilters.length !== 1 ? "s" : ""} applied`}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-glow-primary">{customAudience.length.toLocaleString()}</div>
                <div className="text-xs text-hero-muted">{data.length > 0 ? ((customAudience.length / data.length) * 100).toFixed(1) : 0}% of universe</div>
              </div>
            </div>
          )}

          {customAudience.length > 0 && (
            <Button onClick={() => {
              const f = customMode === "nl" ? parseSegmentNL(customNL) : customFilters;
              const newSeg: Segment = {
                id: `seg_${Date.now()}`, name: customNL || "Custom Audience",
                desc: "Created from custom criteria", icon: "◎", color: "#004638",
                method: customMode, filters: f, nlText: customMode === "nl" ? customNL : undefined,
              };
              const updated = [...segments, newSeg];
              setSegments(updated); saveSegments(updated);
              setMode("segments");
            }}
              size="sm" variant="outline"
              className="border-glow-primary/40 text-glow-primary hover:bg-glow-primary/10 text-xs">
              Save as Segment <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* ── MANAGE MODE ── */}
      {mode === "manage" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-hero-foreground uppercase tracking-widest">Segment Library</h3>
            <Button size="sm" onClick={() => { setEditingSegment(null); setShowForm(true); }}
              className="bg-glow-accent text-white hover:bg-glow-accent/90 text-xs uppercase tracking-wide">
              <Plus className="h-3.5 w-3.5 mr-1" /> New Segment
            </Button>
          </div>

          {showForm && (
            <SegmentForm
              initial={editingSegment}
              data={data}
              onSave={handleSaveSegment}
              onCancel={() => { setShowForm(false); setEditingSegment(null); }}
              apiKey={apiKey}
              onNeedApiKey={() => setShowKeyDialog(true)}
            />
          )}

          {segments.length === 0 && !showForm ? (
            <div className="text-hero-muted text-sm py-6 text-center">No segments yet. Click "+ New Segment" to create one.</div>
          ) : (
            <div className="space-y-2">
              {segments.map((seg) => (
                <div key={seg.id} className="flex items-center gap-4 p-4 rounded-xl border border-surface-card-border bg-surface-card hover:border-glow-primary/30 transition-colors">
                  <span className="text-2xl w-8">{seg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-hero-foreground text-sm">{seg.name}</div>
                    <div className="text-xs text-hero-muted mt-0.5">
                      {seg.desc} · n={segmentSizes[seg.id]?.toLocaleString() ?? "—"} · {seg.method}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingSegment(seg); setShowForm(true); }}
                      className="border-surface-card-border text-hero-muted hover:text-hero-foreground text-xs h-7 px-2.5">
                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteSegment(seg.id)}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-7 px-2.5">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-glow-primary" />
              Anthropic API Key
            </DialogTitle>
            <DialogDescription className="text-hero-muted">
              Enter your Anthropic API key to enable AI-powered natural language parsing. The key is stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
            />
            {keyError && <p className="text-xs text-destructive">{keyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowKeyDialog(false)} className="text-hero-muted">Cancel</Button>
            <Button onClick={handleSaveKey} className="bg-glow-primary/20 text-glow-primary hover:bg-glow-primary/30 border border-glow-primary/40">
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudienceBuilder;
