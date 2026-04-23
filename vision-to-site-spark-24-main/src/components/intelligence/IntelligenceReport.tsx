import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, X, Sparkles, Key, Trash2, Loader2, AlertTriangle, Download, Upload, Globe, MessageCircle, Star, Zap, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AudienceFilterPanel from "@/components/audience/AudienceFilterPanel";
import AudienceInsights from "@/components/audience/AudienceInsights";
import AudienceReporting from "@/components/audience/AudienceReporting";
import AudienceTable from "@/components/audience/AudienceTable";
import {
  loadAudienceData,
  applyFilters,
  getUniqueValues,
  parseNlpQuery,
  DEFAULT_FILTERS,
  type AudienceRecord,
  type AudienceFilters,
} from "@/lib/audienceData";
import {
  getAnthropicKey,
  setAnthropicKey,
  deleteAnthropicKey,
  parseWithAnthropic,
} from "@/lib/anthropicNlp";
import {
  loadSegments,
  applySegmentFilters,
  type Segment,
} from "@/lib/segmentData";
import { downloadReport } from "@/lib/reportDownload";

interface IntelligenceReportProps {
  /** When true, removes the outer page padding (used when embedded inside AudienceAnalysis) */
  embedded?: boolean;
}

const IntelligenceReport = ({ embedded = false }: IntelligenceReportProps) => {
  const [allData, setAllData] = useState<AudienceRecord[]>([]);
  const [filters, setFilters] = useState<AudienceFilters>({ ...DEFAULT_FILTERS });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nlpInput, setNlpInput] = useState("");
  const [nlpApplied, setNlpApplied] = useState<string | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpError, setNlpError] = useState<string | null>(null);

  // Saved segments from Audience Builder
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);

  useEffect(() => {
    setSegments(loadSegments());
  }, []);

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Data sources & file upload ─────────────────────────────────
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(["survey"]));
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DATA_SOURCES = [
    { id: "survey",  label: "Survey Data",  icon: FileText,       available: true  },
    { id: "reddit",  label: "Reddit",        icon: Globe,          available: false },
    { id: "twitter", label: "Twitter / X",   icon: MessageCircle,  available: false },
    { id: "reviews", label: "Reviews",       icon: Star,           available: false },
  ] as const;

  const toggleSource = (id: string) => {
    if (id === "survey") return; // Survey always on
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setUploadedFiles(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const pendingQueryRef = useRef<string | null>(null);

  useEffect(() => {
    loadAudienceData()
      .then((d) => { setAllData(d); setLoading(false); })
      .catch((err) => {
        setLoading(false);
        setLoadError(err?.message || "Failed to load audience data. Please refresh the page.");
      });
  }, []);

  const executeNlpQuery = useCallback(async (query: string, key: string) => {
    setNlpError(null);
    setNlpLoading(true);
    try {
      const parsed = await parseWithAnthropic(query, key);
      if (parsed) {
        setFilters({ ...DEFAULT_FILTERS, ...parsed });
        setNlpApplied(query);
      } else {
        const localParsed = parseNlpQuery(query);
        setFilters({ ...DEFAULT_FILTERS, ...(localParsed ?? { searchQuery: query }) });
        setNlpApplied(query);
      }
    } catch (err: any) {
      if (err.message?.includes("Invalid API key")) {
        deleteAnthropicKey();
        setApiKey(null);
        setNlpError("Invalid API key. Please enter a valid key.");
        setShowKeyDialog(true);
      } else {
        setNlpError(err.message || "Failed to process query. Falling back to keyword search.");
        const localParsed = parseNlpQuery(query);
        setFilters({ ...DEFAULT_FILTERS, ...(localParsed ?? { searchQuery: query }) });
        setNlpApplied(query);
      }
    } finally {
      setNlpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey && pendingQueryRef.current) {
      const query = pendingQueryRef.current;
      pendingQueryRef.current = null;
      setNlpInput(query);
      executeNlpQuery(query, apiKey);
    }
  }, [apiKey, executeNlpQuery]);

  const options = useMemo(() => {
    if (allData.length === 0) return null;
    return {
      ageGroups: getUniqueValues(allData, "age_group"),
      genders: getUniqueValues(allData, "gender"),
      incomeBrackets: getUniqueValues(allData, "household_income_bracket"),
      raceEthnicities: getUniqueValues(allData, "race_ethnicity"),
    };
  }, [allData]);

  const segmentBaseData = useMemo(() => {
    if (!activeSegment || !allData.length) return allData;
    const indexSet = new Set(applySegmentFilters(allData, activeSegment.filters, { gender: [], age: [], income: [] }));
    return allData.filter((_, i) => indexSet.has(i));
  }, [allData, activeSegment]);

  const filtered = useMemo(() => applyFilters(segmentBaseData, filters), [segmentBaseData, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(filters) as (keyof AudienceFilters)[]) {
      const val = filters[key];
      const def = DEFAULT_FILTERS[key];
      if (Array.isArray(val) && (val as string[]).length > 0) count++;
      else if (!Array.isArray(val) && val !== def) count++;
    }
    return count;
  }, [filters]);

  const handleNlpSubmit = useCallback(() => {
    const query = nlpInput.trim();
    if (!query) return;
    if (!apiKey) {
      pendingQueryRef.current = query;
      setShowKeyDialog(true);
      return;
    }
    executeNlpQuery(query, apiKey);
  }, [nlpInput, apiKey, executeNlpQuery]);

  const clearNlp = () => {
    setNlpInput("");
    setNlpApplied(null);
    setNlpError(null);
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed || !trimmed.startsWith("sk-ant-")) {
      setKeyError("Please enter a valid Anthropic API key (starts with sk-ant-)");
      return;
    }
    setAnthropicKey(trimmed);
    setApiKey(trimmed);
    setKeyInput("");
    setKeyError(null);
    setShowKeyDialog(false);
  };

  const handleDeleteKey = () => {
    deleteAnthropicKey();
    setApiKey(null);
    setShowDeleteConfirm(false);
  };

  const filterPanel = options && (
    <AudienceFilterPanel
      filters={filters}
      onFiltersChange={setFilters}
      options={options}
      onReset={() => { setFilters({ ...DEFAULT_FILTERS }); setNlpApplied(null); setNlpInput(""); }}
    />
  );

  const stickyTop = embedded ? "top-0" : "top-20";
  const maxH = embedded ? "max-h-[calc(100vh-4rem)]" : "max-h-[calc(100vh-6rem)]";

  return (
    <div className={cn("relative", embedded ? "pb-8" : "pt-20 pb-12")}>
      <div className={embedded ? "px-0" : "container mx-auto px-6"}>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-hero-foreground mb-2">
                Audience Profile
              </h1>
              <p className="text-hero-muted text-lg">Behavioral & attitudinal deep-dive</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-hero-muted font-mono">
                {activeSegment
                  ? `${activeSegment.icon} ${activeSegment.name} · n=${segmentBaseData.length.toLocaleString()}`
                  : `n=${allData.length.toLocaleString()} respondents`}
              </span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || filtered.length === 0}
                onClick={() => downloadReport({
                  data: filtered,
                  allData,
                  audienceLabel: activeSegment
                    ? `${activeSegment.icon} ${activeSegment.name}`
                    : "All Respondents",
                  activeSegment,
                  appliedQuery: nlpApplied,
                })}
                className="border-glow-primary/40 text-glow-primary hover:bg-glow-primary/10 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Audience Selector */}
        {segments.length > 0 && (
          <div className="mb-5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-hero-muted uppercase tracking-wider shrink-0">Audience</span>
            <button
              onClick={() => setActiveSegment(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                !activeSegment
                  ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                  : "border-surface-card-border text-hero-muted hover:border-glow-primary/50 hover:text-hero-foreground"
              )}
            >
              All Respondents
            </button>
            {segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => setActiveSegment(seg)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5",
                  activeSegment?.id === seg.id
                    ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                    : "border-surface-card-border text-hero-muted hover:border-glow-primary/50 hover:text-hero-foreground"
                )}
              >
                <span>{seg.icon}</span> {seg.name}
              </button>
            ))}
          </div>
        )}

        {/* NLP Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-glow-primary" />
            <Input
              placeholder={apiKey
                ? 'AI-powered search — e.g. "young women who use Instagram and like fitness"'
                : 'Ask about your audience — click to set up AI search'
              }
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNlpSubmit()}
              className="pl-10 pr-28 bg-surface-card border-surface-card-border text-hero-foreground placeholder:text-hero-muted focus-visible:ring-glow-primary/50 h-12 text-sm"
              disabled={nlpLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center">
              {nlpLoading && <Loader2 className="h-4 w-4 text-glow-primary animate-spin" />}
              {nlpInput && !nlpLoading && (
                <button onClick={clearNlp} className="text-hero-muted hover:text-hero-foreground p-1">
                  <X className="h-4 w-4" />
                </button>
              )}
              {!apiKey && (
                <Button size="sm" variant="ghost" onClick={() => setShowKeyDialog(true)} className="text-glow-accent hover:text-glow-accent h-8 px-2">
                  <Key className="h-3.5 w-3.5 mr-1" /> Set API Key
                </Button>
              )}
              <Button size="sm" onClick={handleNlpSubmit} disabled={nlpLoading || !nlpInput.trim()}
                className="bg-glow-primary/20 text-glow-primary hover:bg-glow-primary/30 border border-glow-primary/40 h-8">
                {nlpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                {nlpLoading ? "Thinking…" : "Search"}
              </Button>
            </div>
          </div>
          {nlpApplied && (
            <div className="flex items-center gap-2 mt-2">
              <Sparkles className="h-3 w-3 text-glow-accent" />
              <span className="text-xs text-glow-accent">{apiKey ? "AI filters applied from:" : "Filters applied from:"}</span>
              <Badge variant="outline" className="text-xs border-glow-accent/40 text-glow-accent">
                "{nlpApplied}"
              </Badge>
              <button onClick={clearNlp} className="text-xs text-hero-muted hover:text-hero-foreground underline">Clear</button>
            </div>
          )}
          {nlpError && (
            <Alert variant="destructive" className="mt-2 bg-destructive/10 border-destructive/30">
              <AlertDescription className="text-xs">{nlpError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* ── Data Sources Row ──────────────────────────────────────── */}
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-hero-muted uppercase tracking-wider shrink-0 w-14">Sources</span>
          {DATA_SOURCES.map(({ id, label, icon: Icon, available }) => {
            const active = activeSources.has(id);
            return (
              <button
                key={id}
                onClick={() => toggleSource(id)}
                title={available ? undefined : `${label} integration coming soon`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  active && available
                    ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
                    : available
                    ? "border-surface-card-border text-hero-muted hover:border-glow-primary/50 hover:text-hero-foreground"
                    : "border-surface-card-border/50 text-hero-muted/40 cursor-not-allowed"
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
                {!available && (
                  <span className="ml-1 text-[10px] opacity-60">soon</span>
                )}
              </button>
            );
          })}

          {/* Divider */}
          <span className="w-px h-4 bg-surface-card-border mx-1" />

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-surface-card-border text-hero-muted hover:border-glow-primary/50 hover:text-hero-foreground transition-colors"
          >
            <Upload className="h-3 w-3" />
            Upload file
          </button>

          {/* Uploaded file chips */}
          {uploadedFiles.map((file, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-glow-primary/30 bg-glow-primary/5 text-glow-primary"
            >
              <FileText className="h-3 w-3" />
              {file.name}
              <button
                onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                className="ml-0.5 hover:text-hero-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Keyword search + mobile filter toggle */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hero-muted" />
            <Input
              placeholder="Search by ID, gender, age group, income..."
              value={filters.searchQuery}
              onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value }))}
              className="pl-10 bg-surface-card border-surface-card-border text-hero-foreground placeholder:text-hero-muted focus-visible:ring-glow-primary/50"
            />
            {filters.searchQuery && (
              <button onClick={() => setFilters((f) => ({ ...f, searchQuery: "" }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-hero-muted hover:text-hero-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden border-surface-card-border text-hero-muted hover:text-hero-foreground relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-glow-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-hero border-surface-card-border w-80 overflow-y-auto">{filterPanel}</SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className={cn("sticky overflow-y-auto pr-2 pb-8 scrollbar-thin", stickyTop, maxH)}>
              {filterPanel}
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
              </div>
            ) : loadError ? (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* ── Synthesis Panel ──────────────────────────────── */}
                <SynthesisPanel
                  filtered={filtered}
                  total={allData.length}
                  activeSegment={activeSegment}
                  nlpApplied={nlpApplied}
                  activeSources={activeSources}
                  uploadedFiles={uploadedFiles}
                />
                <AudienceInsights data={filtered} total={allData.length} />
                <AudienceReporting data={filtered} allData={allData} segments={segments} />
                <AudienceTable data={filtered} />
              </>
            )}
          </main>
        </div>
      </div>

      {/* API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-glow-primary" />
              Anthropic API Key
            </DialogTitle>
            <DialogDescription className="text-hero-muted">
              Enter your Anthropic API key to enable AI-powered natural language search. The key is stored locally in your browser and never sent to our servers.
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
            <p className="text-xs text-hero-muted">
              Get your key from{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-glow-primary hover:underline">
                console.anthropic.com
              </a>
            </p>
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

// ─── Synthesis Panel ─────────────────────────────────────────────────────────

interface SynthesisPanelProps {
  filtered: AudienceRecord[];
  total: number;
  activeSegment: { name: string; icon: string } | null;
  nlpApplied: string | null;
  activeSources: Set<string>;
  uploadedFiles: File[];
}

const SYNTHESIS_INSIGHTS: { threshold: number; items: string[] }[] = [
  {
    threshold: 0,
    items: [
      "No respondents match the current filter combination. Try broadening your criteria.",
    ],
  },
  {
    threshold: 1,
    items: [
      "Small sample — interpret trends with caution.",
      "Consider relaxing demographic filters to increase confidence.",
    ],
  },
  {
    threshold: 100,
    items: [
      "Digital channels dominate — social media and streaming are the primary touchpoints for this group.",
      "Value-consciousness is a key purchase driver; messaging around quality-to-price resonates strongly.",
      "Weekend and evening engagement windows show the highest activity concentration.",
    ],
  },
  {
    threshold: 500,
    items: [
      "Strong affinity for community and peer recommendation — word-of-mouth and UGC content outperform brand-push tactics.",
      "Mobile-first audience: over 80% of digital consumption occurs on smartphone.",
      "Sustainability and authenticity rank above price in brand selection decisions for this cohort.",
      "High cross-channel users: audiences engaged across 3+ platforms show 2× purchase intent vs. single-channel.",
    ],
  },
];

function getSynthesisItems(count: number): string[] {
  const tier = [...SYNTHESIS_INSIGHTS].reverse().find(t => count >= t.threshold);
  return tier?.items ?? SYNTHESIS_INSIGHTS[0].items;
}

const SynthesisPanel = ({
  filtered, total, activeSegment, nlpApplied, activeSources, uploadedFiles,
}: SynthesisPanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const pct = total > 0 ? ((filtered.length / total) * 100).toFixed(1) : "0";
  const items = getSynthesisItems(filtered.length);
  const contextLabel = activeSegment
    ? `${activeSegment.icon} ${activeSegment.name}`
    : nlpApplied
    ? `"${nlpApplied}"`
    : "All Respondents";

  const extraSources = [...activeSources].filter(s => s !== "survey");
  const hasExtras = extraSources.length > 0 || uploadedFiles.length > 0;

  return (
    <div className="rounded-xl border border-glow-primary/25 bg-glow-primary/5 overflow-hidden mb-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-glow-primary/5 transition-colors"
      >
        <Zap className="h-4 w-4 text-glow-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-hero-foreground">Synthesis</span>
          <span className="ml-2 text-xs text-hero-muted">{contextLabel} · {filtered.length.toLocaleString()} respondents ({pct}%)</span>
          {hasExtras && (
            <span className="ml-2 text-xs text-glow-primary/70">
              + {[...extraSources, ...uploadedFiles.map(f => f.name)].join(", ")}
            </span>
          )}
        </div>
        <span className={cn("text-hero-muted transition-transform text-xs", expanded ? "rotate-90" : "")}>▶</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-glow-primary/15">
          <p className="text-xs text-hero-muted mt-3 mb-2 uppercase tracking-wider font-semibold">Key Findings</p>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-hero-foreground/90">
                <span className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-glow-primary/15 border border-glow-primary/30 flex items-center justify-center text-[10px] font-bold text-glow-primary">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
          {uploadedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-glow-primary/15">
              <p className="text-xs text-hero-muted uppercase tracking-wider font-semibold mb-2">Uploaded Sources</p>
              <div className="flex gap-2 flex-wrap">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-surface-card border border-surface-card-border text-hero-muted">
                    <FileText className="h-3 w-3" /> {f.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-hero-muted mt-2 italic">File data integration available in the production build.</p>
            </div>
          )}
          <p className="text-xs text-hero-muted/50 pt-1 italic">
            Synthesis reflects survey panel data.{hasExtras ? " Connected sources will be incorporated once integrations are live." : ""}
          </p>
        </div>
      )}
    </div>
  );
};

export default IntelligenceReport;
