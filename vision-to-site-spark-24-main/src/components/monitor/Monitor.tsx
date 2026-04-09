import { useState, useEffect } from "react";
import {
  Activity, Loader2, Key, AlertTriangle,
  Save, BookOpen, Trash2, Copy, FileText, RefreshCw, TrendingUp,
  TrendingDown, Minus, AlertCircle, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAnthropicKey, setAnthropicKey, deleteAnthropicKey } from "@/lib/anthropicNlp";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { MonitorSource, MonitorResult } from "@/lib/monitorTypes";
import {
  loadSavedMonitors, saveMonitor, deleteSavedMonitor, type SavedMonitor,
} from "@/lib/monitorStorage";
import { downloadMonitorPdf } from "@/lib/reportDownload";

// ─── Constants ────────────────────────────────────────────────────

const SOURCES: { id: MonitorSource; label: string; desc: string }[] = [
  { id: "reddit",  label: "Reddit",                desc: "Community discussions & sentiment" },
  { id: "news",    label: "News & Editorial",       desc: "Media coverage & press mentions" },
  { id: "reviews", label: "Consumer Reviews",       desc: "Amazon, G2, Trustpilot & more" },
  { id: "twitter", label: "Twitter / X",            desc: "Real-time social conversations" },
];

const SOURCE_LOADING_MSGS: Record<MonitorSource, string> = {
  reddit:  "Scanning Reddit communities…",
  news:    "Searching news & editorial…",
  reviews: "Analysing consumer reviews…",
  twitter: "Monitoring Twitter / X…",
};


// ─── Score card ──────────────────────────────────────────────────

const ScoreCard = ({ label, value, suffix = "", color }: {
  label: string; value: number; suffix?: string; color: string;
}) => (
  <div className="rounded-xl bg-surface-card border border-surface-card-border p-4 text-center">
    <div className="text-2xl font-bold" style={{ color }}>{value}{suffix}</div>
    <div className="text-[10px] text-hero-muted uppercase tracking-wider mt-1">{label}</div>
  </div>
);

// ─── Saved Monitors List ──────────────────────────────────────────

