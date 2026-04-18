import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-hero py-16 sm:py-24 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[600px] lg:h-[600px] rounded-full bg-glow-primary/5 blur-[150px]" />
      </div>
      <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-hero-foreground mb-4 sm:mb-6">
          The North Star
        </h2>
        <p className="text-hero-muted text-base sm:text-lg md:text-xl max-w-3xl mx-auto mb-4 leading-relaxed">
          The Audience Intelligence Platform is not being built to simply expose data. It is being built to unify fragmented data assets into a usable, AI-guided system.
        </p>
        <p className="text-lg sm:text-xl md:text-2xl font-bold mb-8 sm:mb-10" style={{ color: "#004638" }}>
          Need → Information → Insights → Recommendations → Actions
        </p>
        <Button size="lg" onClick={() => navigate("/contact")}
          className="bg-[#004638] hover:bg-[#004638]/90 text-white glow-primary px-7 py-5 sm:px-10 sm:py-6 text-sm sm:text-base">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <p className="text-hero-muted text-xs sm:text-sm mt-10 sm:mt-12">
          Big Village · Audience Intelligence Platform · April 2026
        </p>
      </div>
    </section>
  );
};

export default CTASection;
