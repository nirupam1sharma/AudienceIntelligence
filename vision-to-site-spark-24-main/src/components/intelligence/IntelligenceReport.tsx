import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ── Universe projection ───────────────────────────────────────────────────────
const TOTAL_UNIVERSE = 600_000_000;
function projectedReach(matchCount: number, surveyTotal: number): number {
  if (surveyTotal === 0) return 0;
  return Math.round((matchCount / surveyTotal) * TOTAL_UNIVERSE);
}
function fmtReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
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
  /** When set, auto-selects this audience on mount / when it changes */
  initialSegmentId?: string | null;
}

const IntelligenceReport = ({ embedded = false, initialSegmentId }: IntelligenceReportProps) => {
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

  // ── Synthesis snapshot ─────────────────────────────────────────
  // Holds the frozen data the synthesis was last computed from.
  // Only updates when the user explicitly clicks "Regenerate".
  const [synthesisData, setSynthesisData] = useState<AudienceRecord[]>([]);
  const [synthesisDirty, setSynthesisDirty] = useState(false);
  const synthesisSeeded = useRef(false);

  useEffect(() => {
    setSegments(loadSegments());
  }, []);

  // Auto-select segment when arriving from Audience Builder "Intelligence Report" button
  useEffect(() => {
    if (!initialSegmentId) return;
    const seg = loadSegments().find((s) => s.id === initialSegmentId);
    if (seg) setActiveSegment(seg);
  }, [initialSegmentId]);

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

  // Seed synthesis once on first non-empty result
  useEffect(() => {
    if (!synthesisSeeded.current && filtered.length > 0) {
      setSynthesisData(filtered);
      synthesisSeeded.current = true;
    }
  }, [filtered]);

  // Mark dirty whenever filters change after seeding
  useEffect(() => {
    if (synthesisSeeded.current) {
      setSynthesisDirty(true);
    }
  }, [filtered]);

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
                  ? `${activeSegment.icon} ${activeSegment.name} · ~${fmtReach(projectedReach(segmentBaseData.length, allData.length))} reach`
                  : `~${fmtReach(projectedReach(filtered.length, allData.length))} projected reach`}
              </span>
              <span className="text-xs text-hero-muted/50 font-mono">
                n={activeSegment ? segmentBaseData.length.toLocaleString() : filtered.length.toLocaleString()} survey
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
                  synthesisData={synthesisData}
                  liveCount={filtered.length}
                  total={allData.length}
                  activeSegment={activeSegment}
                  nlpApplied={nlpApplied}
                  activeSources={activeSources}
                  uploadedFiles={uploadedFiles}
                  isDirty={synthesisDirty}
                  onRegenerate={() => {
                    setSynthesisData(filtered);
                    setSynthesisDirty(false);
                  }}
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
  synthesisData: AudienceRecord[];
  liveCount: number;
  total: number;
  activeSegment: { name: string; icon: string } | null;
  nlpApplied: string | null;
  activeSources: Set<string>;
  uploadedFiles: File[];
  isDirty: boolean;
  onRegenerate: () => void;
}

// ─── Real data-driven synthesis ──────────────────────────────────────────────

