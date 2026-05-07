import { useState, useEffect, useRef } from "react";
import {
  FlaskConical, BookMarked, Send, Copy, Trash2,
  Download, Save, Clock, ChevronRight, TrendingUp,
  AlertTriangle, Users, Star, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadSavedTests, saveConceptTest, deleteSavedTest, type SavedConceptTest } from "@/lib/conceptTestStorage";
import { downloadConceptTestPdf } from "@/lib/reportDownload";
import type { ConceptType, ConceptResult } from "@/lib/conceptTestTypes";

// ─── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  type?: "text" | "results";
  results?: InlineResults;
}

interface InlineResults {
  score: number;
  conceptName: string;
  dimensions: { label: string; pct: number }[];
  quotes: string[];
}

interface ConceptData {
  type?: string;
  name?: string;
  description?: string;
  category?: string;
}

// ─── Constants ────────────────────────────────────────────────────

const CONCEPT_TYPES_MAP: Record<string, ConceptType> = {
  ad: "ad", product: "product", message: "message", brand: "brand",
  "ad / campaign": "ad", "brand idea": "brand",
};

const STEP_QUESTIONS = [
  "Hi! I'm your concept testing assistant. What would you like to test today — an ad, product, message, or brand idea?",
  "Got it! What's the name of your concept? (You can skip this with a dash if you'd like.)",
  "Great. Give me a short description of the concept — what it is, what it does, and who it's for.",
  "Which category or industry does this fall into? e.g. FMCG, Tech, Financial Services, Retail…",
];

// ─── Helpers ─────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function scoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 70) return "bg-green-400";
  if (score >= 50) return "bg-yellow-400";
  return "bg-red-400";
}

function verdictLabel(score: number) {
  if (score >= 80) return "Concept Winner";
  if (score >= 70) return "Strong Performer";
  if (score >= 60) return "Solid Potential";
  if (score >= 50) return "Needs Work";
  return "Reconceptualize";
}

function generateFakeResults(data: ConceptData): InlineResults {
  const base = 55 + Math.floor(Math.random() * 25);
  const offset = () => Math.floor(Math.random() * 14) - 7;
  return {
    score: base,
    conceptName: data.name && data.name !== "-" ? data.name : "Your Concept",
    dimensions: [
      { label: "Relevance", pct: Math.min(99, Math.max(30, base + offset())) },
      { label: "Appeal", pct: Math.min(99, Math.max(30, base + offset())) },
      { label: "Purchase Intent", pct: Math.min(99, Math.max(30, base + offset())) },
    ],
    quotes: [
      `"This really speaks to what I'm looking for — ${data.category ? `especially in the ${data.category} space` : "exactly what I need"}."`,
      `"I'd definitely try this. It feels fresh compared to what's out there right now."`,
    ],
  };
}

function fakeConceptResult(data: ConceptData, results: InlineResults): ConceptResult {
  const s = results.score;
  return {
    overall_score: s,
    verdict_label: verdictLabel(s),
    verdict_text: `This concept shows ${s >= 70 ? "strong" : "moderate"} potential across the audience. Key drivers include relevance and appeal scores.`,
    positive_pct: Math.round(s * 0.9),
    negative_pct: Math.round((100 - s) * 0.5),
    dimensions: results.dimensions.map(d => ({
      name: d.label,
      score: d.pct,
      rationale: `${d.label} resonates well with the target audience profile.`,
    })),
    strengths: ["Stands out in its category", "Clear value proposition", "Resonates with target demo"],
    weaknesses: ["Pricing perception may limit reach", "Could benefit from stronger CTA", "Brand trust takes time to build"],
    segment_reactions: [
      { segment: "25-34 Urban", reaction: "Highly engaged, sees clear utility", sentiment: "positive" },
      { segment: "45-54 Suburban", reaction: "Cautious but curious", sentiment: "neutral" },
    ],
    verbatims: results.quotes.map((q, i) => ({
      quote: q.replace(/^"|"$/g, ""),
      persona: i === 0 ? "28F, urban" : "35M, suburban",
      sentiment: "positive" as const,
    })),
    recommendations: [
      "Sharpen the headline message for clarity",
      "Consider tiered pricing to widen appeal",
      "Lean into the lifestyle angle in visuals",
    ],
  };
}

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

  const CONCEPT_TYPE_LABELS: Record<string, string> = {
    ad: "Ad / Campaign", product: "Product", message: "Message", brand: "Brand Idea",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tests.map((t) => (
        <div key={t.id} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-4 hover:border-glow-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-glow-primary/10 border border-glow-primary/20 flex items-center justify-center shrink-0">
                <FlaskConical className="h-4 w-4 text-glow-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-hero-foreground truncate">{t.conceptName || "Untitled Concept"}</p>
                <p className="text-[10px] text-hero-muted">{CONCEPT_TYPE_LABELS[t.conceptType] ?? t.conceptType} · {t.audienceLabel}</p>
              </div>
            </div>
            <div className={cn("shrink-0 text-xl font-extrabold tabular-nums", scoreColor(t.result.overall_score))}>
              {t.result.overall_score}<span className="text-xs text-hero-muted font-normal">/100</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium", scoreColor(t.result.overall_score))}>{t.result.verdict_label}</span>
            <span className="text-[10px] text-hero-muted flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(t.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <p className="text-[10px] text-hero-muted line-clamp-2">{t.description}</p>
          <div className="grid grid-cols-4 gap-1">
            {t.result.dimensions.slice(0, 4).map((d) => (
              <div key={d.name} className="space-y-0.5">
                <div className="text-[9px] text-hero-muted truncate">{d.name}</div>
                <div className="h-1 rounded-full bg-surface-dark overflow-hidden">
                  <div className={cn("h-full rounded-full", scoreBg(d.score))} style={{ width: `${d.score}%` }} />
                </div>
              </div>
            ))}
          </div>
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
              conceptType: t.conceptType, conceptName: t.conceptName, category: t.category,
              description: t.description, audienceLabel: t.audienceLabel, audienceCount: t.audienceCount,
              savedAt: t.savedAt, result: t.result,
            })} className="flex-1 text-xs text-hero-muted hover:text-hero-foreground gap-1.5 h-7">
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)}
              className="h-7 w-7 p-0 text-hero-muted hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Inline Results Card ──────────────────────────────────────────

