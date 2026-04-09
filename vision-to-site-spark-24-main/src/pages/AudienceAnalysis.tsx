import { useState } from "react";
import Navbar from "@/components/Navbar";
import LoginGate from "@/components/LoginGate";
import {
  Users, BarChart2, FlaskConical, MessageSquare,
  TableProperties, GitFork, Zap, Activity,
  HexagonIcon, Menu, X, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AudienceBuilder from "@/components/audience-analysis/AudienceBuilder";
import IntelligenceReport from "@/components/intelligence/IntelligenceReport";
import CrosstabStudio from "@/components/crosstab/CrosstabStudio";
import ConceptTesting from "@/components/concept-testing/ConceptTesting";
import Orchestration from "@/components/orchestration/Orchestration";

// ─── Sidebar modules ────────────────────────────────────────────
const MODULES = [
  { id: "audience-builder",  label: "Audience Builder",  icon: Users,           num: "01" },
  { id: "intelligence",      label: "Intelligence",       icon: BarChart2,        num: "02" },
  { id: "concept-testing",   label: "Concept Testing",    icon: FlaskConical,     num: "03" },
  { id: "focus-group",       label: "Focus Group",        icon: MessageSquare,    num: "04" },
  { id: "crosstab-studio",   label: "Cross-Tab Studio",   icon: TableProperties,  num: "05" },
  { id: "orchestration",     label: "Orchestration",      icon: GitFork,          num: "06" },
  { id: "activation",        label: "Activation",         icon: Zap,              num: "07" },
  { id: "monitor",           label: "Monitor",            icon: Activity,         num: "08" },
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

  return (
    <LoginGate>
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
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeModule === "intelligence" ? (
            <div className="px-8">
              <IntelligenceReport embedded />
            </div>
          ) : activeModule === "crosstab-studio" ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Cross-Tab Studio</h1>
                <p className="text-hero-muted text-sm mt-1">Analyze relationships across audience dimensions</p>
              </div>
              <CrosstabStudio />
            </div>
          ) : activeModule === "orchestration" ? (
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">Orchestration</h1>
                <p className="text-hero-muted text-sm mt-1">Generate brand strategy, communications plan, ad tactics, and media plan</p>
              </div>
              <Orchestration />
            </div>
          ) : (
            <div className="p-8 max-w-5xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-hero-foreground">{module.label}</h1>
                <p className="text-hero-muted text-sm mt-1">
                  {activeModule === "audience-builder" && "Define your target audience using segments or custom criteria"}
                  {activeModule === "concept-testing" && "Test concepts and messaging with your audience"}
                  {activeModule === "focus-group" && "Run qualitative research with targeted groups"}
                  {activeModule === "activation" && "Activate audiences across channels and platforms"}
                  {activeModule === "monitor" && "Track audience changes and campaign performance"}
                </p>
              </div>
              {activeModule === "audience-builder" && <AudienceBuilder />}
              {activeModule === "concept-testing" && <ConceptTesting />}
              {!["audience-builder", "concept-testing"].includes(activeModule) && (
                <ComingSoon label={`${module.label} module coming soon`} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
    </LoginGate>
  );
};

export default AudienceAnalysis;
