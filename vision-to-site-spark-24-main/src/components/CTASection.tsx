import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="bg-hero py-24 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-glow-primary/5 blur-[150px]" />
      </div>
      <div className="container mx-auto px-6 relative z-10 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-hero-foreground mb-6">
          The North Star
        </h2>
        <p className="text-hero-muted text-lg md:text-xl max-w-3xl mx-auto mb-4 leading-relaxed">
          The Audience Intelligence Platform is not being built to simply expose data. It is being built to unify fragmented data assets into a usable, AI-guided system.
        </p>
        <p className="text-gradient-primary text-xl md:text-2xl font-semibold mb-10">
          Need → Information → Insights → Recommendations → Actions
        </p>
        <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary px-10 py-6 text-base">
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-hero-muted text-sm mt-12">
          Big Village · Audience Intelligence Platform · April 2026
        </p>
      </div>
    </section>
  );
};

export default CTASection;
