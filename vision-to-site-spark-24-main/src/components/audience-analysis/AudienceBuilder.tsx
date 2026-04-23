import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Edit2, Sparkles, Users, HexagonIcon,
  Key, Loader2, BarChart2, Pencil, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import {
  loadSegments, saveSegments,
  applySegmentFilters, parseSegmentNL,
  RULE_COLUMNS,
  type Segment, type SegmentFilter,
} from "@/lib/segmentData";
import {
  getAnthropicKey, setAnthropicKey,
  parseSegmentWithAnthropic,
} from "@/lib/anthropicNlp";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_OPTIONS = ["#004638", "#F5A825", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316", "#EF4444"];

// ─── Universe projection ──────────────────────────────────────────────────────
const TOTAL_UNIVERSE = 600_000_000; // 600M deployable audience

/** Convert a survey match % into a projected real-world reach from 600M universe */
function projectedReach(matchCount: number, surveyTotal: number): number {
  if (surveyTotal === 0) return 0;
  return Math.round((matchCount / surveyTotal) * TOTAL_UNIVERSE);
}

/** Format large numbers as e.g. 299.4M, 37.8M, 850K */
function fmtReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

type BuilderMode = "build" | "manage";

// ─── Rule row ─────────────────────────────────────────────────────────────────

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
      <select
        value={filter.field}
        onChange={(e) => onUpdate(index, { field: e.target.value as any, op: "in", values: [] })}
        className="flex-1 bg-surface-card border border-surface-card-border text-hero-foreground text-xs rounded-lg px-3 py-2 outline-none focus:border-glow-primary/60"
      >
        {RULE_COLUMNS.map((c) => (
          <option key={c.field} value={c.field}>{c.label}</option>
        ))}
      </select>

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

// ─── Main AudienceBuilder ─────────────────────────────────────────────────────

interface AudienceBuilderProps {
  onAudienceChange?: (indices: number[], description: string) => void;
  onViewIntelligence?: (segId: string) => void;
}

const AudienceBuilder = ({ onAudienceChange, onViewIntelligence }: AudienceBuilderProps) => {
  const [mode, setMode] = useState<BuilderMode>("build");
  const [segments, setSegments] = useState<Segment[]>(loadSegments);
  const [data, setData] = useState<AudienceRecord[]>([]);

  // ── Build form state ────────────────────────────────────────────
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#004638");
  const [method, setMethod] = useState<"nl" | "rules">("nl");
  const [nlText, setNlText] = useState("");
  const [filters, setFilters] = useState<SegmentFilter[]>([]);
  const [nlParsing, setNlParsing] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);

  // ── Rename inline state ─────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Delete confirm ──────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── API key ─────────────────────────────────────────────────────
  const [apiKey, setApiKeyState] = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    loadAudienceData().then(setData);
  }, []);

  // ── Segment sizes ────────────────────────────────────────────────
  const segmentSizes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const seg of segments) {
      map[seg.id] = applySegmentFilters(data, seg.filters, { gender: [], age: [], income: [] }).length;
    }
    return map;
  }, [segments, data]);

  // ── Preview count ────────────────────────────────────────────────
  const previewAudience = useMemo(() => {
    if (method === "nl") {
      const f = parseSegmentNL(nlText);
      return f.length ? applySegmentFilters(data, f, { gender: [], age: [], income: [] }) : [];
    }
    return filters.length ? applySegmentFilters(data, filters, { gender: [], age: [], income: [] }) : [];
  }, [method, nlText, filters, data]);

  // ── Reset build form ─────────────────────────────────────────────
  const resetForm = () => {
    setEditingSegment(null);
    setName("");
    setDesc("");
    setColor("#004638");
    setMethod("nl");
    setNlText("");
    setFilters([]);
    setNlError(null);
  };

  const loadIntoForm = (seg: Segment) => {
    setEditingSegment(seg);
    setName(seg.name);
    setDesc(seg.desc || "");
    setColor(seg.color || "#004638");
    setMethod(seg.method || "nl");
    setNlText(seg.nlText || "");
    setFilters(seg.filters || []);
    setNlError(null);
    setMode("build");
  };

  // ── API key ──────────────────────────────────────────────────────
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

  // ── NL parse ────────────────────────────────────────────────────
  const parseNLWithAI = async () => {
    if (!nlText.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setNlParsing(true);
    setNlError(null);
    try {
      const result = await parseSegmentWithAnthropic(nlText, apiKey);
      if (result && result.length > 0) {
        setFilters(result);
        setMethod("rules");
      } else {
        setNlError("AI couldn't parse filters — try rephrasing.");
      }
    } catch (err: any) {
      setNlError(err.message || "Failed to parse with AI.");
    } finally {
      setNlParsing(false);
    }
  };

  // ── Save audience ────────────────────────────────────────────────
  const handleSave = () => {
    if (!name.trim()) return;
    const f = method === "nl" ? parseSegmentNL(nlText) : filters;
    const seg: Segment = {
      id: editingSegment?.id || `seg_${Date.now()}`,
      name: name.trim(),
      desc: desc.trim() || "Custom audience",
      icon: "◎", color, method,
      filters: f,
      nlText: method === "nl" ? nlText : undefined,
    };
    const updated = editingSegment
      ? segments.map((s) => s.id === seg.id ? seg : s)
      : [...segments, seg];
    setSegments(updated);
    saveSegments(updated);
    resetForm();
    setMode("manage");
  };

  // ── Delete ───────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    const updated = segments.filter((s) => s.id !== id);
    setSegments(updated);
    saveSegments(updated);
    setDeleteConfirmId(null);
  };

  // ── Rename ───────────────────────────────────────────────────────
  const startRename = (seg: Segment) => {
    setRenamingId(seg.id);
    setRenameValue(seg.name);
  };

  const commitRename = () => {
    if (!renameValue.trim() || !renamingId) { setRenamingId(null); return; }
    const updated = segments.map((s) =>
      s.id === renamingId ? { ...s, name: renameValue.trim() } : s
    );
    setSegments(updated);
    saveSegments(updated);
    setRenamingId(null);
  };

  const hasContent = name.trim() && (
    (method === "nl" && nlText.trim()) ||
    (method === "rules" && filters.length > 0)
  );

  return (
    <div className="space-y-6">

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-dark rounded-xl p-1 w-fit border border-surface-card-border">
        {([
          { id: "build",  label: "◎ Build Audience" },
          { id: "manage", label: "⚙ Manage" },
        ] as { id: BuilderMode; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setMode(tab.id); if (tab.id === "build" && !editingSegment) resetForm(); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === tab.id
                ? "bg-surface-card text-glow-primary shadow-sm border border-surface-card-border"
                : "text-hero-muted hover:text-hero-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BUILD AUDIENCE ───────────────────────────────────────── */}
      {mode === "build" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-surface-card-border bg-surface-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-hero-foreground uppercase tracking-wider">
              {editingSegment ? "Edit Audience" : "New Audience"}
            </h3>

            {/* Name + Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-hero-muted uppercase tracking-wider">
                  Audience Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Premium Fitness Enthusiasts"
                  className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-hero-muted uppercase tracking-wider">Description</label>
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm"
                />
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-hero-muted uppercase tracking-wider">Accent Colour</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all",
                      color === c ? "border-hero-foreground scale-110" : "border-transparent"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Method toggle */}
            <div className="space-y-3">
              <label className="text-xs text-hero-muted uppercase tracking-wider">Definition Method</label>
              <div className="flex gap-2">
                {(["nl", "rules"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      method === m
                        ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                        : "border-surface-card-border text-hero-muted hover:border-glow-primary/40"
                    )}
                  >
                    {m === "nl" ? "Natural Language" : "Rule Builder"}
                  </button>
                ))}
              </div>

              {/* Natural Language */}
              {method === "nl" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-glow-primary/60" />
                    <Input
                      value={nlText}
                      onChange={(e) => { setNlText(e.target.value); setNlError(null); }}
                      placeholder='e.g. "Young women who use Instagram and are interested in fitness"'
                      className="pl-10 bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted text-sm"
                      onKeyDown={(e) => e.key === "Enter" && parseNLWithAI()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={parseNLWithAI}
                      disabled={nlParsing || !nlText.trim()}
                      className="bg-glow-primary/10 border border-glow-primary/40 text-glow-primary hover:bg-glow-primary/20 text-xs h-7"
                    >
                      {nlParsing
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <Sparkles className="h-3 w-3 mr-1" />}
                      {nlParsing ? "Parsing…" : "Parse with AI"}
                    </Button>
                    {!apiKey && (
                      <button
                        onClick={() => setShowKeyDialog(true)}
                        className="text-xs text-glow-accent hover:underline flex items-center gap-1"
                      >
                        <Key className="h-3 w-3" /> Set API Key
                      </button>
                    )}
                    {nlError && <span className="text-xs text-destructive">{nlError}</span>}
                  </div>
                  <p className="text-xs text-hero-muted">
                    AI converts your description into rules. Or save as-is and rules will be inferred automatically.
                  </p>
                </div>
              )}

              {/* Rule Builder */}
              {method === "rules" && (
                <div className="space-y-2">
                  {filters.map((f, i) => (
                    <RuleRow
                      key={i}
                      filter={f}
                      index={i}
                      onUpdate={(idx, nf) => setFilters((prev) => prev.map((x, j) => j === idx ? nf : x))}
                      onRemove={(idx) => setFilters((prev) => prev.filter((_, j) => j !== idx))}
                    />
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFilters((prev) => [...prev, { field: "gender", op: "in", values: [] }])}
                    className="border-surface-card-border text-hero-muted hover:text-hero-foreground text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                  </Button>
                </div>
              )}
            </div>

            {/* Preview */}
            {hasContent && (
              <div className="rounded-lg border border-glow-primary/30 bg-glow-primary/5 px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-hero-muted uppercase tracking-wider mb-0.5">Projected Reach</div>
                  <div className="text-xs text-hero-muted/60">
                    Based on {((previewAudience.length / (data.length || 1)) * 100).toFixed(1)}% match · 600M universe
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black" style={{ color }}>
                    ~{fmtReach(projectedReach(previewAudience.length, data.length))}
                  </div>
                  <div className="text-xs text-hero-muted">
                    n={previewAudience.length.toLocaleString()} in survey
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={!name.trim()}
                className="bg-glow-primary text-white hover:bg-glow-primary/90 text-xs"
              >
                {editingSegment ? "Save Changes" : "Save Audience"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { resetForm(); setMode("manage"); }}
                className="text-hero-muted text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE ───────────────────────────────────────────────── */}
      {mode === "manage" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-hero-foreground uppercase tracking-widest">
              Audience Library
              <span className="ml-2 text-hero-muted font-normal normal-case tracking-normal">
                {segments.length} audience{segments.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <Button
              size="sm"
              onClick={() => { resetForm(); setMode("build"); }}
              className="bg-glow-accent text-white hover:bg-glow-accent/90 text-xs uppercase tracking-wide"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Build Audience
            </Button>
          </div>

          {segments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-surface-card-border bg-surface-dark/40 flex flex-col items-center justify-center py-20 gap-4 text-center">
              <HexagonIcon className="h-10 w-10 text-hero-muted/30 stroke-1" />
              <div>
                <p className="text-hero-foreground font-medium">No audiences yet</p>
                <p className="text-hero-muted text-sm mt-1">Build your first audience to get started</p>
              </div>
              <Button
                onClick={() => { resetForm(); setMode("build"); }}
                className="bg-glow-accent text-white hover:bg-glow-accent/90 font-semibold text-xs px-6"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Build Audience
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {segments.map((seg) => {
                const size = segmentSizes[seg.id] ?? 0;
                const pct = data.length > 0 ? ((size / data.length) * 100).toFixed(1) : "0";
                const reach = projectedReach(size, data.length);
                const isRenaming = renamingId === seg.id;
                const isDeleteConfirm = deleteConfirmId === seg.id;

                return (
                  <div
                    key={seg.id}
                    className="rounded-xl border border-surface-card-border bg-surface-card hover:border-glow-primary/30 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Icon */}
                      <span className="text-2xl w-8 flex-shrink-0">{seg.icon}</span>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="h-7 text-sm bg-surface-dark border-glow-primary/40 text-hero-foreground w-48"
                            />
                            <button
                              onClick={commitRename}
                              className="text-green-500 hover:text-green-400 p-0.5"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              className="text-hero-muted hover:text-hero-foreground p-0.5"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="font-semibold text-hero-foreground text-sm">{seg.name}</div>
                        )}
                        <div className="text-xs text-hero-muted mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{seg.desc}</span>
                          <span className="text-hero-muted/40">·</span>
                          <span style={{ color: seg.color || "#004638" }} className="font-semibold">
                            ~{fmtReach(reach)} reach
                          </span>
                          <span className="text-hero-muted/40">·</span>
                          <span>{pct}% of 600M</span>
                          <span className="text-hero-muted/40">·</span>
                          <span className="text-hero-muted/60">n={size.toLocaleString()} survey</span>
                          <span className="text-hero-muted/40">·</span>
                          <span className="capitalize">{seg.method}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isDeleteConfirm && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {/* Edit */}
                          <button
                            onClick={() => loadIntoForm(seg)}
                            title="Edit audience"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-surface-card-border text-hero-muted hover:text-hero-foreground hover:border-glow-primary/40 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>

                          {/* Rename */}
                          <button
                            onClick={() => startRename(seg)}
                            title="Rename audience"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-surface-card-border text-hero-muted hover:text-hero-foreground hover:border-glow-primary/40 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Rename
                          </button>

                          {/* Intelligence Report */}
                          <button
                            onClick={() => onViewIntelligence?.(seg.id)}
                            title="View Audience Profile"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-glow-primary/30 text-glow-primary hover:bg-glow-primary/10 transition-colors"
                          >
                            <BarChart2 className="h-3 w-3" />
                            Intelligence Report
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirmId(seg.id)}
                            title="Delete audience"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Delete confirm inline */}
                      {isDeleteConfirm && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-hero-muted">Delete "{seg.name}"?</span>
                          <button
                            onClick={() => handleDelete(seg.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-card-border text-hero-muted hover:text-hero-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── API Key Dialog ────────────────────────────────────────── */}
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
            <Button
              onClick={handleSaveKey}
              className="bg-glow-primary/20 text-glow-primary hover:bg-glow-primary/30 border border-glow-primary/40"
            >
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudienceBuilder;