const ResultsCard = ({ results, onSave, isSaved }: {
  results: InlineResults;
  onSave: () => void;
  isSaved: boolean;
}) => (
  <div className="rounded-xl border border-surface-card-border bg-[#0f1117] p-4 space-y-4 w-full max-w-sm">
    {/* Score header */}
    <div className="flex items-center gap-4">
      <div className="text-center">
        <div className={cn("text-5xl font-extrabold tabular-nums leading-none", scoreColor(results.score))}>
          {results.score}
        </div>
        <div className="text-[10px] text-hero-muted mt-0.5">/ 100</div>
      </div>
      <div>
        <div className={cn("text-sm font-bold", scoreColor(results.score))}>{verdictLabel(results.score)}</div>
        <div className="text-[10px] text-hero-muted mt-0.5">{results.conceptName}</div>
      </div>
    </div>

    {/* Dimension bars */}
    <div className="space-y-2">
      {results.dimensions.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-hero-muted">{d.label}</span>
            <span className={cn("font-semibold", scoreColor(d.pct))}>{d.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-dark overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", scoreBg(d.pct))} style={{ width: `${d.pct}%` }} />
          </div>
        </div>
      ))}
    </div>

    {/* Verbatim quotes */}
    <div className="space-y-2">
      {results.quotes.map((q, i) => (
        <div key={i} className="text-[11px] text-hero-foreground/70 italic border-l-2 border-glow-primary/40 pl-3 leading-relaxed">
          {q}
        </div>
      ))}
    </div>

    {/* Save button */}
    {!isSaved ? (
      <Button size="sm" onClick={onSave}
        className="w-full bg-glow-primary/10 text-glow-primary border border-glow-primary/30 hover:bg-glow-primary/20 gap-1.5 text-xs h-7">
        <Save className="h-3 w-3" /> Save Test
      </Button>
    ) : (
      <div className="w-full flex items-center justify-center gap-1.5 text-xs text-green-400 py-1">
        <Save className="h-3 w-3" /> Saved
      </div>
    )}
  </div>
);

// ─── Results Full Panel (for viewing saved tests) ─────────────────