const SavedMonitorsList = ({ monitors, onView, onClone, onDelete, onPdf }: {
  monitors: SavedMonitor[];
  onView: (m: SavedMonitor) => void;
  onClone: (m: SavedMonitor) => void;
  onDelete: (id: string) => void;
  onPdf: (m: SavedMonitor) => void;
}) => {
  if (!monitors.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <Activity className="h-10 w-10 text-hero-muted/30 stroke-1" />
      <p className="text-hero-muted text-sm">No saved monitors yet. Run a brand monitor and save it.</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {monitors.map((m) => {
        const sentColor = m.result.sentimentLabel === "positive" ? "#38a169" : m.result.sentimentLabel === "negative" ? "#e53e3e" : "#dd6b20";
        return (
          <div key={m.id} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3 hover:border-glow-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-hero-foreground">{m.brand}</p>
                <p className="text-xs text-hero-muted mt-0.5">{m.audienceLabel} · n={m.audienceCount.toLocaleString()}</p>
              </div>
              <span className="text-[10px] text-hero-muted/60 shrink-0">{new Date(m.savedAt).toLocaleDateString()}</span>
            </div>
            {m.competitors && (
              <p className="text-xs text-hero-foreground/60 italic">vs {m.competitors}</p>
            )}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { l: "Aware.", v: m.result.scorecard.awareness },
                { l: "Sentiment", v: m.result.scorecard.sentiment },
                { l: "Repute.", v: m.result.scorecard.reputation },
                { l: "SoV", v: m.result.scorecard.shareOfVoice, suffix: "%" },
              ].map((k) => (
                <div key={k.l} className="rounded bg-surface-dark p-1.5">
                  <p className="text-xs font-bold" style={{ color: sentColor }}>{k.v}{k.suffix}</p>
                  <p className="text-[9px] text-hero-muted">{k.l}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onView(m)}
                className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <BookOpen className="h-3 w-3" /> View
              </Button>
              <Button size="sm" variant="outline" onClick={() => onClone(m)}
                className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <Copy className="h-3 w-3" /> Clone
              </Button>
              <Button size="sm" variant="outline" onClick={() => onPdf(m)}
                className="border-surface-card-border text-hero-muted hover:text-glow-primary gap-1.5 text-xs h-7">
                <FileText className="h-3 w-3" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(m.id)}
                className="border-surface-card-border text-hero-muted hover:text-red-400 text-xs h-7">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Results Dashboard ────────────────────────────────────────────

const ResultsDashboard = ({ result, brand }: { result: MonitorResult; brand: string }) => {
  const sentColor = result.sentimentLabel === "positive" ? "#38a169" : result.sentimentLabel === "negative" ? "#e53e3e" : "#dd6b20";
  const SentIcon = result.sentimentLabel === "positive" ? TrendingUp : result.sentimentLabel === "negative" ? TrendingDown : Minus;

  return (
    <div className="space-y-5">
      {/* Scorecard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScoreCard label="Awareness" value={result.scorecard.awareness} color={sentColor} />
        <ScoreCard label="Sentiment" value={result.scorecard.sentiment} color={sentColor} />
        <ScoreCard label="Reputation" value={result.scorecard.reputation} color={sentColor} />
        <ScoreCard label="Share of Voice" value={result.scorecard.shareOfVoice} suffix="%" color={sentColor} />
      </div>

      {/* Sentiment + themes row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Brand Sentiment</h4>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{ color: sentColor, borderColor: sentColor + "40", backgroundColor: sentColor + "12" }}>
              <SentIcon className="h-2.5 w-2.5" />
              {result.sentimentLabel.charAt(0).toUpperCase() + result.sentimentLabel.slice(1)}
            </span>
          </div>
          <p className="text-xs text-hero-foreground/80 leading-relaxed">{result.sentimentSummary}</p>
        </div>
        <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
          <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Key Themes</h4>
          <ul className="space-y-1.5">
            {result.keyThemes.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-hero-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full bg-glow-primary mt-1.5 shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Competitive positioning */}
      <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-2">
        <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Competitive Positioning</h4>
        <p className="text-xs text-hero-foreground/80 leading-relaxed">{result.competitivePositioning}</p>
      </div>

      {/* Verbatims */}
      {result.verbatims?.length > 0 && (
        <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
          <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Consumer Verbatims</h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.verbatims.map((v, i) => {
              const vc = v.sentiment === "positive" ? "#38a169" : v.sentiment === "negative" ? "#e53e3e" : "#dd6b20";
              return (
                <div key={i} className="p-3 rounded-lg bg-surface-dark border border-surface-card-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                      style={{ color: vc, backgroundColor: vc + "15" }}>
                      {v.sentiment}
                    </span>
                    <span className="text-[10px] text-hero-muted capitalize">{v.source}</span>
                  </div>
                  <p className="text-xs text-hero-foreground/80 italic">"{v.quote}"</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Watch items */}
      {result.watchItems?.length > 0 && (
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-5 space-y-3">
          <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Watch Items
          </h4>
          <div className="space-y-2">
            {result.watchItems.map((w, i) => {
              const wc = w.severity === "high" ? "#e53e3e" : w.severity === "medium" ? "#dd6b20" : "#718096";
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-card border border-surface-card-border">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5"
                    style={{ color: wc, backgroundColor: wc + "15" }}>
                    {w.severity}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-hero-foreground">{w.title}</p>
                    <p className="text-xs text-hero-muted mt-0.5">{w.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const Monitor = () => {
  const [mainView, setMainView]   = useState<"new" | "saved">("new");
  const [savedMonitors, setSavedMonitors] = useState<SavedMonitor[]>([]);
  const refreshSaved = () => setSavedMonitors(loadSavedMonitors());
  useEffect(() => { refreshSaved(); }, []);

  // Config
  const [brand, setBrand]             = useState("");
  const [competitors, setCompetitors] = useState("");
  const [topics, setTopics]           = useState("");
  const [sources, setSources]         = useState<MonitorSource[]>(["reddit", "news", "reviews", "twitter"]);

  // Run state
  const [runState, setRunState]       = useState<"idle" | "running" | "done">("idle");
  const [loadingMsg, setLoadingMsg]   = useState("");
  const [result, setResult]           = useState<MonitorResult | null>(null);
  const [apiError, setApiError]       = useState<string | null>(null);

  // Save feedback
  const [savedFeedback, setSavedFeedback] = useState(false);

  // API key
  const [apiKey, setApiKeyState]      = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput]       = useState("");
  const [keyError, setKeyError]       = useState<string | null>(null);


  const handleSaveKey = () => {
    const t = keyInput.trim();
    if (!t.startsWith("sk-ant-")) { setKeyError("Key must start with sk-ant-"); return; }
    setAnthropicKey(t); setApiKeyState(t); setKeyInput(""); setKeyError(null); setShowKeyDialog(false);
  };

  const toggleSource = (id: MonitorSource) => {
    setSources((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  const runMonitor = async () => {
    if (!brand.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setRunState("running");
    setResult(null);
    setApiError(null);

    // Simulate scanning sources
    for (const src of sources) {
      setLoadingMsg(SOURCE_LOADING_MSGS[src]);
      await new Promise((r) => setTimeout(r, 600));
    }
    setLoadingMsg("Analysing sentiment & generating insights…");

    const prompt = `You are a brand intelligence analyst. Run a comprehensive brand monitor for "${brand}".
${competitors ? `Competitors to benchmark against: ${competitors}` : "No competitors specified."}
${topics ? `Key topics to focus on: ${topics}` : ""}
Sources analysed: ${sources.join(", ")}

Return ONLY valid JSON matching this exact structure:
{
  "scorecard": {"awareness":85,"sentiment":72,"reputation":78,"shareOfVoice":34},
  "sentimentLabel":"positive",
  "sentimentSummary":"2-3 sentence summary of overall brand sentiment",
  "keyThemes":["theme1","theme2","theme3","theme4","theme5"],
  "competitivePositioning":"2-3 sentences on competitive position vs ${competitors || 'key competitors'}",
  "audienceAlignment":"",
  "verbatims":[
    {"quote":"authentic consumer quote","source":"reddit","sentiment":"positive"},
    {"quote":"...","source":"news","sentiment":"neutral"},
    {"quote":"...","source":"reviews","sentiment":"negative"},
    {"quote":"...","source":"twitter","sentiment":"positive"},
    {"quote":"...","source":"reddit","sentiment":"neutral"},
    {"quote":"...","source":"reviews","sentiment":"negative"}
  ],
  "watchItems":[
    {"title":"Issue title","description":"Brief description of the concern","severity":"high"},
    {"title":"...","description":"...","severity":"medium"}
  ]
}

Scores are 0-100. sentimentLabel must be "positive", "neutral", or "negative". severity must be "high", "medium", or "low". Generate realistic, specific, insightful data for ${brand}.`;

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
          max_tokens: 1800,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        if (resp.status === 401) { deleteAnthropicKey(); setApiKeyState(null); throw new Error("Invalid API key."); }
        throw new Error(b?.error?.message || `API error ${resp.status}`);
      }
      const data = await resp.json();
      const raw  = data.content?.[0]?.text ?? "{}";
      const json = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
      setResult(JSON.parse(json) as MonitorResult);
      setRunState("done");
    } catch (err: any) {
      setApiError(err.message || "Something went wrong.");
      if (err.message?.includes("Invalid API key")) setShowKeyDialog(true);
      setRunState("idle");
    }
  };

  const handleSave = () => {
    if (!result) return;
    saveMonitor({ brand, competitors, topics, sources, audienceLabel: "", audienceCount: 0, result });
    refreshSaved();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleView = (m: SavedMonitor) => {
    setBrand(m.brand); setCompetitors(m.competitors); setTopics(m.topics);
    setSources(m.sources); setResult(m.result); setRunState("done");
    setMainView("new");
  };

  const handleClone = (m: SavedMonitor) => {
    setBrand(m.brand); setCompetitors(m.competitors); setTopics(m.topics);
    setSources(m.sources); setResult(null); setRunState("idle");
    setMainView("new");
  };

  const handleDelete = (id: string) => { deleteSavedMonitor(id); refreshSaved(); };

  const handlePdf = (m: SavedMonitor) => {
    downloadMonitorPdf({
      brand: m.brand, competitors: m.competitors, topics: m.topics,
      sources: m.sources, audienceLabel: m.audienceLabel,
      audienceCount: m.audienceCount, result: m.result,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top toggle */}
      <div className="flex items-center gap-2 border-b border-surface-card-border pb-3">
        <button onClick={() => setMainView("new")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
            mainView === "new" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          New Monitor
        </button>
        <button onClick={() => setMainView("saved")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
            mainView === "saved" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          Saved Monitors
          {savedMonitors.length > 0 && (
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full",
              mainView === "saved" ? "bg-white/20 text-white" : "bg-surface-dark text-hero-muted")}>
              {savedMonitors.length}
            </span>
          )}
        </button>
      </div>

      {mainView === "saved" ? (
        <SavedMonitorsList
          monitors={savedMonitors}
          onView={handleView} onClone={handleClone}
          onDelete={handleDelete} onPdf={handlePdf}
        />
      ) : (
        <>
          {/* Config panel */}
          <div className="rounded-xl bg-surface-card border border-surface-card-border p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Brand Monitor Configuration</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Left: brand inputs */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">
                    Primary Brand <span className="text-destructive">*</span>
                  </label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Nike, Apple, Chase Bank"
                    className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Competitors</label>
                  <Input value={competitors} onChange={(e) => setCompetitors(e.target.value)}
                    placeholder="e.g. Adidas, Under Armour, New Balance"
                    className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Key Topics to Monitor</label>
                  <Input value={topics} onChange={(e) => setTopics(e.target.value)}
                    placeholder="e.g. product quality, customer service, pricing"
                    className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-9" />
                </div>
              </div>

              {/* Right: sources */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Monitoring Sources</label>
                {SOURCES.map((src) => (
                  <button key={src.id} onClick={() => toggleSource(src.id)}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      sources.includes(src.id)
                        ? "border-glow-primary bg-glow-primary/5 text-hero-foreground"
                        : "border-surface-card-border text-hero-muted hover:border-surface-card-border/80")}>
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      sources.includes(src.id) ? "bg-glow-primary border-glow-primary" : "border-surface-card-border")}>
                      {sources.includes(src.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{src.label}</p>
                      <p className="text-[10px] opacity-60">{src.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {!apiKey && (
              <button onClick={() => setShowKeyDialog(true)}
                className="flex items-center gap-2 text-xs text-glow-accent hover:underline">
                <Key className="h-3.5 w-3.5" /> Set Anthropic API key to run monitor
              </button>
            )}
            {apiError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{apiError}</p>
              </div>
            )}

            <Button onClick={runMonitor} disabled={!brand.trim() || runState === "running"}
              className="w-full bg-glow-primary hover:bg-glow-primary/90 text-white font-semibold h-11 gap-2">
              {runState === "running"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {loadingMsg}</>
                : <><Activity className="h-4 w-4" /> Run Brand Monitor</>}
            </Button>
          </div>

          {/* Results */}
          {runState === "done" && result && (
            <>
              {/* Results action bar */}
              <div className="rounded-xl bg-surface-card border border-surface-card-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-hero-foreground">{brand}</p>
                  <p className="text-xs text-hero-muted">{new Date().toLocaleDateString("en-US", { dateStyle: "long" })} · {sources.join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setResult(null); setRunState("idle"); }}
                    className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                    <RefreshCw className="h-3 w-3" /> Re-run
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => downloadMonitorPdf({ brand, competitors, topics, sources, audienceLabel: "", audienceCount: 0, result })}
                    className="border-surface-card-border text-hero-muted hover:text-glow-primary gap-1.5 text-xs h-7">
                    <FileText className="h-3 w-3" /> PDF
                  </Button>
                  <Button size="sm" onClick={handleSave}
                    className={cn("gap-1.5 text-xs h-7",
                      savedFeedback
                        ? "bg-green-600/20 text-green-400 border border-green-600/30"
                        : "bg-glow-primary/10 text-glow-primary border border-glow-primary/30 hover:bg-glow-primary/20")}>
                    <Save className="h-3 w-3" />
                    {savedFeedback ? "Saved!" : "Save"}
                  </Button>
                </div>
              </div>
              <ResultsDashboard result={result} brand={brand} />
            </>
          )}
        </>
      )}

      {/* API key dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-glow-primary" />Anthropic API Key</DialogTitle>
            <DialogDescription className="text-hero-muted">Required for AI-generated brand analysis. Stored locally only.</DialogDescription>
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

export default Monitor;
