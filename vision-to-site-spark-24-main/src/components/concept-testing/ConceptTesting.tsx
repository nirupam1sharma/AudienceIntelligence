import { useState, useEffect, useMemo } from "react";
import {
  FlaskConical, Megaphone, Package, MessageSquare, Lightbulb,
  ChevronDown, Check, Loader2, RotateCcw, Key, AlertTriangle,
  TrendingUp, Users, Star, Zap, BookMarked, Copy, Trash2,
  Download, Save, Clock, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import { loadSegments, applySegmentFilters, type Segment } from "@/lib/segmentData";
import { getAnthropicKey, setAnthropicKey, deleteAnthropicKey } from "@/lib/anthropicNlp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { ConceptType, ConceptResult } from "@/lib/conceptTestTypes";
import {
  loadSavedTests, saveConceptTest, deleteSavedTest,
  type SavedConceptTest,
} from "@/lib/conceptTestStorage";
import { downloadConceptTestPdf } from "@/lib/reportDownload";

// ─── Constants ────────────────────────────────────────────────────

const CONCEPT_TYPES: { id: ConceptType; label: string; icon: typeof Megaphone; placeholder: string }[] = [
  {
    id: "ad", label: "Ad / Campaign", icon: Megaphone,
    placeholder: "Describe the creative idea, headline, visual direction, call to action, and media context. E.g. 'A 30-second TV spot showing a family using our product at breakfast. Headline: Start Every Day Right. CTA: Try free for 30 days.'",
  },
  {
    id: "product", label: "Product", icon: Package,
    placeholder: "Describe features, benefits, price point, use cases, and how it differs from alternatives. E.g. 'A smart water bottle with hydration reminders, $49 retail. Tracks daily intake and syncs with health apps.'",
  },
  {
    id: "message", label: "Message", icon: MessageSquare,
    placeholder: "Describe the tagline, message, copy, and context about where it would appear. E.g. 'Tagline: Life's too short for bad coffee. To appear in social ads targeting 25-44 urban coffee drinkers.'",
  },
  {
    id: "brand", label: "Brand Idea", icon: Lightbulb,
    placeholder: "Describe the positioning, values, personality, tone, visual identity, and the feeling it should evoke. E.g. 'Premium but approachable. Bold colours, playful tone. Should feel like a knowledgeable friend, not a corporate brand.'",
  },
];

const DIMENSIONS = [
  { id: "relevance",           label: "Relevance",           desc: "Speaks to the audience's life, needs, and interests" },
  { id: "appeal",              label: "Appeal",               desc: "Attractive, enjoyable, and engaging" },
  { id: "purchase_intent",     label: "Purchase Intent",      desc: "Likelihood to buy, try, or sign up" },
  { id: "clarity",             label: "Message Clarity",      desc: "Clear and easy to understand" },
  { id: "uniqueness",          label: "Uniqueness",           desc: "Feels fresh, different, stands out" },
  { id: "brand_trust",         label: "Brand Trust",          desc: "Makes them trust the brand more" },
  { id: "shareability",        label: "Shareability",         desc: "Would share on social media" },
  { id: "emotional_resonance", label: "Emotional Resonance",  desc: "Connects emotionally" },
];

const LOADING_MESSAGES = [
  "Building audience psychographic profile…",
  "Simulating consumer reactions…",
  "Scoring concept across dimensions…",
  "Synthesising verbatims and insights…",
  "Generating optimization recommendations…",
];

// ─── Helpers ─────────────────────────────────────────────────────

function buildAudienceProfile(data: AudienceRecord[]): string {
  if (data.length === 0) return "No audience data available.";
  const n = data.length;
  const pct = (k: keyof AudienceRecord, val?: string) =>
    val !== undefined
      ? Math.round(data.filter((r) => r[k] === val).length / n * 100)
      : Math.round(data.filter((r) => r[k] === true).length / n * 100);

  const genderCounts: Record<string, number> = {};
  const ageCounts: Record<string, number> = {};
  data.forEach((r) => {
    genderCounts[r.gender] = (genderCounts[r.gender] || 0) + 1;
    ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1;
  });
  const topAge = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const interests = [
    ["Sports","interest_sports"],["Health/Wellness","interest_health_wellness"],
    ["Music","interest_music"],["Travel","interest_travel"],["Movies","interest_movies"],
    ["Fitness","interest_fitness"],["Technology","interest_technology"],
  ].map(([label, key]) => ({ label, p: pct(key as keyof AudienceRecord) }))
   .sort((a, b) => b.p - a.p).slice(0, 5).map((i) => `${i.label} (${i.p}%)`).join(", ");

  return [
    `n=${n} respondents`,
    `Female ${pct("gender","Female")}%, Male ${pct("gender","Male")}%`,
    `Top age group: ${topAge}`,
    `High income: ${pct("is_high_income")}%  Daily social active: ${pct("is_social_active_daily")}%`,
    `Top interests: ${interests}`,
    `Facebook ${pct("facebook_usage")}% | YouTube ${pct("youtube_usage")}% | Instagram ${pct("instagram_usage")}%`,
  ].join("\n");
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}
function verdictBorder(score: number) {
  if (score >= 70) return "border-green-400/40 bg-green-400/5";
  if (score >= 50) return "border-yellow-400/40 bg-yellow-400/5";
  return "border-red-400/40 bg-red-400/5";
}
function sentimentBorder(s: string) {
  if (s === "positive") return "border-green-400 bg-green-400/5";
  if (s === "negative") return "border-red-400 bg-red-400/5";
  return "border-surface-card-border bg-surface-card";
}

// ─── Audience Selector ────────────────────────────────────────────

interface AudienceSelectorProps {
  segments: Segment[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  count: number;
}
const AudienceSelector = ({ segments, selectedId, onChange, count }: AudienceSelectorProps) => {
  const [open, setOpen] = useState(false);
  const selected = segments.find((s) => s.id === selectedId);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-surface-card-border bg-surface-dark text-xs text-hero-foreground hover:border-glow-primary/50 transition-colors w-full"
      >
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

// ─── Results Panel ────────────────────────────────────────────────

interface ResultsPanelProps {
  result: ConceptResult;
  conceptType: ConceptType;
  conceptName: string;
  category: string;
  description: string;
  audienceLabel: string;
  audienceCount: number;
  savedAt?: string;
  isSaved: boolean;
  onSave: () => void;
  onRerun: () => void;
  onNewTest: () => void;
  onDownloadPdf: () => void;
}

const ResultsPanel = ({
  result, conceptType, conceptName, category, description,
  audienceLabel, audienceCount, savedAt, isSaved, onSave, onRerun, onNewTest, onDownloadPdf,
}: ResultsPanelProps) => {
  const typeDef = CONCEPT_TYPES.find((c) => c.id === conceptType)!;
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] border-glow-primary/40 text-glow-primary uppercase">
              {typeDef.label}
            </Badge>
            <span className="text-sm font-semibold text-hero-foreground">{conceptName || "Untitled Concept"}</span>
            {category && <span className="text-xs text-hero-muted">· {category}</span>}
            <span className="text-xs text-hero-muted">· {audienceLabel}</span>
            {savedAt && (
              <span className="text-xs text-hero-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(savedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="text-xs text-hero-muted mt-1 line-clamp-1 max-w-xl">{description}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onDownloadPdf}
            className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          {!isSaved && (
            <Button size="sm" variant="outline" onClick={onSave}
              className="border-glow-primary/40 text-glow-primary hover:bg-glow-primary/10 gap-1.5 text-xs">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          )}
          {isSaved && (
            <Badge variant="outline" className="border-glow-primary/40 text-glow-primary text-xs px-2 py-1 flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={onRerun}
            className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Re-run
          </Button>
          <Button size="sm" variant="outline" onClick={onNewTest}
            className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs">
            ← New Test
          </Button>
        </div>
      </div>

      {/* Overall score */}
      <div className={cn("rounded-xl border p-6 flex flex-col sm:flex-row items-center gap-6", verdictBorder(result.overall_score))}>
        <div className="text-center">
          <div className={cn("text-6xl font-extrabold tabular-nums leading-none", scoreColor(result.overall_score))}>
            {result.overall_score}
          </div>
          <div className="text-xs text-hero-muted mt-1">/ 100</div>
        </div>
        <div className="flex-1">
          <div className={cn("text-lg font-bold", scoreColor(result.overall_score))}>{result.verdict_label}</div>
          <p className="text-sm text-hero-foreground/80 mt-1">{result.verdict_text}</p>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-hero-muted">{result.positive_pct}% likely to engage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-hero-muted">{result.negative_pct}% unlikely to engage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dimension scores */}
      <div>
        <h3 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider mb-3">Dimension Scores</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {result.dimensions.map((dim) => (
            <div key={dim.name} className="rounded-xl bg-surface-card border border-surface-card-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-hero-muted uppercase tracking-wider">{dim.name}</span>
                <span className={cn("text-xl font-bold tabular-nums", scoreColor(dim.score))}>{dim.score}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-dark overflow-hidden">
                <div className={cn("h-full rounded-full", dim.score >= 70 ? "bg-green-400" : dim.score >= 50 ? "bg-yellow-400" : "bg-red-400")}
                  style={{ width: `${dim.score}%` }} />
              </div>
              <p className="text-[10px] text-hero-muted leading-relaxed">{dim.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Strengths</h4>
          </div>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-hero-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Weaknesses / Risks</h4>
          </div>
          <ul className="space-y-2">
            {result.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-hero-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />{w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Segment reactions */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-glow-accent" />
          <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Segment Reactions</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.segment_reactions.map((sr, i) => (
            <div key={i} className={cn("p-3 rounded-lg border-l-2 text-xs", sentimentBorder(sr.sentiment))}>
              <div className="font-semibold text-hero-foreground mb-1">{sr.segment}</div>
              <p className="text-hero-foreground/70">{sr.reaction}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Verbatims */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-glow-primary" />
          <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Consumer Verbatims</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {result.verbatims.map((v, i) => (
            <div key={i} className={cn("p-4 rounded-xl border-l-2", sentimentBorder(v.sentiment))}>
              <p className="text-xs text-hero-foreground italic leading-relaxed">"{v.quote}"</p>
              <p className="text-[10px] text-hero-muted mt-2">— {v.persona}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Optimization Recommendations</h4>
        </div>
        <div className="space-y-2">
          {result.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-hero-foreground/80">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Saved Tests List ─────────────────────────────────────────────

interface SavedTestsListProps {
  tests: SavedConceptTest[];
  onView: (t: SavedConceptTest) => void;
  onClone: (t: SavedConceptTest) => void;
  onDelete: (id: string) => void;
}

const SavedTestsList = ({ tests, onView, onClone, onDelete }: SavedTestsListProps) => {
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <BookMarked className="h-10 w-10 text-hero-muted/30 stroke-1" />
        <p className="text-hero-foreground font-medium">No saved tests yet</p>
        <p className="text-hero-muted text-sm">Run a concept test and click Save to store results here.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tests.map((t) => {
        const typeDef = CONCEPT_TYPES.find((c) => c.id === t.conceptType);
        const TypeIcon = typeDef?.icon ?? FlaskConical;
        return (
          <div key={t.id} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-4 hover:border-glow-primary/30 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-glow-primary/10 border border-glow-primary/20 flex items-center justify-center shrink-0">
                  <TypeIcon className="h-4 w-4 text-glow-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-hero-foreground truncate">{t.conceptName || "Untitled Concept"}</p>
                  <p className="text-[10px] text-hero-muted">{typeDef?.label} · {t.audienceLabel}</p>
                </div>
              </div>
              {/* Score badge */}
              <div className={cn("shrink-0 text-xl font-extrabold tabular-nums", scoreColor(t.result.overall_score))}>
                {t.result.overall_score}
                <span className="text-xs text-hero-muted font-normal">/100</span>
              </div>
            </div>

            {/* Verdict + meta */}
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-medium", scoreColor(t.result.overall_score))}>
                {t.result.verdict_label}
              </span>
              <span className="text-[10px] text-hero-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(t.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>

            {/* Description snippet */}
            <p className="text-[10px] text-hero-muted line-clamp-2">{t.description}</p>

            {/* Dimension mini bars */}
            <div className="grid grid-cols-4 gap-1">
              {t.result.dimensions.slice(0, 4).map((d) => (
                <div key={d.name} className="space-y-0.5">
                  <div className="text-[9px] text-hero-muted truncate">{d.name}</div>
                  <div className="h-1 rounded-full bg-surface-dark overflow-hidden">
                    <div className={cn("h-full rounded-full", d.score >= 70 ? "bg-green-400" : d.score >= 50 ? "bg-yellow-400" : "bg-red-400")}
                      style={{ width: `${d.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-surface-card-border">
              <Button size="sm" variant="ghost" onClick={() => onView(t)}
                className="flex-1 text-xs text-glow-primary hover:bg-glow-primary/10 gap-1.5 h-7">
                <ChevronRight className="h-3.5 w-3.5" /> View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onClone(t)}
                className="flex-1 text-xs text-hero-muted hover:text-hero-foreground gap-1.5 h-7">
                <Copy className="h-3.5 w-3.5" /> Clone
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadConceptTestPdf({
                conceptType: t.conceptType,
                conceptName: t.conceptName,
                category: t.category,
                description: t.description,
                audienceLabel: t.audienceLabel,
                audienceCount: t.audienceCount,
                savedAt: t.savedAt,
                result: t.result,
              })}
                className="flex-1 text-xs text-hero-muted hover:text-hero-foreground gap-1.5 h-7">
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)}
                className="h-7 w-7 p-0 text-hero-muted hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const ConceptTesting = () => {
  const [allData, setAllData] = useState<AudienceRecord[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  // View: "form" | "saved"
  const [view, setView] = useState<"form" | "saved">("form");
  const [savedTests, setSavedTests] = useState<SavedConceptTest[]>([]);

  // Audience
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const segmentSets = useMemo<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    if (!segments?.length || !allData?.length) return m;
    for (const seg of segments) {
      const idxs = applySegmentFilters(allData, seg.filters, { gender: [], age: [], income: [] });
      m.set(seg.id, new Set(idxs.map((i) => String(allData[i].respondent_id))));
    }
    return m;
  }, [allData, segments]);

  const audienceData = useMemo(() => {
    if (!selectedSegmentId) return allData;
    const set = segmentSets.get(selectedSegmentId);
    return set ? allData.filter((r) => set.has(String(r.respondent_id))) : allData;
  }, [allData, selectedSegmentId, segmentSets]);

  const audienceLabel = useMemo(() => {
    if (!selectedSegmentId) return "All Respondents";
    const seg = segments.find((s) => s.id === selectedSegmentId);
    return seg ? `${seg.icon} ${seg.name}` : "Selected Segment";
  }, [selectedSegmentId, segments]);

  // Form state
  const [conceptType, setConceptType] = useState<ConceptType>("ad");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [activeDims, setActiveDims] = useState<Set<string>>(
    new Set(["relevance", "appeal", "purchase_intent", "clarity"])
  );

  // API key
  const [apiKey, setApiKeyState] = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  // Run state
  const [running, setRunning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConceptResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  // savedAt is set when viewing a previously saved result
  const [viewingSavedAt, setViewingSavedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSegments(loadSegments());
    loadAudienceData().then((d) => { setAllData(d); setLoading(false); });
    setSavedTests(loadSavedTests());
  }, []);

  useEffect(() => {
    if (!running) return;
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % LOADING_MESSAGES.length; setLoadingMsg(LOADING_MESSAGES[i]); }, 2200);
    return () => clearInterval(t);
  }, [running]);

  const toggleDimension = (id: string) => {
    setActiveDims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed || !trimmed.startsWith("sk-ant-")) {
      setKeyError("Please enter a valid Anthropic API key (starts with sk-ant-)");
      return;
    }
    setAnthropicKey(trimmed);
    setApiKeyState(trimmed);
    setKeyInput(""); setKeyError(null); setShowKeyDialog(false);
  };

  const runTest = async () => {
    if (!description.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setRunning(true); setError(null); setResult(null); setIsSaved(false); setViewingSavedAt(undefined);
    setLoadingMsg(LOADING_MESSAGES[0]);

    const typeDef = CONCEPT_TYPES.find((c) => c.id === conceptType)!;
    const dims = DIMENSIONS.filter((d) => activeDims.has(d.id));
    const profile = buildAudienceProfile(audienceData);

    const systemPrompt = `You are a senior market research analyst conducting a simulated consumer concept test.
Respond with ONLY a JSON object — no markdown, no explanation.

Audience: ${audienceLabel} (${audienceData.length} respondents)
${profile}

Return this exact JSON structure:
{
  "overall_score": <integer 0-100>,
  "verdict_label": <"Concept Winner"|"Strong Performer"|"Solid Potential"|"Needs Work"|"Reconceptualize">,
  "verdict_text": "<2 sentences>",
  "positive_pct": <integer>,
  "negative_pct": <integer>,
  "dimensions": [{"name":"<label>","score":<0-100>,"rationale":"<one sentence>"}],
  "strengths": ["<str1>","<str2>","<str3>"],
  "weaknesses": ["<w1>","<w2>","<w3>"],
  "segment_reactions": [{"segment":"<sub-group>","reaction":"<how they react>","sentiment":"positive|negative|neutral"}],
  "verbatims": [{"quote":"<quote>","persona":"<e.g. 28F urban>","sentiment":"positive|negative|neutral"}],
  "recommendations": ["<rec1>","<rec2>","<rec3>"]
}`;

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
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: `Concept type: ${typeDef.label}\nName: ${name || "(untitled)"}\nCategory: ${category || "(none)"}\nDescription: ${description}\nDimensions to score: ${dims.map((d) => d.label).join(", ")}` }],
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        if (resp.status === 401) { deleteAnthropicKey(); setApiKeyState(null); throw new Error("Invalid API key. Please re-enter your Anthropic API key."); }
        throw new Error(body?.error?.message || `API error ${resp.status}`);
      }
      const data = await resp.json();
      const raw = data.content?.[0]?.text ?? "";
      const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      setResult(JSON.parse(jsonStr) as ConceptResult);
    } catch (err: any) {
      if (err.message?.includes("Invalid API key")) setShowKeyDialog(true);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    saveConceptTest({
      conceptType, conceptName: name, category, description,
      activeDims: Array.from(activeDims),
      audienceLabel, audienceCount: audienceData.length,
      result,
    });
    setIsSaved(true);
    setSavedTests(loadSavedTests());
  };

  const handleViewSaved = (t: SavedConceptTest) => {
    setConceptType(t.conceptType);
    setName(t.conceptName);
    setCategory(t.category);
    setDescription(t.description);
    setActiveDims(new Set(t.activeDims));
    setResult(t.result);
    setIsSaved(true);
    setViewingSavedAt(t.savedAt);
    setView("form");
  };

  const handleClone = (t: SavedConceptTest) => {
    setConceptType(t.conceptType);
    setName(t.conceptName ? `${t.conceptName} (copy)` : "");
    setCategory(t.category);
    setDescription(t.description);
    setActiveDims(new Set(t.activeDims));
    setResult(null);
    setIsSaved(false);
    setViewingSavedAt(undefined);
    setView("form");
  };

  const handleDeleteSaved = (id: string) => {
    deleteSavedTest(id);
    setSavedTests(loadSavedTests());
  };

  const handleNewTest = () => {
    setResult(null); setError(null); setName(""); setCategory(""); setDescription("");
    setIsSaved(false); setViewingSavedAt(undefined);
  };

  const handleDownloadPdf = () => {
    if (!result) return;
    downloadConceptTestPdf({
      conceptType, conceptName: name, category, description,
      audienceLabel, audienceCount: audienceData.length,
      savedAt: viewingSavedAt,
      result,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentTypeDef = CONCEPT_TYPES.find((c) => c.id === conceptType)!;

  return (
    <div className="space-y-6">
      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-surface-card-border pb-0">
        {([
          { id: "form", label: "New Test", icon: FlaskConical },
          { id: "saved", label: `Saved Tests${savedTests.length ? ` (${savedTests.length})` : ""}`, icon: BookMarked },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                view === tab.id
                  ? "border-glow-primary text-glow-primary"
                  : "border-transparent text-hero-muted hover:text-hero-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Saved Tests view ─────────────────────────────────────── */}
      {view === "saved" && (
        <SavedTestsList
          tests={savedTests}
          onView={handleViewSaved}
          onClone={handleClone}
          onDelete={handleDeleteSaved}
        />
      )}

      {/* ── New Test / Results view ──────────────────────────────── */}
      {view === "form" && (
        <>
          {/* Form */}
          {!result && !running && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3 space-y-5">
                <div className="rounded-xl bg-surface-card border border-surface-card-border p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-glow-primary" />
                    <h3 className="text-sm font-semibold text-hero-foreground uppercase tracking-wider">Concept Definition</h3>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {CONCEPT_TYPES.map((ct) => {
                      const Icon = ct.icon;
                      return (
                        <button key={ct.id} onClick={() => setConceptType(ct.id)}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                            conceptType === ct.id
                              ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                              : "border-surface-card-border text-hero-muted hover:border-glow-primary/40 hover:text-hero-foreground")}>
                          <Icon className="h-3 w-3" />{ct.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-hero-muted uppercase tracking-wider">Concept Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Summer Launch Campaign 2025"
                      className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted focus-visible:ring-glow-primary/50 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-hero-muted uppercase tracking-wider">Category / Industry</label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Footwear, Streaming, Financial Services"
                      className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted focus-visible:ring-glow-primary/50 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-hero-muted uppercase tracking-wider">
                      {currentTypeDef.label} Description <span className="text-destructive">*</span>
                    </label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder={currentTypeDef.placeholder} rows={6}
                      className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted focus-visible:ring-glow-primary/50 text-sm resize-none" />
                  </div>
                </div>
              </div>

              <div className="xl:col-span-2 space-y-5">
                <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Audience Being Tested</h4>
                  <AudienceSelector segments={segments} selectedId={selectedSegmentId} onChange={setSelectedSegmentId} count={audienceData.length} />
                  {audienceData.length > 0 && (() => {
                    const n = audienceData.length;
                    const femalePct = Math.round(audienceData.filter((r) => r.gender === "Female").length / n * 100);
                    const ageCounts: Record<string, number> = {};
                    audienceData.forEach((r) => { ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1; });
                    const topAge = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
                    const highInc = Math.round(audienceData.filter((r) => r.is_high_income).length / n * 100);
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Sample", value: n.toLocaleString() },
                          { label: "Female", value: `${femalePct}%` },
                          { label: "Top Age", value: topAge },
                          { label: "$100K+", value: `${highInc}%` },
                        ].map((s) => (
                          <div key={s.label} className="bg-hero rounded-lg p-2.5 text-center">
                            <div className="text-base font-bold text-glow-primary">{s.value}</div>
                            <div className="text-[10px] text-hero-muted uppercase tracking-wider mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Test Dimensions</h4>
                  <div className="space-y-2">
                    {DIMENSIONS.map((dim) => {
                      const active = activeDims.has(dim.id);
                      return (
                        <button key={dim.id} onClick={() => toggleDimension(dim.id)}
                          className={cn("w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-colors",
                            active ? "border-glow-primary/40 bg-glow-primary/5" : "border-surface-card-border opacity-60")}>
                          <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5",
                            active ? "bg-glow-primary border-glow-primary" : "border-surface-card-border")}>
                            {active && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <div>
                            <div className="text-xs font-medium text-hero-foreground">{dim.label}</div>
                            <div className="text-[10px] text-hero-muted mt-0.5">{dim.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={runTest} disabled={running || !description.trim()}
                  className="w-full bg-glow-primary hover:bg-glow-primary/90 text-white font-semibold h-11 gap-2">
                  {running
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Running Test…</>
                    : <><Zap className="h-4 w-4" /> Run Concept Test</>}
                </Button>

                {!apiKey && (
                  <button onClick={() => setShowKeyDialog(true)}
                    className="w-full flex items-center justify-center gap-2 text-xs text-glow-accent hover:underline py-1">
                    <Key className="h-3.5 w-3.5" /> Set Anthropic API key to run
                  </button>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {running && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
              <p className="text-sm text-hero-foreground font-medium">{loadingMsg}</p>
              <p className="text-xs text-hero-muted">Simulating {audienceData.length.toLocaleString()} respondents</p>
            </div>
          )}

          {/* Results */}
          {result && !running && (
            <ResultsPanel
              result={result}
              conceptType={conceptType}
              conceptName={name}
              category={category}
              description={description}
              audienceLabel={audienceLabel}
              audienceCount={audienceData.length}
              savedAt={viewingSavedAt}
              isSaved={isSaved}
              onSave={handleSave}
              onRerun={runTest}
              onNewTest={handleNewTest}
              onDownloadPdf={handleDownloadPdf}
            />
          )}
        </>
      )}

      {/* API key dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-glow-primary" />Anthropic API Key
            </DialogTitle>
            <DialogDescription className="text-hero-muted">
              Required to run concept tests. Stored locally in your browser only.
            </DialogDescription>
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
            <Button onClick={handleSaveKey} className="bg-glow-primary/20 text-glow-primary hover:bg-glow-primary/30 border border-glow-primary/40">
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConceptTesting;
