import { useState } from "react";
import Navbar from "@/components/Navbar";
import {
  Users, BarChart2, FlaskConical, MessageSquare,
  GitFork, Activity, ClipboardList,
  HexagonIcon, Menu, X, ChevronRight, Key, Trash2, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAnthropicKey, setAnthropicKey, deleteAnthropicKey } from "@/lib/anthropicNlp";
import AudienceBuilder from "@/components/audience-analysis/AudienceBuilder";
import IntelligenceReport from "@/components/intelligence/IntelligenceReport";
import ConceptTesting from "@/components/concept-testing/ConceptTesting";
import Orchestration from "@/components/orchestration/Orchestration";
import FocusGroup from "@/components/focus-group/FocusGroup";
import Monitor from "@/components/monitor/Monitor";
import SurveySimulator from "@/components/survey-simulator/SurveySimulator";

// ─── Sidebar modules ────────────────────────────────────────────
const MODULES = [
  { id: "audience-builder",  label: "Audience Builder",  icon: Users,          num: "01" },
  { id: "intelligence",      label: "Intelligence",       icon: BarChart2,       num: "02" },
  { id: "concept-testing",   label: "Concept Testing",    icon: FlaskConical,    num: "03" },
  { id: "focus-group",       label: "Focus Group",        icon: MessageSquare,   num: "04" },
  { id: "orchestration",     label: "Orchestration",      icon: GitFork,         num: "05" },
  { id: "monitor",           label: "Monitor",            icon: Activity,        num: "06" },
  { id: "survey-simulator",  label: "Survey Simulator",   icon: ClipboardList,   num: "07" },
];

// ─── Placeholder for other modules ──────────────────────────────
const ComingSoon = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
    <HexagonIcon className="h-10 w-10 text-hero-muted/30 stroke-1" />
    <p className="text-hero-foreground font-medium">{label}</p>
    <p className="text-hero-muted text-sm">This module is coming soon.</p>
  </div>
);

