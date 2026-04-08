import { MessageSquare, UserSearch, Eye, Sparkles, FileText, PlayCircle } from "lucide-react";

const steps = [
  { icon: MessageSquare, title: "State Intent", description: "Express your business need in natural language", number: "01" },
  { icon: UserSearch, title: "Build Audience", description: "Create or search for a target audience", number: "02" },
  { icon: Eye, title: "Understand", description: "Analyse properties across all data sources", number: "03" },
  { icon: Sparkles, title: "Review AI Insights", description: "Receive AI-generated insight summaries", number: "04" },
  { icon: FileText, title: "Generate Report", description: "Charts, narratives, downloadable outputs", number: "05" },
  { icon: PlayCircle, title: "Take Action", description: "Trigger recommendations or activation workflows", number: "06" },
];

const JourneySection = () => {
  return (
    <section className="bg-surface-dark py-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-primary/20 to-transparent" />
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-hero-foreground mb-4">
            The User Journey
          </h2>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto">
            A guided, conversational path from business question to decisive action.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative group">
              <span className="absolute -top-2 -left-2 text-6xl font-bold text-glow-primary/5 group-hover:text-glow-primary/10 transition-colors select-none">
                {step.number}
              </span>
              <div className="relative pt-6 pl-4">
                <div className="w-10 h-10 rounded-lg bg-glow-accent/10 flex items-center justify-center mb-3">
                  <step.icon className="h-5 w-5 text-glow-accent" />
                </div>
                <h3 className="text-lg font-semibold text-hero-foreground mb-1">{step.title}</h3>
                <p className="text-hero-muted text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-accent/20 to-transparent" />
    </section>
  );
};

export default JourneySection;
