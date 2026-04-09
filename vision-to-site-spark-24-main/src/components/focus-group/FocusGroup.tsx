import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Users, Send, Loader2, Key, AlertTriangle, ChevronDown, Check,
  Save, BookOpen, Trash2, Copy, FileText, Zap, StopCircle,
  MessageSquare, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadAudienceData, type AudienceRecord } from "@/lib/audienceData";
import { loadSegments, applySegmentFilters, type Segment } from "@/lib/segmentData";
import { getAnthropicKey, setAnthropicKey, deleteAnthropicKey } from "@/lib/anthropicNlp";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DiscussionType, Participant, Message, SessionSummary } from "@/lib/focusGroupTypes";
import {
  loadSavedFocusGroups, saveFocusGroup, deleteSavedFocusGroup,
  type SavedFocusGroup,
} from "@/lib/focusGroupStorage";
import { downloadFocusGroupPdf } from "@/lib/reportDownload";

// ─── Constants ────────────────────────────────────────────────────

const DISCUSSION_TYPES: { id: DiscussionType; label: string; desc: string }[] = [
  { id: "concept-reaction",      label: "Concept Reaction",      desc: "Test reactions to new concepts or products" },
  { id: "message-testing",       label: "Message Testing",        desc: "Evaluate messaging effectiveness" },
  { id: "category-exploration",  label: "Category Exploration",   desc: "Deep-dive into category attitudes" },
  { id: "brand-perception",      label: "Brand Perception",       desc: "Discuss brand positioning and perception" },
];

const PARTICIPANT_COUNTS = [2, 4, 6, 8];

const PARTICIPANT_COLORS = [
  "#e53e3e", "#dd6b20", "#38a169", "#3182ce",
  "#805ad5", "#d53f8c", "#00b5d8", "#718096",
];

const MALE_NAMES   = ["James", "Michael", "David", "Robert", "William", "Thomas", "Daniel", "Mark"];
const FEMALE_NAMES = ["Sarah", "Emily", "Jessica", "Jennifer", "Amanda", "Ashley", "Stephanie", "Rebecca"];

const QUICK_PROMPTS = [
  { label: "Initial reaction",  text: "What is your initial reaction to this?" },
  { label: "Purchase intent",   text: "Would you purchase or use this? Why or why not?" },
  { label: "Improvements",      text: "What improvements or changes would you suggest?" },
  { label: "Objections",        text: "What concerns or objections do you have?" },
];

// ─── Helpers ──────────────────────────────────────────────────────

function buildParticipantProfile(r: AudienceRecord, name: string): string {
  const interests: string[] = [];
  if (r.interest_sports) interests.push("sports");
  if (r.interest_health_wellness) interests.push("health & wellness");
  if (r.interest_travel) interests.push("travel");
  if (r.interest_fitness) interests.push("fitness");
  if (r.interest_technology) interests.push("technology");
  if (r.interest_music) interests.push("music");
  if (r.interest_cooking) interests.push("cooking");
  if (r.interest_reading) interests.push("reading");
  if (r.interest_finance) interests.push("finance");
  if (r.interest_fashion) interests.push("fashion");

  const media: string[] = [];
  if (r.facebook_usage) media.push("Facebook");
  if (r.youtube_usage) media.push("YouTube");
  if (r.instagram_usage) media.push("Instagram");
  if (r.tiktok_usage) media.push("TikTok");
  if (r.linkedin_usage) media.push("LinkedIn");
  if (r.uses_podcasts) media.push("podcasts");
  if (r.uses_tv) media.push("TV");

  const topValues: string[] = [];
  const vals = [
    ["family", r.value_family], ["hard work", r.value_working_hard],
    ["enjoying life", r.value_enjoying_life], ["healthy lifestyle", r.value_healthy_lifestyle],
    ["self-improvement", r.value_self_improvement], ["honesty", r.value_honesty],
    ["environment", r.value_environment],
  ] as [string, number][];
  vals.filter(([, v]) => v >= 4).forEach(([k]) => topValues.push(k));

  return [
    `Name: ${name}`,
    `Demographics: ${r.gender}, ${r.age_group}, ${r.is_high_income ? "high income ($100k+)" : "moderate income"}, ${r.race_ethnicity || ""}`,
    interests.length ? `Interests: ${interests.join(", ")}` : "",
    media.length ? `Media: ${media.join(", ")}` : "",
    topValues.length ? `Core values: ${topValues.join(", ")}` : "",
    `Social media usage: ${r.is_social_active_daily ? "daily active" : "occasional"}`,
  ].filter(Boolean).join("\n");
}