// ─── Page ────────────────────────────────────────────────────────
const AudienceAnalysis = () => {
  const [activeModule, setActiveModule] = useState("audience-builder");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const module = MODULES.find((m) => m.id === activeModule)!;

  // ─── API key management ────────────────────────────────────────
  const [apiKey, setApiKeyState] = useState<string | null>(getAnthropicKey);
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setAnthropicKey(trimmed);
    setApiKeyState(trimmed);
    setKeyInput("");
    setKeyPanelOpen(false);
  };

  const handleDeleteKey = () => {
    deleteAnthropicKey();
    setApiKeyState(null);
    setConfirmDelete(false);
    setKeyPanelOpen(false);
  };

  return (
    <div className="min-h-screen bg-hero">
      <Navbar />
      <div className="pt-20 flex h-[calc(100vh-5rem)]">

        {/* Left Sidebar */}
        <aside className={cn(
          "flex-shrink-0 bg-hero border-r border-surface-card-border overflow-y-auto transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-16"
        )}>
          {/* Hamburger toggle */}
          <div className={cn(
            "flex items-center border-b border-surface-card-border py-3 flex-shrink-0",
            sidebarOpen ? "px-4 justify-between" : "px-3 justify-center"
          )}>
            {sidebarOpen && (
              <span className="text-xs font-bold text-hero-muted uppercase tracking-widest">Modules</span>
            )}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-dark/50 text-hero-muted hover:text-hero-foreground transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Nav items */}
          <nav className="py-3 flex-1">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const active = m.id === activeModule;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  title={!sidebarOpen ? m.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 transition-colors text-left relative group",
                    sidebarOpen ? "px-4 py-3" : "px-0 py-3 justify-center",
                    active
                      ? "bg-[#004638]/10 text-[#004638] border-r-2 border-[#004638]"
                      : "text-hero-muted hover:text-hero-foreground hover:bg-surface-dark/40"
                  )}
                >
                  <Icon className={cn("flex-shrink-0", sidebarOpen ? "h-5 w-5" : "h-5 w-5")} />

                  {sidebarOpen && (
                    <>
                      <span className="flex-1 font-semibold text-base">{m.label}</span>
                      <span className={cn(
                        "text-xs font-mono",
                        active ? "text-[#004638]/60" : "text-hero-muted/40"
                      )}>
                        {m.num}
                      </span>
                    </>
                  )}

                  {/* Tooltip when collapsed */}
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-surface-card border border-surface-card-border text-xs font-semibold text-hero-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      <span className="text-hero-muted/50 mr-1.5">{m.num}</span>{m.label}
                      <ChevronRight className="inline h-3 w-3 ml-1 text-hero-muted/40" />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ─── API Key footer ──────────────────────────────────── */}
          <div className={cn(
            "border-t border-surface-card-border flex-shrink-0",
            sidebarOpen ? "p-3" : "py-3 flex justify-center"
          )}>
            {/* Collapsed: icon only */}
            {!sidebarOpen && (
              <button
                onClick={() => { setSidebarOpen(true); setKeyPanelOpen(true); }}
                title="API Key"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
                  apiKey
                    ? "text-emerald-500 hover:bg-emerald-500/10"
                    : "text-amber-500 hover:bg-amber-500/10"
                )}
              >
                <Key className="h-4 w-4" />
              </button>
            )}

            {/* Expanded: full key manager */}
            {sidebarOpen && !keyPanelOpen && (
              <button
                onClick={() => { setKeyPanelOpen(true); setConfirmDelete(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                  apiKey
                    ? "hover:bg-emerald-500/10"
                    : "hover:bg-amber-500/10"
                )}
              >
                <Key className={cn("h-4 w-4 flex-shrink-0", apiKey ? "text-emerald-500" : "text-amber-500")} />
                <div className="min-w-0">
                  <p className={cn("text-xs font-semibold", apiKey ? "text-emerald-500" : "text-amber-500")}>
                    {apiKey ? "API Key set" : "No API Key"}
                  </p>
                  <p className="text-xs text-hero-muted truncate">
                    {apiKey ? apiKey.slice(0, 12) + "…" : "Click to add"}
                  </p>
                </div>
                {apiKey && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 ml-auto" />}
              </button>
            )}

            {/* Expanded: key panel open */}
            {sidebarOpen && keyPanelOpen && (
              <div className="space-y-2">
                {!confirmDelete ? (
                  <>
                    <Input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                      placeholder={apiKey ? "Replace key…" : "sk-ant-…"}
                      className="h-8 text-xs bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted font-mono"
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={handleSaveKey}
                        disabled={!keyInput.trim()}
                        className="h-7 px-3 text-xs bg-[#004638] hover:bg-[#004638]/90 text-white flex-1"
                      >
                        Save
                      </Button>
                      {apiKey && (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="h-7 px-2 flex items-center gap-1 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                      <button
                        onClick={() => { setKeyPanelOpen(false); setKeyInput(""); }}
                        className="h-7 px-2 text-xs text-hero-muted hover:text-hero-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-2">
                    <p className="text-xs text-hero-foreground">Delete API key?</p>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={handleDeleteKey}
                        className="h-7 px-3 text-xs bg-red-500 hover:bg-red-600 text-white flex-1"
                      >
                        Yes, delete
                      </Button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="h-7 px-2 text-xs text-hero-muted hover:text-hero-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeModule === "intelligence" ? (
            <div className="px-8">
              <IntelligenceReport embedded />
            </div>
          ) : activeModule === "focus-group" ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Focus Group Studio</h1>
                <p className="text-hero-muted text-sm mt-1">Run AI-simulated focus groups with synthetic participants drawn from your audience</p>
              </div>
              <FocusGroup />
            </div>
          ) : activeModule === "monitor" ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Brand Monitor</h1>
                <p className="text-hero-muted text-sm mt-1">Track brand awareness, sentiment, and competitive positioning across online sources</p>
              </div>
              <Monitor />
            </div>
          ) : activeModule === "orchestration" ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Orchestration</h1>
                <p className="text-hero-muted text-sm mt-1">Generate brand strategy, communications plan, ad tactics, and media plan</p>
              </div>
              <Orchestration />
            </div>
          ) : activeModule === "survey-simulator" ? (
            <div className="p-8 max-w-3xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Survey Simulator</h1>
                <p className="text-hero-muted text-sm mt-1">Field a custom survey with your audience and analyse results</p>
              </div>
              <SurveySimulator />
            </div>
          ) : (
            <div className="p-8 max-w-5xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">{module.label}</h1>
                <p className="text-hero-muted text-sm mt-1">
                  {activeModule === "audience-builder" && "Define your target audience using segments or custom criteria"}
                  {activeModule === "concept-testing" && "Test concepts and messaging with your audience"}
                  {activeModule === "focus-group" && "Run qualitative research with targeted groups"}
                  {activeModule === "monitor" && "Track audience changes and campaign performance"}
                </p>
              </div>
              {activeModule === "audience-builder" && <AudienceBuilder />}
              {activeModule === "concept-testing" && <ConceptTesting />}
              {!["audience-builder", "concept-testing"].includes(activeModule) && !["focus-group", "monitor"].includes(activeModule) && (
                <ComingSoon label={`${module.label} module coming soon`} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AudienceAnalysis;
