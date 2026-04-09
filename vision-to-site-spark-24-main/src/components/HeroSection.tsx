import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative bg-hero min-h-screen flex items-center overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-glow-primary/5 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-glow-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      <div className="container mx-auto px-6 py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-surface-card border border-glow mb-8 text-hero-muted">
              Big Village · Audience Intelligence Platform
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up-delay-1">
            <span className="text-hero-foreground">From Questions to</span>
            <br />
            <span className="text-hero-foreground">Actionable Intelligence</span>
          </h1>

          <p className="text-lg md:text-xl text-hero-muted max-w-2xl mx-auto mb-10 animate-fade-in-up-delay-2 leading-relaxed">
            A unified, AI-guided analytics platform that helps teams define, understand, size, report on, and activate audiences — all through natural language.
          </p>

          <div className="flex justify-center animate-fade-in-up-delay-3">
            <Button size="lg" onClick={() => navigate("/contact")}
              className="bg-[#004638] hover:bg-[#004638]/90 text-white glow-primary px-8 py-6 text-base">
              Request a Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Flow visualization */}
        <div className="mt-20 animate-fade-in-up-delay-3">
          <FlowSteps />
        </div>
      </div>
    </section>
  );
};

const FlowSteps = () => {
  const steps = ["Need", "Information", "Insights", "Recommendations", "Actions"];

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2 md:gap-4">
          <div className="px-4 py-2.5 md:px-6 md:py-3 rounded-lg bg-[#004638]/10 border border-[#004638]/30 text-sm md:text-base font-semibold text-[#004638] hover:bg-[#004638]/20 hover:border-[#004638]/50 transition-colors duration-300">
            {step}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 text-[#004638] shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
};

export default HeroSection;
