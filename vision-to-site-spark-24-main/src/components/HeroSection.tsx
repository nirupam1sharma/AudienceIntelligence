import { ArrowRight } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative bg-hero min-h-screen flex items-center overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-48 h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 rounded-full bg-glow-primary/5 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-40 h-40 md:w-60 md:h-60 lg:w-80 lg:h-80 rounded-full bg-glow-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <span className="inline-block px-3 py-1.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium bg-surface-card border border-glow mb-6 sm:mb-8 text-hero-muted">
              Big Village · Audience Intelligence Platform
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-5 sm:mb-6 animate-fade-in-up-delay-1">
            <span className="text-hero-foreground">From Questions to</span>
            <br />
            <span className="text-hero-foreground">Activation</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-hero-muted max-w-2xl mx-auto mb-8 sm:mb-10 animate-fade-in-up-delay-2 leading-relaxed">
            A unified, AI-guided analytics platform that helps teams define, understand, size, report on, and activate audiences — all through natural language.
          </p>

        </div>

        {/* Flow visualization */}
        <div className="mt-14 sm:mt-20 animate-fade-in-up-delay-3">
          <FlowSteps />
        </div>
      </div>
    </section>
  );
};

const FlowSteps = () => {
  const steps = ["Need", "Information", "Insights", "Recommendations", "Actions"];

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-4 flex-wrap">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg bg-[#004638]/10 border border-[#004638]/30 text-xs sm:text-sm md:text-base font-semibold text-[#004638] hover:bg-[#004638]/20 hover:border-[#004638]/50 transition-colors duration-300">
            {step}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-[#004638] shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
};

export default HeroSection;