function generateParticipants(data: AudienceRecord[], count: number): Participant[] {
  if (!data.length) return [];
  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, count);
  const usedNames: Record<string, number> = { male: 0, female: 0 };
  return shuffled.map((r, i) => {
    const isFemale = r.gender === "Female";
    const namePool = isFemale ? FEMALE_NAMES : MALE_NAMES;
    const key = isFemale ? "female" : "male";
    const name = namePool[usedNames[key] % namePool.length];
    usedNames[key]++;
    return {
      id: String(i),
      name,
      initials: name.slice(0, 2).toUpperCase(),
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
      gender: r.gender,
      age_group: r.age_group,
      profile: buildParticipantProfile(r, name),
    };
  });
}

function makeMessage(
  role: Message["role"],
  content: string,
  extra?: Partial<Message>,
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ...extra,
  };
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

// ─── Saved Sessions List ──────────────────────────────────────────

const DTYPE_LABELS: Record<string, string> = {
  "concept-reaction": "Concept Reaction",
  "message-testing": "Message Testing",
  "category-exploration": "Category Exploration",
  "brand-perception": "Brand Perception",
};

const SavedSessionsList = ({ sessions, onView, onClone, onDelete, onPdf }: {
  sessions: SavedFocusGroup[];
  onView: (s: SavedFocusGroup) => void;
  onClone: (s: SavedFocusGroup) => void;
  onDelete: (id: string) => void;
  onPdf: (s: SavedFocusGroup) => void;
}) => {
  if (!sessions.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <MessageSquare className="h-10 w-10 text-hero-muted/30 stroke-1" />
      <p className="text-hero-muted text-sm">No saved sessions yet. Run a focus group and save it.</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {sessions.map((s) => (
        <div key={s.id} className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3 hover:border-glow-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-hero-foreground line-clamp-2">{s.topic || "(No topic)"}</p>
              <p className="text-xs text-hero-muted mt-0.5">{DTYPE_LABELS[s.discussionType]} · {s.audienceLabel} · n={s.audienceCount.toLocaleString()}</p>
            </div>
            <span className="text-[10px] text-hero-muted/60 shrink-0">{new Date(s.savedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-glow-primary/10 text-glow-primary text-[10px] border border-glow-primary/20">
              {s.participantCount} participants
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-dark text-hero-muted text-[10px] border border-surface-card-border">
              {s.messages.filter(m => m.role === "participant").length} responses
            </span>
            {s.summary && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] border border-green-500/20">
                ✓ Summary
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => onView(s)}
              className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
              <BookOpen className="h-3 w-3" /> View
            </Button>
            <Button size="sm" variant="outline" onClick={() => onClone(s)}
              className="flex-1 border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
              <Copy className="h-3 w-3" /> Clone
            </Button>
            <Button size="sm" variant="outline" onClick={() => onPdf(s)}
              className="border-surface-card-border text-hero-muted hover:text-glow-primary gap-1.5 text-xs h-7">
              <FileText className="h-3 w-3" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(s.id)}
              className="border-surface-card-border text-hero-muted hover:text-red-400 text-xs h-7">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const FocusGroup = () => {
  const [allData, setAllData]     = useState<AudienceRecord[]>([]);
  const [segments, setSegments]   = useState<Segment[]>([]);
  const [loading, setLoading]     = useState(true);

  // Top-level view
  const [mainView, setMainView]   = useState<"new" | "saved">("new");
  const [savedSessions, setSavedSessions] = useState<SavedFocusGroup[]>([]);
  const refreshSaved = () => setSavedSessions(loadSavedFocusGroups());
  useEffect(() => { refreshSaved(); }, []);

  // Session state machine
  const [sessionState, setSessionState] = useState<"setup" | "active" | "ended">("setup");

  // Audience
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const segmentSets = useMemo(() => {
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

  // Setup
  const [discussionType, setDiscussionType] = useState<DiscussionType>("concept-reaction");
  const [topic, setTopic] = useState("");
  const [participantCount, setParticipantCount] = useState(4);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Session
  const [messages, setMessages]       = useState<Message[]>([]);
  const [moderatorInput, setModeratorInput] = useState("");
  const [responding, setResponding]   = useState(false);
  const [summary, setSummary]         = useState<SessionSummary | null>(null);
  const [apiError, setApiError]       = useState<string | null>(null);
  const transcriptRef                  = useRef<HTMLDivElement>(null);

  // Save feedback
  const [savedFeedback, setSavedFeedback] = useState(false);

  // API key
  const [apiKey, setApiKeyState]      = useState<string | null>(getAnthropicKey());
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput]       = useState("");
  const [keyError, setKeyError]       = useState<string | null>(null);

  useEffect(() => {
    setSegments(loadSegments());
    loadAudienceData().then((d) => { setAllData(d); setLoading(false); });
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveKey = () => {
    const t = keyInput.trim();
    if (!t.startsWith("sk-ant-")) { setKeyError("Key must start with sk-ant-"); return; }
    setAnthropicKey(t); setApiKeyState(t); setKeyInput(""); setKeyError(null); setShowKeyDialog(false);
  };

  // ── Start session ────────────────────────────────────────────────
  const startSession = () => {
    if (!topic.trim()) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    const ps = generateParticipants(audienceData, participantCount);
    setParticipants(ps);
    setMessages([
      makeMessage("system", `Focus Group Session started · ${DTYPE_LABELS[discussionType]} · ${ps.length} participants · ${audienceLabel} (n=${audienceData.length})`),
      makeMessage("system", `Topic: "${topic}"`),
    ]);
    setSummary(null);
    setApiError(null);
    setSessionState("active");
  };

  // ── Send moderator message + get responses ────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || responding) return;
    if (!apiKey) { setShowKeyDialog(true); return; }
    setModeratorInput("");
    setApiError(null);

    const modMsg = makeMessage("moderator", trimmed);
    setMessages((prev) => [...prev, modMsg]);
    setResponding(true);

    const profilesText = participants.map((p) => `--- Participant: ${p.name} ---\n${p.profile}`).join("\n\n");
    const history = [...messages, modMsg]
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "moderator" ? "MODERATOR" : m.participantName}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are simulating a realistic focus group session.
The participants below each have distinct demographic and psychographic profiles. Respond authentically for EACH participant based on their individual profile. Participants may agree, disagree, or build on others' points naturally.
${profilesText}

Rules:
- Each response should be 2–4 sentences, conversational, specific to their profile
- Participants can reference their own experiences and demographics
- Occasional light disagreement between participants is natural
- Return ONLY valid JSON array: [{"id":"0","name":"Sarah","response":"..."},...]
- One entry per participant, ordered by id`;

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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `Discussion history:\n${history}\n\nThe moderator just asked: "${trimmed}"\n\nGenerate one response from each of the ${participants.length} participants.`,
          }],
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        if (resp.status === 401) { deleteAnthropicKey(); setApiKeyState(null); throw new Error("Invalid API key."); }
        throw new Error(b?.error?.message || `API error ${resp.status}`);
      }
      const data = await resp.json();
      const raw  = data.content?.[0]?.text ?? "[]";
      const json = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const responses: { id: string; name: string; response: string }[] = JSON.parse(json);
      const newMessages = responses.map((r) => {
        const p = participants.find((p) => p.id === r.id) ?? participants.find((p) => p.name === r.name) ?? participants[0];
        return makeMessage("participant", r.response, {
          participantId: p.id,
          participantName: p.name,
          color: p.color,
        });
      });
      setMessages((prev) => [...prev, ...newMessages]);
    } catch (err: any) {
      setApiError(err.message || "Something went wrong.");
      if (err.message?.includes("Invalid API key")) setShowKeyDialog(true);
    } finally {
      setResponding(false);
    }
  }, [responding, apiKey, participants, messages, topic]);

  // ── Synthesize ───────────────────────────────────────────────────
  const synthesize = useCallback(async () => {
    if (!apiKey || responding) return;
    setResponding(true);
    const transcript = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "moderator" ? "MODERATOR" : m.participantName}: ${m.content}`)
      .join("\n");
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
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `Synthesize this focus group discussion in 3–5 key insight bullets. Be specific and actionable. Return ONLY valid JSON: {"insights":["...","..."]}\n\nTranscript:\n${transcript}`,
          }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data.content?.[0]?.text ?? "{}";
        const json = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
        const parsed: { insights: string[] } = JSON.parse(json);
        const bullets = parsed.insights.map((i) => `• ${i}`).join("\n");
        setMessages((prev) => [...prev, makeMessage("system", `🔍 Mid-session synthesis:\n${bullets}`)]);
      }
    } catch { /* non-fatal */ } finally {
      setResponding(false);
    }
  }, [apiKey, responding, messages]);

  // ── End session & generate summary ───────────────────────────────
  const endSession = useCallback(async () => {
    setSessionState("ended");
    if (!apiKey) return;
    const transcript = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "moderator" ? "MODERATOR" : m.participantName}: ${m.content}`)
      .join("\n");
    if (!transcript.trim()) return;
    setResponding(true);
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
          max_tokens: 900,
          messages: [{
            role: "user",
            content: `Analyse this focus group transcript and produce a session report. Return ONLY valid JSON:
{"keyThemes":["..."],"keyQuotes":[{"quote":"...","participant":"..."}],"overallSentiment":"...","recommendations":["..."]}

- keyThemes: 4–6 main themes
- keyQuotes: 3–5 verbatim quotes with participant name
- overallSentiment: one paragraph summary of overall mood/sentiment
- recommendations: 3–5 actionable recommendations

Transcript:\n${transcript}`,
          }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data.content?.[0]?.text ?? "{}";
        const json = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
        setSummary(JSON.parse(json) as SessionSummary);
      }
    } catch { /* non-fatal */ } finally {
      setResponding(false);
    }
  }, [apiKey, messages]);

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = () => {
    saveFocusGroup({
      discussionType, topic, audienceLabel, audienceCount: audienceData.length,
      participantCount, participants, messages,
      summary: summary ?? undefined,
    });
    refreshSaved();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleView = (s: SavedFocusGroup) => {
    setDiscussionType(s.discussionType);
    setTopic(s.topic);
    setParticipantCount(s.participantCount);
    setParticipants(s.participants);
    setMessages(s.messages);
    setSummary(s.summary ?? null);
    setSessionState("ended");
    setMainView("new");
  };

  const handleClone = (s: SavedFocusGroup) => {
    setDiscussionType(s.discussionType);
    setTopic(s.topic);
    setParticipantCount(s.participantCount);
    setMessages([]);
    setSummary(null);
    setSessionState("setup");
    setMainView("new");
  };

  const handleDelete = (id: string) => {
    deleteSavedFocusGroup(id);
    refreshSaved();
  };

  const handlePdf = (s: SavedFocusGroup) => {
    downloadFocusGroupPdf({
      discussionType: s.discussionType,
      topic: s.topic,
      audienceLabel: s.audienceLabel,
      audienceCount: s.audienceCount,
      participants: s.participants,
      messages: s.messages,
      summary: s.summary,
    });
  };

  const resetSession = () => {
    setTopic("");
    setMessages([]);
    setSummary(null);
    setApiError(null);
    setSessionState("setup");
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-glow-primary/30 border-t-glow-primary rounded-full animate-spin" />
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Top toggle */}
      <div className="flex items-center gap-2 border-b border-surface-card-border pb-3">
        <button onClick={() => setMainView("new")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
            mainView === "new" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          New Session
        </button>
        <button onClick={() => setMainView("saved")}
          className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
            mainView === "saved" ? "bg-glow-primary text-white" : "text-hero-muted hover:text-hero-foreground")}>
          Saved Sessions
          {savedSessions.length > 0 && (
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full",
              mainView === "saved" ? "bg-white/20 text-white" : "bg-surface-dark text-hero-muted")}>
              {savedSessions.length}
            </span>
          )}
        </button>
      </div>

      {mainView === "saved" ? (
        <SavedSessionsList
          sessions={savedSessions}
          onView={handleView}
          onClone={handleClone}
          onDelete={handleDelete}
          onPdf={handlePdf}
        />
      ) : sessionState === "setup" ? (
        // ── Setup screen ──────────────────────────────────────────
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Discussion type */}
            <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
              <h3 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Discussion Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {DISCUSSION_TYPES.map((dt) => (
                  <button key={dt.id} onClick={() => setDiscussionType(dt.id)}
                    className={cn("text-left p-3 rounded-lg border text-xs transition-colors",
                      discussionType === dt.id
                        ? "border-glow-primary bg-glow-primary/10 text-glow-primary"
                        : "border-surface-card-border text-hero-muted hover:border-glow-primary/40 hover:text-hero-foreground")}>
                    <p className="font-semibold">{dt.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{dt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-2">
              <label className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">
                Discussion Topic <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  discussionType === "concept-reaction" ? "e.g. Reactions to a new fitness app priced at $19.99/month" :
                  discussionType === "message-testing" ? "e.g. Testing the tagline 'Live More, Spend Less'" :
                  discussionType === "category-exploration" ? "e.g. Attitudes towards plant-based food alternatives" :
                  "e.g. Perceptions of Nike vs Adidas among 25-40 year olds"
                }
                rows={3}
                className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 text-sm resize-none"
              />
            </div>

            {/* Participant count + audience */}
            <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-4">
              <h3 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Participants & Audience</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-hero-muted w-28 shrink-0">Group size</span>
                <div className="flex gap-2">
                  {PARTICIPANT_COUNTS.map((n) => (
                    <button key={n} onClick={() => setParticipantCount(n)}
                      className={cn("w-10 h-10 rounded-lg border text-sm font-semibold transition-colors",
                        participantCount === n
                          ? "border-glow-primary bg-glow-primary/10 text-glow-primary"
                          : "border-surface-card-border text-hero-muted hover:border-glow-primary/40")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-hero-muted w-28 shrink-0">Audience</span>
                <div className="flex-1">
                  <AudienceSelector segments={segments} selectedId={selectedSegmentId} onChange={setSelectedSegmentId} count={audienceData.length} />
                </div>
              </div>
            </div>

            {/* API key prompt */}
            {!apiKey && (
              <button onClick={() => setShowKeyDialog(true)}
                className="flex items-center gap-2 text-xs text-glow-accent hover:underline">
                <Key className="h-3.5 w-3.5" /> Set Anthropic API key to run sessions
              </button>
            )}

            <Button
              onClick={startSession}
              disabled={!topic.trim()}
              className="w-full bg-glow-primary hover:bg-glow-primary/90 text-white font-semibold h-11 gap-2">
              <Users className="h-4 w-4" /> Start Focus Group Session
            </Button>
          </div>

          {/* Participant preview */}
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
              <h3 className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Participant Preview</h3>
              <p className="text-[10px] text-hero-muted">{participantCount} synthetic participants drawn from {audienceLabel} (n={audienceData.length.toLocaleString()})</p>
              <div className="space-y-2 mt-2">
                {Array.from({ length: participantCount }).map((_, i) => {
                  const isFemale = i % 2 === 0;
                  const names = isFemale ? FEMALE_NAMES : MALE_NAMES;
                  const name = names[Math.floor(i / 2) % names.length];
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length] }}>
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-hero-foreground">{name}</p>
                        <p className="text-[10px] text-hero-muted">Sampled from audience data</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      ) : sessionState === "active" ? (
        // ── Active session ────────────────────────────────────────
        <div className="space-y-4">
          {/* Session header */}
          <div className="rounded-xl bg-surface-card border border-surface-card-border px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Session Active
              </span>
              <span className="text-hero-muted text-xs">·</span>
              <span className="text-xs text-hero-muted">{DTYPE_LABELS[discussionType]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {participants.map((p) => (
                <div key={p.id} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: p.color }} title={p.name}>
                  {p.initials}
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={endSession} disabled={responding}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-7 ml-auto">
              <StopCircle className="h-3 w-3" /> End Session
            </Button>
          </div>

          {/* Transcript */}
          <div ref={transcriptRef}
            className="rounded-xl bg-surface-card border border-surface-card-border p-4 space-y-3 overflow-y-auto"
            style={{ height: "400px" }}>
            {messages.map((msg) => (
              <div key={msg.id} className={cn(
                "flex gap-3",
                msg.role === "moderator" ? "justify-end" : "justify-start"
              )}>
                {msg.role === "participant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: msg.color }}>
                    {msg.participantName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {msg.role === "system" && (
                  <div className="w-full text-center">
                    <span className="inline-block px-3 py-1.5 rounded-full bg-glow-accent/10 border border-glow-accent/20 text-[10px] text-glow-accent whitespace-pre-line text-left max-w-lg">{msg.content}</span>
                  </div>
                )}
                {msg.role !== "system" && (
                  <div className={cn(
                    "max-w-sm rounded-xl px-3 py-2 text-xs",
                    msg.role === "moderator"
                      ? "bg-[#004638] text-white rounded-br-sm"
                      : "bg-surface-dark text-hero-foreground border border-surface-card-border rounded-bl-sm"
                  )}>
                    {msg.role === "participant" && (
                      <p className="font-semibold mb-0.5" style={{ color: msg.color }}>{msg.participantName}</p>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className="text-[9px] opacity-50 mt-1 text-right">{msg.timestamp}</p>
                  </div>
                )}
                {msg.role === "moderator" && (
                  <div className="w-7 h-7 rounded-full bg-[#004638] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                    M
                  </div>
                )}
              </div>
            ))}
            {responding && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-surface-dark border border-surface-card-border flex items-center justify-center shrink-0">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-hero-muted" />
                </div>
                <div className="bg-surface-dark border border-surface-card-border rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-hero-muted/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-hero-muted/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-hero-muted/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{apiError}</p>
            </div>
          )}

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((qp) => (
              <button key={qp.label} onClick={() => sendMessage(qp.text)} disabled={responding}
                className="px-3 py-1.5 rounded-full border border-surface-card-border text-xs text-hero-muted hover:text-glow-primary hover:border-glow-primary/40 transition-colors disabled:opacity-40">
                {qp.label}
              </button>
            ))}
            <button onClick={synthesize} disabled={responding || messages.filter(m=>m.role!=="system").length < 4}
              className="px-3 py-1.5 rounded-full border border-glow-accent/30 text-xs text-glow-accent hover:bg-glow-accent/10 transition-colors disabled:opacity-40 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Synthesize
            </button>
          </div>

          {/* Moderator input */}
          <div className="flex gap-2">
            <Textarea
              value={moderatorInput}
              onChange={(e) => setModeratorInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage(moderatorInput); }}
              placeholder="Ask the group a question… (⌘/Ctrl+Enter to send)"
              rows={2}
              disabled={responding}
              className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 text-sm resize-none flex-1"
            />
            <Button onClick={() => sendMessage(moderatorInput)} disabled={responding || !moderatorInput.trim()}
              className="bg-glow-primary hover:bg-glow-primary/90 text-white self-end h-10 w-10 p-0 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

      ) : (
        // ── Session ended / summary ───────────────────────────────
        <div className="space-y-5">
          {/* Action bar */}
          <div className="rounded-xl bg-surface-card border border-surface-card-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-hero-foreground">{topic}</p>
              <p className="text-xs text-hero-muted">{DTYPE_LABELS[discussionType]} · {audienceLabel} · {participants.length} participants</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={resetSession}
                className="border-surface-card-border text-hero-muted hover:text-hero-foreground gap-1.5 text-xs h-7">
                <RefreshCw className="h-3 w-3" /> New Session
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadFocusGroupPdf({
                discussionType, topic, audienceLabel, audienceCount: audienceData.length,
                participants, messages, summary: summary ?? undefined,
              })}
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

          {/* Summary */}
          {responding && !summary && (
            <div className="flex items-center gap-2 text-xs text-hero-muted p-4 rounded-xl border border-surface-card-border">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-glow-primary" />
              Generating session summary…
            </div>
          )}
          {summary && (
            <div className="space-y-4">
              {/* Overall sentiment */}
              <div className="rounded-xl bg-glow-primary/5 border border-glow-primary/20 p-5 space-y-1.5">
                <h4 className="text-xs font-bold text-glow-primary uppercase tracking-wider">Overall Sentiment</h4>
                <p className="text-sm text-hero-foreground/80 leading-relaxed">{summary.overallSentiment}</p>
              </div>
              {/* Key themes + recommendations */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
                  <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Key Themes</h4>
                  <ul className="space-y-2">
                    {summary.keyThemes.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-hero-foreground/80">
                        <span className="w-5 h-5 rounded-full bg-glow-primary/15 text-glow-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
                  <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Recommendations</h4>
                  <ul className="space-y-2">
                    {summary.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-hero-foreground/80">
                        <span className="text-glow-accent shrink-0 mt-0.5">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Key quotes */}
              <div className="rounded-xl bg-surface-card border border-surface-card-border p-5 space-y-3">
                <h4 className="text-xs font-bold text-hero-foreground uppercase tracking-wider">Key Quotes</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {summary.keyQuotes.map((q, i) => (
                    <div key={i} className="p-3 rounded-lg bg-surface-dark border border-surface-card-border space-y-1.5">
                      <p className="text-xs text-hero-foreground/80 italic">"{q.quote}"</p>
                      <p className="text-[10px] text-hero-muted font-medium">— {q.participant}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Full transcript (collapsed) */}
          <details className="rounded-xl bg-surface-card border border-surface-card-border overflow-hidden">
            <summary className="px-5 py-3 text-xs font-semibold text-hero-muted cursor-pointer hover:text-hero-foreground flex items-center gap-2 select-none">
              <MessageSquare className="h-3.5 w-3.5" /> View Full Transcript ({messages.filter(m=>m.role!=="system").length} exchanges)
            </summary>
            <div className="px-5 pb-5 space-y-2 max-h-96 overflow-y-auto">
              {messages.filter(m => m.role !== "system").map((msg) => (
                <div key={msg.id} className="flex gap-2 text-xs">
                  <span className={cn("font-semibold shrink-0 w-24",
                    msg.role === "moderator" ? "text-[#004638]" : "")}
                    style={msg.role === "participant" ? { color: msg.color } : undefined}>
                    {msg.role === "moderator" ? "Moderator" : msg.participantName}:
                  </span>
                  <span className="text-hero-foreground/80">{msg.content}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* API key dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="bg-surface-card border-surface-card-border text-hero-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-glow-primary" />Anthropic API Key</DialogTitle>
            <DialogDescription className="text-hero-muted">Required to run AI focus group sessions. Stored locally in your browser only.</DialogDescription>
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

export default FocusGroup;
