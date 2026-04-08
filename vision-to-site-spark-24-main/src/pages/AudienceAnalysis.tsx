import { useState } from "react";
import Navbar from "@/components/Navbar";
import LoginGate from "@/components/LoginGate";
import {
  Users, BarChart2, FlaskConical, MessageSquare,
  TableProperties, GitFork, Zap, Activity,
  HexagonIcon,
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
  const module = MODULES.find((m) => m.id === activeModule)!;

  return (
    <LoginGate>
    <div className="min-h-screen bg-hero">
      <Navbar />
      <div className="pt-16 flex h-[calc(100vh-4rem)]">

        {/* Left Sidebar */}
        <aside className="w-52 flex-shrink-0 bg-hero border-r border-surface-card-border overflow-y-auto">
          <nav className="py-4">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const active = m.id === activeModule;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left",
                    active
                      ? "bg-glow-primary/10 text-glow-primary border-r-2 border-glow-primary"
                      : "text-hero-muted hover:text-hero-foreground hover:bg-surface-dark/40"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 font-medium">{m.label}</span>
                  <span className={cn(
                    "text-[10px] font-mono",
                    active ? "text-glow-accent" : "text-hero-muted/50"
                  )}>
                    {m.num}
                  </span>
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
                  {activeModule === "crosstab-studio" && "Analyze relationships across audience dimensions"}
                  {activeModule === "orchestration" && "Automate and orchestrate audience workflows"}
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
