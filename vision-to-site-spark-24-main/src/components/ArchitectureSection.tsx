const layers = [
  { num: "01", name: "Data Ingestion", desc: "Batch pickup · Survey & third-party ingestion · Validation & monitoring" },
  { num: "02", name: "Data Harmonisation", desc: "Unify survey & external structures · Align taxonomy · Expose usable fields" },
  { num: "03", name: "Analytics & Query", desc: "Audience sizing · Filtering · Query execution · Profiling · Cross-tab logic" },
  { num: "04", name: "Reporting & Visualisation", desc: "Charts · Report generation · Downloadable artifacts · Business outputs" },
  { num: "05", name: "AI Orchestration", desc: "Translate intent · Generate insights · Recommend actions · Coordinate workflows" },
  { num: "06", name: "Action & Activation", desc: "Triggered tasks · Recommendation follow-through · Integrated actions" },
];

const ArchitectureSection = () => {
  return (
    <section className="bg-surface-dark py-24 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-primary/20 to-transparent" />
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-hero-foreground mb-4">
            Layered Architecture
          </h2>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto">
            Clear separation of concerns, from data ingestion to action.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {layers.map((layer, i) => (
            <div
              key={layer.num}
              className="group flex items-start gap-5 p-5 rounded-xl bg-surface-card border border-surface-card-border hover:border-glow transition-all duration-300"
              style={{ marginLeft: `${i * 12}px` }}
            >
              <span className="text-2xl font-bold text-glow-primary/30 group-hover:text-glow-primary/60 transition-colors shrink-0 tabular-nums">
                {layer.num}
              </span>
              <div>
                <h3 className="font-semibold text-hero-foreground mb-0.5">{layer.name}</h3>
                <p className="text-hero-muted text-sm">{layer.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ArchitectureSection;