const ResultsFullPanel = ({ result, conceptName, conceptType, category, description, audienceLabel, audienceCount, savedAt, isSaved, onSave, onNewTest, onDownloadPdf }: {
  result: ConceptResult; conceptName: string; conceptType: ConceptType; category: string;
  description: string; audienceLabel: string; audienceCount: number; savedAt?: string;
  isSaved: boolean; onSave: () => void; onNewTest: () => void; onDownloadPdf: () => void;
}) => {
  const CONCEPT_TYPE_LABELS: Record<ConceptType, string> = {
    ad: "Ad / Campaign", product: "Product", message: "Message", brand: "Brand Idea",
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] border-glow-primary/40 text-glow-primary uppercase">
              {CONCEPT_TYPE_LABELS[conceptType]}
            </Badge>
            <span className="text-sm font-semibold text-hero-foreground">{conceptName || "Untitled Concept"}</span>
            {category && <span className="text-xs text-hero-muted">· {category}</span>}
            <span className="text-xs text-hero-muted">· {audienceLabel}</span>
            {savedAt && (
              <span className="text-xs text-hero-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />{new Date(savedAt).toLocaleDateString()}
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
          <Button size="sm" variant="outline" onClick={onNewTest}
            className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs">
            ← New Test
          </Button>
        </div>
      </div>

      {/* Score */}
      <div className={cn("rounded-xl border p-6 flex flex-col sm:flex-row items-center gap-6",
        result.overall_score >= 70 ? "border-green-400/40 bg-green-400/5" : result.overall_score >= 50 ? "border-yellow-400/40 bg-yellow-400/5" : "border-red-400/40 bg-red-400/5")}>
        <div className="text-center">
          <div className={cn("text-7xl font-extrabold tabular-nums leading-none", scoreColor(result.overall_score))}>{result.overall_score}</div>
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

      {/* Dimensions */}
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
                <div className={cn("h-full rounded-full", scoreBg(dim.score))} style={{ width: `${dim.score}%` }} />
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
            <div key={i} className={cn("p-3 rounded-lg border-l-2 text-xs",
              sr.sentiment === "positive" ? "border-green-400 bg-green-400/5" : sr.sentiment === "negative" ? "border-red-400 bg-red-400/5" : "border-surface-card-border bg-surface-card")}>
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
            <div key={i} className={cn("relative p-4 rounded-xl border-l-2 overflow-hidden",
              v.sentiment === "positive" ? "border-green-400 bg-green-400/5" : v.sentiment === "negative" ? "border-red-400 bg-red-400/5" : "border-surface-card-border bg-surface-card")}>
              <span className="absolute top-1 left-2 text-5xl leading-none text-hero-muted/15 font-serif select-none pointer-events-none">"</span>
              <p className="relative text-xs text-hero-foreground italic leading-relaxed pt-3">"{v.quote}"</p>
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
              <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-hero-foreground/80">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Typing Indicator ─────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex gap-3 items-start">
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
      style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>
      AI
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-[#1a1d27] border border-white/10 px-4 py-3">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
            style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────

const ConceptTesting = () => {
  // Tab
  const [view, setView] = useState<"chat" | "saved">("chat");
  const [savedTests, setSavedTests] = useState<SavedConceptTest[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: uid(), role: "ai", content: STEP_QUESTIONS[0], type: "text" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [step, setStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [conceptData, setConceptData] = useState<ConceptData>({});
  const [currentResults, setCurrentResults] = useState<InlineResults | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Viewing a saved test in full
  const [viewingResult, setViewingResult] = useState<{
    result: ConceptResult; conceptName: string; conceptType: ConceptType;
    category: string; description: string; audienceLabel: string;
    audienceCount: number; savedAt: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedTests(loadSavedTests());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const pushAiMessage = (content: string, extra?: Partial<ChatMessage>) => {
    setMessages((prev) => [...prev, { id: uid(), role: "ai", content, type: "text", ...extra }]);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;
    setInputValue("");

    // Add user message
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, type: "text" };
    setMessages((prev) => [...prev, userMsg]);

    // Process step
    const nextStep = step + 1;
    const newData = { ...conceptData };

    if (step === 0) {
      // What type?
      const lower = text.toLowerCase();
      const matched = Object.entries(CONCEPT_TYPES_MAP).find(([k]) => lower.includes(k));
      newData.type = matched ? matched[0] : "ad";
    } else if (step === 1) {
      newData.name = text === "-" ? "" : text;
    } else if (step === 2) {
      newData.description = text;
    } else if (step === 3) {
      newData.category = text;
    }

    setConceptData(newData);

    // Show typing indicator then AI reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);

      if (step < 3) {
        pushAiMessage(STEP_QUESTIONS[nextStep]);
        setStep(nextStep);
      } else {
        // step === 3: all data collected → confirm + run
        pushAiMessage(`Got it — running your concept test now for "${newData.name || "your concept"}" in ${newData.category}…`);
        setStep(4);

        // Fake 1.5s loading then results
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const results = generateFakeResults(newData);
          setCurrentResults(results);
          setIsSaved(false);
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "ai",
              content: "Here are your concept test results:",
              type: "results",
              results,
            },
          ]);
        }, 1500);
      }
    }, 900);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  const handleSaveTest = () => {
    if (!currentResults) return;
    const ct: ConceptType = CONCEPT_TYPES_MAP[conceptData.type ?? ""] ?? "ad";
    const fakeResult = fakeConceptResult(conceptData, currentResults);
    saveConceptTest({
      conceptType: ct,
      conceptName: conceptData.name || "Untitled",
      category: conceptData.category || "",
      description: conceptData.description || "",
      activeDims: ["relevance", "appeal", "purchase_intent"],
      audienceLabel: "All Respondents",
      audienceCount: 2450,
      result: fakeResult,
    });
    setIsSaved(true);
    setSavedTests(loadSavedTests());
  };

  const resetChat = () => {
    setMessages([{ id: uid(), role: "ai", content: STEP_QUESTIONS[0], type: "text" }]);
    setStep(0);
    setConceptData({});
    setCurrentResults(null);
    setIsSaved(false);
    setViewingResult(null);
  };

  const handleViewSaved = (t: SavedConceptTest) => {
    setViewingResult({
      result: t.result,
      conceptName: t.conceptName,
      conceptType: t.conceptType,
      category: t.category,
      description: t.description,
      audienceLabel: t.audienceLabel,
      audienceCount: t.audienceCount,
      savedAt: t.savedAt,
    });
    setView("chat");
  };

  const handleCloneSaved = (t: SavedConceptTest) => {
    setConceptData({ type: t.conceptType, name: t.conceptName, description: t.description, category: t.category });
    setViewingResult(null);
    resetChat();
  };

  const handleDeleteSaved = (id: string) => {
    deleteSavedTest(id);
    setSavedTests(loadSavedTests());
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-surface-card-border pb-0">
        {([
          { id: "chat", label: "New Test", icon: FlaskConical },
          { id: "saved", label: `Saved Tests${savedTests.length ? ` (${savedTests.length})` : ""}`, icon: BookMarked },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => { setView(tab.id); if (tab.id === "saved") setSavedTests(loadSavedTests()); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                view === tab.id
                  ? "border-glow-primary text-glow-primary"
                  : "border-transparent text-hero-muted hover:text-hero-foreground"
              )}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Saved Tests */}
      {view === "saved" && (
        <SavedTestsList
          tests={savedTests}
          onView={handleViewSaved}
          onClone={handleCloneSaved}
          onDelete={handleDeleteSaved}
        />
      )}

      {/* Chat / Results view */}
      {view === "chat" && (
        <>
          {/* Viewing a saved test full result */}
          {viewingResult ? (
            <ResultsFullPanel
              result={viewingResult.result}
              conceptName={viewingResult.conceptName}
              conceptType={viewingResult.conceptType}
              category={viewingResult.category}
              description={viewingResult.description}
              audienceLabel={viewingResult.audienceLabel}
              audienceCount={viewingResult.audienceCount}
              savedAt={viewingResult.savedAt}
              isSaved={true}
              onSave={() => {}}
              onNewTest={() => { setViewingResult(null); resetChat(); }}
              onDownloadPdf={() => downloadConceptTestPdf({
                conceptType: viewingResult.conceptType,
                conceptName: viewingResult.conceptName,
                category: viewingResult.category,
                description: viewingResult.description,
                audienceLabel: viewingResult.audienceLabel,
                audienceCount: viewingResult.audienceCount,
                savedAt: viewingResult.savedAt,
                result: viewingResult.result,
              })}
            />
          ) : (
            /* Chat interface */
            <div className="rounded-2xl overflow-hidden bg-[#1a1d27] border border-white/10 flex flex-col" style={{ height: "560px" }}>
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#13151f]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>
                    AI
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Concept Testing Assistant</p>
                    <p className="text-[10px] text-white/40">Powered by synthetic consumer data</p>
                  </div>
                </div>
                {step > 0 && (
                  <button onClick={resetChat}
                    className="text-[11px] text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20">
                    New test
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>
                        AI
                      </div>
                    )}
                    <div className={cn("max-w-sm", msg.role === "user" ? "flex flex-col items-end" : "")}>
                      {msg.type === "results" && msg.results ? (
                        <div className="space-y-2">
                          <div className="rounded-2xl rounded-tl-sm bg-[#0f1117] border border-white/10 px-4 py-3">
                            <p className="text-sm text-white/80">{msg.content}</p>
                          </div>
                          <ResultsCard
                            results={msg.results}
                            onSave={handleSaveTest}
                            isSaved={isSaved}
                          />
                        </div>
                      ) : (
                        <div className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          msg.role === "ai"
                            ? "rounded-tl-sm bg-[#0f1117] border border-white/10 text-white/80"
                            : "rounded-tr-sm bg-[#004638] text-white"
                        )}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 pb-4 pt-3 border-t border-white/10 bg-[#13151f] shrink-0">
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isTyping || step >= 5}
                    placeholder={
                      step === 0 ? "e.g. an ad, a product idea, a brand…" :
                      step === 1 ? "Concept name (or type - to skip)…" :
                      step === 2 ? "Describe your concept…" :
                      step === 3 ? "e.g. FMCG, Tech, Retail…" :
                      "Chat complete — start a new test above"
                    }
                    className="flex-1 bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-glow-primary/50 disabled:opacity-40 transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping || step >= 5}
                    className="w-10 h-10 rounded-xl bg-glow-primary hover:bg-glow-primary/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
                  >
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConceptTesting;
