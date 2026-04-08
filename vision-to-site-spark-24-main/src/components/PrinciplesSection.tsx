import { Route, ShieldCheck, BookOpen, Server, Coins, Rocket } from "lucide-react";

const principles = [
  { icon: Route, title: "Not Just a Dashboard", description: "Guide users from question to action — not a passive BI tool." },
  { icon: ShieldCheck, title: "AI-Led, but Trustworthy", description: "AI-generated insights backed by downloadable supporting data." },
  { icon: BookOpen, title: "Business Explainability", description: "Outputs in business terms, not data science jargon." },
  { icon: Server, title: "Scalable by Design", description: "Large data volumes require governed architecture and clear compute separation." },
  { icon: Coins, title: "Cost-Aware AI Usage", description: "Agentic AI must be purposeful, not overused." },
  { icon: Rocket, title: "Progress Over Perfection", description: "Launch in a useful form rather than wait for full completeness." },
];

const PrinciplesSection = () => {
  return (
    <section className="bg-hero py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-hero-foreground mb-4">
            Design Principles
          </h2>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto">
            The guardrails that shape every product decision.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {principles.map((p) => (
            <div key={p.title} className="flex gap-4 p-5 rounded-xl bg-surface-card border border-surface-card-border">
              <div className="w-10 h-10 rounded-lg bg-glow-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <p.icon className="h-5 w-5 text-glow-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-hero-foreground mb-1">{p.title}</h3>
                <p className="text-hero-muted text-sm leading-relaxed">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PrinciplesSection;