function computeSynthesis(data: AudienceRecord[]): string[] {
  if (data.length === 0)
    return ["No respondents match the current criteria — try broadening your filters."];
  if (data.length < 10)
    return [
      `Very small sample (n=${data.length}) — findings may not be representative.`,
      "Consider relaxing your filters to increase confidence.",
    ];

  const n = data.length;
  const pct = (field: keyof AudienceRecord) =>
    Math.round((data.filter((r) => r[field] === true).length / n) * 100);
  const avg = (field: keyof AudienceRecord) =>
    +(data.reduce((s, r) => s + ((r[field] as number) || 0), 0) / n).toFixed(1);

  // ── Demographics ──────────────────────────────────────────────
  const genderCounts: Record<string, number> = {};
  const ageCounts: Record<string, number> = {};
  data.forEach((r) => {
    genderCounts[r.gender] = (genderCounts[r.gender] || 0) + 1;
    ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1;
  });
  const topGender = Object.entries(genderCounts).sort((a, b) => b[1] - a[1])[0];
  const topAge    = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0];
  const genderPct = Math.round((topGender[1] / n) * 100);
  const agePct    = Math.round((topAge[1]    / n) * 100);

  // ── Social platforms ──────────────────────────────────────────
  const platforms = [
    { label: "YouTube",    field: "youtube_usage"   as const },
    { label: "Facebook",   field: "facebook_usage"  as const },
    { label: "Instagram",  field: "instagram_usage" as const },
    { label: "TikTok",     field: "tiktok_usage"    as const },
    { label: "Twitter/X",  field: "twitter_usage"   as const },
    { label: "Reddit",     field: "reddit_usage"    as const },
    { label: "LinkedIn",   field: "linkedin_usage"  as const },
    { label: "Snapchat",   field: "snapchat_usage"  as const },
  ];
  const platformRanked = platforms
    .map((p) => ({ label: p.label, pct: pct(p.field) }))
    .sort((a, b) => b.pct - a.pct);

  // ── Interests ─────────────────────────────────────────────────
  const interests = [
    { label: "fitness",           field: "interest_fitness"          as const },
    { label: "health & wellness", field: "interest_health_wellness"  as const },
    { label: "technology",        field: "interest_technology"       as const },
    { label: "travel",            field: "interest_travel"           as const },
    { label: "movies",            field: "interest_movies"           as const },
    { label: "music",             field: "interest_music"            as const },
    { label: "sports",            field: "interest_sports"           as const },
    { label: "cooking",           field: "interest_cooking"          as const },
    { label: "shopping",          field: "interest_shopping"         as const },
    { label: "finance",           field: "interest_finance"          as const },
    { label: "reading",           field: "interest_reading"          as const },
    { label: "gaming",            field: "interest_games"            as const },
    { label: "art",               field: "interest_art"              as const },
    { label: "fashion",           field: "interest_fashion"          as const },
    { label: "nature",            field: "interest_nature"           as const },
    { label: "live sports",       field: "interest_live_sports"      as const },
  ];
  const interestRanked = interests
    .map((i) => ({ label: i.label, pct: pct(i.field) }))
    .sort((a, b) => b.pct - a.pct);

  // ── Values ────────────────────────────────────────────────────
  const values = [
    { label: "family",                   field: "value_family"                   as const },
    { label: "working hard",             field: "value_working_hard"             as const },
    { label: "financial responsibility", field: "value_financial_responsibility" as const },
    { label: "enjoying life",            field: "value_enjoying_life"            as const },
    { label: "healthy lifestyle",        field: "value_healthy_lifestyle"        as const },
    { label: "self-improvement",         field: "value_self_improvement"         as const },
    { label: "honesty",                  field: "value_honesty"                  as const },
    { label: "environment",              field: "value_environment"              as const },
    { label: "looking good",             field: "value_looking_good"             as const },
    { label: "wealth",                   field: "value_wealth"                   as const },
  ];
  const valueRanked = values
    .map((v) => ({ label: v.label, avg: avg(v.field) }))
    .sort((a, b) => b.avg - a.avg);

  const highIncomePct    = pct("is_high_income");
  const dailySocialPct   = pct("is_social_active_daily");
  const top2Platforms    = platformRanked.slice(0, 2);
  const top3Interests    = interestRanked.slice(0, 3);
  const topValue         = valueRanked[0];
  const bottomValue      = valueRanked[valueRanked.length - 1];

  // ── Build findings ────────────────────────────────────────────
  const findings: string[] = [];

  // 1 — Demographics
  findings.push(
    `${genderPct}% ${topGender[0].toLowerCase()}, with ${topAge[0]} the largest age cohort (${agePct}%) and ${highIncomePct}% classified as high income.`
  );

  // 2 — Social platforms
  findings.push(
    `${top2Platforms[0].label} (${top2Platforms[0].pct}%) and ${top2Platforms[1].label} (${top2Platforms[1].pct}%) are the dominant social channels — prioritise these in media planning.`
  );

  // 3 — Interests
  findings.push(
    `Top interests: ${top3Interests.map((i) => `${i.label} (${i.pct}%)`).join(", ")} — content and partnerships should align to these affinities.`
  );

  // 4 — Core value
  findings.push(
    `"${topValue.label.charAt(0).toUpperCase() + topValue.label.slice(1)}" is the highest-rated personal value (avg ${topValue.avg}/10); messaging centred on this will resonate most. "${bottomValue.label.charAt(0).toUpperCase() + bottomValue.label.slice(1)}" ranks lowest (${bottomValue.avg}/10) — avoid leading with it.`
  );

  // 5 — Engagement signal
  findings.push(
    `${dailySocialPct}% are daily social media users${dailySocialPct > 60 ? ", indicating a highly digitally engaged audience well-suited for always-on campaigns" : dailySocialPct > 30 ? ", showing moderate digital engagement — complement social with broader media" : " — this audience is less dependent on social; consider traditional and search channels"}.`
  );

  return findings;
}

const SynthesisPanel = ({
  synthesisData, liveCount, total, activeSegment, nlpApplied, activeSources, uploadedFiles, isDirty, onRegenerate,
}: SynthesisPanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const pct = total > 0 ? ((synthesisData.length / total) * 100).toFixed(1) : "0";
  const reach = projectedReach(synthesisData.length, total);
  const items = computeSynthesis(synthesisData);
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
          <span className="ml-2 text-xs text-hero-muted">
            {contextLabel} · <span className="text-glow-primary font-semibold">~{fmtReach(reach)}</span> projected reach ({pct}% of 600M)
          </span>
          {hasExtras && (
            <span className="ml-2 text-xs text-glow-primary/70">
              + {[...extraSources, ...uploadedFiles.map(f => f.name)].join(", ")}
            </span>
          )}
        </div>
        <span className={cn("text-hero-muted transition-transform text-xs", expanded ? "rotate-90" : "")}>▶</span>
      </button>

      {isDirty && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-500/10 border-t border-amber-500/20">
          <span className="text-xs text-amber-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Filters changed — synthesis may be out of date
            {liveCount !== synthesisData.length && (
              <span className="ml-1 opacity-70">
                (showing {liveCount.toLocaleString()} vs {synthesisData.length.toLocaleString()} when last generated)
              </span>
            )}
          </span>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition-colors shrink-0"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
            </svg>
            Regenerate Synthesis
          </button>
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-glow-primary/15">
          <div className="mt-3 mb-3 flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-black text-glow-primary">~{fmtReach(reach)}</div>
              <div className="text-xs text-hero-muted">projected reach · {pct}% of 600M universe</div>
            </div>
            <div className="text-xs text-hero-muted/60 border-l border-surface-card-border pl-4">
              n={synthesisData.length.toLocaleString()} survey respondents
              {isDirty && liveCount !== synthesisData.length && (
                <span className="ml-1 text-amber-400/70">(live: {liveCount.toLocaleString()})</span>
              )}
            </div>
          </div>
          <p className="text-xs text-hero-muted mb-2 uppercase tracking-wider font-semibold">Key Findings</p>
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
