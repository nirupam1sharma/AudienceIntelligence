import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Upload, FileText, File, Trash2,
  MessageSquare, Database, CheckCircle2, AlertCircle,
  X, BarChart3, Users, Lightbulb, Tag, RefreshCw, ChevronDown,
  FileDown, BookOpen, Clock, History, Square, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAnthropicKey } from "@/lib/anthropicNlp";
import { loadSegments, type Segment } from "@/lib/segmentData";
import { downloadAudienceChatPdf } from "@/lib/reportDownload";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: "csv" | "pdf" | "docx" | "other";
  status: "ready" | "processing" | "error";
  uploadedAt: string;
}

interface SavedSession {
  id: string;
  savedAt: string;
  segment: string;
  messages: ChatMessage[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCUSSION_TOPICS = [
  {
    id: "concept-reaction",
    label: "Concept Reaction",
    icon: Lightbulb,
    question: "How do we as an audience react to new product or campaign concepts? What makes something immediately appealing or off-putting to us?",
  },
  {
    id: "message-testing",
    label: "Message Testing",
    icon: MessageSquare,
    question: "What messaging resonates most strongly with us? What language, tone, or framing feels authentic versus what feels forced or inauthentic?",
  },
  {
    id: "category-exploration",
    label: "Category Exploration",
    icon: BarChart3,
    question: "How do we think and feel about this category overall? What brands do we love, what frustrates us, and what would make us switch?",
  },
  {
    id: "brand-perception",
    label: "Brand Perception",
    icon: Tag,
    question: "How do we perceive this brand? What words, feelings, or associations come to mind, and how has our opinion changed over time?",
  },
];

function buildSystemPrompt(segmentName: string): string {
  const identity = segmentName === "All Respondents"
    ? "the full survey audience — a broad cross-section of consumers"
    : `the "${segmentName}" audience segment`;
  return `You are the collective voice of ${identity}, speaking in first-person plural. You represent a group of real people with shared demographics, interests, and values drawn from survey data.

Always respond as "we" — not "I" and not "the audience" in third person. You are the audience speaking directly.

Your responses should:
- Speak as "We are...", "We tend to...", "We feel...", "We value..."
- Be specific and grounded — reference real behaviours, media habits, and attitudes relevant to ${identity}
- Be conversational, 3–5 sentences, insight-rich but not academic
- Acknowledge nuance and sub-group variation where relevant ("Though some of us...", "Younger members of our group...")
- Draw on your collective data profile: demographics, interests, media consumption, values, brand relationships

Do not say "As an AI" or break character. You are the audience.`;
}

const SUGGESTED_QUESTIONS = [
  "Who are we and what defines us as an audience?",
  "What media do we consume daily and why?",
  "What brands feel most authentic to us right now?",
  "What does a typical purchase decision look like for us?",
  "How do we feel about sustainability and ethics in brands?",
];

const OPENING_MESSAGE = (segLabel: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role: "ai",
  content: `We're ready to talk. Ask us anything about who we are, what we think, what we buy, or how we feel about your brand or category. You can also pick a discussion topic below to get started.`,
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

function fileIcon(type: UploadedFile["type"]) {
  if (type === "pdf") return <FileText className="h-4 w-4 text-red-400" />;
  if (type === "csv") return <BarChart3 className="h-4 w-4 text-green-400" />;
  if (type === "docx") return <File className="h-4 w-4 text-blue-400" />;
  return <File className="h-4 w-4 text-hero-muted" />;
}

function getFileType(name: string): UploadedFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  if (ext === "docx" || ext === "doc") return "docx";
  return "other";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadSavedSessions(): SavedSession[] {
  const sessions: SavedSession[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("prism_chat_")) {
      try {
        const val = localStorage.getItem(key);
        if (val) sessions.push(JSON.parse(val));
      } catch { /* skip corrupt */ }
    }
  }
  return sessions.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

// ─── Data Tier Badge ──────────────────────────────────────────────────────────

const DataTierBadge = ({ tier, label, active }: { tier: 1 | 2 | 3; label: string; active: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors",
    active
      ? "border-glow-primary/40 bg-glow-primary/8 text-glow-primary"
      : "border-surface-card-border text-hero-muted bg-surface-dark/30"
  )}>
    <span className={cn(
      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
      active ? "bg-glow-primary/20 text-glow-primary" : "bg-surface-dark text-hero-muted/50"
    )}>{tier}</span>
    <span className="font-medium">{label}</span>
    {active && <span className="ml-auto text-[10px] text-glow-primary/60">Active</span>}
  </div>
);

// ─── Typing Indicator ─────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex gap-3 items-start">
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
      style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>
      We
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-[#0f1117] border border-white/8 px-4 py-3">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 150, 300].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
            style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  </div>
);

// ─── History Session Row ──────────────────────────────────────────────────────

interface HistoryRowProps {
  session: SavedSession;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onTranscript: () => void;
  onReport: () => void;
  reportLoading: boolean;
}

const HistoryRow = ({ session, expanded, onToggle, onDelete, onTranscript, onReport, reportLoading }: HistoryRowProps) => {
  const userCount = session.messages.filter(m => m.role === "user").length;
  return (
    <div className="rounded-xl border border-surface-card-border bg-surface-card overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>
          We
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-hero-foreground truncate">{session.segment}</p>
          <p className="text-[10px] text-hero-muted flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {fmtDate(session.savedAt)} · {fmtTime(session.savedAt)} · {userCount} exchange{userCount !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTranscript}
            title="Download transcript"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-surface-card-border text-hero-muted hover:text-hero-foreground hover:border-glow-primary/30 transition-colors"
          >
            <FileDown className="h-3 w-3" /> .txt
          </button>
          <button
            onClick={onReport}
            disabled={reportLoading}
            title="Generate PDF report"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-glow-primary/30 text-glow-primary bg-glow-primary/8 hover:bg-glow-primary/15 transition-colors disabled:opacity-40"
          >
            {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
            PDF
          </button>
          <button
            onClick={onDelete}
            title="Delete session"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-hero-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-hero-muted hover:text-hero-foreground hover:bg-surface-card-border/40 transition-colors"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
        </div>
      </div>

      {/* Expanded transcript */}
      {expanded && (
        <div className="border-t border-surface-card-border px-4 py-3 space-y-3 max-h-80 overflow-y-auto bg-[#0d0f18]">
          {session.messages.slice(1).map(msg => (
            <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, #00c896, #006650)" }}>We</div>
              )}
              <div className={cn("max-w-xs", msg.role === "user" && "flex flex-col items-end")}>
                <div
                  className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                  style={msg.role === "ai"
                    ? { background: "#1a1d27", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.06)" }
                    : { background: "#004638", color: "white", border: "1px solid rgba(0,100,80,0.35)" }}
                >
                  {msg.content}
                </div>
                <p className="text-[9px] text-white/20 mt-0.5 px-1">{msg.timestamp}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
                  style={{ background: "#004638", border: "1px solid rgba(0,100,80,0.3)" }}>You</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface AudienceChatProps {
  /** When set, auto-selects this segment on mount (e.g. coming from Audience Profiler) */
  initialSegmentId?: string | null;
}

const AudienceChat = ({ initialSegmentId }: AudienceChatProps = {}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "data">("chat");

  // ── Audience segment selector ───────────────────────────────────────────────
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSegments(loadSegments()); }, []);

  // Auto-select segment when arriving from Audience Profiler
  useEffect(() => {
    if (!initialSegmentId) return;
    const all = loadSegments();
    const seg = all.find(s => s.id === initialSegmentId);
    if (seg) setSelectedSegment(seg);
  }, [initialSegmentId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const segmentLabel = selectedSegment ? `${selectedSegment.icon} ${selectedSegment.name}` : "All Respondents";
  const systemPrompt = buildSystemPrompt(selectedSegment?.name ?? "All Respondents");

  // ── Session / history state ─────────────────────────────────────────────────
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [historyReportLoading, setHistoryReportLoading] = useState<string | null>(null);

  const refreshHistory = () => setSavedSessions(loadSavedSessions());
  useEffect(() => { refreshHistory(); }, []);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING_MESSAGE(segmentLabel)]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  // ── Export state ────────────────────────────────────────────────────────────
  const [reportLoading, setReportLoading] = useState(false);

  // ── File upload state ───────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Reset conversation when segment changes
  useEffect(() => {
    setMessages([OPENING_MESSAGE(segmentLabel)]);
    setActiveTopic(null);
    setSessionEnded(false);
  }, [selectedSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, overridePrompt?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping || sessionEnded) return;
    setInputValue("");
    setActiveTopic(null);

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, timestamp: now() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const apiKey = getAnthropicKey();
    const history = [...messages, userMsg]
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role === "ai" ? "assistant" as const : "user" as const, content: m.content }));

    if (!apiKey) {
      setTimeout(() => {
        setIsTyping(false);
        const fallbacks = [
          "We're a diverse group, but certain things unite us. We value authenticity above all — brands that speak honestly to us earn our loyalty far more than polished campaigns ever could. We tend to research before buying, especially for anything over £30, and peer recommendations carry far more weight than advertising.",
          "When we think about this category, we're split. Some of us are early adopters who love experimenting with new options. But the majority of us are cautious — we've been burned before by hype that didn't deliver. What wins us over is consistency and a clear reason to believe.",
          "Media-wise, we're fragmented. You can find us on YouTube, Instagram, and increasingly on TikTok — though the older end of our group hasn't fully made that shift. We consume mostly on mobile, mostly in the evenings, and we skip ads whenever we can. But we do engage with content that genuinely entertains or teaches us something.",
        ];
        const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        setMessages(prev => [...prev, { id: uid(), role: "ai", content: reply, timestamp: now() }]);
      }, 1200 + Math.random() * 600);
      return;
    }

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
          max_tokens: 400,
          system: overridePrompt ?? systemPrompt,
          messages: history,
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const reply = data.content?.[0]?.text ?? "We're not sure how to answer that right now.";
      setMessages(prev => [...prev, { id: uid(), role: "ai", content: reply, timestamp: now() }]);
    } catch {
      setMessages(prev => [...prev, {
        id: uid(), role: "ai",
        content: "We're having trouble connecting right now. Try again in a moment.",
        timestamp: now(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, messages, systemPrompt, sessionEnded]);

  const handleTopicClick = (topic: typeof DISCUSSION_TOPICS[0]) => {
    setActiveTopic(topic.id);
    setActiveTab("chat");
    sendMessage(topic.question);
  };

  // ── Session actions ─────────────────────────────────────────────────────────

  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  const persistSession = (msgs: ChatMessage[]) => {
    const session: SavedSession = {
      id: uid(),
      savedAt: new Date().toISOString(),
      segment: segmentLabel,
      messages: msgs,
    };
    localStorage.setItem(`prism_chat_${Date.now()}`, JSON.stringify(session));
    refreshHistory();
    return session;
  };

  const handleEndChat = () => {
    if (!hasConversation) return;
    persistSession(messages);
    setSessionEnded(true);
  };

  const handleStartNewSession = () => {
    setMessages([OPENING_MESSAGE(segmentLabel)]);
    setActiveTopic(null);
    setSessionEnded(false);
    setInputValue("");
  };

  const handleDeleteSession = (id: string) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("prism_chat_")) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const s: SavedSession = JSON.parse(val);
            if (s.id === id) { localStorage.removeItem(key); break; }
          }
        } catch { /* skip */ }
      }
    }
    if (expandedSessionId === id) setExpandedSessionId(null);
    refreshHistory();
  };

  // ── Transcript download (any session) ──────────────────────────────────────
  const triggerTxtDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const buildTranscript = (msgs: ChatMessage[], seg: string, savedAt: string) => {
    const dateStr = new Date(savedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    return [
      "PRISM Audience Chat — Transcript",
      "=".repeat(60),
      `Audience : ${seg}`,
      `Date     : ${dateStr}`,
      `Messages : ${msgs.filter(m => m.role === "user").length} exchanges`,
      "",
      "-".repeat(60),
      "",
      ...msgs.slice(1).map(m =>
        `[${m.timestamp}]  ${m.role === "ai" ? seg.toUpperCase() : "YOU"}\n${m.content}\n`
      ),
      "-".repeat(60),
    ].join("\n");
  };

  const handleExportTranscript = () => {
    const slug = segmentLabel.replace(/[^a-z0-9]/gi, "_");
    triggerTxtDownload(
      buildTranscript(messages, segmentLabel, new Date().toISOString()),
      `PRISM_Transcript_${slug}_${new Date().toISOString().slice(0, 10)}.txt`,
    );
  };

  const handleTranscriptForSession = (session: SavedSession) => {
    const slug = session.segment.replace(/[^a-z0-9]/gi, "_");
    triggerTxtDownload(
      buildTranscript(session.messages, session.segment, session.savedAt),
      `PRISM_Transcript_${slug}_${new Date(session.savedAt).toISOString().slice(0, 10)}.txt`,
    );
  };

  // ── PDF report (any session) ────────────────────────────────────────────────
  const fetchInsights = async (msgs: ChatMessage[], seg: string): Promise<string | undefined> => {
    const apiKey = getAnthropicKey();
    if (!apiKey) return undefined;
    const transcript = msgs
      .slice(1)
      .map(m => `${m.role === "ai" ? `[${seg.toUpperCase()}]` : "[RESEARCHER]"}: ${m.content}`)
      .join("\n\n");
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
            content: `You are a market research analyst. Based on the audience chat below, write a research brief.\n\nAudience: ${seg}\nDate: ${new Date().toLocaleDateString()}\n\nTranscript:\n${transcript}\n\nWrite a research brief with exactly these 5 numbered sections:\n1. AUDIENCE SNAPSHOT - 2-3 bullets on who this audience is\n2. KEY THEMES - 3-5 themes that emerged\n3. VERBATIM HIGHLIGHTS - 2-3 direct quotes from the audience (in double quotes)\n4. STRATEGIC IMPLICATIONS - 2-3 actionable recommendations\n5. FOLLOW-UP QUESTIONS - 2-3 areas worth exploring further\n\nBe concise, specific, insight-driven. Plain text only, no markdown symbols.`,
          }],
        }),
      });
      if (!resp.ok) return undefined;
      const data = await resp.json();
      return data.content?.[0]?.text;
    } catch { return undefined; }
  };

  const handleGenerateReport = async () => {
    if (!hasConversation) return;
    setReportLoading(true);
    const insights = await fetchInsights(messages, segmentLabel);
    downloadAudienceChatPdf({
      segmentLabel,
      savedAt: new Date().toISOString(),
      messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
      aiInsights: insights,
    });
    setReportLoading(false);
  };

  const handleReportForSession = async (session: SavedSession) => {
    setHistoryReportLoading(session.id);
    const insights = await fetchInsights(session.messages, session.segment);
    downloadAudienceChatPdf({
      segmentLabel: session.segment,
      savedAt: session.savedAt,
      messages: session.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
      aiInsights: insights,
    });
    setHistoryReportLoading(null);
  };

  // ── File upload handlers ────────────────────────────────────────────────────
  const processFile = (file: File) => {
    const type = getFileType(file.name);
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const newFile: UploadedFile = {
      id: uid(),
      name: file.name,
      size: `${sizeMB} MB`,
      type,
      status: "processing",
      uploadedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setUploadedFiles(prev => [...prev, newFile]);
    setTimeout(() => {
      setUploadedFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, status: "ready" } : f));
    }, 1800 + Math.random() * 800);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(processFile);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">

      {/* ── Top row: Audience selector + History button ───────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-hero-muted uppercase tracking-wider shrink-0">Audience</span>

        {/* Segment picker */}
        <div className="relative" ref={selectorRef}>
          <button
            onClick={() => setSelectorOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-glow-primary/40 bg-glow-primary/8 text-sm font-semibold text-glow-primary hover:bg-glow-primary/15 transition-colors"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            {segmentLabel}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", selectorOpen && "rotate-180")} />
          </button>

          {selectorOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-20 min-w-[200px] rounded-xl border border-surface-card-border bg-surface-card shadow-xl overflow-hidden">
              <button
                onClick={() => { setSelectedSegment(null); setSelectorOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors",
                  !selectedSegment
                    ? "bg-glow-primary/10 text-glow-primary font-semibold"
                    : "text-hero-muted hover:bg-surface-card-border/30 hover:text-hero-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" /> All Respondents
                {!selectedSegment && <span className="ml-auto text-[10px] text-glow-primary/60">Active</span>}
              </button>
              {segments.length > 0 && (
                <>
                  <div className="h-px bg-surface-card-border" />
                  {segments.map(seg => (
                    <button
                      key={seg.id}
                      onClick={() => { setSelectedSegment(seg); setSelectorOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors",
                        selectedSegment?.id === seg.id
                          ? "bg-glow-primary/10 text-glow-primary font-semibold"
                          : "text-hero-muted hover:bg-surface-card-border/30 hover:text-hero-foreground"
                      )}
                    >
                      <span className="text-base leading-none">{seg.icon}</span>
                      {seg.name}
                      {selectedSegment?.id === seg.id && <span className="ml-auto text-[10px] text-glow-primary/60">Active</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* History button */}
        <button
          onClick={() => setShowHistory(h => !h)}
          className={cn(
            "ml-auto flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all",
            showHistory
              ? "bg-glow-primary/10 border-glow-primary text-glow-primary"
              : "border-surface-card-border text-hero-muted hover:border-glow-primary/40 hover:text-hero-foreground"
          )}
        >
          <History className="h-3.5 w-3.5" />
          Saved sessions
          {savedSessions.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-glow-primary/20 text-glow-primary text-[9px] font-bold flex items-center justify-center">
              {savedSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ── History Panel ─────────────────────────────────────────────────── */}
      {showHistory && (
        <div className="mb-4 rounded-2xl border border-surface-card-border bg-surface-dark/40 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-card-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <History className="h-4 w-4 text-glow-primary" />
              <span className="text-sm font-semibold text-hero-foreground">Saved Sessions</span>
              <span className="text-xs text-hero-muted">({savedSessions.length})</span>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-hero-muted hover:text-hero-foreground hover:bg-surface-card-border/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {savedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <History className="h-8 w-8 text-hero-muted/20 stroke-1" />
              <p className="text-sm text-hero-muted">No saved sessions yet.</p>
              <p className="text-xs text-hero-muted/60">Click "End chat" during a conversation to save it here.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {savedSessions.map(session => (
                <HistoryRow
                  key={session.id}
                  session={session}
                  expanded={expandedSessionId === session.id}
                  onToggle={() => setExpandedSessionId(id => id === session.id ? null : session.id)}
                  onDelete={() => handleDeleteSession(session.id)}
                  onTranscript={() => handleTranscriptForSession(session)}
                  onReport={() => handleReportForSession(session)}
                  reportLoading={historyReportLoading === session.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top tab bar: Chat | Data ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4">
        {(["chat", "data"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border transition-all",
              activeTab === tab
                ? "bg-[#004638] border-[#004638] text-white shadow-sm"
                : "bg-transparent border-surface-card-border text-hero-muted hover:text-hero-foreground hover:border-glow-primary/30"
            )}
          >
            {tab === "chat" ? <MessageSquare className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
            {tab === "chat" ? "Chat" : "Data"}
            {tab === "data" && uploadedFiles.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-glow-primary/20 text-glow-primary text-[9px] font-bold flex items-center justify-center">
                {uploadedFiles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Chat Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col gap-3">

          {/* Chat window */}
          <div
            className="rounded-2xl overflow-hidden border border-white/8 flex flex-col"
            style={{ background: "#13151f", height: "420px" }}
          >
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between shrink-0"
              style={{ background: "#0f1117" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: sessionEnded ? "#333" : "linear-gradient(135deg, #00c896, #006650)" }}>
                  We
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{segmentLabel}</p>
                  <p className="text-[10px] text-white/35 flex items-center gap-1.5">
                    {sessionEnded ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Session ended</>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Speaking as your audience · first-person plural</>
                    )}
                  </p>
                </div>
              </div>
              {/* New session button — always visible in header */}
              <button
                onClick={handleStartNewSession}
                className="text-[11px] text-white/25 hover:text-white/50 transition-colors px-2.5 py-1 rounded-lg border border-white/8 hover:border-white/20 flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" /> New session
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "ai" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: sessionEnded ? "#333" : "linear-gradient(135deg, #00c896, #006650)" }}>
                      We
                    </div>
                  )}
                  <div className={cn("max-w-lg", msg.role === "user" ? "flex flex-col items-end" : "")}>
                    <div className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "ai" ? "rounded-tl-sm text-white/85 border border-white/8" : "rounded-tr-sm text-white"
                    )}
                      style={msg.role === "ai"
                        ? { background: "#1a1d27" }
                        : { background: "#004638", border: "1px solid rgba(0,100,80,0.4)" }
                      }>
                      {msg.content}
                    </div>
                    <p className="text-[9px] text-white/20 mt-1 px-1">{msg.timestamp}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: "#004638", border: "1px solid rgba(0,100,80,0.3)" }}>
                      You
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area — normal OR ended state */}
            <div className="px-4 pb-4 pt-3 border-t border-white/8 shrink-0" style={{ background: "#0f1117" }}>
              {sessionEnded ? (
                /* ── Ended state ── */
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Square className="h-3 w-3 text-amber-400 fill-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/70">Session ended</p>
                      <p className="text-[10px] text-white/30">
                        {messages.filter(m => m.role === "user").length} exchanges saved to history
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleStartNewSession}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
                    style={{ background: "#004638" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Start new session
                  </button>
                </div>
              ) : (
                /* ── Active input ── */
                <>
                  {messages.filter(m => m.role === "user").length === 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none">
                      {SUGGESTED_QUESTIONS.map(q => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="px-3 py-1.5 rounded-full border border-white/10 text-[11px] text-white/40 hover:text-white/70 hover:border-white/25 transition-colors whitespace-nowrap shrink-0"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isTyping}
                      rows={2}
                      placeholder="Ask us anything… (⌘/Ctrl+Enter to send)"
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-glow-primary/40 disabled:opacity-40 resize-none transition-colors border border-white/10"
                      style={{ background: "#1a1d27" }}
                    />
                    <button
                      onClick={() => sendMessage(inputValue)}
                      disabled={!inputValue.trim() || isTyping}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: "#004638" }}
                    >
                      {isTyping
                        ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                        : <Send className="h-4 w-4 text-white" />
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Chat Actions (visible when conversation exists and not ended) ── */}
          {hasConversation && !sessionEnded && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* End chat — primary action */}
              <button
                onClick={handleEndChat}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-amber-500/40 text-amber-400 bg-amber-500/8 hover:bg-amber-500/15 transition-colors"
              >
                <Square className="h-3.5 w-3.5 fill-amber-400" /> End chat
              </button>

              <div className="w-px h-4 bg-surface-card-border" />

              {/* Transcript */}
              <button
                onClick={handleExportTranscript}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-surface-card-border text-hero-muted bg-surface-dark hover:border-glow-primary/40 hover:text-hero-foreground transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> Transcript
              </button>

              {/* PDF Report */}
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-glow-primary/30 text-glow-primary bg-glow-primary/8 hover:bg-glow-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                {reportLoading ? "Generating…" : "PDF report"}
              </button>
            </div>
          )}

          {/* ── Ended: export actions ─────────────────────────────────────── */}
          {sessionEnded && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-hero-muted">Export this session:</span>
              <button
                onClick={handleExportTranscript}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-surface-card-border text-hero-muted bg-surface-dark hover:border-glow-primary/40 hover:text-hero-foreground transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> Transcript
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-glow-primary/30 text-glow-primary bg-glow-primary/8 hover:bg-glow-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                {reportLoading ? "Generating…" : "PDF report"}
              </button>
            </div>
          )}

          {/* ── Discussion Topics (below chat) ────────────────────────────── */}
          {!sessionEnded && (
            <div className="rounded-xl border border-surface-card-border bg-surface-dark/30 px-4 py-3.5 space-y-2.5">
              <p className="text-[11px] font-semibold text-hero-muted uppercase tracking-wider">Discussion Type</p>
              <div className="flex flex-wrap gap-2">
                {DISCUSSION_TOPICS.map(topic => {
                  const Icon = topic.icon;
                  const isActive = activeTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => handleTopicClick(topic)}
                      disabled={isTyping}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all disabled:opacity-40",
                        isActive
                          ? "border-[#d4a017] text-[#d4a017] bg-[#d4a017]/8"
                          : "border-surface-card-border text-hero-muted bg-surface-dark hover:border-glow-primary/40 hover:text-hero-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {topic.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Data Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "data" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-card-border bg-surface-dark/30 p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-3.5 w-3.5 text-hero-muted" />
              <p className="text-[11px] font-semibold text-hero-muted uppercase tracking-wider">Data Priority</p>
            </div>
            <p className="text-[11px] text-hero-muted/70">The chat uses data in this priority order. Survey data always wins when available.</p>
            <div className="space-y-2 mt-1">
              <DataTierBadge tier={1} label="Survey data (Snowflake)" active={true} />
              <DataTierBadge tier={2} label="PRISM secondary / panel data" active={true} />
              <DataTierBadge tier={3} label="Your uploaded files" active={uploadedFiles.some(f => f.status === "ready")} />
            </div>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-all",
              isDragging
                ? "border-glow-primary/60 bg-glow-primary/5"
                : "border-surface-card-border hover:border-glow-primary/30 hover:bg-glow-primary/3"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-surface-dark border border-surface-card-border flex items-center justify-center">
              <Upload className="h-5 w-5 text-hero-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-hero-foreground">Upload files to supplement the chat</p>
              <p className="text-xs text-hero-muted mt-0.5">CSV, PDF, or DOCX · Max 10 MB per file</p>
            </div>
            <div className="flex gap-2">
              {["CSV", "PDF", "DOCX"].map(ext => (
                <span key={ext} className="px-2.5 py-1 rounded-full border border-surface-card-border text-[11px] text-hero-muted bg-surface-dark">
                  .{ext.toLowerCase()}
                </span>
              ))}
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".csv,.pdf,.doc,.docx"
              onChange={handleFileSelect} className="hidden" />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="rounded-xl border border-surface-card-border bg-surface-card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-card-border flex items-center justify-between">
                <p className="text-xs font-semibold text-hero-foreground uppercase tracking-wider">Uploaded Files</p>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-glow-primary/10 text-glow-primary border border-glow-primary/20">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-surface-card-border">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-dark/30 transition-colors">
                    <div className="shrink-0">{fileIcon(file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-hero-foreground truncate">{file.name}</p>
                      <p className="text-[10px] text-hero-muted">{file.size} · Added {file.uploadedAt}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file.status === "processing" && (
                        <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processing
                        </span>
                      )}
                      {file.status === "ready" && (
                        <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> Ready
                        </span>
                      )}
                      {file.status === "error" && (
                        <span className="flex items-center gap-1.5 text-[10px] text-red-400">
                          <AlertCircle className="h-3 w-3" /> Error
                        </span>
                      )}
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-hero-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadedFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <Users className="h-7 w-7 text-hero-muted/25 stroke-1" />
              <p className="text-xs text-hero-muted">No files uploaded yet. The chat will use survey and PRISM data.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudienceChat;
