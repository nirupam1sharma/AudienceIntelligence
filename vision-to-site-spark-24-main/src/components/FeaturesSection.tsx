import { Search, Users, BarChart3, Brain, Lightbulb, Zap } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Audience Search & Creation",
    description: "Describe an audience in natural language. Search existing definitions or create new ones through conversational query.",
  },
  {
    icon: Users,
    title: "Audience Understanding",
    description: "Analyse demographics, media behaviour, survey responses, and taxonomy-based attributes across all data sources.",
  },
  {
    icon: BarChart3,
    title: "Reporting & Visualisation",
    description: "Generate charts and reports, summarise findings in business language, and export production-ready outputs.",
  },
  {
    icon: Brain,
    title: "AI Insight Generation",
    description: "Business-oriented insights grounded in real data. No jargon — just clear, actionable intelligence.",
  },
  {
    icon: Lightbulb,
    title: "Recommendations",
    description: "Brand strategy suggestions, ad tactic guidance, and next-step actions derived from audience properties.",
  },
  {
    icon: Zap,
    title: "Activation",
    description: "Move from insight to action. Trigger downstream workflows and execute recommendations within the platform.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="bg-hero py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-glow-primary/[0.02] to-transparent" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-hero-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto">
            Six integrated capabilities that take you from business question to decisive action.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl bg-surface-card border border-surface-card-border hover:border-glow transition-all duration-300 hover:glow-primary"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-glow-primary" />
              </div>
              <h3 className="text-lg font-semibold text-hero-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-hero-muted text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
